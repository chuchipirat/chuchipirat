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
 * Erfordert Authentifizierung: Nur Admins dürfen diese Funktion aufrufen.
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_PUBLIC_URL                    (von aussen erreichbare URL,
 *                                            für den Abmelde-Link — fällt
 *                                            auf SUPABASE_URL zurück, falls
 *                                            nicht gesetzt)
 *   BREVO_API_KEY                          (Produktion)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (Fallback / lokal)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendBulkEmail,
  readEmailEnv,
  isEmailConfigured,
  errorResponse,
  successResponse,
  escapeHtml,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";
import {fetchAllRows} from "../_shared/fetchAllRows.ts";
import {personalize} from "../_shared/personalize.ts";

/** Empfänger mit den Nutzer-Daten für die Personalisierung ({{firstName}} etc.). */
interface ResolvedRecipient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

/** Roh-Zeile aus public.users für die Personalisierungs-Auflösung. */
interface UserPersonalizationRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  newsletter_opt_out: boolean;
}

const toResolvedRecipient = (user: UserPersonalizationRow): ResolvedRecipient => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name ?? "",
  lastName: user.last_name ?? "",
  displayName: user.display_name ?? "",
});

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
  /** Vorschautext für die Posteingang-Vorschau (unsichtbar im Mail-Body). */
  preheaderText?: string;
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
    // ── Authentifizierung & Autorisierung ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("send-mail", "Missing Authorization header", 401, true);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // SUPABASE_URL (http://kong:8000) ist nur intern (Docker-Netzwerk)
    // erreichbar — für Links in E-Mails (z.B. Abmelde-Link) muss die von
    // aussen erreichbare SUPABASE_PUBLIC_URL verwendet werden.
    const publicSupabaseUrl = Deno.env.get("SUPABASE_PUBLIC_URL") ?? supabaseUrl;

    // Benutzer aus JWT verifizieren
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {headers: {Authorization: authHeader}},
      auth: {persistSession: false, autoRefreshToken: false},
    });
    const {data: {user}, error: userError} = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse("send-mail", "Unauthorized", 401, true);
    }

    // Admin-Rolle prüfen
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {persistSession: false, autoRefreshToken: false},
    });
    const {data: profile} = await supabaseAdmin
      .from("users")
      .select("roles")
      .eq("id", user.id)
      .single();

    if (!profile?.roles?.includes("admin")) {
      return errorResponse("send-mail", "Forbidden: admin role required", 403, true);
    }

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
      preheaderText,
      forceTransport,
    } = payload;

    // Validierung
    if (!recipients?.length) {
      return errorResponse("send-mail", "Keine Empfänger angegeben", 400, true);
    }
    if (!subject) {
      return errorResponse("send-mail", "Kein Betreff angegeben", 400, true);
    }
    if (!body) {
      return errorResponse("send-mail", "Kein E-Mail-Text angegeben", 400, true);
    }

    // E-Mail-Konfiguration laden
    const emailEnv = readEmailEnv();
    if (!isEmailConfigured(emailEnv)) {
      return errorResponse(
        "send-mail",
        "E-Mail-Versand ist nicht konfiguriert (weder Brevo noch SMTP)",
        500,
        true
      );
    }

    // Transport-Override: emailEnv manipulieren, damit sendEmail()
    // den gewünschten Kanal verwendet (Brevo > SMTP Logik bleibt gleich).
    if (forceTransport === "brevo") {
      if (!emailEnv.brevoApiKey) {
        return errorResponse(
          "send-mail",
          "Brevo erzwungen, aber BREVO_API_KEY ist nicht gesetzt",
          400,
          true
        );
      }
      // SMTP-Pfad deaktivieren
      emailEnv.smtpHost = "";
    } else if (forceTransport === "smtp") {
      if (!emailEnv.smtpHost) {
        return errorResponse(
          "send-mail",
          "SMTP erzwungen, aber SMTP_HOST ist nicht gesetzt",
          400,
          true
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

    // Abmelde-Hinweis für den Footer — {{unsubscribeLink}} wird erst beim
    // Personalisieren pro Empfänger ersetzt (siehe bulkRecipients unten),
    // da der Link die individuelle UID enthält. Nur bei admin-console
    // gesetzt — andere Mail-Typen (welcome, request-* etc.) bekommen keinen
    // Abmelde-Block, siehe templateRenderer.ts.
    const unsubscribeBlock = `<p style="margin: 16px 0 0; font-size: 12px; color: #9e9e9e; line-height: 1.5;">
                Du möchtest keine Newsletter mehr erhalten?
                <a href="{{unsubscribeLink}}" style="color: #9e9e9e;">Hier abmelden</a>.
              </p>`;

    const htmlContent = renderEmailTemplate(
      "admin-console",
      {subject, ...(preheaderText ? {preheaderText} : {})},
      {body, titleBlock, subtitleBlock, buttonBlock, unsubscribeBlock},
    );

    // UID-basierte Empfänger: E-Mail-Adressen + Namen aus public.users laden
    // (nicht via auth.admin.listUsers() — das ist auf 50 Einträge pro Seite
    // paginiert und würde UIDs ausserhalb der ersten Seite stillschweigend
    // verwerfen. public.users.email wird per Trigger mit auth.users
    // synchron gehalten, siehe sync_auth_email()/handle_new_user().) Über
    // fetchAllRows paginiert für Konsistenz mit dem Rollen-Pfad unten, auch
    // wenn ein Admin praktisch nie >1000 UIDs von Hand einträgt.
    // Newsletter-Abmeldungen (newsletter_opt_out) werden bei allen drei
    // Empfänger-Pfaden konsequent herausgefiltert.
    let resolvedRecipients: ResolvedRecipient[] = recipients.map((email) => ({
      id: "", email, firstName: "", lastName: "", displayName: "",
    }));
    if (recipientType === "uid") {
      const users = await fetchAllRows<UserPersonalizationRow>(
        supabaseAdmin, "users", "id, email, first_name, last_name, display_name, newsletter_opt_out",
        (query) => query.in("id", recipients).not("email", "is", null),
      );
      resolvedRecipients = users
        .filter((user) => !user.newsletter_opt_out)
        .map(toResolvedRecipient);
    }

    // Rollen-basierte Empfänger: E-Mail-Adressen + Namen aus public.users laden
    // (paginiert - .select() ohne Range liefert bei Supabase/PostgREST
    // standardmässig max. 1000 Zeilen und würde bei mehr Benutzern welche
    // stillschweigend vom Versand ausschliessen)
    if (recipientType === "role") {
      const roles = recipients; // Rollen als Strings
      const users = await fetchAllRows<UserPersonalizationRow & {roles: string[]}>(
        supabaseAdmin, "users", "id, email, first_name, last_name, display_name, newsletter_opt_out, roles",
        (query) => query.not("email", "is", null),
      );
      resolvedRecipients = users
        .filter((user) => roles.some((role: string) => user.roles?.includes(role)))
        .filter((user) => !user.newsletter_opt_out)
        .map(toResolvedRecipient);
    }

    // E-Mail-basierte Empfänger (frei eingetragene Adressen): Namen aus
    // public.users nachschlagen, wo vorhanden — Adressen ohne Treffer (z.B.
    // extern eingetragene) bekommen leere Namen, Tokens werden dann leer.
    if (recipientType === "email") {
      const users = await fetchAllRows<UserPersonalizationRow>(
        supabaseAdmin, "users", "id, email, first_name, last_name, display_name, newsletter_opt_out",
        (query) => query.in("email", recipients),
      );
      // Abgemeldete registrierte Adressen explizit ausschliessen — sie
      // dürften sonst über den "unbekannte Adresse"-Fallback unten trotzdem
      // wieder reinrutschen (kein Treffer in userByEmail != nicht abgemeldet).
      const optedOutEmails = new Set(
        users.filter((user) => user.newsletter_opt_out).map((user) => user.email),
      );
      const userByEmail = new Map(
        users
          .filter((user) => !user.newsletter_opt_out)
          .map((user) => [user.email, toResolvedRecipient(user)]),
      );
      resolvedRecipients = recipients
        .filter((email) => !optedOutEmails.has(email))
        .map((email) =>
          userByEmail.get(email) ?? {id: "", email, firstName: "", lastName: "", displayName: ""},
        );
    }

    if (!resolvedRecipients.length) {
      return errorResponse("send-mail", "Keine gültigen E-Mail-Adressen gefunden", 400, true);
    }

    // E-Mails im Batch versenden (sendBulkEmail nutzt bei Brevo
    // messageVersions statt eines Calls pro Empfänger, siehe emailService.ts).
    // Jeder Empfänger bekommt seinen eigenen, personalisierten Inhalt
    // ({{firstName}}/{{lastName}}/{{displayName}} ersetzt, siehe personalize.ts).
    const transport = emailEnv.brevoApiKey ? "Brevo" : "SMTP";
    const transportInfo = forceTransport
      ? `${transport} (forced: ${forceTransport})`
      : transport;

    const bulkRecipients = resolvedRecipients.map((recipient) => {
      const personalizationVariables = {
        ...recipient,
        unsubscribeLink: `${publicSupabaseUrl}/functions/v1/unsubscribe-newsletter?uid=${recipient.id}`,
      };
      const personalizedSubject = personalize(subject, personalizationVariables);
      const personalizedHtml = personalize(htmlContent, personalizationVariables);
      // Klartext-Fallback bewusst aus dem rohen Mailtext ableiten, NICHT aus
      // personalizedHtml: Der volle Seiten-Render enthält Header/Footer und
      // den versteckten Preheader-Block — display:none existiert im
      // Plain-Text-Teil nicht, das würde also sichtbar VOR dem eigentlichen
      // Text auftauchen (inkl. unkodierter Entities wie &zwnj;&nbsp;, da die
      // Tag-Strip-Regex nur Tags entfernt, keine Entities dekodiert).
      const personalizedBody = personalize(body, personalizationVariables);
      return {
        email: recipient.email,
        subject: personalizedSubject,
        htmlContent: personalizedHtml,
        textContent: personalizedBody.replace(/<[^>]*>/g, ""),
      };
    });

    const {failed} = await sendBulkEmail(emailEnv, bulkRecipients);
    const errors = failed.flatMap((failure) =>
      failure.emails.map((email) => `${email}: ${failure.error}`),
    );

    const success = errors.length === 0;

    // In mail_log protokollieren (nur E-Mail-Adressen, keine Namen — Format
    // wird von MailLogRepository/overviewMailbox.tsx als string[] erwartet)
    await supabaseAdmin.from("mail_log").insert({
      recipients: resolvedRecipients.map((recipient) => recipient.email),
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
    await sentryCaptureError(error, "send-mail");
    return errorResponse(
      "send-mail",
      error instanceof Error ? error.message : String(error),
      500,
      true,
    );
  }
});

