/**
 * Unit-Tests für SystemMessagePage und AlertSystemMessage.
 *
 * Testet die Editor-Seite für Systemmeldungen im Erstell- und Bearbeitmodus:
 * Formularrendering, Feldänderungen, Speicherlogik und Fehlerbehandlung.
 * Zusätzlich wird die AlertSystemMessage-Komponente getestet.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation, Route, Routes} from "react-router";

/** Mock: CSS-Import von react-quill-new (Jest kann kein CSS verarbeiten) */
jest.mock("react-quill-new/dist/quill.snow.css", () => ({}));

import SystemMessagePage, {AlertSystemMessage} from "../systemMessage";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {SystemMessageDomain} from "../../../Database/Repository/SystemMessageRepository";
import * as ROUTES from "../../../../constants/routes";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen Admin-Benutzer zurück */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["admin"],
};
jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Mock: ReactQuill — vereinfacht als Textarea */
jest.mock("react-quill-new", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val: string) => void;
  }) => (
    <textarea
      data-testid="quill-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

/** Mock: DatePicker — vereinfacht als Input */
jest.mock("@mui/x-date-pickers/DatePicker", () => ({
  DatePicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | null;
    onChange: (date: Date | null) => void;
  }) => (
    <input
      data-testid="date-picker"
      aria-label={label}
      value={value ? value.toISOString().split("T")[0] : ""}
      onChange={(e) => {
        const date = e.target.value ? new Date(e.target.value) : null;
        onChange(date);
      }}
    />
  ),
}));

/** Mock: SystemMessage-Repository-Methoden */
const mockFindById = jest.fn();
const mockCreateMessage = jest.fn();
const mockUpdateMessage = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  systemMessages: {
    findById: mockFindById,
    createMessage: mockCreateMessage,
    updateMessage: mockUpdateMessage,
  },
} as any;

/** Bestehende Meldung für den Bearbeitungsmodus */
const existingMessage: SystemMessageDomain = {
  uid: "msg-edit-001",
  title: "Wartung geplant",
  text: "<p>Am Samstag.</p>",
  type: "warning",
  validTo: new Date("2099-06-15T23:59:59.000Z"),
};

/** Location-Helfer für Navigations-Assertions */
let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die SystemMessagePage im Erstellmodus (:id = "new").
 */
const renderNewMode = () => {
  return render(
    <MemoryRouter initialEntries={["/system/systemmessage/new"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <Routes>
          <Route path="/system/systemmessage/:id" element={<SystemMessagePage />} />
          <Route
            path={ROUTES.SYSTEM_SYSTEM_MESSAGES}
            element={<div data-testid="overview-page">Übersicht</div>}
          />
        </Routes>
        <LocationDisplay />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/**
 * Rendert die SystemMessagePage im Bearbeitungsmodus mit vorhandener ID.
 */
const renderEditMode = (messageId = "msg-edit-001") => {
  return render(
    <MemoryRouter initialEntries={[`/system/systemmessage/${messageId}`]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <Routes>
          <Route path="/system/systemmessage/:id" element={<SystemMessagePage />} />
          <Route
            path={ROUTES.SYSTEM_SYSTEM_MESSAGES}
            element={<div data-testid="overview-page">Übersicht</div>}
          />
        </Routes>
        <LocationDisplay />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockResolvedValue(existingMessage);
  mockCreateMessage.mockResolvedValue({id: "new-id-123", value: existingMessage});
  mockUpdateMessage.mockResolvedValue(existingMessage);
});

describe("SystemMessagePage", () => {
  describe("Erstellmodus (new)", () => {
    test("Seitentitel zeigt 'Neue Systemmeldung'", () => {
      renderNewMode();

      expect(screen.getByRole("heading", {name: "Neue Systemmeldung"})).toBeInTheDocument();
    });

    test("Titel-Feld ist leer", () => {
      renderNewMode();

      const titleField = screen.getByLabelText(/Titel/i);
      expect(titleField).toHaveValue("");
    });

    test("findById wird nicht aufgerufen", () => {
      renderNewMode();

      expect(mockFindById).not.toHaveBeenCalled();
    });

    test("Speichern-Button ist vorhanden", () => {
      renderNewMode();

      expect(
        screen.getByRole("button", {name: /Speichern/i})
      ).toBeInTheDocument();
    });

    test("Speichern ruft createMessage auf", async () => {
      renderNewMode();

      // Titel eingeben
      const titleField = screen.getByLabelText(/Titel/i);
      await userEvent.type(titleField, "Neue Meldung");

      // Speichern klicken
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(mockCreateMessage).toHaveBeenCalledWith(
          expect.objectContaining({title: "Neue Meldung"}),
          mockAuthUser
        );
      });
    });

    test("Nach erfolgreichem Speichern wird zur Übersicht navigiert", async () => {
      renderNewMode();

      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(testLocation.pathname).toBe(ROUTES.SYSTEM_SYSTEM_MESSAGES);
      });
    });
  });

  describe("Bearbeitungsmodus (edit)", () => {
    test("Seitentitel zeigt 'Systemmeldung bearbeiten'", async () => {
      renderEditMode();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", {name: "Systemmeldung bearbeiten"})
        ).toBeInTheDocument();
      });
    });

    test("findById wird mit der ID aufgerufen", async () => {
      renderEditMode();

      await waitFor(() => {
        expect(mockFindById).toHaveBeenCalledWith("msg-edit-001");
      });
    });

    test("Geladene Meldung wird im Formular angezeigt", async () => {
      renderEditMode();

      await waitFor(() => {
        const titleField = screen.getByLabelText(/Titel/i);
        expect(titleField).toHaveValue("Wartung geplant");
      });
    });

    test("Speichern ruft updateMessage auf", async () => {
      renderEditMode();

      // Warten bis Daten geladen
      await waitFor(() => {
        expect(screen.getByLabelText(/Titel/i)).toHaveValue("Wartung geplant");
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(mockUpdateMessage).toHaveBeenCalledWith(
          "msg-edit-001",
          expect.objectContaining({title: "Wartung geplant"}),
          mockAuthUser
        );
      });
    });

    test("Fehler beim Laden zeigt AlertMessage an", async () => {
      mockFindById.mockResolvedValue(null);
      renderEditMode();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Formular-Interaktion", () => {
    test("Titel-Feld kann bearbeitet werden", async () => {
      renderNewMode();

      const titleField = screen.getByLabelText(/Titel/i);
      await userEvent.type(titleField, "Test-Titel");

      expect(titleField).toHaveValue("Test-Titel");
    });

    test("ReactQuill-Editor ist vorhanden", () => {
      renderNewMode();

      expect(screen.getByTestId("quill-editor")).toBeInTheDocument();
    });

    test("DatePicker ist vorhanden", () => {
      renderNewMode();

      expect(screen.getByTestId("date-picker")).toBeInTheDocument();
    });

    test("Typ-Auswahl ist vorhanden und zeigt Standard-Typ", () => {
      renderNewMode();

      // Der Standard-Typ ist "info"
      expect(screen.getByText("info")).toBeInTheDocument();
    });
  });

  describe("Fehlerbehandlung", () => {
    test("Fehler beim Speichern zeigt AlertMessage an", async () => {
      mockCreateMessage.mockRejectedValue(new Error("Save Fehler"));
      renderNewMode();

      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      // "Warte mal kurz...." ist der Titel der Fehler-AlertMessage
      await waitFor(() => {
        expect(screen.getByText(/Warte mal kurz/i)).toBeInTheDocument();
      });
    });
  });

  describe("Vorschau", () => {
    test("Vorschau-Bereich wird angezeigt", () => {
      renderNewMode();

      expect(screen.getByText(/Vorschau/i)).toBeInTheDocument();
    });
  });
});

describe("AlertSystemMessage", () => {
  test("Zeigt Titel und Text an", () => {
    render(
      <AlertSystemMessage
        systemMessage={{
          title: "Testmeldung",
          text: "<p>Inhalt der Meldung</p>",
          type: "info",
        }}
      />
    );

    expect(screen.getByText("Testmeldung")).toBeInTheDocument();
    expect(screen.getByText("Inhalt der Meldung")).toBeInTheDocument();
  });

  test("Zeigt Alert mit korrektem Schweregrad", () => {
    render(
      <AlertSystemMessage
        systemMessage={{
          title: "Warnung",
          text: "<p>Achtung!</p>",
          type: "warning",
        }}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("MuiAlert-standardWarning");
  });

  test("Zeigt keinen Titel wenn leer", () => {
    render(
      <AlertSystemMessage
        systemMessage={{
          title: "",
          text: "<p>Nur Text</p>",
          type: "success",
        }}
      />
    );

    // AlertTitle sollte nicht gerendert werden
    expect(screen.queryByText("", {selector: ".MuiAlertTitle-root"})).not.toBeInTheDocument();
    expect(screen.getByText("Nur Text")).toBeInTheDocument();
  });
});
