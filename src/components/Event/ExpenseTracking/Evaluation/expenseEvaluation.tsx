import React from "react";

import {Alert, Box, Button, Chip, Grid, Typography} from "@mui/material";

import {ExpenseDomain} from "../Expense/expense.types";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseHistoryChart} from "./expenseHistoryChart";
import {ExpenseBudgetShareChart} from "./expenseBudgetShareChart";
import {StatisticTile} from "./statisticTile";
import {MealAverageTile} from "./mealAverageTile";
import {MenuplanData} from "../../Menuplan/menuplan.types";
import {TopExpensesTile} from "./topExpensesTile";
import {BudgetFilter} from "./budgetFilter";
import {getStatisticsScopeNote} from "./evaluationLabels";
import {
  SHOW as TEXT_SHOW,
  NO_EXPENSES_FOR_STATS as TEXT_NO_EXPENSES_FOR_STATS,
  EVALUATION_TOTAL as TEXT_EVALUATION_TOTAL,
  EVALUATION_EXPENSE_COUNT as TEXT_EVALUATION_EXPENSE_COUNT,
  EVALUATION_AVERAGE_PER_PARTICIPANT as TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT,
  EVALUATION_PARTICIPANTS_MISSING as TEXT_EVALUATION_PARTICIPANTS_MISSING,
  EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR as TEXT_EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR,
  EVALUATION_CALCULATION_BASIS as TEXT_EVALUATION_CALCULATION_BASIS,
  EVALUATION_WITHOUT_RECEIPT_COUNT as TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT,
  EVALUATION_KEYFIGURES as TEXT_EVALUATION_KEYFIGURES,
  EVALUATION_CURRENCY_FILTER_ARIA_LABEL as TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
  EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS as TEXT_EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {ExpenseStatistics} from "./expenseStatistics.class";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {useStoredIdSet} from "../../../../hooks/useStoredIdSet";
import {LocalStorageKey} from "../../../../constants/localStorage";
import {formatLocalDate, parseLocalDate} from "../../../../utils/dateUtils";

/**
 * Props für {@link ExpenseEvaluation}.
 *
 * @param eventId - ID des Anlasses, Teil des Speicherschlüssels der Budget-Auswahl.
 * @param expenses - Alle Ausgaben des Anlasses (ungefiltert, alle Währungen).
 * @param budgets - Alle Budgets des Anlasses, für Budget-Filter, Sollbetrag,
 *   Verteilung nach Budget (Reihenfolge bestimmt die Farben) sowie Icon und
 *   Name in der Top-5-Liste.
 * @param participantCount - Anzahl Teilnehmende (`groupConfiguration.totalPortions`).
 * @param eventDays - Alle Anlasstage, aufsteigend (`getEventDateList`). Achse
 *   des Ausgabenverlaufs; ihre Anzahl ist Grundlage für Ø pro Person & Tag und
 *   für den Sollbetrag der «pro Person & Tag»-Budgets.
 * @param today - Stichtag «heute», von der Seite übergeben, damit die
 *   Berechnungen testbar bleiben. Nur der Kalendertag zählt.
 * @param menuplan - Menüplan des Anlasses, für «Ø pro Mahlzeit». Solange er
 *   lädt (`uid` leer), entfällt die Kachel.
 * @param handleEditClick - Öffnet den Bearbeiten-Dialog (Klick auf eine Top-5-Zeile).
 * @param handleShowMissingReceipts - Wechselt in die Ausgabenliste und zeigt
 *   dort nur Ausgaben ohne Beleg («Anzeigen» im Beleg-Hinweis).
 */
type ExpenseEvaluationProps = {
  eventId: string;
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  participantCount: number;
  eventDays: Date[];
  today: Date;
  menuplan: MenuplanData;
  handleEditClick: (expenseId: string) => void;
  handleShowMissingReceipts: () => void;
};
/**
 * Ansicht «Auswertung» der Abrechnungsseite: Kennzahlen über die Ausgaben
 * der ausgewählten Budgets (Gesamtausgaben, Ø pro Person, Ø pro Mahlzeit,
 * Verlauf, Verteilung nach Budget, grösste Ausgaben) in einer Währung, plus
 * ein Hinweis auf Ausgaben ohne Beleg.
 *
 * Lädt selbst nichts: Alle Werte werden bei jedem Render aus den Props
 * (Ausgaben, Budgets, Gruppengrösse, Anlasstage, Menüplan) und der gewählten Währung
 * abgeleitet. Dadurch ist die Ansicht automatisch live, sobald die Seite
 * über Realtime neue Ausgaben erhält.
 *
 * Gibt es mehrere Währungen, kann über Chips gewechselt werden; ohne
 * bewusste Wahl gilt die häufigste Währung (siehe
 * `ExpenseStatistics.getCurrenciesInUse`). Fehlende Belege werden über alle
 * Budgets und Währungen gezählt, weil sie für die Abrechnung nötig sind.
 *
 * @param props - Siehe {@link ExpenseEvaluationProps}.
 * @returns Die Auswertung oder, ohne Ausgaben, einen Hinweistext.
 * @example
 * <ExpenseEvaluation
 *   expenses={state.expenses ?? []}
 *   budgets={state.budgets ?? []}
 *   participantCount={groupConfiguration.totalPortions}
 *   eventDays={eventDays}
 *   today={new Date()}
 *   menuplan={menuplan}
 *   handleEditClick={handleEditExpense}
 *   handleShowMissingReceipts={handleShowMissingReceipts}
 * />
 */
export const ExpenseEvaluation = ({
  eventId,
  expenses,
  budgets,
  participantCount,
  eventDays,
  today,
  menuplan,
  handleEditClick,
  handleShowMissingReceipts,
}: ExpenseEvaluationProps) => {
  const classes = useCustomStyles();

  // null = «keine bewusste Wahl», dann gilt die Vorauswahl
  const [chosenCurrency, setChosenCurrency] = React.useState<string | null>(
    null,
  );

  const {
    ids: excludedBudgetIds,
    toggleId: toggleBudget,
    clearIds,
  } = useStoredIdSet(
    `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_BUDGETS}_${eventId}`,
  );
  const {ids: excludedMealTypeIds, toggleId: toggleMealType} = useStoredIdSet(
    `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_MEAL_TYPES}_${eventId}`,
  );

  // nur Ausgaben der ausgewählten Budgets
  const expensesOfSelectedBudgets = React.useMemo(
    () => ExpenseStatistics.excludeBudgets(expenses, excludedBudgetIds),
    [expenses, excludedBudgetIds],
  );
  // welche Währungen gibt es darin, welche ist vorausgewählt
  const {currencies, defaultCurrency} = React.useMemo(
    () => ExpenseStatistics.getCurrenciesInUse(expensesOfSelectedBudgets),
    [expensesOfSelectedBudgets],
  );
  // gewählte Währung, fällt zurück, wenn sie nicht mehr vorkommt
  const selectedCurrency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : defaultCurrency;

  // Währungen, die in den Kennzahlen gerade NICHT enthalten sind
  const otherCurrencies = currencies.filter(
    (currency) => currency !== selectedCurrency,
  );
  const todayKey = formatLocalDate(today);

  // alle Kennzahlen in der gewählten Währung
  const statistics = React.useMemo(() => {
    const expensesInCurrency = ExpenseStatistics.filterByCurrency(
      expensesOfSelectedBudgets,
      selectedCurrency,
    );
    const totalAmountInCents =
      ExpenseStatistics.sumAmountInCents(expensesInCurrency);

    const targetAmountInCents = ExpenseStatistics.sumTargetAmountInCents({
      budgets,
      excludedBudgetIds,
      currency: selectedCurrency,
      participantCount,
      eventDayCount: eventDays.length,
    });

    return {
      expenseCount: expensesInCurrency.length,
      totalAmountInCents,
      averagePerParticipantInCents: ExpenseStatistics.averagePerParticipant(
        totalAmountInCents,
        participantCount,
      ),
      averagePerParticipantAndDayInCents:
        ExpenseStatistics.averagePerParticipantAndDay(
          totalAmountInCents,
          participantCount,
          eventDays.length,
        ),
      topExpenses: ExpenseStatistics.topExpenses(expensesInCurrency),
      budgetShares: ExpenseStatistics.shareByBudget(
        expensesInCurrency,
        budgets,
      ),
      history: {
        actualValues: ExpenseStatistics.cumulativeByEventDay({
          expenses: expensesInCurrency,
          eventDays,
          today: parseLocalDate(todayKey),
        }),
        // ohne Sollbetrag keine Soll-Linie
        targetValues:
          targetAmountInCents > 0
            ? ExpenseStatistics.targetLineByEventDay(
                targetAmountInCents,
                eventDays.length,
              )
            : null,
      },
    };
  }, [
    expensesOfSelectedBudgets,
    selectedCurrency,
    participantCount,
    eventDays,
    todayKey,
    budgets,
    excludedBudgetIds,
  ]);
  // ein einziges Stück wäre ein voller Ring mit «100 %» ohne Aussage
  const showBudgetShares = statistics.budgetShares.length >= 2;

  // Mahlzeitentypen in Menüplan-Reihenfolge; Einträge ohne Typ (kurz bei Realtime) weglassen
  const mealTypes = React.useMemo(
    () =>
      menuplan.mealTypes.order
        .map((mealTypeId) => menuplan.mealTypes.entries[mealTypeId])
        .filter((mealType) => mealType !== undefined),
    [menuplan],
  );
  // eigenes Memo: Realtime-Änderungen am Menüplan rechnen nur diese Kachel neu
  const mealStatistics = React.useMemo(() => {
    const mealCount = ExpenseStatistics.countPlannedMeals(
      menuplan,
      excludedMealTypeIds,
    );
    return {
      mealCount,
      averagePerMealInCents: ExpenseStatistics.averagePerMeal(
        statistics.totalAmountInCents,
        mealCount,
      ),
      averagePerParticipantAndMealInCents:
        ExpenseStatistics.averagePerParticipantAndMeal(
          statistics.totalAmountInCents,
          mealCount,
          participantCount,
        ),
    };
  }, [
    menuplan,
    excludedMealTypeIds,
    statistics.totalAmountInCents,
    participantCount,
  ]);
  // solange der Menüplan lädt, ist er leer: kein falscher Hinweis «nichts eingeplant»
  const showMealAverage = menuplan.uid !== "" && mealTypes.length > 0;
  const keyFigureTileSize = showMealAverage
    ? {xs: 12, sm: 6, md: 4}
    : {xs: 12, sm: 6};
  // Belege fehlen: alle Budgets, alle Währungen (Aufgabe, keine Statistik)
  const missingReceiptCount = React.useMemo(
    () => ExpenseStatistics.countWithoutAttachment(expenses),
    [expenses],
  );
  const excludedBudgetNames = budgets
    .filter((budget) => excludedBudgetIds.includes(budget.id))
    .map((budget) => budget.name);
  const scopeNote = getStatisticsScopeNote(
    otherCurrencies,
    excludedBudgetNames,
  );
  if (expenses.length === 0) {
    return (
      <Typography sx={classes.centerCenter} color="text.secondary">
        {TEXT_NO_EXPENSES_FOR_STATS}
      </Typography>
    );
  }

  return (
    <Box data-testid="expense-tracking-evaluation">
      {missingReceiptCount > 0 && (
        <Alert
          severity="warning"
          sx={classes.statisticsMissingReceiptsAlert}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={handleShowMissingReceipts}
            >
              {TEXT_SHOW}
            </Button>
          }
        >
          {TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT(missingReceiptCount)}
        </Alert>
      )}

      <Typography variant="subtitle2" color="text.secondary" component="h2">
        {TEXT_EVALUATION_KEYFIGURES}
      </Typography>
      <Box sx={classes.statisticsFilterBar}>
        {budgets.length > 1 && (
          <BudgetFilter
            budgets={budgets}
            deselectedBudgetIds={excludedBudgetIds}
            onToggleBudget={toggleBudget}
            onSelectAllBudgets={clearIds}
          />
        )}
        {currencies.length > 1 && (
          <Box
            role="group"
            aria-label={TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL}
            sx={classes.statisticsCurrencyChips}
          >
            {currencies.map((currency) => {
              const isSelected = currency === selectedCurrency;
              return (
                <Chip
                  key={currency}
                  label={currency}
                  size="small"
                  variant="outlined"
                  clickable
                  onClick={() => setChosenCurrency(currency)}
                  aria-pressed={isSelected}
                  sx={
                    isSelected
                      ? classes.statisticsCurrencyChipSelected
                      : undefined
                  }
                />
              );
            })}
          </Box>
        )}
      </Box>

      <Box sx={classes.statisticsScopeNote} aria-live="polite">
        {scopeNote && (
          <Typography variant="caption" color="text.secondary">
            {scopeNote}
          </Typography>
        )}
      </Box>

      {expensesOfSelectedBudgets.length === 0 ? (
        <Typography color="text.secondary">
          {TEXT_EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS}
        </Typography>
      ) : (
        <Grid container spacing={2}>
          <Grid size={keyFigureTileSize}>
            <StatisticTile
              title={TEXT_EVALUATION_TOTAL}
              value={formatAmountFromCents(
                statistics.totalAmountInCents,
                selectedCurrency,
              )}
              details={[TEXT_EVALUATION_EXPENSE_COUNT(statistics.expenseCount)]}
            />
          </Grid>

          <Grid size={keyFigureTileSize}>
            <StatisticTile
              title={TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT}
              hint={
                statistics.averagePerParticipantInCents === null
                  ? TEXT_EVALUATION_PARTICIPANTS_MISSING
                  : undefined
              }
              value={formatAmountFromCents(
                statistics.averagePerParticipantInCents ?? 0,
                selectedCurrency,
              )}
              details={[
                // «pro Person & Tag» entfällt bei 0 Anlasstagen (null)
                ...(statistics.averagePerParticipantAndDayInCents !== null
                  ? [
                      TEXT_EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR(
                        statistics.averagePerParticipantAndDayInCents,
                        selectedCurrency,
                      ),
                    ]
                  : []),
                TEXT_EVALUATION_CALCULATION_BASIS(
                  participantCount,
                  eventDays.length,
                ),
              ]}
            />
          </Grid>
          {showMealAverage && (
            // auf sm volle Breite: die Chips brauchen Platz
            <Grid size={{xs: 12, sm: 12, md: 4}}>
              <MealAverageTile
                mealTypes={mealTypes}
                excludedMealTypeIds={excludedMealTypeIds}
                onToggleMealType={toggleMealType}
                mealCount={mealStatistics.mealCount}
                averagePerMealInCents={mealStatistics.averagePerMealInCents}
                averagePerParticipantAndMealInCents={
                  mealStatistics.averagePerParticipantAndMealInCents
                }
                participantCount={participantCount}
                currency={selectedCurrency}
              />
            </Grid>
          )}
          <Grid size={{xs: 12}}>
            <ExpenseHistoryChart
              eventDays={eventDays}
              actualValues={statistics.history.actualValues}
              targetValues={statistics.history.targetValues}
              currency={selectedCurrency}
            />
          </Grid>
          {showBudgetShares && (
            <Grid size={{xs: 12, md: 5}}>
              <ExpenseBudgetShareChart
                shares={statistics.budgetShares}
                currency={selectedCurrency}
              />
            </Grid>
          )}
          <Grid size={{xs: 12, md: showBudgetShares ? 7 : 12}}>
            <TopExpensesTile
              expenses={statistics.topExpenses}
              budgets={budgets}
              handleEditClick={handleEditClick}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};
