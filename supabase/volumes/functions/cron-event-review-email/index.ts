/**
 * Edge Function: cron-event-review-email
 *
 * Sendet eine Feedback-E-Mail an alle Köche von Anlässen, die gestern
 * beendet wurden (maximales date_to = gestern).
 *
 * Zeitplan: Täglich um 01:00 UTC (02:00/03:00 Zürich)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL (z.B. "https://chuchipirat.ch")
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 *   BREVO_API_KEY (Produktion) oder SMTP_HOST/SMTP_PORT (lokal)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendEmail,
  readEmailEnv,
  isEmailConfigured,
  errorResponse,
  successResponse,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";
import {
  startCronJob,
  completeCronJob,
  failCronJob,
  sentryCheckIn,
} from "../_shared/cronJobHelper.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";

/* =====================================================================
// Konstanten
// ===================================================================== */

const JOB_NAME = "cron-event-review-email";

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  // ── Authentifizierung: Nur service_role darf Cron-Jobs auslösen ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(JOB_NAME, "Missing Authorization header", 401);
  }
  try {
    const payload = JSON.parse(atob(authHeader.split(".")[1]));
    if (payload.role !== "service_role") {
      return errorResponse(JOB_NAME, "Forbidden: service_role required", 403);
    }
  } catch {
    return errorResponse(JOB_NAME, "Invalid token", 401);
  }

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "https://chuchipirat.ch";
  const emailEnv = readEmailEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(JOB_NAME, "Missing Supabase config", 500);
  }

  if (!isEmailConfigured(emailEnv)) {
    return errorResponse(JOB_NAME, "No email transport configured", 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Cron-Job-Logging und Sentry starten
  let logId: string | undefined;
  let checkInId: string | null = null;

  try {
    logId = await startCronJob(supabaseAdmin, JOB_NAME);
    checkInId = await sentryCheckIn(JOB_NAME, "in_progress");

    // 1. Gestern berechnen (Europe/Zurich)
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const zurichFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    // Format: YYYY-MM-DD (en-CA liefert ISO-Format)
    const yesterdayDate = zurichFormatter.format(yesterday);

    // 2. Events finden, deren maximales date_to = gestern ist
    //    Alle event_dates laden und manuell gruppieren
    //    (Supabase JS-Client unterstützt kein GROUP BY + HAVING)
    const {data: allDates, error: datesError} = await supabaseAdmin
      .from("event_dates")
      .select("event_id, date_to");

    if (datesError) {
      throw new Error(
        `Event-Dates-Abfrage fehlgeschlagen: ${datesError.message}`
      );
    }

    // Maximales date_to pro Event berechnen
    const maxDateByEvent = new Map<string, string>();
    for (const dateRow of allDates ?? []) {
      const eventId = dateRow.event_id as string;
      const dateTo = dateRow.date_to as string;
      const current = maxDateByEvent.get(eventId);
      if (!current || dateTo > current) {
        maxDateByEvent.set(eventId, dateTo);
      }
    }

    // Events filtern, die gestern endeten
    const endedEventIds = Array.from(maxDateByEvent.entries())
      .filter(([, maxDate]) => maxDate === yesterdayDate)
      .map(([eventId]) => eventId);

    if (endedEventIds.length === 0) {
      console.log(`${JOB_NAME}: Keine Events gestern beendet — übersprungen`);
      await completeCronJob(supabaseAdmin, logId, 0, {
        date: yesterdayDate,
        endedEvents: 0,
      });
      await sentryCheckIn(JOB_NAME, "ok", checkInId);
      return successResponse({
        skipped: true,
        reason: "no_ended_events",
        date: yesterdayDate,
      });
    }

    // 3. Event-Namen laden
    const {data: events, error: eventError} = await supabaseAdmin
      .from("events")
      .select("id, name")
      .in("id", endedEventIds);

    if (eventError) {
      throw new Error(`Events-Abfrage fehlgeschlagen: ${eventError.message}`);
    }

    const eventNameMap = new Map<string, string>();
    for (const event of events ?? []) {
      eventNameMap.set(event.id as string, event.name as string);
    }

    // 4. Köche der beendeten Events laden und E-Mails senden
    let totalEmailsSent = 0;
    const errors: string[] = [];
    const processedEvents: string[] = [];

    for (const eventId of endedEventIds) {
      const eventName = eventNameMap.get(eventId) ?? eventId;

      // Köche laden — zwei separate Abfragen nötig, da event_cooks.user_id
      // auf auth.users(id) verweist, nicht auf public.users. Der Join über
      // PostgREST würde die falsche Tabelle treffen. Stattdessen matchen wir
      // über public.users.id (UUID).
      const {data: cookRows, error: cookError} = await supabaseAdmin
        .from("event_cooks")
        .select("user_id")
        .eq("event_id", eventId);

      if (cookError) {
        errors.push(`Event ${eventId}: ${cookError.message}`);
        continue;
      }

      if (!cookRows || cookRows.length === 0) continue;

      const cookUserIds = cookRows.map(
        (cook: {user_id: string}) => cook.user_id
      );
      const {data: cookUsers, error: userError} = await supabaseAdmin
        .from("users")
        .select("id, email, display_name")
        .in("id", cookUserIds);

      if (userError) {
        errors.push(`Event ${eventId} (User-Abfrage): ${userError.message}`);
        continue;
      }

      for (const userData of cookUsers ?? []) {
        if (!userData?.email) continue;

        try {
          const cookName = userData.display_name || "Koch";
          const subject = `Wie war euer Anlass «${eventName}»?`;

          const htmlContent = renderEmailTemplate("event-review", {
            subject,
            cookName,
            eventName,
          });

          const textContent =
            `Hallo ${cookName},\n\n` +
            `Euer Anlass «${eventName}» ist vorbei — wir hoffen, ihr hattet eine tolle Zeit in der Lagerküche und konntet gemeinsam leckere Gerichte zaubern!\n\n` +
            `Jetzt sind wir gespannt auf euer Feedback! Was hat euch gefallen, was könnten wir besser machen? Eure Rückmeldungen helfen uns, chuchipirat noch besser auf euch abzustimmen.\n\n` +
            `Feedback geben: https://forms.gle/6vkknRiVftbwaEe87\n` +
            `Dauert nur ein paar Minuten — versprochen!\n\n` +
            `---\n\n` +
            `Falls ihr euren Anlass genossen habt und noch etwas Budget übrig ist: chuchipirat ist ein ehrenamtliches Projekt — jede Spende hilft uns, die App weiterzuentwickeln und für alle gratis zu halten.\n\n` +
            `Jetzt spenden: ${appUrl}/donate\n\n` +
            `---\n\n` +
            `Danke, dass ihr dabei wart — und hoffentlich bis bald wieder im chuchipirat!\n\n` +
            `Bei Fragen: hallo@chuchipirat.ch`;

          await sendEmail(emailEnv, userData.email, subject, htmlContent, textContent);
          totalEmailsSent++;
        } catch (err) {
          errors.push(`${userData.email}: ${String(err)}`);
        }
      }

      processedEvents.push(eventName);
    }

    // 5. mail_log Eintrag
    if (totalEmailsSent > 0) {
      await supabaseAdmin.from("mail_log").insert({
        recipients: processedEvents,
        recipient_type: "role",
        subject: "Event-Review E-Mails",
        body: `Review-E-Mails für ${processedEvents.length} beendete Events versendet`,
        template_name: "event-review",
        delivery_status: errors.length === 0 ? "success" : "error",
        error_message: errors.length > 0 ? errors.join("; ") : null,
        details: {
          date: yesterdayDate,
          events: processedEvents,
          emailsSent: totalEmailsSent,
        },
      });
    }

    // 6. Job abschliessen
    await completeCronJob(supabaseAdmin, logId, totalEmailsSent, {
      date: yesterdayDate,
      endedEvents: processedEvents,
      emailsSent: totalEmailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: ${totalEmailsSent} Review-E-Mails gesendet für ${processedEvents.length} Events`
    );

    return successResponse({
      emailsSent: totalEmailsSent,
      events: processedEvents,
      date: yesterdayDate,
    });
  } catch (err) {
    console.error(`${JOB_NAME} error:`, err);
    await sentryCaptureError(err, JOB_NAME);

    if (logId) {
      await failCronJob(supabaseAdmin, logId, String(err));
    }
    await sentryCheckIn(JOB_NAME, "error", checkInId);

    return new Response(
      JSON.stringify({error: "Ein interner Fehler ist aufgetreten."}),
      {
        status: 500,
        headers: {...CORS_HEADERS, "Content-Type": "application/json"},
      },
    );
  }
});
