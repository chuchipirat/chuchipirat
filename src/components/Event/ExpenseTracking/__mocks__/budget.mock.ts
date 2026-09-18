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
