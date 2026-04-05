// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {DatabaseContext} from "../../Database/DatabaseContext";

/** Mock für auth.getUser — gibt standardmässig einen User zurück */
const mockGetUser = jest.fn().mockResolvedValue({id: "test-auth-uid"});

/** Mock für users.findOwnProfile — gibt ein User-Domain-Objekt zurück */
const mockFindOwnProfile = jest.fn().mockResolvedValue({
  uid: "domain-uid-42",
  firstName: "Testina",
  memberId: "M-007",
  noLogins: 0,
  displayName: "Testina Test",
  pictureSrc: "",
});

/** Mock für users.registerSignIn */
const mockRegisterSignIn = jest.fn().mockResolvedValue(undefined);

/** Mock-DatabaseService mit den benötigten Auth- und User-Methoden */
const mockDatabase = {
  auth: {
    getUser: mockGetUser,
  },
  users: {
    findOwnProfile: mockFindOwnProfile,
    registerSignIn: mockRegisterSignIn,
  },
  feeds: {
    insertFeed: jest.fn().mockResolvedValue(undefined),
  },
} as any;

/** Mock: supabaseClient — Edge-Function-Aufruf und Auth-Session simulieren */
jest.mock("../../Database/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({data: null, error: null}),
    },
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: {session: {user: {app_metadata: {provider: "email"}}}},
      }),
    },
  },
}));

/** Mock: @sentry/react — captureException wird als noop-Spy erfasst. */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

// Import nach Mock-Definition, damit die Mocks korrekt greifen
import {supabase} from "../../Database/supabaseClient";
import * as Sentry from "@sentry/react";
import {VerifyEmailPage} from "../verifyEmail";

/**
 * Rendert die VerifyEmailPage mit allen nötigen Context-Providern.
 *
 * @returns Das Render-Result von @testing-library/react.
 */
const renderVerifyEmailPage = () => {
  return render(
    <MemoryRouter initialEntries={["/verify-email"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <VerifyEmailPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();

  // Standard-Mocks zurücksetzen
  mockGetUser.mockResolvedValue({id: "test-auth-uid"});
  mockFindOwnProfile.mockResolvedValue({
    uid: "domain-uid-42",
    firstName: "Testina",
    memberId: "42",
    noLogins: 0,
    displayName: "Testina Test",
    pictureSrc: "",
  });
  mockRegisterSignIn.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("VerifyEmailPage", () => {
  test("Zeigt Willkommensmeldung", async () => {
    /** Prüft, ob die Willkommens-Überschrift korrekt angezeigt wird. */
    renderVerifyEmailPage();

    expect(screen.getByText("Willkommen an Bord")).toBeInTheDocument();
  });

  test("Ruft getUser und registerSignIn auf", async () => {
    /**
     * Stellt sicher, dass nach dem Rendern der Seite die gesamte
     * Post-Verification-Kette aufgerufen wird:
     * getUser → findById → registerSignIn.
     */
    renderVerifyEmailPage();

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockFindOwnProfile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockRegisterSignIn).toHaveBeenCalledWith("domain-uid-42");
    });
  });

  test("Löst Vestaboard-Benachrichtigung aus", async () => {
    /**
     * Verifiziert, dass die Supabase Edge-Function «notify-vestaboard»
     * mit den korrekten Benutzerdaten aufgerufen wird.
     */
    renderVerifyEmailPage();

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        "notify-vestaboard",
        {
          body: {
            firstName: "Testina",
            memberId: "42",
          },
        },
      );
    });
  });

  test("Fängt Fehler bei Post-Verification ab", async () => {
    /**
     * Wenn getUser fehlschlägt, darf die Komponente nicht crashen.
     * Der Fehler wird per Sentry protokolliert.
     */
    mockGetUser.mockRejectedValueOnce(new Error("Auth service unavailable"));

    renderVerifyEmailPage();

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
      );
    });

    // Komponente ist trotz Fehler noch gerendert
    expect(screen.getByText("Willkommen an Bord")).toBeInTheDocument();
  });

  test("Zeigt Countdown-Timer", () => {
    /**
     * Prüft, ob der initiale Countdown-Text mit 10 Sekunden
     * korrekt angezeigt wird.
     */
    renderVerifyEmailPage();

    // Der Timer startet bei 10 Sekunden
    expect(
      screen.getByText(/gedulde dich noch 10 Sekunden/i),
    ).toBeInTheDocument();
  });
});
