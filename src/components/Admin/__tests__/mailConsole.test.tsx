/**
 * Unit-Tests für die Mail-Konsole (MailConsolePage).
 *
 * Fokus: Abmelde-Footer wählbar (bei Rollen erzwungen), Titel optional,
 * korrekte Übergabe an die Edge Function `send-mail` und Entwurf-Wiederherstellung.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import MailConsolePage from "../mailConsole";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => ({
    uid: "admin-1",
    email: "admin@test.ch",
    roles: ["admin"],
  }),
}));

jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn().mockResolvedValue(true)}),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

const mockInvoke = jest.fn();
jest.mock("../../Database/supabaseClient", () => ({
  supabase: {functions: {invoke: (...args: unknown[]) => mockInvoke(...args)}},
}));

/** TipTap-Editor durch ein einfaches Textfeld ersetzen (jsdom). */
jest.mock("../../Shared/RichTextEditor", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  return {
    RichTextEditor: ({onChange}: {onChange: (value: string) => void}) =>
      ReactModule.createElement("textarea", {
        "data-testid": "mailtext",
        onChange: (event: {target: {value: string}}) =>
          onChange(event.target.value),
      }),
  };
});

const mockDatabase = {
  users: {countByRole: jest.fn().mockResolvedValue(3)},
  mailLog: {create: jest.fn().mockResolvedValue(undefined)},
} as unknown as DatabaseService;

const DRAFT_STORAGE_KEY = "chuchipirat_mail_draft";
const FOOTER_LABEL = "Abmelde-Footer anhängen";
const FOOTER_PREVIEW = "Du möchtest keine Newsletter mehr erhalten? Hier abmelden.";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/system/mailconsole"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <MailConsolePage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

const getFooterCheckbox = () =>
  screen.getByRole("checkbox", {name: FOOTER_LABEL});

/** Füllt die Pflichtfelder Betreff und Mailtext (Titel bleibt leer). */
const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", {name: /^Betreff/}), "Hallo");
  await user.type(screen.getByTestId("mailtext"), "Text");
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockInvoke.mockResolvedValue({data: {sent: 1, failed: []}, error: null});
});

/* ===================================================================
// ============================ Tests =================================
// =================================================================== */

describe("MailConsolePage — Abmelde-Footer und Titel", () => {
  test("Footer ist standardmässig an, der Titel ist kein Pflichtfeld", () => {
    renderPage();
    expect(getFooterCheckbox()).toBeChecked();
    expect(screen.getByRole("textbox", {name: "Titel"})).not.toBeRequired();
    expect(screen.getByRole("textbox", {name: /^Betreff/})).toBeRequired();
  });

  test("Bei einer Rolle ist die Checkbox gesperrt, bei E-Mail/UID wählbar", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("radio", {name: "Rolle"}));
    expect(getFooterCheckbox()).toBeChecked();
    expect(getFooterCheckbox()).toBeDisabled();

    await user.click(screen.getByRole("radio", {name: "E-Mail-Adresse"}));
    expect(getFooterCheckbox()).toBeEnabled();
  });

  test("Ausschalten zeigt den Warnhinweis und entfernt den Footer aus der Vorschau", async () => {
    renderPage();
    const user = userEvent.setup();
    expect(screen.getByText(FOOTER_PREVIEW)).toBeInTheDocument();

    await user.click(getFooterCheckbox());

    expect(getFooterCheckbox()).not.toBeChecked();
    expect(screen.queryByText(FOOTER_PREVIEW)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Ohne Footer werden auch Personen angeschrieben/),
    ).toBeInTheDocument();
  });

  test("Wechsel auf eine Rolle schaltet einen ausgeschalteten Footer wieder ein", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", {name: "E-Mail-Adresse"}));
    await user.click(getFooterCheckbox());
    expect(getFooterCheckbox()).not.toBeChecked();

    await user.click(screen.getByRole("radio", {name: "Rolle"}));

    expect(getFooterCheckbox()).toBeChecked();
  });

  test("Testmail ohne Titel wird gesendet und enthält includeUnsubscribe=true", async () => {
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);

    await user.click(screen.getByRole("button", {name: "Test Mail senden"}));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));
    expect(mockInvoke).toHaveBeenCalledWith("send-mail", {
      body: expect.objectContaining({
        recipients: ["admin-1"],
        recipientType: "uid",
        title: "",
        includeUnsubscribe: true,
      }),
    });
  });

  test("Testmail spiegelt ausgeschalteten Footer (includeUnsubscribe=false)", async () => {
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("radio", {name: "E-Mail-Adresse"}));
    await user.click(getFooterCheckbox());

    await user.click(screen.getByRole("button", {name: "Test Mail senden"}));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(1));
    expect(mockInvoke.mock.calls[0][1].body).toMatchObject({
      includeUnsubscribe: false,
    });
  });

  test("Betreff und Mailtext bleiben Pflicht: ohne sie wird nichts gesendet", async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", {name: "Test Mail senden"}));

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  test("Footer-Wechsel nach der Testmail sperrt «Senden» wieder", async () => {
    renderPage();
    const user = userEvent.setup();
    await fillRequiredFields(user);
    await user.click(screen.getByRole("radio", {name: "E-Mail-Adresse"}));
    await user.type(
      screen.getByRole("textbox", {name: "E-Mail-Adresse"}),
      "a@b.ch",
    );
    await user.click(screen.getByRole("button", {name: "Test Mail senden"}));
    const sendButton = () =>
      screen.getByRole("button", {name: "Mail an 1 Empfänger senden"});
    await waitFor(() => expect(sendButton()).toBeEnabled());

    await user.click(getFooterCheckbox());

    expect(sendButton()).toBeDisabled();
  });
});

describe("MailConsolePage — Entwurf", () => {
  const storeDraft = (draft: Record<string, unknown>) =>
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  const mailObject = {
    subject: "Alt",
    mailtext: "",
    title: "",
    subtitle: "",
    preheader: "",
    buttonText: "",
    buttonLink: "",
  };

  test("Entwurf aus einer älteren Version (ohne Feld) startet mit Footer an", async () => {
    storeDraft({mailObject, recipientType: "uid", recipients: "x"});
    renderPage();
    await screen.findByText("Entwurf wiederhergestellt");
    expect(getFooterCheckbox()).toBeChecked();
  });

  test("gespeicherter ausgeschalteter Footer wird bei E-Mail/UID wiederhergestellt", async () => {
    storeDraft({
      mailObject,
      recipientType: "email",
      recipients: "a@b.ch",
      includeUnsubscribe: false,
    });
    renderPage();
    await screen.findByText("Entwurf wiederhergestellt");
    expect(getFooterCheckbox()).not.toBeChecked();
  });

  test("ein Entwurf mit Rolle und ausgeschaltetem Footer wird auf «an» korrigiert", async () => {
    storeDraft({
      mailObject,
      recipientType: "role",
      recipients: "communityLeader",
      includeUnsubscribe: false,
    });
    renderPage();
    await screen.findByText("Entwurf wiederhergestellt");
    expect(getFooterCheckbox()).toBeChecked();
  });
});
