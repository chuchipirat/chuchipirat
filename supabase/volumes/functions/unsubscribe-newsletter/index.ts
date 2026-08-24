/**
 * Edge Function: unsubscribe-newsletter
 *
 * Meldet einen Nutzer vom Mail-Konsolen-Newsletter ab — ohne Login, über
 * einen Link im Footer der E-Mail (`GET .../unsubscribe-newsletter?uid=...`).
 *
 * Bewusst ohne Signatur/HMAC: die UID selbst dient als "Token" (122 Bit
 * Zufall, praktisch unerratbar; im schlimmsten Fall lässt sich damit nur
 * ein einzelnes Präferenz-Flag umschalten, kein Datenzugriff). Kein
 * Authentifizierungs-Check nötig — FUNCTIONS_VERIFY_JWT ist global auf
 * "false" gesetzt, Kong routet /functions/v1/* ohne eigene Auth-Plugins durch.
 *
 * Gibt in jedem Fall (gültige wie ungültige UID) dieselbe Bestätigungsseite
 * zurück — kein Informationsleck darüber, ob eine UID existiert.
 *
 * Erfordert die Umgebungsvariablen: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";

/** Grobes UUID-Format (v4 o.ä.) — reicht für die Plausibilitätsprüfung. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONFIRMATION_PAGE = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Newsletter abgemeldet</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 16px; font-size: 20px; color: #212121;">Abgemeldet</h1>
              <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6;">
                Du erhältst künftig keine Newsletter mehr von chuchipirat.
                Andere Benachrichtigungen (z.B. zu deinen eigenen Anlässen oder Rezepten) sind davon nicht betroffen.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

serve(async (req: Request) => {
  const uid = new URL(req.url).searchParams.get("uid");

  if (uid && UUID_PATTERN.test(uid)) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {persistSession: false, autoRefreshToken: false},
      });

      await supabaseAdmin
        .from("users")
        .update({newsletter_opt_out: true})
        .eq("id", uid);
    } catch (error) {
      await sentryCaptureError(error, "unsubscribe-newsletter");
    }
  }

  return new Response(CONFIRMATION_PAGE, {
    headers: {"Content-Type": "text/html; charset=utf-8"},
  });
});
