import {ImageRepository} from "../imageRepository";

describe("ImageRepository", () => {
  it("gibt Bilder als Objekt mit allen erwarteten Schlüsseln zurück", () => {
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    const expectedKeys = [
      "LANDING_LOGO",
      "SIGN_IN_HEADER",
      "PDF_FOOTER_IMAGE",
      "CARD_PLACEHOLDER_MEDIA",
      "VECTOR_LOGO_GREY",
      "TWINT_QR_CODE",
      "RECEIPT_IMAGE",
    ];
    expectedKeys.forEach((key) => {
      expect(pictures).toHaveProperty(key);
    });
  });

  it("alle URLs sind nicht-leere Strings", () => {
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    Object.values(pictures).forEach((url) => {
      expect(typeof url).toBe("string");
      expect((url as string).length).toBeGreaterThan(0);
    });
  });

  it("gibt DEV-Bilder zurück in der Testumgebung", () => {
    // Jest-Konfiguration setzt VITE_ENVIRONMENT auf "DEV"
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    expect(pictures.LANDING_LOGO).toContain("chuchipirat-dev");
  });
});
