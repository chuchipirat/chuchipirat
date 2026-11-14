/**
 * Ein- und Ausgabe-Paare für die Normalisierung von Namen.
 *
 * Dieselbe Liste prüft die TypeScript-Funktion `normalizeName` und später die
 * SQL-Funktion `normalize_name()`. Nur so ist sichergestellt, dass ein
 * eindeutiger Index in der DB dieselben Namen gleich behandelt wie die App.
 * Die Beispiele stammen grösstenteils aus echten Produkt- und Materialnamen.
 */
export const NORMALIZATION_CASES: [input: string, expected: string][] = [
  // Umlaute und ß, klein und gross
  ["Rüebli", "rueebli"],
  ["Müesli", "mueesli"],
  ["Mueesli", "mueesli"],
  ["Äpfel, Golden", "aepfel golden"],
  ["Öl", "oel"],
  ["Ü Eier", "ue eier"],
  ["große Schüssel", "grosse schuessel"],
  // Zerlegtes Umlaut (u + kombinierendes Trema), z.B. aus macOS kopiert
  ["Ru\u0308ebli", "rueebli"],
  // Akzente
  ["Crème fraîche", "creme fraiche"],
  ["Béchamel", "bechamel"],
  ["Blue Curaçao", "blue curacao"],
  ["Pimientos de Padrón", "pimientos de padron"],
  ["Granatapfelmelasse (Nar Ekşisi)", "granatapfelmelasse nar eksisi"],
  ["Crêpes-Platte", "crepes platte"],
  // Satzzeichen und Sonderzeichen werden Leerzeichen
  ["Chili-Sauce", "chili sauce"],
  ["Karotten & Erbsen", "karotten erbsen"],
  ["Saucen + Röst Zibele", "saucen roest zibele"],
  ["Mojito Sirup / Holunderblüte", "mojito sirup holunderbluete"],
  ["Fisherman's friend", "fisherman s friend"],
  ['Ikea "Fleischbälleli"', "ikea fleischbaelleli"],
  ["Dessertdosen (Früchte/Creme?)", "dessertdosen fruechte creme"],
  [
    "Hartkäse (Raclettekäse!) nicht einkaufen",
    "hartkaese raclettekaese nicht einkaufen",
  ],
  [
    "Lyre's · Italian Spritz · alkoholfrei",
    "lyre s italian spritz alkoholfrei",
  ],
  ["Springform quadratisch, 24 × 24 cm", "springform quadratisch 24 24 cm"],
  ["Balsamico ¨", "balsamico"],
  ["Kuchenblech 32 cm Ø", "kuchenblech 32 cm"],
  // Abkürzungen mit und ohne (schmales) Leerzeichen ergeben dasselbe
  ["frische Kräuter (z.B. Rosmarin)", "frische kraeuter z b rosmarin"],
  ["Langkornreis (z.\u2009B. Parboiled)", "langkornreis z b parboiled"],
  // Leerraum
  ["  Zimt  ", "zimt"],
  ["Tomaten\tpassiert\n", "tomaten passiert"],
  ["Rahm   ,   vegan", "rahm vegan"],
  // Zahlen bleiben
  ["1.5 dl Rahm", "1 5 dl rahm"],
];
