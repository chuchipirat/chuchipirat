// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

// URL.createObjectURL/revokeObjectURL existieren nicht in jsdom
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: User-Klasse (statische Methoden) */
jest.mock("../user.class", () => {
  // Konstruktor als Funktion (wird für initialState benötigt)
  function MockUser() {
    (this as any).uid = "";
    (this as any).firstName = "";
    (this as any).lastName = "";
    (this as any).email = "";
    (this as any).noLogins = 0;
    (this as any).roles = [];
  }
  MockUser.getFullProfile = jest.fn();
  MockUser.saveFullProfile = jest.fn();
  MockUser.uploadPicture = jest.fn();
  MockUser.deletePicture = jest.fn();
  MockUser.checkUserProfileData = jest.fn();

  return {__esModule: true, default: MockUser};
});

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "placeholder.png",
    }),
  },
}));

/** Mock: imageUrl — gibt URL unverändert zurück */
jest.mock("../../Shared/imageUrl", () => ({
  getImageUrl: (url: string) => url,
  ImageSize: {AVATAR: 50, PROFILE_CARD: 600, FULL: 1200},
}));

/** Mock: imageResize (Canvas ist in jsdom nicht verfügbar) */
jest.mock("../../Shared/imageResize", () => ({
  resizeImage: jest
    .fn()
    .mockResolvedValue(new Blob(["resized"], {type: "image/jpeg"})),
}));

/** Mock: customDialogContext — nur benötigte Exporte */
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

/** Mock: FirebaseMessageHandler */
jest.mock("../../Firebase/firebaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: (error: Error) => error.message,
  },
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import UserProfilePage from "../userProfile";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import User from "../user.class";
import authUserMock from "../../Firebase/Authentication/__mocks__/authuser.mock";

// Typisierte Referenzen auf die Mock-Funktionen
const mockGetFullProfile = User.getFullProfile as jest.Mock;
const mockSaveFullProfile = User.saveFullProfile as jest.Mock;
const mockUploadPicture = User.uploadPicture as jest.Mock;
const mockDeletePicture = User.deletePicture as jest.Mock;
const mockCheckUserProfileData = User.checkUserProfileData as jest.Mock;

/** Mock-Firebase-Instanz */
const mockFirebase = {} as any;

/** Mock-DatabaseService */
const mockDatabase = {} as any;

/* ===================================================================
// ======================== Testdaten ==================================
// =================================================================== */

/** Vollständiges Benutzerprofil als Testdaten */
const fullProfile = {
  uid: authUserMock.uid,
  firstName: "Test",
  lastName: "Jest",
  email: "test@chuchipirat.ch",
  noLogins: 42,
  roles: [],
  displayName: "Test User",
  memberSince: new Date("2024-01-15"),
  memberId: 1,
  motto: "Testing is fun!",
  pictureSrc: "https://example.com/profile.jpg",
  stats: {
    noComments: 5,
    noEvents: 10,
    noRecipesPublic: 8,
    noRecipesPrivate: 3,
    noFoundBugs: 2,
  },
};

/* ===================================================================
// ======================== Render-Helper ==============================
// =================================================================== */

/**
 * Rendert die UserProfilePage mit allen nötigen Context-Providern.
 *
 * @param authUser - Optionaler AuthUser (Default: authUserMock)
 */
const renderUserProfilePage = (authUser = authUserMock) => {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <DatabaseContext.Provider value={mockDatabase}>
          <AuthUserContext.Provider value={authUser}>
            <UserProfilePage />
          </AuthUserContext.Provider>
        </DatabaseContext.Provider>
      </FirebaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests ======================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  // Standard: getFullProfile liefert Profildaten
  mockGetFullProfile.mockResolvedValue(fullProfile);
});

describe("UserProfilePage", () => {
  describe("Initiales Rendering", () => {
    test("Zeigt Ladeanzeige während des Fetch an", () => {
      // getFullProfile bleibt pending
      mockGetFullProfile.mockReturnValue(new Promise(() => {}));
      renderUserProfilePage();

      // MUI Backdrop-Transition kann aria-hidden in jsdom beibehalten,
      // daher {hidden: true} verwenden
      expect(
        screen.getByRole("progressbar", {hidden: true}),
      ).toBeInTheDocument();
    });

    test("Rendert Seitentitel mit Anzeigename des Users", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/Hoi Test User/i)).toBeInTheDocument();
      });
    });

    test("Rendert alle drei Karten nach erfolgreichem Fetch", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        // Profil-Karte: Vorname + Nachname wird angezeigt
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      // PublicProfile-Karte: Überschrift «Stell dich vor»
      expect(screen.getByText("Stell dich vor")).toBeInTheDocument();

      // Rewards-Karte: Überschrift «Gefundene Schätze»
      expect(screen.getByText("Gefundene Schätze")).toBeInTheDocument();
    });

    test("Zeigt Fehlermeldung wenn Fetch fehlschlägt", async () => {
      mockGetFullProfile.mockRejectedValue(new Error("DB connection failed"));
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("DB connection failed")).toBeInTheDocument();
      });
    });

    test("Edit-Button ist sichtbar, Save-Button initial nicht", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", {name: /anpassen/i}),
      ).toBeInTheDocument();

      // Save-Button nur im Edit-Mode sichtbar
      expect(
        screen.queryByRole("button", {name: /Speichern/i}),
      ).not.toBeInTheDocument();
    });
  });

  describe("Bearbeitungsmodus", () => {
    test("Klick auf Edit schaltet Felder auf editierbare TextFields um", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Im Editiermodus werden TextFields angezeigt
      expect(screen.getByDisplayValue("Test")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jest")).toBeInTheDocument();
    });

    test("Kamera-Icon (Upload) erscheint im Bearbeitungsmodus", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      // Vor dem Editiermodus kein Upload-Input
      expect(
        document.getElementById("icon-button-file"),
      ).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Upload-Input vorhanden
      expect(document.getElementById("icon-button-file")).toBeInTheDocument();
    });

    test("Löschen-Icon nur sichtbar wenn pictureSrc nicht leer ist", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Profil hat pictureSrc → Delete-Icon soll da sein
      expect(screen.getByTestId("DeleteIcon")).toBeInTheDocument();
    });

    test("Löschen-Icon ist nicht sichtbar wenn pictureSrc leer ist", async () => {
      mockGetFullProfile.mockResolvedValue({
        ...fullProfile,
        pictureSrc: "",
      });
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      expect(screen.queryByTestId("DeleteIcon")).not.toBeInTheDocument();
    });

    test("E-Mail-Feld ist im Bearbeitungsmodus deaktiviert", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      const emailField = screen.getByDisplayValue("test@chuchipirat.ch");
      expect(emailField).toBeDisabled();
    });
  });

  describe("Feld-Bearbeitung", () => {
    test("Eingabe in firstName aktualisiert den angezeigten Wert", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      const firstNameField = screen.getByDisplayValue("Test");
      await userEvent.clear(firstNameField);
      await userEvent.type(firstNameField, "Max");

      expect(firstNameField).toHaveValue("Max");
    });

    test("Eingabe in displayName aktualisiert den angezeigten Wert", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      const displayNameField = screen.getByDisplayValue("Test User");
      await userEvent.clear(displayNameField);
      await userEvent.type(displayNameField, "New Name");

      expect(displayNameField).toHaveValue("New Name");
    });
  });

  describe("Speicher-Ablauf", () => {
    test("Validierungsfehler zeigt Fehlermeldung an", async () => {
      mockCheckUserProfileData.mockImplementation(() => {
        throw new Error("Displayname fehlt");
      });
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      // Edit-Modus aktivieren, damit Save-Button erscheint
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Displayname fehlt")).toBeInTheDocument();
      });
    });

    test("Erfolgreiches Speichern zeigt Erfolgs-Snackbar", async () => {
      mockCheckUserProfileData.mockImplementation(() => {});
      mockSaveFullProfile.mockResolvedValue(undefined);
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      await waitFor(() => {
        expect(
          screen.getByText(/Dein Profil wurde gespeichert/i),
        ).toBeInTheDocument();
      });
    });

    test("localStorage wird nach erfolgreichem Speichern geleert", async () => {
      mockCheckUserProfileData.mockImplementation(() => {});
      mockSaveFullProfile.mockResolvedValue(undefined);

      const removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      await waitFor(() => {
        expect(removeItemSpy).toHaveBeenCalledWith("authUser");
      });

      removeItemSpy.mockRestore();
    });

    test("Fehler beim Speichern zeigt Fehlermeldung an", async () => {
      mockCheckUserProfileData.mockImplementation(() => {});
      mockSaveFullProfile.mockRejectedValue(
        new Error("Speichern fehlgeschlagen"),
      );
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(
          screen.getByText("Speichern fehlgeschlagen"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Bild-Upload", () => {
    test("Nach Upload verschwindet der Ladebalken", async () => {
      mockUploadPicture.mockResolvedValue("https://example.com/new-pic.jpg");
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      const file = new File(["test"], "photo.jpg", {type: "image/jpeg"});
      const input = document.getElementById(
        "icon-button-file",
      ) as HTMLInputElement;
      await userEvent.upload(input, file);

      // Upload abgeschlossen — kein LinearProgress mehr
      await waitFor(() => {
        // LinearProgress hat role="progressbar"
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      });
    });
  });

  describe("Bild löschen", () => {
    test("Bestätigung löst Löschen aus und zeigt Info-Snackbar", async () => {
      mockCustomDialog.mockResolvedValue(true);
      mockDeletePicture.mockResolvedValue(undefined);
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Auf Delete-Button klicken (Fab mit DeleteIcon)
      // Fab hat component="span", daher über CSS-Klasse selektieren
      const deleteIcon = screen.getByTestId("DeleteIcon");
      await userEvent.click(deleteIcon.closest(".MuiFab-root")!);

      await waitFor(() => {
        expect(mockDeletePicture).toHaveBeenCalled();
        expect(screen.getByText(/Bild wurde gelöscht/i)).toBeInTheDocument();
      });
    });

    test("Abbrechen löst kein Löschen aus", async () => {
      mockCustomDialog.mockResolvedValue(false);
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Test Jest")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Fab hat component="span", daher über CSS-Klasse selektieren
      const deleteIcon = screen.getByTestId("DeleteIcon");
      await userEvent.click(deleteIcon.closest(".MuiFab-root")!);

      await waitFor(() => {
        expect(mockDeletePicture).not.toHaveBeenCalled();
      });
    });
  });

  describe("Passwort ändern", () => {
    test("Passwort-Button ist sichtbar", async () => {
      renderUserProfilePage();

      await waitFor(() => {
        expect(screen.getByText(/Hoi Test User/i)).toBeInTheDocument();
      });

      const pwButton = screen.getByRole("button", {
        name: /Mail \/ Passwort ändern/i,
      });
      expect(pwButton).toBeInTheDocument();
    });
  });
});
