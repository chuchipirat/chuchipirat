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
import {chunkArray} from "./chunkArray.ts";
import {escapeHtml} from "./escapeHtml.ts";

export {escapeHtml};

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

/** Maximale Anzahl Empfänger pro Brevo-`messageVersions`-Call (Batch-Versand). */
const BREVO_BATCH_SIZE = 500;

/**
 * Ergebnis eines Massenversands via `sendBulkEmail()`.
 *
 * @param sent - Erfolgreich versendete Empfänger-Adressen.
 * @param failed - Fehlgeschlagene Batches: betroffene Adressen + Fehlermeldung.
 */
export interface BulkSendResult {
  sent: string[];
  failed: {emails: string[]; error: string}[];
}

/**
 * Ein Empfänger für `sendBulkEmail()`, mit bereits (falls gewünscht)
 * individuell personalisiertem Inhalt — z.B. via `personalize()` aus
 * `personalize.ts`, damit z.B. "Hallo {{displayName}}" pro Empfänger
 * ersetzt wird, obwohl der Versand gebündelt läuft.
 *
 * @param email - Empfänger-E-Mail-Adresse
 * @param subject - Betreff (bereits personalisiert)
 * @param htmlContent - HTML-Inhalt (bereits personalisiert)
 * @param textContent - Klartext-Fallback (bereits personalisiert)
 */
export interface BulkEmailRecipient {
  email: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}

/**
 * Sendet an viele Empfänger, ohne pro Empfänger einen eigenen API-Call zu
 * machen (relevant z.B. für die Mail-Konsole bei ~1800 Empfängern). Jeder
 * Empfänger bringt seinen eigenen (ggf. personalisierten) Inhalt mit — bei
 * Brevo als individueller `messageVersions[i]`-Override auf ein gemeinsames
 * Top-Level-Fallback-Feld, nicht über Brevos eigene `{{ params.x }}`-
 * Templating-Syntax (bewusst vermieden — wir kontrollieren die Ersetzung
 * so vollständig selbst und testbar, statt uns bei einem irreversiblen
 * Versand an echte Nutzer auf ungetestete Drittanbieter-Syntax zu
 * verlassen). Ein einzelner API-Call transportiert mehrere hundert
 * individuelle Empfänger (jeder sieht nur seine eigene Adresse), Brevo
 * übernimmt intern das Pacing gegenüber den empfangenden Mailservern —
 * kein eigenes Batching mit Wartezeiten nötig. MailPit-Redirect und reiner
 * SMTP-Fallback (kein Brevo konfiguriert) bleiben sequenziell über
 * `sendEmail()`, da das nur Dev-/Fallback-Pfade ohne Volumen-Problem sind.
 *
 * @param env - E-Mail-Umgebungsvariablen
 * @param recipients - Empfänger mit individuellem Inhalt
 * @returns Erfolgreich versendete Adressen sowie fehlgeschlagene Batches mit Fehlermeldung
 */
export async function sendBulkEmail(
  env: EmailEnv,
  recipients: BulkEmailRecipient[],
): Promise<BulkSendResult> {
  const subjectPrefix = Deno.env.get("EMAIL_SUBJECT_PREFIX") ?? "";
  const redirectToMailpit = await shouldRedirectToMailpit();

  const sent: string[] = [];
  const failed: {emails: string[]; error: string}[] = [];

  // MailPit-Redirect oder reiner SMTP-Fallback: sequenziell wie bisher
  // (Dev-/Fallback-Pfad, kein Volumen-Problem).
  if (redirectToMailpit || !env.brevoApiKey) {
    for (const recipient of recipients) {
      try {
        await sendEmail(env, recipient.email, recipient.subject, recipient.htmlContent, recipient.textContent);
        sent.push(recipient.email);
      } catch (err) {
        failed.push({
          emails: [recipient.email],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return {sent, failed};
  }

  // Brevo: Batch-Versand über messageVersions statt 1 Call pro Empfänger.
  // Jede Version überschreibt subject/htmlContent/textContent individuell —
  // die Top-Level-Felder (von Brevo als Pflichtfelder verlangt) werden nur
  // als Fallback mit dem ersten Empfänger des Chunks befüllt.
  for (const chunk of chunkArray(recipients, BREVO_BATCH_SIZE)) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.brevoApiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sender: {name: SENDER_NAME, email: SENDER_EMAIL},
          subject: subjectPrefix + chunk[0].subject,
          htmlContent: chunk[0].htmlContent,
          textContent: chunk[0].textContent,
          messageVersions: chunk.map((recipient) => ({
            to: [{email: recipient.email}],
            subject: subjectPrefix + recipient.subject,
            htmlContent: recipient.htmlContent,
            textContent: recipient.textContent,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(`Brevo API Fehler ${response.status}: ${await response.text()}`);
      }
      sent.push(...chunk.map((recipient) => recipient.email));
    } catch (err) {
      failed.push({
        emails: chunk.map((recipient) => recipient.email),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {sent, failed};
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
 * Gibt eine standardisierte JSON-Fehlerantwort zurück und loggt den Fehler.
 *
 * Interne Fehlerdetails werden immer serverseitig geloggt (console.error + Sentry).
 * Für den Client gilt standardmässig eine generische Fehlermeldung ohne interne
 * Details (z.B. bei öffentlich erreichbaren Functions wie create-donation oder
 * payment-webhook). Bei bereits auth-/rollengeprüften Admin-Functions (z.B.
 * send-mail) kann `exposeMessage` gesetzt werden, damit die Admin-UI den
 * tatsächlichen Grund anzeigen kann (z.B. "SMTP nicht konfiguriert") statt nur
 * "non-2xx status code".
 *
 * @param functionName - Name der Edge Function (für Log-Prefix)
 * @param message - Interne Fehlermeldung (für Logs; an den Client nur bei exposeMessage=true)
 * @param statusCode - HTTP-Statuscode
 * @param exposeMessage - Wenn true, wird `message` unverändert an den Client zurückgegeben (nur für bereits autorisierte Aufrufer verwenden)
 * @returns HTTP-Response mit JSON-Fehlermeldung
 */
export function errorResponse(
  functionName: string,
  message: string,
  statusCode: number,
  exposeMessage = false,
): Response {
  console.error(`${functionName}: ${message}`);
  return new Response(
    JSON.stringify({
      error: exposeMessage ? message : "Ein interner Fehler ist aufgetreten.",
    }),
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
