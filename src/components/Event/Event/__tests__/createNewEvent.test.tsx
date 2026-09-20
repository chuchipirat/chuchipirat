/**
 * Unit-Tests fuer CreateEventPage.
 *
 * Testet den 3-Schritt-Erstellungsassistenten: Stepper-Anzeige,
 * initialen Schritt, Abbruch-Navigation und Fehlerbehandlung
 * bei der Validierung.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

// jsdom implementiert window.scrollTo nicht
window.scrollTo = jest.fn() as any;

import React from "react";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {CreateEventPage} from "../createNewEvent";
import {DatabaseContext} from "../../../Database/DatabaseContext";


/** Mock: @sentry/react — captureException wird als noop-Spy erfasst. */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

/** Mock: useNavigate */
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

/** Mock: useAuthUser */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "test@chuchipirat.ch",
  roles: [],
};
jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: useCustomDialog */
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
}));

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "test-placeholder.png",
      SIGN_IN_HEADER: "test-header.png",
    }),
  },
}));


/** Mock: NavigationValuesContext */
jest.mock("../../../Navigation/navigationContext", () => ({
  NavigationValuesContext: React.createContext({
    setNavigationValues: jest.fn(),
  }),
  NavigationObject: {none: "none"},
}));

/** Mock: EventInfoPage (Stub) */
jest.mock("../eventInfo", () => ({
  __esModule: true,
  EventInfoPage: () => <div data-testid="event-info-page">EventInfoPage</div>,
}));

/** Mock: EventGroupConfigurationPage (Stub) — ruft onConfirm.onClick per Button auf */
jest.mock("../../GroupConfiguration/groupConfiguration", () => ({
  __esModule: true,
  EventGroupConfigurationPage: (props: any) => (
    <div data-testid="group-config-page">
      GroupConfigPage
      <button onClick={(event: any) => props.onConfirm.onClick(event, {})}>
        {props.onConfirm.buttonText}
      </button>
    </div>
  ),
}));

/** Mock: DonationForm (Stub) */
jest.mock("../../../Donate/DonationForm", () => ({
  __esModule: true,
  DonationForm: () => <div data-testid="donation-form">DonationForm</div>,
}));

/** Mock: Event.class */
const mockEventFactory = jest.fn();
const mockCheckEventData = jest.fn();
const mockDeleteEmptyDates = jest.fn((dates: unknown[]) => dates);

jest.mock("../event.class", () => {
  const EventMock = jest.fn().mockImplementation(() => ({
    uid: "",
    name: "",
    dates: [],
    cooks: [],
  }));
  EventMock.factory = (...args: unknown[]) => mockEventFactory(...args);
  EventMock.checkEventData = (...args: unknown[]) =>
    mockCheckEventData(...args);
  EventMock.deleteEmptyDates = (...args: unknown[]) =>
    mockDeleteEmptyDates(...args);
  return {
    __esModule: true,
    Event: EventMock,
  };
});

/** Mock: EventGroupConfiguration.class */
jest.mock("../../GroupConfiguration/groupConfiguration.class", () => {
  return {
    __esModule: true,
    EventGroupConfiguration: jest.fn().mockImplementation(() => ({
      diets: {entries: {}, order: []},
      intolerances: {entries: {}, order: []},
      portions: {},
      totalPortions: 0,
      lastChange: {date: new Date(0)},
    })),
  };
});

/** Mock: FieldValidationError */
jest.mock("../../../Shared/fieldValidation.error.class", () => {
  class FieldValidationError extends Error {
    formValidation: {fieldName: string; errorMessage: string}[];
    constructor(
      message: string,
      formValidation: {fieldName: string; errorMessage: string}[],
    ) {
      super(message);
      this.name = "FieldValidationError";
      this.formValidation = formValidation;
    }
  }
  return {
    __esModule: true,
    default: FieldValidationError,
    FieldValidationError,
  };
});

/** Mock: resizeImage */
jest.mock("../../../Shared/imageResize", () => ({
  resizeImage: jest.fn(),
}));

/** Mock: EventGroupConfigRepository */
jest.mock("../../../Database/Repository/EventGroupConfigRepository", () => ({
  __esModule: true,
}));

/** Mock: useDatabase — liefert mockDatabase, damit database.events.createEvent()
 * (aufgerufen via useDatabase(), nicht nur via Context.Provider) im Test
 * greifbar ist. */
jest.mock("../../../Database/DatabaseContext", () => ({
  ...jest.requireActual("../../../Database/DatabaseContext"),
  useDatabase: () => mockDatabase,
  DatabaseContext: React.createContext({}),
}));

/** Mock: database.events.createEvent — erster Aufruf in saveEvent() */
const mockCreateEvent = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  events: {
    createEvent: mockCreateEvent,
  },
} as any;


/**
 * Rendert die CreateEventPage innerhalb eines MemoryRouters und
 * DatabaseContext.Provider.
 */
const renderCreateEventPage = () => {
  return render(
    <MemoryRouter initialEntries={["/events/new"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <CreateEventPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};


beforeEach(() => {
  jest.clearAllMocks();
  mockEventFactory.mockReturnValue({
    uid: "",
    name: "",
    dates: [],
    cooks: [],
  });
});

describe("CreateEventPage", () => {
  test("zeigt Stepper mit allen 3 Schritt-Labels an", () => {
    renderCreateEventPage();

    expect(
      screen.getByText("Informationen zum Anlass"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Informationen zur Mengenberechnung"),
    ).toBeInTheDocument();
    expect(screen.getByText("Abschluss")).toBeInTheDocument();
  });

  test("zeigt Info-Schritt als Standard an", () => {
    renderCreateEventPage();

    expect(screen.getByTestId("event-info-page")).toBeInTheDocument();
  });

  test("navigiert zur Uebersicht bei Klick auf 'Zurueck zur Uebersicht' ohne Event zu loeschen", () => {
    renderCreateEventPage();

    const cancelButton = screen.getByText("Zurück zur Übersicht");
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  test("zeigt Fehlermeldung wenn Validierung fehlschlaegt", async () => {
    // FieldValidationError aus dem Mock-Modul verwenden
    const {FieldValidationError} =
      jest.requireMock("../../../Shared/fieldValidation.error.class");
    mockCheckEventData.mockImplementation(() => {
      throw new FieldValidationError("Validierungsfehler", [
        {fieldName: "name", errorMessage: "Name ist erforderlich"},
      ]);
    });

    renderCreateEventPage();

    const continueButton = screen.getByText("Weiter");
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

/**
 * Regressionstests für CHUCHIPIRAT-HB: goToCompletionStep() prüfte beim
 * Speichern des Events nur isRlsViolationError() für die "Sitzung
 * abgelaufen"-Behandlung — ein abgelaufener JWT (ohne RLS-Verletzung) fiel
 * in den else-Zweig und wurde unbedingt an Sentry gemeldet.
 */
describe("CreateEventPage — Sitzung abgelaufen beim Speichern", () => {
  const {captureException} = jest.requireMock("@sentry/react");

  beforeEach(() => {
    // Andere Tests in dieser Datei setzen mockCheckEventData.mockImplementation(),
    // was clearAllMocks() nicht zurücksetzt — hier explizit auf "erfolgreich" stellen,
    // damit der Übergang zum Gruppenkonfiguration-Schritt zuverlässig funktioniert.
    mockCheckEventData.mockImplementation(() => {});
  });

  /** Navigiert vom Info-Schritt zum Gruppenkonfiguration-Schritt. */
  const goToGroupConfigStep = () => {
    fireEvent.click(screen.getByText("Weiter"));
  };

  test("zeigt den Sitzungs-Hinweis und meldet einen abgelaufenen JWT NICHT an Sentry", async () => {
    mockCreateEvent.mockRejectedValue({
      code: "PGRST303",
      details: null,
      hint: null,
      message: "JWT expired",
    });

    renderCreateEventPage();
    goToGroupConfigStep();

    const confirmButton = await screen.findByText("Weiter");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Sitzung ist möglicherweise abgelaufen/),
    ).toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });

  test("zeigt den Sitzungs-Hinweis und meldet eine RLS-Verletzung weiterhin NICHT an Sentry", async () => {
    mockCreateEvent.mockRejectedValue({
      code: "42501",
      details: null,
      hint: null,
      message: 'new row violates row-level security policy for table "events"',
    });

    renderCreateEventPage();
    goToGroupConfigStep();

    const confirmButton = await screen.findByText("Weiter");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  test("meldet einen unerwarteten Fehler beim Speichern weiterhin an Sentry", async () => {
    mockCreateEvent.mockRejectedValue({
      code: "23505",
      details: null,
      hint: null,
      message: "duplicate key value violates unique constraint",
    });

    renderCreateEventPage();
    goToGroupConfigStep();

    const confirmButton = await screen.findByText("Weiter");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledTimes(1);
    });
  });
});
