/**
 * Client-seitiges Bild-Resize Utility.
 *
 * Skaliert Bilder vor dem Upload auf eine maximale Dimension (Breite oder Höhe),
 * wobei das Seitenverhältnis beibehalten wird. Bilder, die kleiner als die
 * maximale Dimension sind, werden nicht vergrössert.
 *
 * @example
 * const resized = await resizeImage(file, 1200, 0.85);
 * // resized ist ein JPEG-Blob mit max. 1200px Seitenlänge
 */

/**
 * Skaliert ein Bild auf die angegebene maximale Dimension (Client-side via Canvas).
 *
 * Das Seitenverhältnis wird beibehalten. Bilder, die bereits kleiner als
 * `maxDimension` sind, werden nicht vergrössert, sondern lediglich als
 * JPEG mit der angegebenen Qualität exportiert.
 *
 * @param file - Die Bilddatei (File-Objekt aus einem Input-Element).
 * @param maxDimension - Maximale Breite oder Höhe in Pixel (Standard: 1200).
 * @param quality - JPEG-Qualität zwischen 0 und 1 (Standard: 0.85).
 * @returns JPEG-Blob des skalierten Bildes.
 * @throws {Error} Wenn das Bild nicht geladen werden kann.
 *
 * @example
 * const file = inputElement.files[0];
 * const blob = await resizeImage(file);
 * await storageRepository.upload("profile.jpg", blob, "image/jpeg");
 */
export async function resizeImage(
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<Blob> {
  const img = await loadImage(file);
  const {width, height} = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    maxDimension
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D-Kontext konnte nicht erstellt werden.");
  }

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas konnte nicht in Blob konvertiert werden."));
        }
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Berechnet die skalierten Dimensionen unter Beibehaltung des Seitenverhältnisses.
 *
 * Wenn beide Dimensionen kleiner als `maxDimension` sind, werden die
 * Originalmasse zurückgegeben (kein Upscaling).
 *
 * @param originalWidth - Originalbreite in Pixel.
 * @param originalHeight - Originalhöhe in Pixel.
 * @param maxDimension - Maximale Breite oder Höhe in Pixel.
 * @returns Objekt mit den berechneten `width` und `height`.
 */
export function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): {width: number; height: number} {
  // Kein Upscaling, wenn Bild bereits kleiner
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return {width: originalWidth, height: originalHeight};
  }

  const ratio = Math.min(
    maxDimension / originalWidth,
    maxDimension / originalHeight
  );

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

/**
 * Lädt eine Bilddatei in ein HTMLImageElement.
 *
 * @param file - Die zu ladende Bilddatei.
 * @returns Das geladene Image-Element.
 * @throws {Error} Wenn das Bild nicht geladen werden kann.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht geladen werden."));
    };

    img.src = objectUrl;
  });
}
