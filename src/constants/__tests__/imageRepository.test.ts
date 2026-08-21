import {ImageRepository} from "../imageRepository";

describe("ImageRepository", () => {
  it("gibt Bilder als Objekt mit allen erwarteten Schlüsseln zurück", () => {
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    const expectedKeys = [
      "LANDING_LOGO",
      "SIGN_IN_HEADER",
      "CARD_PLACEHOLDER_MEDIA",
      "VECTOR_LOGO_GREY",
      "RECEIPT_IMAGE",
    ];
    expectedKeys.forEach((key) => {
      expect(pictures).toHaveProperty(key);
    });
  });

  it("enthält kein PDF_FOOTER_IMAGE mehr (ungenutzt, entfernt)", () => {
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    expect(pictures).not.toHaveProperty("PDF_FOOTER_IMAGE");
  });

  it("alle Pfade sind nicht-leere Strings, die mit /images/ beginnen", () => {
    const pictures = ImageRepository.getEnvironmentRelatedPicture();
    Object.values(pictures).forEach((path) => {
      expect(typeof path).toBe("string");
      expect((path as string).length).toBeGreaterThan(0);
      expect(path as string).toMatch(/^\/images\//);
    });
  });

  it("ist umgebungsunabhängig — liefert bei jedem Aufruf dasselbe Ergebnis", () => {
    const first = ImageRepository.getEnvironmentRelatedPicture();
    const second = ImageRepository.getEnvironmentRelatedPicture();
    expect(second).toEqual(first);
  });
});
