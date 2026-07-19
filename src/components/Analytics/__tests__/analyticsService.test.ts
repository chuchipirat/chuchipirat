/**
 * Unit-Tests für den Analytics-Service.
 *
 * Testet `normalizeAnalyticsUrl()`, welche UUID-Segmente aus getrackten
 * URLs entfernt, um die URL-Kardinalität im Umami-Pages-Report gering
 * zu halten, sowie `getAnalyticsRole()`, welche Admin-/Community-Leader-
 * getriebene Aktionen von organischer Nutzung unterscheidbar macht.
 */
import {normalizeAnalyticsUrl, getAnalyticsRole} from "../analyticsService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {Role} from "../../../constants/roles";

const buildAuthUser = (roles: Role[]): AuthUser => {
  const authUser = new AuthUser();
  authUser.roles = roles;
  return authUser;
};

describe("normalizeAnalyticsUrl", () => {
  test("ersetzt ein UUID-Segment im Pfad durch :id", () => {
    expect(
      normalizeAnalyticsUrl(
        "/event/3fa85f64-5717-4562-b3fc-2c963f66afa6/menuplan",
      ),
    ).toBe("/event/:id/menuplan");
  });

  test("ersetzt mehrere UUID-Segmente im selben Pfad", () => {
    expect(
      normalizeAnalyticsUrl(
        "/event/3fa85f64-5717-4562-b3fc-2c963f66afa6/recipe/1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      ),
    ).toBe("/event/:id/recipe/:id");
  });

  test("lässt URLs ohne UUID unverändert", () => {
    expect(normalizeAnalyticsUrl("/recipes")).toBe("/recipes");
    expect(normalizeAnalyticsUrl("/")).toBe("/");
  });

  test("erkennt UUIDs unabhängig von Gross-/Kleinschreibung", () => {
    expect(
      normalizeAnalyticsUrl("/event/3FA85F64-5717-4562-B3FC-2C963F66AFA6"),
    ).toBe("/event/:id");
  });
});

describe("getAnalyticsRole", () => {
  test("gibt 'anonymous' zurück, wenn kein Benutzer angemeldet ist", () => {
    expect(getAnalyticsRole(null)).toBe("anonymous");
    expect(getAnalyticsRole(undefined)).toBe("anonymous");
  });

  test("gibt 'admin' zurück, wenn der Benutzer die Admin-Rolle hat", () => {
    expect(getAnalyticsRole(buildAuthUser([Role.admin]))).toBe("admin");
  });

  test("gibt 'admin' zurück, auch wenn zusätzlich weitere Rollen vorhanden sind", () => {
    expect(
      getAnalyticsRole(buildAuthUser([Role.communityLeader, Role.admin])),
    ).toBe("admin");
  });

  test("gibt 'communityLeader' zurück, wenn keine Admin-Rolle vorhanden ist", () => {
    expect(getAnalyticsRole(buildAuthUser([Role.communityLeader]))).toBe(
      "communityLeader",
    );
  });

  test("gibt 'basic' zurück, wenn nur die Basis-Rolle vorhanden ist", () => {
    expect(getAnalyticsRole(buildAuthUser([Role.basic]))).toBe("basic");
  });
});
