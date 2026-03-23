import {Environment} from "../../Shared/utils.class";

// Mock für Utils — muss vor dem Import von customTheme stehen
let mockEnvironment = Environment.production;

jest.mock("../../Shared/utils.class", () => {
  const actualEnvironment = {
    development: 0,
    test: 1,
    production: 2,
  };

  class MockUtils {
    static getEnvironment() {
      return mockEnvironment;
    }
  }

  return {
    __esModule: true,
    default: MockUtils,
    Environment: actualEnvironment,
  };
});

import {getTheme} from "../customTheme";

describe("getTheme", () => {
  afterEach(() => {
    mockEnvironment = Environment.production;
  });

  test("gibt Light-Mode-Palette zurück wenn prefersDarkMode false ist", () => {
    const palette = getTheme(false);
    expect(palette.mode).toBe("light");
  });

  test("gibt Dark-Mode-Palette zurück wenn prefersDarkMode true ist", () => {
    const palette = getTheme(true);
    expect(palette.mode).toBe("dark");
  });

  test("Palette enthält primary, secondary und error", () => {
    const palette = getTheme(false);
    expect(palette.primary).toBeDefined();
    expect(palette.secondary).toBeDefined();
    expect(palette.error).toBeDefined();
  });

  test("Test-Umgebung liefert lilafarbenes Theme (Light)", () => {
    mockEnvironment = Environment.test;
    const palette = getTheme(false);
    expect((palette.primary as {main: string}).main).toBe("#6a1b9a");
  });

  test("Test-Umgebung liefert lilafarbenes Theme (Dark)", () => {
    mockEnvironment = Environment.test;
    const palette = getTheme(true);
    expect((palette.primary as {main: string}).main).toBe("#AB47BC");
  });

  test("Prod-Umgebung liefert cyanfarbenes Theme (Light)", () => {
    mockEnvironment = Environment.production;
    const palette = getTheme(false);
    expect((palette.primary as {main: string}).main).toBe("#006064");
  });

  test("Prod-Umgebung liefert cyanfarbenes Theme (Dark)", () => {
    mockEnvironment = Environment.production;
    const palette = getTheme(true);
    expect((palette.primary as {main: string}).main).toBe("#00bcd4");
  });

  test("Dev-Umgebung liefert gleiches Theme wie Prod", () => {
    mockEnvironment = Environment.development;
    const palette = getTheme(false);
    expect((palette.primary as {main: string}).main).toBe("#006064");
  });
});
