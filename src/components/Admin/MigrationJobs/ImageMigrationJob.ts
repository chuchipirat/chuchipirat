/**
 * Migrationsjob für Profilbilder von Firebase Storage nach Supabase Storage.
 *
 * Liest die Bild-URLs direkt aus den Firestore Public-Profile-Dokumenten
 * (`users/{uid}/public/profile → pictureSrc`). Diese URLs enthalten
 * eingebettete Access-Tokens und funktionieren ohne Firebase Auth.
 *
 * Im Gegensatz zum UserMigrationJob, der nur `normalSize` übernahm, wählt
 * dieser Job die **grösste verfügbare Variante** (`fullSize` → `normalSize`
 * → `smallSize`). Das Bild wird heruntergeladen, Client-seitig skaliert
 * und in den Supabase Storage Bucket hochgeladen.
 */

import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {resizeImage} from "../../Shared/imageResize";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/**
 * Altes Firebase-Picture-Objekt (Firestore-Format).
 *
 * @param smallSize - URL der kleinen Variante (z.B. 50x50 oder 200x200)
 * @param normalSize - URL der mittleren Variante (z.B. 600x600)
 * @param fullSize - URL der grossen Variante (z.B. 1000x1000)
 */
interface FirebasePicture {
  smallSize?: string;
  normalSize?: string;
  fullSize?: string;
}

/**
 * Quelldaten für die Bild-Migration.
 *
 * @param userId - UID des Benutzers
 * @param firebaseUrl - Download-URL mit eingebettetem Access-Token
 */
interface ImageSourceData {
  userId: string;
  firebaseUrl: string;
}

/**
 * Migriert Profilbilder von Firebase Storage nach Supabase Storage.
 *
 * Für jeden Benutzer mit einem Bild in Firestore:
 * 1. `pictureSrc` aus dem Firestore Public Profile lesen
 * 2. Grösste verfügbare Variante wählen (fullSize → normalSize → smallSize)
 * 3. Bild via `fetch()` herunterladen (Token in der URL eingebettet)
 * 4. Client-seitig auf max. 1200px skalieren
 * 5. In Supabase Storage hochladen (via Admin-Client)
 * 6. `picture_src` in der DB mit der neuen Supabase-URL aktualisieren
 *
 * @example
 * const job = new ImageMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
export class ImageMigrationJob implements MigrationJob<ImageSourceData> {
  name = "Profilbilder";
  description =
    "Migriert Profilbilder von Firebase Storage nach Supabase Storage.";

  /* =====================================================================
  // Alle User mit Bildern ermitteln
  // ===================================================================== */
  /**
   * Lädt alle Postgres-User und liest für jeden das Firestore Public Profile,
   * um die Bild-URL mit eingebettetem Access-Token zu erhalten.
   *
   * Wählt die grösste verfügbare Variante: `fullSize` → `normalSize` →
   * `smallSize`. Benutzer ohne Bild oder ohne Public Profile werden
   * übersprungen.
   *
   * @param firebase - Firebase-Instanz (für Firestore-Zugriff)
   * @param database - DatabaseService-Instanz (für Postgres-Zugriff)
   * @returns Array der zu migrierenden Bild-Datensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService
  ): Promise<SourceRecord<ImageSourceData>[]> {
    if (!database) {
      throw new Error("DatabaseService wird für die Bild-Migration benötigt.");
    }

    const users = database.admin?.users ?? database.users;
    const allUsers = await users.findMany({});

    const records: SourceRecord<ImageSourceData>[] = [];

    for (const user of allUsers) {
      // Firestore Public Profile lesen, um die Bild-URL zu erhalten.
      // Firestore-Dokumente liegen unter users/{firebaseUid}/public/profile,
      // daher wird die legacy_firebase_uid für den Firestore-Zugriff benötigt.
      const firestoreUid = user.legacyFirebaseUid ?? user.uid;
      let pictureUrl = "";
      try {
        const profile = await firebase.user.public.profile.read<{
          pictureSrc: FirebasePicture | string;
        }>({uids: [firestoreUid]});

        pictureUrl = this.extractBestPictureUrl(profile.pictureSrc);
      } catch {
        // Kein Public Profile in Firestore vorhanden
      }

      // Fallback: URL aus Postgres (falls Firestore-Read fehlschlägt
      // aber in Postgres eine Firebase-URL vorhanden ist)
      if (!pictureUrl && user.pictureSrc?.includes("firebasestorage.googleapis.com")) {
        pictureUrl = user.pictureSrc;
      }

      if (pictureUrl) {
        records.push({
          // id = Supabase UUID (für checkExists und migrateRecord)
          id: user.uid,
          label: user.displayName || user.uid,
          data: {
            userId: user.uid,
            firebaseUrl: pictureUrl,
          },
        });
      }
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob das Bild bereits migriert wurde
  // ===================================================================== */
  /**
   * Prüft, ob das Bild bereits migriert wurde.
   *
   * Ein Bild gilt als migriert, wenn `picture_src` eine nicht-leere URL enthält,
   * die keine Firebase-Storage-URL ist (d.h. bereits eine Supabase-URL).
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Bild bereits migriert wurde
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<ImageSourceData>
  ): Promise<boolean> {
    const users = database.admin?.users ?? database.users;
    const user = await users.findById(record.id, true);
    if (!user) return true; // User existiert nicht in Postgres

    // Bereits migriert = nicht-leere URL, die KEINE Firebase-URL ist
    return (
      !!user.pictureSrc &&
      !user.pictureSrc.includes("firebasestorage.googleapis.com")
    );
  }

  /* =====================================================================
  // Einzelnes Bild migrieren
  // ===================================================================== */
  /**
   * Lädt das Profilbild von der Firebase-URL herunter (Token eingebettet),
   * skaliert es und lädt es in Supabase Storage hoch. Aktualisiert die DB-URL.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<ImageSourceData>,
    authUser: AuthUser
  ): Promise<void> {
    const {userId, firebaseUrl} = record.data;

    // Bild herunterladen (URL enthält eingebetteten Access-Token)
    const response = await fetch(firebaseUrl);
    if (!response.ok) {
      throw new Error(
        `Bild konnte nicht heruntergeladen werden: ${response.status} ${response.statusText}`
      );
    }

    const originalBlob = await response.blob();

    // Client-seitiges Resize auf max. 1200px
    const file = new File([originalBlob], `${userId}.jpg`, {
      type: originalBlob.type || "image/jpeg",
    });
    const resizedBlob = await resizeImage(file);

    // Admin-Storage verwenden (umgeht RLS)
    const storage = database.admin?.storage.users ?? database.storage.users;
    const result = await storage.upload(
      `${userId}.jpg`,
      resizedBlob,
      "image/jpeg"
    );

    // DB-URL aktualisieren
    const users = database.admin?.users ?? database.users;
    await users.patch({
      id: userId,
      fields: {picture_src: result.publicUrl},
      authUser: authUser,
    });
  }

  /* =====================================================================
  // Beste Bild-URL aus dem Firestore-Feld extrahieren
  // ===================================================================== */
  /**
   * Extrahiert die grösste verfügbare Bild-URL aus dem Firestore `pictureSrc`-Feld.
   *
   * In Firestore kann `pictureSrc` entweder ein String (direkte URL) oder ein
   * Picture-Objekt mit `smallSize`, `normalSize` und `fullSize` sein.
   * Wählt die grösste verfügbare Variante.
   *
   * @param value - pictureSrc-Wert aus Firestore
   * @returns Beste verfügbare Bild-URL, oder leerer String
   */
  private extractBestPictureUrl(
    value: FirebasePicture | string | undefined | null
  ): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    // Grösste Variante bevorzugen
    return value.fullSize || value.normalSize || value.smallSize || "";
  }
}
