/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Zahlungsangaben einer Person für Rückerstattungen (camelCase).
 *
 * Kontoinhaber:in ist die Person selbst (Name aus dem Profil), deshalb
 * gibt es kein eigenes Namensfeld.
 *
 * @property userId - ID der Person (= `auth.users.id`, PK der Tabelle).
 * @property street - Strasse inkl. Hausnummer.
 * @property postalCode - Postleitzahl (Text, damit ausländische Formate und führende Nullen gehen).
 * @property city - Ort.
 * @property iban - IBAN, gespeichert normalisiert (Grossbuchstaben, ohne Leerzeichen).
 */
export type UserPaymentDetailsDomain = {
  userId: string;
  street: string;
  postalCode: string;
  city: string;
  iban: string;
};
/* =====================================================================
// DB-Zeilentyp (snake_case, entspricht Postgres-Spalten)
// ===================================================================== */

/**
 * DB-Zeile der Tabelle `user_payment_details` (snake_case).
 *
 * Die Zeitstempel gibt es nur hier, nicht im Domain-Typ — die UI braucht sie
 * (noch) nicht.
 *
 * @property user_id - PK, FK auf `auth.users` (`ON DELETE CASCADE`).
 * @property street - Strasse inkl. Hausnummer.
 * @property postal_code - Postleitzahl.
 * @property city - Ort.
 * @property iban - Normalisierte IBAN.
 * @property created_at - Zeitstempel der Erstellung.
 * @property updated_at - Zeitstempel der letzten Änderung.
 */
export type UserPaymentDetailsRow = {
  user_id: string;
  street: string;
  postal_code: string;
  city: string;
  iban: string;
  created_at: string;
  updated_at: string;
};
