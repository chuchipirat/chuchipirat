// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import AuthServiceHandlerPage from "../authServiceHandler";
import * as TEXT from "../../../constants/text";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/**
 * Mock: VerifyEmail — wird als einfaches div mit data-testid gerendert,
 * um die Kind-Komponente isoliert zu testen.
 */
jest.mock("../verifyEmail", () => ({
  __esModule: true,
  default: () => <div data-testid="verify-email" />,
}));

/**
 * Mock: ResetPassword — vereinfachtes div für die Passwort-Zurücksetzen-Ansicht.
 */
jest.mock("../resetPassword", () => ({
  __esModule: true,
  default: () => <div data-testid="reset-password" />,
}));

/**
 * Mock: ConfirmEmailChange — vereinfachtes div für die E-Mail-Änderungsbestätigung.
 */
jest.mock("../confirmEmailChange", () => ({
  __esModule: true,
  default: () => <div data-testid="confirm-email-change" />,
}));

/**
 * Mock: RecoverEmail — vereinfachtes div, das den oobCode als data-Attribut ausgibt.
 */
jest.mock("../recoverEmail", () => ({
  __esModule: true,
  default: ({oobCode}: {oobCode: string}) => (
    <div data-testid="recover-email" data-oobcode={oobCode} />
  ),
}));

/**
 * Mock: AlertMessage — zeigt den body-Text als Inhalt an.
 */
jest.mock("../../Shared/AlertMessage", () => ({
  __esModule: true,
  default: ({body}: {body: string}) => (
    <div data-testid="alert-no-mode">{body}</div>
  ),
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die AuthServiceHandlerPage mit MemoryRouter und der gegebenen URL.
 *
 * @param url - Die initiale URL, die im MemoryRouter gesetzt wird (inkl. search/hash).
 */
const renderWithUrl = (url: string) => {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuthServiceHandlerPage />
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AuthServiceHandlerPage", () => {
  describe("Supabase Implicit Flow (Hash-Fragment)", () => {
    test("Hash #type=recovery rendert ResetPassword", () => {
      renderWithUrl("/action#type=recovery");

      expect(screen.getByTestId("reset-password")).toBeInTheDocument();
      // Andere Komponenten dürfen nicht angezeigt werden
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });

    test("Hash #type=signup rendert VerifyEmail", () => {
      renderWithUrl("/action#type=signup");

      expect(screen.getByTestId("verify-email")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });

    test("Hash #type=email_change rendert ConfirmEmailChange", () => {
      renderWithUrl("/action#type=email_change");

      expect(
        screen.getByTestId("confirm-email-change")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });
  });

  describe("Supabase PKCE Flow (Query-Parameter mit code)", () => {
    test("Query ?code=abc123 rendert VerifyEmail", () => {
      renderWithUrl("/action?code=abc123");

      expect(screen.getByTestId("verify-email")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });

    test("Query ?code=abc123&type=email_change rendert ConfirmEmailChange", () => {
      renderWithUrl("/action?code=abc123&type=email_change");

      expect(
        screen.getByTestId("confirm-email-change")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });
  });

  describe("Firebase Legacy Flow (Query-Parameter mit mode/oobCode)", () => {
    test("Query ?mode=resetPassword&oobCode=abc rendert ResetPassword", () => {
      renderWithUrl("/action?mode=resetPassword&oobCode=abc");

      expect(screen.getByTestId("reset-password")).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });

    test("Query ?mode=recoverEmail&oobCode=xyz rendert RecoverEmail mit oobCode", () => {
      renderWithUrl("/action?mode=recoverEmail&oobCode=xyz");

      const recoverEmail = screen.getByTestId("recover-email");
      expect(recoverEmail).toBeInTheDocument();
      // oobCode muss korrekt an die Kind-Komponente weitergegeben werden
      expect(recoverEmail).toHaveAttribute("data-oobcode", "xyz");
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });

    test("Query ?mode=verifyEmail&oobCode=abc rendert VerifyEmail", () => {
      renderWithUrl("/action?mode=verifyEmail&oobCode=abc");

      expect(screen.getByTestId("verify-email")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("alert-no-mode")).not.toBeInTheDocument();
    });
  });

  describe("Fehlende oder unbekannte Parameter", () => {
    test("Keine Parameter rendert AlertMessage mit Hinweistext", () => {
      renderWithUrl("/action");

      const alert = screen.getByTestId("alert-no-mode");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(TEXT.AUTH_SERVICE_HANLDER_NO_MODE);
      // Keine Auth-Komponente darf angezeigt werden
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
    });

    test("Unbekannter Hash-Typ fällt auf AlertMessage zurück", () => {
      // Ein unbekannter type im Hash wird nicht erkannt und fällt durch
      renderWithUrl("/action#type=unknown_type");

      const alert = screen.getByTestId("alert-no-mode");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(TEXT.AUTH_SERVICE_HANLDER_NO_MODE);
    });
  });
});
