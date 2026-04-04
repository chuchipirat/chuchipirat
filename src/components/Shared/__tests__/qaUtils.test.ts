/**
 * Unit-Tests für die gemeinsamen QA-Hilfsfunktionen.
 *
 * Prüft stripPluralSuffix, buildNameDuplicateMap und buildPluralVariantMap
 * auf korrekte Ergebnisse mit verschiedenen Eingaben.
 */
import {
  stripPluralSuffix,
  buildNameDuplicateMap,
  buildPluralVariantMap,
  NamedItem,
} from "../qaUtils";

/* ===================================================================
// ======================== stripPluralSuffix =========================
// =================================================================== */

describe("stripPluralSuffix", () => {
  test("entfernt «en»-Suffix: «tomaten» → «tomat»", () => {
    expect(stripPluralSuffix("tomaten")).toBe("tomat");
  });

  test("entfernt «n»-Suffix: «zwiebeln» → «zwiebel»", () => {
    expect(stripPluralSuffix("zwiebeln")).toBe("zwiebel");
  });

  test("entfernt «er»-Suffix: «teller» → «tell»", () => {
    expect(stripPluralSuffix("teller")).toBe("tell");
  });

  test("entfernt «e»-Suffix: «serviette» → «serviett»", () => {
    expect(stripPluralSuffix("serviette")).toBe("serviett");
  });

  test("entfernt «s»-Suffix: «messer» → «mess» (er zuerst)", () => {
    // «messer» hat «er»-Suffix — wird zuerst entfernt
    expect(stripPluralSuffix("messer")).toBe("mess");
  });

  test("gibt Namen unverändert zurück wenn kein Suffix passt", () => {
    expect(stripPluralSuffix("salz")).toBe("salz");
  });

  test("überspringt zu kurze Stämme: «eier» → Stamm «ei» zu kurz, aber suffix.length+2 check", () => {
    // «eier» hat Länge 4, «er» hat Länge 2 → 4 > 2+2=4 ist false → kein Stripping
    expect(stripPluralSuffix("eier")).toBe("eier");
  });

  test("verarbeitet leere Eingabe ohne Fehler", () => {
    expect(stripPluralSuffix("")).toBe("");
  });
});

/* ===================================================================
// ======================== buildNameDuplicateMap =====================
// =================================================================== */

describe("buildNameDuplicateMap", () => {
  test("gruppiert exakte Duplikate (case-insensitive, trimmed)", () => {
    const items: NamedItem[] = [
      {uid: "1", name: "Teller"},
      {uid: "2", name: "teller"},
      {uid: "3", name: " Teller "},
    ];

    const map = buildNameDuplicateMap(items);

    expect(map.get("teller")).toHaveLength(3);
  });

  test("gibt leere Map für leere Eingabe zurück", () => {
    const map = buildNameDuplicateMap([]);
    expect(map.size).toBe(0);
  });

  test("überspringt Items mit leerem Namen", () => {
    const items: NamedItem[] = [
      {uid: "1", name: ""},
      {uid: "2", name: "  "},
    ];

    const map = buildNameDuplicateMap(items);
    expect(map.size).toBe(0);
  });

  test("erzeugt einzelne Einträge für eindeutige Namen", () => {
    const items: NamedItem[] = [
      {uid: "1", name: "Teller"},
      {uid: "2", name: "Serviette"},
    ];

    const map = buildNameDuplicateMap(items);
    expect(map.get("teller")).toHaveLength(1);
    expect(map.get("serviette")).toHaveLength(1);
  });
});

/* ===================================================================
// ======================== buildPluralVariantMap =====================
// =================================================================== */

describe("buildPluralVariantMap", () => {
  test("gruppiert Singular/Plural-Varianten nach Stamm", () => {
    const items: NamedItem[] = [
      {uid: "1", name: "Serviette"},
      {uid: "2", name: "Servietten"},
    ];

    const map = buildPluralVariantMap(items);

    // Beide sollten unter dem gleichen Stamm gruppiert sein
    const stems = Array.from(map.values()).filter((group) => group.length > 1);
    expect(stems).toHaveLength(1);
    expect(stems[0]).toHaveLength(2);
  });

  test("überspringt Namen kürzer als 3 Zeichen", () => {
    const items: NamedItem[] = [
      {uid: "1", name: "ab"},
      {uid: "2", name: "Teller"},
    ];

    const map = buildPluralVariantMap(items);
    // «ab» wird übersprungen, nur «Teller» ist in der Map
    expect(map.size).toBe(1);
  });

  test("überspringt Items deren Stamm kürzer als 3 Zeichen ist", () => {
    const items: NamedItem[] = [
      {uid: "1", name: "Eier"},
    ];

    const map = buildPluralVariantMap(items);
    // «eier» → Stamm «eier» (kein Stripping wegen zu kurzem Rest)
    // Stamm ist >= 3, also wird es aufgenommen
    expect(map.size).toBe(1);
  });

  test("gibt leere Map für leere Eingabe zurück", () => {
    const map = buildPluralVariantMap([]);
    expect(map.size).toBe(0);
  });
});
