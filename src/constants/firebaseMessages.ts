/**
 * Auth-Fehlercodes von Firebase/Supabase für die Fehlerbehandlung.
 */
export enum AuthMessages {
  WEAK_PASSWORD = "auth/weak-password",
  INVALID_EMAIL = "auth/invalid-email",
  EMAIL_ALREADY_IN_USE = "auth/email-already-in-use",
  USER_DISABLED = "auth/user-disabled",
  USER_NOT_FOUND = "auth/user-not-found",
  WRONG_PASSWORD = "auth/wrong-password",
  INTERNAL_ERROR = "auth/internal-error",
  EXPIRED_ACTION_CODE = "auth/expired-action-code",
  INVALID_ACTION_CODE = "auth/invalid-action-code",
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL = "auth/account-exists-with-different-credential",
  REQUIRES_RECENT_LOGIN = "auth/requires-recent-login",
  TOO_MANY_REQUESTS = "auth/too-many-requests",
  // Supabase Auth Codes
  USER_ALREADY_EXISTS = "user_already_exists",
  INVALID_CREDENTIALS = "invalid_credentials",
  EMAIL_NOT_CONFIRMED = "email_not_confirmed",
}

/**
 * Allgemeine Firebase/Supabase-Fehlercodes.
 */
export enum General {
  PERMISSION_DENIED = "permission-denied",
  UNAVAILABLE = "unavailable",
}
