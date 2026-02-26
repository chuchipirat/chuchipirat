/**
 * Storage-Repository für Benutzer-Profilbilder.
 *
 * Speichert Profilbilder im `media`-Bucket unter dem Ordner `users/`.
 * Die Bilder werden Client-seitig auf max. 1200px skaliert und als
 * eine einzige Datei hochgeladen. Anzeigegrössen werden via Supabase
 * Image Transformation URL-Parameter gesteuert.
 *
 * @example
 * const repo = new UserStorageRepository();
 * const result = await repo.upload("userId.jpg", blob, "image/jpeg");
 */

import {StorageRepository} from "./StorageRepository";

export class UserStorageRepository extends StorageRepository {
  bucketName = "media";
  folderPath = "users/";
}
