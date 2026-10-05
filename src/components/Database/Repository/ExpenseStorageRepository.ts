/**
 * Storage-Repository für Ausgaben-Belege.
 *
 * Speichert Belege im `media`-Bucket. Pfad ist
 * `events/{eventId}/expenses/{expenseId}.{ext}` — genau ein Beleg pro
 * Ausgabe, der Dateiname ist die `expenseId` selbst (eindeutig, kein
 * zusätzlicher Unterordner nötig).
 *
 * @example
 * const repo = new ExpenseStorageRepository();
 * const result = await repo.upload(`${eventId}/expenses/${expenseId}.pdf`, file, "application/pdf");
 */
import {StorageRepository} from "./StorageRepository";

export class ExpenseStorageRepository extends StorageRepository {
  bucketName = "media";
  folderPath = "events/";
}
