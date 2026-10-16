import {formatLocalDate} from "../../../../utils/dateUtils";
import {DEFAULT_CURRENCY} from "../../../Shared/utils/currencyUtils";
import {Budget} from "../Budget/budget.class";
import {BudgetDomain} from "../Budget/budget.types";
import {BudgetShare, CurrenciesInUse, ExpenseDomain} from "../Expense/expense.types";
import {EVALUATION_SHARE_OTHERS as TEXT_EVALUATION_SHARE_OTHERS} from "../../../../constants/text";
import {Meal, MenuplanData} from "../../Menuplan/menuplan.types";

/** Ein Stück der Verteilung vor der Prozentrechnung (siehe `shareByBudget`). */
type BudgetShareWithoutPercent = Omit<BudgetShare, "sharePercent">;

/**
 * Kennzahlen über die Ausgaben eines Anlasses (Ansicht «Auswertung», Epic 6).
 *
 * Reine Funktionen: kein React, kein Supabase, «heute» oder andere
 * Laufzeitwerte kommen immer als Parameter. Summiert nie über Währungen
 * hinweg — wer eine Summe will, filtert zuerst mit `filterByCurrency`.
 */
export class ExpenseStatistics {
  /**
   * Ermittelt die Währungen, in denen es Ausgaben gibt, und die vorausgewählte
   * Währung. Sortiert nach Anzahl Ausgaben (nicht Betrag), bei Gleichstand CHF
   * zuerst, sonst alphabetisch (siehe `compareCurrencyUsage`).
   *
   * @param expenses - Ausgaben, deren Währungen ermittelt werden.
   * @returns Liste der Währungscodes (häufigste zuerst) und die Vorauswahl
   *   (erstes Element, «CHF», wenn es keine Ausgaben gibt).
   * @example
   * // 2 × EUR, 1 × CHF
   * ExpenseStatistics.getCurrenciesInUse(expenses)
   * // {currencies: ["EUR", "CHF"], defaultCurrency: "EUR"}
   */
  static getCurrenciesInUse(expenses: ExpenseDomain[]): CurrenciesInUse {
    const countByCurrency = new Map<string, number>();

    expenses.forEach((expense) => {
      countByCurrency.set(
        expense.currency,
        (countByCurrency.get(expense.currency) ?? 0) + 1,
      );
    });

    const currencies = [...countByCurrency.keys()].sort(
      (currencyA, currencyB) =>
        ExpenseStatistics.compareCurrencyUsage(
          currencyA,
          currencyB,
          countByCurrency,
        ),
    );

    return {currencies, defaultCurrency: currencies[0] ?? DEFAULT_CURRENCY};
  }

  /**
   * Filtert die Ausgaben auf eine Währung. Basis für alle Summen und
   * Durchschnitte, damit nie über Währungen hinweg gerechnet wird.
   *
   * @param expenses - Zu filternde Ausgaben.
   * @param currency - ISO-4217-Währungscode, z.B. «CHF».
   * @returns Neue Liste mit den Ausgaben dieser Währung.
   * @example
   * ExpenseStatistics.filterByCurrency(expenses, "CHF")
   */
  static filterByCurrency(
    expenses: ExpenseDomain[],
    currency: string,
  ): ExpenseDomain[] {
    return expenses.filter((expense) => expense.currency === currency);
  }

  /**
   * Summiert die Beträge der übergebenen Ausgaben. Erwartet Ausgaben einer
   * einzigen Währung (vorher `filterByCurrency`).
   *
   * @param expenses - Ausgaben einer Währung.
   * @returns Summe in Rappen, 0 bei leerer Liste.
   * @example
   * ExpenseStatistics.sumAmountInCents(expensesInChf) // 234050
   */
  static sumAmountInCents(expenses: ExpenseDomain[]): number {
    return expenses.reduce<number>((total, expense) => {
      return total + expense.amountInCents;
    }, 0);
  }

  /**
   * Berechnet den Durchschnitt pro Person, gerundet auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param participantCount - Anzahl Teilnehmende aus der Gruppenkonfiguration.
   * @returns Ø pro Person in Rappen, `null` bei 0 Teilnehmenden (statt
   *   `Infinity`/`NaN`).
   * @example
   * ExpenseStatistics.averagePerParticipant(240000, 24) // 10000
   * ExpenseStatistics.averagePerParticipant(240000, 0)  // null
   */
  static averagePerParticipant(
    totalAmountInCents: number,
    participantCount: number,
  ): number | null {
    if (participantCount === 0) return null;

    return Math.round(totalAmountInCents / participantCount);
  }

  /**
   * Berechnet, was bisher pro Person und Tag verbraucht wurde, gemessen an
   * **allen** Anlasstagen (nicht nur den vergangenen). So bläht ein
   * Grosseinkauf vor dem Anlass den Wert nicht auf, und er ist direkt mit dem
   * Ansatz eines «pro Person & Tag»-Budgets vergleichbar. Gerundet wird erst
   * am Schluss auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param participantCount - Anzahl Teilnehmende aus der Gruppenkonfiguration.
   * @param eventDayCount - Anzahl Anlasstage (`event.numberOfDays`).
   * @returns Betrag pro Person und Tag in Rappen, `null` bei 0 Teilnehmenden
   *   oder 0 Anlasstagen.
   * @example
   * ExpenseStatistics.averagePerParticipantAndDay(168000, 24, 7) // 1000
   */
  static averagePerParticipantAndDay(
    totalAmountInCents: number,
    participantCount: number,
    eventDayCount: number,
  ): number | null {
    if (participantCount === 0 || eventDayCount === 0) return null;

    return Math.round(totalAmountInCents / eventDayCount / participantCount);
  }

  /**
   * Berechnet den Durchschnitt pro eingeplanter Mahlzeit, gerundet auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param mealCount - Anzahl eingeplanter Mahlzeiten (`countPlannedMeals`).
   * @returns Ø pro Mahlzeit in Rappen, `null` bei 0 Mahlzeiten.
   * @example
   * ExpenseStatistics.averagePerMeal(30300, 12) // 2525
   * ExpenseStatistics.averagePerMeal(30300, 0)  // null
   */
  static averagePerMeal(
    totalAmountInCents: number,
    mealCount: number,
  ): number | null {
    if (mealCount === 0) return null;

    return Math.round(totalAmountInCents / mealCount);
  }

  /**
   * Berechnet, was bisher pro Person und Mahlzeit verbraucht wurde, gemessen
   * an **allen** eingeplanten Mahlzeiten. Vergleichbar zwischen Anlässen
   * verschiedener Grösse. Gerundet wird erst am Schluss auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param mealCount - Anzahl eingeplanter Mahlzeiten (`countPlannedMeals`).
   * @param participantCount - Anzahl Teilnehmende aus der Gruppenkonfiguration.
   * @returns Betrag pro Person und Mahlzeit in Rappen, `null` bei 0 Mahlzeiten
   *   oder 0 Teilnehmenden.
   * @example
   * ExpenseStatistics.averagePerParticipantAndMeal(30300, 12, 20) // 126
   */
  static averagePerParticipantAndMeal(
    totalAmountInCents: number,
    mealCount: number,
    participantCount: number,
  ): number | null {
    if (mealCount === 0 || participantCount === 0) return null;

    return Math.round(totalAmountInCents / mealCount / participantCount);
  }

  /**
   * Zählt die eingeplanten Mahlzeiten für «Ø pro Mahlzeit». Eine Mahlzeit
   * (Tag × Mahlzeitentyp) zählt, wenn in einem ihrer Menüs mindestens ein
   * Rezept oder Produkt eingeplant ist; Material allein ist keine Mahlzeit.
   * Mehrere Menüs in derselben Mahlzeit zählen einmal. Mahlzeiten eines Typs,
   * der nicht mehr in `mealTypes.order` steht, zählen nicht.
   *
   * @param menuplan - Menüplan des Anlasses.
   * @param excludedMealTypeIds - UIDs der abgewählten Mahlzeitentypen;
   *   unbekannte UIDs (gelöschte Typen) bewirken nichts.
   * @returns Anzahl eingeplanter Mahlzeiten, 0 bei leerem Menüplan.
   * @example
   * // Zmorge und Znacht an 2 Tagen eingeplant, Zvieri abgewählt
   * ExpenseStatistics.countPlannedMeals(menuplan, [zvieriUid]) // 4
   */
  static countPlannedMeals(
    menuplan: MenuplanData,
    excludedMealTypeIds: string[],
  ): number {
    const countedMealTypeIds = menuplan.mealTypes.order.filter(
      (mealTypeId) => !excludedMealTypeIds.includes(mealTypeId),
    );
    return Object.values(menuplan.meals).filter(
      (meal) =>
        countedMealTypeIds.includes(meal.mealType) &&
        ExpenseStatistics.hasPlannedFood(meal, menuplan),
    ).length;
  }

  /**
   * Zählt die Ausgaben ohne Beleg. Wird bewusst über alle Budgets und
   * Währungen aufgerufen: Für die Abrechnung braucht jede Ausgabe einen Beleg.
   *
   * @param expenses - Zu prüfende Ausgaben.
   * @returns Anzahl Ausgaben ohne `attachmentPath`.
   * @example
   * ExpenseStatistics.countWithoutAttachment(expenses) // 3
   */
  static countWithoutAttachment(expenses: ExpenseDomain[]): number {
    return expenses.filter((expense) => expense.attachmentPath === null).length;
  }

  /**
   * Liefert die grössten Ausgaben. Sortiert nach Betrag absteigend, bei
   * gleichem Betrag neueres Datum zuerst, dann nach Bezeichnung — ein fester
   * Tie-Breaker, damit die Reihenfolge nach einem Realtime-Reload nicht springt.
   * Die Eingabe bleibt unverändert.
   *
   * @param expenses - Ausgaben einer Währung.
   * @param limit - Maximale Anzahl Einträge (Standard 5).
   * @returns Neue Liste mit höchstens `limit` Ausgaben.
   * @example
   * ExpenseStatistics.topExpenses(expensesInChf)    // die 5 grössten
   * ExpenseStatistics.topExpenses(expensesInChf, 3) // die 3 grössten
   */
  static topExpenses(expenses: ExpenseDomain[], limit = 5): ExpenseDomain[] {
    return [...expenses]
      .sort((expenseA, expenseB) => {
        if (expenseA.amountInCents > expenseB.amountInCents) {
          return -1;
        } else if (expenseA.amountInCents < expenseB.amountInCents) {
          return 1;
        } else {
          if (expenseA.date.getTime() < expenseB.date.getTime()) {
            return 1;
          } else if (expenseA.date.getTime() > expenseB.date.getTime()) {
            return -1;
          } else {
            return expenseA.label.localeCompare(expenseB.label, "de");
          }
        }
      })
      .slice(0, limit);
  }
  /**
   * Entfernt die Ausgaben abgewählter Budgets. Gespeichert werden die
   * abgewählten statt der ausgewählten IDs, damit neue Budgets automatisch
   * mitzählen und IDs gelöschter Budgets nichts bewirken.
   *
   * @param expenses - Zu filternde Ausgaben.
   * @param excludedBudgetIds - IDs der Budgets, die nicht mitzählen.
   * @returns Neue Liste ohne die Ausgaben dieser Budgets.
   * @example
   * ExpenseStatistics.excludeBudgets(expenses, ["budget-material"])
   */
  static excludeBudgets(
    expenses: ExpenseDomain[],
    excludedBudgetIds: string[],
  ): ExpenseDomain[] {
    return expenses.filter(
      (expense) => !excludedBudgetIds.includes(expense.budgetId),
    );
  }
  /**
   * Kumulierte Ausgaben pro Anlasstag bis heute. Erwartet Ausgaben
   * einer Währung (vorher filterByCurrency).
   * @param expenses - Alle betroffnen Ausgaben
   * @param eventDays - Liste der AnlassTage
   * @param today: - Stichtag heute
   * @returns Ein Wert pro Anlasstag, `null` für Tage nach heute; leere Liste ohne Anlasstage.
   */
  static cumulativeByEventDay({
    expenses,
    eventDays,
    today,
  }: {
    expenses: ExpenseDomain[];
    eventDays: Date[];
    today: Date;
  }): (number | null)[] {
    if (eventDays.length === 0) {
      return [];
    }

    const eventDayKeys = eventDays.map((day) => formatLocalDate(day));
    const todayKey = formatLocalDate(today);

    // eventDays ist aufsteigend sortiert, also ist die Anzahl ≤ heute zugleich der Index + 1
    const lastVisibleIndex =
      eventDayKeys.filter((dayKey) => dayKey <= todayKey).length - 1;

    const dailyTotals = new Array<number>(eventDayKeys.length).fill(0);

    if (lastVisibleIndex < 0) return eventDayKeys.map(() => null);

    expenses.forEach((expense) => {
      const dayIndex = ExpenseStatistics.getEventDayIndex(
        formatLocalDate(expense.date),
        eventDayKeys,
        lastVisibleIndex,
      );
      dailyTotals[dayIndex] += expense.amountInCents;
    });

    let runningTotal = 0;
    return dailyTotals.map((dailyTotal, dayIndex) => {
      if (dayIndex > lastVisibleIndex) return null;
      runningTotal += dailyTotal;
      return runningTotal;
    });
  }

  /**
   * Berechnet die Soll-Linie des Ausgabenverlaufs: der Sollbetrag linear
   * über die Anlasstage verteilt. Tag i (1-basiert) = `Math.round(Soll × i / n)`.
   * Jeder Tag wird direkt berechnet statt aufsummiert, damit sich keine
   * Rundungsfehler ansammeln und der letzte Wert genau dem Sollbetrag entspricht.
   *
   * @param targetAmountInCents - Summe der Sollbeträge der ausgewählten Budgets
   *   in Rappen (`sumTargetAmountInCents`).
   * @param eventDayCount - Anzahl Anlasstage.
   * @returns Ein Wert pro Anlasstag in Rappen, leere Liste bei 0 Anlasstagen.
   * @example
   * ExpenseStatistics.targetLineByEventDay(7000, 7) // [1000, 2000, 3000, 4000, 5000, 6000, 7000]
   * ExpenseStatistics.targetLineByEventDay(1000, 3) // [333, 667, 1000]
   */
  static targetLineByEventDay(
    targetAmountInCents: number,
    eventDayCount: number,
  ): number[] {
    // erst multiplizieren, dann teilen: Der letzte Tag ist genau Soll × n / n = Soll, ohne Rundungsrest
    return Array.from({length: eventDayCount}, (_value, dayIndex) =>
      Math.round((targetAmountInCents * (dayIndex + 1)) / eventDayCount),
    );
  }

  /**
   * Summiert die Sollbeträge der ausgewählten Budgets in einer Währung, als
   * Endpunkt der Soll-Linie im Ausgabenverlauf. Der Sollbetrag je Budget kommt
   * aus `Budget.getTargetAmountInCents`, damit Auswertung und Budget-Karten
   * dasselbe Soll zeigen. Budgets in anderen Währungen zählen nicht, auch wenn
   * sie ausgewählt sind: Über Währungen wird nie summiert.
   *
   * @param budgets - Alle Budgets des Anlasses.
   * @param excludedBudgetIds - IDs der abgewählten Budgets (Budget-Auswahl der Auswertung).
   * @param currency - Gewählte Währung (ISO-4217-Code, z.B. «CHF»).
   * @param participantCount - Anzahl Teilnehmende (`groupConfiguration.totalPortions`).
   * @param eventDayCount - Anzahl Anlasstage.
   * @returns Summe der Sollbeträge in Rappen, 0 ohne passende Budgets.
   * @example
   * // «Küche» fix CHF 500, «Essen» CHF 10 pro Person & Tag, 24 Personen, 7 Tage
   * ExpenseStatistics.sumTargetAmountInCents({
   *   budgets,
   *   excludedBudgetIds: [],
   *   currency: "CHF",
   *   participantCount: 24,
   *   eventDayCount: 7,
   * }) // 50000 + 1000 × 24 × 7 = 218000
   */
  static sumTargetAmountInCents({
    budgets,
    excludedBudgetIds,
    currency,
    participantCount,
    eventDayCount,
  }: {
    budgets: BudgetDomain[];
    excludedBudgetIds: string[];
    currency: string;
    participantCount: number;
    eventDayCount: number;
  }): number {
    return budgets
      .filter(
        (budget) =>
          !excludedBudgetIds.includes(budget.id) &&
          budget.currency === currency,
      )
      .reduce(
        (total, budget) =>
          total +
          Budget.getTargetAmountInCents(
            budget,
            participantCount,
            eventDayCount,
          ),
        0,
      );
  }

  /**
   * Verteilt die Ausgaben auf die Budgets, für den Donut der Auswertung.
   * Erwartet Ausgaben einer Währung (vorher `filterByCurrency`).
   *
   * - Ein Stück pro Budget mit Ausgaben, grösstes zuerst; bei gleichem Betrag
   *   in der Reihenfolge von `budgets`, damit nach einem Realtime-Reload nichts springt.
   * - Ausgaben, deren Budget (noch) nicht in `budgets` ist, werden übersprungen
   *   (kurzer Moment, wenn Realtime die Ausgaben vor den Budgets nachlädt).
   * - Mehr als `maxSlices` Budgets: die grössten einzeln, der Rest als «Übrige».
   * - Der Anteil wird nach dem Zusammenfassen gerechnet, damit «Übrige» seinen
   *   eigenen gerundeten Anteil bekommt statt einer Summe gerundeter Anteile.
   *
   * @param expenses - Ausgaben einer Währung.
   * @param budgets - Alle Budgets des Anlasses, in der Reihenfolge der Übersicht.
   * @param maxSlices - Höchstzahl Stücke inklusive «Übrige» (Standard 5).
   * @returns Stücke absteigend nach Betrag, leer ohne Ausgaben.
   * @example
   * // Küche CHF 150, Motto CHF 50
   * ExpenseStatistics.shareByBudget(expensesInChf, budgets)
   * // [{label: "Küche", sharePercent: 75, colorIndex: 0, …}, {label: "Motto", sharePercent: 25, colorIndex: 1, …}]
   */
  static shareByBudget(
    expenses: ExpenseDomain[],
    budgets: BudgetDomain[],
    maxSlices = 5,
  ): BudgetShare[] {
    const amountByBudgetId = ExpenseStatistics.sumByBudget(expenses);
    const slices = budgets
      .map((budget, budgetIndex) => ({
        id: budget.id,
        label: budget.name,
        amountInCents: amountByBudgetId.get(budget.id) ?? 0,
        colorIndex: budgetIndex,
        groupedBudgetNames: [],
      }))
      .filter((slice) => slice.amountInCents > 0)
      .sort(
        (sliceA, sliceB) =>
          sliceB.amountInCents - sliceA.amountInCents ||
          sliceA.colorIndex - sliceB.colorIndex,
      );
    const groupedSlices = ExpenseStatistics.groupSmallShares(slices, maxSlices);

    const totalAmountInCents = ExpenseStatistics.sumOfSlices(groupedSlices);
    return groupedSlices.map((slice) => ({
      ...slice,
      sharePercent: Math.round(
        (slice.amountInCents / totalAmountInCents) * 100,
      ),
    }));
  }

  /**
   * Prüft, ob in einem der Menüs einer Mahlzeit ein Rezept oder Produkt
   * eingeplant ist. Menü-UIDs ohne Menü (kurz nach Realtime-Änderungen)
   * werden übersprungen.
   *
   * @param meal - Zu prüfende Mahlzeit.
   * @param menuplan - Menüplan mit den Menüs.
   * @returns `true`, wenn mindestens ein Rezept oder Produkt eingeplant ist.
   */
  private static hasPlannedFood(meal: Meal, menuplan: MenuplanData): boolean {
    return meal.menuOrder.some((menueUid) => {
      const menue = menuplan.menues[menueUid];
      return (
        menue !== undefined &&
        (menue.mealRecipeOrder.length > 0 || menue.productOrder.length > 0)
      );
    });
  }

  /**
   * Summiert die Beträge je Budget.
   *
   * @param expenses - Ausgaben einer Währung.
   * @returns Map Budget-ID → Summe in Rappen.
   */
  private static sumByBudget(expenses: ExpenseDomain[]): Map<string, number> {
    const amountByBudgetId = new Map<string, number>();
    expenses.forEach((expense) => {
      amountByBudgetId.set(
        expense.budgetId,
        (amountByBudgetId.get(expense.budgetId) ?? 0) + expense.amountInCents,
      );
    });
    return amountByBudgetId;
  }

  /**
   * Fasst die kleinsten Stücke zu «Übrige» zusammen, wenn es mehr als
   * `maxSlices` gibt. Bleibt die Anzahl darunter, kommen die Stücke unverändert zurück.
   *
   * @param slices - Stücke, absteigend nach Betrag sortiert.
   * @param maxSlices - Höchstzahl Stücke inklusive «Übrige».
   * @returns Die `maxSlices - 1` grössten Stücke plus «Übrige», sonst `slices`.
   */
  private static groupSmallShares(
    slices: BudgetShareWithoutPercent[],
    maxSlices: number,
  ): BudgetShareWithoutPercent[] {
    if (slices.length <= maxSlices) return slices;

    const keptSlices = slices.slice(0, maxSlices - 1);
    const groupedSlices = slices.slice(maxSlices - 1);
    return [
      ...keptSlices,
      {
        id: "others",
        label: TEXT_EVALUATION_SHARE_OTHERS(groupedSlices.length),
        amountInCents: ExpenseStatistics.sumOfSlices(groupedSlices),
        // «Übrige» ist immer grau, nicht in der Farbe eines Budgets
        colorIndex: null,
        groupedBudgetNames: groupedSlices.map((slice) => slice.label),
      },
    ];
  }

  /**
   * Summiert die Beträge von Stücken der Verteilung.
   *
   * @param slices - Stücke der Verteilung.
   * @returns Summe in Rappen.
   */
  private static sumOfSlices(slices: BudgetShareWithoutPercent[]): number {
    return slices.reduce((total, slice) => total + slice.amountInCents, 0);
  }

  /**
   * Ordnet eine Ausgabe dem Anlasstag zu, in dessen Punkt sie im
   * Ausgabenverlauf zählt. Jede Ausgabe bekommt genau einen Tag, damit der
   * letzte Wert des Verlaufs der Summe aller Ausgaben entspricht:
   * - vor dem ersten Anlasstag → erster Anlasstag (z.B. Grosseinkauf),
   * - zwischen zwei Zeitscheiben → nächster Anlasstag,
   * - nach dem letzten Anlasstag → letzter Anlasstag,
   * - nach heute (vorausdatiert) → letzter Anlasstag bis heute.
   *
   * Verglichen wird über `YYYY-MM-DD`-Schlüssel, damit Uhrzeit und
   * Zeitumstellung keine Rolle spielen.
   *
   * @param expenseKey - Datum der Ausgabe als `YYYY-MM-DD` (`formatLocalDate`).
   * @param eventDayKeys - Alle Anlasstage als `YYYY-MM-DD`, aufsteigend sortiert, nicht leer.
   * @param lastVisibleIndex - Index des letzten Anlasstags bis und mit heute.
   * @returns Index in `eventDayKeys`, höchstens `lastVisibleIndex`. Liegt heute
   *   vor dem Anlass (`lastVisibleIndex` = -1), ist auch das Ergebnis -1.
   * @example
   * // Anlasstage 05.07.–07.07., heute 06.07.
   * ExpenseStatistics.getEventDayIndex("2026-07-01", eventDayKeys, 1) // 0 (vorher)
   * ExpenseStatistics.getEventDayIndex("2026-07-09", eventDayKeys, 1) // 1 (begrenzt auf heute)
   */
  private static getEventDayIndex(
    expenseKey: string,
    eventDayKeys: string[],
    lastVisibleIndex: number,
  ): number {
    // erster Anlasstag am oder nach dem Ausgabedatum: deckt «vorher» (→ 0) und «Lücke» (→ nächster Tag) ab
    const nextDayIndex = eventDayKeys.findIndex(
      (dayKey) => dayKey >= expenseKey,
    );
    const dayIndex =
      nextDayIndex === -1 ? eventDayKeys.length - 1 : nextDayIndex; // nach dem Anlass
    return Math.min(dayIndex, lastVisibleIndex); // vorausdatiert → heute (O1)
  }
  /**
   * Sortier-Vergleich für Währungscodes: häufigste zuerst, bei Gleichstand
   * CHF vor allen anderen, sonst alphabetisch. Bestimmt damit sowohl die
   * Vorauswahl (erstes Element) als auch die Reihenfolge im Währungs-Toggle.
   *
   * @param currencyA - Erster Währungscode.
   * @param currencyB - Zweiter Währungscode.
   * @param countByCurrency - Anzahl Ausgaben je Währung.
   * @returns Negativ, wenn `currencyA` zuerst kommt; positiv, wenn `currencyB` zuerst kommt.
   */
  private static compareCurrencyUsage(
    currencyA: string,
    currencyB: string,
    countByCurrency: Map<string, number>,
  ): number {
    const countDifference =
      (countByCurrency.get(currencyB) ?? 0) -
      (countByCurrency.get(currencyA) ?? 0);
    if (countDifference !== 0) return countDifference;

    // Gleichstand: Hauptwährung der App bevorzugen
    if (currencyA === DEFAULT_CURRENCY) return -1;
    if (currencyB === DEFAULT_CURRENCY) return 1;

    return currencyA.localeCompare(currencyB);
  }
}
