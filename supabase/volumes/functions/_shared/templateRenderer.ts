/**
 * Template-Renderer für E-Mail-Benachrichtigungen.
 *
 * Lädt HTML-Body-Templates, ersetzt `{{variable}}`-Platzhalter und
 * umschliesst den Inhalt mit dem gemeinsamen Header/Footer-Layout.
 * Alle Variablen-Werte werden automatisch HTML-escaped.
 *
 * @example
 * import { renderEmailTemplate } from "../_shared/templateRenderer.ts";
 * const html = renderEmailTemplate("recipe-comment", { recipeName: "Pasta", commenterName: "Max" });
 */
import {escapeHtml, LOGO_URL} from "./emailService.ts";

/* =====================================================================
// Template-Dateien (als Strings eingebettet)
// ===================================================================== */
// Deno Edge Functions können keine Dateien vom Dateisystem lesen,
// daher sind die Templates als String-Konstanten eingebettet.

/** Gemeinsamer HTML-Header mit Teal-Banner und Logo. */
const HEADER = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{subject}}</title>
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
            <td style="padding: 32px 40px 24px;">`;

/** Gemeinsamer HTML-Footer mit Kontaktadresse. */
const FOOTER = `            </td>
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

/* =====================================================================
// Body-Templates
// ===================================================================== */

/** Registry aller bekannten Body-Templates (Key = Template-Name). */
const BODY_TEMPLATES: Record<string, string> = {
  /* ── Rezept-Kommentar ──────────────────────────────────────────── */
  "recipe-comment": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{authorDisplayName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                <strong>{{commenterName}}</strong> hat dein Rezept
                <strong>«{{recipeName}}»</strong> kommentiert:
              </p>

              <!-- Kommentar-Block -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">{{commentText}}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 14px; color: #757575; line-height: 1.5;">
                Melde dich auf chuchipirat.ch an, um den Kommentar zu lesen und zu antworten.
              </p>`,

  /* ── Neuer Antrag (Rezept veröffentlichen / Fehler melden) ──── */
  "request-new": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{recipientName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                <strong>{{requestAuthor}}</strong> hat einen neuen Antrag erstellt:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0 0 8px; font-size: 15px; color: #424242; line-height: 1.6;">
                      <strong>Antrag #{{requestNumber}}</strong>: {{requestTypeName}}
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6;">
                      Rezept: <strong>«{{recipeName}}»</strong>
                    </p>
                  </td>
                </tr>
              </table>
              {{commentBlock}}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="{{requestUrl}}"
                       target="_blank"
                       style="display: inline-block; background-color: #006064; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px;">
                      Antrag &ouml;ffnen
                    </a>
                  </td>
                </tr>
              </table>`,

  /* ── Neuer Kommentar zu einem Antrag ─────────────────────────── */
  "request-comment": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{recipientName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                <strong>{{commenterName}}</strong> hat einen Kommentar zu Antrag
                <strong>#{{requestNumber}}</strong> hinterlassen:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">{{commentText}}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="{{requestUrl}}"
                       target="_blank"
                       style="display: inline-block; background-color: #006064; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px;">
                      Antrag &ouml;ffnen
                    </a>
                  </td>
                </tr>
              </table>`,

  /* ── Antrag erneut zur Prüfung eingereicht ───────────────────── */
  "request-back-to-review": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{recipientName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                <strong>{{authorName}}</strong> hat den Antrag
                <strong>#{{requestNumber}}</strong> ({{requestTypeName}}) erneut zur Prüfung eingereicht.
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Rezept: <strong>{{recipeName}}</strong>
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0;">
                    <a href="{{requestUrl}}"
                       target="_blank"
                       style="display: inline-block; background-color: #006064; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px;">
                      Antrag &ouml;ffnen
                    </a>
                  </td>
                </tr>
              </table>`,

  /* ── Antrag abgelehnt ────────────────────────────────────────── */
  "request-declined": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{authorDisplayName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Dein Antrag <strong>#{{requestNumber}}</strong> ({{requestTypeName}}) zum Rezept
                <strong>«{{recipeName}}»</strong> wurde abgelehnt.
              </p>
              {{reasonBlock}}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding: 8px 0 0;">
                    <a href="{{requestUrl}}"
                       target="_blank"
                       style="display: inline-block; background-color: #006064; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: 0.3px;">
                      Antrag &ouml;ffnen
                    </a>
                  </td>
                </tr>
              </table>`,

  /* ── Rezept wurde veröffentlicht ─────────────────────────────── */
  "request-published": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{authorDisplayName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Dein Rezept <strong>«{{recipeName}}»</strong> wurde veröffentlicht! 🎉
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Ab sofort steht es allen Köch*innen zur Verfügung.
              </p>
              {{commentBlock}}
              <p style="margin: 24px 0 0; font-size: 14px; color: #757575; line-height: 1.5;">
                Vielen Dank für deinen Beitrag!
              </p>`,

  /* ── Admin-Konsole (generischer Newsletter) ─────────────────── */
  "admin-console": `{{titleBlock}}
              {{subtitleBlock}}
              <div style="font-size: 15px; color: #212121; line-height: 1.6;">{{body}}</div>
              {{buttonBlock}}`,

  /* ── Fehlermeldung wurde bearbeitet ──────────────────────────── */
  "request-error-fixed": `<p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Hallo {{authorDisplayName}},
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Die Fehlermeldung <strong>#{{requestNumber}}</strong> zum Rezept
                <strong>«{{recipeName}}»</strong> wurde bearbeitet.
              </p>
              {{commentBlock}}
              <p style="margin: 0 0 16px; font-size: 16px; color: #212121; line-height: 1.5;">
                Vielen Dank für deine Meldung — sie hilft uns, chuchipirat besser zu machen!
              </p>
              <p style="margin: 24px 0 0; font-size: 14px; color: #757575; line-height: 1.5;">
                Melde dich auf chuchipirat.ch an, um das Rezept anzusehen.
              </p>`,
};

/* =====================================================================
// Rendering
// ===================================================================== */

/**
 * Rendert ein E-Mail-Template mit Variablen-Ersetzung und Header/Footer.
 *
 * Alle Variablen-Werte werden automatisch HTML-escaped, um XSS zu verhindern.
 * Variablen in `rawVariables` werden **nicht** escaped — für vorbereitete
 * HTML-Blöcke (z.B. bedingte Abschnitte, die bereits escaped wurden).
 * Der `subject`-Wert wird zusätzlich im HTML-`<title>` verwendet.
 *
 * @param templateName - Name des Body-Templates (z.B. "recipe-comment")
 * @param variables - Key-Value-Map der Platzhalter (z.B. { recipeName: "Pasta" })
 * @param rawVariables - Key-Value-Map der rohen (nicht-escaped) Platzhalter
 * @returns Vollständiger HTML-String mit Header, Body und Footer
 * @throws Error wenn das Template nicht gefunden wird
 *
 * @example
 * const html = renderEmailTemplate("recipe-comment", {
 *   subject: "Neuer Kommentar",
 *   recipeName: "Pasta Carbonara",
 *   commenterName: "Max Muster",
 *   commentText: "Super Rezept!",
 *   authorDisplayName: "Anna Koch",
 * });
 */
export function renderEmailTemplate(
  templateName: string,
  variables: Record<string, string>,
  rawVariables: Record<string, string> = {},
): string {
  const bodyTemplate = BODY_TEMPLATES[templateName];
  if (!bodyTemplate) {
    throw new Error(`E-Mail-Template "${templateName}" nicht gefunden`);
  }

  // Alle Variablen HTML-escapen
  const safeVars: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    safeVars[key] = escapeHtml(value);
  }

  // Rohe Variablen unverändert übernehmen (bereits escaped)
  for (const [key, value] of Object.entries(rawVariables)) {
    safeVars[key] = value;
  }

  // Header, Body und Footer zusammenbauen und Platzhalter ersetzen
  const fullTemplate = HEADER + bodyTemplate + FOOTER;
  const rendered = fullTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return safeVars[key] ?? match;
  });

  // Trailing Whitespace pro Zeile entfernen, damit SMTP Quoted-Printable
  // keine `=20`-Artefakte erzeugt (z.B. wenn ein optionaler Block leer ist)
  return rendered.replace(/[ \t]+$/gm, "");
}

/**
 * Gibt die Liste aller registrierten Template-Namen zurück.
 *
 * @returns Array mit Template-Namen
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(BODY_TEMPLATES);
}
