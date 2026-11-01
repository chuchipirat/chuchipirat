/**
 * Unit-Tests für die Aufbewahrungsfrist der Belege (receiptRetention.ts):
 * Zürcher Datum, Anlassende, Lösch- und Erinnerungsdatum, Empfänger der
 * Erinnerungsmail.
 *
 * Ein falsches Datum löscht Belege zu früh, und das lässt sich nicht
 * rückgängig machen. Darum sind die Randfälle (Schaltjahr, Jahreswechsel,
 * Mitternacht in Zürich) hier einzeln geprüft.
 */
import {
  EventDateRow,
  ReceiptExpenseRow,
  ReceiptPathRow,
  buildReminderGreeting,
  buildReminderSubject,
  buildReminderText,
  formatReceiptCount,
  formatSwissDate,
  getDeletionDate,
  getEventEndDates,
  getExpenseTrackingUrl,
  getReminderDate,
  isDeletionDue,
  selectDueReceipts,
  selectReminderEventIds,
  selectReminderRecipients,
  toStoragePath,
  toZurichDate,
} from "../receiptRetention";

describe("toZurichDate", () => {
  test.each([
    [
      "Sommer: 22:30 UTC ist schon der nächste Tag",
      "2026-06-30T22:30:00Z",
      "2026-07-01",
    ],
    [
      "Sommer: 21:30 UTC ist noch derselbe Tag",
      "2026-06-30T21:30:00Z",
      "2026-06-30",
    ],
    [
      "Winter: 22:30 UTC ist noch derselbe Tag",
      "2026-12-30T22:30:00Z",
      "2026-12-30",
    ],
    [
      "Winter: 23:30 UTC am 31.12. ist schon Neujahr",
      "2026-12-31T23:30:00Z",
      "2027-01-01",
    ],
  ])("%s", (_case, isoTimestamp, expected) => {
    expect(toZurichDate(new Date(isoTimestamp))).toBe(expected);
  });
});

describe("getEventEndDates", () => {
  test("Anlassende ist das grösste date_to, auch wenn es nicht zuletzt kommt", () => {
    const eventDates: EventDateRow[] = [
      {event_id: "event-a", date_to: "2026-07-10"},
      {event_id: "event-a", date_to: "2026-07-20"},
      {event_id: "event-a", date_to: "2026-07-15"},
    ];

    expect(getEventEndDates(eventDates)).toEqual(
      new Map([["event-a", "2026-07-20"]]),
    );
  });

  test("ein Eintrag pro Anlass", () => {
    const eventDates: EventDateRow[] = [
      {event_id: "event-a", date_to: "2026-07-10"},
      {event_id: "event-b", date_to: "2025-10-05"},
      {event_id: "event-a", date_to: "2026-08-01"},
    ];

    expect(getEventEndDates(eventDates)).toEqual(
      new Map([
        ["event-a", "2026-08-01"],
        ["event-b", "2025-10-05"],
      ]),
    );
  });

  test("Jahreswechsel: 2027-01-02 ist später als 2026-12-31", () => {
    const eventDates: EventDateRow[] = [
      {event_id: "event-a", date_to: "2027-01-02"},
      {event_id: "event-a", date_to: "2026-12-31"},
    ];

    expect(getEventEndDates(eventDates).get("event-a")).toBe("2027-01-02");
  });

  test("ohne Daten eine leere Map", () => {
    expect(getEventEndDates([])).toEqual(new Map());
  });
});

describe("getDeletionDate", () => {
  test.each([
    ["ein Kalenderjahr später", "2026-07-14", "2027-07-14"],
    ["Ende Jahr", "2026-12-31", "2027-12-31"],
    ["Anfang Jahr", "2026-01-01", "2027-01-01"],
    [
      "29. Februar → 1. März (kein Schaltjahr danach)",
      "2028-02-29",
      "2029-03-01",
    ],
    ["28. Februar bleibt 28. Februar", "2027-02-28", "2028-02-28"],
  ])("%s", (_case, eventEnd, expected) => {
    expect(getDeletionDate(eventEnd)).toBe(expected);
  });
});

describe("getReminderDate", () => {
  test.each([
    ["30 Tage vor dem Löschdatum", "2026-07-14", "2027-06-14"],
    ["über den Jahreswechsel zurück", "2026-01-20", "2026-12-21"],
    ["über einen Februar mit 28 Tagen", "2026-03-15", "2027-02-13"],
    ["nach einem 29. Februar", "2028-02-29", "2029-01-30"],
  ])("%s", (_case, eventEnd, expected) => {
    expect(getReminderDate(eventEnd)).toBe(expected);
  });
});

describe("isDeletionDue", () => {
  test.each([
    ["einen Tag vor dem Löschdatum: nein", "2027-07-13", false],
    ["am Löschdatum: ja", "2027-07-14", true],
    ["danach (verpasster Lauf): ja", "2027-08-01", true],
    ["am Erinnerungstag: nein", "2027-06-14", false],
  ])("%s", (_case, today, expected) => {
    expect(isDeletionDue("2026-07-14", today)).toBe(expected);
  });

  test("Jahreswechsel: Löschdatum 2027-12-31, heute 2028-01-01", () => {
    expect(isDeletionDue("2026-12-31", "2028-01-01")).toBe(true);
  });
});

describe("selectReminderRecipients", () => {
  const cookUserIds = ["cook-1", "cook-2", "cook-3"];

  const paidBy = (userId: string): ReceiptExpenseRow => ({
    payee_type: "existing_user",
    payee_user_id: userId,
  });
  const newPerson: ReceiptExpenseRow = {
    payee_type: "new_person",
    payee_user_id: null,
  };
  const noRefund: ReceiptExpenseRow = {
    payee_type: "no_refund_needed",
    payee_user_id: null,
  };

  test("alle Belege von Personen mit Account: nur diese Personen", () => {
    expect(
      selectReminderRecipients(
        [paidBy("cook-2"), paidBy("cook-1")],
        cookUserIds,
      ),
    ).toEqual(["cook-2", "cook-1"]);
  });

  test("jede Person nur einmal, auch mit mehreren Belegen", () => {
    expect(
      selectReminderRecipients(
        [paidBy("cook-1"), paidBy("cook-2"), paidBy("cook-1")],
        cookUserIds,
      ),
    ).toEqual(["cook-1", "cook-2"]);
  });

  // Ehemalige Köch:innen sehen den Anlass nicht mehr, der Link in der Mail
  // nützt ihnen nichts. Die aktuellen Köch:innen müssen es erfahren.
  test("Person ist nicht mehr Koch: alle Köch:innen, sie selbst nicht", () => {
    expect(
      selectReminderRecipients([paidBy("former-cook")], cookUserIds),
    ).toEqual(["cook-1", "cook-2", "cook-3"]);
  });

  test("ein Beleg einer Person, die nicht mehr Koch ist, reicht für alle", () => {
    expect(
      selectReminderRecipients(
        [paidBy("cook-1"), paidBy("former-cook")],
        cookUserIds,
      ),
    ).toEqual(["cook-1", "cook-2", "cook-3"]);
  });

  test("ein Beleg «Keine Rückerstattung»: alle Köch:innen", () => {
    expect(
      selectReminderRecipients([paidBy("cook-1"), noRefund], cookUserIds),
    ).toEqual(["cook-1", "cook-2", "cook-3"]);
  });

  test("ein Beleg einer neuen Person (ohne E-Mail): alle Köch:innen", () => {
    expect(selectReminderRecipients([newPerson], cookUserIds)).toEqual([
      "cook-1",
      "cook-2",
      "cook-3",
    ]);
  });

  test("an alle: nur aktuelle Köch:innen, in ihrer Reihenfolge", () => {
    expect(
      selectReminderRecipients(
        [paidBy("former-cook"), noRefund, paidBy("cook-2")],
        cookUserIds,
      ),
    ).toEqual(["cook-1", "cook-2", "cook-3"]);
  });

  test("doppelte Köch:innen nur einmal", () => {
    expect(
      selectReminderRecipients([noRefund], ["cook-1", "cook-2", "cook-1"]),
    ).toEqual(["cook-1", "cook-2"]);
  });

  test("ohne Beleg niemand", () => {
    expect(selectReminderRecipients([], cookUserIds)).toEqual([]);
  });
});

describe("toStoragePath", () => {
  // Ein falscher Pfad löscht still nichts: Storage meldet fehlende Dateien
  // nicht als Fehler. Darum der genaue Pfad.
  test("setzt den Ordner events/ davor, sonst unverändert", () => {
    expect(toStoragePath("event-a/expenses/expense-1.pdf")).toBe(
      "events/event-a/expenses/expense-1.pdf",
    );
  });
});

describe("selectDueReceipts", () => {
  const receipt = (id: string, eventId: string): ReceiptPathRow => ({
    id,
    event_id: eventId,
    attachment_path: `${eventId}/expenses/${id}.pdf`,
  });

  // Anlass A endete am 14.07.2026 → Löschdatum 14.07.2027
  // Anlass B endete am 01.03.2027 → Löschdatum 01.03.2028
  const eventEndDates = new Map([
    ["event-a", "2026-07-14"],
    ["event-b", "2027-03-01"],
  ]);

  test("am Löschdatum fällig", () => {
    expect(
      selectDueReceipts(
        [receipt("expense-1", "event-a")],
        eventEndDates,
        "2027-07-14",
      ),
    ).toEqual([receipt("expense-1", "event-a")]);
  });

  test("einen Tag davor nicht", () => {
    expect(
      selectDueReceipts(
        [receipt("expense-1", "event-a")],
        eventEndDates,
        "2027-07-13",
      ),
    ).toEqual([]);
  });

  test("nach dem Löschdatum noch fällig (verpasster Lauf)", () => {
    expect(
      selectDueReceipts(
        [receipt("expense-1", "event-a")],
        eventEndDates,
        "2027-09-01",
      ),
    ).toEqual([receipt("expense-1", "event-a")]);
  });

  test("nur die fälligen Anlässe, Reihenfolge bleibt", () => {
    const receipts = [
      receipt("expense-1", "event-b"),
      receipt("expense-2", "event-a"),
      receipt("expense-3", "event-b"),
      receipt("expense-4", "event-a"),
    ];

    expect(selectDueReceipts(receipts, eventEndDates, "2027-07-14")).toEqual([
      receipt("expense-2", "event-a"),
      receipt("expense-4", "event-a"),
    ]);
  });

  test("alle Anlässe fällig: Reihenfolge der Eingabe, nicht nach Anlass sortiert", () => {
    const receipts = [
      receipt("expense-1", "event-b"),
      receipt("expense-2", "event-a"),
    ];

    expect(selectDueReceipts(receipts, eventEndDates, "2028-03-01")).toEqual(
      receipts,
    );
  });

  test("Anlass ohne bekanntes Ende nie fällig", () => {
    expect(
      selectDueReceipts(
        [receipt("expense-1", "event-unknown")],
        eventEndDates,
        "2099-01-01",
      ),
    ).toEqual([]);
  });

  test("ohne Belege leer", () => {
    expect(selectDueReceipts([], eventEndDates, "2027-07-14")).toEqual([]);
  });
});

describe("selectReminderEventIds", () => {
  // A: Ende 14.07.2026 → Erinnerung 14.06.2027
  // B: Ende 29.02.2028 → Löschdatum 01.03.2029 → Erinnerung 30.01.2029
  // C: Ende 15.07.2026 → Erinnerung 15.06.2027
  const eventEndDates = new Map([
    ["event-a", "2026-07-14"],
    ["event-b", "2028-02-29"],
    ["event-c", "2026-07-15"],
  ]);

  test("am Erinnerungstag", () => {
    expect(selectReminderEventIds(eventEndDates, "2027-06-14")).toEqual([
      "event-a",
    ]);
  });

  test("einen Tag davor nicht", () => {
    expect(selectReminderEventIds(eventEndDates, "2027-06-13")).toEqual([]);
  });

  // Anders als beim Löschen wird nicht nachgeholt: sonst käme die Mail
  // jeden Tag bis zum Löschen.
  test("einen Tag danach nicht mehr, nur der Anlass mit Erinnerung heute", () => {
    expect(selectReminderEventIds(eventEndDates, "2027-06-15")).toEqual([
      "event-c",
    ]);
  });

  test("Erinnerung nach einem 29. Februar", () => {
    expect(selectReminderEventIds(eventEndDates, "2029-01-30")).toEqual([
      "event-b",
    ]);
  });

  test("mehrere Anlässe am selben Tag, in der Reihenfolge der Map", () => {
    const sameEnd = new Map([
      ["event-x", "2026-07-14"],
      ["event-y", "2026-07-14"],
    ]);

    expect(selectReminderEventIds(sameEnd, "2027-06-14")).toEqual([
      "event-x",
      "event-y",
    ]);
  });

  test("ohne Anlässe leer", () => {
    expect(selectReminderEventIds(new Map(), "2027-06-14")).toEqual([]);
  });
});

describe("formatSwissDate", () => {
  test.each([
    ["2027-07-14", "14.07.2027"],
    ["2027-01-05", "05.01.2027"],
    ["2026-12-31", "31.12.2026"],
  ])("%s → %s", (isoDate, expected) => {
    expect(formatSwissDate(isoDate)).toBe(expected);
  });
});

describe("formatReceiptCount", () => {
  test.each([
    [1, "1 Beleg"],
    [2, "2 Belege"],
    [0, "0 Belege"],
    [23, "23 Belege"],
  ])("%d → %s", (count, expected) => {
    expect(formatReceiptCount(count)).toBe(expected);
  });
});

describe("getExpenseTrackingUrl", () => {
  test("führt auf den Tab Abrechnung des Anlasses", () => {
    expect(getExpenseTrackingUrl("https://chuchipirat.ch", "event-a")).toBe(
      "https://chuchipirat.ch/event/event-a?tab=expensetracking",
    );
  });

  test("kein doppelter Schrägstrich, wenn SITE_URL mit / endet", () => {
    expect(getExpenseTrackingUrl("https://chuchipirat.ch/", "event-a")).toBe(
      "https://chuchipirat.ch/event/event-a?tab=expensetracking",
    );
  });
});

describe("buildReminderSubject", () => {
  test("Anlass und Löschdatum im Schweizer Format", () => {
    expect(buildReminderSubject("Sommerlager", "2027-07-14")).toBe(
      "Belege werden am 14.07.2027 gelöscht: «Sommerlager»",
    );
  });
});

describe("buildReminderGreeting", () => {
  test("mit Namen", () => {
    expect(buildReminderGreeting("Anna")).toBe("Hoi Anna,");
  });

  test("ohne Namen nur die Anrede, ohne Leerzeichen vor dem Komma", () => {
    expect(buildReminderGreeting("")).toBe("Hoi,");
  });
});

describe("buildReminderText", () => {
  // Erst im Test aufrufen, nicht beim Laden: sonst fällt die ganze Datei
  // aus, solange die Funktion noch fehlt.
  const buildTextFor = (receiptCount: number): string =>
    buildReminderText({
      recipientName: "Anna",
      eventName: "Sommerlager",
      deletionDate: "2027-07-14",
      receiptCount,
      url: "https://chuchipirat.ch/event/event-a?tab=expensetracking",
    });

  test.each([
    ["Anrede mit Namen", "Hoi Anna"],
    ["Anlass", "«Sommerlager»"],
    ["Löschdatum im Schweizer Format", "14.07.2027"],
    ["Anzahl Belege", "3 Belege"],
    [
      "Link zur Abrechnung",
      "https://chuchipirat.ch/event/event-a?tab=expensetracking",
    ],
    ["Hinweis auf den Export", "ZIP"],
  ])("enthält %s", (_case, expected) => {
    expect(buildTextFor(3)).toContain(expected);
  });

  test("kein Datum im Format YYYY-MM-DD", () => {
    expect(buildTextFor(3)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("ohne Namen beginnt der Text mit «Hoi,»", () => {
    const text = buildReminderText({
      recipientName: "",
      eventName: "Sommerlager",
      deletionDate: "2027-07-14",
      receiptCount: 3,
      url: "https://chuchipirat.ch/event/event-a?tab=expensetracking",
    });

    expect(text.startsWith("Hoi,\n")).toBe(true);
  });

  test("ein Beleg in der Einzahl", () => {
    const singleText = buildTextFor(1);

    expect(singleText).toContain("1 Beleg");
    expect(singleText).not.toContain("1 Belege");
  });
});
