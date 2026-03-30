/**
 * Tests für den RequestService — prüft Post-Actions nach Statusübergängen.
 *
 * Verifiziert, dass je nach Antragstyp und neuem Status die richtigen
 * Aktionen ausgelöst werden (Rezeptveröffentlichung, Benachrichtigungen,
 * Feed-Einträge) und dass Fehler korrekt an Sentry gemeldet werden.
 */
import * as Sentry from "@sentry/react";
import {RequestService} from "../requestService";
import {RequestStatus, RequestType} from "../request.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {FeedType} from "../../Shared/feed.class";
import type {RequestDomain} from "../../Database/Repository/RequestRepository";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// Mocks
// ===================================================================== */

jest.mock("../../Database/supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({data: null, error: null}),
    },
  },
}));

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

// Zugriff auf die gemockte invoke-Funktion nach dem Hoisting
import {supabase} from "../../Database/supabaseClient";
const mockInvoke = supabase.functions.invoke as jest.Mock;

/* =====================================================================
// Hilfsfunktionen und Fixtures
// ===================================================================== */

/** Erzeugt ein minimales RequestDomain-Objekt für Tests. */
function createMockRequest(
  overrides: Partial<RequestDomain> = {},
): RequestDomain {
  return {
    uid: "request-123",
    number: 1,
    status: RequestStatus.inReview,
    requestType: RequestType.recipePublish,
    recipeUid: "recipe-456",
    authorUid: "author-789",
    authorDisplayName: "Test Author",
    authorPictureSrc: "",
    assigneeUid: "assignee-111",
    assigneeDisplayName: "Test Assignee",
    assigneePictureSrc: "",
    recipeName: "Testrezept",
    recipePictureSrc: "",
    changeLog: [],
    resolveDate: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Erzeugt ein minimales AuthUser-Objekt für Tests. */
function createMockAuthUser(): AuthUser {
  const authUser = new AuthUser();
  authUser.uid = "admin-user-001";
  authUser.publicProfile = {
    displayName: "Admin User",
    motto: "",
    pictureSrc: "",
  };
  authUser.roles = [];
  return authUser;
}

/** Erzeugt ein gemocktes DatabaseService-Objekt mit den nötigen Methoden. */
function createMockDatabase() {
  return {
    recipes: {
      patch: jest.fn().mockResolvedValue(undefined),
    },
    feeds: {
      insertFeed: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as import("../../Database/DatabaseService").DatabaseService;
}

describe("RequestService", () => {
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let mockAuthUser: AuthUser;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = createMockDatabase();
    mockAuthUser = createMockAuthUser();
  });

  /* ===================================================================
  // executePostAction
  // =================================================================== */

  describe("executePostAction", () => {
    it("sollte bei recipePublish + done das Rezept veröffentlichen, Notification auslösen und Feed erstellen", async () => {
      const request = createMockRequest({
        requestType: RequestType.recipePublish,
      });

      await RequestService.executePostAction(
        request,
        RequestStatus.done,
        mockDatabase,
        mockAuthUser,
      );

      // Rezept wird auf 'public' gesetzt
      expect(
        (mockDatabase.recipes.patch as jest.Mock),
      ).toHaveBeenCalledWith({
        id: "recipe-456",
        fields: {recipe_type: RecipeType.public},
        authUser: mockAuthUser,
      });

      // E-Mail-Benachrichtigung wird ausgelöst
      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "requestRecipePublished",
          requestId: "request-123",
          commentId: undefined,
        },
      });

      // Feed-Eintrag wird erstellt
      expect(
        (mockDatabase.feeds.insertFeed as jest.Mock),
      ).toHaveBeenCalledWith(
        {
          feedType: FeedType.recipePublished,
          sourceObjectType: "recipe",
          sourceObjectUid: "recipe-456",
          userUid: "author-789",
        },
        mockAuthUser,
      );
    });

    it("sollte bei recipePublish + declined die Notification 'requestDeclined' auslösen", async () => {
      const request = createMockRequest({
        requestType: RequestType.recipePublish,
      });

      await RequestService.executePostAction(
        request,
        RequestStatus.declined,
        mockDatabase,
        mockAuthUser,
      );

      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "requestDeclined",
          requestId: "request-123",
          commentId: undefined,
        },
      });

      // Rezept darf nicht verändert werden
      expect(
        (mockDatabase.recipes.patch as jest.Mock),
      ).not.toHaveBeenCalled();
    });

    it("sollte bei reportError + done die Notification 'requestReportErrorFixed' auslösen", async () => {
      const request = createMockRequest({
        requestType: RequestType.reportError,
      });

      await RequestService.executePostAction(
        request,
        RequestStatus.done,
        mockDatabase,
        mockAuthUser,
      );

      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "requestReportErrorFixed",
          requestId: "request-123",
          commentId: undefined,
        },
      });
    });

    it("sollte bei reportError + inReview (von backToAuthor) die Notification 'requestBackToReview' auslösen", async () => {
      const request = createMockRequest({
        requestType: RequestType.reportError,
      });

      await RequestService.executePostAction(
        request,
        RequestStatus.inReview,
        mockDatabase,
        mockAuthUser,
        RequestStatus.backToAuthor,
      );

      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "requestBackToReview",
          requestId: "request-123",
          commentId: undefined,
        },
      });
    });

    it("sollte bei Fehler Sentry.captureException aufrufen und nicht werfen", async () => {
      const simulatedError = new Error("DB-Verbindung fehlgeschlagen");
      (mockDatabase.recipes.patch as jest.Mock).mockRejectedValue(
        simulatedError,
      );
      // Feed auch fehlschlagen lassen, damit der Gesamtblock den Fehler fängt
      (mockDatabase.feeds.insertFeed as jest.Mock).mockRejectedValue(
        simulatedError,
      );

      const request = createMockRequest({
        requestType: RequestType.recipePublish,
      });

      // Darf keinen Fehler werfen — Post-Actions blockieren den Hauptfluss nicht
      await expect(
        RequestService.executePostAction(
          request,
          RequestStatus.done,
          mockDatabase,
          mockAuthUser,
        ),
      ).resolves.toBeUndefined();

      // Der Fehler vom patch wird im inneren try/catch gefangen
      expect(Sentry.captureException).toHaveBeenCalledWith(simulatedError);
    });
  });

  /* ===================================================================
  // triggerNewRequestNotification
  // =================================================================== */

  describe("triggerNewRequestNotification", () => {
    it("sollte recipePublish auf 'newRecipePublishRequest' und reportError auf 'newReportErrorRequest' mappen", () => {
      RequestService.triggerNewRequestNotification(
        RequestType.recipePublish,
        "req-aaa",
      );

      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "newRecipePublishRequest",
          requestId: "req-aaa",
          commentId: undefined,
        },
      });

      mockInvoke.mockClear();

      RequestService.triggerNewRequestNotification(
        RequestType.reportError,
        "req-bbb",
      );

      expect(mockInvoke).toHaveBeenCalledWith("notify-request", {
        body: {
          scenario: "newReportErrorRequest",
          requestId: "req-bbb",
          commentId: undefined,
        },
      });
    });
  });
});
