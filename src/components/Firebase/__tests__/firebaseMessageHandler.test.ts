import FirebaseMessageHandler from "../firebaseMessageHandler.class";
import {FIREBASE_MESSAGES} from "../../../constants/text";

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

  describe("translateMessage — Unbekannte Fehler", () => {
    test("Gibt null zurück bei unbekanntem Code", () => {
      const error = {
        code: "auth/unknown-error",
        message: "Something unexpected",
      };

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBeNull();
    });

    test("Gibt null zurück wenn kein Code vorhanden", () => {
      const error = {message: "Some error without code"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBeNull();
    });

    test("Gibt null zurück bei undefined Code", () => {
      const error = {code: undefined, message: "Completely unknown"};

      const result = FirebaseMessageHandler.translateMessage(error);

      expect(result).toBeNull();
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
