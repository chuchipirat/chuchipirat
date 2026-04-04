/**
 * Unit-Tests für den useSignOut-Hook.
 *
 * Testet, ob beide Auth-Provider abgemeldet werden, der
 * localStorage bereinigt und zur Landing-Seite navigiert wird.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import {renderHook, act} from "@testing-library/react";

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

const mockSignOutFb = jest.fn().mockResolvedValue(undefined);
jest.mock("../../Firebase/firebaseContext", () => ({
  useFirebase: () => ({signOut: mockSignOutFb}),
}));

import {useSignOut} from "../useSignOut";

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("useSignOut", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("meldet bei Supabase und Firebase ab", async () => {
    const {result} = renderHook(() => useSignOut());

    await act(async () => {
      await result.current();
    });

    expect(mockSignOutDb).toHaveBeenCalledTimes(1);
    expect(mockSignOutFb).toHaveBeenCalledTimes(1);
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
});
