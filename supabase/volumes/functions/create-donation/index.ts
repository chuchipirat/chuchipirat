/**
 * Edge Function: create-donation
 *
 * Erstellt eine Spende in der DB, initiiert eine Zahlungsanbieter-Gateway-Session
 * und gibt die Zahlungs-URL zurück.
 *
 * Erwartet einen POST-Body (JWT-authentifiziert):
 *   { amountInCents: number, eventId?: string, message?: string, returnPath?: string }
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 *   PAYMENT_API_BASE_URL, PAYMENT_INSTANCE, PAYMENT_API_SECRET, SITE_URL
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  errorResponse,
  successResponse,
} from "../_shared/emailService.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Payload-Struktur des POST-Bodys.
 *
 * @param amountInCents Spendenbetrag in Rappen (min. 500 = CHF 5.00).
 * @param eventId Optionale Event-ID für Event-gebundene Spenden.
 * @param message Optionale Nachricht des Spenders (max. 200 Zeichen).
 * @param returnPath Optionaler Rückweg-Pfad nach der Zahlung.
 * @param previousDonationId Optionale ID einer abgebrochenen/fehlgeschlagenen
 *   Spende desselben Users — bei einem Retry wird deren `donor_message`
 *   übernommen, damit die Nachricht nicht erneut eingegeben werden muss.
 */
type CreateDonationPayload = {
  amountInCents: number;
  eventId?: string;
  message?: string;
  returnPath?: string;
  previousDonationId?: string;
};

/* =====================================================================
// Zahlungsanbieter API Hilfsfunktionen
// ===================================================================== */

/**
 * Erzeugt eine HMAC-SHA256-Signatur für die Zahlungsanbieter-API.
 *
 * @param data Die zu signierende Query-String-Daten.
 * @param secret Der API Secret des Zahlungsanbieters.
 * @returns Base64-kodierte Signatur.
 */
async function createPayrexxSignature(
  data: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Baut einen URL-kodierten Query-String aus den Parametern.
 *
 * @param params Schlüssel-Wert-Paare für den Query-String.
 * @returns URL-kodierter Query-String.
 */
/**
 * Baut einen Query-String im PHP http_build_query-Stil für die HMAC-Signatur.
 * Leerzeichen werden als '+' kodiert, Sonderzeichen mit percent-encoding.
 * Payrexx verifiziert die Signatur serverseitig mit PHP http_build_query,
 * daher muss die Signatur exakt dieses Format verwenden.
 *
 * @param params Schlüssel-Wert-Paare.
 * @returns Query-String im PHP http_build_query-Stil.
 */
function buildPhpQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => {
      // PHP http_build_query: Schlüssel und Werte URL-kodieren,
      // Leerzeichen als '+' (nicht %20)
      const encodedKey = encodeURIComponent(key).replace(/%20/g, "+");
      const encodedValue = encodeURIComponent(value).replace(/%20/g, "+");
      return `${encodedKey}=${encodedValue}`;
    })
    .join("&");
}

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  if (req.method !== "POST") {
    return errorResponse("create-donation", "Method not allowed", 405);
  }

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const paymentInstance = Deno.env.get("PAYMENT_INSTANCE");
  const paymentApiSecret = Deno.env.get("PAYMENT_API_SECRET");
  const paymentApiBaseUrl = (Deno.env.get("PAYMENT_API_BASE_URL") ?? "").replace(/\/$/, "");
  const appUrl = Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return errorResponse(
      "create-donation",
      "Server configuration error: missing Supabase config",
      500,
    );
  }

  if (!paymentInstance || !paymentApiSecret || !paymentApiBaseUrl) {
    return errorResponse(
      "create-donation",
      "Server configuration error: missing payment provider config",
      500,
    );
  }

  // JWT aus Authorization-Header extrahieren
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("create-donation", "Missing Authorization header", 401);
  }

  // User-Client erstellen (mit JWT des Benutzers, damit RLS greift)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {headers: {Authorization: authHeader}},
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Admin-Client für Payrexx-Gateway-ID-Update (umgeht RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Benutzer-Informationen aus JWT laden
  const {data: {user}, error: userError} = await userClient.auth.getUser();
  if (userError || !user) {
    return errorResponse("create-donation", "Unauthorized", 401);
  }

  // Payload parsen
  let payload: CreateDonationPayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("create-donation", "Invalid JSON body", 400);
  }

  const {amountInCents, eventId, message, returnPath, previousDonationId} = payload;

  // Validierung
  if (!amountInCents || typeof amountInCents !== "number" || amountInCents < 500) {
    return errorResponse(
      "create-donation",
      "amountInCents must be at least 500 (CHF 5.00)",
      400,
    );
  }

  if (message && message.length > 200) {
    return errorResponse(
      "create-donation",
      "message must be 200 characters or less",
      400,
    );
  }

  // Optionale Event-Validierung
  if (eventId) {
    const {data: eventRow, error: eventError} = await userClient
      .from("events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventRow) {
      return errorResponse("create-donation", "Event not found", 404);
    }
  }

  // Retry: Nachricht der abgebrochenen/fehlgeschlagenen Vorgänger-Spende
  // übernehmen, falls keine neue Nachricht mitgeschickt wurde. RLS beschränkt
  // die Abfrage bereits auf eigene Spenden (donations_select-Policy).
  let messageToStore = message ?? null;
  if (!messageToStore && previousDonationId) {
    const {data: previousDonation} = await userClient
      .from("donations")
      .select("donor_message")
      .eq("id", previousDonationId)
      .eq("donor_uid", user.id)
      .maybeSingle();

    messageToStore = previousDonation?.donor_message ?? null;
  }

  try {
    // Spende in DB einfügen (status='pending')
    const {data: donation, error: insertError} = await userClient
      .from("donations")
      .insert({
        donor_uid: user.id,
        amount_in_cents: amountInCents,
        currency: "CHF",
        status: "pending",
        event_id: eventId ?? null,
        donor_message: messageToStore,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("create-donation insert error:", insertError);
      return errorResponse("create-donation", "Failed to create donation", 500);
    }

    const donationId = donation.id;

    // Redirect-URLs bauen
    // amount und eventId werden mitgegeben, damit das Frontend bei Retry
    // eine neue Spende mit denselben Parametern erstellen kann
    const returnBase = returnPath ?? "/donate";
    const baseParams = `donationId=${donationId}&amount=${amountInCents}&return=${encodeURIComponent(returnBase)}${eventId ? `&eventId=${eventId}` : ""}`;
    const successUrl = `${appUrl}/donate/result?status=success&${baseParams}`;
    const failedUrl = `${appUrl}/donate/result?status=failed&${baseParams}`;
    const cancelUrl = `${appUrl}/donate/result?status=cancel&${baseParams}`;

    // Benutzer-Informationen für Payrexx
    const {data: userProfile} = await adminClient
      .from("users")
      .select("display_name, email")
      .eq("auth_uid", user.id)
      .single();

    const donorEmail = userProfile?.email ?? user.email ?? "";
    const donorName = userProfile?.display_name ?? "";

    // Zahlungsanbieter Gateway erstellen
    const amountInSmallestUnit = amountInCents; // Zahlungsanbieter erwartet Rappen für CHF
    const gatewayParams: Record<string, string> = {
      amount: String(amountInSmallestUnit),
      currency: "CHF",
      successRedirectUrl: successUrl,
      failedRedirectUrl: failedUrl,
      cancelRedirectUrl: cancelUrl,
      referenceId: donationId,
      purpose: "Spende an chuchipirat",
      "fields[email][value]": donorEmail,
      "fields[forename][value]": donorName.split(" ")[0] || "",
      "fields[surname][value]": donorName.split(" ").slice(1).join(" ") || "",
      skipResultPage: "0",
      preAuthorization: "0",
    };

    // Zuerst Zahlungsanbieter-Credentials prüfen via SignatureCheck
    const checkSignature = await createPayrexxSignature("", paymentApiSecret);
    const checkUrl = `${paymentApiBaseUrl}/SignatureCheck/?instance=${encodeURIComponent(paymentInstance)}`;
    const checkBody = `ApiSignature=${encodeURIComponent(checkSignature)}`;

    console.log("create-donation: Verifying payment provider credentials...");
    const checkResponse = await fetch(checkUrl, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: checkBody,
    });
    const checkResult = await checkResponse.text();
    console.log("create-donation: SignatureCheck response:", checkResponse.status, checkResult);

    if (!checkResponse.ok) {
      console.error("create-donation: Payment provider credentials invalid");
      // Spende auf 'failed' setzen
      await adminClient
        .from("donations")
        .update({status: "failed"})
        .eq("id", donationId);
      return errorResponse("create-donation", "Payment provider credential verification failed", 502);
    }

    // Signatur über PHP-style Query-String (+ für Leerzeichen)
    const phpQueryString = buildPhpQueryString(gatewayParams);
    const signature = await createPayrexxSignature(phpQueryString, paymentApiSecret);

    // HTTP-Body: Standard-URL-kodiert (%20 für Leerzeichen — Zahlungsanbieter dekodiert beides)
    const gatewayApiUrl = `${paymentApiBaseUrl}/Gateway/?instance=${encodeURIComponent(paymentInstance)}`;
    const bodyParams = Object.entries(gatewayParams)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
    const bodyWithSig = bodyParams + `&ApiSignature=${encodeURIComponent(signature)}`;

    console.log("create-donation: Creating payment gateway...");
    console.log("create-donation: PHP query (first 120):", phpQueryString.substring(0, 120));
    console.log("create-donation: Signature:", signature);

    const gatewayResponse = await fetch(gatewayApiUrl, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: bodyWithSig,
    });

    if (!gatewayResponse.ok) {
      const errorBody = await gatewayResponse.text();
      console.error("Payment gateway creation failed:", errorBody);

      // Spende auf 'failed' setzen
      await adminClient
        .from("donations")
        .update({status: "failed"})
        .eq("id", donationId);

      return errorResponse(
        "create-donation",
        "Payment gateway creation failed",
        502,
      );
    }

    const gatewayData = await gatewayResponse.json();
    const gatewayId = String(gatewayData.data?.[0]?.id ?? gatewayData.data?.id ?? "");
    const paymentLink = gatewayData.data?.[0]?.link ?? gatewayData.data?.link ?? "";

    if (!paymentLink) {
      console.error("Payment provider response missing link:", JSON.stringify(gatewayData));
      return errorResponse("create-donation", "No payment link received", 502);
    }

    // Gateway-ID in DB speichern (via Admin-Client, RLS umgehen)
    await adminClient
      .from("donations")
      .update({
        payment_gateway_id: gatewayId,
        payment_reference_id: donationId,
      })
      .eq("id", donationId);

    return successResponse({
      donationId,
      paymentUrl: paymentLink,
    });
  } catch (err) {
    console.error("create-donation error:", err);
    await sentryCaptureError(err, "create-donation");
    return errorResponse("create-donation", String(err), 500);
  }
});
