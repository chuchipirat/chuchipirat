/**
 * Unit-Tests für die Hilfsfunktionen der Datenintegritätsseite.
 */
import {
  EVENT_CLEANUP_OPTIONS,
  buildCleanupParams,
  buildSingleDeleteMessage,
  describeEventAnomaly,
  getBulkDeletableAnomalies,
  isEmptyEvent,
} from "../dataIntegrityUtils";

describe("isEmptyEvent", () => {
  test("nur ein striktes true gilt als leer", () => {
    expect(isEmptyEvent({is_empty: true})).toBe(true);
    expect(isEmptyEvent({is_empty: false})).toBe(false);
  });

  test.each([undefined, null, "true", 1])(
    "fehlendes/ungültiges Feld (%p) gilt als nicht leer (kein Löschen bei älterer DB)",
    (value) => {
      expect(isEmptyEvent({is_empty: value})).toBe(false);
    },
  );

  test("Objekt ohne is_empty gilt als nicht leer", () => {
    expect(isEmptyEvent({event_id: "a"})).toBe(false);
  });
});

describe("describeEventAnomaly", () => {
  const fullAnomaly = {
    is_empty: false,
    created_at: "2026-11-12T12:00:00+00:00",
    created_by_name: "Anna",
    last_activity_at: "2026-11-20T12:00:00+00:00",
    cook_count: 2,
    meal_count: 8,
    list_count: 1,
    donation_count: 1,
  };

  test("nennt Status, Ersteller, Datum und alle Zähler", () => {
    expect(describeEventAnomaly(fullAnomaly)).toBe(
      "Enthält Daten · angelegt 12.11.2026 von Anna · zuletzt geändert 20.11.2026 · Köch:innen 2 · Mahlzeiten 8 · Listen 1 · Spenden 1",
    );
  });

  test("leerer Anlass wird als «Leer» markiert", () => {
    expect(describeEventAnomaly({...fullAnomaly, is_empty: true})).toMatch(
      /^Leer · /,
    );
  });

  test("ohne Ersteller fehlt nur das «von …»", () => {
    expect(
      describeEventAnomaly({...fullAnomaly, created_by_name: null}),
    ).toContain("angelegt 12.11.2026 · ");
  });

  test("ältere DB ohne Detail-Felder: keine Abstürze, Zähler 0, nicht leer", () => {
    expect(describeEventAnomaly({event_id: "a", event_name: "x"})).toBe(
      "Enthält Daten · Köch:innen 0 · Mahlzeiten 0 · Listen 0 · Spenden 0",
    );
  });

  test("ungültiges Datum wird ausgelassen", () => {
    expect(
      describeEventAnomaly({...fullAnomaly, created_at: "kein Datum"}),
    ).not.toContain("angelegt");
  });
});

describe("buildCleanupParams", () => {
  test("leitet den Parameternamen aus dem ID-Feld ab", () => {
    expect(buildCleanupParams("event_id", ["a", "b"])).toEqual({
      event_ids: ["a", "b"],
    });
    expect(buildCleanupParams("product_id", ["p"])).toEqual({
      product_ids: ["p"],
    });
    expect(buildCleanupParams("recipe_id", ["r"])).toEqual({
      recipe_ids: ["r"],
    });
  });

  test("hängt Zusatzparameter an", () => {
    expect(
      buildCleanupParams("event_id", ["a"], {only_empty: false}),
    ).toEqual({event_ids: ["a"], only_empty: false});
  });
});

describe("getBulkDeletableAnomalies", () => {
  const anomalies = [
    {event_id: "leer", is_empty: true},
    {event_id: "voll", is_empty: false},
    {event_id: "unbekannt"},
  ];

  test("ohne Regel sind alle löschbar (bestehende Prüfungen)", () => {
    expect(getBulkDeletableAnomalies(anomalies)).toHaveLength(3);
  });

  test("mit Anlass-Regel nur die leeren", () => {
    expect(
      getBulkDeletableAnomalies(anomalies, EVENT_CLEANUP_OPTIONS.bulkDelete),
    ).toEqual([{event_id: "leer", is_empty: true}]);
  });
});

describe("buildSingleDeleteMessage", () => {
  test("Standardtext ohne Zusätze", () => {
    expect(buildSingleDeleteMessage("Apfel", "p1")).toBe(
      'Soll "Apfel" (p1) wirklich gelöscht werden?',
    );
  });

  test("mit Inhalt und Warnung", () => {
    const message = buildSingleDeleteMessage(
      "Lager",
      "e1",
      "Enthält Daten · Mahlzeiten 8",
      "Wird unwiderruflich gelöscht.",
    );
    expect(message).toBe(
      'Soll "Lager" (e1) wirklich gelöscht werden? Enthält Daten · Mahlzeiten 8. Wird unwiderruflich gelöscht.',
    );
  });
});

describe("EVENT_CLEANUP_OPTIONS", () => {
  test("Einzellöschen erlaubt auch nicht leere Anlässe", () => {
    expect(EVENT_CLEANUP_OPTIONS.singleDelete.params).toEqual({
      only_empty: false,
    });
  });

  test("Sammel-Beschriftung nennt die Anzahl leerer Anlässe", () => {
    expect(EVENT_CLEANUP_OPTIONS.bulkDelete.buttonLabel(3)).toBe(
      "3 leere löschen",
    );
  });
});
