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

/** Mock: PageTitle — vereinfacht für Tests */
jest.mock("../../Shared/pageTitle", () => ({
  __esModule: true,
  default: ({subTitle}: {subTitle?: string}) => (
    <div data-testid="page-title">{subTitle}</div>
  ),
}));

/** Mock: useCustomStyles — leere Styles */
jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: () => ({container: {}}),
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
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });

    test("Hash #type=signup rendert VerifyEmail", () => {
      renderWithUrl("/action#type=signup");

      expect(screen.getByTestId("verify-email")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });

    test("Hash #type=email_change rendert ConfirmEmailChange", () => {
      renderWithUrl("/action#type=email_change");

      expect(
        screen.getByTestId("confirm-email-change")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
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
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });

    test("Query ?code=abc123&type=email_change rendert ConfirmEmailChange", () => {
      renderWithUrl("/action?code=abc123&type=email_change");

      expect(
        screen.getByTestId("confirm-email-change")
      ).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });
  });

  describe("Firebase Legacy Flow (Query-Parameter mit mode/oobCode)", () => {
    test("Query ?mode=resetPassword&oobCode=abc rendert ResetPassword", () => {
      renderWithUrl("/action?mode=resetPassword&oobCode=abc");

      expect(screen.getByTestId("reset-password")).toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });

    test("Query ?mode=recoverEmail&oobCode=xyz rendert RecoverEmail mit oobCode", () => {
      renderWithUrl("/action?mode=recoverEmail&oobCode=xyz");

      const recoverEmail = screen.getByTestId("recover-email");
      expect(recoverEmail).toBeInTheDocument();
      // oobCode muss korrekt an die Kind-Komponente weitergegeben werden
      expect(recoverEmail).toHaveAttribute("data-oobcode", "xyz");
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });

    test("Query ?mode=verifyEmail&oobCode=abc rendert VerifyEmail", () => {
      renderWithUrl("/action?mode=verifyEmail&oobCode=abc");

      expect(screen.getByTestId("verify-email")).toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
      expect(screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).not.toBeInTheDocument();
    });
  });

  describe("Fehlende oder unbekannte Parameter", () => {
    test("Keine Parameter zeigt generische Fehlermeldung", () => {
      renderWithUrl("/action");

      expect(screen.getByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).toBeInTheDocument();
      expect(screen.getByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE)).toBeInTheDocument();
      // Keine Auth-Komponente darf angezeigt werden
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("confirm-email-change")
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("recover-email")).not.toBeInTheDocument();
    });

    test("Unbekannter Hash-Typ zeigt generische Fehlermeldung", () => {
      renderWithUrl("/action#type=unknown_type");

      expect(screen.getByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)).toBeInTheDocument();
      expect(screen.getByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE)).toBeInTheDocument();
    });
  });

  describe("Abgelaufene oder ungültige Links", () => {
    test("Query ?error=access_denied zeigt Expired-Link-Meldung", () => {
      renderWithUrl(
        "/action?error=access_denied&error_description=Email+link+is+invalid+or+has+expired&error_code=otp_expired"
      );

      expect(
        screen.getByText(TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TITLE)
      ).toBeInTheDocument();
      expect(
        screen.getByText(TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TEXT)
      ).toBeInTheDocument();
      // Keine Auth-Komponente darf angezeigt werden
      expect(screen.queryByTestId("verify-email")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reset-password")).not.toBeInTheDocument();
    });

    test("Hash #error=access_denied zeigt Expired-Link-Meldung", () => {
      renderWithUrl(
        "/action#error=access_denied&error_description=Email+link+is+invalid+or+has+expired"
      );

      expect(
        screen.getByText(TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TITLE)
      ).toBeInTheDocument();
      expect(
        screen.getByText(TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TEXT)
      ).toBeInTheDocument();
    });

    test("Expired-Link zeigt NICHT die generische Fehlermeldung", () => {
      renderWithUrl(
        "/action?error=access_denied&error_description=Email+link+is+invalid+or+has+expired"
      );

      expect(
        screen.queryByText(TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE)
      ).not.toBeInTheDocument();
    });
  });
});
