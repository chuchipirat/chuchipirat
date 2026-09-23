import {ExpenseDomain, ExpensePayeeType} from "../expense.types";

export const expense: ExpenseDomain = {
  id: "expense-id-001",
  eventId: "event-id-001",
  budgetId: "budget-id-001",
  expenseDate: new Date(2026, 9, 21),
  amountInCents: 4200,
  currency: "CHF",
  label: "Migros Brunaupark",
  comment: "Vorweekend",
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: "payee-id-001",
  payeeName: null,
  attachmentPath: null,
  attachmentOriginalFilename: null,
};

export const expenseTotalsByBudget = {
  "budget-id-001": {CHF: 4200},
  "budget-id-002": {CHF: 2000, EUR: 3300},
  "budget-id-003": {USD: 50, CHF: 3700, EUR: 1100},
};
