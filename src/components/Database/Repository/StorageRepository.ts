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
   * @param cacheControl - `Cache-Control: max-age=<Sekunden>` für Browser/CDN.
   *   Supabase setzt ohne diesen Parameter standardmässig `"3600"` (1 Stunde) —
   *   beim Ersetzen einer Datei am **gleichen** Pfad (`upsert`, keine neue URL)
   *   liefert ein Browser/die Supabase-CDN sonst bis zu eine Stunde lang den
   *   alten Inhalt derselben URL aus. `"0"` übergeben, wenn der Pfad nach einem
   *   Ersetzen wiederverwendet werden kann (z.B. Ausgaben-Belege).
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
    contentType?: string,
    cacheControl?: string,
  ): Promise<UploadResult> {
    const fullPath = `${this.folderPath}${filename}`;
    const {error} = await this.client.storage
      .from(this.bucketName)
      .upload(fullPath, data, {
        contentType,
        upsert: true,
        cacheControl,
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
   * Löscht alle Dateien unterhalb eines Ordners rekursiv.
   *
   * Supabase Storage kennt kein atomares "Ordner löschen" — Ordner sind rein
   * virtuell (aus Dateipfaden abgeleitet). `list()` liefert deshalb nur eine
   * Ebene; Unterordner erscheinen als Einträge mit `id: null` und werden hier
   * rekursiv selbst nochmal aufgelistet, bis nur noch echte Dateien übrig sind.
   *
   * @param folderPrefix - Ordnerpfad relativ zu `folderPath` (ohne führenden/folgenden Slash).
   * @throws Error bei Lese- oder Löschfehler.
   *
   * @example
   * await repo.removeFolder("evt-123"); // löscht alles unter events/evt-123/*, rekursiv
   */
  async removeFolder(folderPrefix: string): Promise<void> {
    const filePaths = await this.listFilesRecursively(
      `${this.folderPath}${folderPrefix}`,
    );
    if (filePaths.length === 0) return;

    const {error} = await this.client.storage
      .from(this.bucketName)
      .remove(filePaths);
    if (error) throw error;
  }

  /**
   * Sammelt rekursiv die vollständigen Pfade aller Dateien unter `prefix`.
   *
   * @param prefix - Vollständiger Ordnerpfad im Bucket (inkl. `folderPath`).
   * @returns Pfade aller gefundenen Dateien, Unterordner aufgelöst.
   * @throws Error bei Lesefehler.
   */
  private async listFilesRecursively(prefix: string): Promise<string[]> {
    const {data, error} = await this.client.storage
      .from(this.bucketName)
      .list(prefix);
    if (error) throw error;

    const paths: string[] = [];
    for (const entry of data ?? []) {
      const entryPath = `${prefix}/${entry.name}`;
      if (entry.id === null) {
        paths.push(...(await this.listFilesRecursively(entryPath)));
      } else {
        paths.push(entryPath);
      }
    }
    return paths;
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
    options: {width?: number; height?: number},
  ): string {
    const fullPath = `${this.folderPath}${filename}`;
    const {data} = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(fullPath, {transform: options});

    return data.publicUrl;
  }
}
