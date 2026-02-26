export class ImageRepository {
  /* =====================================================================
  // Allgemeine Bilder
  // ===================================================================== */
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
  /* =====================================================================
  // Bilder für Landing-Page
  // ===================================================================== */
  static getLandingPageEnvironmentRelatedPicture = () => {
    switch (import.meta.env.VITE_ENVIRONMENT) {
      case "PRD":
        return LANDING_PAGE_PICTURES_PRODUCTION;
      case "TST":
        return LANDING_PAGE_PICTURES_TEST;
      case "DEV":
        return LANDING_PAGE_PICTURES_DEVELOPMENT;
      default:
        return LANDING_PAGE_PICTURES_PRODUCTION;
    }
  };
}
/* =====================================================================
// Bild-Konstanten je nach System 
// ===================================================================== */
interface PictureRepository {
  LANDING_LOGO: string;
  SIGN_IN_HEADER: string;
  PDF_FOOTER_IMAGE: string;
  CARD_PLACEHOLDER_MEDIA: string;
  VECTOR_LOGO_GREY: string;
  TWINT_QR_CODE: string;
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
  TWINT_QR_CODE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/defaults%2Ftwint-qr-code.svg?alt=media",
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
  TWINT_QR_CODE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/defaults%2Ftwint-qr-code.svg?alt=media",
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
  TWINT_QR_CODE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2Ftwint-qr-code.svg?alt=media",
  RECEIPT_IMAGE:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/defaults%2FQuittung.png?alt=media",
};
/* =====================================================================
// Bilder für die Landingpage
// ===================================================================== */
interface LandingPagePictureRepository {
  recipes: string;
  menuplan: string;
  scaling: string;
  shoppinglist: string;
  groupconfig: string;
}
const LANDING_PAGE_PICTURES_PRODUCTION: LandingPagePictureRepository = {
  recipes:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/landing%2Frecipes.png?alt=media",
  menuplan:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/landing%2Fmenuplan.png?alt=media",
  scaling:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/landing%2Fscaling.png?alt=media",
  shoppinglist:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/landing%2Fshoppinglist.png?alt=media",
  groupconfig:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/landing%2Fshoppinglist.png?alt=media",
};
const LANDING_PAGE_PICTURES_TEST: LandingPagePictureRepository = {
  recipes:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/landing%2Frecipes.png?alt=media",
  menuplan:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/landing%2Fmenuplan.png?alt=media",
  scaling:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/landing%2Fscaling.png?alt=media",
  shoppinglist:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/landing%2Fshoppinglist.png?alt=media",
  groupconfig:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-tst.appspot.com/o/landing%2Fgroupconfig.png?alt=media",
};
const LANDING_PAGE_PICTURES_DEVELOPMENT: LandingPagePictureRepository = {
  recipes:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/landing%2Frecipes.png?alt=media",
  menuplan:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/landing%2Fmenuplan.png?alt=media",
  scaling:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/landing%2Fscaling.png?alt=media",
  shoppinglist:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/landing%2Fshoppinglist.png?alt=media",
  groupconfig:
    "https://firebasestorage.googleapis.com/v0/b/chuchipirat-dev.appspot.com/o/landing%2Fgroupconfig.png?alt=media",
};
