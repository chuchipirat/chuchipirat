import React from "react";
import {Divider} from "@mui/material";

import {useCustomStyles} from "../../../constants/styles";

import {Cook} from "../Event/event.class";
import {BudgetWithProgress} from "./Budget/budget.types";
import {BudgetCardGrid} from "./Budget/budgetCardGrid";
import {ExpenseDomain} from "./Expense/expense.types";
import {PayeeBalanceAccordion} from "./Expense/payeeBalanceAccordion";

/**
 * Props für {@link ExpenseOverview}.
 *
 * @param budgetsWithProgress - Budgets mit Fortschritt.
 * @param highlightedBudgetIds - Budgets, deren Karte kurz aufleuchtet.
 * @param expenses - Alle Ausgaben des Anlasses.
 * @param cooks - Köch:innen des Anlasses, für die Beträge pro Person.
 * @param handleEditBudgetClick - Öffnet den Dialog des angeklickten Budgets.
 * @param handleAddBudgetClick - Öffnet den Dialog für ein neues Budget.
 */
type ExpenseOverviewProps = {
  budgetsWithProgress: BudgetWithProgress[];
  highlightedBudgetIds: Set<string>;
  expenses: ExpenseDomain[];
  cooks: Cook[];
  handleEditBudgetClick: (budgetId: string) => void;
  handleAddBudgetClick: () => void;
};

/**
 * Ansicht «Übersicht» der Abrechnung: Budget-Karten und Beträge pro Person.
 *
 * @param props - Siehe {@link ExpenseOverviewProps}.
 */
export const ExpenseOverview = ({
  budgetsWithProgress,
  highlightedBudgetIds,
  expenses,
  cooks,
  handleEditBudgetClick,
  handleAddBudgetClick,
}: ExpenseOverviewProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      <BudgetCardGrid
        budgetsWithProgress={budgetsWithProgress}
        highlightedBudgetIds={highlightedBudgetIds}
        handleEditClick={handleEditBudgetClick}
        handleAddClick={handleAddBudgetClick}
      />
      {expenses.length > 0 && <Divider sx={classes.expenseOverviewDivider} />}
      <PayeeBalanceAccordion expenses={expenses} cooks={cooks} />
    </React.Fragment>
  );
};
