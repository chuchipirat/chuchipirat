/**
 * Versand von Nachrichten an das Vestaboard über die Read/Write-API.
 * Verwendet die Umgebungsvariable `VESTABOARD_READ_WRITE_KEY`.
 *
 * @example
 * import { sendToVestaboard } from "../_shared/vestaboardClient.ts";
 * await sendToVestaboard(buildDonationBoard(data));
 */

/** Endpunkt der Read/Write-API. */
const VESTABOARD_API_URL = "https://rw.vestaboard.com/";

/**
 * Sendet eine 6×22-Matrix an das Vestaboard. Ohne gesetzten Key wird nur
 * geloggt, damit eine Umgebung ohne Board nicht als Fehler gilt.
 *
 * @param board - 6×22-Matrix aus Board-Codes.
 * @returns `true`, wenn gesendet wurde, `false` ohne Key.
 * @throws Error, wenn die API mit einem Fehlerstatus antwortet.
 * @example
 * await sendToVestaboard(board);
 */
export async function sendToVestaboard(board: number[][]): Promise<boolean> {
  const apiKey = Deno.env.get("VESTABOARD_READ_WRITE_KEY");
  if (!apiKey) {
    console.warn("VESTABOARD_READ_WRITE_KEY is not set, skipping Vestaboard");
    return false;
  }

  const response = await fetch(VESTABOARD_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vestaboard-Read-Write-Key": apiKey,
    },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vestaboard API error: ${response.status} ${errorText}`);
  }
  return true;
}
