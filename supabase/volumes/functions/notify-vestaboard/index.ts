/**
 * Edge Function: notify-vestaboard
 *
 * Sendet eine Willkommensnachricht an das Vestaboard, wenn ein neuer
 * Benutzer seine E-Mail-Adresse verifiziert hat.
 *
 * Erwartet einen POST-Body mit: { firstName: string, memberId: number }
 *
 * Erfordert die Umgebungsvariable VESTABOARD_READ_WRITE_KEY.
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";

/* =====================================================================
// Vestaboard Character-Code Tabelle
// Dokumentation: https://docs.vestaboard.com/docs/characterCodes
// ===================================================================== */
const CODE_TABLE: Record<string, number> = {
  " ": 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 22,
  W: 23,
  X: 24,
  Y: 25,
  Z: 26,
  "1": 27,
  "2": 28,
  "3": 29,
  "4": 30,
  "5": 31,
  "6": 32,
  "7": 33,
  "8": 34,
  "9": 35,
  "0": 36,
  "!": 37,
  "@": 38,
  "#": 39,
  $: 40,
  "(": 41,
  ")": 42,
  "-": 44,
  "+": 45,
  "&": 47,
  "=": 48,
  ";": 49,
  ":": 50,
  "'": 52,
  '"': 53,
  "%": 54,
  ",": 55,
  ".": 56,
  "/": 59,
  "?": 60,
  "°": 62,
};

/** Vestaboard-Zeilen haben genau 22 Zeichen */
const ROW_LENGTH = 22;

/**
 * Kodiert einen String in ein Vestaboard-Zeilen-Array (22 Codes).
 * Unbekannte Zeichen werden übersprungen. Zu kurze Zeilen werden
 * mit Leerzeichen (Code 0) aufgefüllt, zu lange abgeschnitten.
 *
 * @param text - Der zu kodierende Text
 * @returns Array mit genau 22 Vestaboard-Zeichencodes
 */
function encodeRow(text: string): number[] {
  const codes: number[] = [];
  for (const char of text) {
    const code = CODE_TABLE[char.toUpperCase()];
    if (code !== undefined) {
      codes.push(code);
    }
  }
  // Auf exakt 22 Zeichen auffüllen bzw. kürzen
  while (codes.length < ROW_LENGTH) codes.push(0);
  codes.length = ROW_LENGTH;
  return codes;
}

/**
 * Baut die 6-zeilige Vestaboard-Nachricht zusammen.
 *
 * Layout:
 *   --  chuchipirat  --
 *   Neuer User an Board
 *   (leer)
 *   Welcome: XXXXXXXXXX
 *   cook: #YYYYY
 *   (leer)
 *
 * @param firstName - Vorname des neuen Benutzers
 * @param memberId - Mitgliedsnummer
 * @returns 6×22 Matrix aus Vestaboard-Zeichencodes
 */
function buildMessage(firstName: string, memberId: number): number[][] {
  return [
    encodeRow(` --  chuchipirat  -- `),
    encodeRow(` Neuer User an Board `),
    encodeRow(`                     `),
    encodeRow(` Welcome: ${firstName} `),
    encodeRow(` cook: #${memberId} `),
    encodeRow(`                     `),
  ];
}

serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-client-info, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({error: "Method not allowed"}), {
      status: 405,
      headers: {"Content-Type": "application/json"},
    });
  }

  const apiKey = Deno.env.get("VESTABOARD_READ_WRITE_KEY");
  if (!apiKey) {
    console.error("VESTABOARD_READ_WRITE_KEY is not set");
    return new Response(
      JSON.stringify({error: "Vestaboard API key not configured"}),
      {status: 500, headers: {"Content-Type": "application/json"}}
    );
  }

  try {
    const {firstName, memberId} = await req.json();

    if (!firstName || memberId === undefined) {
      return new Response(
        JSON.stringify({error: "Missing firstName or memberId"}),
        {status: 400, headers: {"Content-Type": "application/json"}}
      );
    }

    const message = buildMessage(firstName, memberId);

    console.log(
      `Vestaboard update — Welcome ${firstName}, cook #${memberId}`
    );

    const vestaResponse = await fetch("https://rw.vestaboard.com/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Vestaboard-Read-Write-Key": apiKey,
      },
      body: JSON.stringify(message),
    });

    if (!vestaResponse.ok) {
      const errorText = await vestaResponse.text();
      console.error(`Vestaboard API error: ${vestaResponse.status} ${errorText}`);
      return new Response(
        JSON.stringify({
          error: "Vestaboard API error",
          status: vestaResponse.status,
        }),
        {status: 502, headers: {"Content-Type": "application/json"}}
      );
    }

    return new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("notify-vestaboard error:", err);
    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {"Content-Type": "application/json"},
    });
  }
});
