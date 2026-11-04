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
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";
import {encodeRow} from "../_shared/vestaboard.ts";
import {sendToVestaboard} from "../_shared/vestaboardClient.ts";

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
    encodeRow(` Neuer User an Bord `),
    encodeRow(`                     `),
    encodeRow(` Welcome: ${firstName} `),
    encodeRow(` cook: #${memberId} `),
    encodeRow(`                     `),
  ];
}

serve(async (req: Request) => {
  const allowedOrigin = Deno.env.get("SITE_URL") || "https://chuchipirat.ch";

  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
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

  // ── Authentifizierung: JWT verifizieren ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({error: "Missing Authorization header"}),
      {status: 401, headers: {"Content-Type": "application/json"}},
    );
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return new Response(
      JSON.stringify({error: "Missing Supabase config"}),
      {status: 500, headers: {"Content-Type": "application/json"}},
    );
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {headers: {Authorization: authHeader}},
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const {data: {user}, error: authError} = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(
      JSON.stringify({error: "Unauthorized"}),
      {status: 401, headers: {"Content-Type": "application/json"}},
    );
  }

  const apiKey = Deno.env.get("VESTABOARD_READ_WRITE_KEY");
  if (!apiKey) {
    console.error("VESTABOARD_READ_WRITE_KEY is not set");
    return new Response(
      JSON.stringify({error: "Vestaboard API key not configured"}),
      {status: 500, headers: {"Content-Type": "application/json"}},
    );
  }

  try {
    const {firstName, memberId} = await req.json();

    if (!firstName || memberId === undefined) {
      return new Response(
        JSON.stringify({error: "Missing firstName or memberId"}),
        {status: 400, headers: {"Content-Type": "application/json"}},
      );
    }

    const message = buildMessage(firstName, memberId);

    console.log(`Vestaboard update — Welcome ${firstName}, cook #${memberId}`);

    await sendToVestaboard(message);

    return new Response(JSON.stringify({success: true}), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowedOrigin,
      },
    });
  } catch (err) {
    console.error("notify-vestaboard error:", err);
    await sentryCaptureError(err, "notify-vestaboard");
    return new Response(
      JSON.stringify({error: "Ein interner Fehler ist aufgetreten."}),
      {
        status: 500,
        headers: {"Content-Type": "application/json"},
      },
    );
  }
});
