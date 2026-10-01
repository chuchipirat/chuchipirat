import {PayeeBalanceAccordion} from "../payeeBalanceAccordion";

import {
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import {expense, expenseChf} from "../__mocks__/expense.mock";
import {ExpenseDomain, ExpensePayeeType} from "../expense.types";
import {Cook} from "../../Event/event.class";
import {cook1, cook2} from "../../Event/__mocks__/event.mock";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";

import {
  FORMER_EVENT_COOK as TEXT_FORMER_EVENT_COOK,
  SHOW_EXPENSES as TEXT_SHOW_EXPENSES,
} from "../../../../constants/text";

const cooksMock: Cook[] = [{...cook1}, {...cook2}];
const normalizer = getDefaultNormalizer();

describe("PayeeAccordion, Standard Funktionalität", () => {
  test("Keine Ausgaben = kein Accordion", () => {
    render(<PayeeBalanceAccordion expenses={[]} cooks={[]} />);

    expect(
      screen.queryByTestId("payee-balance-accordion"),
    ).not.toBeInTheDocument();
  });
  test("Namen und Betrag sind sichtbar im Header", () => {
    const expenseMock: ExpenseDomain[] = [
      {
        ...expense,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expenseChf,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expense,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-02",
      },
    ];

    render(<PayeeBalanceAccordion expenses={expenseMock} cooks={cooksMock} />);

    const headerCook1 = screen.getByTestId(
      "accordion-summary-row-Röstizüngli Röbi",
    );
    const headerCook2 = screen.getByTestId(
      "accordion-summary-row-Fondueli Fritz",
    );

    expect(
      within(headerCook1).getByText("Röstizüngli Röbi"),
    ).toBeInTheDocument();
    expect(
      within(headerCook1).getByText(
        normalizer(formatAmountFromCents(5300, "CHF")),
      ),
    ).toBeInTheDocument();
    // Details standardmässig ausgebeldent
    expect(
      screen.queryByTestId("accordion-detail-row-Röstizüngli Röbi"),
    ).not.toBeVisible();

    expect(within(headerCook2).getByText("Fondueli Fritz")).toBeInTheDocument();
    expect(
      within(headerCook2).getByText(
        normalizer(formatAmountFromCents(4200, "CHF")),
      ),
    ).toBeInTheDocument();
  });
  test("Köche und NEW_PERSON, Ehemalige Köche werden mit Displayname in richtiger Reihenfolge angezeigt", () => {
    const expenseMock: ExpenseDomain[] = [
      {
        ...expense,
        id: "expense-id-001",
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expenseChf,
        id: "expense-id-002",
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expense,
        id: "expense-id-003",
        payeeType: ExpensePayeeType.NEW_PERSON,
        payeeUserId: null,
        payeeName: "Andreas Apero",
      },
      {
        ...expense,
        id: "expense-id-004",
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-NOT-A-EVENT-COOK",
      },
    ];

    render(<PayeeBalanceAccordion expenses={expenseMock} cooks={cooksMock} />);

    const headerCook1 = screen.getByTestId(
      "accordion-summary-row-Röstizüngli Röbi",
    );
    const headerCook2 = screen.getByTestId(
      "accordion-summary-row-Andreas Apero",
    );
    const headerNoCook = screen.getByTestId(
      `accordion-summary-row-${TEXT_FORMER_EVENT_COOK}`,
    );

    expect(
      within(headerCook1).getByText("Röstizüngli Röbi"),
    ).toBeInTheDocument();

    expect(within(headerCook2).getByText("Andreas Apero")).toBeInTheDocument();

    expect(
      within(headerNoCook).getByText(TEXT_FORMER_EVENT_COOK),
    ).toBeInTheDocument();

    // Regex `/^expense-/` würde auch den Listen-Container
    // ("accordion-summary-row-") treffen — genauer eingrenzen.
    const rows = screen.getAllByTestId(/^accordion-summary-row-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      `accordion-summary-row-Andreas Apero`,
      `accordion-summary-row-${TEXT_FORMER_EVENT_COOK}`,
      `accordion-summary-row-Röstizüngli Röbi`,
    ]);
  });
  test("unabhänige Personen Accordion, eine aufklappen ändert die andere Person nicht", () => {
    const expenseMock: ExpenseDomain[] = [
      {
        ...expense,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expenseChf,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-01",
      },
      {
        ...expense,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "user-uid-02",
      },
    ];

    render(<PayeeBalanceAccordion expenses={expenseMock} cooks={cooksMock} />);

    expect(
      screen.queryByTestId("accordion-detail-row-Röstizüngli Röbi"),
    ).not.toBeVisible();
    expect(
      screen.queryByTestId("accordion-detail-row-Fondueli Fritz"),
    ).not.toBeVisible();

    const accordionRow1 = screen.getByTestId("accordion-Röstizüngli Röbi");

    fireEvent.click(
      within(accordionRow1).getByRole("button", {name: TEXT_SHOW_EXPENSES}),
    );
    expect(
      screen.queryByTestId("accordion-detail-row-Röstizüngli Röbi"),
    ).toBeVisible();
    expect(
      screen.queryByTestId("accordion-detail-row-Fondueli Fritz"),
    ).not.toBeVisible();
  });
});
