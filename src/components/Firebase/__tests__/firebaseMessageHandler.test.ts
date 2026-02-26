import FirebaseMessageHandler from "../firebaseMessageHandler.class";
import {SUPABASE_MESSAGES, FIREBASE_MESSAGES} from "../../../constants/text";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("FirebaseMessageHandler", () => {
  describe("translateMessage — Firebase-Fehler", () => {
    test("Übersetzt auth/wrong-password ins Deutsche", () => {
      const error = {code: "auth/wrong-password", message: "Wrong password"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(FIREBASE_MESSAGES.WRONG_PASSWORD);
    });

    test("Übersetzt auth/weak-password ins Deutsche", () => {
      const error = {code: "auth/weak-password", message: "Weak password"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(FIREBASE_MESSAGES.WEAK_PASSWORD);
    });

    test("Übersetzt auth/invalid-email ins Deutsche", () => {
      const error = {code: "auth/invalid-email", message: "Invalid email"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(FIREBASE_MESSAGES.INVALID_EMAIL);
    });

    test("Übersetzt auth/too-many-requests ins Deutsche", () => {
      const error = {
        code: "auth/too-many-requests",
        message: "Too many requests",
      };

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(FIREBASE_MESSAGES.TOO_MANY_REQUESTS);
    });

    test("Übersetzt permission-denied ins Deutsche", () => {
      const error = {code: "permission-denied", message: "Permission denied"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(FIREBASE_MESSAGES.PERMISSION_DENIED);
    });
  });

  describe("translateMessage — Supabase-Fehler", () => {
    test("Übersetzt 'New password should be different' ins Deutsche", () => {
      const error = {
        message:
          "New password should be different from the old password.",
      };

      const result = FirebaseMessageHandler.translateMessage(error);

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

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(SUPABASE_MESSAGES["Invalid login credentials"]);
      expect(result).toBe("Ungültige Anmeldedaten.");
    });

    test("Übersetzt 'User already registered' ins Deutsche", () => {
      const error = {message: "User already registered"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(SUPABASE_MESSAGES["User already registered"]);
    });

    test("Übersetzt 'Password should be at least 6 characters' ins Deutsche", () => {
      const error = {
        message: "Password should be at least 6 characters.",
      };

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe(
        SUPABASE_MESSAGES["Password should be at least 6 characters."]
      );
    });
  });

  describe("translateMessage — Unbekannte Fehler", () => {
    test("Gibt die originale Nachricht zurück bei unbekanntem Code", () => {
      const error = {
        code: "auth/unknown-error",
        message: "Something unexpected",
      };

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe("Something unexpected");
    });

    test("Gibt die originale Nachricht zurück bei unbekannter Supabase-Meldung", () => {
      const error = {message: "Some unknown Supabase error"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe("Some unknown Supabase error");
    });

    test("Gibt die originale Nachricht zurück wenn weder Code noch Supabase-Match", () => {
      const error = {code: undefined, message: "Completely unknown"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBe("Completely unknown");
    });
  });

  describe("getTextCode", () => {
    test("Konvertiert Firebase-Code in Textbaustein-Schlüssel", () => {
      expect(FirebaseMessageHandler.getTextCode("auth/wrong-password")).toBe(
        "WRONG_PASSWORD"
      );
    });

    test("Konvertiert Code ohne Slash", () => {
      expect(FirebaseMessageHandler.getTextCode("permission-denied")).toBe(
        "PERMISSION_DENIED"
      );
    });

    test("Konvertiert Code mit mehreren Bindestrichen", () => {
      expect(
        FirebaseMessageHandler.getTextCode(
          "auth/account-exists-with-different-credential"
        )
      ).toBe("ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL");
    });
  });
});
