import {AuthMessages, General} from "../../constants/firebaseMessages";
import {FIREBASE_MESSAGES as TEXT_FIREBASE_MESSAGES} from "../../constants/text";

/**
 * Übersetzt Fehlermeldungen von Firebase Auth ins Deutsche.
 *
 * Firebase-Fehler werden anhand des `error.code` übersetzt.
 * Gibt `null` zurück, falls der Code nicht erkannt wird.
 */
class FirebaseMessageHandler {
  /**
   * Übersetzt eine Firebase-Fehlermeldung ins Deutsche.
   * Gibt `null` zurück, falls der Code nicht erkannt wird —
   * der Aufrufer kann dann auf einen anderen Handler zurückgreifen.
   *
   * @param error - Fehlerobjekt mit `code` (Firebase Auth error code)
   * @returns Deutsche Fehlermeldung oder `null` bei unbekanntem Code
   * @example
   * FirebaseMessageHandler.translateMessage({code: "auth/wrong-password", message: ""})
   * // "Passwort falsch."
   */
  static translateMessage(error: {code?: string; message: string}): string | null {
    switch (error.code) {
      case AuthMessages.WEAK_PASSWORD:
      case AuthMessages.INVALID_EMAIL:
      case AuthMessages.EMAIL_ALREADY_IN_USE:
      case AuthMessages.USER_DISABLED:
      case AuthMessages.USER_NOT_FOUND:
      case AuthMessages.WRONG_PASSWORD:
      case AuthMessages.ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
      case AuthMessages.INVALID_ACTION_CODE:
      case AuthMessages.REQUIRES_RECENT_LOGIN:
      case AuthMessages.TOO_MANY_REQUESTS:
      case AuthMessages.INTERNAL_ERROR:
      case General.PERMISSION_DENIED:
      case General.UNAVAILABLE:
        return TEXT_FIREBASE_MESSAGES[
          FirebaseMessageHandler.getTextCode(error.code)
        ];
      default:
        return null;
    }
  }
  /* =====================================================================
  // Firebase Code in Code für Textbausteine ändern
  // ===================================================================== */
  static getTextCode(code) {
    // Code in Firebase ist mit "-" und in Kleinbuchstaben
    // die Textbausteine (Konstanten) sind mit "_" und in Grossbuchstaben
    let textCode = code.toUpperCase();
    textCode = textCode.replaceAll("-", "_");
    if (textCode.search("/") > 0) {
      textCode = textCode.split("/")[1];
    }
    return textCode;
  }
}

export default FirebaseMessageHandler;
