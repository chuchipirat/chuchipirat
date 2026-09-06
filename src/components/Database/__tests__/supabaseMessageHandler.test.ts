import SupabaseMessageHandler from "../supabaseMessageHandler.class";
import {SUPABASE_MESSAGES} from "../../../constants/text";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("SupabaseMessageHandler", () => {
  describe("translateMessage — Bekannte Supabase-Fehler", () => {
    test("Übersetzt 'New password should be different' ins Deutsche", () => {
      const error = {
        message:
          "New password should be different from the old password.",
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        SUPABASE_MESSAGES[
          "New password should be different from the old password."
        ]
      );
      expect(result).toBe(
        "Das neue Passwort muss sich vom alten Passwort unterscheiden."
      );
    });

    test("Übersetzt 'Invalid login credentials' ins Deutsche", () => {
      const error = {message: "Invalid login credentials"};

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(SUPABASE_MESSAGES["Invalid login credentials"]);
      expect(result).toBe("Ungültige Anmeldedaten.");
    });

    test("Übersetzt 'User already registered' ins Deutsche", () => {
      const error = {message: "User already registered"};

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(SUPABASE_MESSAGES["User already registered"]);
    });

    test("Übersetzt 'Password should be at least 6 characters' ins Deutsche", () => {
      const error = {
        message: "Password should be at least 6 characters.",
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        SUPABASE_MESSAGES["Password should be at least 6 characters."]
      );
    });

    test("Übersetzt Rate-Limit-Meldung mit 10 Sekunden ins Deutsche", () => {
      const error = {
        message:
          "For security purposes, you can only request this after 10 seconds.",
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Aus Sicherheitsgründen kannst du dies erst nach 10 Sekunden erneut anfordern."
      );
    });

    test("Übersetzt Rate-Limit-Meldung mit variabler Sekundenanzahl", () => {
      const error = {
        message:
          "For security purposes, you can only request this after 27 seconds.",
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Aus Sicherheitsgründen kannst du dies erst nach 27 Sekunden erneut anfordern."
      );
    });
  });

  describe("translateMessage — Postgres-Fehler (numerische Überläufe)", () => {
    test("Übersetzt 'value ... is out of range for type integer' ins Deutsche", () => {
      const error = {
        message: 'value "99999999999" is out of range for type integer',
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Die eingegebene Zahl ist zu gross oder zu klein für dieses Feld. Bitte gib einen anderen Wert ein.",
      );
    });

    test("Übersetzt die Meldung auch für negative Werte und andere Integer-Typen", () => {
      const error = {
        message: 'value "-999999999999" is out of range for type bigint',
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Die eingegebene Zahl ist zu gross oder zu klein für dieses Feld. Bitte gib einen anderen Wert ein.",
      );
    });

    test("Übersetzt 'numeric field overflow' ins Deutsche", () => {
      const error = {message: "numeric field overflow"};

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Die eingegebene Zahl ist zu gross für dieses Feld. Bitte gib einen kleineren Wert ein.",
      );
    });

    // Regression CHUCHIPIRAT-GW: Löschen eines Produkts/Materials/Rezepts,
    // das noch in einem Menüplan verwendet wird (ON DELETE RESTRICT).
    test("Übersetzt eine FK-Verletzung beim Löschen (Produkt in Menüplan verwendet)", () => {
      const error = {
        message:
          'update or delete on table "products" violates foreign key constraint "event_menue_products_product_id_fkey" on table "event_menue_products"',
      };

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        "Dieses Element kann nicht gelöscht werden, da es noch in einem Menüplan verwendet wird.",
      );
    });

    test("Übersetzt eine FK-Verletzung auch für Materialien und Rezepte", () => {
      expect(
        SupabaseMessageHandler.translateMessage({
          message:
            'update or delete on table "materials" violates foreign key constraint "event_menue_materials_material_id_fkey" on table "event_menue_materials"',
        }),
      ).toBe(
        "Dieses Element kann nicht gelöscht werden, da es noch in einem Menüplan verwendet wird.",
      );

      expect(
        SupabaseMessageHandler.translateMessage({
          message:
            'update or delete on table "recipes" violates foreign key constraint "event_menue_recipes_recipe_id_fkey" on table "event_menue_recipes"',
        }),
      ).toBe(
        "Dieses Element kann nicht gelöscht werden, da es noch in einem Menüplan verwendet wird.",
      );
    });
  });

  describe("translateMessage — Unbekannte Fehler", () => {
    test("Gibt die originale Nachricht zurück bei unbekannter Meldung", () => {
      const error = {message: "Some unknown Supabase error"};

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe("Some unknown Supabase error");
    });
  });
});
