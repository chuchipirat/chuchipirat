/**
 * Unit-Tests für die Bausteine des neuen PDF-Layouts (Story 7.5): Kopf mit
 * Kennzahlen (expenseReportPdfHeader.tsx), Footer
 * (expenseReportPdfFooter.tsx) und Zahlungsangaben
 * (expenseReportPaymentDetails.tsx).
 *
 * @react-pdf/renderer wird gemockt wie in expenseReportPdf.test.tsx: Der
 * Mock wirft wie das echte react-pdf bei einem String ausserhalb von
 * `<Text>`. Zusätzlich ruft `Text` eine `render`-Funktion mit Seite 2 von
 * 8 auf, damit der Footer prüfbar ist.
 */
jest.mock("@react-pdf/renderer", () => {
  const React = jest.requireActual("react");
  /**
   * Wirft wie react-pdf, wenn ein String direkt in einem Container landet.
   *
   * @param name - Name des Elements.
   * @param children - Kinder des Elements.
   */
  const assertNoStringChild = (name: string, children: unknown) => {
    if (
      React.Children.toArray(children).some(
        (child: unknown) => typeof child === "string",
      )
    ) {
      throw new Error(`Invalid string child outside <Text> in <${name}>`);
    }
  };
  return {
    View: (props: {children?: unknown; style?: unknown; wrap?: boolean}) => {
      assertNoStringChild("View", props.children);
      return React.createElement(
        "View",
        {
          "data-style": JSON.stringify(props.style ?? null),
          "data-wrap": String(props.wrap ?? true),
        },
        props.children,
      );
    },
    Text: (props: {
      children?: unknown;
      render?: (pageProps: {pageNumber: number; totalPages: number}) => string;
    }) =>
      React.createElement(
        "text",
        null,
        props.render
          ? props.render({pageNumber: 2, totalPages: 8})
          : props.children,
      ),
    Image: (props: {src: string}) =>
      React.createElement("img", {"data-src": props.src}),
    Svg: (props: {children?: unknown}) => {
      assertNoStringChild("Svg", props.children);
      return React.createElement("svg", null, props.children);
    },
    Path: (props: {d: string}) =>
      React.createElement("path", {"data-d": props.d}),
    StyleSheet: {
      create: <T extends object>(styles: T): T => styles,
    },
  };
});

jest.mock("@react-pdf/types", () => ({}));

import React from "react";
import {render} from "@testing-library/react";
import "@testing-library/jest-dom";

import {reportLayoutStyles} from "../../../../../constants/styles/expenseTrackingReportPDF.styles";
import {ReportFooter} from "../expenseReportPdfFooter";
import {ReportHeader} from "../expenseReportPdfHeader";
import {ReportKpi} from "../expenseReportPdfHelpers";
import {PaymentDetailsBlock} from "../expenseReportPaymentDetails";

/* =====================================================================
// Hilfen
// ===================================================================== */

/**
 * Texte aller `<Text>`-Elemente in Dokumentreihenfolge; geschützte
 * Leerzeichen aus `Intl` werden zu normalen.
 *
 * @param container - Container aus `render`.
 * @returns Die Texte.
 */
const textsOf = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("text")).map((element) =>
    (element.textContent ?? "").replace(/\s/g, " "),
  );

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

const KPIS: ReportKpi[] = [
  {
    key: "grandTotal",
    label: "Gesamttotal",
    values: ["CHF 636.00", "EUR 27.61"],
    detail: null,
    isHighlighted: false,
  },
  {
    key: "toRefund",
    label: "Zurückzuerstatten",
    values: ["CHF 436.00"],
    detail: null,
    isHighlighted: true,
  },
  {
    key: "noRefund",
    label: "Ohne Rückerstattung",
    values: ["–"],
    detail: null,
    isHighlighted: false,
  },
];

const COMPLETE_DETAILS = {
  street: "Beispielstrasse 12",
  postalCode: "8000",
  city: "Zürich",
  iban: "CH9300762011623852957",
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("ReportHeader", () => {
  test("Logo, Titel, Anlass und Kennzahlen, Werte untereinander", () => {
    const {container} = render(
      <ReportHeader eventName="Sommerlager 2026" kpis={KPIS} />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "data-src",
      "/logo512.png",
    );
    expect(textsOf(container)).toEqual([
      "chuchipirat",
      "Abrechnung",
      "Sommerlager 2026",
      "Gesamttotal",
      "CHF 636.00",
      "EUR 27.61",
      "Zurückzuerstatten",
      "CHF 436.00",
      "Ohne Rückerstattung",
      "–",
    ]);
  });

  test("Detailzeile klein unter dem Wert", () => {
    const {container} = render(
      <ReportHeader
        eventName="Lager"
        kpis={[
          {
            key: "budgetCount",
            label: "Budgets",
            values: ["2"],
            detail: "Küche, Motto",
            isHighlighted: false,
          },
        ]}
      />,
    );
    const texts = textsOf(container);

    expect(texts.slice(-3)).toEqual(["Budgets", "2", "Küche, Motto"]);
  });

  test("nur «Zurückzuerstatten» ist Teal hinterlegt", () => {
    const {container} = render(<ReportHeader eventName="Lager" kpis={KPIS} />);
    const highlightedTiles = Array.from(
      container.querySelectorAll("View"),
    ).filter((element) =>
      (element.getAttribute("data-style") ?? "").includes(
        JSON.stringify(reportLayoutStyles.kpiTileHighlighted),
      ),
    );

    expect(highlightedTiles).toHaveLength(1);
    expect(highlightedTiles[0]).toHaveTextContent("Zurückzuerstatten");
  });

  test("kein Untertitel mit dem Aufbau («Eine Tabelle»)", () => {
    const {container} = render(<ReportHeader eventName="Lager" kpis={KPIS} />);

    expect(container).not.toHaveTextContent("Eine Tabelle");
    expect(container).not.toHaveTextContent("Pro Budget");
  });
});

describe("ReportFooter", () => {
  test("links der Text, Mitte «Seite x von y», rechts chuchipirat.ch", () => {
    const {container} = render(
      <ReportFooter leftText="Erstellt am 27.10.2026, 18:21 von Gio" />,
    );

    expect(textsOf(container)).toEqual([
      "Erstellt am 27.10.2026, 18:21 von Gio",
      "Seite 2 von 8",
      "chuchipirat.ch",
    ]);
  });
});

describe("PaymentDetailsBlock", () => {
  test("vollständig: eine graue Zeile, kein Kasten", () => {
    const {container} = render(
      <PaymentDetailsBlock accountHolder="Gio" details={COMPLETE_DETAILS} />,
    );

    expect(textsOf(container)).toEqual([
      "Beispielstrasse 12, 8000 Zürich · CH93 0076 2011 6238 5295 7",
    ]);
    expect(countViewsWithStyle(container, reportLayoutStyles.ibanBox)).toBe(0);
  });

  test("ohne Angaben: Kasten mit Name vorbefüllt, Linien und 21 leere Kästchen", () => {
    const {container} = render(
      <PaymentDetailsBlock accountHolder="No Cook" details={null} />,
    );

    expect(textsOf(container)).toEqual([
      "Kontoinhaber*in",
      "No Cook",
      "Strasse",
      "PLZ / Ort",
      "IBAN",
    ]);
    expect(countViewsWithStyle(container, reportLayoutStyles.fillLine)).toBe(3);
    expect(countViewsWithStyle(container, reportLayoutStyles.ibanBox)).toBe(21);
    expect(countViewsWithStyle(container, reportLayoutStyles.ibanGroup)).toBe(
      6,
    );
  });

  test("Kasten bricht nicht über zwei Seiten", () => {
    const {container} = render(
      <PaymentDetailsBlock accountHolder="No Cook" details={null} />,
    );
    const fillBox = Array.from(container.querySelectorAll("View")).find(
      (element) =>
        element.getAttribute("data-style") ===
        JSON.stringify(reportLayoutStyles.fillBox),
    );

    expect(fillBox).toHaveAttribute("data-wrap", "false");
  });

  test("Teilangaben: Vorhandenes steht auf der Linie, IBAN in den Kästchen", () => {
    const {container} = render(
      <PaymentDetailsBlock
        accountHolder="Anna"
        details={{...COMPLETE_DETAILS, street: "", city: " "}}
      />,
    );
    const texts = textsOf(container);

    expect(texts).toContain("8000");
    expect(texts).not.toContain("Beispielstrasse 12");
    // 21 Zeichen, eines pro Kästchen
    expect(texts.slice(-21).join("")).toBe("CH9300762011623852957");
  });

  test("ausländische IBAN: als Text auf der Linie statt Kästchen", () => {
    const {container} = render(
      <PaymentDetailsBlock
        accountHolder="Anna"
        details={{
          ...COMPLETE_DETAILS,
          street: "",
          iban: "de89 3704 0044 0532 0130 00",
        }}
      />,
    );

    expect(textsOf(container)).toContain("DE89370400440532013000");
    expect(countViewsWithStyle(container, reportLayoutStyles.ibanBox)).toBe(0);
  });
});
