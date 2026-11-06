import React from "react";
import {Box, Typography} from "@mui/material";

import {useCustomStyles} from "../../../../constants/styles";
import {
  EXPENSE_TRACKING_EVALUATION as TEXT_EXPENSE_TRACKING_EVALUATION,
  EXPENSE_TRACKING_EXPENSES as TEXT_EXPENSE_TRACKING_EXPENSES,
  EXPENSE_TRACKING_OVERVIEW as TEXT_EXPENSE_TRACKING_OVERVIEW,
  EXPENSE_TRACKING_PREVIEW_HINT as TEXT_EXPENSE_TRACKING_PREVIEW_HINT,
  EXPENSE_TRACKING_PREVIEW_TITLE as TEXT_EXPENSE_TRACKING_PREVIEW_TITLE,
} from "../../../../constants/text/expenseTracking";
import {BudgetCardGrid} from "../Budget/budgetCardGrid";
import {Expense} from "../Expense/expense.class";
import {ExpenseList} from "../Expense/expenseList";
import {ExpenseEvaluation} from "../Evaluation/expenseEvaluation";
import {ExpenseTrackingPreviewData} from "./expenseTrackingPreview.data";

/** Ohne Wirkung: In der Vorschau lässt sich nichts anklicken. */
const ignoreClick = () => undefined;

/**
 * `inert` hält Tastatur und Screenreader fern. React 18 kennt das Attribut
 * noch nicht als boolesches Attribut, darum als leerer String.
 */
const INERT_ATTRIBUTE = {inert: ""} as React.HTMLAttributes<HTMLDivElement>;

/**
 * Props für {@link ExpenseTrackingPreview}.
 *
 * @param data - Beispieldaten, siehe `expenseTrackingPreview.data.ts`.
 */
type ExpenseTrackingPreviewProps = {
  data: ExpenseTrackingPreviewData;
};

/**
 * Vorschau der Abrechnung für Anlässe ohne Spende: zeigt mit Beispieldaten,
 * was die Abrechnung bietet. Nur Ansicht, nichts ist anklickbar oder
 * fokussierbar, und es gibt keine Aktionsknöpfe. Titel und Hinweis stehen
 * ausserhalb des gesperrten Bereichs, damit Screenreader sie vorlesen.
 *
 * @param props - Siehe {@link ExpenseTrackingPreviewProps}.
 */
export const ExpenseTrackingPreview = ({data}: ExpenseTrackingPreviewProps) => {
  const classes = useCustomStyles();
  const expenseGroups = Expense.groupByBudget(data.expenses, data.budgets);

  return (
    <Box>
      <Box sx={classes.expenseTrackingPreviewHeader}>
        <Typography variant="h6" component="h2">
          {TEXT_EXPENSE_TRACKING_PREVIEW_TITLE}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
          }}
        >
          {TEXT_EXPENSE_TRACKING_PREVIEW_HINT}
        </Typography>
      </Box>

      <Box
        sx={classes.expenseTrackingPreviewArea}
        data-testid="expense-tracking-preview-area"
        {...INERT_ATTRIBUTE}
      >
        <Typography
          variant="subtitle2"
          sx={{
            color: "text.secondary",
          }}
        >
          {TEXT_EXPENSE_TRACKING_OVERVIEW}
        </Typography>
        <BudgetCardGrid
          budgetsWithProgress={data.budgetsWithProgress}
          highlightedBudgetIds={new Set()}
        />

        <Box sx={classes.expenseTrackingPreviewSection}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.secondary",
            }}
          >
            {TEXT_EXPENSE_TRACKING_EXPENSES}
          </Typography>
          <ExpenseList
            expenseGroups={expenseGroups}
            highlightedExpenseIds={new Set()}
            handleEditClick={ignoreClick}
            handleOpenAttachment={ignoreClick}
          />
        </Box>

        <Box sx={classes.expenseTrackingPreviewSection}>
          <Typography
            variant="subtitle2"
            sx={{
              color: "text.secondary",
            }}
          >
            {TEXT_EXPENSE_TRACKING_EVALUATION}
          </Typography>
          <ExpenseEvaluation
            eventId={data.budgets[0].eventId}
            expenses={data.expenses}
            budgets={data.budgets}
            participantCount={data.participantCount}
            eventDays={data.eventDays}
            today={data.today}
            menuplan={data.menuplan}
            handleEditClick={ignoreClick}
            handleShowMissingReceipts={ignoreClick}
            readOnly
          />
        </Box>
      </Box>
    </Box>
  );
};
