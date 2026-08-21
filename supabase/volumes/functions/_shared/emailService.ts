/**
 * Gemeinsamer E-Mail-Service für alle Edge Functions.
 *
 * Stellt Hilfsfunktionen für den E-Mail-Versand bereit:
 * - Brevo Transactional API (Produktion)
 * - SMTP / MailPit (lokale Entwicklung)
 * - XSS-Schutz und Standard-Fehlerantworten
 *
 * @example
 * import { sendEmail, escapeHtml, errorResponse, CORS_HEADERS } from "../_shared/emailService.ts";
 * await sendEmail(env, "user@example.com", "Betreff", htmlContent, textContent);
 */
import {quotedPrintableEncode, SMTPClient} from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";

/* =====================================================================
// MailPit-Redirect Cache
// ===================================================================== */

/** Gecachter Wert für redirect_emails_to_mailpit (60s TTL). */
let mailpitRedirectCache: {value: boolean; expiresAt: number} | null = null;

/**
 * Prüft ob E-Mails an MailPit umgeleitet werden sollen.
 * Liest den Wert aus global_settings und cached ihn 60 Sekunden.
 *
 * @returns true wenn E-Mails an MailPit umgeleitet werden sollen
 */
async function shouldRedirectToMailpit(): Promise<boolean> {
  // Cache prüfen
  if (mailpitRedirectCache && Date.now() < mailpitRedirectCache.expiresAt) {
    return mailpitRedirectCache.value;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) return false;

  try {
    const client = createClient(supabaseUrl, serviceRoleKey);
    const {data} = await client
      .from("global_settings")
      .select("redirect_emails_to_mailpit")
      .eq("id", "default")
      .single();

    const redirect = data?.redirect_emails_to_mailpit === true;
    mailpitRedirectCache = {value: redirect, expiresAt: Date.now() + 60_000};
    return redirect;
  } catch {
    return false;
  }
}

/* =====================================================================
// Konstanten
// ===================================================================== */

/** Erlaubter Origin für CORS (aus SITE_URL oder Fallback auf Produktion). */
const ALLOWED_ORIGIN =
  Deno.env.get("SITE_URL") || "https://chuchipirat.ch";

/** CORS-Header für alle Antworten. */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

/** URL des chuchipirat-Logos für E-Mail-Header. */
export const LOGO_URL = "https://chuchipirat.ch/images/email/mail-header-white.png";

/** Absender-Adresse für alle ausgehenden Benachrichtigungen. */
export const SENDER_EMAIL = "hallo@chuchipirat.ch";

/** Absender-Name für alle ausgehenden Benachrichtigungen. */
export const SENDER_NAME = "chuchipirat";

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Umgebungsvariablen für den E-Mail-Versand.
 *
 * @param brevoApiKey - Brevo API-Schlüssel (leer = SMTP-Fallback)
 * @param smtpHost - SMTP-Hostname
 * @param smtpPort - SMTP-Port
 * @param smtpUser - SMTP-Benutzername
 * @param smtpPass - SMTP-Passwort
 * @param smtpFrom - Absender-E-Mail-Adresse
 */
export interface EmailEnv {
  brevoApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

/**
 * Liest die E-Mail-Umgebungsvariablen aus Deno.env.
 *
 * @returns Umgebungsvariablen-Objekt für den E-Mail-Versand
 */
export function readEmailEnv(): EmailEnv {
  return {
    brevoApiKey: Deno.env.get("BREVO_API_KEY") ?? "",
    smtpHost: Deno.env.get("SMTP_HOST") ?? "",
    smtpPort: parseInt(Deno.env.get("SMTP_PORT") ?? "587"),
    smtpUser: Deno.env.get("SMTP_USER") ?? "",
    smtpPass: Deno.env.get("SMTP_PASS") ?? "",
    smtpFrom: Deno.env.get("SMTP_ADMIN_EMAIL") ?? SENDER_EMAIL,
  };
}

/**
 * Prüft, ob mindestens ein E-Mail-Kanal konfiguriert ist.
 *
 * @param env - E-Mail-Umgebungsvariablen
 * @returns true, falls Brevo oder SMTP konfiguriert ist
 */
export function isEmailConfigured(env: EmailEnv): boolean {
  return !!(env.brevoApiKey || env.smtpHost);
}

/* =====================================================================
// E-Mail-Versand
// ===================================================================== */

/**
 * Sendet eine E-Mail via Brevo (primär) oder SMTP (Fallback).
 *
 * @param env - E-Mail-Umgebungsvariablen
 * @param to - Empfänger-E-Mail-Adresse
 * @param subject - Betreff
 * @param htmlContent - HTML-Inhalt
 * @param textContent - Klartext-Fallback
 * @throws Error wenn weder Brevo noch SMTP konfiguriert ist oder der Versand fehlschlägt
 */
export async function sendEmail(
  env: EmailEnv,
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
): Promise<void> {
  // Optionaler Betreff-Prefix (z.B. "[TEST] " für Nicht-Produktions-Umgebungen)
  const subjectPrefix = Deno.env.get("EMAIL_SUBJECT_PREFIX") ?? "";
  const finalSubject = subjectPrefix + subject;

  // Prüfen ob E-Mails an MailPit umgeleitet werden sollen
  const redirectToMailpit = await shouldRedirectToMailpit();

  if (redirectToMailpit) {
    const mailpitHost = Deno.env.get("MAILPIT_HOST") ?? "supabase-mail";
    const mailpitPort = parseInt(Deno.env.get("MAILPIT_PORT") ?? "1025");
    console.info(`[MailPit-Redirect] E-Mail an ${to} wird an MailPit umgeleitet (${mailpitHost}:${mailpitPort})`);
    await sendViaSmtp(to, finalSubject, htmlContent, textContent, mailpitHost, mailpitPort, "", "", env.smtpFrom);
    return;
  }

  if (env.brevoApiKey) {
    await sendViaBrevo(to, finalSubject, htmlContent, textContent, env.brevoApiKey);
  } else if (env.smtpHost) {
    await sendViaSmtp(
      to,
      finalSubject,
      htmlContent,
      textContent,
      env.smtpHost,
      env.smtpPort,
      env.smtpUser,
      env.smtpPass,
      env.smtpFrom,
    );
  } else {
    throw new Error("Neither BREVO_API_KEY nor SMTP_HOST is configured");
  }
}

/**
 * Sendet eine E-Mail über die Brevo Transactional Email API.
 *
 * @param to - Empfänger-E-Mail-Adresse
 * @param subject - Betreff
 * @param htmlContent - HTML-Inhalt
 * @param textContent - Klartext-Fallback
 * @param brevoApiKey - Brevo API-Schlüssel
 * @throws Error wenn die API einen Fehler-Statuscode zurückgibt
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

/**
 * Sendet eine E-Mail über SMTP (Fallback, z.B. MailPit in der lokalen Entwicklung).
 *
 * @param to - Empfänger-E-Mail-Adresse
 * @param subject - Betreff
 * @param htmlContent - HTML-Inhalt
 * @param textContent - Klartext-Fallback
 * @param smtpHost - SMTP-Hostname
 * @param smtpPort - SMTP-Port
 * @param smtpUser - SMTP-Benutzername (leer = keine Authentifizierung)
 * @param smtpPass - SMTP-Passwort
 * @param fromEmail - Absender-E-Mail-Adresse
 */
/**
 * Berechnet die Quoted-Printable-kodierte Länge eines Strings, wie sie
 * denomailer für die Betreffzeile erzeugen würde (RFC 2047 Encoded-Word).
 *
 * @param text Zu prüfender Text.
 * @returns Kodierte Länge in Zeichen.
 */
function quotedPrintableLength(text: string): number {
  const byteEncoder = new TextEncoder();
  let length = 0;
  for (const char of text) {
    const bytes = byteEncoder.encode(char);
    if (bytes.length === 1) {
      const code = bytes[0];
      const isSafeAscii = code >= 32 && code <= 126 && code !== 61;
      if (isSafeAscii || code === 9 || code === 10 || code === 13) {
        length += 1;
        continue;
      }
    }
    length += bytes.length * 3;
  }
  return length;
}

/**
 * Kürzt eine Betreffzeile so, dass ihre Quoted-Printable-Kodierung (RFC 2047,
 * von denomailer für nicht-ASCII-Betreffs via `=?utf-8?Q?...?=` verwendet)
 * niemals das Limit für ein einzelnes Encoded-Word überschreitet.
 *
 * denomailer fügt bei längeren Betreffen fehlerhafte `=\r\n`-Zeilenumbrüche
 * MITTEN in dieses eine Encoded-Word ein (Body-Zeilenumbruch-Logik,
 * fälschlich auch für Header verwendet — die Bibliothek foldet nicht in
 * mehrere gültige Encoded-Words auf). Strikte SMTP-Server (z.B. MailPit)
 * lehnen den dadurch ungültigen Header komplett ab (451 4.3.5). Betrifft nur
 * den SMTP-Versandweg (denomailer) — Brevos HTTP-API kennt dieses Problem
 * nicht, da dort kein RFC-2047-Header-Encoding stattfindet.
 *
 * @param subject Ursprüngliche Betreffzeile.
 * @param maxEncodedLength Sicherer Grenzwert unter dem 74-Zeichen-Limit von denomailer.
 * @returns Betreffzeile, bei Bedarf mit "…" gekürzt.
 * @example
 * safeSmtpSubject("Dein Rezept «Nüdeli mit Chäs» wurde veröffentlicht")
 * // "Dein Rezept «Nüdeli mit Chäs» wurde verö…" (gekürzt, falls nötig)
 */
export function safeSmtpSubject(subject: string, maxEncodedLength = 70): string {
  if (quotedPrintableLength(subject) <= maxEncodedLength) return subject;

  let truncated = subject;
  while (
    truncated.length > 0 &&
    quotedPrintableLength(`${truncated}…`) > maxEncodedLength
  ) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * Führt SMTP-"Dot-Stuffing" durch (RFC 5321 §4.5.2): verdoppelt einen
 * führenden "." auf jeder Content-Zeile, da eine Zeile, die nur aus "."
 * besteht, laut SMTP-Protokoll das Ende der DATA-Übertragung markiert.
 * Jeder korrekte SMTP-Empfänger entfernt umgekehrt einen einzelnen
 * führenden Punkt wieder ("Transparency").
 *
 * denomailer führt dieses Dot-Stuffing selbst NICHT durch: Der interne
 * Quoted-Printable-Zeilenumbruch (alle 74 Zeichen) kann zufällig genau vor
 * einem "." in normalem Text landen (z.B. in "line-height: 1.6") und so eine
 * neue Zeile erzeugen, die mit "." beginnt. Ohne Stuffing entfernt der
 * SMTP-Empfänger dieses eine Zeichen beim Empfang wieder – der Inhalt wird
 * dadurch je nach Position des Umbruchs (abhängig von der Länge davor
 * eingefügter Variablen wie z.B. des Empfängernamens) still korrumpiert.
 *
 * @param quotedPrintableContent Bereits quoted-printable-kodierter Inhalt.
 * @returns Inhalt mit dot-stuffing, sicher für den SMTP-DATA-Befehl.
 */
function dotStuffLines(quotedPrintableContent: string): string {
  return quotedPrintableContent
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

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
  // Port 465 = implizites TLS, Port 1025 = MailPit (plain, kein TLS)
  const useTls = smtpPort === 465;
  const isPlainSmtp = !useTls && !smtpUser;

  const smtpClient = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: useTls,
      ...(smtpUser ? {auth: {username: smtpUser, password: smtpPass}} : {}),
    },
    // MailPit (lokale Entwicklung) akzeptiert kein TLS/STARTTLS
    debug: isPlainSmtp
      ? {allowUnsecure: true, noStartTLS: true}
      : undefined,
  });

  // Body-Encoding selbst übernehmen (statt html/content an denomailer zu
  // übergeben), damit das fehlende Dot-Stuffing von denomailer korrigiert
  // werden kann, bevor der Inhalt auf die Leitung geht (siehe dotStuffLines).
  await smtpClient.send({
    from: `${SENDER_NAME} <${fromEmail}>`,
    to,
    subject: safeSmtpSubject(subject),
    mimeContent: [
      {
        mimeType: 'text/plain; charset="utf-8"',
        content: dotStuffLines(quotedPrintableEncode(textContent)),
        transferEncoding: "quoted-printable",
      },
      {
        mimeType: 'text/html; charset="utf-8"',
        content: dotStuffLines(quotedPrintableEncode(htmlContent)),
        transferEncoding: "quoted-printable",
      },
    ],
  });

  await smtpClient.close();
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
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Gibt eine standardisierte JSON-Fehlerantwort zurück und loggt den Fehler.
 *
 * Interne Fehlerdetails werden nur serverseitig geloggt (console.error + Sentry).
 * Der Client erhält eine generische Fehlermeldung ohne interne Details.
 *
 * @param functionName - Name der Edge Function (für Log-Prefix)
 * @param message - Interne Fehlermeldung (nur für Logs, wird NICHT an den Client zurückgegeben)
 * @param statusCode - HTTP-Statuscode
 * @returns HTTP-Response mit generischer JSON-Fehlermeldung
 */
export function errorResponse(
  functionName: string,
  message: string,
  statusCode: number,
): Response {
  console.error(`${functionName}: ${message}`);
  return new Response(
    JSON.stringify({error: "Ein interner Fehler ist aufgetreten."}),
    {
      status: statusCode,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    },
  );
}

/**
 * Gibt eine standardisierte JSON-Erfolgsantwort zurück.
 *
 * @param data - Optionale Daten, die in der Antwort zurückgegeben werden
 * @returns HTTP-Response mit JSON-Erfolgsmeldung
 */
export function successResponse(data: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({success: true, ...data}), {
    status: 200,
    headers: {...CORS_HEADERS, "Content-Type": "application/json"},
  });
}
