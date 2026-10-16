import React from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

import {ExpenseDomain} from "./expense.types";
import {BudgetDomain} from "./budget.types";
import {ExpenseHistoryChart} from "./expenseHistoryChart";
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
  EVALUATION_TOP_EXPENSES as TEXT_EVALUATION_TOP_EXPENSES,
  EVALUATION_KEYFIGURES as TEXT_EVALUATION_KEYFIGURES,
  EVALUATION_CURRENCY_FILTER_ARIA_LABEL as TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
  EVALUATION_BUDGET_FILTER_ALL as TEXT_EVALUATION_BUDGET_FILTER_ALL,
  EVALUATION_BUDGET_FILTER_PARTIAL as TEXT_EVALUATION_BUDGET_FILTER_PARTIAL,
  EVALUATION_BUDGET_FILTER_ARIA_LABEL as TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL,
  EVALUATION_SCOPE_NOTE_CURRENCIES as TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES,
  EVALUATION_SCOPE_NOTE_BUDGETS as TEXT_EVALUATION_SCOPE_NOTE_BUDGETS,
  EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS as TEXT_EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS,
} from "../../../constants/text";
import {useCustomStyles} from "../../../constants/styles";
import {ExpenseStatistics} from "./expenseStatistics.class";
import {formatAmountFromCents} from "../../Shared/utils/currencyUtils";
import {BUDGET_ICON_MAP} from "./budgetIcons";
import {useStoredIdSet} from "../../../hooks/useStoredIdSet";
import {LocalStorageKey} from "../../../constants/localStorage";
import {ArrowDropDown} from "@mui/icons-material";
import {formatLocalDate, parseLocalDate} from "../../../utils/dateUtils";

/**
 * Props für {@link ExpenseEvaluation}.
 *
 * @param eventId - ID des Anlasses, Teil des Speicherschlüssels der Budget-Auswahl.
 * @param expenses - Alle Ausgaben des Anlasses (ungefiltert, alle Währungen).
 * @param budgets - Alle Budgets des Anlasses, für Budget-Filter sowie Icon und
 *   Name in der Top-5-Liste.
 * @param participantCount - Anzahl Teilnehmende (`groupConfiguration.totalPortions`).
 * @param eventDays - Alle Anlasstage, aufsteigend (`getEventDateList`). Achse
 *   des Ausgabenverlaufs; ihre Anzahl ist Grundlage für Ø pro Person & Tag und
 *   für den Sollbetrag der «pro Person & Tag»-Budgets.
 * @param today - Stichtag «heute», von der Seite übergeben, damit die
 *   Berechnungen testbar bleiben. Nur der Kalendertag zählt.
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
  handleEditClick: (expenseId: string) => void;
  handleShowMissingReceipts: () => void;
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
 *   eventDays={eventDays}
 *   today={new Date()}
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
                TEXT_EVALUATION_CALCULATION_BASIS(
                  participantCount,
                  eventDays.length,
                ),
              ]}
            />
          </Grid>
          <Grid size={{xs: 12}}>
            <ExpenseHistoryChart
              eventDays={eventDays}
              actualValues={statistics.history.actualValues}
              targetValues={statistics.history.targetValues}
              currency={selectedCurrency}
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
      )}
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

/**
 * Liefert die Beschriftung des Budget-Filters passend zur aktuellen Auswahl.
 *
 * @param selectedBudgets - Aktuell berücksichtigte Budgets.
 * @param totalBudgetCount - Anzahl aller Budgets des Anlasses.
 * @returns "Alle Budgets", der Budgetname bei genau einer Auswahl oder "2 von 3 Budgets".
 */
export const getBudgetFilterLabel = (
  selectedBudgets: BudgetDomain[],
  totalBudgetCount: number,
): string => {
  if (selectedBudgets.length === totalBudgetCount) {
    return TEXT_EVALUATION_BUDGET_FILTER_ALL;
  }
  if (selectedBudgets.length === 1) {
    return selectedBudgets[0].name;
  }
  return TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(
    selectedBudgets.length,
    totalBudgetCount,
  );
};

/**
 * Erzeugt den Hinweistext, was in den Kennzahlen nicht enthalten ist. Ein
 * Satz pro Filter, damit sichtbar bleibt, warum eine Zahl kleiner ist.
 *
 * @param excludedCurrencies - Durch die Währungsauswahl ausgeblendete Währungen.
 * @param excludedBudgetNames - Namen der durch den Budget-Filter ausgeblendeten Budgets.
 * @returns Hinweistext oder null, wenn nichts ausgeblendet ist.
 * @example
 * getStatisticsScopeNote(["EUR"], ["Material"])
 * // «Ausgaben in EUR sind hier nicht enthalten. Nicht berücksichtigte Budgets: Material.»
 */
export const getStatisticsScopeNote = (
  excludedCurrencies: string[],
  excludedBudgetNames: string[],
): string | null => {
  const sentences: string[] = [];
  if (excludedCurrencies.length > 0) {
    sentences.push(TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES(excludedCurrencies));
  }
  if (excludedBudgetNames.length > 0) {
    sentences.push(TEXT_EVALUATION_SCOPE_NOTE_BUDGETS(excludedBudgetNames));
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
};

/**
 * Props für {@link BudgetFilter}.
 *
 * @param budgets - Alle Budgets des Anlasses, in der Reihenfolge der Übersicht.
 * @param deselectedBudgetIds - IDs der abgewählten Budgets (B3). Unbekannte IDs
 *   (gelöschte Budgets) werden ignoriert.
 * @param onToggleBudget - Wählt das angeklickte Budget ab bzw. wieder aus.
 * @param onSelectAllBudgets - Wählt alle Budgets wieder aus (leert die Abwahl).
 */
type BudgetFilterProps = {
  budgets: BudgetDomain[];
  deselectedBudgetIds: string[];
  onToggleBudget: (budgetId: string) => void;
  onSelectAllBudgets: () => void;
};

/**
 * Button mit Dropdown, um die Budgets der Auswertung zu wählen. Die
 * Beschriftung zeigt die aktuelle Auswahl («Alle Budgets», ein Budgetname
 * oder «2 von 4 Budgets»). Das letzte ausgewählte Budget lässt sich nicht
 * abwählen, damit die Auswertung nie ganz leer ist.
 *
 * @param props - Siehe {@link BudgetFilterProps}.
 */
export const BudgetFilter = ({
  budgets,
  deselectedBudgetIds,
  onToggleBudget,
  onSelectAllBudgets,
}: BudgetFilterProps) => {
  const classes = useCustomStyles();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(
    null,
  );

  const selectedBudgets = budgets.filter(
    (budget) => !deselectedBudgetIds.includes(budget.id),
  );
  const isFilterActive = selectedBudgets.length < budgets.length;
  const selectionLabel = getBudgetFilterLabel(selectedBudgets, budgets.length);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ArrowDropDown />}
        onClick={(clickEvent) => setAnchorElement(clickEvent.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorElement)}
        aria-label={TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL(selectionLabel)}
        sx={[
          classes.statisticsFilterButton,
          isFilterActive && classes.statisticsFilterButtonActive,
        ]}
      >
        <Typography component="span" variant="inherit" noWrap>
          {selectionLabel}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorElement}
        open={Boolean(anchorElement)}
        onClose={() => setAnchorElement(null)}
        slotProps={{paper: {sx: classes.statisticsFilterMenuPaper}}}
      >
        <MenuItem onClick={onSelectAllBudgets} disabled={!isFilterActive}>
          <ListItemText>{TEXT_EVALUATION_BUDGET_FILTER_ALL}</ListItemText>
        </MenuItem>
        <Divider />
        {budgets.map((budget) => {
          const BudgetIconComponent = BUDGET_ICON_MAP[budget.icon];
          const isSelected = !deselectedBudgetIds.includes(budget.id);
          const isLastSelected = isSelected && selectedBudgets.length === 1;
          return (
            <MenuItem
              key={budget.id}
              role="menuitemcheckbox"
              aria-checked={isSelected}
              disabled={isLastSelected}
              onClick={() => onToggleBudget(budget.id)}
            >
              <Checkbox
                edge="start"
                checked={isSelected}
                disableRipple
                tabIndex={-1}
              />
              <ListItemIcon>
                <BudgetIconComponent fontSize="small" />
              </ListItemIcon>
              <ListItemText>{budget.name}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
