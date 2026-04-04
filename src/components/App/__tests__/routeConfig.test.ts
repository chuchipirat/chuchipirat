// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// firebase/auth benötigt Web-APIs die in jsdom nicht vorhanden sind
jest.mock("firebase/auth", () => ({}));

import {routeConfig} from "../routeConfig";
import {Role} from "../../../constants/roles";
import type AuthUser from "../../Firebase/Authentication/authUser.class";

/** Erstellt einen minimalen AuthUser mit den angegebenen Rollen. */
const makeAuthUser = (roles: Role[]): AuthUser =>
  ({
    uid: "test-uid",
    email: "test@test.ch",
    emailVerified: true,
    firstName: "Test",
    lastName: "User",
    roles,
    publicProfile: {displayName: "Test", motto: "", pictureSrc: ""},
  }) as AuthUser;

describe("routeConfig", () => {
  test("alle Routen haben einen gültigen Pfad der mit / beginnt", () => {
    for (const route of routeConfig) {
      expect(route.path).toMatch(/^\//);
    }
  });

  test("alle Routen haben eine Komponente definiert", () => {
    for (const route of routeConfig) {
      expect(route.component).toBeDefined();
    }
  });

  test("keine doppelten Pfade", () => {
    const paths = routeConfig.map((route) => route.path);
    const uniquePaths = new Set(paths);
    expect(uniquePaths.size).toBe(paths.length);
  });

  test("emailVerificationOnly-Routen haben keinen guard", () => {
    const emailRoutes = routeConfig.filter(
      (route) => route.emailVerificationOnly
    );
    for (const route of emailRoutes) {
      expect(route.guard).toBeUndefined();
    }
  });

  test("Routen mit guard haben kein emailVerificationOnly", () => {
    const guardedRoutes = routeConfig.filter((route) => route.guard);
    for (const route of guardedRoutes) {
      expect(route.emailVerificationOnly).toBeFalsy();
    }
  });
});

describe("Guard-Funktionen", () => {
  // Guard-Funktionen aus der routeConfig extrahieren
  const guardedRoutes = routeConfig.filter((route) => route.guard);
  const guards = new Set(guardedRoutes.map((route) => route.guard!));

  test("alle Guards geben false für null zurück", () => {
    for (const guard of guards) {
      expect(guard(null)).toBe(false);
    }
  });

  test("isAuthenticated gibt true für eingeloggten User zurück", () => {
    // Finde eine Route mit dem einfachsten Guard (HOME ist isAuthenticated)
    const homeRoute = routeConfig.find((route) => route.path === "/home");
    expect(homeRoute?.guard).toBeDefined();
    expect(homeRoute!.guard!(makeAuthUser([Role.basic]))).toBe(true);
  });

  test("isAdmin prüft auf Admin-Rolle", () => {
    // Finde eine admin-only Route
    const adminRoute = routeConfig.find(
      (route) => route.path === "/system/globalsettings"
    );
    expect(adminRoute?.guard).toBeDefined();

    expect(adminRoute!.guard!(makeAuthUser([Role.admin]))).toBe(true);
    expect(adminRoute!.guard!(makeAuthUser([Role.basic]))).toBe(false);
    expect(adminRoute!.guard!(makeAuthUser([Role.communityLeader]))).toBe(
      false
    );
  });

  test("isAdminOrCommunityLeader prüft auf beide Rollen", () => {
    const systemRoute = routeConfig.find((route) => route.path === "/system");
    expect(systemRoute?.guard).toBeDefined();

    expect(systemRoute!.guard!(makeAuthUser([Role.admin]))).toBe(true);
    expect(systemRoute!.guard!(makeAuthUser([Role.communityLeader]))).toBe(
      true
    );
    expect(systemRoute!.guard!(makeAuthUser([Role.basic]))).toBe(false);
  });

  test("isCommunityLeader prüft auf CommunityLeader-Rolle", () => {
    const feedsRoute = routeConfig.find(
      (route) => route.path === "/system/overview/feeds"
    );
    expect(feedsRoute?.guard).toBeDefined();

    expect(feedsRoute!.guard!(makeAuthUser([Role.communityLeader]))).toBe(
      true
    );
    expect(feedsRoute!.guard!(makeAuthUser([Role.basic]))).toBe(false);
  });
});
