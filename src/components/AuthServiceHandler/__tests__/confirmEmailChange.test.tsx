// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, act} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {ConfirmEmailChangePage} from "../confirmEmailChange";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {LocalStorageKey} from "../../../constants/localStorage";

/**
 * Callback-Referenz für onAuthStateChange — wird bei jedem Aufruf
 * von `mockOnAuthStateChange` erfasst, damit Tests den Auth-Status-
 * Wechsel manuell auslösen können.
 */
let authChangeCallback: Function;

/**
 * Mock für `database.auth.onAuthStateChange`.
 * Speichert den übergebenen Callback und gibt eine Unsubscribe-Funktion zurück.
 */
const mockOnAuthStateChange = jest.fn((cb: Function) => {
  authChangeCallback = cb;
  return jest.fn(); // unsubscribe
});

/** Mock für `database.auth.getUser` — gibt standardmässig null zurück. */
const mockGetUser = jest.fn();

/** Mock-DatabaseService mit Auth-Methoden */
const mockDatabase = {
  auth: {
    onAuthStateChange: mockOnAuthStateChange,
    getUser: mockGetUser,
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    updatePassword: jest.fn(),
    resetPassword: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
} as any;

/** Mock: @sentry/react — captureException wird als noop-Spy erfasst. */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

import * as Sentry from "@sentry/react";

/**
 * Rendert die ConfirmEmailChangePage mit allen nötigen Context-Providern
 * (DatabaseContext) und einem MemoryRouter.
 */
const renderConfirmEmailChangePage = () => {
  return render(
    <MemoryRouter initialEntries={["/confirm-email-change"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <ConfirmEmailChangePage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ConfirmEmailChangePage", () => {
  test("Zeigt Ladezustand initial", () => {
    renderConfirmEmailChangePage();

    // Die Info-Meldung mit «Einen Moment...» muss sichtbar sein
    expect(screen.getByText("Einen Moment...")).toBeInTheDocument();

    // Weder Erfolg noch Fehler dürfen angezeigt werden
    expect(
      screen.queryByText(
        "Deine E-Mail-Adresse wurde erfolgreich aktualisiert."
      )
    ).not.toBeInTheDocument();
  });

  test("Zeigt Erfolgsmeldung nach Session-Etablierung", async () => {
    mockGetUser.mockResolvedValueOnce({email: "new@test.ch"});

    renderConfirmEmailChangePage();

    // Auth-Status-Wechsel simulieren (SIGNED_IN mit gültiger Session)
    await act(async () => {
      await authChangeCallback("SIGNED_IN", {user: {id: "123"}});
    });

    // Die Erfolgsmeldung muss erscheinen
    await waitFor(() => {
      expect(
        screen.getByText(
          "Deine E-Mail-Adresse wurde erfolgreich aktualisiert."
        )
      ).toBeInTheDocument();
    });

    // Der Ladezustand darf nicht mehr sichtbar sein
    expect(screen.queryByText("Einen Moment...")).not.toBeInTheDocument();
  });

  test("Aktualisiert localStorage mit neuer E-Mail", async () => {
    // Alten Benutzer im localStorage speichern
    const oldUser = {
      uid: "user-1",
      email: "old@test.ch",
      emailVerified: true,
      firstName: "Test",
      lastName: "User",
      roles: [],
      publicProfile: {displayName: "", motto: "", pictureSrc: ""},
    };
    localStorage.setItem(
      LocalStorageKey.AUTH_USER,
      JSON.stringify(oldUser)
    );

    mockGetUser.mockResolvedValueOnce({email: "new@test.ch"});

    renderConfirmEmailChangePage();

    // Auth-Status-Wechsel auslösen
    await act(async () => {
      await authChangeCallback("SIGNED_IN", {user: {id: "user-1"}});
    });

    // Warten, bis der Zustand aktualisiert wurde
    await waitFor(() => {
      expect(
        screen.getByText(
          "Deine E-Mail-Adresse wurde erfolgreich aktualisiert."
        )
      ).toBeInTheDocument();
    });

    // localStorage muss die neue E-Mail enthalten
    const stored = localStorage.getItem(LocalStorageKey.AUTH_USER);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.email).toBe("new@test.ch");
  });

  test("Zeigt Fehlermeldung bei getUser-Fehler", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Session abgelaufen"));

    renderConfirmEmailChangePage();

    // Auth-Status-Wechsel mit gültiger Session simulieren
    await act(async () => {
      await authChangeCallback("SIGNED_IN", {user: {id: "123"}});
    });

    // Die Fehlermeldung muss sichtbar sein
    await waitFor(() => {
      expect(
        screen.getByText("Session abgelaufen")
      ).toBeInTheDocument();
    });

    // Kein Erfolgs-Alert darf angezeigt werden
    expect(
      screen.queryByText(
        "Deine E-Mail-Adresse wurde erfolgreich aktualisiert."
      )
    ).not.toBeInTheDocument();

    // Der Uups-Titel muss im Fehler-Alert erscheinen
    expect(
      screen.getByText("Uups... da ging was schief.")
    ).toBeInTheDocument();

    // Sentry muss den Fehler erfasst haben
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
