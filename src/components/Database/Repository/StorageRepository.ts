/**
 * Abstrakte Basisklasse für Storage-Operationen auf Supabase Storage.
 *
 * Analog zu {@link BaseRepository} für DB-Tabellen, aber für Datei-Uploads
 * und -Downloads. Jede konkrete Implementierung definiert den Bucket-Namen
 * und den Ordnerpfad (z.B. `media/users/`).
 *
 * @example
 * class UserStorageRepository extends StorageRepository {
 *   bucketName = "media";
 *   folderPath = "users/";
 * }
 */

import {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";

/**
 * Ergebnis eines erfolgreichen Uploads.
 *
 * @property path - Vollständiger Pfad der Datei im Bucket.
 * @property publicUrl - Öffentlich zugängliche URL der Datei.
 */
export interface UploadResult {
  path: string;
  publicUrl: string;
}

export abstract class StorageRepository {
  protected client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? supabase;
  }

  /** Name des Supabase Storage Buckets (z.B. "media"). */
  abstract bucketName: string;

  /** Ordnerpfad innerhalb des Buckets (z.B. "users/"). */
  abstract folderPath: string;

  /**
   * Lädt eine Datei in den Supabase Storage Bucket hoch.
   *
   * Verwendet `upsert: true`, sodass eine bestehende Datei mit gleichem
   * Namen überschrieben wird.
   *
   * @param filename - Dateiname (ohne Ordnerpfad).
   * @param data - Dateiinhalt als Blob oder File.
   * @param contentType - MIME-Type der Datei (z.B. "image/jpeg").
   * @returns Pfad und öffentliche URL der hochgeladenen Datei.
   * @throws Error bei Upload-Fehler.
   *
   * @example
   * const result = await repo.upload("profile.jpg", blob, "image/jpeg");
   * console.log(result.publicUrl);
   */
  async upload(
    filename: string,
    data: Blob | File,
    contentType?: string
  ): Promise<UploadResult> {
    const fullPath = `${this.folderPath}${filename}`;

    const {error} = await this.client.storage
      .from(this.bucketName)
      .upload(fullPath, data, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    const publicUrl = this.getPublicUrl(filename);
    return {path: fullPath, publicUrl};
  }

  /**
   * Löscht eine Datei aus dem Supabase Storage Bucket.
   *
   * @param filename - Dateiname (ohne Ordnerpfad).
   * @throws Error bei Löschfehler.
   *
   * @example
   * await repo.remove("profile.jpg");
   */
  async remove(filename: string): Promise<void> {
    const fullPath = `${this.folderPath}${filename}`;

    const {error} = await this.client.storage
      .from(this.bucketName)
      .remove([fullPath]);

    if (error) throw error;
  }

  /**
   * Gibt die öffentliche URL einer Datei zurück.
   *
   * @param filename - Dateiname (ohne Ordnerpfad).
   * @returns Öffentlich zugängliche URL der Datei.
   *
   * @example
   * const url = repo.getPublicUrl("profile.jpg");
   */
  getPublicUrl(filename: string): string {
    const fullPath = `${this.folderPath}${filename}`;
    const {data} = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(fullPath);

    return data.publicUrl;
  }

  /**
   * Gibt eine transformierte (redimensionierte) URL einer Datei zurück.
   *
   * Nutzt Supabase Image Transformation, um das Bild serverseitig
   * in der gewünschten Grösse auszuliefern.
   *
   * @param filename - Dateiname (ohne Ordnerpfad).
   * @param options - Transformationsoptionen (Breite, Höhe).
   * @returns URL mit Transformationsparametern.
   *
   * @example
   * const url = repo.getTransformedUrl("profile.jpg", { width: 50, height: 50 });
   */
  getTransformedUrl(
    filename: string,
    options: {width?: number; height?: number}
  ): string {
    const fullPath = `${this.folderPath}${filename}`;
    const {data} = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(fullPath, {transform: options});

    return data.publicUrl;
  }
}
