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

  describe("translateMessage — Unbekannte Fehler", () => {
    test("Gibt die originale Nachricht zurück bei unbekannter Meldung", () => {
      const error = {message: "Some unknown Supabase error"};

      const result = SupabaseMessageHandler.translateMessage(error);

      expect(result).toBe("Some unknown Supabase error");
    });
  });
});
