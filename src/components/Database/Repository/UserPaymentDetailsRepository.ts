/**
 * UserPaymentDetailsRepository — Repository für die Zahlungsangaben
 * (Adresse + IBAN) einer Person.
 *
 * Greift auf die Tabelle `user_payment_details` zu (1:1 zum Konto, PK
 * `user_id`). RLS lässt nur die Person selbst lesen und schreiben — auch
 * Admins nicht. Validierung und Normalisierung macht der Aufrufer über
 * `UserPaymentDetails` (siehe `userPaymentDetails.class.ts`).
 *
 * @example
 * const details = await repo.getPaymentDetails(authUser.uid);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  UserPaymentDetailsDomain,
  UserPaymentDetailsRow,
} from "../../User/userPaymentDetails.types";
import {
  StorageObjectProperty,
  STORAGE_OBJECT_PROPERTY,
} from "../../Shared/sessionStorageHandler.class";

import {AuthUser} from "../../Session/authUser.class";

/* =====================================================================
// UserPaymentDetailsRepository
// ===================================================================== */

/**
 * Repository für die Zahlungsangaben einer Person.
 *
 * Bewusst "dumm": kennt weder Validierung noch Normalisierung. Die
 * CHECK-Constraints der Tabelle sind das Sicherheitsnetz, falls ein
 * Aufrufer die Normalisierung vergisst — sie lehnen ab, statt Datenmüll
 * zu speichern.
 */
export class UserPaymentDetailsRepository extends BaseRepository<
  UserPaymentDetailsDomain,
  UserPaymentDetailsRow
> {
  tableName = "user_payment_details";

  /**
   * @param client - Optionaler Supabase-Client (für Tests); Standard ist der globale Client.
   */
  constructor(client?: SupabaseClient) {
    super(client);
  }

  /** PK ist `user_id` (1:1 zum Konto), nicht `id`. */
  protected get primaryKeyColumn(): string {
    return "user_id";
  }

  /**
   * Zahlungsangaben werden nicht gecacht: Bankdaten gehören nicht in den
   * `sessionStorage`, der für jedes Script auf der Seite lesbar ist.
   *
   * @returns Cache-Konfiguration mit `excludeFromCaching`.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.USER_PAYMENT_DETAILS;
  }
  /* =====================================================================
  // Domain ← → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UserPaymentDetailsDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: UserPaymentDetailsDomain): Partial<UserPaymentDetailsRow> {
    return {
      // user_id: OHNE user_id — upsert setzt den PK selbst aus `id`, insert nutzt den DB-Default auth.uid()
      street: domain.street,
      postal_code: domain.postalCode,
      city: domain.city,
      iban: domain.iban,
    };
  }
  /**
   * Konvertiert eine Postgres-Zeile in ein UserPaymentDetailsDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: UserPaymentDetailsRow): UserPaymentDetailsDomain {
    return {
      userId: row.user_id,
      street: row.street,
      postalCode: row.postal_code,
      city: row.city,
      iban: row.iban,
    };
  }
  /* =====================================================================
  // Leseoperationen 
  // ===================================================================== */
  /**
   * Lädt die Zahlungsangaben einer Person.
   *
   * @param userId - ID der Person (`authUser.uid`); RLS liefert ohnehin nur die eigenen.
   * @returns Die Zahlungsangaben oder `null`, falls keine hinterlegt sind.
   * @example
   * const details = await repo.getPaymentDetails(authUser.uid); // null = noch nichts gespeichert
   */
  async getPaymentDetails(
    userId: string,
  ): Promise<UserPaymentDetailsDomain | null> {
    return this.findById(userId);
  }
  /* =====================================================================
  // Schreiboperationen 
  // ===================================================================== */
  /**
   * Speichert die Zahlungsangaben der angemeldeten Person (anlegen oder
   * überschreiben). Die ID stammt bewusst aus `authUser.uid`, nicht aus
   * `details.userId` — so lässt sich "für jemand anderen speichern" gar
   * nicht erst ausdrücken.
   *
   * @param details - Bereits geprüfte und normalisierte Zahlungsangaben.
   * @param authUser - Die angemeldete Person.
   * @returns Die gespeicherten Zahlungsangaben.
   * @throws Supabase-Fehler, z.B. bei verletztem CHECK (nicht normalisierte IBAN).
   * @example
   * UserPaymentDetails.checkPaymentDetailsData(input);
   * await repo.savePaymentDetails(UserPaymentDetails.normalize(input), authUser);
   */
  async savePaymentDetails(
    details: UserPaymentDetailsDomain,
    authUser: AuthUser,
  ): Promise<UserPaymentDetailsDomain> {
    return this.upsert({id: authUser.uid, value: details, authUser});
  }

  /**
   * Löscht die Zahlungsangaben einer Person (= Widerruf der Einwilligung).
   *
   * @param userId - ID der Person (`authUser.uid`).
   * @example
   * await repo.deletePaymentDetails(authUser.uid);
   */
  async deletePaymentDetails(userId: string): Promise<void> {
    return this.remove(userId);
  }
}
