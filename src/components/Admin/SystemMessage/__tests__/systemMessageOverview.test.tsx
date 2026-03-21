/**
 * Unit-Tests für SystemMessageOverviewPage.
 *
 * Testet die Übersichtsseite für Systemmeldungen: initiales Laden,
 * Anzeige im DataGrid, Filter für abgelaufene Meldungen, Navigation
 * zum Erstellen/Bearbeiten, Löschen mit Bestätigung und Fehlerbehandlung.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import SystemMessageOverviewPage from "../systemMessageOverview";
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

/** Mock: useCustomDialog — simuliert den Bestätigungsdialog */
const mockCustomDialog = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Mock: Systemmeldungen für die Tests */
const futureDate = new Date("2099-12-31T23:59:59.000Z");
const mockMessages: SystemMessageDomain[] = [
  {
    uid: "msg-001",
    title: "Wartung geplant",
    text: "<p>Am Samstag.</p>",
    type: "warning",
    validTo: futureDate,
  },
  {
    uid: "msg-002",
    title: "Neues Feature",
    text: "<p>Es gibt ein Update.</p>",
    type: "info",
    validTo: futureDate,
  },
];

/** Mock: SystemMessageRepository-Methoden */
const mockGetMessages = jest.fn();
const mockDeleteMessage = jest.fn();

/** Mock-DatabaseService (nur systemMessages wird benötigt) */
const mockDatabase = {
  systemMessages: {
    getMessages: mockGetMessages,
    deleteMessage: mockDeleteMessage,
  },
} as any;

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
 * Rendert die SystemMessageOverviewPage mit allen nötigen Providern.
 */
const renderOverviewPage = (initialEntries = ["/system/systemmessages"]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <DatabaseContext.Provider value={mockDatabase}>
        <SystemMessageOverviewPage />
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
  mockGetMessages.mockResolvedValue(mockMessages);
});

describe("SystemMessageOverviewPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", {name: "Systemmeldungen"})).toBeInTheDocument();
      });
    });

    test("'Neue Meldung'-Button wird angezeigt", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Neue Systemmeldung/i})
        ).toBeInTheDocument();
      });
    });

    test("Toggle für abgelaufene Meldungen wird angezeigt", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(
          screen.getByText(/Vergangene Meldungen anzeigen/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Daten laden", () => {
    test("getMessages() wird beim Laden aufgerufen", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(false);
      });
    });

    test("Meldungstitel werden im DataGrid angezeigt", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
        expect(screen.getByText("Neues Feature")).toBeInTheDocument();
      });
    });

    test("Fehler beim Laden wird als AlertMessage angezeigt", async () => {
      mockGetMessages.mockRejectedValue(new Error("DB Fehler"));
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Filter: Abgelaufene Meldungen", () => {
    test("Toggle ruft getMessages mit includeExpired=true auf", async () => {
      renderOverviewPage();

      // Warten bis initiales Laden abgeschlossen
      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(false);
      });

      // MUI Switch ist über das FormControlLabel-Label erreichbar
      const toggle = screen.getByLabelText(/Vergangene Meldungen anzeigen/i);
      await userEvent.click(toggle);

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Navigation", () => {
    test("'Neue Meldung'-Button navigiert zu Erstellroute", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Neue Systemmeldung/i})
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Neue Systemmeldung/i})
      );

      expect(testLocation.pathname).toBe(ROUTES.SYSTEM_SYSTEM_MESSAGE_NEW);
    });

    test("Bearbeiten-Button navigiert zur Bearbeitungsroute", async () => {
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
      });

      // Bearbeiten-Button in der ersten Zeile klicken (TEXT_EDIT = "anpassen")
      const editButtons = screen.getAllByLabelText(/anpassen/i);
      await userEvent.click(editButtons[0]);

      expect(testLocation.pathname).toBe("/system/systemmessage/msg-001");
    });
  });

  describe("Löschen", () => {
    test("Löschen-Button zeigt Bestätigungsdialog", async () => {
      mockCustomDialog.mockResolvedValue(false);
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/Löschen/i);
      await userEvent.click(deleteButtons[0]);

      expect(mockCustomDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          dialogType: expect.any(Number),
        })
      );
    });

    test("Bestätigtes Löschen entfernt Meldung", async () => {
      mockCustomDialog.mockResolvedValue(true);
      mockDeleteMessage.mockResolvedValue(undefined);
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/Löschen/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockDeleteMessage).toHaveBeenCalledWith("msg-001");
      });
    });

    test("Abgebrochenes Löschen ruft deleteMessage nicht auf", async () => {
      mockCustomDialog.mockResolvedValue(false);
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/Löschen/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(mockCustomDialog).toHaveBeenCalled();
      });
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });

    test("Fehler beim Löschen wird als Alert angezeigt", async () => {
      mockCustomDialog.mockResolvedValue(true);
      mockDeleteMessage.mockRejectedValue(new Error("Delete Fehler"));
      renderOverviewPage();

      await waitFor(() => {
        expect(screen.getByText("Wartung geplant")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/Löschen/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Leerer Zustand", () => {
    test("Leere Liste wird ohne Fehler angezeigt", async () => {
      mockGetMessages.mockResolvedValue([]);
      renderOverviewPage();

      await waitFor(() => {
        expect(mockGetMessages).toHaveBeenCalled();
      });

      // Kein Fehler-Alert
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
