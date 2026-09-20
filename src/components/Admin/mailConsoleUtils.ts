/**
 * Hilfsfunktionen der Mail-Konsole (Validierung, Footer-Regel, Request-Body).
 *
 * Reine Funktionen ohne Seiteneffekte, damit sie ohne Rendering der grossen
 * Seite `mailConsole.tsx` testbar sind.
 */
import type {MailObject} from "./mailConsole";

/** Empfängertyp, bei dem der Abmelde-Footer immer angehängt wird. */
const RECIPIENT_TYPE_ROLE = "role";

/**
 * Fehlerstatus der Pflichtfelder.
 *
 * @param subject `true`, wenn der Betreff fehlt.
 * @param mailtext `true`, wenn der Mailtext fehlt.
 */
export type MailFormErrors = {
  subject: boolean;
  mailtext: boolean;
};

/**
 * Prüft die Pflichtfelder einer Mail. Der Titel ist bewusst kein Pflichtfeld
 * (ohne Titel beginnt die Mail direkt mit dem Text).
 *
 * @param mailObject Mail-Inhalte aus der Mail-Konsole.
 * @returns Pro Pflichtfeld `true`, wenn es fehlt.
 * @example
 * getMailFormErrors({...mail, subject: ""}) // {subject: true, mailtext: false}
 */
export const getMailFormErrors = (
  mailObject: Pick<MailObject, "subject" | "mailtext">,
): MailFormErrors => ({
  subject: !mailObject.subject,
  mailtext: !mailObject.mailtext,
});

/**
 * Erzwingt den Abmelde-Footer bei einem Versand an eine Rolle.
 *
 * Ohne Footer werden auch Personen erreicht, die den Newsletter abbestellt
 * haben. Das ist nur für einzelne Empfänger (E-Mail, UID) gedacht, nicht
 * für einen Rollen-Versand an viele.
 *
 * @param recipientType Gewählter Empfängertyp (`email`, `uid`, `role`, `none`).
 * @param includeUnsubscribe Gewünschte Einstellung der Checkbox.
 * @returns `true` bei einer Rolle, sonst die gewünschte Einstellung.
 * @example
 * normalizeIncludeUnsubscribe("role", false) // true
 * normalizeIncludeUnsubscribe("uid", false)  // false
 */
export const normalizeIncludeUnsubscribe = (
  recipientType: string,
  includeUnsubscribe: boolean,
): boolean =>
  recipientType === RECIPIENT_TYPE_ROLE ? true : includeUnsubscribe;

/** Transport-Auswahl der Mail-Konsole (nur in DEV/TEST sichtbar). */
export type MailTransport = "auto" | "brevo" | "smtp";

/**
 * Parameter für {@link buildSendMailBody}.
 *
 * @param recipients Bereinigte Empfänger.
 * @param recipientType Empfängertyp.
 * @param mailObject Mail-Inhalte.
 * @param includeUnsubscribe Wunsch aus der Checkbox (wird für Rollen erzwungen).
 * @param transport Gewählter Transport; `auto` wird nicht mitgesendet.
 */
export type BuildSendMailBodyParams = {
  recipients: string[];
  recipientType: string;
  mailObject: MailObject;
  includeUnsubscribe: boolean;
  transport: MailTransport;
};

/**
 * Baut den Request-Body für die Edge Function `send-mail`.
 *
 * @param params Siehe {@link BuildSendMailBodyParams}.
 * @returns Body für `supabase.functions.invoke("send-mail", {body})`.
 * @example
 * buildSendMailBody({recipients: ["a@b.ch"], recipientType: "email", mailObject, includeUnsubscribe: false, transport: "auto"})
 */
export const buildSendMailBody = ({
  recipients,
  recipientType,
  mailObject,
  includeUnsubscribe,
  transport,
}: BuildSendMailBodyParams) => ({
  recipients,
  recipientType,
  subject: mailObject.subject,
  body: mailObject.mailtext,
  title: mailObject.title,
  subtitle: mailObject.subtitle,
  buttonText: mailObject.buttonText,
  buttonLink: mailObject.buttonLink,
  includeUnsubscribe: normalizeIncludeUnsubscribe(
    recipientType,
    includeUnsubscribe,
  ),
  // Vorschautext nur senden, wenn befüllt
  ...(mailObject.preheader && {preheaderText: mailObject.preheader}),
  // Transport-Override nur senden, wenn nicht «Auto»
  ...(transport !== "auto" && {forceTransport: transport}),
});
