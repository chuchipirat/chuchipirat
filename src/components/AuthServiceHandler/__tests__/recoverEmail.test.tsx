// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: firebase/auth — checkActionCode */
const mockCheckActionCode = jest.fn();
jest.mock("firebase/auth", () => ({
  checkActionCode: (...args: unknown[]) => mockCheckActionCode(...args),
}));

/** Mock: FirebaseMessageHandler — gibt null zurück (kein Firebase-Match) */
jest.mock("../../Firebase/firebaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: () => null,
  },
}));

/** Mock: SupabaseMessageHandler — gibt error.message direkt zurück */
jest.mock("../../Database/supabaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: (error: {message: string}) => error.message,
  },
}));

/** Mock-Firebase-Instanz */
const mockApplyActionCode = jest.fn();
const mockSignOut = jest.fn();
const mockFirebase = {
  auth: {mockAuth: true},
  applyActionCode: mockApplyActionCode,
  signOut: mockSignOut,
} as any;

/** Mock: FirebaseContext */
jest.mock("../../Firebase/firebaseContext", () => ({
  useFirebase: () => mockFirebase,
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import RecoverEmailPage from "../recoverEmail";

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die RecoverEmailPage mit Router.
 *
 * @param oobCode - Firebase Action-Code
 * @param authUser - Optionaler AuthUser
 */
const renderRecoverEmailPage = ({
  oobCode = "test-oob-code",
  authUser = null as any,
} = {}) => {
  return render(
    <MemoryRouter>
      <RecoverEmailPage authUser={authUser} oobCode={oobCode} />
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("RecoverEmailPage", () => {
  describe("Fehlerbehandlung", () => {
    test("Zeigt Fehler wenn kein authUser und kein localStorage-Eintrag", () => {
      renderRecoverEmailPage();

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getAllByText(/Uups/i).length).toBeGreaterThanOrEqual(1);
    });

    test("Zeigt keinen Inhalt wenn kein actionCode", () => {
      const authUser = {email: "old@test.ch", emailVerified: true} as any;

      renderRecoverEmailPage({oobCode: "", authUser});

      expect(screen.queryByText(/Änderung wurde rückgängig/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Uups/i)).not.toBeInTheDocument();
    });
  });

  describe("Erfolgreiche Recovery", () => {
    test("Zeigt Erfolgsmeldung nach erfolgreicher Recovery", async () => {
      const authUser = {email: "new@test.ch", emailVerified: true} as any;

      localStorage.setItem(
        "authUser",
        JSON.stringify({email: "new@test.ch", emailVerified: true}),
      );

      mockCheckActionCode.mockResolvedValue({
        data: {email: "old@test.ch"},
      });
      mockApplyActionCode.mockResolvedValue(undefined);
      mockSignOut.mockResolvedValue(undefined);

      renderRecoverEmailPage({authUser});

      await waitFor(() => {
        expect(mockCheckActionCode).toHaveBeenCalledWith(
          {mockAuth: true},
          "test-oob-code",
        );
      });

      await waitFor(() => {
        expect(mockApplyActionCode).toHaveBeenCalledWith("test-oob-code");
      });

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });

    test("Aktualisiert localStorage mit alter E-Mail", async () => {
      const authUser = {email: "new@test.ch", emailVerified: true} as any;

      localStorage.setItem(
        "authUser",
        JSON.stringify({email: "new@test.ch", emailVerified: false}),
      );

      mockCheckActionCode.mockResolvedValue({
        data: {email: "old@test.ch"},
      });
      mockApplyActionCode.mockResolvedValue(undefined);
      mockSignOut.mockResolvedValue(undefined);

      renderRecoverEmailPage({authUser});

      await waitFor(() => {
        const stored = JSON.parse(localStorage.getItem("authUser")!);
        expect(stored.email).toBe("old@test.ch");
        expect(stored.emailVerified).toBe(true);
      });
    });
  });

  describe("Anmelden-Link", () => {
    test("Zeigt Anmelden-Link nach erfolgreicher Recovery", async () => {
      const authUser = {email: "new@test.ch", emailVerified: true} as any;

      localStorage.setItem(
        "authUser",
        JSON.stringify({email: "new@test.ch", emailVerified: true}),
      );

      mockCheckActionCode.mockResolvedValue({
        data: {email: "old@test.ch"},
      });
      mockApplyActionCode.mockResolvedValue(undefined);
      mockSignOut.mockResolvedValue(undefined);

      renderRecoverEmailPage({authUser});

      await waitFor(() => {
        // "Anmelden" erscheint als Link-Text in der Erfolgsmeldung
        const alerts = screen.getAllByRole("alert");
        const infoAlert = alerts.find(
          (a) => a.classList.contains("MuiAlert-standardInfo"),
        );
        expect(infoAlert).toBeDefined();
      });
    });
  });
});
