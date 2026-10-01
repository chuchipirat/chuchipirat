import React from "react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  List,
  ListItem,
  ListItemText,
  Typography,
} from "@mui/material";

import {Expense} from "./expense.class";
import {ExpenseDomain, ExpensePayeeType} from "./expense.types";
import {Cook} from "../Event/event.class";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  FORMER_EVENT_COOK as TEXT_FORMER_EVENT_COOK,
  OPEN_AMOUNTS_PER_PERSON as TEXT_OPEN_AMOUNTS_PER_PERSON,
  SHOW_EXPENSES as TEXT_SHOW_EXPENSES,
} from "../../../constants/text";
import {Box} from "@mui/system";
import {useCustomStyles} from "../../../constants/styles";
import {formatAmountFromCents} from "../../Shared/utils/currencyUtils";

/**
 * Props für {@link PayeeBalanceAccordion}.
 *
 * @param expenses - Alle Ausgaben des Anlasses (die Aggregation nach Person
 *   übernimmt die Komponente selbst über `Expense.sumByPayee`).
 * @param cooks - Team des Anlasses, zur Auflösung des Anzeigenamens bei
 *   `existing_user`-Einträgen.
 */
type PayeeBalanceAccordionProps = {
  expenses: ExpenseDomain[];
  cooks: Cook[];
};

/**
 * Zeigt für jede Person mit zahlender Instanz (ausser "keine Rückerstattung
 * nötig") eine eigene, aufklappbare Karte: Name und Summe je Währung sind
 * immer sichtbar, die einzelnen Ausgaben erscheinen erst beim Aufklappen.
 * Rendert nichts, wenn keine Ausgabe eine zahlende Instanz hat.
 *
 * @param props - Siehe {@link PayeeBalanceAccordionProps}.
 */
export const PayeeBalanceAccordion = ({
  expenses,
  cooks,
}: PayeeBalanceAccordionProps) => {
  const classes = useCustomStyles();
  const balances = Expense.sumByPayee(expenses);

  if (balances.length === 0) return null; // Leer: Abschnitt ausblenden

  const rows = balances
    .map((balance) => ({
      ...balance,
      displayName:
        balance.payeeType === ExpensePayeeType.EXISTING_USER
          ? (cooks.find((cook) => cook.uid === balance.payeeUserId)
              ?.displayName ?? TEXT_FORMER_EVENT_COOK)
          : (balance.payeeName ?? ""),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));

  const formattedDate = (expense: ExpenseDomain) => {
    return expense.date.toLocaleString("de-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const secondaryText = (expense: ExpenseDomain) => {
    return expense.comment
      ? `${formattedDate(expense)} · ${expense.comment}`
      : formattedDate(expense);
  };

  return (
    <Box sx={{mt: 2}} data-testid="payee-balance-accordion">
      <Typography variant="subtitle2" sx={{mb: 1}}>
        {TEXT_OPEN_AMOUNTS_PER_PERSON}
      </Typography>
      {rows.map((row) => (
        <Accordion
          key={`${row.payeeType}_${row.payeeUserId ?? row.payeeName}`}
          variant="outlined"
          data-testid={`accordion-${row.displayName}`}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            data-testid={`accordion-summary-row-${row.displayName}`}
            aria-label={TEXT_SHOW_EXPENSES}
          >
            <Box sx={classes.payeeBalanceSummary}>
              <Typography>{row.displayName}</Typography>
              <Box sx={classes.expenseGroupHeaderTotals}>
                {Object.entries(row.totalsByCurrency)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([currency, amountInCents]) => (
                    <Typography key={currency} variant="body2">
                      {formatAmountFromCents(amountInCents, currency)}
                    </Typography>
                  ))}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails
            data-testid={`accordion-detail-row-${row.displayName}`}
          >
            <List dense>
              {row.expenses.map((expense) => (
                <ListItem divider key={expense.id}>
                  <ListItemText
                    primary={
                      <Box sx={classes.expenseRowPrimary}>
                        <Typography component="span" noWrap>
                          {expense.label}
                        </Typography>
                        <Typography
                          component="span"
                          sx={classes.expenseRowAmount}
                        >
                          {formatAmountFromCents(
                            expense.amountInCents,
                            expense.currency,
                          )}
                        </Typography>
                      </Box>
                    }
                    secondary={secondaryText(expense)}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
