import {AuthMessages, General} from "../firebaseMessages";

describe("firebaseMessages", () => {
  describe("AuthMessages", () => {
    it("enthält erwartete Auth-Fehlercodes", () => {
      expect(AuthMessages.WEAK_PASSWORD).toBe("auth/weak-password");
      expect(AuthMessages.INVALID_EMAIL).toBe("auth/invalid-email");
      expect(AuthMessages.EMAIL_ALREADY_IN_USE).toBe(
        "auth/email-already-in-use"
      );
      expect(AuthMessages.USER_NOT_FOUND).toBe("auth/user-not-found");
      expect(AuthMessages.WRONG_PASSWORD).toBe("auth/wrong-password");
    });

    it("enthält Supabase-spezifische Codes", () => {
      expect(AuthMessages.USER_ALREADY_EXISTS).toBe("user_already_exists");
      expect(AuthMessages.INVALID_CREDENTIALS).toBe("invalid_credentials");
      expect(AuthMessages.EMAIL_NOT_CONFIRMED).toBe("email_not_confirmed");
    });
  });

  describe("General", () => {
    it("enthält erwartete Fehlercodes", () => {
      expect(General.PERMISSION_DENIED).toBe("permission-denied");
      expect(General.UNAVAILABLE).toBe("unavailable");
    });
  });
});
