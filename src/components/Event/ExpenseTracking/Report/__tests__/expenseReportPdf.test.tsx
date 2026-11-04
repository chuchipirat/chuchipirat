/**
 * Unit-Tests für das PDF-Dokument der Abrechnung (expenseReportPdf.tsx,
 * Story 7.2, Layout seit Story 7.5) und seine Belegseiten
 * (expenseReportReceiptPages.tsx, Story 7.3a; PDF-Belege und
 * receiptPageSlots.ts seit Story 7.3b); Zahlungsangaben (Story 7.4, Layout
 * 7.5). Die Bausteine einzeln prüft expenseReportPdfBlocks.test.tsx.
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
      React.createElement("img", {"data-src": props.src}),
    Svg: createComponent("Svg"),
    // gibt `d` aus, damit der Test das Budget-Icon erkennt
    Path: (props: {d: string}) =>
      React.createElement("path", {"data-d": props.d}),
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
import {BUDGET_ICON_PDF_PATHS} from "../../Budget/budgetIconPaths";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {ExpenseReport} from "../expenseReport.class";
import {
  LoadedReceipt,
  ReportMode,
  ReportOptions,
  ReportReceipt,
} from "../expenseReport.types";
import {reportLayoutStyles} from "../../../../../constants/styles/expenseTrackingReportPDF.styles";
import {PaymentDetailsFormValues} from "../../../../User/userPaymentDetails.types";
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
 * @param refundDetailsByPayeeKey - Adresse und IBAN pro Person
 *   (Standard: keine, Kasten zum Ergänzen).
 * @param receiptStartPages - Belegnummer → Startseite (Standard: keine).
 * @returns Das Render-Ergebnis.
 */
const renderReportPdf = (
  overrides: Partial<ReportOptions> = {},
  loadedReceipts: LoadedReceipt[] = [],
  refundDetailsByPayeeKey: Record<string, PaymentDetailsFormValues> = {},
  receiptStartPages = new Map<number, number>(),
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
      refundDetailsByPayeeKey={refundDetailsByPayeeKey}
      receiptStartPages={receiptStartPages}
    />,
  );
};

/**
 * Anzahl `View`s mit genau diesem Style.
 *
 * @param container - Container aus `render`.
 * @param style - Gesuchter Style.
 * @returns Anzahl Treffer.
 */
const countViewsWithStyle = (container: HTMLElement, style: object): number =>
  Array.from(container.querySelectorAll("View")).filter(
    (element) => element.getAttribute("data-style") === JSON.stringify(style),
  ).length;

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
  test("Titel und Anlass, kein Untertitel mit dem Aufbau", () => {
    const {container} = renderReportPdf();

    expect(screen.getByText("Abrechnung")).toBeInTheDocument();
    expect(screen.getByText("Sommerlager 2026")).toBeInTheDocument();
    // «Eine Tabelle» ist ein interner Begriff (Spez. 1)
    expect(container).not.toHaveTextContent("Eine Tabelle");
    expect(container).not.toHaveTextContent("Anna · ");
  });

  test("eine Person: Kennzahlen Ausgaben, Zurückzuerstatten, Budgets", () => {
    const {container} = renderReportPdf();
    const texts = textsOf(container);
    const valueAfter = (label: string) => texts[texts.indexOf(label) + 1];

    // Anna: Migros und Edeka (Küche), Bastelladen (Motto)
    expect(valueAfter("Ausgaben")).toBe("3");
    expect(valueAfter("Zurückzuerstatten")).toBe(amountText(6750, "CHF"));
    expect(valueAfter("Budgets")).toBe("2");
    expect(texts[texts.indexOf("Budgets") + 2]).toBe("Küche, Motto");
    expect(screen.queryByText("Gesamttotal")).not.toBeInTheDocument();
  });

  test("Zeile mit Beleg: Nummer, Datum, Bezeichnung, Betrag, Seitenverweis", () => {
    renderReportPdf({}, [], {}, new Map([[1, 4]]));

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("09.07.2026")).toBeInTheDocument();
    expect(screen.getByText("Migros")).toBeInTheDocument();
    expect(screen.getByText(amountText(4250, "CHF"))).toBeInTheDocument();
    expect(screen.getByText("S. 4")).toBeInTheDocument();
  });

  test("Zeilen ohne Beleg: «–» als Nummer, kein Seitenverweis", () => {
    renderReportPdf({}, [], {}, new Map([[1, 4]]));

    // Bastelladen und Edeka haben keinen Beleg
    expect(screen.getAllByText("–")).toHaveLength(2);
    expect(screen.getAllByText(/^S\. /)).toHaveLength(1);
  });

  test("nur die Ausgaben der gewählten Person", () => {
    renderReportPdf();

    expect(screen.queryByText("Volg")).not.toBeInTheDocument();
    expect(screen.queryByText("Spende Bäckerei")).not.toBeInTheDocument();
  });

  test("Footer: erstellt am, von wem", () => {
    renderReportPdf();

    expect(
      screen.getByText("Erstellt am 01.08.2026, 00:00 von Anna"),
    ).toBeInTheDocument();
    expect(screen.getByText("chuchipirat.ch")).toBeInTheDocument();
  });
});

describe("ExpenseReportPdf: Aufbau A und B", () => {
  test("A: Spalten Nr. bis Beleg mit Budget, Budget pro Zeile, keine Totalzeile", () => {
    const {container} = renderReportPdf({mode: ReportMode.PER_PERSON});
    const texts = textsOf(container);

    const headerStart = texts.indexOf("Nr.");
    expect(texts.slice(headerStart, headerStart + 6)).toEqual([
      "Nr.",
      "Datum",
      "Bezeichnung",
      "Budget",
      "Betrag",
      "Beleg",
    ]);
    expect(screen.getAllByText("Küche")).toHaveLength(2);
    expect(screen.getByText("Motto")).toBeInTheDocument();
    expect(screen.queryByText("Total Anna")).not.toBeInTheDocument();
  });

  test("B: keine Budgetspalte, Balken mit Zwischentotal, am Ende «Total Anna»", () => {
    const {container} = renderReportPdf({
      mode: ReportMode.PER_PERSON_AND_BUDGET,
    });
    const texts = textsOf(container);
    const indexOf = (text: string) => texts.indexOf(text);

    expect(screen.queryByText("Budget")).not.toBeInTheDocument();
    expect(countViewsWithStyle(container, reportLayoutStyles.budgetBar)).toBe(
      2,
    );
    // Küche: Migros (CHF) und Edeka (EUR), Zwischentotal mit « · »
    expect(texts[indexOf("Küche") + 1]).toBe(
      `${amountText(4250, "CHF")} · ${amountText(1100, "EUR")}`,
    );
    expect(indexOf("Küche")).toBeLessThan(indexOf("Migros"));
    expect(indexOf("Migros")).toBeLessThan(indexOf("Motto"));
    expect(indexOf("Motto")).toBeLessThan(indexOf("Bastelladen"));
    expect(indexOf("Bastelladen")).toBeLessThan(indexOf("Total Anna"));
    expect(texts[indexOf("Total Anna") + 1]).toBe(
      `${amountText(6750, "CHF")} · ${amountText(1100, "EUR")}`,
    );
  });

  test("B: Balken mit dem Icon des Budgets", () => {
    const {container} = renderReportPdf({
      mode: ReportMode.PER_PERSON_AND_BUDGET,
    });
    const drawnPaths = Array.from(container.querySelectorAll("path")).map(
      (path) => path.getAttribute("data-d"),
    );

    // beide Budgets im Fixture haben das Küchen-Icon
    expect(
      drawnPaths.filter(
        (path) => path === BUDGET_ICON_PDF_PATHS[BudgetIcon.KITCHEN][0],
      ),
    ).toHaveLength(2);
  });
});

describe("ExpenseReportPdf: Trennlinien", () => {
  test.each([ReportMode.PER_PERSON, ReportMode.PER_PERSON_AND_BUDGET])(
    "%s: letzte Zeile der Karte ohne Trennlinie, die anderen mit",
    (mode) => {
      const {container} = renderReportPdf({mode});

      // Anna hat 3 Ausgaben
      expect(countViewsWithStyle(container, reportLayoutStyles.tableRow)).toBe(
        2,
      );
      expect(
        countViewsWithStyle(container, reportLayoutStyles.tableRowLast),
      ).toBe(1);
    },
  );

  test("Alle Personen: eine letzte Zeile pro Karte", () => {
    const {container} = renderReportPdf({payeeSelection: {kind: "all"}});

    // Anna, Ben, «Ohne Rückerstattung»
    expect(
      countViewsWithStyle(container, reportLayoutStyles.tableRowLast),
    ).toBe(3);
  });
});

describe("ExpenseReportPdf: Kommentare", () => {
  test("ohne Option: kein Kommentar", () => {
    renderReportPdf({includeComments: false});

    expect(screen.queryByText("Zmorge")).not.toBeInTheDocument();
  });

  test("mit Option: Kommentar unter der Bezeichnung", () => {
    const {container} = renderReportPdf({includeComments: true});
    const texts = textsOf(container);

    expect(texts.indexOf("Zmorge")).toBe(texts.indexOf("Migros") + 1);
  });

  test("leerer Kommentar rendert ohne Fehler (kein String ausserhalb von <Text>)", () => {
    // ANNA_CRAFT_SHOP hat comment: ""
    expect(() => renderReportPdf({includeComments: true})).not.toThrow();
  });
});

describe("ExpenseReportPdf: Beträge pro Währung", () => {
  test("Kartenkopf: Personentotal pro Währung untereinander", () => {
    const {container} = renderReportPdf();
    const texts = textsOf(container);
    const nameIndex = texts.indexOf("Anna");

    expect(texts.slice(nameIndex + 1, nameIndex + 3)).toEqual([
      amountText(4250 + 2500, "CHF"),
      amountText(1100, "EUR"),
    ]);
  });
});

describe("ExpenseReportPdf: Alle Personen", () => {
  const renderAllPayees = () =>
    renderReportPdf({payeeSelection: {kind: "all"}});

  test("Personen in Reihenfolge, «Ohne Rückerstattung» zuletzt mit Hinweis", () => {
    const {container} = renderAllPayees();

    const texts = textsOf(container);
    expect(texts.indexOf("Anna")).toBeGreaterThan(-1);
    expect(texts.indexOf("Anna")).toBeLessThan(texts.indexOf("Ben"));
    expect(texts.indexOf("Ben")).toBeLessThan(
      texts.lastIndexOf("Ohne Rückerstattung"),
    );
    expect(
      screen.getByText("Diese Ausgaben werden niemandem zurückerstattet."),
    ).toBeInTheDocument();
  });

  test("drei Kennzahlen vor den Karten", () => {
    const {container} = renderAllPayees();
    const texts = textsOf(container);
    const valueAfter = (label: string) => texts[texts.indexOf(label) + 1];

    // CHF: Gesamt 4250 + 2500 + 1000 + 500, zurückzuerstatten ohne die 500
    expect(valueAfter("Gesamttotal")).toBe(amountText(8250, "CHF"));
    expect(valueAfter("Zurückzuerstatten")).toBe(amountText(7750, "CHF"));
    expect(valueAfter("Ohne Rückerstattung")).toBe(amountText(500, "CHF"));
    expect(texts.indexOf("Gesamttotal")).toBeLessThan(texts.indexOf("Anna"));
  });
});

/* =====================================================================
// Belegseiten (Story 7.3a, Layout 7.5)
// ===================================================================== */

/**
 * Erstellt einen Beleg für den Kopf einer Belegseite.
 *
 * @param receiptNumber - Belegnummer.
 * @param label - Bezeichnung der Ausgabe.
 * @param expenseId - Ausgabe; eine aus dem Fixture liefert Budget und
 *   Person für die Zeile unter der Bezeichnung.
 * @returns Der Beleg.
 */
const makeReceipt = (
  receiptNumber: number,
  label: string,
  expenseId = `expense-${receiptNumber}`,
): ReportReceipt => ({
  receiptNumber,
  expenseId,
  attachmentPath: null,
  date: new Date(2026, 6, 12),
  label,
  amountInCents: 4250,
  currency: "CHF",
});

describe("ExpenseReportPdf: Belegseiten", () => {
  test("ohne Belege keine Belegseite", () => {
    const {container} = renderReportPdf();

    expect(container.querySelectorAll("page")).toHaveLength(1);
  });

  test("Kopf: Nummer, Bezeichnung, «Datum · Budget · Person», Betrag; Footer «Beleg n von N»", () => {
    const {container} = renderReportPdf({}, [
      {
        kind: "image",
        receipt: makeReceipt(1, "Migros", ANNA_MIGROS.id),
        dataUrl: "data:image/jpeg;base64,AAAA",
      },
    ]);
    const receiptPage = container.querySelectorAll("page")[1] as HTMLElement;

    expect(textsOf(receiptPage)).toEqual([
      "1",
      "Migros",
      "12.07.2026 · Küche · Anna",
      amountText(4250, "CHF"),
      "Beleg 1 von 1",
      "",
      "chuchipirat.ch",
    ]);
  });

  test("Bild-Beleg: Bild mit der Data-URL im Feld RECEIPT_CONTENT_BOX", () => {
    const {container} = renderReportPdf({}, [
      {
        kind: "image",
        receipt: makeReceipt(1, "Migros"),
        dataUrl: "data:image/jpeg;base64,AAAA",
      },
    ]);
    const image = container.querySelectorAll("img")[1];

    // das erste Bild ist das Logo im Kopf
    expect(image).toHaveAttribute("data-src", "data:image/jpeg;base64,AAAA");
    expect(image.parentElement).toHaveAttribute(
      "data-style",
      JSON.stringify(reportLayoutStyles.receiptContentBox),
    );
  });

  test("Ausgabe nicht gefunden: Zeile unter der Bezeichnung nur mit Datum", () => {
    renderReportPdf({}, [
      {kind: "missing", receipt: makeReceipt(1, "Unbekannt")},
    ]);

    expect(screen.getByText("12.07.2026")).toBeInTheDocument();
  });

  test("Leerseite und Fehlerseite: Klebefeld mit Text und Hinweis", () => {
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
      screen.getByText("Zu dieser Ausgabe wurde kein Beleg hochgeladen."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Beleg konnte nicht geladen werden"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Bitte ausdrucken und hier aufkleben oder separat einreichen.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Beleg 2 von 2")).toBeInTheDocument();
  });

  test("Belegseiten nach der Tabelle, in der Reihenfolge von loadedReceipts", () => {
    const {container} = renderReportPdf({}, [
      {kind: "missing", receipt: makeReceipt(1, "Bastelladen")},
      {kind: "missing", receipt: makeReceipt(2, "Volg")},
    ]);

    const texts = textsOf(container);
    const firstReceipt = texts.lastIndexOf("Bastelladen");
    const secondReceipt = texts.indexOf("Volg");
    expect(texts.indexOf("Edeka")).toBeGreaterThan(-1);
    expect(firstReceipt).toBeGreaterThan(texts.indexOf("Edeka"));
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
  test("PDF mit 2 Seiten: zwei Belegseiten, «· Seite x von 2» hinter der Bezeichnung", () => {
    const {container} = renderReportPdf({}, [makePdfReceipt(1, 2)]);
    const texts = textsOf(container);

    expect(container.querySelectorAll("page")).toHaveLength(3);
    expect(texts).toContain("Coop · Seite 1 von 2");
    expect(texts).toContain("Coop · Seite 2 von 2");
    // beide Seiten gehören zu Beleg 1
    expect(texts.filter((text) => text === "Beleg 1 von 1")).toHaveLength(2);
  });

  test("einseitiger Beleg: keine Seitenangabe hinter der Bezeichnung", () => {
    const {container} = renderReportPdf({}, [makePdfReceipt(1, 1)]);

    expect(textsOf(container)).toContain("Coop");
    expect(container).not.toHaveTextContent("Seite 1 von 1");
  });

  test("Feld beginnt direkt unter dem festen Kopf (react-pdf und pdf-lib meinen dieselbe Stelle)", () => {
    const {page, receiptHeader} = reportLayoutStyles;

    expect(RECEIPT_CONTENT_BOX.top).toBeCloseTo(
      page.paddingTop + receiptHeader.height + receiptHeader.marginBottom,
    );
    expect(RECEIPT_CONTENT_BOX.left).toBe(page.paddingHorizontal);
  });

  test("leeres Feld an der Stelle aus RECEIPT_CONTENT_BOX, kein Platzhaltertext", () => {
    const {container} = renderReportPdf({}, [makePdfReceipt(1, 1)]);

    const pdfBoxes = Array.from(container.querySelectorAll("view"))
      .map((view) => JSON.parse(view.getAttribute("data-style") ?? "null"))
      // der Footer ist auch absolut, hat aber kein `top`
      .filter((style) => style?.position === "absolute" && "top" in style);
    expect(pdfBoxes).toEqual([{position: "absolute", ...RECEIPT_CONTENT_BOX}]);
    expect(screen.queryByText("Beleg hier aufkleben")).not.toBeInTheDocument();
  });
});

/* =====================================================================
// Zahlungsangaben (Story 7.4, Layout 7.5)
// ===================================================================== */

describe("ExpenseReportPdf: Zahlungsangaben", () => {
  const REFUND_DETAILS: PaymentDetailsFormValues = {
    street: "Bahnhofstrasse 1",
    postalCode: "8001",
    city: "Zürich",
    iban: "CH9300762011623852957",
  };
  const PAYMENT_LINE =
    "Bahnhofstrasse 1, 8001 Zürich · CH93 0076 2011 6238 5295 7";

  /**
   * Anzahl Kästen «Zahlungsangaben bitte von Hand ergänzen».
   *
   * @param container - Container aus `render`.
   * @returns Anzahl Kästen.
   */
  const fillBoxCountOf = (container: HTMLElement) =>
    countViewsWithStyle(container, reportLayoutStyles.fillBox);

  test("vollständig: graue Zeile unter dem Namen, vor der Tabelle, kein Kasten", () => {
    const {container} = renderReportPdf({}, [], {[ANNA.uid]: REFUND_DETAILS});
    const texts = textsOf(container);

    expect(texts.indexOf(PAYMENT_LINE)).toBeGreaterThan(texts.indexOf("Anna"));
    expect(texts.indexOf(PAYMENT_LINE)).toBeLessThan(texts.indexOf("Migros"));
    expect(fillBoxCountOf(container)).toBe(0);
  });

  test("Teilangaben: Kasten, Vorhandenes steht darin (ohne Fehler bei leeren Werten)", () => {
    const {container} = renderReportPdf({}, [], {
      [ANNA.uid]: {...REFUND_DETAILS, street: "", iban: "  "},
    });

    expect(fillBoxCountOf(container)).toBe(1);
    expect(textsOf(container)).toContain("8001 Zürich");
    expect(textsOf(container)).not.toContain(PAYMENT_LINE);
  });

  test("ohne Angaben: Kasten mit Kontoinhaber*in vorbefüllt", () => {
    const {container} = renderReportPdf();
    const texts = textsOf(container);

    expect(fillBoxCountOf(container)).toBe(1);
    expect(texts[texts.indexOf("Kontoinhaber*in") + 1]).toBe("Anna");
  });

  test("«Alle Personen»: Kasten pro Person, nicht bei «Ohne Rückerstattung»", () => {
    const {container} = renderReportPdf({payeeSelection: {kind: "all"}});

    // Anna und Ben
    expect(fillBoxCountOf(container)).toBe(2);
  });

  test("«Alle Personen»: eigene Angaben als Zeile, Kasten nur bei den anderen", () => {
    const {container} = renderReportPdf({payeeSelection: {kind: "all"}}, [], {
      [ANNA.uid]: REFUND_DETAILS,
    });
    const texts = textsOf(container);

    // Annas Zeile steht in Annas Karte, vor Ben
    expect(texts.indexOf(PAYMENT_LINE)).toBeGreaterThan(texts.indexOf("Anna"));
    expect(texts.indexOf(PAYMENT_LINE)).toBeLessThan(texts.indexOf("Ben"));
    expect(fillBoxCountOf(container)).toBe(1);
  });
});
