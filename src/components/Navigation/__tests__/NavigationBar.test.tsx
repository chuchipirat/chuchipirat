/**
 * Unit-Tests für die NavigationBar-Komponente.
 *
 * Testet Toolbar, Hilfe-Button, Benutzermenü, Drawer-Toggle und
 * die Sichtbarkeit des Test-Ribbons.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import "@testing-library/jest-dom";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ============================== Mocks ==============================
// =================================================================== */

/** Mock: useCustomStyles — gibt ein leeres Objekt zurück */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

/** Mock: useNavigate */
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

/** Mock: useDatabase */
const mockSignOutDb = jest.fn().mockResolvedValue({});
jest.mock("../../Database/DatabaseContext", () => ({
  useDatabase: () => ({auth: {signOut: mockSignOutDb}}),
}));

/** Mock: NavigationValuesContext */
jest.mock("../navigationContext", () => ({
  NavigationValuesContext: React.createContext({
    navigationValues: {object: "none", action: ""},
    setNavigationValues: jest.fn(),
  }),
  NavigationObject: {none: "none"},
}));

/** Mock: Utils — Standard: keine Testumgebung */
let mockIsTestEnvironment = false;
jest.mock("../../Shared/utils.class", () => ({
  Utils: {isTestEnvironment: () => mockIsTestEnvironment},
}));

/** Mock: helpCenter */
jest.mock("../helpCenter", () => ({
  getMatchingHelpPage: () => "https://help.chuchipirat.ch/docs/home/home",
}));

import {NavigationBar} from "../NavigationBar";

/* ===================================================================
// ====================== Testdaten & Helpers ========================
// =================================================================== */

const createAuthUser = (overrides = {}) => ({
  uid: "test-uid-123",
  email: "test@chuchipirat.ch",
  emailVerified: true,
  roles: ["basic"],
  ...overrides,
});

const renderComponent = (authUser = createAuthUser()) => {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <NavigationBar authUser={authUser as any} />
    </MemoryRouter>
  );
};

/* ===================================================================
// ============================== Tests ==============================
// =================================================================== */

describe("NavigationBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTestEnvironment = false;
  });

  test("zeigt den App-Titel 'chuchipirat' an", () => {
    renderComponent();
    expect(screen.getByText("chuchipirat")).toBeInTheDocument();
  });

  test("zeigt das TestTenantRibbon in der Testumgebung an", () => {
    mockIsTestEnvironment = true;
    renderComponent();
    expect(screen.getByText("TEST")).toBeInTheDocument();
  });

  test("zeigt kein TestTenantRibbon in der Produktivumgebung", () => {
    mockIsTestEnvironment = false;
    renderComponent();
    expect(screen.queryByText("TEST")).not.toBeInTheDocument();
  });

  test("öffnet den Drawer beim Klick auf das Menü-Icon", async () => {
    renderComponent();

    const menuButton = screen.getByRole("button", {name: "Menü"});
    await userEvent.click(menuButton);

    // Der Drawer enthält die Hauptnavigation (aria-label)
    expect(
      screen.getByLabelText("Hauptnavigation")
    ).toBeInTheDocument();
  });

  test("öffnet das Benutzermenü beim Klick auf das Konto-Icon", async () => {
    renderComponent();

    const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
    await userEvent.click(accountButton);

    expect(screen.getByText("Profil")).toBeInTheDocument();
    expect(screen.getByText("Abmelden")).toBeInTheDocument();
  });

  test("navigiert zum Profil beim Klick auf 'Profil'", async () => {
    renderComponent();

    const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
    await userEvent.click(accountButton);

    const profileItem = screen.getByText("Profil");
    await userEvent.click(profileItem);

    expect(mockNavigate).toHaveBeenCalledWith(
      "/profile/test-uid-123",
      expect.objectContaining({state: {action: "VIEW"}})
    );
  });

  test("ruft signOut auf beim Klick auf 'Abmelden'", async () => {
    renderComponent();

    const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
    await userEvent.click(accountButton);

    const signOutItem = screen.getByText("Abmelden");
    await userEvent.click(signOutItem);

    expect(mockSignOutDb).toHaveBeenCalledTimes(1);
  });

  test("öffnet die Hilfe-Seite beim Klick auf den Hilfe-Button", async () => {
    const windowOpenSpy = jest.spyOn(window, "open").mockImplementation();
    renderComponent();

    const helpButton = screen.getByRole("button", {
      name: "Hilfe-Seite aufrufen",
    });
    await userEvent.click(helpButton);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://help.chuchipirat.ch/docs/home/home",
      "_blank"
    );
    windowOpenSpy.mockRestore();
  });

  test("deaktiviert das Menü wenn die E-Mail nicht verifiziert ist", () => {
    const unverifiedUser = createAuthUser({emailVerified: false});
    renderComponent(unverifiedUser);

    const menuButton = screen.getByRole("button", {name: "Menü"});
    expect(menuButton).toBeDisabled();
  });

  describe("Original-Farbschema-Umschalter", () => {
    test("wird für Community Leader in der Testumgebung angezeigt", async () => {
      mockIsTestEnvironment = true;
      const communityLeader = createAuthUser({roles: ["basic", "communityLeader"]});
      renderComponent(communityLeader);

      const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
      await userEvent.click(accountButton);

      expect(screen.getByText("Original-Farbschema verwenden")).toBeInTheDocument();
    });

    test("wird für Admin in der Testumgebung angezeigt", async () => {
      mockIsTestEnvironment = true;
      const admin = createAuthUser({roles: ["basic", "admin"]});
      renderComponent(admin);

      const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
      await userEvent.click(accountButton);

      expect(screen.getByText("Original-Farbschema verwenden")).toBeInTheDocument();
    });

    test("wird für Basic-User nicht angezeigt, auch in der Testumgebung", async () => {
      mockIsTestEnvironment = true;
      renderComponent();

      const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
      await userEvent.click(accountButton);

      expect(
        screen.queryByText("Original-Farbschema verwenden")
      ).not.toBeInTheDocument();
    });

    test("wird ausserhalb der Testumgebung nicht angezeigt, auch für Admin", async () => {
      mockIsTestEnvironment = false;
      const admin = createAuthUser({roles: ["basic", "admin"]});
      renderComponent(admin);

      const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
      await userEvent.click(accountButton);

      expect(
        screen.queryByText("Original-Farbschema verwenden")
      ).not.toBeInTheDocument();
    });

    test("schreibt die Präferenz in den LocalStorage und lädt die Seite neu", async () => {
      mockIsTestEnvironment = true;
      // Hinweis: window.location.reload() wird hier bewusst nicht gemockt/geprüft —
      // in dieser jsdom-Version ist `reload` weder überschreibbar noch spionierbar
      // (nicht konfigurierbar). Der unveränderte jsdom-Aufruf ist ein No-Op und
      // wirft nicht, daher bleibt nur der LocalStorage-Seiteneffekt testbar.
      localStorage.removeItem("useOriginalColorScheme");

      const admin = createAuthUser({roles: ["basic", "admin"]});
      renderComponent(admin);

      const accountButton = screen.getByRole("button", {name: "Benutzerkonto"});
      await userEvent.click(accountButton);
      await userEvent.click(screen.getByText("Original-Farbschema verwenden"));

      expect(localStorage.getItem("useOriginalColorScheme")).toBe("true");
    });
  });
});
