/**
 * Unit-Tests fuer EventInfoPage.
 *
 * Testet das Rendering der Basisfelder (Name, Motto, Ort),
 * die Koch-Team-Karte, Feldaenderungen und Validierungsfehler.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {EventInfoPage} from "../eventInfo";


/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../../Shared/utils.class", () => ({
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

/** Mock: useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

/** Mock: useCustomDialog */
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
  DialogType: {Confirm: "Confirm"},
}));

/** Mock: NavigationValuesContext */
jest.mock("../../../Navigation/NavigationContext", () => {
  const ReactMock = require("react");
  return {
    NavigationValuesContext: ReactMock.createContext({
      setNavigationValues: jest.fn(),
    }),
    NavigationObject: {eventSettings: "eventSettings"},
  };
});

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "test-placeholder.png",
    }),
  },
}));

/** Mock: DialogAddUser – als leere Komponente */
jest.mock("../../../User/dialogAddUser", () => ({
  DialogAddUser: () => null,
}));

/** Mock: Event-Klasse (statische Methoden) */
jest.mock("../event.class", () => {
  const actual = jest.requireActual("../event.class");
  return {
    ...actual,
    Event: {
      ...(actual.Event || {}),
      validateDates: jest.fn().mockReturnValue([]),
      createDateEntry: jest.fn().mockReturnValue({
        uid: "new-date",
        pos: 0,
        from: new Date(0),
        to: new Date(0),
      }),
      deletePicture: jest.fn().mockResolvedValue(undefined),
      addCookToEvent: jest.fn().mockResolvedValue([]),
      removeCookFromEvent: jest.fn().mockResolvedValue([]),
    },
    EventRefDocuments: actual.EventRefDocuments ?? {},
  };
});

/** Mock: Receipt-Klasse */
jest.mock("../receipt.class", () => ({
  __esModule: true,
  Receipt: {getReceipt: jest.fn()},
}));

/** Mock: EventReceiptPdf-Komponente */
jest.mock("../eventRecipePdf", () => ({
  __esModule: true,
  EventReceiptPdf: () => null,
}));

/** Mock: User-Klasse */
jest.mock("../../../User/user.class", () => ({
  __esModule: true,
  default: {getPublicProfile: jest.fn()},
}));

/** Mock: @react-pdf/renderer */
jest.mock("@react-pdf/renderer", () => ({
  StyleSheet: {create: jest.fn((styles: unknown) => styles)},
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Image: "Image",
  Font: {register: jest.fn()},
  pdf: jest.fn(),
}));

/** Mock: file-saver */
jest.mock("file-saver", () => ({
  saveAs: jest.fn(),
}));

/** Mock: getImageUrl */
jest.mock("../../../Shared/imageUrl", () => ({
  getImageUrl: jest.fn((url: string) => url),
  ImageSize: {AVATAR: "avatar"},
}));

/** Mock: DatePicker – vereinfachte Input-Komponente */
jest.mock("@mui/x-date-pickers", () => ({
  DatePicker: (props: any) => (
    <input
      data-testid={`datepicker-${props.label}`}
      value={props.value ? props.value.toISOString() : ""}
      onChange={() => props.onChange?.(new Date())}
    />
  ),
}));


/** Testdaten: Ein Event mit einem Koch und einer Datumsperiode. */
const mockEvent = {
  uid: "evt-1",
  name: "Sommerlager",
  motto: "Abenteuer",
  location: "Pfadiheim",
  dates: [
    {
      uid: "date-1",
      pos: 1,
      from: new Date("2027-06-15"),
      to: new Date("2027-06-20"),
    },
  ],
  cooks: [
    {
      uid: "user-123",
      displayName: "Max Muster",
      motto: "Kochen ist toll",
      pictureSrc: "",
    },
  ],
  pictureSrc: "",
  refDocuments: [],
};

const mockFirebase = {} as any;
const mockDatabase = {
  donations: {
    getEventDonations: jest.fn().mockResolvedValue([]),
  },
} as any;
const mockAuthUser = {uid: "user-123", roles: []} as any;
const mockOnUpdateEvent = jest.fn();
const mockOnUpdatePicture = jest.fn();
const mockOnFormValidationUpdate = jest.fn();
const mockOnError = jest.fn();


/**
 * Rendert die EventInfoPage mit Standard-Props.
 * Optionale Overrides koennen uebergeben werden.
 *
 * @param overrides Partielle Props, die die Standardwerte ueberschreiben.
 * @returns Das Render-Ergebnis von @testing-library/react.
 */
const renderEventInfoPage = (overrides: Record<string, any> = {}) => {
  const defaultProps = {
    event: mockEvent as any,
    localPicture: null,
    firebase: mockFirebase,
    database: mockDatabase,
    authUser: mockAuthUser,
    formValidation: [],
    onUpdateEvent: mockOnUpdateEvent,
    onUpdatePicture: mockOnUpdatePicture,
    onFormValidationUpdate: mockOnFormValidationUpdate,
    onError: mockOnError,
  };

  return render(<EventInfoPage {...defaultProps} {...overrides} />);
};


beforeEach(() => {
  jest.clearAllMocks();
});

describe("EventInfoPage", () => {
  test("zeigt das Namensfeld mit dem Event-Namen an", () => {
    renderEventInfoPage();

    const nameField = screen.getByDisplayValue("Sommerlager");
    expect(nameField).toBeInTheDocument();
  });

  test("zeigt das Motto-Feld mit dem Event-Motto an", () => {
    renderEventInfoPage();

    const mottoField = screen.getByDisplayValue("Abenteuer");
    expect(mottoField).toBeInTheDocument();
  });

  test("zeigt das Ort-Feld mit dem Event-Ort an", () => {
    renderEventInfoPage();

    const locationField = screen.getByDisplayValue("Pfadiheim");
    expect(locationField).toBeInTheDocument();
  });

  test("zeigt die Kuechenteam-Karte an", () => {
    renderEventInfoPage();

    expect(screen.getByText("Küchen-Crew")).toBeInTheDocument();
  });

  test("ruft onUpdateEvent beim Aendern des Namensfeldes auf", () => {
    renderEventInfoPage();

    const nameField = screen.getByDisplayValue("Sommerlager");
    fireEvent.change(nameField, {target: {name: "name", value: "Herbstlager"}});

    expect(mockOnUpdateEvent).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateEvent).toHaveBeenCalledWith(
      expect.objectContaining({name: "Herbstlager"}),
    );
  });

  test("zeigt Validierungsfehler fuer das Namensfeld an", () => {
    const formValidation = [
      {priority: 1, fieldName: "name", errorMessage: "Name darf nicht leer sein"},
    ];

    renderEventInfoPage({formValidation});

    expect(
      screen.getByText("Name darf nicht leer sein"),
    ).toBeInTheDocument();
  });

  test("zeigt den Koch in der Kochliste an", () => {
    renderEventInfoPage();

    expect(screen.getByText("Max Muster")).toBeInTheDocument();
  });
});
