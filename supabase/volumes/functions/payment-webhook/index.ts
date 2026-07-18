/**
 * Edge Function: payment-webhook
 *
 * Empfängt Webhook-Benachrichtigungen des Zahlungsanbieters (Transaction-Events),
 * verifiziert die Transaktion via Zahlungsanbieter-API, aktualisiert den
 * Spenden-Status und erstellt einen Feed-Eintrag bei Bestätigung.
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PAYMENT_API_BASE_URL, PAYMENT_INSTANCE, PAYMENT_API_SECRET, APP_URL
 *   PAYMENT_WEBHOOK_SIGNING_KEY
 *   BREVO_API_KEY oder SMTP_HOST (für Bestätigungs-E-Mail)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendEmail,
  readEmailEnv,
  isEmailConfigured,
  errorResponse,
  successResponse,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";
import {matchTransactionToDonation} from "../_shared/paymentVerification.ts";

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
 * Vergleicht zwei Strings in konstanter Zeit (Schutz gegen Timing-Angriffe).
 *
 * @param a Erster String.
 * @param b Zweiter String.
 * @returns true wenn beide Strings identisch sind.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

/**
 * Prüft die Webhook-Signatur des Zahlungsanbieters (HMAC-SHA256).
 * Vergleicht das Ergebnis timing-safe mit der empfangenen Signatur.
 *
 * @param rawBody Der rohe Request-Body als String.
 * @param signature Die empfangene Signatur aus dem Header.
 * @param secret Der Webhook-Signing-Key des Zahlungsanbieters.
 * @returns true wenn die Signatur gültig ist.
 */
async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(expectedHex, signature);
}


/**
 * Verifiziert eine Transaktion direkt via Zahlungsanbieter-API (GET).
 *
 * @param transactionId Die Transaktions-ID.
 * @param instance Die Instanz des Zahlungsanbieters.
 * @param secret Der API Secret des Zahlungsanbieters.
 * @param apiBaseUrl Die Basis-URL der Zahlungsanbieter-API.
 * @returns Transaktionsdaten oder null bei Fehler.
 */
async function verifyTransaction(
  transactionId: string,
  instance: string,
  secret: string,
  apiBaseUrl: string,
): Promise<Record<string, unknown> | null> {
  const signature = await createPayrexxSignature("", secret);
  const url = `${apiBaseUrl}/Transaction/${transactionId}/?instance=${instance}&ApiSignature=${encodeURIComponent(signature)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  return data?.data?.[0] ?? data?.data ?? null;
}

/**
 * Mappt den Zahlungsanbieter-Status auf den internen Spenden-Status.
 *
 * @param providerStatus Der Status des Zahlungsanbieters.
 * @returns Interner Spenden-Status oder null falls unbekannt.
 */
function mapPayrexxStatus(
  providerStatus: string,
): "confirmed" | "failed" | "cancelled" | null {
  switch (providerStatus) {
    case "confirmed":
      return "confirmed";
    case "declined":
    case "error":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
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
    return errorResponse("payment-webhook", "Method not allowed", 405);
  }

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paymentInstance = Deno.env.get("PAYMENT_INSTANCE");
  const paymentApiSecret = Deno.env.get("PAYMENT_API_SECRET");
  const paymentApiBaseUrl = (Deno.env.get("PAYMENT_API_BASE_URL") ?? "").replace(/\/$/, "");
  const appUrl = Deno.env.get("APP_URL") ?? "https://chuchipirat.ch";

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("payment-webhook", "Missing Supabase config", 500);
  }

  const paymentWebhookSigningKey = Deno.env.get("PAYMENT_WEBHOOK_SIGNING_KEY");

  if (!paymentInstance || !paymentApiSecret || !paymentApiBaseUrl) {
    return errorResponse("payment-webhook", "Missing payment provider config", 500);
  }

  // Admin-Client (Webhook hat kein User-JWT)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Webhook-Payload als Rohtext lesen (für Signaturprüfung)
  const rawBody = await req.text();

  // Webhook-Signatur prüfen (Zahlungsanbieter sendet X-Webhook-Signature Header).
  // Ohne gültige Signatur wird die Anfrage abgelehnt — ein fehlender Header
  // darf NICHT als "Verifizierung überspringen" behandelt werden, sonst kann
  // jeder unsignierte POSTs an diesen Endpoint senden.
  if (!paymentWebhookSigningKey) {
    console.error("payment-webhook: PAYMENT_WEBHOOK_SIGNING_KEY not configured");
    return errorResponse("payment-webhook", "Server misconfiguration", 500);
  }

  const receivedSignature = req.headers.get("X-Webhook-Signature");
  if (!receivedSignature) {
    console.error("payment-webhook: Missing X-Webhook-Signature header");
    return errorResponse("payment-webhook", "Missing signature", 401);
  }

  const isValid = await verifyWebhookSignature(rawBody, receivedSignature, paymentWebhookSigningKey);
  if (!isValid) {
    console.error("payment-webhook: Invalid webhook signature");
    return errorResponse("payment-webhook", "Invalid signature", 401);
  }

  // Payload parsen (JSON oder URL-encoded)
  let webhookData: Record<string, unknown>;
  try {
    webhookData = JSON.parse(rawBody);
  } catch {
    try {
      const params = new URLSearchParams(rawBody);
      webhookData = Object.fromEntries(params.entries());
    } catch {
      return errorResponse("payment-webhook", "Invalid payload", 400);
    }
  }

  // Transaction-Daten aus Webhook extrahieren
  const transaction = (webhookData.transaction as Record<string, unknown>) ?? webhookData;
  const transactionId = String(transaction.id ?? "");
  const referenceId = String(transaction.referenceId ?? transaction.reference_id ?? "");

  if (!transactionId || !referenceId) {
    // Kein relevanter Event — OK zurückgeben
    console.log("payment-webhook: No transactionId or referenceId, ignoring");
    return successResponse({ignored: true});
  }

  try {
    // Spende anhand der referenceId (= donationId) laden
    const {data: donation, error: donationError} = await adminClient
      .from("donations")
      .select("*")
      .eq("id", referenceId)
      .single();

    if (donationError || !donation) {
      console.error(`payment-webhook: Donation not found for referenceId=${referenceId}`);
      return successResponse({ignored: true, reason: "donation_not_found"});
    }

    // Idempotenz: Nur bereits abschliessend verarbeitete Spenden überspringen.
    // "failed"/"cancelled" sind NICHT terminal — ein einzelnes Gateway (siehe
    // create-donation) erlaubt mehrere Zahlungsversuche mit derselben
    // referenceId (z.B. Karte abgelehnt, danach erfolgreich bezahlt). Nur
    // "confirmed"/"refunded"/"migrated" dürfen nicht erneut verarbeitet werden.
    const terminalStatuses = ["confirmed", "refunded", "migrated"];
    if (terminalStatuses.includes(donation.status)) {
      console.log(`payment-webhook: Donation ${referenceId} already processed (status=${donation.status})`);
      return successResponse({ignored: true, reason: "already_processed"});
    }

    // Transaktion via Zahlungsanbieter-API verifizieren
    const verifiedTx = await verifyTransaction(transactionId, paymentInstance, paymentApiSecret, paymentApiBaseUrl);
    if (!verifiedTx) {
      console.error(`payment-webhook: Failed to verify transaction ${transactionId}`);
      return errorResponse("payment-webhook", "Transaction verification failed", 502);
    }

    // Cross-Check: Die bei Zahlungsanbieter hinterlegte referenceId/amount der
    // Transaktion muss zur angefragten Spende passen. Ohne diese Prüfung könnte
    // jemand eine eigene, echte (aber unabhängige) Transaktions-ID zusammen mit
    // einer fremden referenceId einreichen und so eine beliebige Spende als
    // bezahlt markieren, obwohl die Transaktion nie dafür bestimmt war.
    const matchResult = matchTransactionToDonation(
      verifiedTx,
      referenceId,
      donation.amount_in_cents,
    );
    if (!matchResult.matches) {
      console.error(`payment-webhook: Transaction ${transactionId} ${matchResult.reason}`);
      return errorResponse("payment-webhook", "Transaction/donation mismatch", 409);
    }

    const providerStatus = String(verifiedTx.status ?? "");
    const mappedStatus = mapPayrexxStatus(providerStatus);

    if (!mappedStatus) {
      console.log(`payment-webhook: Unknown provider status '${providerStatus}', ignoring`);
      return successResponse({ignored: true, reason: "unknown_status"});
    }

    // Zahlungsmethode extrahieren
    const paymentMethod = String(
      (verifiedTx.payment as Record<string, unknown>)?.brand ??
      (verifiedTx.payment as Record<string, unknown>)?.type ??
      "unknown",
    );

    if (mappedStatus === "confirmed") {
      // Quittungsnummer generieren
      const {data: receiptResult} = await adminClient.rpc("generate_donation_receipt_number");
      const receiptNumber = receiptResult ?? null;

      // Spende aktualisieren
      await adminClient
        .from("donations")
        .update({
          status: "confirmed",
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
          payment_transaction_id: transactionId,
          receipt_number: receiptNumber,
        })
        .eq("id", referenceId);

      // Feed-Eintrag erstellen
      await adminClient.from("feeds").insert({
        feed_type: "donationConfirmed",
        visibility: "basic",
        user_uid: donation.donor_uid,
        source_object_type: "donation",
        source_object_uid: referenceId,
        source_object_data: {amount: donation.amount_in_cents},
      });

      // Bestätigungs-E-Mail senden
      const emailEnv = readEmailEnv();
      if (isEmailConfigured(emailEnv)) {
        try {
          // Spender-Informationen laden
          const {data: donor} = await adminClient
            .from("users")
            .select("display_name, email")
            .eq("id", donation.donor_uid)
            .single();

          if (donor?.email) {
            const amountFormatted = (donation.amount_in_cents / 100).toFixed(2);
            const paidDate = new Date().toLocaleDateString("de-CH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            // Event-Name laden (falls vorhanden)
            let eventName = "";
            if (donation.event_id) {
              const {data: eventRow} = await adminClient
                .from("events")
                .select("name")
                .eq("id", donation.event_id)
                .single();
              eventName = eventRow?.name ?? "";
            }

            const donatePageUrl = `${appUrl}/profile`;

            const subject = "Danke für deine Spende — chuchipirat";
            const htmlContent = renderEmailTemplate("donation-confirmed", {
              subject,
              donorName: donor.display_name || "Spender*in",
              amount: `CHF ${amountFormatted}`,
              paidDate,
              paymentMethod,
              eventName: eventName || "—",
              receiptNumber: receiptNumber || "—",
              donatePageUrl,
            });

            const textContent =
              `Hallo ${donor.display_name || "Spender*in"},\n\n` +
              `Vielen Dank für deine Spende von CHF ${amountFormatted}!\n\n` +
              `Datum: ${paidDate}\n` +
              `Zahlungsmethode: ${paymentMethod}\n` +
              (eventName ? `Anlass: ${eventName}\n` : "") +
              `Quittungsnummer: ${receiptNumber || "—"}\n\n` +
              `Deine Spende hilft uns, den chuchipirat weiterzuentwickeln und weiterhin kostenlos anzubieten.\n\n` +
              `Spendenquittung herunterladen: ${donatePageUrl} (unter «Meine Spenden»)\n\n` +
              `Merci 1000!\nVerein chuchipirat`;

            await sendEmail(emailEnv, donor.email, subject, htmlContent, textContent);

            // receipt_sent_at aktualisieren
            await adminClient
              .from("donations")
              .update({receipt_sent_at: new Date().toISOString()})
              .eq("id", referenceId);

            // mail_log Eintrag
            await adminClient.from("mail_log").insert({
              recipients: [donor.email],
              recipient_type: "email",
              subject,
              body: htmlContent,
              template_name: "donation-confirmed",
              delivery_status: "success",
              details: {donation_id: referenceId, donor_uid: donation.donor_uid},
            });
          }
        } catch (emailErr) {
          // E-Mail-Fehler sind nicht kritisch — Spende ist bestätigt
          console.error("payment-webhook: Email sending failed:", emailErr);
        }
      }
    } else {
      // failed oder cancelled
      await adminClient
        .from("donations")
        .update({
          status: mappedStatus,
          payment_transaction_id: transactionId,
        })
        .eq("id", referenceId);
    }

    console.log(`payment-webhook: Donation ${referenceId} updated to '${mappedStatus}'`);
    return successResponse({donationId: referenceId, status: mappedStatus});
  } catch (err) {
    console.error("payment-webhook error:", err);
    await sentryCaptureError(err, "payment-webhook");
    return errorResponse("payment-webhook", String(err), 500);
  }
});
