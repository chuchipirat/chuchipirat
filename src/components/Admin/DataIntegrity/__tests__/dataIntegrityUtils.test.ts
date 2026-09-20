/**
 * Unit-Tests für die Hilfsfunktionen der Datenintegritätsseite.
 */
import {
  EVENT_CLEANUP_OPTIONS,
  buildCleanupParams,
  buildSingleDeleteMessage,
  describeBrokenRecipeAnomaly,
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

describe("describeBrokenRecipeAnomaly", () => {
  const ingredientAnomaly = {
    recipe_type: "public",
    created_by_name: "Anna",
    broken_count: 2,
    broken_rows: [
      {quantity: 500, unit: "Bund", detail: "frisch"},
      {quantity: 2, unit: null, detail: ""},
    ],
  };

  test("Zutaten: Typ, Ersteller, Anzahl und betroffene Zeilen", () => {
    expect(describeBrokenRecipeAnomaly(ingredientAnomaly, "ingredient")).toBe(
      "Öffentlich · von Anna · 2 Zutaten ohne Produkt: 500 Bund (frisch), 2",
    );
  });

  test("Einzahl bei einer Zutat", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {
          recipe_type: "public",
          broken_count: 1,
          broken_rows: [{quantity: 1.5, unit: "kg", detail: ""}],
        },
        "ingredient",
      ),
    ).toBe("Öffentlich · 1 Zutat ohne Produkt: 1.5 kg");
  });

  test("private Rezepte weisen darauf hin, dass nur der Ersteller sie bearbeiten kann", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {...ingredientAnomaly, recipe_type: "private"},
        "ingredient",
      ),
    ).toMatch(/^Privat \(nur der Ersteller kann bearbeiten\) · von Anna/);
  });

  test("Variante ohne Ersteller", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {...ingredientAnomaly, recipe_type: "variant", created_by_name: null},
        "ingredient",
      ),
    ).toMatch(/^Variante · 2 Zutaten/);
  });

  test("listet höchstens 5 Zeilen und deutet den Rest mit … an", () => {
    const rows = Array.from({length: 7}, (_, index) => ({
      quantity: index + 1,
      unit: null,
      detail: "",
    }));
    const text = describeBrokenRecipeAnomaly(
      {recipe_type: "public", broken_count: 7, broken_rows: rows},
      "ingredient",
    );
    expect(text).toContain("7 Zutaten ohne Produkt: 1, 2, 3, 4, 5, …");
    expect(text).not.toContain("6,");
  });

  test("Materialien: Zeilen ohne Menge sind leere Zeilen und werden nicht aufgelistet", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {
          recipe_type: "variant",
          broken_count: 1,
          broken_rows: [{quantity: 0}],
        },
        "material",
      ),
    ).toBe("Variante · 1 Materialposition ohne Material");
  });

  test("Materialien mit Menge zeigen die Menge", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {
          recipe_type: "public",
          broken_count: 2,
          broken_rows: [{quantity: 2}, {quantity: 0}],
        },
        "material",
      ),
    ).toBe("Öffentlich · 2 Materialpositionen ohne Material: Menge 2");
  });

  test("fehlende Felder führen nicht zu Abstürzen", () => {
    expect(describeBrokenRecipeAnomaly({}, "ingredient")).toBe(
      "0 Zutaten ohne Produkt",
    );
    expect(
      describeBrokenRecipeAnomaly(
        {recipe_type: "unbekannt", broken_rows: "kein Array"},
        "material",
      ),
    ).toBe("0 Materialpositionen ohne Material");
  });

  test("ohne broken_count wird die Anzahl der Zeilen genommen", () => {
    expect(
      describeBrokenRecipeAnomaly(
        {broken_rows: [{quantity: 1, unit: null, detail: ""}]},
        "ingredient",
      ),
    ).toBe("1 Zutat ohne Produkt: 1");
  });
});
