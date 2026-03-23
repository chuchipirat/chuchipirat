// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {AlertMessage} from "../AlertMessage";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/**
 * Mock fuer FirebaseMessageHandler.
 * Gibt standardmaessig `null` zurueck (kein Firebase-Match),
 * kann aber pro Test ueberschrieben werden.
 */
jest.mock("../../Firebase/firebaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: jest.fn(() => null),
  },
}));

/**
 * Mock fuer SupabaseMessageHandler.
 * Gibt die `error.message` unveraendert zurueck.
 */
jest.mock("../../Database/supabaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: jest.fn((error: {message: string}) => error.message),
  },
}));

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: jest.fn(() => ({alertMessage: {}})),
}));

import FirebaseMessageHandler from "../../Firebase/firebaseMessageHandler.class";
import SupabaseMessageHandler from "../../Database/supabaseMessageHandler.class";

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die AlertMessage-Komponente mit den uebergebenen Props.
 *
 * @param props - Optionale Props fuer AlertMessage.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderAlertMessage = (
  props: Partial<React.ComponentProps<typeof AlertMessage>> = {},
) => {
  return render(<AlertMessage {...props} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  // Standard-Verhalten nach clearAllMocks wiederherstellen
  (FirebaseMessageHandler.translateMessage as jest.Mock).mockReturnValue(null);
  (SupabaseMessageHandler.translateMessage as jest.Mock).mockImplementation(
    (error: {message: string}) => error.message,
  );
});

describe("AlertMessage", () => {
  describe("Fehleruebersetzung", () => {
    test("Zeigt die von SupabaseMessageHandler uebersetzte Fehlermeldung an, wenn Firebase null zurueckgibt", () => {
      const testError = new Error("Invalid login credentials");

      renderAlertMessage({error: testError});

      // Firebase gibt null zurueck → Fallback auf Supabase
      expect(FirebaseMessageHandler.translateMessage).toHaveBeenCalledWith(
        testError,
      );
      expect(SupabaseMessageHandler.translateMessage).toHaveBeenCalledWith(
        testError,
      );
      expect(
        screen.getByText("Invalid login credentials"),
      ).toBeInTheDocument();
    });

    test("Zeigt die von FirebaseMessageHandler uebersetzte Fehlermeldung an, wenn ein Match vorliegt", () => {
      const testError = new Error("auth/wrong-password") as Error & {
        code: string;
      };
      testError.code = "auth/wrong-password";

      // Firebase liefert eine uebersetzte Meldung
      (FirebaseMessageHandler.translateMessage as jest.Mock).mockReturnValue(
        "Passwort falsch.",
      );

      renderAlertMessage({error: testError});

      expect(FirebaseMessageHandler.translateMessage).toHaveBeenCalledWith(
        testError,
      );
      // Supabase wird nicht aufgerufen, da Firebase bereits ein Ergebnis liefert (nullish coalescing)
      expect(SupabaseMessageHandler.translateMessage).not.toHaveBeenCalled();
      expect(screen.getByText("Passwort falsch.")).toBeInTheDocument();
    });

    test("Zeigt keinen Fehlertext an, wenn error null ist", () => {
      renderAlertMessage({error: null});

      // Keiner der Handler wird aufgerufen
      expect(FirebaseMessageHandler.translateMessage).not.toHaveBeenCalled();
      expect(SupabaseMessageHandler.translateMessage).not.toHaveBeenCalled();
    });
  });

  describe("Titel", () => {
    test("Zeigt AlertTitle an, wenn messageTitle gesetzt ist", () => {
      renderAlertMessage({messageTitle: "Achtung"});

      expect(screen.getByText("Achtung")).toBeInTheDocument();
    });

    test("Zeigt keinen AlertTitle an, wenn messageTitle leer ist", () => {
      renderAlertMessage({messageTitle: ""});

      // MUI AlertTitle wuerde als eigenes Element erscheinen — sollte nicht vorhanden sein
      const alert = screen.getByRole("alert");
      expect(alert.querySelector(".MuiAlertTitle-root")).not.toBeInTheDocument();
    });
  });

  describe("Body-Inhalt", () => {
    test("Zeigt body als String an", () => {
      renderAlertMessage({body: "Bitte versuche es erneut."});

      expect(
        screen.getByText("Bitte versuche es erneut."),
      ).toBeInTheDocument();
    });

    test("Zeigt body als JSX-Element an", () => {
      const jsxBody = (
        <span data-testid="custom-body">Individueller Inhalt</span>
      );

      renderAlertMessage({body: jsxBody});

      expect(screen.getByTestId("custom-body")).toBeInTheDocument();
      expect(screen.getByText("Individueller Inhalt")).toBeInTheDocument();
    });
  });

  describe("Severity", () => {
    test("Verwendet standardmaessig severity 'error'", () => {
      renderAlertMessage();

      const alert = screen.getByRole("alert");
      // MUI setzt die Klasse MuiAlert-standardError fuer severity="error"
      expect(alert).toHaveClass("MuiAlert-standardError");
    });

    test("Verwendet die uebergebene severity", () => {
      renderAlertMessage({severity: "success"});

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("MuiAlert-standardSuccess");
    });
  });
});
