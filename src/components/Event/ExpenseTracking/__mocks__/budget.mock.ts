import {BudgetDomain, BudgetIcon, BudgetType} from "../budget.types";

export const budget: BudgetDomain = {
  id: "budget-id-001",
  eventId: "event-id-001",
  name: "Küche",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 1000,
  currency: "CHF",
  icon: BudgetIcon.KITCHEN,
};

export const budget2: BudgetDomain = {
  id: "budget-id-002",
  eventId: "event-id-001",
  name: "Motto",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 5000,
  currency: "CHF",
  icon: BudgetIcon.THEME,
};
