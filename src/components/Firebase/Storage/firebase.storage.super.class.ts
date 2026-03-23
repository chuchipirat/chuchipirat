import Firebase from "../firebase.class";
import {Utils} from "../../Shared/utils.class";
import {ERROR_PARAMETER_NOT_PASSED} from "../../../constants/text";
import {FirebaseAnalyticEvent} from "../../../constants/firebaseEvent";
import {
  ref,
  deleteObject,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import {logEvent} from "firebase/analytics";

interface UploadFile {
  file: File;
  filename: string;
}
interface GetPictureVariants {
  uid: string;
  sizes: ImageSize[];
  // oldDownloadUrl: string;
}

export enum ImageSize {
  size_50 = 50,
  size_200 = 200,
  size_300 = 300,
  size_500 = 500,
  size_600 = 600,
  size_1000 = 1000,
}

// Suffix von redimensionierten Files
export const IMAGES_SUFFIX: {[key: string]: ImageSuffix} = {
  size50: {size: ImageSize.size_50, suffix: "_50x50.jpeg"},
  size200: {size: ImageSize.size_200, suffix: "_200x200.jpeg"},
  size300: {size: ImageSize.size_300, suffix: "_300x300.jpeg"},
  size500: {size: ImageSize.size_500, suffix: "_500x500.jpeg"},
  size600: {size: ImageSize.size_600, suffix: "_600x600.jpeg"},
  size1000: {size: ImageSize.size_1000, suffix: "_1000x1000.jpeg"},
};

interface ImageSuffix {
  size: ImageSize;
  suffix: string;
}

export abstract class FirebaseStorageSuper {
  abstract firebase: Firebase;
  // ===================================================================== */
  /**
   * getFolder: Verzeichnis holen
   */
  // ===================================================================== */
  abstract getFolder(): string;
  // ===================================================================== */
  /**
   * getFile: Bestimmtes File holen
   * @param filename - Name des Files
   */
  // ===================================================================== */
  /**
   * Datei hochladen
   */
  uploadFile({file, filename}: UploadFile): Promise<void> {
    const suffix = Utils.getFileSuffix(file.name);
    filename = `${filename}.${suffix}`;

    const folder = this.getFolder();
    const filePath = `${folder}${filename}`;

    // Es werden nur Bilder hochgeladen
    const metadata = {
      contentType: "image/jpeg",
    };

    logEvent(this.firebase.analytics, FirebaseAnalyticEvent.uploadPicture, {
      folder: folder,
    });

    return new Promise((resolve, reject) => {
      try {
        const storageRef = ref(this.firebase.storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file, metadata);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            console.info(
              "File wird hochgeladen:",
              snapshot.totalBytes,
              "Bytes"
            );
          },
          (error) => {
            console.error("Upload-Fehler:", error);
            reject(error);
          },
          () => {
            console.info(`Datei ${filename} erfolgreich hochgeladen.`);
            resolve(); // Upload abgeschlossen
          }
        );
      } catch (error) {
        console.error("Fehler beim Hochladen:", error);
        reject(error);
      }
    });
  }

  // ===================================================================== */
  /**
   * Geänderte Bild-Varianten holen
   * Nachdem das Bild hochgeladen wurde, setzt eine Cloudfunction ein, und
   * redimensioniert die Bilder (je nach Speicherort, in diversen Grössen).
   * Diese Methode holt die neu erstellen Varianten als Download-URL
   * @param objekt GetPictureVariants
   */
  async getPictureVariants({
    uid,
    sizes = [],
  }: // oldDownloadUrl,
  GetPictureVariants) {
    if (sizes.length === 0) {
      throw new Error(ERROR_PARAMETER_NOT_PASSED);
    }

    const folder = this.getFolder();
    const fileVariants: {size: number; downloadURL: string}[] = [];
    let counter = 0;
    let fileFound = false;

    const checkFile = `${folder}${uid}${this.getImageFileSuffix(sizes[0])}`;

    // Warten, bis das erste Bild vorhanden ist
    do {
      try {
        const downloadURL = await getDownloadURL(
          ref(this.firebase.storage, checkFile)
        );
        if (downloadURL.match("_d+xd+.jpeg")) {
          fileFound = true;
        } else {
          await this.delay(1);
          counter++;
        }
      } catch {
        await this.delay(1);
        counter++;
      }
    } while (!fileFound && counter <= 10);

    // Alle URLs für die geforderten Größen holen
    const docRefs = sizes.map((size) =>
      getDownloadURL(
        ref(
          this.firebase.storage,
          `${folder}${uid}${this.getImageFileSuffix(size)}`
        )
      )
    );

    const downloadUrls = await Promise.allSettled(docRefs);

    downloadUrls.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const downloadURL = result.value;
        const sizeType = Object.values(IMAGES_SUFFIX).find((sizeType) =>
          downloadURL.includes(sizeType.suffix)
        );
        if (sizeType) {
          fileVariants.push({size: sizeType.size, downloadURL});
        }
      } else {
        console.error(
          `Failed to fetch URL for size ${sizes[index]}:`,
          result.reason
        );
      }
    });

    return fileVariants;
  }
  // ===================================================================== */
  /**
   * deleteFile: Datei löschen
   * Die Datei im entpsrechnden Verzeichnis wird gelöscht
   * @param filename: Dateiname (mit Suffix) - ohne Pfad. Das Verzeichnis
   *        wird anhand der Klasse ermittelt
   */
  async deleteFile(filename: string) {
    try {
      const fileRef = ref(
        this.firebase.storage,
        `${this.getFolder()}${filename}`
      );
      await deleteObject(fileRef);

      // Loggen des Events
      logEvent(this.firebase.analytics, FirebaseAnalyticEvent.deletePicture, {
        folder: this.getFolder(),
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }
  // ===================================================================== */
  /**
   * Suffix der angegebenen Dateigrösse holen:
   * die geänderten Bilder werden mit einem speziellen Suffix hinterlegt
   * Diese Methode, für die geforderte Grösse, den zugehörigen Suffix.
   * Bsp: Input 300 -> Output:"_300x300.jpeg"
   * @param size: geforderte Grösse
   */
  getImageFileSuffix(size: number): string {
    const suffix = Object.values(IMAGES_SUFFIX).find(
      (sizeType) => sizeType.size === size
    )?.suffix;

    if (!suffix) {
      throw "Kein passendes File-Suffix gefunden!";
    }
    return suffix;
  }
  // ===================================================================== */
  /**
   * Warte-Method
   * Bei Aufruf der Methode, wird X Sekunde gewartet, bevor die Methode
   * abgeschlossen wird
   * @param seconds - Anzahl zu wartende Sekunden
   */
  delay = (seconds: number) => {
    return new Promise(function (resolve) {
      setTimeout(resolve, seconds * 1000);
    });
  };
}

export default FirebaseStorageSuper;
