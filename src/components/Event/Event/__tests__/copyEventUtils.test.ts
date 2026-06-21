import {
  computeSliceDuration,
  computeEndDate,
  suggestNextSliceStart,
} from "../copyEventUtils";

describe("computeSliceDuration", () => {
  it("berechnet die Dauer inklusiv (15.04–17.04 = 3 Tage)", () => {
    const from = new Date("2026-04-15T00:00:00");
    const to = new Date("2026-04-17T00:00:00");
    expect(computeSliceDuration(from, to)).toBe(3);
  });

  it("gibt 1 zurück bei gleichem Start- und Enddatum (Eintagesanlass)", () => {
    const date = new Date("2026-07-01T00:00:00");
    expect(computeSliceDuration(date, date)).toBe(1);
  });

  it("gibt 1 zurück wenn Enddatum vor Startdatum liegt", () => {
    const from = new Date("2026-07-05T00:00:00");
    const to = new Date("2026-07-01T00:00:00");
    expect(computeSliceDuration(from, to)).toBe(1);
  });

  it("berechnet zwei aufeinanderfolgende Tage korrekt (01.–02. = 2 Tage)", () => {
    const from = new Date("2026-07-01T00:00:00");
    const to = new Date("2026-07-02T00:00:00");
    expect(computeSliceDuration(from, to)).toBe(2);
  });

  it("berechnet 06.05–14.05 als 9 Tage", () => {
    const from = new Date("2026-05-06T00:00:00");
    const to = new Date("2026-05-14T00:00:00");
    expect(computeSliceDuration(from, to)).toBe(9);
  });
});

describe("computeEndDate", () => {
  it("berechnet das Enddatum inklusiv (3 Tage ab 15.04 = 17.04)", () => {
    const start = new Date("2026-04-15T00:00:00");
    const result = computeEndDate(start, 3);
    expect(result.getDate()).toBe(17);
    expect(result.getMonth()).toBe(3); // April = 3
  });

  it("gibt dasselbe Datum zurück bei Dauer 1 (Eintagesanlass)", () => {
    const start = new Date("2026-08-05T00:00:00");
    const result = computeEndDate(start, 1);
    expect(result.getDate()).toBe(5);
    expect(result.getMonth()).toBe(7);
  });

  it("verändert das Original-Datum nicht", () => {
    const start = new Date("2026-08-05T00:00:00");
    computeEndDate(start, 5);
    expect(start.getDate()).toBe(5);
  });

  it("funktioniert über Monatsgrenzen hinweg (9 Tage ab 06.05 = 14.05)", () => {
    const start = new Date("2026-05-06T00:00:00");
    const result = computeEndDate(start, 9);
    expect(result.getMonth()).toBe(4); // Mai = 4
    expect(result.getDate()).toBe(14);
  });

  it("roundtrip: duration → endDate ergibt Original", () => {
    const from = new Date("2026-04-15T00:00:00");
    const to = new Date("2026-04-17T00:00:00");
    const duration = computeSliceDuration(from, to); // 3
    const reconstructed = computeEndDate(from, duration);
    expect(reconstructed.getDate()).toBe(to.getDate());
    expect(reconstructed.getMonth()).toBe(to.getMonth());
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
