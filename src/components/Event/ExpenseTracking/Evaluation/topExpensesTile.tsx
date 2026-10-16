import React from "react";
import {
  Box,
  Card,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import {ExpenseDomain} from "../Expense/expense.types";
import {BudgetDomain} from "../Budget/budget.types";
import {EVALUATION_TOP_EXPENSES as TEXT_EVALUATION_TOP_EXPENSES} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {BUDGET_ICON_MAP} from "../Budget/budgetIcons";

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
export const TopExpensesTile = ({
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
