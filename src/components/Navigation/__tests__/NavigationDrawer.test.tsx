/**
 * Unit-Tests für die NavigationDrawer-Komponente.
 *
 * Testet die Sichtbarkeit der Menüeinträge basierend auf
 * Benutzerrollen und die Navigation beim Klick.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import "@testing-library/jest-dom";
import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ============================== Mocks ==============================
// =================================================================== */

/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isTestEnvironment: jest.fn(() => false),
    isDevEnvironment: jest.fn(() => true),
    isProductionEnvironment: jest.fn(() => false),
    getEnvironment: jest.fn(() => "DEV"),
    isUrl: jest.fn(() => false),
    getDomain: jest.fn(() => ""),
    sortArray: jest.fn(({array}: {array: unknown[]}) => array),
    generateUid: jest.fn(() => "mock-uid"),
  },
}));

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

import {NavigationDrawer} from "../NavigationDrawer";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ====================== Testdaten & Helpers ========================
// =================================================================== */

const createAuthUser = (roles: string[] = ["basic"]): AuthUser => {
  const user = new AuthUser();
  user.uid = "test-uid";
  user.email = "test@chuchipirat.ch";
  user.emailVerified = true;
  user.roles = roles as any;
  return user;
};

const mockOnClose = jest.fn();

const renderComponent = (authUser = createAuthUser(), open = true) => {
  return render(
    <MemoryRouter>
      <NavigationDrawer
        open={open}
        onClose={mockOnClose}
        authUser={authUser}
      />
    </MemoryRouter>
  );
};

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("NavigationDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("zeigt alle Basis-Menüeinträge für einen einfachen Benutzer", () => {
    renderComponent(createAuthUser(["basic"]));

    const drawer = screen.getByLabelText("Hauptnavigation");
    expect(within(drawer).getByText("Home-Dashboard")).toBeInTheDocument();
    expect(within(drawer).getByText("Rezepte")).toBeInTheDocument();
    expect(within(drawer).getByText("Anlässe")).toBeInTheDocument();
    expect(within(drawer).getByText("Mengenumrechnungen")).toBeInTheDocument();
    expect(within(drawer).getByText("Anträge")).toBeInTheDocument();
    expect(within(drawer).getByText("Spenden")).toBeInTheDocument();
  });

  test("blendet Community-Leader-Einträge für einfache Benutzer aus", () => {
    renderComponent(createAuthUser(["basic"]));

    const drawer = screen.getByLabelText("Hauptnavigation");
    expect(within(drawer).queryByText("Produkte")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("Materialien")).not.toBeInTheDocument();
    expect(
      within(drawer).queryByText("Abteilungen (Einkauf)")
    ).not.toBeInTheDocument();
    expect(within(drawer).queryByText("System")).not.toBeInTheDocument();
  });

  test("zeigt Community-Leader-Einträge für Community Leader", () => {
    renderComponent(createAuthUser(["basic", "communityLeader"]));

    const drawer = screen.getByLabelText("Hauptnavigation");
    expect(within(drawer).getByText("Produkte")).toBeInTheDocument();
    expect(within(drawer).getByText("Materialien")).toBeInTheDocument();
    expect(
      within(drawer).getByText("Abteilungen (Einkauf)")
    ).toBeInTheDocument();
    expect(within(drawer).getByText("Mengeneinheiten")).toBeInTheDocument();
    expect(within(drawer).getByText("System")).toBeInTheDocument();
  });

  test("hat keinen separaten Users-Eintrag im Menü", () => {
    renderComponent(
      createAuthUser(["basic", "communityLeader", "admin"])
    );

    const drawer = screen.getByLabelText("Hauptnavigation");
    expect(within(drawer).queryByText("Users")).not.toBeInTheDocument();
  });

  test("navigiert zur Route und schliesst den Drawer beim Klick", async () => {
    renderComponent(createAuthUser(["basic"]));

    const drawer = screen.getByLabelText("Hauptnavigation");
    const recipesItem = within(drawer).getByText("Rezepte");
    await userEvent.click(recipesItem);

    expect(mockNavigate).toHaveBeenCalledWith("/recipes");
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
