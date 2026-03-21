/**
 * Unit-Tests für die System-Hub-Seite (system.tsx).
 *
 * Testet die korrekte Darstellung der Sektionen, Kacheln pro Rolle,
 * Navigation und das Fehlen gelöschter Kacheln (DB Indices, Cloud FX, Temp).
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import SystemPage from "../system";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Erstellt einen AuthUser mit den angegebenen Rollen. */
const createMockAuthUser = (roles: string[]) => ({
  uid: "user-123",
  authUid: "auth-uuid-123",
  email: "test@chuchipirat.ch",
  roles,
  displayName: "Test User",
});

let mockAuthUser: ReturnType<typeof createMockAuthUser> | null = null;

jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die SystemPage mit den nötigen Providern.
 */
const renderSystemPage = () => {
  return render(
    <MemoryRouter initialEntries={["/system"]}>
      <SystemPage />
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthUser = null;
});

describe("SystemPage", () => {
  describe("Ohne AuthUser", () => {
    test("Rendert nichts wenn kein AuthUser vorhanden", () => {
      mockAuthUser = null;
      const {container} = renderSystemPage();
      // Nur der leere MemoryRouter-Container
      expect(container.innerHTML).toBe("");
    });
  });

  describe("Admin-Rolle", () => {
    beforeEach(() => {
      mockAuthUser = createMockAuthUser(["admin"]);
    });

    test("Zeigt alle vier Sektions-Header an", () => {
      renderSystemPage();
      expect(screen.getByText("Einstellungen")).toBeInTheDocument();
      expect(screen.getByText("Datenoperationen")).toBeInTheDocument();
      expect(screen.getByText("Übersichten")).toBeInTheDocument();
      expect(screen.getByText("Extern")).toBeInTheDocument();
    });

    test("Zeigt Einstellungen-Kacheln an", () => {
      renderSystemPage();
      expect(screen.getByText("Globale Einstellungen")).toBeInTheDocument();
      expect(screen.getByText("Systemmeldung")).toBeInTheDocument();
    });

    test("Zeigt alle Datenoperationen-Kacheln an", () => {
      renderSystemPage();
      expect(screen.getByText("Verfolgungsnachweis")).toBeInTheDocument();
      expect(screen.getByText("Items zusammenführen")).toBeInTheDocument();
      expect(screen.getByText("Produkt/Material umwandlen")).toBeInTheDocument();
      expect(screen.getByText("Support-User aktivieren")).toBeInTheDocument();
      expect(screen.getByText("Job-Übersicht")).toBeInTheDocument();
      expect(screen.getByText("Mail-Konsole")).toBeInTheDocument();
      expect(screen.getByText("Migration")).toBeInTheDocument();
      expect(screen.getByText("Datenintegrität")).toBeInTheDocument();
    });

    test("Zeigt alle Übersichten-Kacheln an", () => {
      renderSystemPage();
      expect(screen.getByText("Rezepte")).toBeInTheDocument();
      expect(screen.getByText("Anlässe")).toBeInTheDocument();
      expect(screen.getByText("Feed-Einträge")).toBeInTheDocument();
      expect(screen.getByText("Users")).toBeInTheDocument();
      expect(screen.getByText("Mailbox")).toBeInTheDocument();
      expect(screen.getByText("Cron Jobs")).toBeInTheDocument();
    });

    test("Zeigt externe Link-Kacheln an", () => {
      renderSystemPage();
      expect(screen.getByText("Sentry Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Supabase Dashboard")).toBeInTheDocument();
    });

    test("Gelöschte Kacheln werden nicht angezeigt", () => {
      renderSystemPage();
      expect(screen.queryByText("DB Indizes")).not.toBeInTheDocument();
      expect(screen.queryByText("Cloud-Functions")).not.toBeInTheDocument();
      expect(screen.queryByText("Temp")).not.toBeInTheDocument();
    });

    test("Navigation funktioniert bei Klick auf Kachel", async () => {
      renderSystemPage();
      const user = userEvent.setup();
      // CardActionArea rendert ein button-Element
      const whereUsedHeading = screen.getByText("Verfolgungsnachweis");
      const cardActionArea = whereUsedHeading.closest("button");
      expect(cardActionArea).toBeInTheDocument();
      await user.click(cardActionArea!);
      expect(mockNavigate).toHaveBeenCalledWith("/system/whereused");
    });

    test("Externe Links haben target=_blank", () => {
      renderSystemPage();
      const sentryLink = screen
        .getByText("Sentry Dashboard")
        .closest("a");
      expect(sentryLink).toHaveAttribute("target", "_blank");
      expect(sentryLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("CommunityLeader-Rolle", () => {
    beforeEach(() => {
      mockAuthUser = createMockAuthUser(["communityLeader"]);
    });

    test("Zeigt keine Einstellungen-Sektion an", () => {
      renderSystemPage();
      expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
    });

    test("Zeigt keine Extern-Sektion an", () => {
      renderSystemPage();
      expect(screen.queryByText("Extern")).not.toBeInTheDocument();
    });

    test("Zeigt keine admin-only Kacheln an", () => {
      renderSystemPage();
      expect(screen.queryByText("Globale Einstellungen")).not.toBeInTheDocument();
      expect(screen.queryByText("Systemmeldung")).not.toBeInTheDocument();
      expect(screen.queryByText("Job-Übersicht")).not.toBeInTheDocument();
      expect(screen.queryByText("Mail-Konsole")).not.toBeInTheDocument();
      expect(screen.queryByText("Migration")).not.toBeInTheDocument();
      expect(screen.queryByText("Users")).not.toBeInTheDocument();
      expect(screen.queryByText("Mailbox")).not.toBeInTheDocument();
      expect(screen.queryByText("Cron Jobs")).not.toBeInTheDocument();
      expect(screen.queryByText("Sentry Dashboard")).not.toBeInTheDocument();
      expect(screen.queryByText("Supabase Dashboard")).not.toBeInTheDocument();
    });

    test("Zeigt allgemein zugängliche Kacheln an", () => {
      renderSystemPage();
      expect(screen.getByText("Datenoperationen")).toBeInTheDocument();
      expect(screen.getByText("Übersichten")).toBeInTheDocument();
      expect(screen.getByText("Verfolgungsnachweis")).toBeInTheDocument();
      expect(screen.getByText("Items zusammenführen")).toBeInTheDocument();
      expect(screen.getByText("Produkt/Material umwandlen")).toBeInTheDocument();
      expect(screen.getByText("Support-User aktivieren")).toBeInTheDocument();
      expect(screen.getByText("Rezepte")).toBeInTheDocument();
      expect(screen.getByText("Anlässe")).toBeInTheDocument();
      expect(screen.getByText("Feed-Einträge")).toBeInTheDocument();
    });
  });
});
