import React from "react";

import {
  Alert,
  Box,
  Card,
  Chip,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import {ExpenseDomain} from "./expense.types";
import {BudgetDomain} from "./budget.types";

import {
  NO_EXPENSES_FOR_STATS as TEXT_NO_EXPENSES_FOR_STATS,
  EVALUATION_TOTAL as TEXT_EVALUATION_TOTAL,
  EVALUATION_EXPENSE_COUNT as TEXT_EVALUATION_EXPENSE_COUNT,
  EVALUATION_AVERAGE_PER_PARTICIPANT as TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT,
  EVALUATION_PARTICIPANTS_MISSING as TEXT_EVALUATION_PARTICIPANTS_MISSING,
  EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR as TEXT_EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR,
  EVALUATION_CALCULATION_BASIS as TEXT_EVALUATION_CALCULATION_BASIS,
  EVALUATION_WITHOUT_RECEIPT_COUNT as TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT,
  EVALUATION_TOP_EXPENSES as TEXT_EVALUATION_TOP_EXPENSES,
  EVALUATION_KEYFIGURES as TEXT_EVALUATION_KEYFIGURES,
  EVALUATION_CURRENCY_FILTER_ARIA_LABEL as TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
  EVALUATION_OTHER_CURRENCIES_EXCLUDED as TEXT_EVALUATION_OTHER_CURRENCIES_EXCLUDED,
} from "../../../constants/text/expenseTracking";
import {useCustomStyles} from "../../../constants/styles";
import {ExpenseStatistics} from "./expenseStatistics.class";
import {formatAmountFromCents} from "../../Shared/utils/currencyUtils";
import {BUDGET_ICON_MAP} from "./budgetIcons";

/**
 * Props für {@link ExpenseEvaluation}.
 *
 * @param expenses - Alle Ausgaben des Anlasses (ungefiltert, alle Währungen).
 * @param budgets - Alle Budgets des Anlasses, für Icon und Name in der Top-5-Liste.
 * @param participantCount - Anzahl Teilnehmende (`groupConfiguration.totalPortions`).
 * @param campDayCount - Anzahl Anlasstage (`event.numberOfDays`), gleiche
 *   Grundlage wie der Sollbetrag der Budgets.
 * @param handleEditClick - Öffnet den Bearbeiten-Dialog (Klick auf eine Top-5-Zeile).
 */
type ExpenseEvaluationProps = {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  participantCount: number;
  campDayCount: number;
  handleEditClick: (expenseId: string) => void;
};
/**
 * Ansicht «Auswertung» der Abrechnungsseite: Kennzahlen über die Ausgaben
 * der ausgewählten Budgets (Gesamtausgaben, Ø pro Person, grösste Ausgaben)
 * in einer Währung, plus ein Hinweis auf Ausgaben ohne Beleg.
 *
 * Lädt selbst nichts: Alle Werte werden bei jedem Render aus den Props
 * (Ausgaben, Budgets, Gruppengrösse, Anlasstage) und der gewählten Währung
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
 *   campDayCount={event.numberOfDays}
 *   handleEditClick={handleEditExpense}
 * />
 */
export const ExpenseEvaluation = ({
  expenses,
  budgets,
  participantCount,
  campDayCount,
  handleEditClick,
}: ExpenseEvaluationProps) => {
  const classes = useCustomStyles();

  // null = «keine bewusste Wahl», dann gilt die Vorauswahl
  const [chosenCurrency, setChosenCurrency] = React.useState<string | null>(
    null,
  );
  // Platzhalter bis 6.2b (dort ersetzt durch useStoredIdSet)
  const [excludedBudgetIds] = React.useState<string[]>([]);

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

  // alle Kennzahlen in der gewählten Währung
  const statistics = React.useMemo(() => {
    const expensesInCurrency = ExpenseStatistics.filterByCurrency(
      expensesOfSelectedBudgets,
      selectedCurrency,
    );
    const totalAmountInCents =
      ExpenseStatistics.sumAmountInCents(expensesInCurrency);
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
          campDayCount,
        ),
      topExpenses: ExpenseStatistics.topExpenses(expensesInCurrency),
    };
  }, [
    expensesOfSelectedBudgets,
    selectedCurrency,
    participantCount,
    campDayCount,
  ]);
  // Belege fehlen: alle Budgets, alle Währungen (Aufgabe, keine Statistik)
  const missingReceiptCount = React.useMemo(
    () => ExpenseStatistics.countWithoutAttachment(expenses),
    [expenses],
  );

  // --- Früher Ausstieg erst NACH allen Hooks
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
        <Alert severity="warning" sx={classes.statisticsMissingReceiptsAlert}>
          {TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT(missingReceiptCount)}
        </Alert>
      )}

      <Box sx={classes.statisticsSectionHeader}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            {TEXT_EVALUATION_KEYFIGURES}
          </Typography>
          {otherCurrencies.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={classes.statisticsOtherCurrenciesHint}
            >
              {TEXT_EVALUATION_OTHER_CURRENCIES_EXCLUDED(otherCurrencies)}
            </Typography>
          )}
        </Box>
        {/* Währungs-Chips nur bei mehr als einer Währung */}
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

      <Grid container spacing={2}>
        <Grid size={{xs: 12, sm: 6}}>
          <StatisticTile
            title={TEXT_EVALUATION_TOTAL}
            value={formatAmountFromCents(
              statistics.totalAmountInCents,
              selectedCurrency,
            )}
            details={[TEXT_EVALUATION_EXPENSE_COUNT(statistics.expenseCount)]}
          />
        </Grid>

        <Grid size={{xs: 12, sm: 6}}>
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
              TEXT_EVALUATION_CALCULATION_BASIS(participantCount, campDayCount),
            ]}
          />
        </Grid>

        <Grid size={{xs: 12}}>
          <TopExpensesTile
            expenses={statistics.topExpenses}
            budgets={budgets}
            handleEditClick={handleEditClick}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

/**
 * Props für {@link StatisticTile}.
 *
 * @param title - Überschrift der Kachel (z.B. «Gesamtausgaben»).
 * @param value - Grosse Hauptzahl, bereits formatiert. Wird ignoriert, wenn `hint` gesetzt ist.
 * @param details - Kleine Zeilen unter der Zahl (Anzahl, Rechengrundlage…), bereits formatiert.
 * @param hint - Erklärender Satz statt der Zahl, wenn es (noch) nichts zu zeigen gibt.
 */
type StatisticTileProps = {
  title: string;
  value?: string;
  details?: string[];
  hint?: string;
};

/**
 * Rahmen einer Kennzahl-Kachel der Auswertung: Titel, grosse Zahl (oder ein
 * erklärender Hinweis) und kleine Detailzeilen. Rechnet selbst nichts, alle
 * Texte kommen fertig formatiert.
 *
 * @param props - Siehe {@link StatisticTileProps}.
 */
const StatisticTile = ({
  title,
  value,
  details = [],
  hint,
}: StatisticTileProps) => {
  const classes = useCustomStyles();

  return (
    <Card variant="outlined" sx={classes.evaluationTile}>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      {hint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={classes.evaluationTileHint}
        >
          {hint}
        </Typography>
      ) : (
        <React.Fragment>
          <Box sx={classes.evaluationTileValueRow}>
            {/* h5-Optik, aber <p>: Kacheln sind keine Abschnitte der Seitengliederung */}
            <Typography variant="h5" component="p">
              {value}
            </Typography>
          </Box>
          {details.map((detail) => (
            <Typography key={detail} variant="body2" color="text.secondary">
              {detail}
            </Typography>
          ))}
        </React.Fragment>
      )}
    </Card>
  );
};

/**
 * Props für {@link TopExpensesTile}.
 *
 * @param expenses - Die grössten Ausgaben, bereits gefiltert, sortiert und gekürzt (`ExpenseStatistics.topExpenses`).
 * @param budgets - Alle Budgets, für Icon und Name je Zeile.
 * @param handleEditClick - Öffnet den Bearbeiten-Dialog der angeklickten Ausgabe.
 */
type TopExpensesTileProps = {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  handleEditClick: (expenseId: string) => void;
};

/**
 * Liste der grössten Einzelposten. Ein Klick auf eine Zeile öffnet denselben
 * Bearbeiten-Dialog wie in der Ausgabenliste, damit Tippfehler im Betrag
 * direkt korrigiert werden können.
 *
 * @param props - Siehe {@link TopExpensesTileProps}.
 */
const TopExpensesTile = ({
  expenses,
  budgets,
  handleEditClick,
}: TopExpensesTileProps) => {
  const classes = useCustomStyles();

  return (
    <Card variant="outlined" sx={classes.evaluationTile}>
      <Typography variant="subtitle2" color="text.secondary">
        {TEXT_EVALUATION_TOP_EXPENSES}
      </Typography>
      <List dense disablePadding data-testid="evaluation-top-expenses">
        {expenses.map((expense) => {
          const budget = budgets.find(
            (budget) => budget.id === expense.budgetId,
          );
          // Budget kann kurz fehlen, wenn Realtime die Budgets später nachlädt
          const BudgetIconComponent = budget
            ? BUDGET_ICON_MAP[budget.icon]
            : null;
          const formattedDate = expense.date.toLocaleString("de-CH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

          return (
            <ListItemButton
              key={expense.id}
              divider
              onClick={() => handleEditClick(expense.id)}
              data-testid={`evaluation-top-expense-${expense.id}`}
            >
              <ListItemIcon sx={classes.evaluationTopExpenseIcon}>
                {BudgetIconComponent && (
                  <BudgetIconComponent fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={classes.expenseRowPrimary}>
                    <Typography component="span" noWrap>
                      {expense.label}
                    </Typography>
                    <Typography component="span" sx={classes.expenseRowAmount}>
                      {formatAmountFromCents(
                        expense.amountInCents,
                        expense.currency,
                      )}
                    </Typography>
                  </Box>
                }
                secondary={
                  budget ? `${formattedDate} · ${budget.name}` : formattedDate
                }
              />
            </ListItemButton>
          );
        })}
      </List>
    </Card>
  );
};
