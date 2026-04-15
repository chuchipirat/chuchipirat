import {
  computeSliceDuration,
  computeEndDate,
  suggestNextSliceStart,
} from "../copyEventUtils";

describe("computeSliceDuration", () => {
  it("berechnet die Dauer für ein mehrtägiges Event korrekt", () => {
    // 1. Juli bis 3. Juli = 2 Tage
    const from = new Date("2026-07-01");
    const to = new Date("2026-07-03");
    expect(computeSliceDuration(from, to)).toBe(2);
  });

  it("gibt 0 zurück bei gleichem Start- und Enddatum", () => {
    const date = new Date("2026-07-01");
    expect(computeSliceDuration(date, date)).toBe(0);
  });

  it("gibt 0 zurück wenn Enddatum vor Startdatum liegt", () => {
    const from = new Date("2026-07-05");
    const to = new Date("2026-07-01");
    expect(computeSliceDuration(from, to)).toBe(0);
  });

  it("berechnet einen einzelnen Tag korrekt", () => {
    const from = new Date("2026-07-01");
    const to = new Date("2026-07-02");
    expect(computeSliceDuration(from, to)).toBe(1);
  });
});

describe("computeEndDate", () => {
  it("berechnet das Enddatum basierend auf Dauer korrekt", () => {
    const start = new Date("2026-08-05");
    const result = computeEndDate(start, 2);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7); // August = 7 (0-indexed)
    expect(result.getDate()).toBe(7);
  });

  it("gibt dasselbe Datum zurück bei Dauer 0", () => {
    const start = new Date("2026-08-05");
    const result = computeEndDate(start, 0);
    expect(result.getDate()).toBe(5);
    expect(result.getMonth()).toBe(7);
  });

  it("verändert das Original-Datum nicht", () => {
    const start = new Date("2026-08-05");
    computeEndDate(start, 5);
    expect(start.getDate()).toBe(5);
  });

  it("funktioniert über Monatsgrenzen hinweg", () => {
    const start = new Date("2026-07-30");
    const result = computeEndDate(start, 3);
    expect(result.getMonth()).toBe(7); // August
    expect(result.getDate()).toBe(2);
  });
});

describe("suggestNextSliceStart", () => {
  const originalSlices = [
    {dateFrom: new Date("2026-07-01"), dateTo: new Date("2026-07-05")},
    {dateFrom: new Date("2026-07-31"), dateTo: new Date("2026-08-04")},
  ];

  it("gibt für Index 0 direkt das neue Startdatum zurück", () => {
    const newStart = new Date("2026-09-01");
    const result = suggestNextSliceStart(originalSlices, newStart, 0);
    expect(result.getTime()).toBe(newStart.getTime());
  });

  it("behält die Lücke zwischen den Zeitscheiben bei", () => {
    const newStart = new Date("2026-09-01");
    // Original-Lücke: 31. Juli - 1. Juli = 30 Tage
    const result = suggestNextSliceStart(originalSlices, newStart, 1);
    // 1. September + 30 Tage = 1. Oktober
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9); // Oktober = 9
    expect(result.getDate()).toBe(1);
  });

  it("behandelt eine einzelne Zeitscheibe korrekt", () => {
    const singleSlice = [{dateFrom: new Date("2026-07-01"), dateTo: new Date("2026-07-05")}];
    const newStart = new Date("2026-09-01");
    const result = suggestNextSliceStart(singleSlice, newStart, 0);
    expect(result.getTime()).toBe(newStart.getTime());
  });

  it("behandelt leeres Array korrekt", () => {
    const newStart = new Date("2026-09-01");
    const result = suggestNextSliceStart([], newStart, 0);
    expect(result.getTime()).toBe(newStart.getTime());
  });

  it("verändert das Original-Startdatum nicht", () => {
    const newStart = new Date("2026-09-01");
    const originalTime = newStart.getTime();
    suggestNextSliceStart(originalSlices, newStart, 1);
    expect(newStart.getTime()).toBe(originalTime);
  });
});
