/**
 * Unit-Tests für imageResize.ts.
 *
 * Testet die Berechnung der skalierten Dimensionen.
 * Der eigentliche Canvas-basierte Resize wird nicht getestet,
 * da jsdom kein Canvas unterstützt.
 */
import {calculateDimensions} from "../imageResize";

describe("calculateDimensions()", () => {
  test("Querformat: grösste Seite auf maxDimension skalieren", () => {
    const {width, height} = calculateDimensions(2000, 1000, 1200);

    expect(width).toBe(1200);
    expect(height).toBe(600);
  });

  test("Hochformat: grösste Seite auf maxDimension skalieren", () => {
    const {width, height} = calculateDimensions(1000, 2000, 1200);

    expect(width).toBe(600);
    expect(height).toBe(1200);
  });

  test("Quadratisch: auf maxDimension skalieren", () => {
    const {width, height} = calculateDimensions(3000, 3000, 1200);

    expect(width).toBe(1200);
    expect(height).toBe(1200);
  });

  test("Kein Upscaling wenn Bild kleiner als maxDimension", () => {
    const {width, height} = calculateDimensions(800, 600, 1200);

    expect(width).toBe(800);
    expect(height).toBe(600);
  });

  test("Kein Upscaling bei exakter maxDimension", () => {
    const {width, height} = calculateDimensions(1200, 900, 1200);

    expect(width).toBe(1200);
    expect(height).toBe(900);
  });

  test("Nur Höhe über maxDimension: proportional skalieren", () => {
    const {width, height} = calculateDimensions(800, 1600, 1200);

    expect(width).toBe(600);
    expect(height).toBe(1200);
  });

  test("Seitenverhältnis beibehalten", () => {
    const {width, height} = calculateDimensions(4000, 3000, 1200);
    const ratio = width / height;

    expect(ratio).toBeCloseTo(4 / 3, 1);
  });

  test("Ganzzahlige Dimensionen zurückgeben", () => {
    const {width, height} = calculateDimensions(1920, 1080, 1200);

    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
  });
});
