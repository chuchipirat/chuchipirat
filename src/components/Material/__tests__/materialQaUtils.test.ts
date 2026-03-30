/**
 * Unit-Tests für die Material-QA-Issue-Erkennung.
 *
 * Prüft detectMaterialIssues auf korrekte Erkennung von
 * fehlendem Typ, verdächtigen Namen, Duplikaten und Varianten.
 */
import {detectMaterialIssues} from "../materialQaUtils";
import {Material, MaterialType} from "../material.types";

/* ===================================================================
// ======================== Hilfsfunktion ============================
// =================================================================== */

/** Erzeugt ein Material mit Standardwerten (überschreibbar). */
function makeMaterial(overrides: Partial<Material> & {uid: string; name: string}): Material {
  return {
    type: MaterialType.consumable,
    usable: true,
    qaChecked: false,
    qaCheckedAt: null,
    ...overrides,
  };
}

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("detectMaterialIssues", () => {
  test("gibt leeres Array für saubere Materialien zurück", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Teller", type: MaterialType.usage}),
      makeMaterial({uid: "2", name: "Serviette", type: MaterialType.consumable}),
    ];

    const issues = detectMaterialIssues(materials);
    expect(issues).toHaveLength(0);
  });

  test("erkennt fehlenden Materialtyp (MaterialType.none)", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Unbekanntes Material", type: MaterialType.none}),
    ];

    const issues = detectMaterialIssues(materials);
    expect(issues).toHaveLength(1);
    expect(issues[0].materialUid).toBe("1");
    expect(issues[0].issues).toContainEqual(
      expect.stringContaining("Kein Materialtyp"),
    );
  });

  test("erkennt verdächtig kurzen Namen", () => {
    const materials = [
      makeMaterial({uid: "1", name: "xx"}),
    ];

    const issues = detectMaterialIssues(materials);
    expect(issues).toHaveLength(1);
    expect(issues[0].issues).toContainEqual(
      expect.stringContaining("verdächtig kurz"),
    );
  });

  test("erkennt Test-Pattern im Namen", () => {
    const materials = [
      makeMaterial({uid: "1", name: "test123"}),
    ];

    const issues = detectMaterialIssues(materials);
    expect(issues).toHaveLength(1);
    expect(issues[0].issues).toContainEqual(
      expect.stringContaining("Testdaten"),
    );
  });

  test("erkennt exakte Namens-Duplikate (case-insensitive)", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Teller"}),
      makeMaterial({uid: "2", name: "teller"}),
    ];

    const issues = detectMaterialIssues(materials);
    // Beide Materialien sollten als Duplikate erkannt werden
    expect(issues.length).toBeGreaterThanOrEqual(1);
    const allIssueTexts = issues.flatMap((issue) => issue.issues);
    expect(allIssueTexts.some((text) => text.includes("Duplikat"))).toBe(true);
  });

  test("erkennt Plural/Singular-Varianten", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Serviette"}),
      makeMaterial({uid: "2", name: "Servietten"}),
    ];

    const issues = detectMaterialIssues(materials);
    const allIssueTexts = issues.flatMap((issue) => issue.issues);
    expect(allIssueTexts.some((text) => text.includes("Plural/Singular"))).toBe(true);
  });

  test("meldet Duplikate und Varianten nicht doppelt", () => {
    // «teller» und «teller» sind exakte Duplikate — sollten nicht zusätzlich als Variante gemeldet werden
    const materials = [
      makeMaterial({uid: "1", name: "Teller"}),
      makeMaterial({uid: "2", name: "teller"}),
    ];

    const issues = detectMaterialIssues(materials);
    const issuesForMat1 = issues.find((issue) => issue.materialUid === "1");
    if (issuesForMat1) {
      // Sollte Duplikat haben, aber keine Variante (da identischer Name)
      const variantIssues = issuesForMat1.issues.filter((text) =>
        text.includes("Plural/Singular"),
      );
      expect(variantIssues).toHaveLength(0);
    }
  });

  test("überspringt bereits geprüfte Materialien (qaChecked = true)", () => {
    const materials = [
      makeMaterial({uid: "1", name: "xx", qaChecked: true}),
    ];

    const issues = detectMaterialIssues(materials);
    expect(issues).toHaveLength(0);
  });

  // ── Check 5: Typ passt nicht zum Namen ────────────────────────────

  test("erkennt Gebrauchsmaterial-Keyword bei Verbrauchsmaterial-Typ", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Teller", type: MaterialType.consumable}),
    ];

    const issues = detectMaterialIssues(materials);
    const issueTexts = issues.find((issue) => issue.materialUid === "1")?.issues ?? [];
    expect(issueTexts.some((text) => text.includes("Materialtyp passt nicht"))).toBe(true);
  });

  test("erkennt Verbrauchsmaterial-Keyword bei Gebrauchsmaterial-Typ", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Alufolie", type: MaterialType.usage}),
    ];

    const issues = detectMaterialIssues(materials);
    const issueTexts = issues.find((issue) => issue.materialUid === "1")?.issues ?? [];
    expect(issueTexts.some((text) => text.includes("Materialtyp passt nicht"))).toBe(true);
  });

  test("kein Typ-Mismatch wenn Typ zum Namen passt", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Teller", type: MaterialType.usage}),
      makeMaterial({uid: "2", name: "Alufolie", type: MaterialType.consumable}),
    ];

    const issues = detectMaterialIssues(materials);
    const allIssueTexts = issues.flatMap((issue) => issue.issues);
    expect(allIssueTexts.some((text) => text.includes("Materialtyp passt nicht"))).toBe(false);
  });

  // ── Check 6: Leerzeichen ──────────────────────────────────────────

  test("erkennt führende/nachfolgende Leerzeichen im Namen", () => {
    const materials = [
      makeMaterial({uid: "1", name: " Teller ", type: MaterialType.usage}),
    ];

    const issues = detectMaterialIssues(materials);
    const issueTexts = issues.find((issue) => issue.materialUid === "1")?.issues ?? [];
    expect(issueTexts.some((text) => text.includes("Leerzeichen"))).toBe(true);
  });

  test("erkennt mehrfache Leerzeichen im Namen", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Teller  gross", type: MaterialType.usage}),
    ];

    const issues = detectMaterialIssues(materials);
    const issueTexts = issues.find((issue) => issue.materialUid === "1")?.issues ?? [];
    expect(issueTexts.some((text) => text.includes("Leerzeichen"))).toBe(true);
  });

  // ── Check 7: Nicht nutzbar ────────────────────────────────────────

  test("erkennt Material mit usable=false", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Altes Besteck", type: MaterialType.usage, usable: false}),
    ];

    const issues = detectMaterialIssues(materials);
    const issueTexts = issues.find((issue) => issue.materialUid === "1")?.issues ?? [];
    expect(issueTexts.some((text) => text.includes("nicht nutzbar"))).toBe(true);
  });

  test("kein Issue für nutzbares Material", () => {
    const materials = [
      makeMaterial({uid: "1", name: "Besteck", type: MaterialType.usage, usable: true}),
    ];

    const issues = detectMaterialIssues(materials);
    const allIssueTexts = issues.flatMap((issue) => issue.issues);
    expect(allIssueTexts.some((text) => text.includes("nicht nutzbar"))).toBe(false);
  });
});
