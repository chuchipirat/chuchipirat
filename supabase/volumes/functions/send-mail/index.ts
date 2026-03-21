/**
 * Edge Function: send-mail
 *
 * Generische E-Mail-Versand-Funktion für die Admin-Mail-Konsole.
 * Sendet E-Mails an die angegebenen Empfänger und protokolliert
 * den Versand in der `mail_log`-Tabelle.
 *
 * Erwartet einen POST-Body mit:
 *   {
 *     recipients: string[],     // E-Mail-Adressen
 *     recipientType: string,    // 'email', 'uid', 'role'
 *     subject: string,
 *     body: string,             // HTML-Body
 *     title?: string,
 *     subtitle?: string,
 *     buttonText?: string,
 *     buttonLink?: string,
 *   }
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY                          (Produktion)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (Fallback / lokal)
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
  escapeHtml,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";

/* =====================================================================
// Typen
// ===================================================================== */

type SendMailPayload = {
  recipients: string[];
  recipientType: string;
  subject: string;
  body: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  /** Erzwingt einen bestimmten Transport (nur Mail-Konsole, DEV/TEST). */
  forceTransport?: "brevo" | "smtp";
};

/* =====================================================================
// Handler
// ===================================================================== */

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {headers: CORS_HEADERS});
  }

  try {
    // Payload parsen
    const payload: SendMailPayload = await req.json();
    const {
      recipients,
      recipientType,
      subject,
      body,
      title,
      subtitle,
      buttonText,
      buttonLink,
      forceTransport,
    } = payload;

    // Validierung
    if (!recipients?.length) {
      return errorResponse("Keine Empfänger angegeben", 400);
    }
    if (!subject) {
      return errorResponse("Kein Betreff angegeben", 400);
    }
    if (!body) {
      return errorResponse("Kein E-Mail-Text angegeben", 400);
    }

    // E-Mail-Konfiguration laden
    const emailEnv = readEmailEnv();
    if (!isEmailConfigured(emailEnv)) {
      return errorResponse(
        "E-Mail-Versand ist nicht konfiguriert (weder Brevo noch SMTP)",
        500
      );
    }

    // Transport-Override: emailEnv manipulieren, damit sendEmail()
    // den gewünschten Kanal verwendet (Brevo > SMTP Logik bleibt gleich).
    if (forceTransport === "brevo") {
      if (!emailEnv.brevoApiKey) {
        return errorResponse(
          "Brevo erzwungen, aber BREVO_API_KEY ist nicht gesetzt",
          400
        );
      }
      // SMTP-Pfad deaktivieren
      emailEnv.smtpHost = "";
    } else if (forceTransport === "smtp") {
      if (!emailEnv.smtpHost) {
        return errorResponse(
          "SMTP erzwungen, aber SMTP_HOST ist nicht gesetzt",
          400
        );
      }
      // Brevo-Pfad deaktivieren
      emailEnv.brevoApiKey = "";
    }

    // HTML-E-Mail via shared Template zusammenbauen
    const titleText = title || subject;
    const titleBlock = `<h1 style="margin: 0 0 8px; font-size: 22px; color: #212121;">${escapeHtml(titleText)}</h1>`;
    const subtitleBlock = subtitle
      ? `<p style="margin: 0 0 16px; font-size: 14px; color: #757575;">${escapeHtml(subtitle)}</p>`
      : "";
    const buttonBlock =
      buttonText && buttonLink
        ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="${escapeHtml(buttonLink)}"
                       target="_blank"
                       style="display: inline-block; background-color: #006064; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px;">
                      ${escapeHtml(buttonText)}
                    </a>
                  </td>
                </tr>
              </table>`
        : "";

    const htmlContent = renderEmailTemplate(
      "admin-console",
      {subject},
      {body, titleBlock, subtitleBlock, buttonBlock},
    );

    // Supabase-Client für DB-Zugriff (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // UID-basierte Empfänger: E-Mail-Adressen aus auth.users laden
    let resolvedRecipients = recipients;
    if (recipientType === "uid") {
      const {data: users, error} = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw new Error(`Benutzer konnten nicht geladen werden: ${error.message}`);
      const uidSet = new Set(recipients);
      resolvedRecipients = users.users
        .filter((user) => uidSet.has(user.id) && user.email)
        .map((user) => user.email!);
    }

    // Rollen-basierte Empfänger: E-Mail-Adressen aus public.users laden
    if (recipientType === "role") {
      const roles = recipients; // Rollen als Strings
      const {data: users, error} = await supabaseAdmin
        .from("users")
        .select("email, roles")
        .not("email", "is", null);
      if (error) throw new Error(`Benutzer konnten nicht geladen werden: ${error.message}`);
      resolvedRecipients = (users ?? [])
        .filter((user: {email: string; roles: string[]}) =>
          roles.some((role: string) => user.roles?.includes(role))
        )
        .map((user: {email: string}) => user.email);
    }

    if (!resolvedRecipients.length) {
      return errorResponse("Keine gültigen E-Mail-Adressen gefunden", 400);
    }

    // E-Mails einzeln versenden (sendEmail akzeptiert einen Empfänger)
    const textContent = body.replace(/<[^>]*>/g, "");
    const transport = emailEnv.brevoApiKey ? "Brevo" : "SMTP";
    const transportInfo = forceTransport
      ? `${transport} (forced: ${forceTransport})`
      : transport;
    const errors: string[] = [];

    for (const recipient of resolvedRecipients) {
      try {
        await sendEmail(emailEnv, recipient, subject, htmlContent, textContent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${recipient}: ${msg}`);
      }
    }

    const success = errors.length === 0;

    // In mail_log protokollieren
    await supabaseAdmin.from("mail_log").insert({
      recipients: resolvedRecipients,
      recipient_type: recipientType,
      subject,
      body,
      template_name: "admin_console",
      delivery_status: success ? "success" : "error",
      error_message: success ? null : errors.join("; "),
      details: {
        resolvedCount: resolvedRecipients.length,
        originalRecipients: recipients,
        transport: transportInfo,
      },
    });

    // Immer 200 zurückgeben — auch bei Teilfehlern — damit die UI
    // differenzierte Ergebnisse anzeigen kann.
    return successResponse({
      sent: resolvedRecipients.length - errors.length,
      failed: errors,
      transport: transportInfo,
    });
  } catch (error) {
    console.error("send-mail error:", error);
    return errorResponse(
      error instanceof Error ? error.message : String(error),
      500
    );
  }
});

