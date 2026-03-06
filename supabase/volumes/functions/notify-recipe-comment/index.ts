/**
 * Edge Function: notify-recipe-comment
 *
 * Sendet eine E-Mail-Benachrichtigung an den Rezeptautor, wenn ein neuer
 * Kommentar zu einem öffentlichen Rezept hinterlassen wurde.
 * Keine Benachrichtigung, wenn der Kommentator der Autor selbst ist.
 *
 * E-Mail-Versand:
 *   1. Primär: Brevo Transactional Email API (wenn BREVO_API_KEY gesetzt)
 *   2. Fallback: SMTP (für lokale Entwicklung mit MailPit)
 *
 * Erwartet einen POST-Body mit:
 *   { commentId: string, recipeId: string }
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY                          (Produktion)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_ADMIN_EMAIL, SMTP_SENDER_NAME
 *                                          (Fallback / lokale Entwicklung)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {SMTPClient} from "https://deno.land/x/denomailer@1.6.0/mod.ts";

/* =====================================================================
// Konstanten
// ===================================================================== */
/** CORS-Header für alle Antworten */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

/** URL des chuchipirat-Logos für E-Mail-Header */
const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/mailTemplates%2FMail%20Header%20weiss.png?alt=media&token=61c6aa52-d611-4921-ad8c-3c9ecb26f85d";

/** Absender-Adresse für alle ausgehenden Benachrichtigungen */
const SENDER_EMAIL = "hallo@chuchipirat.ch";
const SENDER_NAME = "chuchipirat";

/* =====================================================================
// Typen
// ===================================================================== */
/**
 * Payload-Struktur des POST-Bodys.
 *
 * @param commentId - UUID des neuen Kommentars in recipe_comments
 * @param recipeId  - UUID des kommentierten Rezepts in recipes
 */
interface NotifyPayload {
  commentId: string;
  recipeId: string;
}

/* =====================================================================
// HTML-E-Mail-Template
// ===================================================================== */
/**
 * Baut den HTML-Body der Benachrichtigungs-E-Mail.
 *
 * @param recipeName        - Name des kommentierten Rezepts
 * @param commenterName     - Anzeigename des Kommentators
 * @param commentText       - Text des Kommentars (wird auf 500 Zeichen gekürzt)
 * @param authorDisplayName - Anzeigename des Rezeptautors (Anrede)
 * @returns Vollständiger HTML-String für den E-Mail-Body
 */
function buildEmailHtml(
  recipeName: string,
  commenterName: string,
  commentText: string,
  authorDisplayName: string,
): string {
  // Kommentartext auf 500 Zeichen kürzen, damit die E-Mail nicht zu lang wird
  const preview =
    commentText.length > 500 ? commentText.slice(0, 497) + "…" : commentText;

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Neuer Kommentar zu deinem Rezept</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #006064; padding: 24px 40px; text-align: center;">
              <img src="${LOGO_URL}"
                   alt="chuchipirat"
                   width="220"
                   style="display: block; margin: 0 auto; max-width: 220px; height: auto;" />
            </td>
          </tr>

          <!-- Inhalt -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo ${escapeHtml(authorDisplayName)},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                <strong>${escapeHtml(commenterName)}</strong> hat dein Rezept
                <strong>«${escapeHtml(recipeName)}»</strong> kommentiert:
              </p>

              <!-- Kommentar-Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(preview)}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; color: #757575; line-height: 1.5;">
                Melde dich auf chuchipirat.ch an, um den Kommentar zu lesen und zu antworten.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 32px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 13px; color: #9e9e9e; line-height: 1.5; text-align: center;">
                Bei Fragen erreichst du uns unter
                <a href="mailto:hallo@chuchipirat.ch"
                   style="color: #006064; text-decoration: none;">hallo@chuchipirat.ch</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */
/**
 * Maskiert HTML-Sonderzeichen, um XSS in E-Mail-Templates zu verhindern.
 *
 * @param text - Der zu maskierende Text
 * @returns Maskierter Text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Gibt eine JSON-Fehlerantwort zurück und loggt den Fehler.
 *
 * @param message    - Fehlermeldung
 * @param statusCode - HTTP-Statuscode
 * @returns Fehlerantwort
 */
function errorResponse(message: string, statusCode: number): Response {
  console.error(`notify-recipe-comment: ${message}`);
  return new Response(JSON.stringify({error: message}), {
    status: statusCode,
    headers: {...CORS_HEADERS, "Content-Type": "application/json"},
  });
}

/* =====================================================================
// E-Mail-Versand: Brevo Transactional API
// ===================================================================== */
/**
 * Sendet eine E-Mail über die Brevo Transactional Email API.
 * Brevo-Dokumentation: https://developers.brevo.com/reference/sendtransacemail
 *
 * @param to          - Empfänger-E-Mail-Adresse
 * @param subject     - Betreff
 * @param htmlContent - HTML-Inhalt
 * @param textContent - Klartext-Fallback
 * @param brevoApiKey - Brevo API-Schlüssel
 * @throws Fehler wenn die API einen Fehler-Statuscode zurückgibt
 */
async function sendViaBrevo(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  brevoApiKey: string,
): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {name: SENDER_NAME, email: SENDER_EMAIL},
      to: [{email: to}],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo API Fehler ${response.status}: ${body}`);
  }
}

/* =====================================================================
// E-Mail-Versand: SMTP (Fallback für lokale Entwicklung)
// ===================================================================== */
/**
 * Sendet eine E-Mail über SMTP (Fallback, z.B. MailPit in der lokalen Entwicklung).
 *
 * @param to          - Empfänger-E-Mail-Adresse
 * @param subject     - Betreff
 * @param htmlContent - HTML-Inhalt
 * @param textContent - Klartext-Fallback
 * @param smtpHost    - SMTP-Hostname
 * @param smtpPort    - SMTP-Port
 * @param smtpUser    - SMTP-Benutzername (leer = keine Authentifizierung)
 * @param smtpPass    - SMTP-Passwort
 * @param fromEmail   - Absender-E-Mail-Adresse
 */
async function sendViaSmtp(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPass: string,
  fromEmail: string,
): Promise<void> {
  const smtpClient = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      // TLS nur bei Standard-TLS-Port 465; 587/25 verwenden kein TLS (kein STARTTLS)
      tls: smtpPort === 465,
      ...(smtpUser ? {auth: {username: smtpUser, password: smtpPass}} : {}),
    },
  });

  await smtpClient.send({
    from: `${SENDER_NAME} <${fromEmail}>`,
    to,
    subject,
    html: htmlContent,
    content: textContent,
  });

  await smtpClient.close();
}

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Umgebungsvariablen lesen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
  const smtpHost = Deno.env.get("SMTP_HOST") ?? "";
  const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
  const smtpUser = Deno.env.get("SMTP_USER") ?? "";
  const smtpPass = Deno.env.get("SMTP_PASS") ?? "";
  const smtpFrom = Deno.env.get("SMTP_ADMIN_EMAIL") ?? SENDER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Server configuration error: missing Supabase config", 500);
  }

  // Entweder Brevo oder SMTP muss konfiguriert sein
  if (!brevoApiKey && !smtpHost) {
    return errorResponse(
      "Server configuration error: neither BREVO_API_KEY nor SMTP_HOST is set",
      500,
    );
  }

  // Payload aus dem Request-Body lesen
  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const {commentId, recipeId} = payload;
  if (!commentId || !recipeId) {
    return errorResponse("Missing commentId or recipeId", 400);
  }

  // Admin-Client erstellen (bypasses RLS für DB-Abfragen)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  try {
    // Kommentar laden (Text + Ersteller-UUID)
    const {data: comment, error: commentError} = await supabaseAdmin
      .from("recipe_comments")
      .select("comment, created_by")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return errorResponse(`Comment ${commentId} not found`, 404);
    }

    // Rezept laden (Name + Ersteller-UUID)
    const {data: recipe, error: recipeError} = await supabaseAdmin
      .from("recipes")
      .select("name, created_by")
      .eq("id", recipeId)
      .single();

    if (recipeError || !recipe) {
      return errorResponse(`Recipe ${recipeId} not found`, 404);
    }

    // Keine Benachrichtigung wenn Kommentator === Rezeptautor (Self-Comment)
    if (
      comment.created_by &&
      recipe.created_by &&
      comment.created_by === recipe.created_by
    ) {
      console.log(
        `notify-recipe-comment: Kommentator ist Rezeptautor — keine Benachrichtigung`,
      );
      return new Response(
        JSON.stringify({skipped: true, reason: "self-comment"}),
        {status: 200, headers: {...CORS_HEADERS, "Content-Type": "application/json"}},
      );
    }

    // Rezeptautor aus public.users laden (E-Mail + Anzeigename)
    // recipe.created_by ist eine UUID (= auth.users.id = public.users.auth_uid)
    const {data: author, error: authorError} = await supabaseAdmin
      .from("users")
      .select("email, display_name")
      .eq("auth_uid", recipe.created_by)
      .single();

    if (authorError || !author?.email) {
      return errorResponse(
        `Recipe author not found or has no email (recipe_id=${recipeId})`,
        404,
      );
    }

    // Anzeigenamen des Kommentators laden (best-effort — leerer String ist OK)
    const {data: commenter} = await supabaseAdmin
      .from("users")
      .select("display_name")
      .eq("auth_uid", comment.created_by)
      .maybeSingle();

    const commenterName = commenter?.display_name || "Jemand";
    const authorDisplayName = author.display_name || "Koch";

    // E-Mail-Inhalte aufbauen
    const subject = `Neuer Kommentar zu deinem Rezept «${recipe.name}»`;
    const htmlContent = buildEmailHtml(
      recipe.name,
      commenterName,
      comment.comment,
      authorDisplayName,
    );
    const textContent =
      `Hallo ${authorDisplayName},\n\n` +
      `${commenterName} hat dein Rezept «${recipe.name}» kommentiert:\n\n` +
      `${comment.comment}\n\n` +
      `Melde dich auf chuchipirat.ch an, um zu antworten.\n\n` +
      `Bei Fragen: hallo@chuchipirat.ch`;

    // E-Mail senden: Brevo (Primär) oder SMTP (Fallback)
    if (brevoApiKey) {
      await sendViaBrevo(author.email, subject, htmlContent, textContent, brevoApiKey);
      console.log(
        `notify-recipe-comment [Brevo]: E-Mail gesendet an ${author.email} ` +
        `(Rezept: ${recipeId}, Kommentar: ${commentId})`,
      );
    } else {
      await sendViaSmtp(
        author.email,
        subject,
        htmlContent,
        textContent,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
      );
      console.log(
        `notify-recipe-comment [SMTP]: E-Mail gesendet an ${author.email} ` +
        `(Rezept: ${recipeId}, Kommentar: ${commentId})`,
      );
    }

    return new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  } catch (err) {
    console.error("notify-recipe-comment error:", err);
    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  }
});
