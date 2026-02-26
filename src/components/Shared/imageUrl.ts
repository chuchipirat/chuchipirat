/**
 * URL-Helper für Supabase Image Transformation.
 *
 * Generiert URLs mit `?width=X&height=X`-Parametern, damit Supabase
 * die Bilder serverseitig in der gewünschten Grösse ausliefert.
 * Die Basis-URL zeigt auf das Originalbild im Storage-Bucket.
 */

/**
 * Vordefinierte Bildgrössen für verschiedene Anzeigeorte.
 *
 * @property AVATAR - 50×50 px, für kleine Benutzer-Avatare (z.B. in Listen, Kommentaren).
 * @property PROFILE_CARD - 600×600 px, für Profilkarten und Dialoge.
 * @property FULL - 1200×1200 px, volle Auflösung.
 */
export enum ImageSize {
  AVATAR = 50,
  PROFILE_CARD = 600,
  FULL = 1200,
}

/**
 * Generiert eine Bild-URL mit Supabase Image Transformation Parametern.
 *
 * Hängt `?width=X&height=X` an die Basis-URL an, damit Supabase das Bild
 * serverseitig in der gewünschten Grösse ausliefert. Bei leerem String
 * wird ein leerer String zurückgegeben.
 *
 * @param baseUrl - Basis-URL des Bildes im Supabase Storage.
 * @param size - Gewünschte Bildgrösse aus dem {@link ImageSize}-Enum.
 * @returns URL mit Transformation-Parametern oder leerer String.
 *
 * @example
 * getImageUrl("https://xxx.supabase.co/storage/v1/object/public/media/users/abc.jpg", ImageSize.AVATAR)
 * // → "https://xxx.supabase.co/storage/v1/object/public/media/users/abc.jpg?width=50&height=50"
 */
export function getImageUrl(baseUrl: string, size: ImageSize): string {
  if (!baseUrl) return "";
  return `${baseUrl}?width=${size}&height=${size}`;
}

/**
 * Generiert eine Bild-URL mit individuellen Dimensionen.
 *
 * Erlaubt beliebige Breiten-/Höhen-Kombinationen. Wenn `height` nicht
 * angegeben wird, wird nur `width` gesetzt (Supabase skaliert proportional).
 *
 * @param baseUrl - Basis-URL des Bildes im Supabase Storage.
 * @param width - Gewünschte Breite in Pixel.
 * @param height - Optionale Höhe in Pixel. Ohne Angabe wird nur width gesetzt.
 * @returns URL mit Transformation-Parametern oder leerer String.
 *
 * @example
 * getImageUrlCustom("https://xxx.supabase.co/.../img.jpg", 300, 200)
 * // → "https://xxx.supabase.co/.../img.jpg?width=300&height=200"
 *
 * @example
 * getImageUrlCustom("https://xxx.supabase.co/.../img.jpg", 300)
 * // → "https://xxx.supabase.co/.../img.jpg?width=300"
 */
export function getImageUrlCustom(
  baseUrl: string,
  width: number,
  height?: number
): string {
  if (!baseUrl) return "";
  if (height !== undefined) {
    return `${baseUrl}?width=${width}&height=${height}`;
  }
  return `${baseUrl}?width=${width}`;
}
