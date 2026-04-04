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
} from "../EventRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Firebase/Db/sessionStorageHandler.class", () => {
  const actual = jest.requireActual("../../../Firebase/Db/sessionStorageHandler.class");
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
    expect(events[0].dates[0].dateFrom).toEqual(new Date("2026-03-10"));
    expect(events[0].dates[0].dateTo).toEqual(new Date("2026-03-12"));
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
});
