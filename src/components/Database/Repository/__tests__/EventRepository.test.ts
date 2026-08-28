/**
 * Unit-Tests fuer EventRepository.
 *
 * Testet die reine Hilfsfunktion getMaxDate() sowie das Mapping
 * von event_dates in getAllEventsForUser().
 */
import {
  EventRepository,
  EventDomain,
  EventDateDomain,
  getMaxDate,
  getNearestUpcomingStartDate,
  getNearestUpcomingDateSlice,
  getEventLifecycleStatus,
  getActiveDateSlice,
} from "../EventRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {parseLocalDate} from "../../../../utils/dateUtils";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Shared/sessionStorageHandler.class", () => {
  const actual = jest.requireActual("../../../Shared/sessionStorageHandler.class");
  return {
    ...actual,
    SessionStorageHandler: {
      getDocument: jest.fn().mockReturnValue(null),
      upsertDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocumentField: jest.fn(),
      incrementFieldValue: jest.fn(),
    },
  };
});

/* =====================================================================
// Hilfsfunktionen fuer Testdaten
// ===================================================================== */

/**
 * Erzeugt ein minimales EventDomain-Objekt mit den uebergebenen Zeitscheiben.
 */
function createEvent(dates: EventDateDomain[]): EventDomain {
  return {
    uid: "evt-1",
    name: "Test Event",
    motto: "Test",
    location: "Zürich",
    pictureSrc: "",
    cooks: [],
    dates,
    createdAt: new Date("2026-01-01"),
    createdBy: null,
    updatedAt: new Date("2026-01-01"),
    updatedBy: null,
  };
}

/**
 * Erzeugt einen EventDateDomain-Eintrag.
 */
function createDate(dateFrom: string, dateTo: string, sortOrder = 0): EventDateDomain {
  return {
    uid: `date-${sortOrder}`,
    sortOrder,
    dateFrom: new Date(dateFrom),
    dateTo: new Date(dateTo),
  };
}

/* =====================================================================
// getMaxDate() Tests
// ===================================================================== */
describe("getMaxDate", () => {
  test("gibt new Date(0) zurueck bei leerem dates-Array", () => {
    const event = createEvent([]);
    expect(getMaxDate(event)).toEqual(new Date(0));
  });

  test("gibt dateTo zurueck bei einzelnem Eintrag", () => {
    const event = createEvent([createDate("2026-03-10", "2026-03-12")]);
    expect(getMaxDate(event)).toEqual(new Date("2026-03-12"));
  });

  test("gibt das spaeteste dateTo zurueck bei mehreren Eintraegen", () => {
    const event = createEvent([
      createDate("2026-03-01", "2026-03-03", 0),
      createDate("2026-03-10", "2026-03-15", 1),
      createDate("2026-03-05", "2026-03-07", 2),
    ]);
    expect(getMaxDate(event)).toEqual(new Date("2026-03-15"));
  });

  test("funktioniert unabhaengig von der Reihenfolge der Eintraege", () => {
    const event = createEvent([
      createDate("2026-06-01", "2026-06-30", 2),
      createDate("2026-01-01", "2026-01-15", 0),
      createDate("2026-03-01", "2026-03-10", 1),
    ]);
    expect(getMaxDate(event)).toEqual(new Date("2026-06-30"));
  });
});

/* =====================================================================
// getNearestUpcomingStartDate() Tests
// ===================================================================== */
describe("getNearestUpcomingStartDate", () => {
  test("gibt null zurueck bei leerem dates-Array", () => {
    const event = createEvent([]);
    expect(getNearestUpcomingStartDate(event)).toBeNull();
  });

  test("gibt dateFrom zurueck bei einzelnem bevorstehendem Eintrag", () => {
    const event = createEvent([createDate("2026-03-10", "2026-03-12")]);
    const referenceDate = new Date("2026-03-01");
    expect(getNearestUpcomingStartDate(event, referenceDate)).toEqual(
      new Date("2026-03-10"),
    );
  });

  test("ignoriert eine bereits abgelaufene erste Zeitscheibe und gibt die naechste bevorstehende zurueck", () => {
    // Zeitscheibe A: 01.-03.03. (bereits vorbei), Zeitscheibe B: 15.-17.03. (bevorstehend)
    const event = createEvent([
      createDate("2026-03-01", "2026-03-03", 0),
      createDate("2026-03-15", "2026-03-17", 1),
    ]);
    const referenceDate = new Date("2026-03-10");

    expect(getNearestUpcomingStartDate(event, referenceDate)).toEqual(
      new Date("2026-03-15"),
    );
  });

  test("gibt das frueheste bevorstehende dateFrom zurueck, wenn mehrere Zeitscheiben noch bevorstehen", () => {
    const event = createEvent([
      createDate("2026-05-01", "2026-05-03", 0),
      createDate("2026-03-15", "2026-03-17", 1),
      createDate("2026-04-01", "2026-04-03", 2),
    ]);
    const referenceDate = new Date("2026-03-01");

    expect(getNearestUpcomingStartDate(event, referenceDate)).toEqual(
      new Date("2026-03-15"),
    );
  });

  test("faellt auf die frueheste Zeitscheibe insgesamt zurueck, wenn alle bereits abgelaufen sind", () => {
    const event = createEvent([
      createDate("2026-01-10", "2026-01-12", 0),
      createDate("2026-02-01", "2026-02-03", 1),
    ]);
    const referenceDate = new Date("2026-03-01");

    expect(getNearestUpcomingStartDate(event, referenceDate)).toEqual(
      new Date("2026-01-10"),
    );
  });

  test("nutzt new Date() als Default fuer referenceDate", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const event = createEvent([
      createDate(futureDate.toISOString(), futureDate.toISOString()),
    ]);

    expect(getNearestUpcomingStartDate(event)).toEqual(
      new Date(futureDate.toISOString()),
    );
  });
});

/* =====================================================================
// getEventLifecycleStatus() Tests
// ===================================================================== */
describe("getEventLifecycleStatus", () => {
  test("gibt 'upcoming' zurueck, wenn heute vor der einzigen Zeitscheibe liegt", () => {
    const event = createEvent([createDate("2026-08-01", "2026-08-03")]);
    expect(getEventLifecycleStatus(event, new Date("2026-07-20"))).toBe(
      "upcoming",
    );
  });

  test("gibt 'ongoing' zurueck, wenn heute innerhalb der einzigen Zeitscheibe liegt", () => {
    const event = createEvent([createDate("2026-08-01", "2026-08-03")]);
    expect(getEventLifecycleStatus(event, new Date("2026-08-02"))).toBe(
      "ongoing",
    );
  });

  test("gibt 'upcoming' zurueck, wenn heute in der Pause zwischen zwei Zeitscheiben liegt", () => {
    // Zeitscheibe A: 01.-03.08. (bereits vorbei), Zeitscheibe B: 15.-17.08. (bevorstehend)
    const event = createEvent([
      createDate("2026-08-01", "2026-08-03", 0),
      createDate("2026-08-15", "2026-08-17", 1),
    ]);
    expect(getEventLifecycleStatus(event, new Date("2026-08-10"))).toBe(
      "upcoming",
    );
  });

  test("gibt 'ongoing' zurueck, wenn heute innerhalb der zweiten von zwei Zeitscheiben liegt", () => {
    const event = createEvent([
      createDate("2026-08-01", "2026-08-03", 0),
      createDate("2026-08-15", "2026-08-17", 1),
    ]);
    expect(getEventLifecycleStatus(event, new Date("2026-08-16"))).toBe(
      "ongoing",
    );
  });

  test("gibt 'upcoming' zurueck bei leerem dates-Array", () => {
    const event = createEvent([]);
    expect(getEventLifecycleStatus(event, new Date("2026-08-16"))).toBe(
      "upcoming",
    );
  });

  test("gibt 'ongoing' zurueck am letzten Tag der Zeitscheibe, auch spaeter am Tag (nicht nur um Mitternacht)", () => {
    // Regression: dateTo wird als Mitternacht geparst. Ein Vergleich mit der
    // vollen aktuellen Uhrzeit (statt auf Tagesbeginn normalisiert) wuerde
    // ein Event bereits kurz nach Mitternacht am letzten Tag als "upcoming"
    // statt "ongoing" einstufen.
    const event = createEvent([createDate("2026-08-01", "2026-08-03")]);
    expect(
      getEventLifecycleStatus(event, new Date("2026-08-03T14:32:00")),
    ).toBe("ongoing");
    expect(
      getEventLifecycleStatus(event, new Date("2026-08-03T23:59:59")),
    ).toBe("ongoing");
  });
});

/* =====================================================================
// getActiveDateSlice() Tests
// ===================================================================== */
describe("getActiveDateSlice", () => {
  test("gibt null zurueck, wenn heute vor jeder Zeitscheibe liegt", () => {
    const event = createEvent([createDate("2026-08-01", "2026-08-03")]);
    expect(getActiveDateSlice(event, new Date("2026-07-20"))).toBeNull();
  });

  test("gibt die laufende Zeitscheibe zurueck", () => {
    const slice = createDate("2026-08-01", "2026-08-03");
    const event = createEvent([slice]);
    expect(getActiveDateSlice(event, new Date("2026-08-02"))).toEqual(slice);
  });

  test("gibt null zurueck, wenn heute in der Pause zwischen zwei Zeitscheiben liegt", () => {
    const event = createEvent([
      createDate("2026-08-01", "2026-08-03", 0),
      createDate("2026-08-15", "2026-08-17", 1),
    ]);
    expect(getActiveDateSlice(event, new Date("2026-08-10"))).toBeNull();
  });

  test("gibt die Zeitscheibe am letzten Tag zurueck, auch spaeter am Tag (nicht nur um Mitternacht)", () => {
    const slice = createDate("2026-08-01", "2026-08-03");
    const event = createEvent([slice]);
    expect(
      getActiveDateSlice(event, new Date("2026-08-03T14:32:00")),
    ).toEqual(slice);
  });
});

/* =====================================================================
// getNearestUpcomingDateSlice() Tests
// ===================================================================== */
describe("getNearestUpcomingDateSlice", () => {
  test("gibt die frueheste bevorstehende Zeitscheibe zurueck, nicht eine bereits abgelaufene", () => {
    const pastSlice = createDate("2026-08-01", "2026-08-03", 0);
    const upcomingSlice = createDate("2026-08-15", "2026-08-17", 1);
    const event = createEvent([pastSlice, upcomingSlice]);

    expect(
      getNearestUpcomingDateSlice(event, new Date("2026-08-10")),
    ).toEqual(upcomingSlice);
  });

  test("gibt null zurueck bei leerem dates-Array", () => {
    const event = createEvent([]);
    expect(getNearestUpcomingDateSlice(event)).toBeNull();
  });
});

/* =====================================================================
// getAllEventsForUser() — event_dates-Mapping
// ===================================================================== */
describe("EventRepository.getAllEventsForUser", () => {
  test("mappt verschachtelte event_dates in domain dates[]", async () => {
    const {client, queryMock} = createSupabaseMock();

    // Auth-User simulieren
    (client as any).auth = {
      getUser: jest.fn().mockResolvedValue({
        data: {user: {id: "user-uuid-1"}},
      }),
    };

    // Supabase-Antwort mit verschachtelten event_dates
    const mockData = [
      {
        id: "evt-1",
        firebase_uid: null,
        name: "Pfadilager",
        motto: "Abenteuer",
        location: "Bern",
        picture_src: "",
        created_at: "2026-01-01T00:00:00Z",
        created_by: null,
        updated_at: "2026-01-01T00:00:00Z",
        updated_by: null,
        event_cooks: [{user_id: "user-uuid-1"}],
        event_dates: [
          {id: "d1", sort_order: 0, date_from: "2026-03-10", date_to: "2026-03-12"},
          {id: "d2", sort_order: 10, date_from: "2026-03-13", date_to: "2026-03-15"},
        ],
      },
    ];

    // Query-Kette endet ohne single() — muss als Promise aufgeloest werden
    queryMock.order.mockResolvedValue({data: mockData, error: null});

    const repo = new EventRepository(client as any);
    const events = await repo.getAllEventsForUser();

    expect(events).toHaveLength(1);
    expect(events[0].dates).toHaveLength(2);
    expect(events[0].dates[0].uid).toBe("d1");
    expect(events[0].dates[0].dateFrom).toEqual(parseLocalDate("2026-03-10"));
    expect(events[0].dates[0].dateTo).toEqual(parseLocalDate("2026-03-12"));
    expect(events[0].dates[1].uid).toBe("d2");
    expect(events[0].dates[1].sortOrder).toBe(10);
  });

  test("gibt leeres dates[] zurueck wenn event_dates fehlt", async () => {
    const {client, queryMock} = createSupabaseMock();

    (client as any).auth = {
      getUser: jest.fn().mockResolvedValue({
        data: {user: {id: "user-uuid-1"}},
      }),
    };

    const mockData = [
      {
        id: "evt-2",
        firebase_uid: null,
        name: "Sommerlager",
        motto: "",
        location: "",
        picture_src: "",
        created_at: "2026-01-01T00:00:00Z",
        created_by: null,
        updated_at: "2026-01-01T00:00:00Z",
        updated_by: null,
        event_cooks: [{user_id: "user-uuid-1"}],
        // event_dates fehlt absichtlich
      },
    ];

    queryMock.order.mockResolvedValue({data: mockData, error: null});

    const repo = new EventRepository(client as any);
    const events = await repo.getAllEventsForUser();

    expect(events).toHaveLength(1);
    expect(events[0].dates).toEqual([]);
  });

  test("gibt leeres Array zurueck statt mit leerer UUID zu queryen, wenn auth.getUser() transient keinen User liefert", async () => {
    const {client, queryMock} = createSupabaseMock();

    // Race kurz nach dem Login: auth.getUser() liefert (noch) keinen User
    (client as any).auth = {
      getUser: jest.fn().mockResolvedValue({data: {user: undefined}}),
    };

    const repo = new EventRepository(client as any);
    const events = await repo.getAllEventsForUser();

    expect(events).toEqual([]);
    expect(queryMock.order).not.toHaveBeenCalled();
  });
});
