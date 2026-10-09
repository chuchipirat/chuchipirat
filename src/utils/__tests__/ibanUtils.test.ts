/**
 * Unit-Tests für ibanUtils.ts.
 *
 * Testet Normalisierung, Prüfung (Form + Mod-97-Prüfsumme) und
 * Anzeige-Formatierung von IBANs.
 */
import {normalizeIban, isValidIban, formatIban} from "../ibanUtils";

/* =====================================================================
// normalizeIban()
// ===================================================================== */
describe("normalizeIban()", () => {
  test("entfernt Leerzeichen innen und aussen, macht Grossbuchstaben", () => {
    expect(normalizeIban(" ch93 0076 2011 6238 5295 7 ")).toBe(
      "CH9300762011623852957",
    );
  });

  test("entfernt auch Tabs und Zeilenumbrüche (z.B. aus Copy&Paste)", () => {
    expect(normalizeIban("CH93\t0076\n2011 6238\r\n5295 7")).toBe(
      "CH9300762011623852957",
    );
  });
});

/* =====================================================================
// isValidIban()
// ===================================================================== */
describe("isValidIban()", () => {
  test.each([
    ["CH", "CH9300762011623852957"],
    // einziges Beispiel mit Buchstaben im Kontoteil — prüft die
    // Buchstaben→Zahlen-Umrechnung der Prüfsumme
    ["LI (Buchstaben im Kontoteil)", "LI21088100002324013AA"],
    ["DE", "DE89370400440532013000"],
    ["AT", "AT611904300234573201"],
  ])("gültig: %s", (_label, iban) => {
    expect(isValidIban(iban)).toBe(true);
  });

  test.each([
    // Prüfsumme: Form stimmt, nur Mod-97 schlägt fehl
    ["letzte Ziffer verändert", "CH9300762011623852958"],
    ["zwei Ziffern vertauscht", "CH9300762011623859257"],
    ["Ziffer weggelassen", "CH930076201162385295"],
    ["Ziffer zu viel", "CH93007620116238529577"],
    // Form: scheitert schon an IBAN_FORMAT
    ["Kleinbuchstaben (nicht normalisiert)", "ch9300762011623852957"],
    ["mit Leerzeichen (nicht normalisiert)", "CH93 0076 2011 6238 5295 7"],
    ["Sonderzeichen", "CH93007620116238529$7"],
    ["zu kurz (unter 15 Zeichen)", "CH12"],
    ["zu lang (35 Zeichen)", "CH93" + "0".repeat(31)],
    ["leer", ""],
  ])("ungültig: %s", (_label, iban) => {
    expect(isValidIban(iban)).toBe(false);
  });
});

/* =====================================================================
// formatIban()
// ===================================================================== */
describe("formatIban()", () => {
  test("letzter Block darf kürzer als vier Zeichen sein", () => {
    expect(formatIban("CH9300762011623852957")).toBe(
      "CH93 0076 2011 6238 5295 7",
    );
    expect(formatIban("DE89370400440532013000")).toBe(
      "DE89 3704 0044 0532 0130 00",
    );
  });

  test("Länge durch vier teilbar → kein Leerzeichen am Ende", () => {
    expect(formatIban("AT611904300234573201")).toBe(
      "AT61 1904 3002 3457 3201",
    );
  });
});
