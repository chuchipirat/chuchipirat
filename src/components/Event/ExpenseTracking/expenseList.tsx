import React from "react";

import {
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Typography,
} from "@mui/material";

import {ExpenseDomain, ExpenseGroup} from "./expense.types";

import {Box} from "@mui/system";
import {BUDGET_ICON_MAP} from "./budgetIcons";
import {useCustomStyles} from "../../../constants/styles";
import {formatAmountFromCents} from "../../Shared/utils/currencyUtils";

import {NO_EXPENSES_YET as TEXT_NO_EXPENSES_YET} from "../../../constants/text/expenseTracking";

/**
 * Props für {@link ExpenseList}.
 *
 * @param expenseGroups - Ausgaben gruppiert nach Budget (siehe
 *   `Expense.groupByBudget`), bereits sortiert und summiert — `ExpenseList`
 *   berechnet selbst nichts, nur Darstellung.
 * @param handleEditClick - Callback bei Klick auf eine Zeile, liefert die ID
 *   der angeklickten Ausgabe.
 */
interface ExpenseListProps {
  expenseGroups: ExpenseGroup[];
  handleEditClick: (expenseId: string) => void;
}

/**
 * Liste aller Ausgaben eines Events, gruppiert nach Budget.
 *
 * Zeigt pro Budget einen Gruppenkopf ({@link ExpenseGroupHeader}) mit den
 * Summen je Währung, darunter die einzelnen Ausgaben ({@link ExpenseRow}).
 * Budgets ohne Ausgaben werden nicht angezeigt; hat **kein** Budget
 * Ausgaben, erscheint stattdessen ein Hinweistext.
 *
 * @param props - Siehe {@link ExpenseListProps}.
 */
export const ExpenseList = ({
  expenseGroups,
  handleEditClick,
}: ExpenseListProps) => {
  const classes = useCustomStyles();
  const hasAnyExpense = expenseGroups.some(
    (group) => group.expenses.length > 0,
  );
  return (
    <List data-testid="expense-tracking-expenses-list">
      {!hasAnyExpense ? (
        <Typography sx={classes.noExpensesHint}>
          {TEXT_NO_EXPENSES_YET}
        </Typography>
      ) : (
        expenseGroups.map((group) =>
          group.expenses.length === 0 ? null : (
            <React.Fragment key={"expense_budget_" + group.budget.id}>
              <ExpenseGroupHeader group={group} />
              {group.expenses.map((expense) => (
                <ExpenseRow
                  key={"expenseRow_" + expense.id}
                  expense={expense}
                  handleClick={handleEditClick}
                />
              ))}
            </React.Fragment>
          ),
        )
      )}
    </List>
  );
};

/** Props für {@link ExpenseGroupHeader}. */
type ExpenseGroupHeaderProps = {
  /** Die Gruppe (Budget + zugehörige Ausgaben + Summen je Währung). */
  group: ExpenseGroup;
};

/**
 * Kopf einer Budget-Gruppe in der Ausgaben-Liste: Icon, Name des Budgets und
 * die Summen der Ausgaben dieser Gruppe, je Währung. Bleibt beim Scrollen
 * innerhalb der Gruppe sichtbar (`ListSubheader` ist standardmässig `sticky`).
 *
 * @param props - Siehe {@link ExpenseGroupHeaderProps}.
 */
const ExpenseGroupHeader = ({group}: ExpenseGroupHeaderProps) => {
  const BudgetIconComponent = BUDGET_ICON_MAP[group.budget.icon];
  const classes = useCustomStyles();

  // Alphabetisch nach Währungscode — gleiches Muster wie die
  // Fremdwährungs-Zeilen in Budget.getSpentAmounts, stabile Reihenfolge bei
  // jedem Reload.
  const currencyTotals = Object.entries(group.totalsByCurrency).sort(
    ([currencyA], [currencyB]) => currencyA.localeCompare(currencyB),
  );

  return (
    <ListSubheader
      sx={classes.expenseGroupHeader}
      data-testid={"budget-subheader-" + group.budget.id}
    >
      <Box sx={classes.expenseGroupHeaderName}>
        <BudgetIconComponent fontSize="small" />
        <Typography variant="subtitle1" sx={{fontWeight: "inherit"}}>
          {group.budget.name}
        </Typography>
      </Box>
      <Box sx={classes.expenseGroupHeaderTotals}>
        {currencyTotals.map(([currency, amountInCents]) => (
          <Typography
            key={currency}
            variant="subtitle1"
            sx={{fontWeight: "inherit"}}
          >
            {formatAmountFromCents(amountInCents, currency)}
          </Typography>
        ))}
      </Box>
    </ListSubheader>
  );
};
/** Props für {@link ExpenseRow}. */
type ExpenseRowProps = {
  expense: ExpenseDomain;
  /** Callback bei Klick auf die Zeile, liefert `expense.id`. */
  handleClick: (expenseId: string) => void;
};

/**
 * Eine Zeile der Ausgaben-Liste: Bezeichnung und Betrag als Kopfzeile
 * (`ListItemText.primary`), Datum und Kommentar als Zweitzeile darunter
 * (`ListItemText.secondary`, Kommentar nur wenn vorhanden). Die ganze Zeile
 * ist klickbar (`ListItemButton`) und öffnet den Bearbeiten-Dialog (Paket
 * 2.6 verdrahtet `handleClick`).
 *
 * @param props - Siehe {@link ExpenseRowProps}.
 */
const ExpenseRow = ({expense, handleClick}: ExpenseRowProps) => {
  const classes = useCustomStyles();

  const formattedDate = expense.expenseDate.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const secondaryText = expense.comment
    ? `${formattedDate} · ${expense.comment}`
    : formattedDate;

  return (
    <ListItemButton
      divider
      onClick={() => handleClick(expense.id)}
      data-testid={`expense-${expense.id}`}
    >
      <ListItemText
        primary={
          <Box sx={classes.expenseRowPrimary}>
            <Typography component="span" noWrap>
              {expense.label}
            </Typography>
            <Typography component="span" sx={classes.expenseRowAmount}>
              {formatAmountFromCents(expense.amountInCents, expense.currency)}
            </Typography>
          </Box>
        }
        secondary={secondaryText}
      />
    </ListItemButton>
  );
};
