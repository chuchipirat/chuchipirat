/**
 * Migrationsjob für Event-Bilder von Firebase Storage nach Supabase Storage.
 *
 * Liest alle Events aus Postgres, die eine `picture_src` aus Firebase Storage haben.
 * Für jedes Event:
 * 1. Bild von Firebase Storage herunterladen
 * 2. In Supabase Storage hochladen (Bucket: media, Pfad: events/{eventId}.jpg)
 * 3. `events.picture_src` in Postgres aktualisieren
 *
 * Voraussetzungen:
 * - Events müssen bereits in Postgres vorhanden sein (EventMigrationJob)
 *
 * @example
 * const job = new EventPictureMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Quelldatenstruktur für Event-Bilder
// ===================================================================== */

/**
 * Quelldatensatz für ein Event mit Firebase-Bild-URL.
 */
interface EventPictureData {
  /** Postgres-ID des Events */
  eventId: string;
  /** Aktuelle Firebase Storage URL des Event-Bilds */
  firebasePictureUrl: string;
}

/* =====================================================================
// EventPictureMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Event-Bilder.
 *
 * Quelldaten kommen aus Postgres (nicht Firebase), da die Events
 * bereits migriert wurden und nur noch die Bild-URLs aktualisiert werden müssen.
 */
export class EventPictureMigrationJob implements MigrationJob<EventPictureData> {
  name = "Event-Bilder (Firebase Storage → Supabase Storage)";
  description =
    "Kopiert Event-Bilder von Firebase Storage nach Supabase Storage " +
    "und aktualisiert die picture_src-Spalte in der events-Tabelle. " +
    "Setzt voraus, dass Events bereits migriert sind.";

  /* =====================================================================
  // Alle Events mit Firebase-Bild-URLs laden
  // ===================================================================== */
  /**
   * Liest alle Events aus Postgres, die noch eine Firebase Storage URL haben.
   * Firebase Storage URLs enthalten typischerweise 'firebasestorage.googleapis.com'.
   *
   * @param firebase - Firebase-Instanz (nicht verwendet — Quelldaten kommen aus Postgres)
   * @param database - DatabaseService-Instanz (nicht direkt verwendet — Admin-Client wird genutzt)
   * @returns Array der Events mit Firebase-Bild-URLs
   */
  async fetchSourceRecords(
    _firebase: Firebase,
    _database?: DatabaseService,
  ): Promise<SourceRecord<EventPictureData>[]> {
    const client = supabaseAdmin!;

    const {data, error} = await client
      .from("events")
      .select("id, name, picture_src")
      .ilike("picture_src", "%firebasestorage.googleapis.com%");

    if (error) throw error;

    return (data ?? [])
      .filter((row) => row.picture_src && row.picture_src !== "")
      .map((row) => ({
        id: row.id as string,
        label: (row.name as string) ?? row.id,
        data: {
          eventId: row.id as string,
          firebasePictureUrl: row.picture_src as string,
        },
      }));
  }

  /* =====================================================================
  // Prüfen ob Bild bereits migriert wurde
  // ===================================================================== */
  /**
   * Prüft ob das Bild des Events bereits nach Supabase migriert wurde.
   * Ein Event gilt als migriert, wenn picture_src keine Firebase-URL mehr enthält.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Bild bereits migriert wurde
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<EventPictureData>,
  ): Promise<boolean> {
    const client = supabaseAdmin!;
    const {data, error} = await client
      .from("events")
      .select("picture_src")
      .eq("id", record.data.eventId)
      .single();

    if (error) return false;
    const pictureUrl = (data as {picture_src: string}).picture_src ?? "";
    // Bild gilt als migriert, wenn keine Firebase URL mehr vorhanden
    return !pictureUrl.includes("firebasestorage.googleapis.com");
  }

  /* =====================================================================
  // Einzelnes Event-Bild migrieren
  // ===================================================================== */
  /**
   * Kopiert ein Event-Bild von Firebase Storage nach Supabase Storage.
   *
   * Schritte:
   * 1. Bild von Firebase Storage URL herunterladen (via fetch)
   * 2. In Supabase Storage hochladen (Bucket: media, Pfad: events/{eventId}.jpg)
   * 3. Öffentliche URL aus Supabase Storage ermitteln
   * 4. `events.picture_src` in Postgres auf neue URL setzen
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<EventPictureData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const client = supabaseAdmin!;
    const {eventId, firebasePictureUrl} = record.data;

    // 1. Bild von Firebase Storage herunterladen
    const response = await fetch(firebasePictureUrl);
    if (!response.ok) {
      throw new Error(
        `EventPictureMigrationJob: Bild konnte nicht heruntergeladen werden: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const fileExtension = contentType.includes("png") ? "png" : "jpg";
    const storagePath = `events/${eventId}/cover.${fileExtension}`;

    // 2. In Supabase Storage hochladen
    const {error: uploadError} = await client.storage
      .from("media")
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 3. Öffentliche URL aus Supabase Storage ermitteln
    const {data: urlData} = client.storage.from("media").getPublicUrl(storagePath);
    const supabasePictureUrl = urlData.publicUrl;

    // 4. events.picture_src in Postgres aktualisieren
    const {error: updateError} = await client
      .from("events")
      .update({picture_src: supabasePictureUrl})
      .eq("id", eventId);

    if (updateError) throw updateError;
  }
}
