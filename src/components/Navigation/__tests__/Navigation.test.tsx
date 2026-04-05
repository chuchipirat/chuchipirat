/**
 * Unit-Tests für die Navigation-Wurzelkomponente.
 *
 * Testet, ob die korrekte Navigationsleiste (authentifiziert/nicht
 * authentifiziert) basierend auf dem Auth-Status gerendert wird.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import "@testing-library/jest-dom";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ============================== Mocks ==============================
// =================================================================== */

/** Mock: useCustomStyles — gibt ein leeres Objekt zurück */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

/** Mock: Utils — steuert isTestEnvironment */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {isTestEnvironment: () => false},
}));

/** Mock: useAuthUser — dynamisch, wird in einzelnen Tests überschrieben */
let mockAuthUser: unknown = null;
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: useDatabase */
jest.mock("../../Database/DatabaseContext", () => ({
  useDatabase: () => ({auth: {signOut: jest.fn()}}),
}));

/** Mock: useFirebase */
jest.mock("../../Firebase/firebaseContext", () => ({
  useFirebase: () => ({signOut: jest.fn()}),
}));

/** Mock: NavigationValuesContext */
jest.mock("../navigationContext", () => ({
  NavigationValuesContext: React.createContext(null),
  NavigationObject: {none: "none"},
}));

import {Navigation} from "../navigation";

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = null;
  });

  test("rendert NavigationNoAuth wenn kein Benutzer angemeldet ist", () => {
    mockAuthUser = null;

    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );

    // NavigationNoAuth zeigt den Anmelde-Button
    expect(screen.getByText("Anmelden")).toBeInTheDocument();
  });

  test("rendert NavigationBar wenn ein Benutzer angemeldet ist", () => {
    mockAuthUser = {
      uid: "test-uid-123",
      email: "test@chuchipirat.ch",
      emailVerified: true,
      roles: ["basic"],
    };

    render(
      <MemoryRouter>
        <Navigation />
      </MemoryRouter>
    );

    // NavigationBar zeigt den App-Namen
    expect(screen.getByText("chuchipirat")).toBeInTheDocument();
    // NavigationBar zeigt den Benutzerkonto-Button, nicht den Anmelde-Button
    expect(screen.queryByText("Anmelden")).not.toBeInTheDocument();
  });

  test("stürzt beim Rendern nicht ab", () => {
    mockAuthUser = null;

    expect(() =>
      render(
        <MemoryRouter>
          <Navigation />
        </MemoryRouter>
      )
    ).not.toThrow();
  });
});
