/**
 * Unit-Tests für GlobalSettingsPage.
 *
 * Testet die Admin-Seite für globale Einstellungen: initiales Laden,
 * Bearbeitungsmodus, Einstellungsänderungen, Speichern, Alle-Abmelden-Funktion
 * und Fehlerbehandlung.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import GlobalSettingsPage from "../globalSettings";
import {DatabaseContext} from "../../../Database/DatabaseContext";

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

/** Mock: supabaseClient — für supabase.functions.invoke */
const mockInvoke = jest.fn();
jest.mock("../../../Database/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

/** Mock: GlobalSettingsRepository-Methoden */
const mockGetSettings = jest.fn();
const mockSaveSettings = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  globalSettings: {
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
  },
} as any;

/** Hilfsfunktion: Switch via ID holen (MUI Switch hat kein Label-Association in ListItem) */
const getSwitch = (id: string): HTMLInputElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Switch mit ID "${id}" nicht gefunden`);
  return el as HTMLInputElement;
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die GlobalSettingsPage mit allen nötigen Providern.
 */
const renderGlobalSettingsPage = () => {
  return render(
    <MemoryRouter initialEntries={["/system/globalsettings"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <GlobalSettingsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    allowSignUp: true,
    maintenanceMode: false,
  });
  mockSaveSettings.mockResolvedValue({
    allowSignUp: true,
    maintenanceMode: false,
  });
});

describe("GlobalSettingsPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(screen.getByRole("heading", {name: "Globale Einstellungen"})).toBeInTheDocument();
      });
    });

    test("getSettings() wird beim Laden aufgerufen", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });
    });

    test("Anpassen- und Speichern-Buttons werden angezeigt", async () => {
      renderGlobalSettingsPage();

      // TEXT_EDIT = "anpassen", TEXT_SAVE = "Speichern"
      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i})
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", {name: /Speichern/i})
        ).toBeInTheDocument();
      });
    });

    test("Speichern-Button ist initial deaktiviert", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Speichern/i})
        ).toBeDisabled();
      });
    });

    test("Switches werden mit geladenen Werten angezeigt", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        const allowSignUpSwitch = getSwitch("allowSignUp");
        expect(allowSignUpSwitch).toBeChecked();

        const maintenanceSwitch = getSwitch("maintenanceMode");
        expect(maintenanceSwitch).not.toBeChecked();
      });
    });

    test("Switches sind initial deaktiviert", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        const allowSignUpSwitch = getSwitch("allowSignUp");
        expect(allowSignUpSwitch).toBeDisabled();
      });
    });
  });

  describe("Bearbeitungsmodus", () => {
    test("Anpassen-Klick aktiviert Switches", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(getSwitch("allowSignUp")).toBeDisabled();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      expect(getSwitch("allowSignUp")).toBeEnabled();
      expect(getSwitch("maintenanceMode")).toBeEnabled();
    });

    test("Speichern-Button wird nach Anpassen-Klick aktiv", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Speichern/i})
        ).toBeDisabled();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      expect(
        screen.getByRole("button", {name: /Speichern/i})
      ).toBeEnabled();
    });

    test("Switch-Änderung aktualisiert den Wert", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(getSwitch("maintenanceMode")).not.toBeChecked();
      });

      // Bearbeitungsmodus aktivieren
      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      // Wartungsmodus aktivieren
      await userEvent.click(getSwitch("maintenanceMode"));

      expect(getSwitch("maintenanceMode")).toBeChecked();
    });
  });

  describe("Speichern", () => {
    test("Speichern ruft saveSettings mit aktuellen Werten auf", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });

      // Bearbeitungsmodus aktivieren
      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      // Speichern klicken
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(mockSaveSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            allowSignUp: true,
            maintenanceMode: false,
          }),
          mockAuthUser
        );
      });
    });

    test("Fehler beim Speichern zeigt AlertMessage an", async () => {
      mockSaveSettings.mockRejectedValue(new Error("Save Fehler"));
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalled();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Alle Benutzer abmelden", () => {
    test("'Alle abmelden'-Button wird angezeigt", async () => {
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Alle abmelden/i})
        ).toBeInTheDocument();
      });
    });

    test("Klick öffnet Bestätigungsdialog", async () => {
      mockCustomDialog.mockResolvedValue(false);
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Alle abmelden/i})
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Alle abmelden/i})
      );

      expect(mockCustomDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          dialogType: expect.any(Number),
        })
      );
    });

    test("Bestätigte Abmeldung ruft Edge Function auf", async () => {
      mockCustomDialog.mockResolvedValue(true);
      mockInvoke.mockResolvedValue({data: {count: 5}, error: null});
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Alle abmelden/i})
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Alle abmelden/i})
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("sign-out-all-users");
      });
    });

    test("Abgebrochene Abmeldung ruft Edge Function nicht auf", async () => {
      mockCustomDialog.mockResolvedValue(false);
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Alle abmelden/i})
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Alle abmelden/i})
      );

      await waitFor(() => {
        expect(mockCustomDialog).toHaveBeenCalled();
      });
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test("Fehler bei Abmeldung zeigt Alert an", async () => {
      mockCustomDialog.mockResolvedValue(true);
      mockInvoke.mockResolvedValue({
        data: null,
        error: new Error("Function Fehler"),
      });
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Alle abmelden/i})
        ).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole("button", {name: /Alle abmelden/i})
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Fehlerbehandlung beim Laden", () => {
    test("Fehler beim Laden zeigt AlertMessage an", async () => {
      mockGetSettings.mockRejectedValue(new Error("DB Fehler"));
      renderGlobalSettingsPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });
});
