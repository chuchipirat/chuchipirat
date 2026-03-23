/**
 * Tests für die statische Utility-Klasse {@link Request}.
 *
 * Reine Funktions-Tests ohne Mocking — alle Methoden sind pure Functions.
 */
import {
  Request,
  RequestStatus,
  RequestType,
  RequestAction,
} from "../request.class";
import {ChangeLogEntry} from "../../Database/Repository/RequestRepository";

/* =====================================================================
// getNextPossibleTransitions
// ===================================================================== */

describe("Request.getNextPossibleTransitions", () => {
  it("gibt 1 Übergang zurück für recipePublish mit Status created", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.created,
      RequestType.recipePublish,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].toState).toBe(RequestStatus.inReview);
  });

  it("gibt 2 Übergänge zurück für recipePublish mit Status inReview", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.inReview,
      RequestType.recipePublish,
    );
    expect(transitions).toHaveLength(2);
    const targetStates = transitions.map((transition) => transition.toState);
    expect(targetStates).toContain(RequestStatus.declined);
    expect(targetStates).toContain(RequestStatus.done);
  });

  it("gibt 1 Übergang zurück für recipePublish mit Status backToAuthor", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.backToAuthor,
      RequestType.recipePublish,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].toState).toBe(RequestStatus.inReview);
  });

  it("gibt 1 Übergang zurück für reportError mit Status created", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.created,
      RequestType.reportError,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].toState).toBe(RequestStatus.inReview);
  });

  it("gibt 3 Übergänge zurück für reportError mit Status inReview", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.inReview,
      RequestType.reportError,
    );
    expect(transitions).toHaveLength(3);
    const targetStates = transitions.map((transition) => transition.toState);
    expect(targetStates).toContain(RequestStatus.declined);
    expect(targetStates).toContain(RequestStatus.backToAuthor);
    expect(targetStates).toContain(RequestStatus.done);
  });

  it("gibt 1 Übergang zurück für reportError mit Status backToAuthor", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.backToAuthor,
      RequestType.reportError,
    );
    expect(transitions).toHaveLength(1);
    expect(transitions[0].toState).toBe(RequestStatus.inReview);
  });

  it("gibt leeres Array zurück bei unbekanntem Antragstyp", () => {
    const transitions = Request.getNextPossibleTransitions(
      RequestStatus.created,
      "unknownType",
    );
    expect(transitions).toEqual([]);
  });

  it("gibt leeres Array zurück bei leerem Status", () => {
    const transitions = Request.getNextPossibleTransitions(
      "",
      RequestType.recipePublish,
    );
    expect(transitions).toEqual([]);
  });
});

/* =====================================================================
// translateStatus
// ===================================================================== */

describe("Request.translateStatus", () => {
  it.each([
    RequestStatus.created,
    RequestStatus.inReview,
    RequestStatus.declined,
    RequestStatus.backToAuthor,
    RequestStatus.done,
  ])("gibt einen nicht-leeren String zurück für Status '%s'", (status) => {
    const translated = Request.translateStatus(status);
    expect(translated).toBeTruthy();
    expect(typeof translated).toBe("string");
  });

  it("gibt den Eingabewert zurück bei unbekanntem Status", () => {
    const unknownStatus = "totallyUnknown";
    const translated = Request.translateStatus(unknownStatus);
    expect(translated).toBe(unknownStatus);
  });
});

/* =====================================================================
// translateType
// ===================================================================== */

describe("Request.translateType", () => {
  it.each([RequestType.recipePublish, RequestType.reportError])(
    "gibt einen nicht-leeren String zurück für Typ '%s'",
    (requestType) => {
      const translated = Request.translateType(requestType);
      expect(translated).toBeTruthy();
      expect(typeof translated).toBe("string");
    },
  );

  it("gibt den Eingabewert zurück bei unbekanntem Typ", () => {
    const unknownType = "totallyUnknown";
    const translated = Request.translateType(unknownType);
    expect(translated).toBe(unknownType);
  });
});

/* =====================================================================
// createChangeLogEntry
// ===================================================================== */

describe("Request.createChangeLogEntry", () => {
  const mockAuthUser = {uid: "user-123", displayName: "Test User"};
  const existingEntry: ChangeLogEntry = {
    date: "2026-01-01T00:00:00.000Z",
    userUid: "old-user",
    userDisplayName: "Old User",
    action: RequestAction.created,
    newValue: {status: RequestStatus.created},
  };

  it("erstellt einen Eintrag mit korrekter Struktur", () => {
    const newValue = {status: RequestStatus.inReview};
    const result = Request.createChangeLogEntry(
      [],
      RequestAction.changeState,
      mockAuthUser,
      newValue,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userUid: "user-123",
      userDisplayName: "Test User",
      action: RequestAction.changeState,
      newValue: {status: RequestStatus.inReview},
    });
    // Datum sollte ein ISO-String sein
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("fügt den neuen Eintrag am Anfang des Arrays ein", () => {
    const result = Request.createChangeLogEntry(
      [existingEntry],
      RequestAction.assign,
      mockAuthUser,
      {assignee: "someone"},
    );

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe(RequestAction.assign);
    expect(result[1]).toBe(existingEntry);
  });

  it("mutiert das ursprüngliche Array nicht", () => {
    const originalLog = [existingEntry];
    const originalLength = originalLog.length;

    Request.createChangeLogEntry(
      originalLog,
      RequestAction.changeState,
      mockAuthUser,
      {status: RequestStatus.done},
    );

    expect(originalLog).toHaveLength(originalLength);
  });
});

/* =====================================================================
// isClosedStatus
// ===================================================================== */

describe("Request.isClosedStatus", () => {
  it("gibt true zurück für Status done", () => {
    expect(Request.isClosedStatus(RequestStatus.done)).toBe(true);
  });

  it("gibt true zurück für Status declined", () => {
    expect(Request.isClosedStatus(RequestStatus.declined)).toBe(true);
  });

  it.each([
    RequestStatus.created,
    RequestStatus.inReview,
    RequestStatus.backToAuthor,
  ])("gibt false zurück für offenen Status '%s'", (status) => {
    expect(Request.isClosedStatus(status)).toBe(false);
  });
});
