/**
 * Unit-Tests fuer die neuen MenuplanRepository-Methoden rund um das
 * "Läuft gerade"-Home-Widget: getMealIdsForEventInRange und die
 * Mahlzeit-Typ-Cutoff-Zeiten-CRUD (mit Synonym-Namen).
 */
import {MenuplanRepository} from "../MenuplanRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

describe("MenuplanRepository — Cutoff-Zeiten und Datumsbereich-Abfragen", () => {
  let repo: MenuplanRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new MenuplanRepository();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // getMealIdsForEventInRange()
  // ------------------------------------------ */
  describe("getMealIdsForEventInRange()", () => {
    test("gibt ein Set der Mahlzeiten-IDs im Bereich zurueck", async () => {
      supabaseMock.queryMock.lte.mockResolvedValue({
        data: [{id: "meal-1"}, {id: "meal-2"}],
        error: null,
      });

      const result = await repo.getMealIdsForEventInRange(
        "event-1",
        new Date("2026-08-01"),
        new Date("2026-08-03"),
      );

      expect(supabaseMock.client.from).toHaveBeenCalledWith("event_meals");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("event_id", "event-1");
      expect(supabaseMock.queryMock.gte).toHaveBeenCalledWith("meal_date", "2026-08-01");
      expect(supabaseMock.queryMock.lte).toHaveBeenCalledWith("meal_date", "2026-08-03");
      expect(result).toEqual(new Set(["meal-1", "meal-2"]));
    });

    test("gibt ein leeres Set zurueck, wenn keine Mahlzeiten gefunden werden", async () => {
      supabaseMock.queryMock.lte.mockResolvedValue({data: [], error: null});

      const result = await repo.getMealIdsForEventInRange(
        "event-1",
        new Date("2026-08-01"),
        new Date("2026-08-03"),
      );

      expect(result).toEqual(new Set());
    });

    test("wirft bei Datenbankfehler", async () => {
      supabaseMock.queryMock.lte.mockResolvedValue({
        data: null,
        error: {message: "DB Fehler"},
      });

      await expect(
        repo.getMealIdsForEventInRange(
          "event-1",
          new Date("2026-08-01"),
          new Date("2026-08-03"),
        ),
      ).rejects.toEqual({message: "DB Fehler"});
    });
  });

  /* ------------------------------------------
  // Mahlzeit-Typ-Cutoff-Zeiten CRUD (Synonym-Namen)
  // ------------------------------------------ */
  describe("getCutoffTimes()", () => {
    test("laedt und mappt alle Cutoff-Zeiten sortiert", async () => {
      supabaseMock.queryMock.order.mockResolvedValue({
        data: [
          {id: "c1", names: ["Zmorge", "Zmorgen", "Frühstück"], cutoff_time: "10:00", sort_order: 1},
          {id: "c2", names: ["Zmittag"], cutoff_time: "14:00", sort_order: 2},
        ],
        error: null,
      });

      const result = await repo.getCutoffTimes();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("meal_type_cutoff_times");
      expect(result).toEqual([
        {id: "c1", names: ["Zmorge", "Zmorgen", "Frühstück"], cutoffTime: "10:00", sortOrder: 1},
        {id: "c2", names: ["Zmittag"], cutoffTime: "14:00", sortOrder: 2},
      ]);
    });

    test("wirft bei Fehler", async () => {
      supabaseMock.queryMock.order.mockResolvedValue({
        data: null,
        error: {message: "DB Fehler"},
      });

      await expect(repo.getCutoffTimes()).rejects.toEqual({message: "DB Fehler"});
    });
  });

  describe("createCutoffTime()", () => {
    test("erstellt eine neue Cutoff-Zeit mit mehreren Synonymen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: {id: "new-id", names: ["Zvieri", "Znüni"], cutoff_time: "16:00", sort_order: 3},
        error: null,
      });

      const result = await repo.createCutoffTime({
        names: ["Zvieri", "Znüni"],
        cutoffTime: "16:00",
        sortOrder: 3,
      });

      expect(supabaseMock.queryMock.insert).toHaveBeenCalledWith({
        names: ["Zvieri", "Znüni"],
        cutoff_time: "16:00",
        sort_order: 3,
      });
      expect(result).toEqual({
        id: "new-id",
        names: ["Zvieri", "Znüni"],
        cutoffTime: "16:00",
        sortOrder: 3,
      });
    });
  });

  describe("updateCutoffTime()", () => {
    test("aktualisiert eine bestehende Cutoff-Zeit", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({error: null});

      await repo.updateCutoffTime({
        id: "c1",
        names: ["Zmorge", "Frühstück"],
        cutoffTime: "09:30",
        sortOrder: 1,
      });

      expect(supabaseMock.queryMock.update).toHaveBeenCalledWith({
        names: ["Zmorge", "Frühstück"],
        cutoff_time: "09:30",
        sort_order: 1,
      });
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "c1");
    });
  });

  describe("deleteCutoffTime()", () => {
    test("loescht eine Cutoff-Zeit", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({error: null});

      await repo.deleteCutoffTime("c1");

      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "c1");
    });
  });
});
