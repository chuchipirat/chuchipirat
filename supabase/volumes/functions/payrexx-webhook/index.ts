/**
 * Edge Function: payrexx-webhook
 *
 * Empfängt Payrexx-Webhook-Benachrichtigungen (Transaction-Events),
 * verifiziert die Transaktion via Payrexx-API, aktualisiert den
 * Spenden-Status und erstellt einen Feed-Eintrag bei Bestätigung.
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PAYREXX_INSTANCE, PAYREXX_API_SECRET, APP_URL
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

/* =====================================================================
// Payrexx API Hilfsfunktionen
// ===================================================================== */

/**
 * Erzeugt eine HMAC-SHA256-Signatur für die Payrexx-API.
 *
 * @param data Die zu signierende Query-String-Daten.
 * @param secret Der Payrexx API Secret.
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
 * Prüft die Webhook-Signatur von Payrexx (HMAC-SHA256).
 * Nutzt die bestehende createPayrexxSignature-Funktion und vergleicht
 * das Ergebnis timing-safe mit der empfangenen Signatur.
 *
 * @param rawBody Der rohe Request-Body als String.
 * @param signature Die empfangene Signatur aus dem Header.
 * @param secret Der Payrexx API Secret.
 * @returns true wenn die Signatur gültig ist.
 */
async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await createPayrexxSignature(rawBody, secret);
  return timingSafeEqual(expected, signature);
}

/**
 * Verifiziert eine Transaktion direkt via Payrexx API (GET).
 *
 * @param transactionId Die Payrexx-Transaktions-ID.
 * @param instance Die Payrexx-Instanz.
 * @param secret Der Payrexx API Secret.
 * @returns Transaktionsdaten oder null bei Fehler.
 */
async function verifyTransaction(
  transactionId: string,
  instance: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const signature = await createPayrexxSignature("", secret);
  const url = `https://api.payrexx.com/v1.0/Transaction/${transactionId}/?instance=${instance}&ApiSignature=${encodeURIComponent(signature)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  return data?.data?.[0] ?? data?.data ?? null;
}

/**
 * Mappt Payrexx-Status auf den internen Spenden-Status.
 *
 * @param payrexxStatus Der Status von Payrexx.
 * @returns Interner Spenden-Status oder null falls unbekannt.
 */
function mapPayrexxStatus(
  payrexxStatus: string,
): "confirmed" | "failed" | "cancelled" | null {
  switch (payrexxStatus) {
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
    return errorResponse("payrexx-webhook", "Method not allowed", 405);
  }

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const payrexxInstance = Deno.env.get("PAYREXX_INSTANCE");
  const payrexxSecret = Deno.env.get("PAYREXX_API_SECRET");
  const appUrl = Deno.env.get("APP_URL") ?? "https://chuchipirat.ch";

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("payrexx-webhook", "Missing Supabase config", 500);
  }

  if (!payrexxInstance || !payrexxSecret) {
    return errorResponse("payrexx-webhook", "Missing Payrexx config", 500);
  }

  // Admin-Client (Webhook hat kein User-JWT)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Webhook-Payload als Rohtext lesen (für Signaturprüfung)
  const rawBody = await req.text();

  // Webhook-Signatur prüfen (Payrexx sendet X-Webhook-Signature Header)
  const receivedSignature = req.headers.get("X-Webhook-Signature");
  if (receivedSignature) {
    const isValid = await verifyWebhookSignature(rawBody, receivedSignature, payrexxSecret);
    if (!isValid) {
      console.error("payrexx-webhook: Invalid webhook signature");
      return errorResponse("payrexx-webhook", "Invalid signature", 401);
    }
  } else {
    // TODO(security): Signatur nach Payrexx-Webhook-Konfiguration als Pflicht setzen
    console.warn("payrexx-webhook: No X-Webhook-Signature header — skipping verification");
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
      return errorResponse("payrexx-webhook", "Invalid payload", 400);
    }
  }

  // Transaction-Daten aus Webhook extrahieren
  const transaction = (webhookData.transaction as Record<string, unknown>) ?? webhookData;
  const transactionId = String(transaction.id ?? "");
  const referenceId = String(transaction.referenceId ?? transaction.reference_id ?? "");

  if (!transactionId || !referenceId) {
    // Kein relevanter Event — OK zurückgeben
    console.log("payrexx-webhook: No transactionId or referenceId, ignoring");
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
      console.error(`payrexx-webhook: Donation not found for referenceId=${referenceId}`);
      return successResponse({ignored: true, reason: "donation_not_found"});
    }

    // Idempotenz: Nur pending-Spenden verarbeiten
    if (donation.status !== "pending") {
      console.log(`payrexx-webhook: Donation ${referenceId} already processed (status=${donation.status})`);
      return successResponse({ignored: true, reason: "already_processed"});
    }

    // Transaktion via Payrexx API verifizieren
    const verifiedTx = await verifyTransaction(transactionId, payrexxInstance, payrexxSecret);
    if (!verifiedTx) {
      console.error(`payrexx-webhook: Failed to verify transaction ${transactionId}`);
      return errorResponse("payrexx-webhook", "Transaction verification failed", 502);
    }

    const payrexxStatus = String(verifiedTx.status ?? "");
    const mappedStatus = mapPayrexxStatus(payrexxStatus);

    if (!mappedStatus) {
      console.log(`payrexx-webhook: Unknown Payrexx status '${payrexxStatus}', ignoring`);
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
          payrexx_transaction_id: transactionId,
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
            .eq("auth_uid", donation.donor_uid)
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

            const donatePageUrl = donation.event_id
              ? `${appUrl}/event/${donation.event_id}`
              : `${appUrl}/donate`;

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
              `Quittung herunterladen: ${donatePageUrl}\n\n` +
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
          console.error("payrexx-webhook: Email sending failed:", emailErr);
        }
      }
    } else {
      // failed oder cancelled
      await adminClient
        .from("donations")
        .update({
          status: mappedStatus,
          payrexx_transaction_id: transactionId,
        })
        .eq("id", referenceId);
    }

    console.log(`payrexx-webhook: Donation ${referenceId} updated to '${mappedStatus}'`);
    return successResponse({donationId: referenceId, status: mappedStatus});
  } catch (err) {
    console.error("payrexx-webhook error:", err);
    await sentryCaptureError(err, "payrexx-webhook");
    return errorResponse("payrexx-webhook", String(err), 500);
  }
});
