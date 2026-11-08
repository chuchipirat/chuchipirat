/**
 * Unit-Tests für useItemCreationLog.
 *
 * Der Hook sammelt einen Anlegen-Vorgang (Name, gezeigte Hinweise) und
 * schreibt ihn beim Abschluss genau einmal ins Protokoll. Das Schreiben darf
 * den Dialog nie blockieren oder Fehler nach aussen werfen.
 */
import {renderHook} from "@testing-library/react";
import {
  CreationDecision,
  CreationItemType,
  CreationOrigin,
  LEGACY_RULES_VERSION,
} from "../creationLog.types";
import {LoggedNameHint, NameHintKind} from "../../Matching/nameHint.types";

const mockLogCreation = jest.fn();

// Stabile Instanz wie im echten Context.
const mockDatabase = {
  itemCreationLogs: {logCreation: mockLogCreation},
};
jest.mock("../../../Database/DatabaseContext", () => ({
  useDatabase: () => mockDatabase,
}));

const mockCaptureUnexpectedError = jest.fn();
jest.mock("../../../../utils/errorUtils", () => ({
  ...jest.requireActual("../../../../utils/errorUtils"),
  captureUnexpectedError: (...args: unknown[]) =>
    mockCaptureUnexpectedError(...args),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import {useItemCreationLog} from "../useItemCreationLog";

/* =====================================================================
// Test-Daten
// ===================================================================== */
const similarHint: LoggedNameHint = {
  kind: NameHintKind.SIMILAR_PRODUCT,
  rule: null,
  score: null,
  word: null,
  suggestions: [{id: "product-1", name: "Tomaten", source: "product"}],
};

const similarHintOtherSuggestion: LoggedNameHint = {
  ...similarHint,
  suggestions: [{id: "product-9", name: "Tomatensauce", source: "product"}],
};

const exactHint: LoggedNameHint = {
  kind: NameHintKind.EXACT_PRODUCT,
  rule: null,
  score: null,
  word: null,
  suggestions: [{id: "product-1", name: "Tomaten", source: "product"}],
};

/** Rendert den Hook für den Produkt-Dialog aus dem Rezept. */
const renderLogHook = () =>
  renderHook(() =>
    useItemCreationLog({
      itemType: CreationItemType.PRODUCT,
      origin: CreationOrigin.RECIPE,
    }),
  );

/** Wartet einen Makrotask ab, damit nicht abgewartete Promises fertig sind. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Der Eintrag, der beim n-ten Aufruf an logCreation ging. */
const loggedEntry = (callIndex = 0) => mockLogCreation.mock.calls[callIndex][0];

/** Wie viele unbehandelte Rejections während eines Tests auftraten. */
let unhandledRejections = 0;
const onUnhandledRejection = () => {
  unhandledRejections++;
};

/* =====================================================================
// Tests
// ===================================================================== */
describe("useItemCreationLog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogCreation.mockResolvedValue(undefined);
    unhandledRejections = 0;
    process.on("unhandledRejection", onUnhandledRejection);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
  });

  /* ------------------------------------------
  // Ablauf start → finish
  // ------------------------------------------ */
  describe("Ablauf", () => {
    test("schreibt einen vollständigen Eintrag mit Herkunft und Regelversion 0", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.recordHint(similarHint);
      result.current.finishAttempt({
        decision: CreationDecision.CREATED,
        finalName: "Tomaten, gehackt",
        resultProductId: "product-2",
        resultName: "Tomaten, gehackt",
      });

      expect(mockLogCreation).toHaveBeenCalledTimes(1);
      expect(loggedEntry()).toEqual({
        itemType: CreationItemType.PRODUCT,
        origin: CreationOrigin.RECIPE,
        enteredName: "Tomatem",
        finalName: "Tomaten, gehackt",
        decision: CreationDecision.CREATED,
        hints: [similarHint],
        rulesVersion: LEGACY_RULES_VERSION,
        resultProductId: "product-2",
        resultMaterialId: null,
        resultName: "Tomaten, gehackt",
      });
    });

    test("Vorschlag übernommen: Ergebnis ist der Vorschlag, kein Endname", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.recordHint(similarHint);
      result.current.finishAttempt({
        decision: CreationDecision.SUGGESTION_TAKEN,
        resultProductId: "product-1",
        resultName: "Tomaten",
      });

      expect(loggedEntry()).toMatchObject({
        decision: CreationDecision.SUGGESTION_TAKEN,
        finalName: null,
        resultProductId: "product-1",
        resultMaterialId: null,
        resultName: "Tomaten",
      });
    });

    test("setzt fehlende Ergebnisfelder bei Abbruch auf null", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(loggedEntry()).toMatchObject({
        decision: CreationDecision.CANCELLED,
        finalName: null,
        hints: [],
        resultProductId: null,
        resultMaterialId: null,
        resultName: null,
      });
    });

    test("schreibt bei zweimaligem Abschluss nur einen Eintrag", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(mockLogCreation).toHaveBeenCalledTimes(1);
    });

    test("schreibt nichts, wenn kein Vorgang gestartet wurde", () => {
      const {result} = renderLogHook();

      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(mockLogCreation).not.toHaveBeenCalled();
    });

    test("ein neuer Start verwirft den offenen Vorgang samt Hinweisen", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.recordHint(similarHint);
      result.current.startAttempt("Zimt");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(mockLogCreation).toHaveBeenCalledTimes(1);
      expect(loggedEntry()).toMatchObject({enteredName: "Zimt", hints: []});
    });
  });

  /* ------------------------------------------
  // Hinweise
  // ------------------------------------------ */
  describe("recordHint()", () => {
    test("speichert denselben Hinweis nur einmal", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomaten");
      result.current.recordHint(exactHint);
      result.current.recordHint({...exactHint});
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(loggedEntry().hints).toEqual([exactHint]);
    });

    test("speichert gleiche Art mit anderen Vorschlägen getrennt", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomaten");
      result.current.recordHint(similarHint);
      result.current.recordHint(similarHintOtherSuggestion);
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(loggedEntry().hints).toEqual([
        similarHint,
        similarHintOtherSuggestion,
      ]);
    });

    test("ein Hinweis ohne offenen Vorgang landet in keinem Eintrag", () => {
      const {result} = renderLogHook();

      result.current.recordHint(similarHint);
      result.current.startAttempt("Tomaten");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(loggedEntry().hints).toEqual([]);
    });
  });

  /* ------------------------------------------
  // Grenzfälle Name (CHECK 1–200 Zeichen in der DB)
  // ------------------------------------------ */
  describe("eingegebener Name", () => {
    test("leerer Start-Name: der Endname wird als eingegebener Name übernommen", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("");
      result.current.finishAttempt({
        decision: CreationDecision.CREATED,
        finalName: "Zimt",
        resultProductId: "product-3",
        resultName: "Zimt",
      });

      expect(loggedEntry()).toMatchObject({
        enteredName: "Zimt",
        finalName: "Zimt",
      });
    });

    test("leerer Start-Name ohne Endname: kein Eintrag", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(mockLogCreation).not.toHaveBeenCalled();
    });

    test("nur Leerzeichen zählt als leer", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("   ");
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(mockLogCreation).not.toHaveBeenCalled();
    });

    test("kürzt einen zu langen Namen auf 200 Zeichen", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("x".repeat(250));
      result.current.finishAttempt({decision: CreationDecision.CANCELLED});

      expect(loggedEntry().enteredName).toHaveLength(200);
    });
  });

  /* ------------------------------------------
  // Grenzfälle End- und Ergebnisname (CHECK 1–200 Zeichen oder NULL)
  // ------------------------------------------ */
  describe("End- und Ergebnisname", () => {
    test("kürzt zu lange Namen auf 200 Zeichen", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.finishAttempt({
        decision: CreationDecision.CREATED,
        finalName: "f".repeat(250),
        resultProductId: "product-2",
        resultName: "r".repeat(250),
      });

      expect(loggedEntry().finalName).toHaveLength(200);
      expect(loggedEntry().resultName).toHaveLength(200);
    });

    test("trimmt die Namen", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.finishAttempt({
        decision: CreationDecision.CREATED,
        finalName: "  Tomaten  ",
        resultProductId: "product-2",
        resultName: " Tomaten ",
      });

      expect(loggedEntry()).toMatchObject({
        finalName: "Tomaten",
        resultName: "Tomaten",
      });
    });

    test("nur Leerzeichen wird null", () => {
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      result.current.finishAttempt({
        decision: CreationDecision.CREATED,
        finalName: "   ",
        resultProductId: "product-2",
        resultName: "",
      });

      expect(loggedEntry()).toMatchObject({
        finalName: null,
        resultName: null,
      });
    });
  });

  /* ------------------------------------------
  // Fehlerpfad
  // ------------------------------------------ */
  describe("Fehler beim Schreiben", () => {
    test("meldet den Fehler an Sentry und wirft nichts nach aussen", async () => {
      const databaseError = {
        code: "23514",
        message: "violates check constraint",
      };
      mockLogCreation.mockRejectedValue(databaseError);
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      expect(() =>
        result.current.finishAttempt({decision: CreationDecision.CANCELLED}),
      ).not.toThrow();
      await flushPromises();

      expect(mockCaptureUnexpectedError).toHaveBeenCalledWith(
        databaseError,
        expect.objectContaining({context: expect.any(String)}),
      );
      expect(unhandledRejections).toBe(0);
    });

    test("wartet nicht auf das Schreiben (blockiert den Dialog nicht)", () => {
      mockLogCreation.mockReturnValue(new Promise(() => undefined));
      const {result} = renderLogHook();

      result.current.startAttempt("Tomatem");
      const returned: unknown = result.current.finishAttempt({
        decision: CreationDecision.CANCELLED,
      });

      expect(returned).toBeUndefined();
    });
  });

  /* ------------------------------------------
  // Stabile Referenzen
  // ------------------------------------------ */
  test("die Funktionen bleiben zwischen Renders dieselben", () => {
    const {result, rerender} = renderLogHook();
    const firstRender = result.current;

    rerender();

    expect(result.current.startAttempt).toBe(firstRender.startAttempt);
    expect(result.current.recordHint).toBe(firstRender.recordHint);
    expect(result.current.finishAttempt).toBe(firstRender.finishAttempt);
  });
});
