/**
 * Beispieldaten für die Vorschau der Abrechnung ohne Spende. Nur im Code,
 * nie in der Datenbank; Namen sind frei erfunden.
 */
import {createEmptyMenuplan} from "../../Menuplan/menuplanService";
import {MenuplanData} from "../../Menuplan/menuplan.types";
import {parseLocalDate} from "../../../../utils/dateUtils";
import {
  BudgetDomain,
  BudgetIcon,
  BudgetType,
  BudgetWithProgress,
} from "../Budget/budget.types";
import {ExpenseDomain, ExpensePayeeType} from "../Expense/expense.types";

/**
 * Daten der Vorschau.
 *
 * @param budgets - Budgets des Beispielanlasses.
 * @param budgetsWithProgress - Dieselben Budgets mit Fortschritt.
 * @param expenses - Ausgaben des Beispielanlasses.
 * @param participantCount - Teilnehmende, für die Kennzahlen.
 * @param eventDays - Tage des Beispielanlasses.
 * @param today - Fester Stichtag, damit die Vorschau jeden Tag gleich aussieht.
 * @param menuplan - Leerer Menüplan: ohne ihn fehlt die Kachel «Ø pro Mahlzeit».
 */
export type ExpenseTrackingPreviewData = {
  budgets: BudgetDomain[];
  budgetsWithProgress: BudgetWithProgress[];
  expenses: ExpenseDomain[];
  participantCount: number;
  eventDays: Date[];
  today: Date;
  menuplan: MenuplanData;
};

const EVENT_ID = "expense-tracking-preview";

const GROCERIES_BUDGET: BudgetDomain = {
  id: "preview-budget-groceries",
  eventId: EVENT_ID,
  name: "Lebensmittel",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 50000,
  currency: "CHF",
  icon: BudgetIcon.GROCERIES,
};

const THEME_BUDGET: BudgetDomain = {
  id: "preview-budget-theme",
  eventId: EVENT_ID,
  name: "Motto",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 30000,
  currency: "CHF",
  icon: BudgetIcon.THEME,
};

/**
 * Baut eine Beispielausgabe mit Beleg, bezahlt von einer erfundenen Person.
 *
 * @param fields - Abweichende Felder.
 * @returns Die Ausgabe.
 */
const createPreviewExpense = (
  fields: Pick<
    ExpenseDomain,
    "id" | "budgetId" | "date" | "amountInCents" | "label" | "payeeName"
  >,
): ExpenseDomain => ({
  eventId: EVENT_ID,
  currency: "CHF",
  comment: null,
  payeeType: ExpensePayeeType.NEW_PERSON,
  payeeUserId: null,
  // jede Ausgabe mit Beleg, sonst erschienen Warnungen zu fehlenden Belegen
  attachmentPath: `${EVENT_ID}/expenses/${fields.id}.jpg`,
  attachmentOriginalFilename: null,
  ...fields,
});

const EXPENSES: ExpenseDomain[] = [
  createPreviewExpense({
    id: "preview-expense-1",
    budgetId: GROCERIES_BUDGET.id,
    date: parseLocalDate("2026-07-06"),
    amountInCents: 26000,
    label: "Grosseinkauf für die ersten Tage",
    payeeName: "Lena Beispiel",
  }),
  createPreviewExpense({
    id: "preview-expense-2",
    budgetId: GROCERIES_BUDGET.id,
    date: parseLocalDate("2026-07-09"),
    amountInCents: 20000,
    label: "Gemüse und Brot",
    payeeName: "Noah Muster",
  }),
  createPreviewExpense({
    id: "preview-expense-3",
    budgetId: THEME_BUDGET.id,
    date: parseLocalDate("2026-07-07"),
    amountInCents: 15000,
    label: "Verkleidung und Deko fürs Motto",
    payeeName: "Lena Beispiel",
  }),
];

/**
 * Fortschritt eines Budgets aus den Beispielausgaben, ohne Hochrechnung.
 *
 * @param budget - Das Budget.
 * @returns Budget mit Fortschritt.
 */
const withProgress = (budget: BudgetDomain): BudgetWithProgress => {
  const spentAmountInCents = EXPENSES.filter(
    (expense) => expense.budgetId === budget.id,
  ).reduce((sum, expense) => sum + expense.amountInCents, 0);
  const targetAmountInCents = budget.amountInCents ?? 0;
  return {
    budget,
    targetAmountInCents,
    spentAmountInCents,
    otherCurrenciesSpent: [],
    percentage: Math.round((spentAmountInCents / targetAmountInCents) * 100),
    projection: null,
  };
};

/** Beispielanlass: sechs Tage im Juli 2026, angeschaut am Tag danach. */
export const EXPENSE_TRACKING_PREVIEW_DATA: ExpenseTrackingPreviewData = {
  budgets: [GROCERIES_BUDGET, THEME_BUDGET],
  budgetsWithProgress: [
    withProgress(GROCERIES_BUDGET),
    withProgress(THEME_BUDGET),
  ],
  expenses: EXPENSES,
  participantCount: 24,
  eventDays: [6, 7, 8, 9, 10, 11].map((day) =>
    parseLocalDate(`2026-07-${String(day).padStart(2, "0")}`),
  ),
  today: parseLocalDate("2026-07-12"),
  menuplan: createEmptyMenuplan(),
};
