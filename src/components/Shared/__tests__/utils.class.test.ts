import {Utils, Environment} from "../utils.class";
import authUser from "../../Firebase/Authentication/__mocks__/authuser.mock";
import {SortOrder} from "../../Firebase/Db/firebase.db.super.class";

/* =====================================================================
// Prüfung Domain
// ===================================================================== */
test("Utils.getDomain(): mit gültiger URL", () => {
  let url = "https://migusto.migros.ch/de/rezepte/rindsfilet-stroganoff";

  const domain = Utils.getDomain(url);
  expect(domain).toBe("migusto.ch");

  url = "http://localhost:3000/recipe/t3jKjgl5QnDpe9EHDWZ9";
  expect(Utils.getDomain(url)).toBe("localhost");

  url =
    "https://www.swissmilk.ch/de/rezepte-kochideen/rezepte/LM200806_89/birchermueesli/?gad_source=1&gclsrc=ds";
  expect(Utils.getDomain(url)).toBe("swissmilk.ch");

  url = "https://fooby.ch/de/rezepte/19276/fruehlingseintopf";
  expect(Utils.getDomain(url)).toBe("fooby.ch");

  url =
    "https://www.bettybossi.ch/de/Rezept/ShowRezept/BB_BRBR190304_0108A-60-de?title=Party-Broetchen";
  expect(Utils.getDomain(url)).toBe("bettybossi.ch");
});

test("Util.getDomain: mit ungültiger URL", () => {
  const url = "www.googlech";

  const domain = Utils.getDomain(url);
  expect(domain).toBe(url);
});
/* =====================================================================
// Prüfen ob URL gültig ist
// ===================================================================== */
test("Utils.isUrl(): mit gültiger URL", () => {
  const url = "https://migusto.migros.ch/de.html";
  expect(Utils.isUrl(url)).toBeTruthy();
});
test("Util.isUrl(): mit ungültiger URL", () => {
  const url = "https://migusto.migros. ch/de.html";
  expect(Utils.isUrl(url)).toBeFalsy();
});
test("Util.isUrl(): ohne Paramter", () => {
  expect(Utils.isUrl("")).toBeFalsy();
});
/* =====================================================================
// Prüfen ob gültige Email
// ===================================================================== */
test("Utils.isEmail(): mit gültiger Email-Adresse", () => {
  expect(Utils.isEmail("admin@chuchipirat.ch")).toBeTruthy();
  expect(Utils.isEmail("gio.developer@chuchipirat.ch")).toBeTruthy();
});

test("Util.isEmail(): mit ungültiger Email-Adressen", () => {
  expect(Utils.isEmail("admin@chuchipiratch")).toBeFalsy();
  expect(Utils.isEmail("adminchuchipirat.ch")).toBeFalsy();
  expect(Utils.isEmail("admin@ chuchipirat.ch")).toBeFalsy();
  expect(Utils.isEmail("admin@🏴‍☠️chuchipirat.ch")).toBeFalsy();
});
/* =====================================================================
// Element an bestimmter Position in Array einfügen (a)
// ===================================================================== */
test("Utils.insertArrayElementAtPosition(): an korrekter Stelle einfügen", () => {
  let array: {name: string; pos: number}[] = [
    {name: "Test Pos 1", pos: 1},
    {name: "Test Pos 3", pos: 3},
    {name: "Test Pos 4", pos: 4},
  ];
  const newElement = {name: "Test Pos 2", pos: 2};
  array = Utils.insertArrayElementAtPosition({
    array: array,
    indexToInsert: 0,
    newElement: newElement,
  });
  expect(array).toBeDefined();
  expect(array[1]).toEqual({name: "Test Pos 2", pos: 2});
  expect(array.length).toBe(4);
});
/* =====================================================================
  // Array nach bestimmten Feld neu Nummerieren
  // ===================================================================== */
test("Utils.renumberArray(): Elemente neu nummerieren", () => {
  const array: {name: string; pos: number}[] = [
    {name: "Test Pos 1", pos: 9},
    {name: "Test Pos 2", pos: 100},
    {name: "Test Pos 3", pos: 12},
    {name: "Test Pos 4", pos: 34},
  ];

  const renumberedArray = Utils.renumberArray({
    array: array,
    field: "pos",
  });
  expect(renumberedArray).toBeDefined();
  expect(renumberedArray[1].pos!).toEqual(2);
  expect(renumberedArray[3].pos!).toEqual(4);
  expect(renumberedArray.length).toEqual(4);
});
/* =====================================================================
// Differenz in Tagen zwischen zwei Daten
// ===================================================================== */
test("Utils.differenceBetweenTwoDates(): Unterschied zwischen 2 Daten in Tagen", () => {
  const dateFrom = new Date(2021, 0, 3);
  const dateTo = new Date(2021, 0, 8);

  let differenceInDays = Utils.differenceBetweenTwoDates({
    dateFrom: dateFrom,
    dateTo: dateTo,
  });

  expect(differenceInDays).toEqual(6);

  differenceInDays = Utils.differenceBetweenTwoDates({
    dateFrom: dateTo,
    dateTo: dateFrom,
  });
  expect(differenceInDays).toEqual(0);
});
/* =====================================================================
// UID generieren
// ===================================================================== */
test("Utils.generateUid(): Eindeutige Uid generieren", () => {
  const array: string[] = [];

  for (let i = 0; i < 100; i++) {
    array.push(Utils.generateUid(5));
  }

  const uniqueUids = new Set(array);
  // Prüfen ob wirklich eindeutig
  expect(array.length).toEqual(uniqueUids.size);
  // länge checken
  expect(Utils.generateUid(10).length).toEqual(10);
});
/* =====================================================================
// File-Suffix holen
// ===================================================================== */
test("Utils.getFileSuffix(): Suffix eines Files ermitteln", () => {
  expect(Utils.getFileSuffix("C:Documents/Test/Dummy.pdf")).toEqual("pdf");
  expect(Utils.getFileSuffix("C:DOCUMENT/STEST/DUMMY.PDF")).toEqual("pdf");
  expect(Utils.getFileSuffix("C:Documents/Test/Dummy")).toEqual("");

  expect(Utils.getFileSuffix("Header.jpg")).toEqual("jpg");
  expect(Utils.getFileSuffix("Header.max.jpg")).toEqual("jpg");
});
/* =====================================================================
// Array nach Attributnamen sortieren
// ===================================================================== */
test("Utils.sortArray(), sortiere Array aufsteigend nach Attribut - Werttyp Date", () => {
  const date1 = new Date("2022-01-01");
  const date2 = new Date("2022-01-03");
  const date3 = new Date("2022-01-02");
  const array = [
    {id: 3, date: date3},
    {id: 1, date: date1},
    {id: 2, date: date2},
  ];
  const sortedArray = Utils.sortArray({
    array: [...array],
    attributeName: "date",
    sortOrder: SortOrder.asc,
  });

  expect(sortedArray).toEqual([
    {id: 1, date: date1},
    {id: 3, date: date3},
    {id: 2, date: date2},
  ]);
});

test("Utils.sortArray(), sortiere Array absteigend nach Attribut - Werttyp Date", () => {
  const date1 = new Date("2022-01-01");
  const date2 = new Date("2022-01-03");
  const date3 = new Date("2022-01-02");
  const array = [
    {id: 3, date: date3},
    {id: 1, date: date1},
    {id: 2, date: date2},
  ];
  const sortedArray = Utils.sortArray({
    array: [...array],
    attributeName: "date",
    sortOrder: SortOrder.desc,
  });

  expect(sortedArray).toEqual([
    {id: 2, date: date2},
    {id: 3, date: date3},
    {id: 1, date: date1},
  ]);
});

test("Utils.sortArray(), sortiere Array aufsteigend nach verschachteltem Attribut - Werttyp Date", () => {
  const date1 = new Date("2022-01-01");
  const date2 = new Date("2022-01-03");
  const date3 = new Date("2022-01-02");
  const array = [
    {id: 3, nested: {date: date3}},
    {id: 1, nested: {date: date1}},
    {id: 2, nested: {date: date2}},
  ];
  const sortedArray = Utils.sortArray({
    array: [...array],
    attributeName: "nested.date",
    sortOrder: SortOrder.asc,
  });

  expect(sortedArray).toEqual([
    {id: 1, nested: {date: date1}},
    {id: 3, nested: {date: date3}},
    {id: 2, nested: {date: date2}},
  ]);
});

test("Utils.sortArray(), sortiere Array absteigend nach verschachteltem Attribut - Werttyp Date", () => {
  const date1 = new Date("2022-01-01");
  const date2 = new Date("2022-01-03");
  const date3 = new Date("2022-01-02");
  const array = [
    {id: 3, nested: {date: date3}},
    {id: 1, nested: {date: date1}},
    {id: 2, nested: {date: date2}},
  ];
  const sortedArray = Utils.sortArray({
    array: [...array],
    attributeName: "nested.date",
    sortOrder: SortOrder.desc,
  });

  expect(sortedArray).toEqual([
    {id: 2, nested: {date: date2}},
    {id: 3, nested: {date: date3}},
    {id: 1, nested: {date: date1}},
  ]);
});

/* =====================================================================
// Prüfung ob das die Produktion ist
// ===================================================================== */
test("Utils.isProductionEnvironment()", () => {
  expect(Utils.isProductionEnvironment()).toBeFalsy();
});
/* =====================================================================
// Prüfung ob das die Entwicklung ist
// ===================================================================== */
test("Utils.isDevEnvironment()", () => {
  expect(Utils.isDevEnvironment()).toBeTruthy();
});
/* =====================================================================
// Prüfung ob das die Test-Instanz ist
// ===================================================================== */
test("Utils.isTestEnvironment()", () => {
  expect(Utils.isTestEnvironment()).toBeFalsy();
});
/* =====================================================================
// Umgebung holen
// ===================================================================== */
test("Utils.getEnvironment()", () => {
  expect(Utils.getEnvironment()).toBe(Environment.development);
});
/* =====================================================================
// Lade-Anzeige prüfen
// ===================================================================== */
test("Utils.deriveIsLoading()", () => {
  let isLoading = {a: true, b: false, c: false};
  expect(Utils.deriveIsLoading(isLoading)).toBeTruthy();

  isLoading = {a: false, b: false, c: false};
  expect(Utils.deriveIsLoading(isLoading)).toBeFalsy();

  isLoading = {a: true, b: true, c: true};
  expect(Utils.deriveIsLoading(isLoading)).toBeTruthy();
});
/* =====================================================================
// Datum als String
// ===================================================================== */
test("Utils.dateAsString()", () => {
  const date = new Date("2024-01-01");
  expect(Utils.dateAsString(date)).toBe("2024-01-01");
});
/* =====================================================================
// Objekt in ein Array umwandeln
// ===================================================================== */
test("Utils.convertObjectToArray()", () => {
  const object = {
    x: {name: "a", value: 2},
    y: {name: "b", value: 3},
    z: {name: "c", value: 4},
  };
  const array = Utils.convertObjectToArray(object, "uid");
  expect(array[0].name).toBe("a");
  expect(array.length).toBe(3);
  expect(array[2].value).toBe(4);
});
/* =====================================================================
// Array in ein Objekgt umwandeln
// ===================================================================== */
test("Utils.convertArrayToObject()", () => {
  const array = [
    {name: "a", value: 2},
    {name: "b", value: 3},
    {name: "c", value: 4},
  ];
  const object = Utils.convertArrayToObject({array: array, keyName: "name"});
  expect(object.b.value).toBe(3);
  expect(Object.keys(object).length).toBe(3);
  expect(Object.keys(object.c)).toEqual(["value"]);
});
/* =====================================================================
// Change Record erstellen
// ===================================================================== */
test("Utils.createChangeRecord()", () => {
  const changeRecord = Utils.createChangeRecord(authUser);

  expect(changeRecord.date.getDate).toBe(new Date().getDate);
  expect(changeRecord.fromUid).toBe(authUser.uid);
  expect(changeRecord.fromDisplayName).toBe(authUser.publicProfile.displayName);
});
/* =====================================================================
// Prüfen ob die String-Array (Strings) identisch sind
// ===================================================================== */
test("Utils.areStringArraysEqual(), identische Arrays", () => {
  const array1 = ["apple", "banana", "orange"];
  const array2 = ["banana", "orange", "apple"];
  expect(Utils.areStringArraysEqual(array1, array2)).toBe(true);
});

test("Utils.areStringArraysEqual(), unterschiedliche Länge", () => {
  const array1 = ["apple", "banana", "orange"];
  const array2 = ["apple", "banana"];
  expect(Utils.areStringArraysEqual(array1, array2)).toBe(false);
});

test("Utils.areStringArraysEqual(), unterschiedlicher Inhalt", () => {
  const array1 = ["apple", "banana", "orange"];
  const array2 = ["apple", "grape", "orange"];
  expect(Utils.areStringArraysEqual(array1, array2)).toBe(false);
});

test("Utils.areStringArraysEqual(), gleicher Inhalt, unterschiedliche Reihenfolge", () => {
  const array1 = ["apple", "banana", "orange"];
  const array2 = ["banana", "apple", "orange"];
  expect(Utils.areStringArraysEqual(array1, array2)).toBe(true);
});
/* =====================================================================
// Prüfen ob die Array identisch sind
// ===================================================================== */
test("Utils.areArraysIdentical(), identische Arrays", () => {
  const array1 = [1, 2, 3, 4, 5];
  const array2 = [1, 2, 3, 4, 5];

  expect(Utils.areArraysIdentical(array1, array2)).toBe(true);
});

test("Utils.areArraysIdentical(), ungleiche Arrays unterschiedlicher Länge", () => {
  const array1 = [1, 2, 3];
  const array2 = [1, 2, 3, 4, 5]; // Array 2 hat mehr Elemente als Array 1

  expect(Utils.areArraysIdentical(array1, array2)).toBe(false);
});

test("Utils.areArraysIdentical(), ungleiche Arrays gleicher Länge", () => {
  const array1 = [1, 2, 3];
  const array2 = [1, 3, 2]; // Elemente sind in unterschiedlicher Reihenfolge

  expect(Utils.areArraysIdentical(array1, array2)).toBe(false);
});

test("Utils.areArraysIdentical(), leere Arrays", () => {
  const array1: number[] = [];
  const array2: number[] = [];

  expect(Utils.areArraysIdentical(array1, array2)).toBe(true);
});

test("Utils.areArraysIdentical(), Arrays mit gleichen Werten", () => {
  const array1 = [1, 1, 1];
  const array2 = [1, 1, 1];

  expect(Utils.areArraysIdentical(array1, array2)).toBe(true);
});

/* =====================================================================
// Sind die Daten identisch?
// ===================================================================== */
test("Utils.areDatesIdentical(), gleiches Datum", () => {
  const date1 = new Date("2024-05-01T12:00:00");
  const date2 = new Date("2024-05-01T18:30:00");
  expect(Utils.areDatesIdentical(date1, date2)).toBe(true);
});

test("Utils.areDatesIdentical(), nicht gleiches Datum", () => {
  const date1 = new Date("2024-05-01T12:00:00");
  const date2 = new Date("2024-05-02T12:00:00");
  expect(Utils.areDatesIdentical(date1, date2)).toBe(false);
});

test("Utils.areDatesIdentical(), gleiches Datum - unterschiedliche Zeit", () => {
  const date1 = new Date("2024-05-01T12:00:00");
  const date2 = new Date("2024-05-01T18:30:00");
  expect(Utils.areDatesIdentical(date1, date2)).toBe(true);
});
/* =====================================================================
// Jaccard-Index
// ===================================================================== */
test("Utils.jaccardIndex(), richtiger Index bestimmen für ähnliche Begriffe", () => {
  const a = "apple";
  const b = "apricot";
  // 'a', 'p' sind die übereinstimmenden Elemente
  // (Anzahl der übereinstimmenden Elemente) / (Anzahl der Elemente in der Vereinigungsmenge) = 2 / 9 ≈ 0.2222
  expect(Utils.jaccardIndex(a, b)).toBeCloseTo(2 / 9, 4); // Reduziere die Präzision auf 4 Dezimalstellen
});

test("Utils.jaccardIndex(), richtiger Index bestimmen für unterschiedliche Begriffe", () => {
  const a = "hello";
  const b = "mars";
  // Keine übereinstimmenden Zeichen
  // (0 übereinstimmende Zeichen) / (5 + 5 - 0) = 0 / 10 = 0
  const jaccardIndex = Utils.jaccardIndex(a, b);
  expect(jaccardIndex).toBeCloseTo(0);
});

test("Utils.jaccardIndex(), richtiger Index bestimmen für gleiche Begriffe", () => {
  const a = "example";
  const b = "example";
  // Alle Zeichen sind gleich
  // (7 übereinstimmende Zeichen) / (7 + 7 - 7) = 7 / 7 = 1
  expect(Utils.jaccardIndex(a, b)).toBe(1);
});
