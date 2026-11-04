/**
 * Unit-Tests für userPaymentDetailsCard.tsx (inkl. Dialog und Formular,
 * die nicht gemockt werden — getestet wird der ganze Ablauf aus Sicht der
 * Nutzer:in: anzeigen, hinterlegen, bearbeiten, löschen).
 *
 * Gemockt sind nur die Ränder: Datenbank (über `DatabaseContext`),
 * Bestätigungsdialog, Sentry und Analytics.
 */
// Polyfill für jsdom (react-router, über authUserContext importiert, benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});
import React from "react";
import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */
/** Mock: customDialogContext — die Tests steuern die Bestätigung beim Löschen. */
const mockCustomDialog = jest.fn();
jest.mock("../../Shared/customDialogContext", () => ({
  DialogType: {
    None: 0,
    Confirm: 1,
    SingleTextInput: 2,
    ConfirmSecure: 3,
    selectOptions: 4,
  },
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Mock: Sentry — prüfen, was gemeldet wird (und was nicht). */
jest.mock("@sentry/react", () => ({
  ...jest.requireActual("@sentry/react"),
  captureException: jest.fn(),
}));

/** Mock: trackEvent (Umami) */
const mockTrackEvent = jest.fn();
jest.mock("../../Analytics/analyticsService", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

/** Mock: SupabaseMessageHandler — gibt error.message direkt zurück */
jest.mock("../../Database/supabaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: (error: {message: string}) => error.message,
  },
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import * as Sentry from "@sentry/react";
import {UserPaymentDetailsCard} from "../userPaymentDetailsCard";
import {UserPaymentDetailsDomain} from "../userPaymentDetails.types";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import authUserMock from "../../Session/__mocks__/authuser.mock";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {
  STREET as TEXT_STREET,
  POSTAL_CODE as TEXT_POSTAL_CODE,
  CITY as TEXT_CITY,
  IBAN as TEXT_IBAN,
  SAVE as TEXT_SAVE,
  CANCEL as TEXT_CANCEL,
  EDIT as TEXT_EDIT,
  DELETE as TEXT_DELETE,
  PAYMENT_DETAILS_ADD as TEXT_PAYMENT_DETAILS_ADD,
  PAYMENT_DETAILS_EDIT as TEXT_PAYMENT_DETAILS_EDIT,
  PAYMENT_DETAILS_HINT as TEXT_PAYMENT_DETAILS_HINT,
  PAYMENT_DETAILS_SAVED as TEXT_PAYMENT_DETAILS_SAVED,
  PAYMENT_DETAILS_DELETED as TEXT_PAYMENT_DETAILS_DELETED,
  MISSING_NAME_HINT as TEXT_MISSING_NAME_HINT,
  PLEASE_PROVIDE_VALID_IBAN as TEXT_PLEASE_PROVIDE_VALID_IBAN,
} from "../../../constants/text";

/* ===================================================================
// ======================== Testdaten & Helfer =========================
// =================================================================== */
const storedDetails: UserPaymentDetailsDomain = {
  userId: authUserMock.uid,
  street: "Musterstrasse 1",
  postalCode: "1234",
  city: "Hinterpfuffikon",
  iban: "CH9300762011623852957",
};
const FORMATTED_IBAN = "CH93 0076 2011 6238 5295 7";

const mockGetPaymentDetails = jest.fn();
const mockSavePaymentDetails = jest.fn();
const mockDeletePaymentDetails = jest.fn();
const mockDatabase = {
  userPaymentDetails: {
    getPaymentDetails: mockGetPaymentDetails,
    savePaymentDetails: mockSavePaymentDetails,
    deletePaymentDetails: mockDeletePaymentDetails,
  },
} as any;

const mockOnSuccess = jest.fn();
const mockOnError = jest.fn();

/**
 * Rendert die Card mit Datenbank- und Auth-Context und wartet, bis das
 * Laden abgeschlossen ist (Hinweistext erscheint erst danach).
 *
 * @param names - Vor- und Nachname aus dem Profil (Standard: vollständig).
 */
const renderCard = async (
  names: {firstName: string; lastName: string} = {
    firstName: "Test",
    lastName: "Jest",
  },
) => {
  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <AuthUserContext.Provider value={authUserMock}>
        <UserPaymentDetailsCard
          firstName={names.firstName}
          lastName={names.lastName}
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </AuthUserContext.Provider>
    </DatabaseContext.Provider>,
  );
  await screen.findByText(TEXT_PAYMENT_DETAILS_HINT);
};

/**
 * Füllt das Formular im offenen Dialog aus.
 *
 * @param values - Einzugebende Werte (Rohwerte, wie getippt).
 */
const fillForm = (values: {
  street: string;
  postalCode: string;
  city: string;
  iban: string;
}) => {
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(TEXT_STREET), {
    target: {value: values.street},
  });
  fireEvent.change(within(dialog).getByLabelText(TEXT_POSTAL_CODE), {
    target: {value: values.postalCode},
  });
  fireEvent.change(within(dialog).getByLabelText(TEXT_CITY), {
    target: {value: values.city},
  });
  fireEvent.change(within(dialog).getByLabelText(TEXT_IBAN), {
    target: {value: values.iban},
  });
};

/** Klickt "Speichern" im offenen Dialog. */
const clickSave = () =>
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {name: TEXT_SAVE}),
  );

beforeEach(() => {
  jest.clearAllMocks();
  // Standard: noch keine Zahlungsangaben hinterlegt
  mockGetPaymentDetails.mockResolvedValue(null);
});

/* ===================================================================
// ======================== Anzeige ====================================
// =================================================================== */
describe("UserPaymentDetailsCard: Anzeige", () => {
  test("lädt die Angaben der angemeldeten Person", async () => {
    await renderCard();

    expect(mockGetPaymentDetails).toHaveBeenCalledWith(authUserMock.uid);
  });

  test("Leerzustand: Hinterlegen-Knopf, keine Angaben, kein Löschen", async () => {
    await renderCard();

    expect(
      screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}),
    ).toBeInTheDocument();
    expect(screen.queryByText(FORMATTED_IBAN)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {name: TEXT_DELETE}),
    ).not.toBeInTheDocument();
  });

  test("zeigt gespeicherte Adresse und formatierte IBAN", async () => {
    mockGetPaymentDetails.mockResolvedValue(storedDetails);
    await renderCard();

    // in der DB ohne Leerzeichen, in der Anzeige in Viererblöcken
    expect(screen.getByText(FORMATTED_IBAN)).toBeInTheDocument();
    const address = screen.getByText(/Musterstrasse 1/);
    expect(address).toHaveTextContent("Test Jest");
    expect(address).toHaveTextContent("1234 Hinterpfuffikon");
    expect(
      screen.getByRole("button", {name: TEXT_EDIT}),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", {name: TEXT_DELETE})).toBeInTheDocument();
  });

  test("Namens-Hinweis nur, wenn Vor- oder Nachname fehlt", async () => {
    await renderCard({firstName: "Test", lastName: ""});
    expect(screen.getByText(TEXT_MISSING_NAME_HINT)).toBeInTheDocument();
  });

  test("kein Namens-Hinweis bei vollständigem Namen", async () => {
    await renderCard();
    expect(screen.queryByText(TEXT_MISSING_NAME_HINT)).not.toBeInTheDocument();
  });

  test("Laden fehlgeschlagen: Fehler geht an die Seite", async () => {
    const loadError = new Error("permission denied");
    mockGetPaymentDetails.mockRejectedValue(loadError);
    await renderCard();

    expect(mockOnError).toHaveBeenCalledWith(loadError);
    expect(Sentry.captureException).toHaveBeenCalled();
  });
});

/* ===================================================================
// ======================== Speichern ==================================
// =================================================================== */
describe("UserPaymentDetailsCard: Speichern", () => {
  test("neu hinterlegen: speichert normalisiert und zeigt das Ergebnis", async () => {
    mockSavePaymentDetails.mockResolvedValue(storedDetails);
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));
    fillForm({
      street: "  Musterstrasse 1 ",
      postalCode: " 1234",
      city: "Hinterpfuffikon ",
      iban: "ch93 0076 2011 6238 5295 7",
    });
    clickSave();

    // getrimmt und IBAN normalisiert — so, wie die DB-Checks es erwarten
    await waitFor(() =>
      expect(mockSavePaymentDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          street: "Musterstrasse 1",
          postalCode: "1234",
          city: "Hinterpfuffikon",
          iban: "CH9300762011623852957",
        }),
        authUserMock,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(FORMATTED_IBAN)).toBeInTheDocument();
    expect(mockOnSuccess).toHaveBeenCalledWith(TEXT_PAYMENT_DETAILS_SAVED);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      AnalyticsEvent.PAYMENT_DETAILS_CREATED,
    );
  });

  test("bearbeiten: Dialog ist vorausgefüllt, Speichern zählt als Änderung", async () => {
    mockGetPaymentDetails.mockResolvedValue(storedDetails);
    mockSavePaymentDetails.mockResolvedValue({
      ...storedDetails,
      city: "Bern",
    });
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_EDIT}));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(TEXT_PAYMENT_DETAILS_EDIT),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(TEXT_STREET)).toHaveValue(
      "Musterstrasse 1",
    );
    // gespeichert normalisiert, im Feld gruppiert — wie in der Card
    expect(within(dialog).getByLabelText(TEXT_IBAN)).toHaveValue(
      FORMATTED_IBAN,
    );

    fireEvent.change(within(dialog).getByLabelText(TEXT_CITY), {
      target: {value: "Bern"},
    });
    clickSave();

    await waitFor(() =>
      expect(mockTrackEvent).toHaveBeenCalledWith(
        AnalyticsEvent.PAYMENT_DETAILS_UPDATED,
      ),
    );
    expect(screen.getByText(/1234 Bern/)).toBeInTheDocument();
  });

  test("nach dem ersten Speichern liegt der Fokus auf «anpassen», nicht auf «Löschen»", async () => {
    mockSavePaymentDetails.mockResolvedValue(storedDetails);
    await renderCard();

    // fireEvent.click fokussiert nicht — Fokus wie bei einer echten Bedienung setzen
    const addButton = screen.getByRole("button", {
      name: TEXT_PAYMENT_DETAILS_ADD,
    });
    addButton.focus();
    fireEvent.click(addButton);
    fillForm({
      street: "Musterstrasse 1",
      postalCode: "1234",
      city: "Hinterpfuffikon",
      iban: "CH9300762011623852957",
    });
    clickSave();

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // der Dialog gibt den Fokus an den Button zurück, der ihn geöffnet hat
    await waitFor(() =>
      expect(screen.getByRole("button", {name: TEXT_EDIT})).toHaveFocus(),
    );
  });

  test("Enter in einem Feld speichert (Formular-Submit)", async () => {
    mockSavePaymentDetails.mockResolvedValue(storedDetails);
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));
    fillForm({
      street: "Musterstrasse 1",
      postalCode: "1234",
      city: "Hinterpfuffikon",
      iban: "CH9300762011623852957",
    });
    // Enter löst im Browser den Submit des umgebenden <form> aus
    fireEvent.submit(
      within(screen.getByRole("dialog")).getByLabelText(TEXT_CITY),
    );

    await waitFor(() => expect(mockSavePaymentDetails).toHaveBeenCalled());
  });

  test("Validierungsfehler: nichts gespeichert, Dialog bleibt offen, kein Sentry", async () => {
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));
    fillForm({
      street: "Musterstrasse 1",
      postalCode: "1234",
      city: "Hinterpfuffikon",
      iban: "CH9300762011623852958", // falsche Prüfsumme
    });
    clickSave();

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(TEXT_PLEASE_PROVIDE_VALID_IBAN),
    ).toBeInTheDocument();
    expect(mockSavePaymentDetails).not.toHaveBeenCalled();
    // Eingaben bleiben erhalten
    expect(within(dialog).getByLabelText(TEXT_STREET)).toHaveValue(
      "Musterstrasse 1",
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("DB-Fehler: Meldung im Dialog, Dialog bleibt offen, Sentry", async () => {
    mockSavePaymentDetails.mockRejectedValue(new Error("permission denied"));
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));
    fillForm({
      street: "Musterstrasse 1",
      postalCode: "1234",
      city: "Hinterpfuffikon",
      iban: "CH9300762011623852957",
    });
    clickSave();

    const dialog = screen.getByRole("dialog");
    expect(
      await within(dialog).findByText("permission denied"),
    ).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  test("nach Abbrechen ist ein alter Speicher-Fehler beim nächsten Öffnen weg", async () => {
    mockSavePaymentDetails.mockRejectedValue(new Error("permission denied"));
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));
    fillForm({
      street: "Musterstrasse 1",
      postalCode: "1234",
      city: "Hinterpfuffikon",
      iban: "CH9300762011623852957",
    });
    clickSave();
    await screen.findByText("permission denied");

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: TEXT_CANCEL,
      }),
    );
    fireEvent.click(screen.getByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}));

    expect(screen.queryByText("permission denied")).not.toBeInTheDocument();
    // frischer Entwurf — die abgebrochene Eingabe ist weg
    expect(
      within(screen.getByRole("dialog")).getByLabelText(TEXT_STREET),
    ).toHaveValue("");
  });
});

/* ===================================================================
// ======================== Löschen ====================================
// =================================================================== */
describe("UserPaymentDetailsCard: Löschen", () => {
  beforeEach(() => {
    mockGetPaymentDetails.mockResolvedValue(storedDetails);
  });

  test("bestätigt: löscht, zeigt den Leerzustand und meldet Erfolg", async () => {
    mockCustomDialog.mockResolvedValue(true);
    mockDeletePaymentDetails.mockResolvedValue(undefined);
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_DELETE}));

    expect(
      await screen.findByRole("button", {name: TEXT_PAYMENT_DETAILS_ADD}),
    ).toBeInTheDocument();
    expect(mockDeletePaymentDetails).toHaveBeenCalledWith(authUserMock.uid);
    expect(screen.queryByText(FORMATTED_IBAN)).not.toBeInTheDocument();
    expect(mockOnSuccess).toHaveBeenCalledWith(TEXT_PAYMENT_DETAILS_DELETED);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      AnalyticsEvent.PAYMENT_DETAILS_DELETED,
    );
  });

  test("abgebrochen: nichts gelöscht, Angaben bleiben sichtbar", async () => {
    mockCustomDialog.mockResolvedValue(false);
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_DELETE}));

    await waitFor(() => expect(mockCustomDialog).toHaveBeenCalled());
    expect(mockDeletePaymentDetails).not.toHaveBeenCalled();
    expect(screen.getByText(FORMATTED_IBAN)).toBeInTheDocument();
  });

  test("fehlgeschlagen: Fehler geht an die Seite, Angaben bleiben sichtbar", async () => {
    const deleteError = new Error("permission denied");
    mockCustomDialog.mockResolvedValue(true);
    mockDeletePaymentDetails.mockRejectedValue(deleteError);
    await renderCard();

    fireEvent.click(screen.getByRole("button", {name: TEXT_DELETE}));

    await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(deleteError));
    // die Zeile existiert noch — die Card darf nicht "gelöscht" anzeigen
    expect(screen.getByText(FORMATTED_IBAN)).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
