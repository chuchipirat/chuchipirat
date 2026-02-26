import {AuthMessages, General} from "../../constants/firebaseMessages";
import {
  FIREBASE_MESSAGES as TEXT_FIREBASE_MESSAGES,
  SUPABASE_MESSAGES as TEXT_SUPABASE_MESSAGES,
} from "../../constants/text";

/**
 * Übersetzt Fehlermeldungen von Firebase und Supabase Auth ins Deutsche.
 *
 * Firebase-Fehler werden anhand des `error.code` übersetzt,
 * Supabase-Fehler anhand des `error.message` (da Supabase keine
 * einheitlichen Fehlercodes verwendet).
 */
class FirebaseMessageHandler {
  /**
   * Übersetzt eine Fehlermeldung ins Deutsche.
   * Prüft zuerst den Firebase-Code, dann die Supabase-Nachricht.
   * Gibt die originale Meldung zurück, falls keine Übersetzung existiert.
   *
   * @param error - Fehlerobjekt mit `code` (Firebase) oder `message` (Supabase)
   * @returns Deutsche Fehlermeldung
   */
  static translateMessage(error: {code?: string; message: string}): string {
    // Firebase-Fehler anhand des error.code
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
        // Supabase-Fehler anhand der englischen Nachricht
        return TEXT_SUPABASE_MESSAGES[error.message] ?? error.message;
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
