/**
 * Unit-Tests für HelpCenter.getMatchingHelpPage().
 *
 * Testet das Routing-Matching von Anwendungspfaden auf Helpcenter-URLs
 * für alle unterstützten Routen, Navigations-Objekte und Aktionen.
 */
import HelpCenter from "../helpCenter.class";
import * as ROUTES from "../../../constants/routes";
import {HELPCENTER_URL} from "../../../constants/defaultValues";
import Action from "../../../constants/actions";
import {NavigationObject} from "../navigationContext";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("HelpCenter.getMatchingHelpPage()", () => {
  /** Hilfsfunktion: Erwartet eine bestimmte Helpcenter-URL */
  const expectHelpPage = (
    actualPath: string,
    expectedSubdir: string,
    expectedPage: string,
    options?: {navigationObject?: NavigationObject; action?: Action}
  ) => {
    const result = HelpCenter.getMatchingHelpPage({
      actualPath,
      navigationObject: options?.navigationObject,
      action: options?.action,
    });
    expect(result).toBe(`${HELPCENTER_URL}/docs/${expectedSubdir}/${expectedPage}`);
  };

  /* ------------------------------------------
  // Home
  // ------------------------------------------ */
  describe("Home", () => {
    test("Home-Pfad gibt home/home zurück", () => {
      expectHelpPage("/home", "home", "home");
    });
  });

  /* ------------------------------------------
  // Rezepte
  // ------------------------------------------ */
  describe("Rezepte", () => {
    test("Rezept-Ansicht gibt recipe/structure zurück", () => {
      expectHelpPage("/recipe/abc", "recipe", "structure", {action: Action.VIEW});
    });

    test("Rezept-Bearbeitung gibt recipe/create_edit zurück", () => {
      expectHelpPage("/recipe/abc", "recipe", "create_edit", {action: Action.EDIT});
    });

    test("Rezept ohne Action gibt recipe/recipe zurück", () => {
      expectHelpPage("/recipe", "recipe", "recipe");
    });

    test("Rezept-Übersicht gibt recipe/overview zurück", () => {
      expectHelpPage("/recipes", "recipe", "overview");
    });
  });

  /* ------------------------------------------
  // Event
  // ------------------------------------------ */
  describe("Event", () => {
    test("Event ohne NavigationObject und Action NEW gibt event/create zurück", () => {
      expectHelpPage("/event/new", "event", "create", {action: Action.NEW});
    });

    test("Event ohne NavigationObject gibt event/event zurück", () => {
      expectHelpPage("/event/abc", "event", "event");
    });

    test("Menüplan gibt event/menueplan zurück", () => {
      expectHelpPage("/event/abc", "event", "menueplan", {
        navigationObject: NavigationObject.menueplan,
      });
    });

    test("Gruppenkonfiguration gibt event/groupconfiguration zurück", () => {
      expectHelpPage("/event/abc", "event", "groupconfiguration", {
        navigationObject: NavigationObject.groupConfiguration,
      });
    });

    test("Verwendete Rezepte gibt event/used_recipes zurück", () => {
      expectHelpPage("/event/abc", "event", "used_recipes", {
        navigationObject: NavigationObject.usedRecipes,
      });
    });

    test("Einkaufsliste gibt event/shoppinglist zurück", () => {
      expectHelpPage("/event/abc", "event", "shoppinglist", {
        navigationObject: NavigationObject.shoppingList,
      });
    });

    test("Materialliste gibt event/materiallist zurück", () => {
      expectHelpPage("/event/abc", "event", "materiallist", {
        navigationObject: NavigationObject.materialList,
      });
    });

    test("Anlass-Einstellungen gibt event/settings zurück", () => {
      expectHelpPage("/event/abc", "event", "settings", {
        navigationObject: NavigationObject.eventSettings,
      });
    });
  });

  /* ------------------------------------------
  // Stammdaten
  // ------------------------------------------ */
  describe("Stammdaten", () => {
    test("Produkte gibt masterdata/products zurück", () => {
      expectHelpPage("/products", "masterdata", "products");
    });

    test("Materialien gibt masterdata/materials zurück", () => {
      expectHelpPage("/materials", "masterdata", "materials");
    });

    test("Einheiten gibt masterdata/units zurück", () => {
      expectHelpPage("/units", "masterdata", "units");
    });

    test("Einheitenumrechnung gibt masterdata/unitconversion zurück", () => {
      expectHelpPage("/unitconversion", "masterdata", "unitconversion");
    });

    test("Abteilungen gibt masterdata/departments zurück", () => {
      expectHelpPage("/departments", "masterdata", "departments");
    });
  });

  /* ------------------------------------------
  // Anfragen
  // ------------------------------------------ */
  describe("Anfragen", () => {
    test("Anfragenübersicht gibt request/requests zurück", () => {
      expectHelpPage("/requestoverview", "request", "requests");
    });
  });

  /* ------------------------------------------
  // Benutzer
  // ------------------------------------------ */
  describe("Benutzer", () => {
    test("Benutzerprofil gibt user/profile zurück", () => {
      expectHelpPage("/profile", "user", "profile");
    });

    test("Passwort-Änderung gibt user/profile zurück", () => {
      expectHelpPage("/passwordchange", "user", "profile");
    });
  });

  /* ------------------------------------------
  // Admin / System
  // ------------------------------------------ */
  describe("Admin / System", () => {
    test("System-Übersicht (ohne Sub-Pfad) gibt admin/system zurück", () => {
      expectHelpPage("/system", "admin", "system");
    });

    test("Wo verwendet gibt admin/where_used zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_WHERE_USED, "admin", "where_used");
    });

    test("Support-User aktivieren gibt admin/activate_support_user zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_ACTIVATE_SUPPORT_USER, "admin", "activate_support_user");
    });

    test("Postfach-Übersicht gibt admin/mailbox_overview zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_OVERVIEW_MAILBOX, "admin", "mailbox_overview");
    });

    test("Anlass-Übersicht gibt admin/event_overview zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_OVERVIEW_EVENTS, "admin", "event_overview");
    });

    test("Rezept-Übersicht gibt admin/recipe_overview zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_OVERVIEW_RECIPES, "admin", "recipe_overview");
    });

    test("Feed-Übersicht gibt admin/feeds_overview zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_OVERVIEW_FEEDS, "admin", "feeds_overview");
    });

    test("Mail-Konsole gibt admin/mailconsole zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_MAIL_CONSOLE, "admin", "mailconsole");
    });

    test("Elemente zusammenführen gibt admin/merge_items zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_MERGE_ITEM, "admin", "merge_items");
    });

    test("Element konvertieren gibt admin/convert_items zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_CONVERT_ITEM, "admin", "convert_items");
    });

    test("Systemmeldungen gibt admin/system_message zurück", () => {
      expectHelpPage(ROUTES.SYSTEM_SYSTEM_MESSAGES, "admin", "system_message");
    });

    test("Unbekannter System-Subpfad gibt admin/system zurück", () => {
      expectHelpPage("/system/unknown/subpath", "admin", "system");
    });
  });

  /* ------------------------------------------
  // Benutzer-Übersicht (eigene Route)
  // ------------------------------------------ */
  describe("Benutzer-Übersicht", () => {
    test("Benutzer-Übersicht fällt auf admin/system zurück (case ist unerreichbar)", () => {
      // SYSTEM_OVERVIEW_USERS = "/system/overview/users"
      // path[1] = "system" → trifft ROUTES.SYSTEM
      // Im inneren Switch: actualPath matcht keinen Fall → default "system"
      // Der separate case ROUTES.SYSTEM_OVERVIEW_USERS im äusseren Switch
      // ist unerreichbar, da path[1] = "system" immer zuerst ROUTES.SYSTEM matcht.
      expectHelpPage(ROUTES.SYSTEM_OVERVIEW_USERS, "admin", "system");
    });
  });

  /* ------------------------------------------
  // Fallback / Default
  // ------------------------------------------ */
  describe("Fallback", () => {
    test("Unbekannter Pfad gibt nur die Helpcenter-Basis-URL zurück", () => {
      const result = HelpCenter.getMatchingHelpPage({actualPath: "/unknown"});
      expect(result).toBe(HELPCENTER_URL);
    });

    test("Landing-Seite gibt nur die Helpcenter-Basis-URL zurück", () => {
      const result = HelpCenter.getMatchingHelpPage({actualPath: "/"});
      expect(result).toBe(HELPCENTER_URL);
    });
  });
});
