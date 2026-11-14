/** Ein Wort des Namens in beiden Schreibweisen. */
export type NameToken = {
  /** Wie eingegeben, z.B. «Rüebli»; für Hinweise und den Namen ohne Detail. */
  original: string;
  /** Normalisiert, z.B. «rueebli»; für den Vergleich. */
  normalized: string;
};

/**
 * Bringt einen Produkt- oder Materialnamen in eine Vergleichsform, damit
 * zwei Schreibweisen desselben Namens gleich werden.
 *
 * Klein geschrieben, Umlaute und ß ausgeschrieben (`ä` → `ae`), Akzente
 * entfernt, alles ausser Buchstaben und Ziffern als ein Leerzeichen, ohne
 * Leerraum am Rand. Kein Wortstamm: «Chilis» bleibt «chilis».
 *
 * Die SQL-Funktion `normalize_name()` muss dasselbe liefern; beide prüfen
 * gegen `NORMALIZATION_CASES`.
 *
 * @param name Name, wie er eingegeben wurde.
 * @returns Normalisierter Name, leer, wenn nur Satzzeichen übrig bleiben.
 * @example
 * normalizeName("Crème fraîche, Ø 32") // "creme fraiche 32"
 * normalizeName("Rüebli") // "rueebli"
 */
export const normalizeName = (name: string): string => {
  // Die Reihenfolge ist wichtig:
  // 1. NFC setzt zerlegte Umlaute (u + Trema, z.B. aus macOS kopiert)
  //    wieder zu «ü» zusammen, sonst greift die Ersetzung darunter nicht.
  // 2. Klein schreiben vor den Umlauten, damit auch «Ä», «Ö», «Ü» erfasst sind.
  // 3. Umlaute vor den Akzenten: NFD würde «ü» sonst zu «u» machen.
  // 4. Erst danach bleiben nur a–z und 0–9; alles andere wird ein Leerzeichen,
  //    mehrere hintereinander werden eines.
  return name
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

/**
 * Zerlegt einen Namen in seine normalisierten Wörter.
 *
 * @param name Name, wie er eingegeben wurde.
 * @returns Wörter in ihrer Reihenfolge, ohne leere; leer bei leerer Eingabe.
 * @example
 * tokenizeName("Griechischer Joghurt, laktosefrei")
 * // ["griechischer", "joghurt", "laktosefrei"]
 */
export const tokenizeName = (name: string): string[] => {
  // "".split(" ") liefert [""], darum leere Teile entfernen.
  return normalizeName(name)
    .split(" ")
    .filter((word) => word !== "");
};

/**
 * Zerlegt einen Namen in Wörter und behält zu jedem die Eingabe-Schreibweise.
 *
 * Liefert dieselben normalisierten Wörter wie `tokenizeName`; die Eingabe
 * wird dafür an denselben Stellen getrennt (alles ausser Buchstaben, Zeichen
 * wie Akzente und Ziffern).
 *
 * @param name Name, wie er eingegeben wurde.
 * @returns Wörter in ihrer Reihenfolge, ohne solche, die beim Normalisieren
 * leer werden (z.B. «Ø»).
 * @example
 * tokenizeWithOriginal("Zimt, gemahlen")
 * // [{original: "Zimt", normalized: "zimt"},
 * //  {original: "gemahlen", normalized: "gemahlen"}]
 */
export const tokenizeWithOriginal = (name: string): NameToken[] => {
  // NFC vor dem Trennen, sonst wäre ein zerlegtes «ü» zwei Zeichen
  return name
    .normalize("NFC")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .map((piece) => ({original: piece, normalized: normalizeName(piece)}))
    .filter((nameToken) => nameToken.normalized !== "");
};
