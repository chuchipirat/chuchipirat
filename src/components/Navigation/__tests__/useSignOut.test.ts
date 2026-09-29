/**
 * Unit-Tests für den useSignOut-Hook.
 *
 * Testet, ob bei Supabase abgemeldet, der localStorage bereinigt
 * und zur Landing-Seite navigiert wird.
 *
 * Regression CHUCHIPIRAT-FV: Schlägt das Abmelden fehl (offline), rejectete
 * der Callback unbehandelt und die UI täuschte ein Abmelden vor, obwohl
 * Supabase die Sitzung behält.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import {renderHook, act} from "@testing-library/react";
import * as Sentry from "@sentry/react";

/* ===================================================================
// ============================== Mocks ==============================
// =================================================================== */

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

const mockSignOutDb = jest.fn().mockResolvedValue({});
jest.mock("../../Database/DatabaseContext", () => ({
  useDatabase: () => ({auth: {signOut: mockSignOutDb}}),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import {useSignOut} from "../useSignOut";

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("useSignOut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("meldet bei Supabase ab", async () => {
    const {result} = renderHook(() => useSignOut());

    await act(async () => {
      await result.current();
    });

    expect(mockSignOutDb).toHaveBeenCalledTimes(1);
  });

  test("entfernt den Auth-User aus dem localStorage", async () => {
    localStorage.setItem("authUser", JSON.stringify({uid: "test"}));

    const {result} = renderHook(() => useSignOut());

    await act(async () => {
      await result.current();
    });

    expect(localStorage.getItem("authUser")).toBeNull();
  });

  test("navigiert zur Landing-Seite", async () => {
    const {result} = renderHook(() => useSignOut());

    await act(async () => {
      await result.current();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("liefert true bei erfolgreichem Abmelden", async () => {
    const {result} = renderHook(() => useSignOut());

    let signedOut: boolean | undefined;
    await act(async () => {
      signedOut = await result.current();
    });

    expect(signedOut).toBe(true);
  });

  describe("bei fehlgeschlagenem Abmelden", () => {
    const NETWORK_ERROR = {
      name: "AuthRetryableFetchError",
      message: "Load failed",
      status: 0,
    };

    test("rejectet nicht, liefert false und lässt Sitzung/Seite unverändert", async () => {
      mockSignOutDb.mockRejectedValueOnce(NETWORK_ERROR);
      localStorage.setItem("authUser", JSON.stringify({uid: "test"}));
      const {result} = renderHook(() => useSignOut());

      let signedOut: boolean | undefined;
      await act(async () => {
        signedOut = await result.current();
      });

      expect(signedOut).toBe(false);
      expect(localStorage.getItem("authUser")).not.toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
      // Netzaussetzer → nicht an Sentry
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("meldet einen echten Fehler an Sentry", async () => {
      mockSignOutDb.mockRejectedValueOnce(new Error("unerwartet"));
      const {result} = renderHook(() => useSignOut());

      await act(async () => {
        await result.current();
      });

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });
});
