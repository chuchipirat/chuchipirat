/**
 * Unit-Tests für das PDF-Dokument der Abrechnung (expenseReportPdf.tsx,
 * Story 7.2) und seine Belegseiten (expenseReportReceiptPages.tsx,
 * Story 7.3a; PDF-Belege und receiptPageSlots.ts seit Story 7.3b).
 *
 * Die Daten kommen über `ExpenseReport.build`, damit der Test dieselbe
 * Struktur zeichnet wie die App.
 *
 * @react-pdf/renderer wird gemockt (ESM, Muster DonationReceiptPdf.test.tsx).
 * Zusätzlich wirft der Mock wie das echte react-pdf, wenn ein String
 * direkt in `View`/`Page` landet («Invalid '' string child outside <Text>»).
 * Nur so fällt ein `{comment && …}` mit leerem Kommentar im Test auf.
 */
jest.mock("@react-pdf/renderer", () => {
  const React = jest.requireActual("react");
  /**
   * Komponente, die nur ihre Kinder rendert.
   *
   * @param name - Name des Elements im DOM.
   * @param allowsStringChildren - `false` für Container ausserhalb von `Text`.
   */
  const createComponent = (name: string, allowsStringChildren = true) =>
    React.forwardRef((props: {children?: unknown}, _ref: unknown) => {
      const hasStringChild = React.Children.toArray(props.children).some(
        (child: unknown) => typeof child === "string",
      );
      if (!allowsStringChildren && hasStringChild) {
        throw new Error(`Invalid string child outside <Text> in <${name}>`);
      }
      return React.createElement(name, null, props.children);
    });
  return {
    Document: createComponent("Document", false),
    Page: createComponent("Page", false),
    // gibt den Style aus, damit der Test das Feld der PDF-Belege findet
    View: React.forwardRef(
      (props: {children?: unknown; style?: unknown}, _ref: unknown) => {
        const hasStringChild = React.Children.toArray(props.children).some(
          (child: unknown) => typeof child === "string",
        );
        if (hasStringChild) {
          throw new Error("Invalid string child outside <Text> in <View>");
        }
        return React.createElement(
          "View",
          {"data-style": JSON.stringify(props.style ?? null)},
          props.children,
        );
      },
    ),
    Text: createComponent("Text"),
    // gibt `src` aus, damit der Test die Data-URL des Belegs sieht
    Image: (props: {src: string}) =>
      React.createElement("image", {"data-src": props.src}),
    Svg: createComponent("Svg"),
    Path: createComponent("Path"),
    Font: {
      register: jest.fn(),
      registerEmojiSource: jest.fn(),
    },
    StyleSheet: {
      create: <T extends object>(styles: T): T => styles,
    },
  };
});

jest.mock("@react-pdf/types", () => ({}));

// pdfFontRegistration wird durch den Font-Mock bereits abgedeckt
jest.mock("../../../../Shared/pdfFontRegistration", () => {});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import AuthUser from "../../../../Session/authUser.class";
import {formatAmountFromCents} from "../../../../Shared/utils/currencyUtils";
import {Cook} from "../../../Event/event.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "../../Budget/budget.types";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {ExpenseReport} from "../expenseReport.class";
import {
  LoadedReceipt,
  ReportMode,
  ReportOptions,
  ReportReceipt,
} from "../expenseReport.types";
import {ExpenseReportPdf} from "../expenseReportPdf";
import {RECEIPT_CONTENT_BOX} from "../receiptPageLayout";
import {getReceiptPageSlots} from "../receiptPageSlots";

/* =====================================================================
// Fixture
// ===================================================================== */

/**
 * Erstellt ein Budget mit Standardwerten.
 *
 * @param id - ID des Budgets.
 * @param name - Name des Budgets.
 * @returns Das Budget.
 */
const makeBudget = (id: string, name: string): BudgetDomain => ({
  id,
  eventId: "event-id-001",
  name,
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 100000,
  currency: "CHF",
  icon: BudgetIcon.KITCHEN,
});

const BUDGETS: BudgetDomain[] = [
  makeBudget("budget-kitchen", "Küche"),
  makeBudget("budget-theme", "Motto"),
];

const ANNA: Cook = {
  uid: "user-anna",
  displayName: "Anna",
  motto: "",
  pictureSrc: "",
};
const BEN: Cook = {
  uid: "user-ben",
  displayName: "Ben",
  motto: "",
  pictureSrc: "",
};
const COOKS: Cook[] = [ANNA, BEN];

/**
 * Erstellt eine Ausgabe von Anna mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Ausgabe.
 */
const makeExpense = (overrides: Partial<ExpenseDomain>): ExpenseDomain => ({
  id: "expense-id",
  eventId: "event-id-001",
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 10),
  amountInCents: 1000,
  currency: "CHF",
  label: "Einkauf",
  comment: null,
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: ANNA.uid,
  payeeName: null,
  attachmentPath: null,
  attachmentOriginalFilename: null,
  ...overrides,
});

/** Mit Beleg (→ Nummer 1) und Kommentar. */
const ANNA_MIGROS = makeExpense({
  id: "anna-migros",
  date: new Date(2026, 6, 9),
  label: "Migros",
  amountInCents: 4250,
  comment: "Zmorge",
  attachmentPath: "events/event-id-001/expenses/anna-migros.jpg",
});
/** Ohne Beleg (→ «–») und mit leerem Kommentar (Regression). */
const ANNA_CRAFT_SHOP = makeExpense({
  id: "anna-craft-shop",
  budgetId: "budget-theme",
  date: new Date(2026, 6, 10),
  label: "Bastelladen",
  amountInCents: 2500,
  comment: "",
});
/** Zweite Währung. */
const ANNA_EDEKA_EUR = makeExpense({
  id: "anna-edeka",
  date: new Date(2026, 6, 11),
  label: "Edeka",
  amountInCents: 1100,
  currency: "EUR",
});
const BEN_VOLG = makeExpense({
  id: "ben-volg",
  payeeUserId: BEN.uid,
  date: new Date(2026, 6, 12),
  label: "Volg",
  amountInCents: 1000,
});
const NO_REFUND_BAKERY = makeExpense({
  id: "no-refund-bakery",
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
  label: "Spende Bäckerei",
  amountInCents: 500,
});

const EXPENSES: ExpenseDomain[] = [
  BEN_VOLG,
  NO_REFUND_BAKERY,
  ANNA_EDEKA_EUR,
  ANNA_CRAFT_SHOP,
  ANNA_MIGROS,
];

/** Angemeldete Person für die Fusszeile. */
const buildAuthUser = (): AuthUser => {
  const authUser = new AuthUser();
  authUser.uid = ANNA.uid;
  authUser.publicProfile = {displayName: "Anna", motto: "", pictureSrc: ""};
  return authUser;
};

/**
 * Baut die Abrechnung über `ExpenseReport.build` und rendert das PDF.
 * Standard: Anna, Modus A, ohne Kommentare, ohne Belegseiten.
 *
 * @param overrides - Optionen, die vom Standard abweichen.
 * @param loadedReceipts - Belege des Anhangs.
 * @returns Das Render-Ergebnis.
 */
const renderReportPdf = (
  overrides: Partial<ReportOptions> = {},
  loadedReceipts: LoadedReceipt[] = [],
) => {
  const report = ExpenseReport.build({
    expenses: EXPENSES,
    budgets: BUDGETS,
    cooks: COOKS,
    options: {
      mode: ReportMode.PER_PERSON,
      payeeSelection: {kind: "single", payeeKey: ANNA.uid},
      includeComments: false,
      includeMissingReceiptPages: false,
      ...overrides,
    },
  });
  return render(
    <ExpenseReportPdf
      report={report}
      eventName="Sommerlager 2026"
      loadedReceipts={loadedReceipts}
      authUser={buildAuthUser()}
      generatedAt={new Date(2026, 7, 1)}
    />,
  );
};

/**
 * Formatierter Betrag, wie ihn Testing Library vergleicht: `Intl` setzt
 * nach «CHF» ein geschütztes Leerzeichen, Testing Library normalisiert den
 * Text im DOM zu einem normalen Leerzeichen, den gesuchten Text aber nicht.
 *
 * @param amountInCents - Betrag in Rappen bzw. Cent.
 * @param currency - Währungscode.
 * @returns z.B. «CHF 42.50».
 */
const amountText = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency).replace(/\s/g, " ");

/**
 * Texte aller `<Text>`-Elemente in Dokumentreihenfolge. Leerzeichen wie in
 * {@link amountText} normalisiert, damit Beträge vergleichbar sind.
 *
 * @param container - Container aus `render`.
 * @returns Die Texte.
 */
const textsOf = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("text")).map((element) =>
    (element.textContent ?? "").replace(/\s/g, " "),
  );

/* =====================================================================
// Tests
// ===================================================================== */

describe("ExpenseReportPdf: Kopf und Zeilen", () => {
  test("Titel, Untertitel und Anlass in der Kopfzeile", () => {
    renderReportPdf();

    expect(screen.getByText("Abrechnung")).toBeInTheDocument();
    expect(screen.getByText("Anna · Eine Tabelle")).toBeInTheDocument();
    expect(screen.getByText("Sommerlager 2026")).toBeInTheDocument();
  });

  test("Zeile mit Beleg: Nummer, Datum, Bezeichnung, Betrag", () => {
    renderReportPdf();

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("09.07.2026")).toBeInTheDocument();
    expect(screen.getByText("Migros")).toBeInTheDocument();
    expect(screen.getByText(amountText(4250, "CHF"))).toBeInTheDocument();
  });

  test("Zeilen ohne Beleg zeigen «–»", () => {
    renderReportPdf();

    // Bastelladen und Edeka haben keinen Beleg
    expect(screen.getAllByText("–")).toHaveLength(2);
  });

  test("nur die Ausgaben der gewählten Person", () => {
    renderReportPdf();

    expect(screen.queryByText("Volg")).not.toBeInTheDocument();
    expect(screen.queryByText("Spende Bäckerei")).not.toBeInTheDocument();
  });
});

describe("ExpenseReportPdf: Modus A und B", () => {
  test("Modus A: Spalte «Budget», Budget pro Zeile, kein Budgettotal", () => {
    renderReportPdf({mode: ReportMode.PER_PERSON});

    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getAllByText("Küche")).toHaveLength(2);
    expect(screen.getByText("Motto")).toBeInTheDocument();
    expect(screen.queryByText("Total Küche")).not.toBeInTheDocument();
    expect(screen.getByText("Total Anna")).toBeInTheDocument();
  });

  test("Modus B: keine Spalte «Budget», Budgettitel und -totals, dann Personentotal", () => {
    const {container} = renderReportPdf({
      mode: ReportMode.PER_PERSON_AND_BUDGET,
    });

    expect(screen.queryByText("Budget")).not.toBeInTheDocument();
    const texts = textsOf(container);
    const indexOf = (text: string) => texts.indexOf(text);
    expect(indexOf("Küche")).toBeGreaterThan(-1);
    expect(indexOf("Küche")).toBeLessThan(indexOf("Total Küche"));
    expect(indexOf("Total Küche")).toBeLessThan(indexOf("Motto"));
    expect(indexOf("Motto")).toBeLessThan(indexOf("Total Motto"));
    expect(indexOf("Total Motto")).toBeLessThan(indexOf("Total Anna"));
  });
});

describe("ExpenseReportPdf: Kommentare", () => {
  test("ohne Option: kein Kommentar", () => {
    renderReportPdf({includeComments: false});

    expect(screen.queryByText("Zmorge")).not.toBeInTheDocument();
  });

  test("mit Option: Kommentar unter der Bezeichnung", () => {
    renderReportPdf({includeComments: true});

    expect(screen.getByText("Zmorge")).toBeInTheDocument();
  });

  test("leerer Kommentar rendert ohne Fehler (kein String ausserhalb von <Text>)", () => {
    // ANNA_CRAFT_SHOP hat comment: ""
    expect(() => renderReportPdf({includeComments: true})).not.toThrow();
  });
});

describe("ExpenseReportPdf: Summen", () => {
  test("zwei Währungen: zwei Summenzeilen, Beschriftung nur einmal", () => {
    renderReportPdf();

    expect(screen.getAllByText("Total Anna")).toHaveLength(1);
    expect(
      screen.getByText(amountText(4250 + 2500, "CHF")),
    ).toBeInTheDocument();
    // EUR-Betrag: einmal in der Zeile, einmal in der Summe
    expect(screen.getAllByText(amountText(1100, "EUR"))).toHaveLength(2);
  });

  test("eine Person: kein Gesamttotal", () => {
    renderReportPdf();

    expect(screen.queryByText("Gesamttotal")).not.toBeInTheDocument();
    expect(
      screen.queryByText("davon zurückzuerstatten"),
    ).not.toBeInTheDocument();
  });
});

describe("ExpenseReportPdf: Alle Personen", () => {
  const renderAllPayees = () =>
    renderReportPdf({payeeSelection: {kind: "all"}});

  test("Untertitel «Alle Personen»", () => {
    renderAllPayees();

    expect(
      screen.getByText("Alle Personen · Eine Tabelle"),
    ).toBeInTheDocument();
  });

  test("Personen in Reihenfolge, «Ohne Rückerstattung» zuletzt mit Hinweis", () => {
    const {container} = renderAllPayees();

    const texts = textsOf(container);
    expect(texts.indexOf("Anna")).toBeGreaterThan(-1);
    expect(texts.indexOf("Anna")).toBeLessThan(texts.indexOf("Ben"));
    expect(texts.indexOf("Ben")).toBeLessThan(
      texts.indexOf("Ohne Rückerstattung"),
    );
    expect(
      screen.getByText("Diese Ausgaben werden niemandem zurückerstattet."),
    ).toBeInTheDocument();
  });

  test("Gesamttotal und «davon zurückzuerstatten» am Ende", () => {
    const {container} = renderAllPayees();

    const texts = textsOf(container);
    expect(texts.indexOf("Gesamttotal")).toBeGreaterThan(
      texts.indexOf("Total Ohne Rückerstattung"),
    );
    expect(texts.indexOf("davon zurückzuerstatten")).toBeGreaterThan(
      texts.indexOf("Gesamttotal"),
    );
    // CHF: Gesamt 4250 + 2500 + 1000 + 500, zurückzuerstatten ohne die 500
    expect(screen.getByText(amountText(8250, "CHF"))).toBeInTheDocument();
    expect(screen.getByText(amountText(7750, "CHF"))).toBeInTheDocument();
  });
});

/* =====================================================================
// Belegseiten (Story 7.3a)
// ===================================================================== */

/**
 * Erstellt einen Beleg für die Kopfzeile einer Belegseite.
 *
 * @param receiptNumber - Belegnummer.
 * @param label - Bezeichnung der Ausgabe.
 * @returns Der Beleg.
 */
const makeReceipt = (receiptNumber: number, label: string): ReportReceipt => ({
  receiptNumber,
  expenseId: `expense-${receiptNumber}`,
  attachmentPath: null,
  date: new Date(2026, 6, 12),
  label,
  amountInCents: 4250,
  currency: "CHF",
});

/**
 * Kopfzeile einer Belegseite, wie Testing Library sie vergleicht.
 *
 * @param receiptNumber - Belegnummer.
 * @param label - Bezeichnung der Ausgabe.
 * @returns z.B. «Beleg 3 · 12.07.2026 · Migros · CHF 42.50».
 */
const receiptHeaderText = (receiptNumber: number, label: string): string =>
  `Beleg ${receiptNumber} · 12.07.2026 · ${label} · ${amountText(4250, "CHF")}`;

describe("ExpenseReportPdf: Belegseiten", () => {
  test("ohne Belege keine Belegseite", () => {
    const {container} = renderReportPdf();

    expect(container.querySelectorAll("page")).toHaveLength(1);
  });

  test("Bild-Beleg: Kopfzeile und Bild mit der Data-URL", () => {
    const {container} = renderReportPdf({}, [
      {
        kind: "image",
        receipt: makeReceipt(1, "Migros"),
        dataUrl: "data:image/jpeg;base64,AAAA",
      },
    ]);

    expect(container.querySelectorAll("page")).toHaveLength(2);
    expect(
      screen.getByText(receiptHeaderText(1, "Migros")),
    ).toBeInTheDocument();
    expect(container.querySelector("image")).toHaveAttribute(
      "data-src",
      "data:image/jpeg;base64,AAAA",
    );
  });

  test("Leerseite und Fehlerseite", () => {
    renderReportPdf({}, [
      {kind: "missing", receipt: makeReceipt(1, "Bastelladen")},
      {
        kind: "failed",
        receipt: makeReceipt(2, "Volg"),
        error: new Error("HTTP 404"),
      },
    ]);

    expect(screen.getByText("Beleg hier aufkleben")).toBeInTheDocument();
    expect(
      screen.getByText("Beleg konnte nicht geladen werden"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Bitte ausdrucken und hier aufkleben oder separat einreichen.",
      ),
    ).toBeInTheDocument();
  });

  test("Belegseiten nach der Tabelle, in der Reihenfolge von loadedReceipts", () => {
    const {container} = renderReportPdf({}, [
      {kind: "missing", receipt: makeReceipt(1, "Bastelladen")},
      {kind: "missing", receipt: makeReceipt(2, "Volg")},
    ]);

    const texts = textsOf(container);
    const firstReceipt = texts.indexOf(receiptHeaderText(1, "Bastelladen"));
    const secondReceipt = texts.indexOf(receiptHeaderText(2, "Volg"));
    expect(texts.indexOf("Total Anna")).toBeGreaterThan(-1);
    expect(firstReceipt).toBeGreaterThan(texts.indexOf("Total Anna"));
    expect(secondReceipt).toBeGreaterThan(firstReceipt);
    expect(container.querySelectorAll("page")).toHaveLength(3);
  });
});

/**
 * PDF-Beleg mit der gegebenen Seitenzahl.
 *
 * @param receiptNumber - Belegnummer.
 * @param pageCount - Anzahl Seiten.
 * @returns Der geladene Beleg.
 */
const makePdfReceipt = (
  receiptNumber: number,
  pageCount: number,
): LoadedReceipt => ({
  kind: "pdf",
  receipt: makeReceipt(receiptNumber, "Coop"),
  bytes: new Uint8Array([37, 80, 68, 70]),
  pageCount,
});

describe("getReceiptPageSlots", () => {
  test("PDF mit 3 Seiten: 3 Einträge 1/3, 2/3, 3/3", () => {
    const pdfReceipt = makePdfReceipt(1, 3);

    expect(getReceiptPageSlots([pdfReceipt])).toEqual([
      {loadedReceipt: pdfReceipt, pageNumber: 1, pageCount: 3},
      {loadedReceipt: pdfReceipt, pageNumber: 2, pageCount: 3},
      {loadedReceipt: pdfReceipt, pageNumber: 3, pageCount: 3},
    ]);
  });

  test("Mischung: Reihenfolge der Belege bleibt, nur PDFs vervielfacht", () => {
    const slots = getReceiptPageSlots([
      {kind: "missing", receipt: makeReceipt(1, "Bastelladen")},
      makePdfReceipt(2, 2),
      {kind: "missing", receipt: makeReceipt(3, "Volg")},
    ]);

    expect(
      slots.map(
        (slot) =>
          `${slot.loadedReceipt.receipt.receiptNumber}:${slot.pageNumber}/${slot.pageCount}`,
      ),
    ).toEqual(["1:1/1", "2:1/2", "2:2/2", "3:1/1"]);
  });

  test("ohne Belege: leere Liste", () => {
    expect(getReceiptPageSlots([])).toEqual([]);
  });
});

describe("ExpenseReportPdf: PDF-Belege", () => {
  test("PDF mit 2 Seiten: zwei Belegseiten mit Seitenangabe", () => {
    const {container} = renderReportPdf({}, [makePdfReceipt(1, 2)]);

    expect(container.querySelectorAll("page")).toHaveLength(3);
    expect(
      screen.getByText(`${receiptHeaderText(1, "Coop")} · Seite 1 von 2`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${receiptHeaderText(1, "Coop")} · Seite 2 von 2`),
    ).toBeInTheDocument();
  });

  test("leeres Feld an der Stelle aus RECEIPT_CONTENT_BOX, kein Platzhaltertext", () => {
    const {container} = renderReportPdf({}, [makePdfReceipt(1, 1)]);

    const pdfBoxes = Array.from(container.querySelectorAll("view"))
      .map((view) => JSON.parse(view.getAttribute("data-style") ?? "null"))
      .filter((style) => style?.position === "absolute");
    expect(pdfBoxes).toEqual([{position: "absolute", ...RECEIPT_CONTENT_BOX}]);
    expect(screen.queryByText("Beleg hier aufkleben")).not.toBeInTheDocument();
  });
});
