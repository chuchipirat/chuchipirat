/**
 * Storage-Repository für Event-Bilder.
 *
 * Speichert Event-Bilder im `media`-Bucket unter dem Ordner `events/`.
 * Dateiname ist `{eventId}.jpg`.
 *
 * @example
 * const repo = new EventStorageRepository();
 * const result = await repo.upload("event-uuid.jpg", blob, "image/jpeg");
 */

import {StorageRepository} from "./StorageRepository";

export class EventStorageRepository extends StorageRepository {
  bucketName = "media";
  folderPath = "events/";
}
