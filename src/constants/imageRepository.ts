/**
 * Stellt statische App-Bilder (Landing/Fehlerseiten-Logo, Sign-In-Header,
 * Platzhalter etc.) bereit.
 *
 * Diese Bilder sind Teil des Vite-Builds (`public/images/...`) und daher
 * umgebungsunabhängig — dieselbe Datei wird in DEV, TEST und PROD
 * ausgeliefert. `getEnvironmentRelatedPicture()` bleibt als Methodenname
 * aus Kompatibilitätsgründen erhalten (siehe tech-debt.md).
 */
export class ImageRepository {
  /* =====================================================================
  // Allgemeine Bilder
  // ===================================================================== */
  /**
   * Gibt die Bilder-Konstanten zurück.
   *
   * @returns Objekt mit allen Bild-Pfaden.
   */
  static getEnvironmentRelatedPicture = () => PICTURES;
}
/* =====================================================================
// Bild-Konstanten
// ===================================================================== */
/** Statische Bild-Pfade (aus `public/images/...`). */
interface PictureRepository {
  LANDING_LOGO: string;
  SIGN_IN_HEADER: string;
  CARD_PLACEHOLDER_MEDIA: string;
  VECTOR_LOGO_GREY: string;
  RECEIPT_IMAGE: string;
}

const PICTURES: PictureRepository = {
  LANDING_LOGO: "/images/logo/logo_gray.svg",
  SIGN_IN_HEADER: "/images/auth/sign-in-header.png",
  CARD_PLACEHOLDER_MEDIA: "/images/placeholders/card-placeholder.png",
  VECTOR_LOGO_GREY: "/images/logo/logo_vector_grey.svg",
  RECEIPT_IMAGE: "/images/pdf/receipt-image.png",
};
