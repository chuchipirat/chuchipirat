/**
 * Aufbewahrungsfrist der Belege: Lösch- und Erinnerungsdatum sowie die
 * Empfänger der Erinnerungsmail. Reine Funktionen ohne Datenbank, damit
 * sie mit Jest testbar sind; der Job `cron-receipt-retention` liefert die
 * Zeilen.
 *
 * Alle Daten sind Strings im Format `YYYY-MM-DD`, wie Postgres eine
 * `date`-Spalte liefert. So kann keine Zeitzone einen Tag verschieben.
 */

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
