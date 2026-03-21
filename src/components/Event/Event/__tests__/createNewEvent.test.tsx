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

import CreateEventPage from "../createNewEvent";
import {DatabaseContext} from "../../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

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
      TWINT_QR_CODE: "test-qr.png",
    }),
  },
}));

/** Mock: useFirebase (noch fuer andere Komponenten referenziert) */
jest.mock("../../../Firebase/firebaseContext", () => ({
  useFirebase: () => ({}),
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
  default: () => <div data-testid="event-info-page">EventInfoPage</div>,
}));

/** Mock: EventGroupConfigurationPage (Stub) */
jest.mock("../../GroupConfiguration/groupConfiguration", () => ({
  __esModule: true,
  default: () => <div data-testid="group-config-page">GroupConfigPage</div>,
}));

/** Mock: TwintButton (Stub) */
jest.mock("../../../Shared/TwintButton", () => ({
  __esModule: true,
  default: () => <div data-testid="twint-button">TwintButton</div>,
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
    default: EventMock,
  };
});

/** Mock: EventGroupConfiguration.class */
jest.mock("../../GroupConfiguration/groupConfiguration.class", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
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

/** Mock: useDatabase */
jest.mock("../../../Database/DatabaseContext", () => ({
  ...jest.requireActual("../../../Database/DatabaseContext"),
  useDatabase: () => ({}),
  DatabaseContext: React.createContext({}),
}));

/** Mock-DatabaseService */
const mockDatabase = {} as any;

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

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

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

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
