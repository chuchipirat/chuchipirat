import * as Routes from "../routes";

describe("routes", () => {
  const routeEntries = Object.entries(Routes);

  it("alle Routen beginnen mit /", () => {
    routeEntries.forEach(([_key, value]) => {
      expect(value).toMatch(/^\//);
    });
  });

  it("keine doppelten Routen-Werte", () => {
    const values = routeEntries.map(([, value]) => value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("UID-Routen enthalten :id Parameter", () => {
    routeEntries
      .filter(([key]) => key.endsWith("_UID"))
      .forEach(([_key, value]) => {
        expect(value).toContain(":id");
      });
  });

  it("Schlüssel-Routen existieren", () => {
    expect(Routes.LANDING).toBeDefined();
    expect(Routes.HOME).toBeDefined();
    expect(Routes.SIGN_IN).toBeDefined();
    expect(Routes.SIGN_UP).toBeDefined();
    expect(Routes.RECIPES).toBeDefined();
    expect(Routes.EVENTS).toBeDefined();
  });
});
