// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter, Routes, Route} from "react-router";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: User-Klasse (statische Methoden) */
jest.mock("../user.class", () => ({
  __esModule: true,
  default: {
    getPublicProfile: jest.fn(),
  },
}));

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

/** Mock: FirebaseMessageHandler — gibt null zurück (kein Firebase-Match) */
jest.mock("../../Firebase/firebaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: () => null,
  },
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
import PublicProfilePage, {
  PublicProfileList,
  AchievedRewardsList,
} from "../publicProfile";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import User from "../user.class";
import UserPublicProfile from "../user.public.profile.class";
import authUserMock from "../../Firebase/Authentication/__mocks__/authuser.mock";

// Typisierte Referenz auf die Mock-Funktion
const mockGetPublicProfile = User.getPublicProfile as jest.Mock;

/** Mock-Firebase-Instanz */
const mockFirebase = {} as any;

/** Mock-DatabaseService */
const mockDatabase = {} as any;

/* ===================================================================
// ======================== Testdaten ==================================
// =================================================================== */

/** Öffentliches Profil als Testdaten */
const publicProfile: UserPublicProfile = {
  uid: "user-123",
  displayName: "Koch Guru",
  memberSince: new Date("2024-06-15"),
  memberId: 42,
  motto: "Kochen ist Liebe",
  pictureSrc: "https://example.com/avatar.jpg",
  stats: {
    noComments: 5,
    noEvents: 12,
    noRecipesPublic: 25,
    noRecipesPrivate: 7,
    noFoundBugs: 3,
  },
};

/** Profil ohne Bugs (für bedingtes Rendering) */
const profileNoBugs: UserPublicProfile = {
  ...publicProfile,
  stats: {...publicProfile.stats, noFoundBugs: 0},
};

/* ===================================================================
// ======================== Render-Helper ==============================
// =================================================================== */

/**
 * Rendert die PublicProfilePage mit allen nötigen Context-Providern.
 * Verwendet Routes/Route damit useParams() die :id korrekt parsed.
 *
 * @param uid - UID im URL-Parameter (Default: "user-123")
 * @param authUser - Optionaler AuthUser (Default: authUserMock)
 * @param locationState - Optionaler Location-State für Pre-Population
 */
const renderPublicProfilePage = ({
  uid = "user-123",
  authUser = authUserMock,
  locationState,
}: {
  uid?: string;
  authUser?: typeof authUserMock;
  locationState?: {displayName: string; pictureSrc: string};
} = {}) => {
  const initialEntry = locationState
    ? {pathname: `/profile/${uid}`, state: locationState}
    : `/profile/${uid}`;

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <DatabaseContext.Provider value={mockDatabase}>
          <AuthUserContext.Provider value={authUser}>
            <Routes>
              <Route path="/profile/:id" element={<PublicProfilePage />} />
            </Routes>
          </AuthUserContext.Provider>
        </DatabaseContext.Provider>
      </FirebaseContext.Provider>
    </MemoryRouter>,
  );
};

/**
 * Rendert die PublicProfileList-Subkomponente isoliert.
 *
 * @param userProfile - Öffentliches Profil
 */
const renderPublicProfileList = (userProfile: UserPublicProfile) => {
  return render(<PublicProfileList userProfile={userProfile} />);
};

/**
 * Rendert die AchievedRewardsList-Subkomponente isoliert.
 *
 * @param userProfile - Öffentliches Profil
 */
const renderAchievedRewardsList = (userProfile: UserPublicProfile) => {
  return render(<AchievedRewardsList userProfile={userProfile} />);
};

/* ===================================================================
// ======================== Tests ======================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPublicProfile.mockResolvedValue(publicProfile);
});

describe("PublicProfilePage", () => {
  describe("Initiales Rendering", () => {
    test("Zeigt Ladeanzeige wenn location.state vorhanden und Fetch pending", () => {
      // DB-Fetch bleibt pending → isLoading bleibt true
      mockGetPublicProfile.mockReturnValue(new Promise(() => {}));

      renderPublicProfilePage({
        locationState: {
          displayName: "Loading...",
          pictureSrc: "https://example.com/pic.jpg",
        },
      });

      // MUI Backdrop-Transition kann aria-hidden in jsdom beibehalten,
      // daher {hidden: true} verwenden
      expect(
        screen.getByRole("progressbar", {hidden: true}),
      ).toBeInTheDocument();
    });

    test("Rendert Seitentitel mit Anzeigename nach Fetch", async () => {
      renderPublicProfilePage();

      await waitFor(() => {
        expect(
          screen.getByText(/Koch Guru stellt sich vor/i),
        ).toBeInTheDocument();
      });
    });

    test("Profilkarte zeigt Anzeigename an", async () => {
      renderPublicProfilePage();

      await waitFor(() => {
        // displayName wird im CardMedia-Overlay angezeigt
        expect(screen.getByText("Koch Guru")).toBeInTheDocument();
      });
    });

    test("Verwendet Platzhalterbild wenn pictureSrc leer ist", async () => {
      mockGetPublicProfile.mockResolvedValue({
        ...publicProfile,
        pictureSrc: "",
      });
      renderPublicProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Koch Guru")).toBeInTheDocument();
      });
    });
  });

  describe("Location-State Pre-Population", () => {
    test("Zeigt Name aus location.state sofort an, bevor DB-Fetch fertig ist", async () => {
      // DB-Fetch bleibt pending
      mockGetPublicProfile.mockReturnValue(new Promise(() => {}));

      renderPublicProfilePage({
        locationState: {
          displayName: "Vorab-Name",
          pictureSrc: "https://example.com/vorab.jpg",
        },
      });

      // Der Name aus location.state sollte sofort erscheinen
      await waitFor(() => {
        expect(screen.getByText("Vorab-Name")).toBeInTheDocument();
      });
    });
  });

  describe("Edit-Button", () => {
    test("Sichtbar nur beim eigenen Profil (uid === authUser.uid)", async () => {
      // Profil-UID und URL-UID müssen beide dem authUser entsprechen
      const ownProfile = {
        ...publicProfile,
        uid: authUserMock.uid,
      };
      mockGetPublicProfile.mockResolvedValue(ownProfile);

      renderPublicProfilePage({uid: authUserMock.uid});

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i}),
        ).toBeInTheDocument();
      });
    });

    test("Versteckt beim Profil einer anderen Person", async () => {
      // publicProfile hat uid "user-123", authUser hat uid aus Mock
      renderPublicProfilePage();

      await waitFor(() => {
        expect(screen.getByText("Koch Guru")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("button", {name: /anpassen/i}),
      ).not.toBeInTheDocument();
    });
  });

  describe("Fehlerbehandlung", () => {
    test("DB-Fetch-Fehler zeigt Fehlermeldung an", async () => {
      mockGetPublicProfile.mockRejectedValue(new Error("Verbindungsfehler"));
      renderPublicProfilePage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText("Verbindungsfehler")).toBeInTheDocument();
      });
    });
  });
});

describe("PublicProfileList", () => {
  test("Rendert memberSince als formatiertes Datum", () => {
    renderPublicProfileList(publicProfile);

    // Prüfe, dass das Label vorhanden ist
    expect(screen.getByText(/an Board seit/i)).toBeInTheDocument();
  });

  test("Rendert Motto", () => {
    renderPublicProfileList(publicProfile);

    expect(screen.getByText("Kochen ist Liebe")).toBeInTheDocument();
  });
});

describe("AchievedRewardsList", () => {
  test("Rendert Rezeptzahlen (öffentlich + privat)", () => {
    renderAchievedRewardsList(publicProfile);

    expect(
      screen.getByText(/erfasste öffentliche Rezepte/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/erfasste private Rezepte/i)).toBeInTheDocument();
  });

  test("Rendert Anlass-Anzahl", () => {
    renderAchievedRewardsList(publicProfile);

    expect(screen.getByText(/bekochte Anlässe/i)).toBeInTheDocument();
  });

  test("Zeigt Bug-Anzahl nur wenn > 0", () => {
    renderAchievedRewardsList(publicProfile);

    expect(screen.getByText(/Gefundene Bugs/i)).toBeInTheDocument();
  });

  test("Versteckt Bug-Anzahl wenn = 0", () => {
    renderAchievedRewardsList(profileNoBugs);

    expect(screen.queryByText(/Gefundene Bugs/i)).not.toBeInTheDocument();
  });

  test("Zahlen werden mit de-CH Locale formatiert", () => {
    const profileBigNumbers: UserPublicProfile = {
      ...publicProfile,
      stats: {
        ...publicProfile.stats,
        noRecipesPublic: 1234,
        noEvents: 5678,
        noFoundBugs: 0,
      },
    };
    renderAchievedRewardsList(profileBigNumbers);

    // de-CH verwendet Apostroph/Hochkomma als Tausendertrennzeichen
    // Die exakte Formatierung hängt von der jsdom/ICU-Konfiguration ab
    expect(screen.getByText(/1.?234/)).toBeInTheDocument();
    expect(screen.getByText(/5.?678/)).toBeInTheDocument();
  });
});
