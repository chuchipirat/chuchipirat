/**
 * Stellt umgebungsabhängige Bilder (Landing, Sign-In, PDF-Footer etc.) bereit.
 *
 * Gibt je nach Umgebungsvariable `VITE_ENVIRONMENT` die passenden
 * Firebase-Storage-URLs für DEV, TEST oder PROD zurück.
 */
export class ImageRepository {
  /* =====================================================================
  // Allgemeine Bilder
  // ===================================================================== */
  /**
   * Gibt die Bilder-Konstanten für die aktuelle Umgebung zurück.
   *
   * @returns Objekt mit allen Bild-URLs für die aktuelle Umgebung.
   */
  static getEnvironmentRelatedPicture = () => {
    switch (import.meta.env.VITE_ENVIRONMENT) {
      case "PRD":
        return PRODUCTION;
      case "TST":
        return TEST;
      case "DEV":
        return DEVELOPMENT;
      default:
        return PRODUCTION;
    }
  };
}
/* =====================================================================
// Bild-Konstanten je nach System 
// ===================================================================== */
/** Bild-URLs je nach Umgebung (DEV, TEST, PROD). */
interface PictureRepository {
  LANDING_LOGO: string;
  SIGN_IN_HEADER: string;
  PDF_FOOTER_IMAGE: string;
  CARD_PLACEHOLDER_MEDIA: string;
  VECTOR_LOGO_GREY: string;
  RECEIPT_IMAGE: string;
}

const DEVELOPMENT: PictureRepository = {
  LANDING_LOGO:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2Flanding_logo.svg?alt=media",
  SIGN_IN_HEADER:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2Flogo_16_9.png?alt=media",
  PDF_FOOTER_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2FpdfFooterImage.png?alt=media",
  CARD_PLACEHOLDER_MEDIA:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2Fplaceholder.png?alt=media",
  VECTOR_LOGO_GREY:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2Fdivider_icon.svg?alt=media",
  RECEIPT_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2FQuittung.png?alt=media",
};
const TEST: PictureRepository = {
  LANDING_LOGO:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2Flanding_logo.svg?alt=media",
  SIGN_IN_HEADER:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2Flogo_16_9.png?alt=media",
  PDF_FOOTER_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2FpdfFooterImage.png?alt=media",
  CARD_PLACEHOLDER_MEDIA:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2Fplaceholder.png?alt=media",
  VECTOR_LOGO_GREY:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2Fdivider_icon.svg?alt=media",
  RECEIPT_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2FQuittung.png?alt=media",
};
const PRODUCTION: PictureRepository = {
  LANDING_LOGO:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2Flanding_logo.svg?alt=media",
  SIGN_IN_HEADER:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2Flogo_16_9.png?alt=media",
  PDF_FOOTER_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2FpdfFooterImage.png?alt=media",
  CARD_PLACEHOLDER_MEDIA:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2Fplaceholder.png?alt=media",
  VECTOR_LOGO_GREY:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2Fdivider_icon.svg?alt=media",
  RECEIPT_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2FQuittung.png?alt=media",
};
