/**
 * Unit-Tests für DonationReceiptPdf.tsx.
 *
 * Getestet werden:
 * - Smoke-Test: Rendering mit vollständigen Feldern
 * - Regressionstest: Spende ohne Anlass (eventName = "") und ohne
 *   Quittungsnummer (receiptNumber = null) darf keinen leeren String
 *   als Kind ausserhalb von <Text> rendern ("Invalid '' string child
 *   outside <Text> component" — trat auf, weil `donation.eventName && (...)`
 *   bei leerem String den String selbst statt `null`/`false` zurückgibt).
 *
 * @react-pdf/renderer wird gemockt, da die ESM-Module nicht von Jest
 * transformiert werden (gleiches Muster wie recipePdf.test.tsx).
 */

jest.mock("@react-pdf/renderer", () => {
  const React = jest.requireActual("react");
  const createComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
      React.createElement(name, null, props.children)
    );
  return {
    Document: createComponent("Document"),
    Page: createComponent("Page"),
    View: createComponent("View"),
    Text: createComponent("Text"),
    Image: createComponent("Image"),
    Svg: createComponent("Svg"),
    Path: createComponent("Path"),
    Font: {
      register: jest.fn(),
      registerEmojiSource: jest.fn(),
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T): T => styles,
    },
  };
});

jest.mock("@react-pdf/types", () => ({}));

// pdfFontRegistration wird durch den Font-Mock bereits abgedeckt
jest.mock("../../Shared/pdfFontRegistration", () => {});

import React from "react";
import {render} from "@testing-library/react";

import {DonationReceiptPdf} from "../DonationReceiptPdf";
import {DonationDomain, DonationStatus} from "../donation.types";
import AuthUser from "../../Session/authUser.class";

/* ── Hilfsfunktionen ─────────────────────────────────────────────── */

/** Erzeugt einen minimalen AuthUser. */
function buildAuthUser(): AuthUser {
  const user = new AuthUser();
  user.uid = "user-1";
  user.publicProfile = {
    displayName: "Max Muster",
    motto: "",
    pictureSrc: "",
  };
  return user;
}

/** Erzeugt eine minimale, vollständige Spende. Felder überschreibbar. */
function buildDonation(overrides: Partial<DonationDomain> = {}): DonationDomain {
  return {
    id: "donation-1",
    eventId: null,
    paymentGatewayId: "payrexx",
    paymentReferenceId: "donation-1",
    paymentTransactionId: "txn-1",
    amountInCents: 2000,
    currency: "CHF",
    status: DonationStatus.confirmed,
    paymentMethod: "twint",
    paidAt: new Date("2026-05-01T10:00:00Z"),
    donorUid: "user-1",
    donorMessage: null,
    receiptNumber: "2026-0001",
    receiptSentAt: null,
    createdAt: new Date("2026-05-01T10:00:00Z"),
    donorDisplayName: "Max Muster",
    eventName: "Sommerlager 2026",
    ...overrides,
  };
}

/* ── Tests ────────────────────────────────────────────────────────── */

describe("DonationReceiptPdf", () => {
  test("Rendert ohne Fehler mit vollständigen Feldern (Anlass + Quittungsnummer)", () => {
    const {queryByText} = render(
      <DonationReceiptPdf donation={buildDonation()} authUser={buildAuthUser()} />,
    );

    expect(queryByText("Sommerlager 2026")).not.toBeNull();
    expect(queryByText("2026-0001")).not.toBeNull();
  });

  test("Rendert ohne Fehler bei allgemeiner Spende ohne Anlass und ohne Quittungsnummer", () => {
    // Reproduziert exakt den produktiven Fall: eventName kommt aus der DB-View
    // via `row.event_name ?? ""` — bei einer nicht Event-gebundenen Spende
    // ist das ein leerer String, kein null/undefined.
    const donation = buildDonation({eventName: "", receiptNumber: null});

    let queryByText: (text: string) => HTMLElement | null;
    expect(() => {
      ({queryByText} = render(
        <DonationReceiptPdf donation={donation} authUser={buildAuthUser()} />,
      ));
    }).not.toThrow();

    expect(queryByText!("Anlass")).toBeNull();
  });
});
