/**
 * Edge Function: send-welcome-email
 *
 * Sendet eine Willkommens-E-Mail an neu registrierte Benutzer.
 * Wird durch einen Postgres-Trigger auf der `users`-Tabelle
 * via `pg_net.http_post()` bei INSERT aufgerufen.
 *
 * Erwartet einen POST-Body mit:
 *   { record: { id: string } }        (Trigger-Payload)
 *   oder { user_id: string }          (manueller Aufruf)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   APP_URL (z.B. "https://chuchipirat.ch")
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

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Payload-Struktur des POST-Bodys.
 *
 * @param record Trigger-Payload mit id.
 * @param user_id Alternative: direkte Auth-UUID.
 */
type WelcomePayload = {
  record?: {id: string};
  user_id?: string;
};

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  if (req.method !== "POST") {
    return errorResponse("send-welcome-email", "Method not allowed", 405);
  }

  // Umgebungsvariablen lesen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appUrl = Deno.env.get("APP_URL") ?? "https://chuchipirat.ch";
  const emailEnv = readEmailEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(
      "send-welcome-email",
      "Server configuration error: missing Supabase config",
      500
    );
  }

  if (!isEmailConfigured(emailEnv)) {
    return errorResponse(
      "send-welcome-email",
      "Server configuration error: neither BREVO_API_KEY nor SMTP_HOST is set",
      500
    );
  }

  // Payload lesen
  let payload: WelcomePayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("send-welcome-email", "Invalid JSON body", 400);
  }

  // Auth-UUID aus Trigger-Payload oder direktem Aufruf extrahieren
  const authUid = payload.record?.id ?? payload.user_id;
  if (!authUid) {
    return errorResponse(
      "send-welcome-email",
      "Missing id in record or user_id",
      400
    );
  }

  // Admin-Client erstellen (bypasses RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  try {
    // Benutzer-Daten laden
    const {data: user, error: userError} = await supabaseAdmin
      .from("users")
      .select("email, display_name")
      .eq("id", authUid)
      .single();

    if (userError || !user?.email) {
      return errorResponse(
        "send-welcome-email",
        `User not found or has no email (user_id=${authUid})`,
        404
      );
    }

    const displayName = user.display_name || "Koch";

    // E-Mail rendern und senden
    const subject = "Willkommen an Bord! 🏴‍☠️";
    const helpcenterUrl = "https://help.chuchipirat.ch";
    const htmlContent = renderEmailTemplate("welcome", {
      subject,
      displayName,
      appUrl,
      helpcenterUrl,
    });
    const textContent =
      `Ahoi ${displayName},\n\n` +
      `Willkommen an Bord von chuchipirat!\n\n` +
      `Schön, dass du dabei bist! Chuchipirat hilft dir, das Kochen in Lagern und ` +
      `Gruppenaktivitäten entspannt zu planen — von der ersten Idee bis zur fertigen Einkaufsliste.\n\n` +
      `So legst du am besten los:\n` +
      `  - Anlass erstellen: Lege dein erstes Lager oder deinen ersten Anlass an und lade weitere Köch*innen ein.\n` +
      `  - Menuplan zusammenstellen: Plane Mahlzeiten und weise Rezepte zu. Die Mengen werden automatisch berechnet.\n` +
      `  - Einkaufsliste generieren: Per Knopfdruck erhältst du eine nach Abteilungen sortierte Liste.\n` +
      `  - Rezepte entdecken: Stöbere in öffentlichen Rezepten anderer Köch*innen oder erfasse deine eigenen.\n\n` +
      `Falls du Fragen hast, findest du im Helpcenter (${helpcenterUrl}) Anleitungen und Tipps.\n` +
      `Oder schreib uns an hallo@chuchipirat.ch — wir helfen gerne!\n\n` +
      `Jetzt loslegen: ${appUrl}\n\n` +
      `Viel Spass beim Planen — wind in den Segeln! 🏴‍☠️`;

    await sendEmail(emailEnv, user.email, subject, htmlContent, textContent);

    // mail_log Eintrag erstellen
    await supabaseAdmin.from("mail_log").insert({
      recipients: [user.email],
      recipient_type: "email",
      subject,
      body: htmlContent,
      template_name: "welcome",
      delivery_status: "success",
      details: {user_id: authUid, trigger: "user_insert"},
    });

    const transport = emailEnv.brevoApiKey ? "Brevo" : "SMTP";
    console.log(
      `send-welcome-email [${transport}]: E-Mail gesendet an ${user.email} (user_id=${authUid})`
    );

    return successResponse({sent: true, recipient: user.email});
  } catch (err) {
    console.error("send-welcome-email error:", err);

    // Fehler in mail_log protokollieren (best-effort)
    try {
      await supabaseAdmin.from("mail_log").insert({
        recipients: [authUid],
        recipient_type: "uid",
        subject: "Willkommen bei chuchipirat!",
        body: "",
        template_name: "welcome",
        delivery_status: "error",
        error_message: String(err),
        details: {user_id: authUid, trigger: "user_insert"},
      });
    } catch {
      // Best-effort — Fehler beim Logging ignorieren
    }

    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  }
});
