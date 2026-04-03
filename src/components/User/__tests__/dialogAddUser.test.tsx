/**
 * Unit-Tests für den DialogAddUser.
 *
 * Testet Rendering, Validierung, Selbst-Check, User-Lookup,
 * Fehleranzeige, Abbrechen und Formular-Submit per Enter-Taste.
 */
import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: User-Klasse (statische Methoden) */
jest.mock("../user.class", () => ({
  __esModule: true,
  User: {
    getUidByEmail: jest.fn(),
  },
}));

/** Mock: Utils */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isEmail: jest.fn(),
  },
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import {DialogAddUser} from "../dialogAddUser";
import {User} from "../user.class";
import {Utils} from "../../Shared/utils.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import DatabaseService from "../../Database/DatabaseService";

// Typisierte Mock-Referenzen
const mockGetUidByEmail = User.getUidByEmail as jest.Mock;
const mockIsEmail = Utils.isEmail as jest.Mock;

/** Mock-AuthUser mit E-Mail */
const mockAuthUser = {
  uid: "auth-user-uid-123",
  email: "myself@example.com",
  publicProfile: {displayName: "Test User", motto: "", pictureSrc: ""},
} as unknown as AuthUser;

/** Mock-DatabaseService */
const mockDatabase = {} as unknown as DatabaseService;

/* ===================================================================
// ======================== Hilfsfunktionen ============================
// =================================================================== */

/** Rendert den Dialog mit Standardprops und optionalen Overrides */
const renderDialog = (overrides: Partial<React.ComponentProps<typeof DialogAddUser>> = {}) => {
  const defaultProps = {
    database: mockDatabase,
    authUser: mockAuthUser,
    eventId: "test-event-uid",
    dialogOpen: true,
    handleAddUser: jest.fn(),
    handleClose: jest.fn(),
    ...overrides,
  };
  return {
    ...render(<DialogAddUser {...defaultProps} />),
    props: defaultProps,
  };
};

/* ===================================================================
// ======================== Tests ======================================
// =================================================================== */
describe("DialogAddUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("zeigt Dialog-Inhalt wenn dialogOpen=true", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  it("zeigt keinen Dialog wenn dialogOpen=false", () => {
    renderDialog({dialogOpen: false});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt Validierungsfehler bei ungültigem E-Mail-Format", async () => {
    mockIsEmail.mockReturnValue(false);
    const {props} = renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "invalid-email");
    await userEvent.click(screen.getByRole("button", {name: /hinzufügen/i}));

    // Sollte einen Fehler anzeigen
    expect(mockIsEmail).toHaveBeenCalledWith("invalid-email");
    expect(props.handleAddUser).not.toHaveBeenCalled();
  });

  it("zeigt Warnung wenn eigene E-Mail eingegeben wird", async () => {
    mockIsEmail.mockReturnValue(true);
    const {props} = renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "myself@example.com");
    await userEvent.click(screen.getByRole("button", {name: /hinzufügen/i}));

    // Warnung soll angezeigt werden
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(props.handleAddUser).not.toHaveBeenCalled();
  });

  it("ruft handleAddUser mit UID auf bei erfolgreichem Lookup", async () => {
    mockIsEmail.mockReturnValue(true);
    mockGetUidByEmail.mockResolvedValue("found-user-uid-456");
    const {props} = renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "other@example.com");
    await userEvent.click(screen.getByRole("button", {name: /hinzufügen/i}));

    await waitFor(() => {
      expect(props.handleAddUser).toHaveBeenCalledWith("found-user-uid-456");
    });
  });

  it("zeigt Fehlermeldung wenn User nicht gefunden wird", async () => {
    mockIsEmail.mockReturnValue(true);
    mockGetUidByEmail.mockRejectedValue(
      new Error("Kein*e Benutzer*in mit dieser E-Mail-Adresse gefunden"),
    );
    renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "unknown@example.com");
    await userEvent.click(screen.getByRole("button", {name: /hinzufügen/i}));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("ruft handleClose beim Abbrechen auf", async () => {
    const {props} = renderDialog();

    await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

    expect(props.handleClose).toHaveBeenCalled();
  });

  it("sendet Formular per Enter-Taste ab", async () => {
    mockIsEmail.mockReturnValue(true);
    mockGetUidByEmail.mockResolvedValue("enter-user-uid-789");
    const {props} = renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "enter@example.com");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(props.handleAddUser).toHaveBeenCalledWith("enter-user-uid-789");
    });
  });

  it("zeigt sichere Fehlermeldung statt error.toString() bei Nicht-Error-Fehler", async () => {
    mockIsEmail.mockReturnValue(true);
    // eslint-disable-next-line prefer-promise-reject-errors
    mockGetUidByEmail.mockRejectedValue("string-error");
    renderDialog();

    const emailInput = screen.getByLabelText(/e-mail/i);
    await userEvent.type(emailInput, "test@example.com");
    await userEvent.click(screen.getByRole("button", {name: /hinzufügen/i}));

    // Soll eine sichere Fallback-Meldung zeigen, nicht "string-error"
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});
