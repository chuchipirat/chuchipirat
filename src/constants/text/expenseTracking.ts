/**
 * UI-Textkonstanten für das Abrechnungsmodul.
 */

import {formatAmountFromCents} from "../../components/Shared/utils/currencyUtils";

/* =====================================================================
// Abrechnungsseite
// ===================================================================== */
export const EXPENSE_TRACKING = "Abrechnung";
export const EXPENSE_TRACKING_NOT_ACTIVE =
  "Abrechnung – nur eine Spende entfernt";
export const EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION =
  "Mit der Abrechnung sammelt eure Küchencrew alle Ausgaben des Anlasses " +
  "und erstellt daraus automatisch eine fixfertige Abrechnung – ganz ohne Excel. " +
  "Dieser Bereich steht dir zur Verfügung, sobald du für diesen Anlass gespendet hast. " +
  "Mit deiner Spende unterstützt du den Betrieb und die laufenden " +
  "Kosten von chuchipirat. Mehr zur Funktion findest du im";
/**
 * Link-Beschriftung für das Helpcenter, das an
 * {@link EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION} angehängt wird.
 */
export const EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK =
  "Helpcenter";

export const BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT = (
  amountInCents: number | null,
  currency: string,
) => {
  if (!amountInCents) {
    return `${currency} - / Person & Tag`;
  }
  return `${formatAmountFromCents(amountInCents, currency)} / Person & Tag`;
};

export const EDIT_BUDGET = "Budget bearbeiten";
export const BUDGET_TYPE_FIXED_AMOUNT = "Fixbetrag";
export const BUDGET_TYPE_PER_PERSON_PER_DAY = "Pro Person & Tag";
/**
 * Chip-Label fuer ein "pro Person & Tag"-Budget.
 *
 * @param rateInCents - Ansatz pro Person und Tag, in Rappen. `null`, wenn noch nicht festgelegt.
 * @param currency - ISO-4217-Waehrungscode.
 * @returns z.B. "CHF 8.50 / Person & Tag" oder Hinweistext, falls kein Ansatz gesetzt ist.
 */
export const BUDGET_PER_PERSON_PER_DAY = (
  rateInCents: number | null,
  currency: string,
): string =>
  rateInCents != null
    ? `${formatAmountFromCents(rateInCents, currency)} / Person & Tag`
    : "Budget noch nicht festgelegt";

/**
 * Anzeige des Soll-Betrags eines Fixbetrag-Budgets.
 *
 * @param amountInCents - Budgetbetrag in Rappen.
 * @param currency - ISO-4217-Waehrungscode.
 * @returns z.B. "Budget: CHF 2'000.00".
 */
export const BUDGET_TARGET_AMOUNT = (
  amountInCents: number,
  currency: string,
): string => `Budget: ${formatAmountFromCents(amountInCents, currency)}`;

/** Hinweistext, wenn fuer ein Fixbetrag-Budget noch kein Betrag hinterlegt ist. */
export const BUDGET_TARGET_AMOUNT_MISSING = "Kein Betrag festgelegt";
export const NEW_BUDGET = "Neues Budget";
export const BUDGET = "Budget";
export const EXPENSE_TRACKING_OVERVIEW = "Übersicht";
export const EXPENSE_TRACKING_EXPENSES = "Ausgaben";
export const EXPENSE_TRACKING_EVALUATION = "Auswertung";
export const BUDGET_NAME = "Name";
export const PLEASE_PROVIDE_NAME = "Bitte einen Namen angeben.";
export const PLEASE_PROVIDE_AMOUNT = "Bitte einen gültigen Betrag angeben.";
export const CURRENCY = "Währung";
export const BUDGET_ICON = "Icon";
export const PLEASE_PROVIDE_ICON = "Bitte ein Icon auswählen.";
export const BUDGET_TYPE = "Typ";
export const PROVIDE_BUDGET_TYPE = "Bitte Budget-Typ wählen.";
export const BUDGET_SAVED = "Budget wurde gespeichert.";
export const BUDGET_UPDATED = "Budget wurde angepasst.";
export const BUDGET_DELETED = "Budget wurde gelöscht.";
export const BUDGET_ICON_INVALID = "Das gewählte Icon ist nicht gültig.";
export const DELETE_BUDGET_DIALOG = (budgetName: string): string =>
  `Budget «${budgetName}» löschen?`;
export const DELETE_BUDGET_SIMPLE =
  "Diese Aktion kann nicht rückgängig gemacht werden.";
export const BUDGET_CANT_BE_DELETED = "Budget kann nicht gelöscht werden.";
export const BUDGET_HAS_EXPENSES =
  "Dieses Budget hat noch Ausgaben und kann nicht gelöscht werden.";
export const SPENT_AMOUNT = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency);

export const OF_LIMIT = (amountInCents: number, currency: string): string =>
  `von ${formatAmountFromCents(amountInCents, currency)}`;
export const PLEASE_CREATE_BUDGET_FIRST = "Lege zuerst ein Budget an.";
// Ausgaben
export const EXPENSE = "Ausgabe";
export const PLEASE_PROVIDE_LABEL = "Bitte eine Bezeichnung angeben.";
export const EXPENSE_AMOUNT_TOO_LARGE = "Bitte kleineren Ausgabebetrag wählen.";
export const PLEASE_PROVIDE_BUDGET = "Bitte ein Budget wählen.";
export const PLEASE_PROVIDE_DATE = "Bitte Ausgabedatum angeben.";
export const PLEASE_PROVIDE_CURRENCY = "Bitte Währung wählen.";

export const NO_EXPENSES_YET = "Noch keine Ausgaben.";
export const NEW_EXPENSE = "Neue Ausgabe";
export const LABEL = "Bezeichnung";
export const PLACEHOLDER_LABEL = "z.B. Grosseinkauf Migros";
export const OPTIONAL = "optional";
export const EXPENSE_SAVED = "Ausgabe wurde gespeichert.";
export const EXPENSE_UPDATED = "Ausgabe wurde angepasst.";
export const EXPENSE_DELETED = "Ausgabe wurde gelöscht.";
export const PAYEE = "Wer hat bezahlt?";
export const PAYEE_EXISTING_USER = "Bestehende Person";
export const PLEASE_PROVIDE_PAYEE = "Bitte eine Person wählen.";
export const PAYEE_NEW_PERSON = "Neue Person erfassen";
export const PLEASE_PROVIDE_PAYEE_NAME = "Bitte einen Namen angeben.";
export const PAYEE_NO_REFUND_NEEDED = "Keine Rückerstattung nötig";
export const FORMER_EVENT_COOK = "Ehemalige Person";
export const DELETE_EXPENSE_DIALOG = (
  label: string,
  amountInCents: number,
  currency: string,
): string =>
  `Ausgabe «${label}» (${formatAmountFromCents(amountInCents, currency)}) löschen?`;

export const OPEN_AMOUNTS_PER_PERSON = "Ausgegebene Beträge pro Person";
export const SHOW_EXPENSES = "Ausgaben anzeigen";
export const BELEG = "Beleg";
export const DELETE_BELEG = "Beleg löschen";
export const DROP_ATTACHMENT_HINT = "PDF oder Bild hierher ziehen";
export const ATTACHMENT_RETENTION_HINT =
  "Wird 1 Jahr nach Anlassende automatisch gelöscht";
export const EXPENSE_RECEIPT = "Beleg";
export const REMOVE_EXPENSE_RECEIPT = "Beleg löschen";
export const ATTACHMENT_INVALID_TYPE = "Nur PDF oder Bild (JPEG/PNG) erlaubt.";
export const ATTACHMENT_TOO_LARGE = "Datei ist zu gross (max. 10 MB).";
export const SHOW_EXPENSE_RECEIPT = "Beleg anzeigen";
export const EXPENSE_RECEIPT_MISSING = "Beleg fehlt";
export const UNDO_REMOVE_EXPENSE_RECEIPT = "Rückgängig";

export const PROJECTION_TILL_EVENT_END = "Hochrechnung bis Anlassende:";
export const DAY_X_OF_Y_IN_EVENT = (
  elapsedDays: number,
  totalDays: number,
): string => `Stand Anlasstag ${elapsedDays} von ${totalDays}`;
export const PROJECTION_ABOVE_BUDGET = "Voraussichtlich über Budget";

/** Hinweis in der Auswertung, solange es noch keine Ausgaben gibt. */
export const NO_EXPENSES_FOR_STATS =
  "Sobald ihr Ausgaben erfasst, siehst du hier die Auswertung.";

export const EVALUATION_TOTAL = "Gesamtausgaben";
/**
 * Anzahl Ausgaben unter dem Gesamttotal, mit Einzahl/Mehrzahl.
 *
 * @param expenseCount - Anzahl Ausgaben in der gewählten Währung.
 * @returns z.B. «1 Ausgabe» oder «14 Ausgaben».
 */
export const EVALUATION_EXPENSE_COUNT = (expenseCount: number): string =>
  `${expenseCount} ${expenseCount === 1 ? "Ausgabe" : "Ausgaben"}`;
export const EVALUATION_AVERAGE_PER_PARTICIPANT = "Ø pro Person";
/** Hinweis statt Ø, wenn die Gruppenkonfiguration keine Teilnehmenden hat. */
export const EVALUATION_PARTICIPANTS_MISSING =
  "Erfasse die Teilnehmenden in der Gruppenkonfiguration.";
/**
 * Zweite Zeile der Ø-Kachel: bisher verbraucht pro Person und Tag, gemessen
 * an allen Anlasstagen («bisher», damit es nicht als Tagesdurchschnitt gelesen wird).
 *
 * @param averagePerParticipantAndDayInCents - Betrag pro Person und Tag in Rappen.
 * @param currency - ISO-4217-Währungscode.
 * @returns z.B. «bisher CHF 13.93 pro Person & Tag».
 */
export const EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR = (
  averagePerParticipantAndDayInCents: number,
  currency: string,
): string =>
  `bisher ${formatAmountFromCents(averagePerParticipantAndDayInCents, currency)} pro Person & Tag`;
/**
 * Rechengrundlage der Ø-Kachel, damit sichtbar ist, womit gerechnet wurde.
 *
 * @param participantCount - Anzahl Teilnehmende.
 * @param eventDayCount - Anzahl Anlasstage; bei 0 entfällt dieser Teil.
 * @returns z.B. «24 Personen · 7 Anlasstage».
 */
export const EVALUATION_CALCULATION_BASIS = (
  participantCount: number,
  eventDayCount: number,
): string =>
  `${participantCount} ${participantCount === 1 ? "Person" : "Personen"}${eventDayCount > 0 ? ` · ${eventDayCount} ${eventDayCount === 1 ? "Anlasstag" : "Anlasstage"}` : ""}`;
/**
 * Warnhinweis zu fehlenden Belegen (über alle Budgets und Währungen), mit Einzahl/Mehrzahl.
 *
 * @param receiptCount - Anzahl Ausgaben ohne Beleg.
 * @returns z.B. «1 Ausgabe ohne Beleg» oder «3 Ausgaben ohne Beleg».
 */
export const EVALUATION_WITHOUT_RECEIPT_COUNT = (
  receiptCount: number,
): string =>
  `${receiptCount} ${receiptCount === 1 ? "Ausgabe" : "Ausgaben"} ohne Beleg`;
export const EVALUATION_TOP_EXPENSES = "Grösste Ausgaben";
export const EVALUATION_KEYFIGURES = "Kennzahlen";
/** Screenreader-Beschriftung der Währungs-Chips in der Auswertung. */
export const EVALUATION_CURRENCY_FILTER_ARIA_LABEL = "Währungsfilter";

/**
 * Verbindet Einträge zu einer lesbaren Aufzählung mit «und» vor dem letzten.
 *
 * @param items - Einträge, mindestens einer.
 * @returns z.B. «EUR», «EUR und USD» oder «Küche, Material und Lagerbau».
 */
const joinWithAnd = (items: string[]): string =>
  items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
/** Beschriftung des Budget-Filters, wenn alle Budgets berücksichtigt sind (auch Menüeintrag zum Zurücksetzen). */
export const EVALUATION_BUDGET_FILTER_ALL = "Alle Budgets";
/**
 * Beschriftung des Budget-Filters bei einer Teilauswahl (mehr als ein Budget).
 *
 * @param selectedCount - Anzahl berücksichtigter Budgets.
 * @param totalCount - Anzahl aller Budgets des Anlasses.
 * @returns z.B. «2 von 4 Budgets».
 */
export const EVALUATION_BUDGET_FILTER_PARTIAL = (
  selectedCount: number,
  totalCount: number,
): string => `${selectedCount} von ${totalCount} Budgets`;
/**
 * Screenreader-Beschriftung des Budget-Filter-Buttons. Enthält die aktuelle
 * Auswahl, weil `aria-label` die sichtbare Beschriftung ersetzt und diese
 * sonst nicht vorgelesen würde.
 *
 * @param selectionLabel - Sichtbare Beschriftung (`getBudgetFilterLabel`).
 * @returns z.B. «Budgets für die Auswertung auswählen, aktuell: 2 von 4 Budgets».
 */
export const EVALUATION_BUDGET_FILTER_ARIA_LABEL = (
  selectionLabel: string,
): string => `Budgets für die Auswertung auswählen, aktuell: ${selectionLabel}`;
/**
 * Hinweis unter den Filtern: Welche Währungen in den Kennzahlen nicht
 * enthalten sind (keine Umrechnung, nie über Währungen summiert).
 *
 * @param currencies - Nicht gewählte Währungscodes, mindestens einer.
 * @returns z.B. «Ausgaben in EUR und USD sind hier nicht enthalten.»
 */
export const EVALUATION_SCOPE_NOTE_CURRENCIES = (
  currencies: string[],
): string =>
  `Ausgaben in ${joinWithAnd(currencies)} sind hier nicht enthalten.`;
/**
 * Hinweis unter den Filtern: Welche Budgets abgewählt sind.
 *
 * @param budgetNames - Namen der abgewählten Budgets, mindestens einer.
 * @returns z.B. «Nicht berücksichtigte Budgets: Material und Lagerbau.»
 */
export const EVALUATION_SCOPE_NOTE_BUDGETS = (budgetNames: string[]): string =>
  `Nicht berücksichtigte Budgets: ${joinWithAnd(budgetNames)}.`;
/** Ersetzt die Kacheln, wenn die gewählten Budgets keine Ausgaben haben (B6). */
export const EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS =
  "Keine Ausgabe in der Budgetauswahl.";
/** Chip über der Ausgabenliste, solange der Filter «ohne Beleg» aktiv ist. */
export const ONLY_WITHOUT_RECEIPT = "Nur ohne Beleg";
/** Leere Ausgabenliste bei aktivem Filter «ohne Beleg»: Arbeit erledigt. */
export const ALL_EXPENSES_HAVE_A_RECEIPT = "Alle Ausgaben haben einen Beleg.";

/** Titel der Diagramm-Karte in der Auswertung (Story 6.3). */
export const EVALUATION_HISTORY_TITLE = "Ausgabenverlauf";
/** Legende und Tooltip: kumulierte Ausgaben bis heute. */
export const EVALUATION_HISTORY_ACTUAL = "Ist";
/** Legende und Tooltip: linear verteilter Sollbetrag der ausgewählten Budgets. */
export const EVALUATION_HISTORY_TARGET = "Soll";
/**
 * Textzeile unter dem Ausgabenverlauf mit dem aktuellen Stand. Ersetzt für
 * Screenreader das Diagramm und ist auf dem Handy schneller gelesen.
 *
 * @param day - Letzter Anlasstag mit Ist-Wert (heute bzw. letzter Anlasstag), 1-basiert.
 * @param dayCount - Anzahl Anlasstage.
 * @param currency - Währung der Beträge (ISO-4217-Code).
 * @param actual - Kumulierte Ausgaben bis zu diesem Tag in Rappen.
 * @param target - Soll bis zu diesem Tag in Rappen; `null` ohne Sollbetrag,
 *   dann entfällt der zweite Teil. Am letzten Anlasstag (und danach) als
 *   «Soll gesamt», weil «bis heute» nach Anlassende nicht mehr stimmt.
 * @returns z.B. «Stand Anlasstag 3 von 7: CHF 1’350.00 ausgegeben, Soll bis heute CHF 1’028.57.»
 * @example
 * EVALUATION_HISTORY_SUMMARY(3, 7, "CHF", 135000, 102857)
 * // «Stand Anlasstag 3 von 7: CHF 1’350.00 ausgegeben, Soll bis heute CHF 1’028.57.»
 * EVALUATION_HISTORY_SUMMARY(4, 4, "CHF", 20300, 69100)
 * // «Stand Anlasstag 4 von 4: CHF 203.00 ausgegeben, Soll gesamt CHF 691.00.»
 * EVALUATION_HISTORY_SUMMARY(3, 7, "CHF", 135000, null)
 * // «Stand Anlasstag 3 von 7: CHF 1’350.00 ausgegeben.»
 */
export const EVALUATION_HISTORY_SUMMARY = (
  day: number,
  dayCount: number,
  currency: string,
  actual: number,
  target: number | null,
): string => {
  // Template-Literals einzeilig: ein Zeilenumbruch darin landet samt Einzug im Text
  const targetLabel = day < dayCount ? "Soll bis heute" : "Soll gesamt";
  const targetPart =
    target === null
      ? ""
      : `, ${targetLabel} ${formatAmountFromCents(target, currency)}`;
  return `Stand Anlasstag ${day} von ${dayCount}: ${formatAmountFromCents(actual, currency)} ausgegeben${targetPart}.`;
};
/** Ersetzt das Diagramm, solange heute vor dem ersten Anlasstag liegt. */
export const EVALUATION_HISTORY_NOT_STARTED =
  "Der Verlauf beginnt am ersten Anlasstag.";
/** Ersetzt das Diagramm, solange der Anlass keine Daten (Zeitscheiben) hat. */
export const EVALUATION_HISTORY_NO_EVENT_DAYS =
  "Lege zuerst die Daten des Anlasses fest, dann erscheint hier der Verlauf.";

/** Titel der Donut-Karte in der Auswertung (Story 6.4). */
export const EVALUATION_SHARE_TITLE = "Verteilung nach Budget";
/**
 * Bezeichnung des zusammengefassten Stücks, wenn mehr Budgets Ausgaben haben,
 * als der Donut Stücke zeigt.
 *
 * @param count - Anzahl zusammengefasster Budgets (immer mindestens 2).
 * @returns z.B. «Übrige (3 Budgets)».
 * @example
 * EVALUATION_SHARE_OTHERS(3) // «Übrige (3 Budgets)»
 */
export const EVALUATION_SHARE_OTHERS = (count: number): string =>
  `Übrige (${count} Budgets)`;
/**
 * Anteil eines Stücks in ganzen Prozent. Ein auf 0 gerundeter Anteil steht
 * als «< 1 %», weil das Budget ja Ausgaben hat.
 *
 * @param percent - Anteil in ganzen Prozent (`BudgetShare.sharePercent`).
 * @returns z.B. «78 %», bei 0 «< 1 %».
 * @example
 * EVALUATION_SHARE_PERCENT(78) // «78 %»
 * EVALUATION_SHARE_PERCENT(0)  // «< 1 %»
 */
export const EVALUATION_SHARE_PERCENT = (percent: number): string =>
  percent === 0 ? "< 1 %" : `${percent} %`;
/**
 * Zweite Zeile eines Legendeneintrags und Tooltip-Wert: Betrag und Anteil.
 *
 * @param amountInCents - Betrag des Stücks in Rappen.
 * @param currency - Währung (ISO-4217-Code).
 * @param percent - Anteil in ganzen Prozent.
 * @returns z.B. «CHF 203.00 · 78 %».
 * @example
 * EVALUATION_SHARE_DETAIL(20300, "CHF", 78) // «CHF 203.00 · 78 %»
 */
export const EVALUATION_SHARE_DETAIL = (
  amountInCents: number,
  currency: string,
  percent: number,
): string =>
  `${formatAmountFromCents(amountInCents, currency)} · ${EVALUATION_SHARE_PERCENT(percent)}`;

/** Titel der Kachel «Ø pro Mahlzeit» in der Auswertung (Story 6.5). */
export const EVALUATION_AVERAGE_PER_MEAL = "Ø pro Mahlzeit";
/**
 * Zweite Zeile der Kachel «Ø pro Mahlzeit»: bisher verbraucht pro Person und
 * Mahlzeit, gemessen an allen eingeplanten Mahlzeiten («bisher», wie bei
 * «pro Person & Tag»).
 *
 * @param averagePerParticipantAndMealInCents - Betrag pro Person und Mahlzeit in Rappen.
 * @param currency - ISO-4217-Währungscode.
 * @returns z.B. «bisher CHF 1.26 pro Person & Mahlzeit».
 * @example
 * EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR(126, "CHF") // «bisher CHF 1.26 pro Person & Mahlzeit»
 */
export const EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR = (
  averagePerParticipantAndMealInCents: number,
  currency: string,
): string =>
  `bisher ${formatAmountFromCents(averagePerParticipantAndMealInCents, currency)} pro Person & Mahlzeit`;
/**
 * Rechengrundlage der Kachel «Ø pro Mahlzeit», damit sichtbar ist, womit
 * gerechnet wurde. Ohne Teilnehmende nur die Mahlzeiten.
 *
 * @param mealCount - Anzahl eingeplanter Mahlzeiten.
 * @param participantCount - Anzahl Teilnehmende.
 * @returns z.B. «12 Mahlzeiten · 20 Personen», «1 Mahlzeit · 1 Person» oder «12 Mahlzeiten».
 * @example
 * EVALUATION_MEAL_BASIS(12, 20) // «12 Mahlzeiten · 20 Personen»
 * EVALUATION_MEAL_BASIS(12, 0)  // «12 Mahlzeiten»
 */
export const EVALUATION_MEAL_BASIS = (
  mealCount: number,
  participantCount: number,
): string => {
  const mealPart = `${mealCount} ${mealCount === 1 ? "Mahlzeit" : "Mahlzeiten"}`;
  const participantPart = `${participantCount} ${participantCount === 1 ? "Person" : "Personen"}`;
  return participantCount > 0 ? `${mealPart} · ${participantPart}` : mealPart;
};
/** Ersetzt die Zahl, wenn für die gewählten Mahlzeitentypen nichts eingeplant ist. */
export const EVALUATION_NO_PLANNED_MEALS =
  "Für die gewählten Mahlzeiten ist im Menüplan noch nichts eingeplant.";
/** Screenreader-Beschriftung der Mahlzeitentyp-Chips. */
export const EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL =
  "Mahlzeiten für den Durchschnitt auswählen";
export const REPORT_NO_REFUND_GROUP = "Ohne Rückerstattung";
export const REPORT_UNKNOWN_BUDGET = "Unbekanntes Budget";
