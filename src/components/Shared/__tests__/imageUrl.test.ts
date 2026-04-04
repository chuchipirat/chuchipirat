/**
 * Unit-Tests für imageUrl.ts.
 *
 * Testet die URL-Generierung mit Supabase Image Transformation Parametern.
 */
import {getImageUrl, getImageUrlCustom, ImageSize} from "../imageUrl";

describe("getImageUrl()", () => {
  const baseUrl =
    "https://xxx.supabase.co/storage/v1/object/public/media/users/abc.jpg";

  test("AVATAR-Grösse anhängen", () => {
    const result = getImageUrl(baseUrl, ImageSize.AVATAR);

    expect(result).toBe(`${baseUrl}?width=50&height=50`);
  });

  test("PROFILE_CARD-Grösse anhängen", () => {
    const result = getImageUrl(baseUrl, ImageSize.PROFILE_CARD);

    expect(result).toBe(`${baseUrl}?width=600&height=600`);
  });

  test("FULL-Grösse anhängen", () => {
    const result = getImageUrl(baseUrl, ImageSize.FULL);

    expect(result).toBe(`${baseUrl}?width=1200&height=1200`);
  });

  test("Leerer String → leerer String", () => {
    const result = getImageUrl("", ImageSize.AVATAR);

    expect(result).toBe("");
  });
});

describe("getImageUrlCustom()", () => {
  const baseUrl =
    "https://xxx.supabase.co/storage/v1/object/public/media/users/abc.jpg";

  test("Breite und Höhe anhängen", () => {
    const result = getImageUrlCustom(baseUrl, 300, 200);

    expect(result).toBe(`${baseUrl}?width=300&height=200`);
  });

  test("Nur Breite ohne Höhe", () => {
    const result = getImageUrlCustom(baseUrl, 300);

    expect(result).toBe(`${baseUrl}?width=300`);
  });

  test("Leerer String → leerer String", () => {
    const result = getImageUrlCustom("", 300, 200);

    expect(result).toBe("");
  });
});

describe("ImageSize enum", () => {
  test("Korrekte Werte", () => {
    expect(ImageSize.AVATAR).toBe(50);
    expect(ImageSize.PROFILE_CARD).toBe(600);
    expect(ImageSize.FULL).toBe(1200);
  });
});
