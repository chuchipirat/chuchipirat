/**
 * Aufbewahrungsfrist der Belege: Lösch- und Erinnerungsdatum, fällige
 * Belege mit ihrem Storage-Pfad und die Empfänger der Erinnerungsmail.
 * Reine Funktionen ohne Datenbank, damit sie mit Jest testbar sind; der
 * Job `cron-receipt-retention` liefert die Zeilen und führt das Löschen aus.
 *
 * Alle Daten sind Strings im Format `YYYY-MM-DD`, wie Postgres eine
 * `date`-Spalte liefert. So kann keine Zeitzone einen Tag verschieben.
 */

/**
 * Ordner der Belege im Bucket `receipts`. In der DB steht `attachment_path`
 * ohne ihn. Muss zu `ExpenseStorageRepository.folderPath` passen, sonst
 * löscht der Job still nichts (Storage meldet fehlende Dateien nicht).
 */
export const RECEIPT_STORAGE_PREFIX = "events/";

/** Privater Bucket der Belege. */
export const RECEIPT_BUCKET = "receipts";

/**
 * Zeile aus `event_dates`, nur die benötigten Spalten.
 *
 * @param event_id - ID des Anlasses.
 * @param date_to - Letzter Tag dieses Abschnitts als `YYYY-MM-DD`.
 */
export type EventDateRow = {
  event_id: string;
  date_to: string;
};

/**
 * Art der zahlenden Instanz, Werte wie das Postgres-Enum
 * `expense_payee_type`. `new_person` hat keinen Account und damit keine
 * E-Mail.
 */
export type PayeeType = "existing_user" | "new_person" | "no_refund_needed";

/**
 * Zahlende Instanz einer Ausgabe mit Beleg, aus `event_expenses`.
 *
 * @param payee_type - Art der zahlenden Instanz.
 * @param payee_user_id - Account der Person; nur bei `existing_user`
 *   gesetzt.
 */
export type ReceiptExpenseRow = {
  payee_type: PayeeType;
  payee_user_id: string | null;
};

/**
 * Ausgabe mit Beleg, aus `event_expenses`, für das Löschen.
 *
 * @param id - ID der Ausgabe; ihre Belegspalten werden geleert.
 * @param event_id - ID des Anlasses, für das Anlassende.
 * @param attachment_path - Pfad wie in der DB, ohne `events/`
 *   (`<eventId>/expenses/<expenseId>.<ext>`).
 */
export type ReceiptPathRow = {
  id: string;
  event_id: string;
  attachment_path: string;
};

/**
 * Ausgabe mit Beleg, wie der Job sie lädt: Pfad für das Löschen und
 * zahlende Instanz für die Empfänger der Erinnerungsmail.
 */
/**
 * Ausgabe mit Beleg, wie der Job sie einmal lädt: Pfad für das Löschen und
 * zahlende Instanz für die Empfänger der Erinnerungsmail. Passt dank `&`
 * überall, wo `ReceiptPathRow` oder `ReceiptExpenseRow` erwartet wird.
 */
export type ReceiptRow = ReceiptPathRow & ReceiptExpenseRow;

/**
 * Datum in Zürich, unabhängig von der Zeitzone des Servers. Der Job läuft
 * nachts in UTC; um 23:30 UTC ist in Zürich schon der nächste Tag.
 *
 * @param date - Zeitpunkt, meist `new Date()`.
 * @returns Datum als `YYYY-MM-DD`.
 * @example
 * toZurichDate(new Date("2026-06-30T22:30:00Z")) // "2026-07-01"
 */
export function toZurichDate(date: Date): string {
  // Format: YYYY-MM-DD (en-CA liefert ISO-Format)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Anlassende pro Anlass: das grösste `date_to` seiner Abschnitte.
 *
 * @param eventDates - Zeilen aus `event_dates`, beliebige Reihenfolge.
 * @returns Map von Anlass-ID auf Anlassende als `YYYY-MM-DD`.
 * @example
 * getEventEndDates([
 *   {event_id: "a", date_to: "2026-07-20"},
 *   {event_id: "a", date_to: "2026-07-10"},
 * ]) // Map {"a" => "2026-07-20"}
 */
export function getEventEndDates(
  eventDates: EventDateRow[],
): Map<string, string> {
  const eventEndDates = new Map<string, string>();

  for (const row of eventDates) {
    const currentEnd = eventEndDates.get(row.event_id);
    // Stringvergleich genügt: YYYY-MM-DD sortiert wie das Datum
    if (currentEnd === undefined || row.date_to > currentEnd) {
      eventEndDates.set(row.event_id, row.date_to);
    }
  }

  return eventEndDates;
}

/**
 * Verschiebt ein Datum um Jahre und Tage.
 *
 * Rechnet in UTC, damit keine Zeitzone den Tag verschiebt. `Date.UTC`
 * rollt Überläufe selbst richtig: 29.02. plus ein Jahr wird zum 01.03.,
 * Tag −30 springt über Monats- und Jahresgrenzen zurück.
 *
 * @param isoDate - Datum als `YYYY-MM-DD`.
 * @param shift.years - Jahre dazu (negativ: zurück), Standard 0.
 * @param shift.days - Tage dazu (negativ: zurück), Standard 0.
 * @returns Verschobenes Datum als `YYYY-MM-DD`.
 * @example
 * shiftDate("2028-02-29", {years: 1}) // "2029-03-01"
 * shiftDate("2027-01-20", {days: -30}) // "2026-12-21"
 */
function shiftDate(
  isoDate: string,
  {years = 0, days = 0}: {years?: number; days?: number},
): string {
  const [year, month, day] = isoDate.split("-").map(Number);

  // Date.UTC zählt Monate ab 0, im String steht Januar als 1
  return new Date(Date.UTC(year + years, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/**
 * Tag, an dem die Belege eines Anlasses gelöscht werden: ein Kalenderjahr
 * nach Anlassende.
 *
 * @param eventEnd - Anlassende als `YYYY-MM-DD`.
 * @returns Löschdatum als `YYYY-MM-DD`; nach einem 29.02. der 01.03.
 * @example
 * getDeletionDate("2026-07-14") // "2027-07-14"
 */
export function getDeletionDate(eventEnd: string): string {
  return shiftDate(eventEnd, {years: 1});
}

/**
 * Tag der Erinnerungsmail: 30 Tage vor dem Löschdatum.
 *
 * @param eventEnd - Anlassende als `YYYY-MM-DD`.
 * @returns Erinnerungsdatum als `YYYY-MM-DD`.
 * @example
 * getReminderDate("2026-07-14") // "2027-06-14"
 */
export function getReminderDate(eventEnd: string): string {
  return shiftDate(getDeletionDate(eventEnd), {days: -30});
}

/**
 * Sind die Belege eines Anlasses fällig? Auch nach dem Löschdatum noch
 * `true`, damit ein ausgefallener Lauf beim nächsten Mal nachgeholt wird.
 *
 * Vergleicht Strings: `YYYY-MM-DD` sortiert wie das Datum.
 *
 * @param eventEnd - Anlassende als `YYYY-MM-DD`.
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`
 *   (`toZurichDate(new Date())`).
 * @returns `true` ab dem Löschdatum.
 * @example
 * isDeletionDue("2026-07-14", "2027-07-14") // true
 * isDeletionDue("2026-07-14", "2027-07-13") // false
 */
export function isDeletionDue(eventEnd: string, today: string): boolean {
  return getDeletionDate(eventEnd) <= today;
}

/**
 * Empfänger der Erinnerungsmail vor dem Löschen der Belege.
 *
 * Gehören alle Belege Personen, die noch Koch des Anlasses sind, geht die
 * Mail nur an sie. Sonst an alle aktuellen Köch*innen: bei «Keine
 * Rückerstattung» ist niemand zuständig, eine neue Person hat keine E-Mail,
 * und ehemalige Köch:innen sehen den Anlass nicht mehr.
 *
 * @param expensesWithReceipt - Ausgaben des Anlasses, die einen Beleg haben.
 * @param cookUserIds - User-IDs der aktuellen Köch:innen.
 * @returns User-IDs ohne Doppelte; leer, wenn es keinen Beleg gibt.
 * @example
 * selectReminderRecipients(
 *   [{payee_type: "no_refund_needed", payee_user_id: null}],
 *   ["cook-1", "cook-2"],
 * ) // ["cook-1", "cook-2"]
 */
export function selectReminderRecipients(
  expensesWithReceipt: ReceiptExpenseRow[],
  cookUserIds: string[],
): string[] {
  if (
    expensesWithReceipt.some(
      (expense) =>
        expense.payee_user_id === null ||
        expense.payee_type === "new_person" ||
        !cookUserIds.includes(expense.payee_user_id),
    )
  ) {
    return [...new Set(cookUserIds)];
  }

  return [
    ...new Set(
      expensesWithReceipt
        .map((expense) => expense.payee_user_id)
        .filter((userUid) => userUid !== null),
    ),
  ];
}

/**
 * Vollständiger Pfad eines Belegs im Bucket `receipts`, für `remove()`.
 *
 * @param attachmentPath - Pfad wie in der DB, ohne `events/`.
 * @returns Pfad mit `events/` davor.
 * @example
 * toStoragePath("a1/expenses/e1.pdf") // "events/a1/expenses/e1.pdf"
 */
export function toStoragePath(attachmentPath: string): string {
  return `${RECEIPT_STORAGE_PREFIX}${attachmentPath}`;
}

/**
 * Prüft, ob der Belegpfad genau zu dieser Ausgabe gehört. Köch:innen können
 * `attachment_path` direkt schreiben, der Löschjob umgeht mit der Service Role
 * aber die Storage-Regeln. Ohne Vergleich mit den IDs der eigenen Zeile könnte
 * ein manipulierter Pfad eine fremde Datei löschen.
 *
 * @param receipt - Ausgabe mit ID, Anlass und Belegpfad.
 * @returns `true` nur für `<event_id>/expenses/<id>.<endung>`.
 * @example
 * isValidReceiptPath({
 *   id: "expense-1",
 *   event_id: "event-a",
 *   attachment_path: "event-a/expenses/expense-1.pdf",
 * }) // true
 */
export function isValidReceiptPath(receipt: ReceiptPathRow): boolean {
  const expectedStart = `${receipt.event_id}/expenses/${receipt.id}.`;
  const extension = receipt.attachment_path.slice(expectedStart.length);

  return (
    receipt.attachment_path.startsWith(expectedStart) &&
    /^[a-z0-9]{1,5}$/.test(extension)
  );
}

/**
 * Belege, die heute gelöscht werden müssen, in der Reihenfolge der Eingabe.
 * Auch überfällige zählen, damit ein ausgefallener Lauf nachgeholt wird.
 *
 * Ist das Ende eines Anlasses unbekannt (keine `event_dates`), wird nie
 * gelöscht: lieber ein Beleg zu lange als einer zu früh.
 *
 * @param receipts - Ausgaben mit Beleg.
 * @param eventEndDates - Anlassende pro Anlass, aus `getEventEndDates`.
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`.
 * @returns Die fälligen Ausgaben, evtl. leer.
 * @example
 * selectDueReceipts(receipts, new Map([["a1", "2026-07-14"]]), "2027-07-14")
 * // alle Belege von Anlass a1
 */
export function selectDueReceipts(
  receipts: ReceiptPathRow[],
  eventEndDates: Map<string, string>,
  today: string,
): ReceiptPathRow[] {
  return receipts.filter((receipt) => {
    const eventEnd = eventEndDates.get(receipt.event_id);
    return eventEnd !== undefined && isDeletionDue(eventEnd, today);
  });
}

/**
 * Anlässe, deren Erinnerungsmail heute fällig ist. Anders als beim Löschen
 * nur genau am Stichtag: Nachholen hiesse, die Mail jeden Tag bis zum
 * Löschen zu schicken.
 *
 * @param eventEndDates - Anlassende pro Anlass, aus `getEventEndDates`.
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`.
 * @returns Anlass-IDs in der Reihenfolge der Map, evtl. leer.
 * @example
 * selectReminderEventIds(new Map([["a1", "2026-07-14"]]), "2027-06-14") // ["a1"]
 */
export function selectReminderEventIds(
  eventEndDates: Map<string, string>,
  today: string,
): string[] {
  const reminderEventIds: string[] = [];

  eventEndDates.forEach((eventEnd, eventId) => {
    if (getReminderDate(eventEnd) === today) {
      reminderEventIds.push(eventId);
    }
  });
  return reminderEventIds;
}

/**
 * Datum für Menschen, wie in der Schweiz üblich.
 *
 * @param isoDate - Datum als `YYYY-MM-DD`.
 * @returns Datum als `TT.MM.JJJJ`, mit führenden Nullen.
 * @example
 * formatSwissDate("2027-01-05") // "05.01.2027"
 */
export function formatSwissDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/**
 * Anzahl Belege mit passender Einzahl oder Mehrzahl.
 *
 * @param count - Anzahl Belege.
 * @returns z.B. «1 Beleg», «3 Belege», «0 Belege».
 * @example
 * formatReceiptCount(1) // "1 Beleg"
 */
export function formatReceiptCount(count: number): string {
  if (count === 1) {
    return `1 Beleg`;
  }
  return `${count} Belege`;
}

/**
 * Link auf den Tab «Abrechnung» eines Anlasses, für die Erinnerungsmail.
 * Der Tab wird über `?tab=expensetracking` geöffnet (`TAB_QUERY_PARAM_MAP`
 * in `event.tsx`). Ohne Anmeldung landet man zuerst auf dem Login.
 *
 * @param appUrl - `SITE_URL`, mit oder ohne `/` am Ende.
 * @param eventId - ID des Anlasses.
 * @returns Vollständige URL.
 * @example
 * getExpenseTrackingUrl("https://chuchipirat.ch/", "a1")
 * // "https://chuchipirat.ch/event/a1?tab=expensetracking"
 */
export function getExpenseTrackingUrl(appUrl: string, eventId: string): string {
  // SITE_URL kann mit oder ohne «/» am Ende gesetzt sein
  const baseUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;
  return `${baseUrl}/event/${eventId}?tab=expensetracking`;
}

/**
 * Betreff der Erinnerungsmail. Das Datum steht vorne, weil SMTP lange Betreffe
 * kürzt und es sonst bei langen Anlassnamen wegfällt. Zeilenumbrüche im Namen werden
 * zu Leerzeichen, weil sie im Mail-Header nichts verloren haben.
 *
 * @param eventName - Name des Anlasses.
 * @param deletionDate - Löschdatum als `YYYY-MM-DD`.
 * @returns Betreff mit Anlass und Datum im Schweizer Format.
 * @example
 * buildReminderSubject("Sommerlager", "2027-07-14")
 * // "Belege werden am 14.07.2027 gelöscht: «Sommerlager»"
 */
export function buildReminderSubject(
  eventName: string,
  deletionDate: string,
): string {
  const singleLineName = eventName.replace(/[\r\n]+/g, " ");
  return `Belege werden am ${formatSwissDate(deletionDate)} gelöscht: «${singleLineName}»`;
}

/**
 * Erste Zeile der Erinnerungsmail, für HTML und Text gleich. Ohne Namen
 * (`users.display_name` kann leer sein) steht nur die Anrede, ohne
 * Leerzeichen vor dem Komma.
 *
 * @param displayName - Anzeigename, evtl. leer.
 * @returns Anrede mit Komma.
 * @example
 * buildReminderGreeting("Anna") // "Hoi Anna,"
 * buildReminderGreeting("") // "Hoi,"
 */
export function buildReminderGreeting(displayName: string): string {
  return displayName ? `Hoi ${displayName},` : "Hoi,";
}

/**
 * Textfassung der Erinnerungsmail, für Mailprogramme ohne HTML. Sagt, was
 * wann gelöscht wird und wie man die Belege vorher sichert. Enthält keine
 * Beträge und keine Namen anderer Personen, weil die Mail an mehrere
 * Köch:innen gehen kann.
 *
 * @param params.recipientName - Name in der Anrede.
 * @param params.eventName - Name des Anlasses.
 * @param params.deletionDate - Löschdatum als `YYYY-MM-DD`.
 * @param params.receiptCount - Anzahl Belege des Anlasses.
 * @param params.url - Link zur Abrechnung, aus `getExpenseTrackingUrl`.
 * @returns Mailtext mit Zeilenumbrüchen.
 */
export function buildReminderText({
  recipientName,
  eventName,
  deletionDate,
  receiptCount,
  url,
}: {
  recipientName: string;
  eventName: string;
  deletionDate: string;
  receiptCount: number;
  url: string;
}): string {
  return [
    `${buildReminderGreeting(recipientName)}`,
    ``,
    `in der Abrechnung eures Anlasses «${eventName}» sind noch ${formatReceiptCount(receiptCount)} gespeichert. Belege bewahren wir ein Jahr nach Anlassende auf. Am ${formatSwissDate(deletionDate)} werden sie endgültig gelöscht und können danach nicht wiederhergestellt werden. Die Ausgaben selbst bleiben erhalten.`,
    ``,
    `Brauchst du die Belege noch, zum Beispiel für die Kasse oder die Revision? Dann lade sie vorher herunter. Im Tab «Abrechnung» findest du unter «Exportieren» die Abrechnung als PDF (mit allen Belegen) oder alle Belege als ZIP.`,
    ``,
    `Zur Abrechnung: ${url}`,
    ``,
    `Wenn du die Belege nicht mehr brauchst, musst du nichts tun.`,
    ``,
    `Bei Fragen: hallo@chuchipirat.ch`,
  ].join("\n");
}

/**
 * Entfernt Mailadressen aus einer Fehlermeldung. Meldungen von Brevo oder vom
 * SMTP-Server können die Adresse enthalten, und die Fehler landen in Sentry
 * und in `cron_job_log`.
 *
 * @param text - Fehlermeldung.
 * @returns Text mit «[Adresse entfernt]» anstelle jeder Adresse.
 * @example
 * removeEmailAddresses("Rejected: anna@example.ch")
 * // "Rejected: [Adresse entfernt]"
 */
export function removeEmailAddresses(text: string): string {
  return text.replace(/[^\s<>,;:"']+@[^\s<>,;:"']+/g, "[Adresse entfernt]");
}
