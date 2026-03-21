/**
 * Edge Function: cron-support-user-cleanup
 *
 * Entfernt den Support-Benutzer aus Anlässen, die bereits beendet sind.
 * Der Support-User wird bei Supportanfragen temporär als Koch zu Events
 * hinzugefügt und soll nach Event-Ende automatisch entfernt werden.
 *
 * Zeitplan: Täglich um 02:30 UTC (03:30/04:30 Zürich)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SUPPORT_USER_ID (Auth-UUID des Support-Benutzers)
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  errorResponse,
  successResponse,
} from "../_shared/emailService.ts";
import {
  startCronJob,
  completeCronJob,
  failCronJob,
  sentryCheckIn,
} from "../_shared/cronJobHelper.ts";

/* =====================================================================
// Konstanten
// ===================================================================== */

const JOB_NAME = "cron-support-user-cleanup";

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supportUserId = Deno.env.get("SUPPORT_USER_ID");

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(JOB_NAME, "Missing Supabase config", 500);
  }

  if (!supportUserId) {
    return errorResponse(JOB_NAME, "Missing SUPPORT_USER_ID env var", 500);
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

    // 1. Beendete Events finden, in denen der Support-User noch Koch ist.
    //    Ein Event ist beendet, wenn das maximale date_to aller event_dates
    //    in der Vergangenheit liegt.
    const {data: endedEventCooks, error: queryError} = await supabaseAdmin
      .from("event_cooks")
      .select("id, event_id, events!inner(name)")
      .eq("user_id", supportUserId);

    if (queryError) {
      throw new Error(
        `Abfrage event_cooks fehlgeschlagen: ${queryError.message}`
      );
    }

    if (!endedEventCooks || endedEventCooks.length === 0) {
      console.log(`${JOB_NAME}: Support-User ist in keinem Event — nichts zu tun`);
      await completeCronJob(supabaseAdmin, logId, 0, {
        removedFromEvents: [],
      });
      await sentryCheckIn(JOB_NAME, "ok", checkInId);
      return successResponse({removed: 0});
    }

    // 2. Für jedes Event prüfen, ob es beendet ist (max date_to < heute)
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const toRemove: {cookRowId: string; eventId: string; eventName: string}[] =
      [];

    for (const cook of endedEventCooks) {
      const eventId = cook.event_id as string;

      // Maximales date_to des Events abfragen
      const {data: dates, error: dateError} = await supabaseAdmin
        .from("event_dates")
        .select("date_to")
        .eq("event_id", eventId)
        .order("date_to", {ascending: false})
        .limit(1);

      if (dateError || !dates || dates.length === 0) continue;

      const maxDateTo = dates[0].date_to as string;
      if (maxDateTo < today) {
        const eventData = cook.events as unknown as {name: string};
        toRemove.push({
          cookRowId: cook.id as string,
          eventId,
          eventName: eventData?.name ?? eventId,
        });
      }
    }

    // 3. Beendete Event-Cook-Einträge löschen
    if (toRemove.length > 0) {
      const idsToDelete = toRemove.map((entry) => entry.cookRowId);
      const {error: deleteError} = await supabaseAdmin
        .from("event_cooks")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        throw new Error(
          `Löschen von event_cooks fehlgeschlagen: ${deleteError.message}`
        );
      }
    }

    // 4. Job abschliessen
    const removedEventNames = toRemove.map((entry) => entry.eventName);
    await completeCronJob(supabaseAdmin, logId, toRemove.length, {
      removedFromEvents: removedEventNames,
    });
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: Support-User aus ${toRemove.length} beendeten Events entfernt: ${removedEventNames.join(", ") || "—"}`
    );

    return successResponse({
      removed: toRemove.length,
      events: removedEventNames,
    });
  } catch (err) {
    console.error(`${JOB_NAME} error:`, err);

    if (logId) {
      await failCronJob(supabaseAdmin, logId, String(err));
    }
    await sentryCheckIn(JOB_NAME, "error", checkInId);

    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  }
});
