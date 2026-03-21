/**
 * Edge Function: notify-request
 *
 * Sendet E-Mail-Benachrichtigungen für das Antrags-System.
 * Unterstützt 5 Szenarien:
 *
 * | Szenario                  | Empfänger              | Template               |
 * |---------------------------|------------------------|------------------------|
 * | newRecipePublishRequest   | Alle Community Leaders | request-new            |
 * | newReportErrorRequest     | Alle Community Leaders | request-new            |
 * | requestRecipePublished    | Antrags-Autor*in       | request-published      |
 * | requestReportErrorFixed   | Antrags-Autor*in       | request-error-fixed    |
 * | requestDeclined           | Antrags-Autor*in       | request-declined       |
 * | requestBackToReview       | Assignee               | request-back-to-review |
 * | requestNewComment         | Gegenpartei            | request-comment        |
 *
 * Erwartet einen POST-Body mit:
 *   { scenario: string, requestId: string, commentId?: string }
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY (Produktion) oder SMTP_HOST (lokale Entwicklung)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient, SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendEmail,
  readEmailEnv,
  isEmailConfigured,
  errorResponse,
  successResponse,
  escapeHtml,
  EmailEnv,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";

/* =====================================================================
// Typen
// ===================================================================== */

/** Payload-Struktur des POST-Bodys. */
interface NotifyPayload {
  scenario: string;
  requestId: string;
  commentId?: string;
}

/** Antrags-Daten aus der DB. */
interface RequestData {
  id: string;
  number: number;
  status: string;
  request_type: string;
  author_uid: string;
  assignee_uid: string | null;
  request_object_uid: string;
}

/** Benutzer-Daten (E-Mail + Anzeigename). */
interface UserData {
  email: string;
  display_name: string;
}

/** Deutschsprachige Bezeichnung des Antragstyps. */
const REQUEST_TYPE_NAMES: Record<string, string> = {
  recipePublish: "Rezeptveröffentlichung",
  reportError: "Fehlermeldung",
};

const FUNCTION_NAME = "notify-request";

/* =====================================================================
// Szenarien
// ===================================================================== */

/**
 * Sendet Benachrichtigung an alle Community Leaders (neuer Antrag).
 */
async function handleNewRequest(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  recipeName: string,
): Promise<void> {
  // Alle Community Leaders laden
  const {data: leaders, error} = await supabaseAdmin
    .from("users")
    .select("email, display_name")
    .contains("roles", ["communityLeader"]);

  if (error || !leaders || leaders.length === 0) {
    console.log(`${FUNCTION_NAME}: Keine Community Leaders gefunden`);
    return;
  }

  // Autor-Name laden
  const authorName = await getUserDisplayName(supabaseAdmin, request.author_uid);
  const requestTypeName =
    REQUEST_TYPE_NAMES[request.request_type] ?? request.request_type;

  // Initialen Kommentar laden (falls vorhanden)
  const {data: firstComment} = await supabaseAdmin
    .from("request_comments")
    .select("comment")
    .eq("request_id", request.id)
    .order("created_at", {ascending: true})
    .limit(1)
    .maybeSingle();

  const commentText = firstComment?.comment?.trim() ?? "";

  // Antrags-Link zusammenbauen
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch").replace(
    /\/$/,
    "",
  );
  const requestUrl = `${siteUrl}/requestoverview/${request.id}`;

  const subject =
    request.request_type === "recipePublish"
      ? `Neuer Antrag #${request.number}: ${recipeName}`
      : `Neue Fehlermeldung #${request.number}: ${recipeName}`;

  // An jeden Leader einzeln senden
  for (const leader of leaders as UserData[]) {
    if (!leader.email) continue;

    // Kommentar-Block als vorbereitetes HTML (bereits escaped)
    const commentBlock = commentText
      ? `<p style="margin: 16px 0 8px; font-size: 14px; color: #757575; line-height: 1.5;">Nachricht:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(commentText.length > 500 ? commentText.slice(0, 497) + "…" : commentText)}</p>
                  </td>
                </tr>
              </table>`
      : "";

    const htmlContent = renderEmailTemplate(
      "request-new",
      {
        subject,
        recipientName: leader.display_name || "Community Leader",
        requestAuthor: authorName,
        requestNumber: String(request.number),
        requestTypeName,
        recipeName,
        requestUrl,
      },
      {commentBlock},
    );

    const textContent =
      `Hallo ${leader.display_name || "Community Leader"},\n\n` +
      `${authorName} hat einen neuen Antrag erstellt:\n` +
      `Antrag #${request.number}: ${requestTypeName}\n` +
      `Rezept: «${recipeName}»\n` +
      (commentText ? `\nNachricht:\n${commentText}\n` : "") +
      `\nÖffne den Antrag:\n${requestUrl}\n\n` +
      `Bei Fragen: hallo@chuchipirat.ch`;

    try {
      await sendEmail(emailEnv, leader.email, subject, htmlContent, textContent);
      console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${leader.email} (${subject})`);
    } catch (err) {
      console.error(`${FUNCTION_NAME}: Fehler beim Senden an ${leader.email}:`, err);
    }
  }
}

/**
 * Sendet Benachrichtigung an Autor*in (Rezept veröffentlicht).
 */
async function handleRecipePublished(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  recipeName: string,
): Promise<void> {
  const author = await getUser(supabaseAdmin, request.author_uid);
  if (!author?.email) return;

  // Letzten Kommentar laden (optionaler Abschluss-Kommentar)
  const {data: lastComment} = await supabaseAdmin
    .from("request_comments")
    .select("comment")
    .eq("request_id", request.id)
    .order("created_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  const commentText = lastComment?.comment?.trim() ?? "";

  // Kommentar-Block als vorbereitetes HTML (gleiche Struktur wie bei Ablehnung)
  const commentBlock = commentText
    ? `<p style="margin: 16px 0 8px; font-size: 14px; color: #757575; line-height: 1.5;">Kommentar:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(commentText.length > 500 ? commentText.slice(0, 497) + "…" : commentText)}</p>
                  </td>
                </tr>
              </table>`
    : "";

  const subject = `Dein Rezept «${recipeName}» wurde veröffentlicht`;
  const htmlContent = renderEmailTemplate(
    "request-published",
    {
      subject,
      authorDisplayName: author.display_name || "Koch",
      recipeName,
    },
    {commentBlock},
  );

  const textContent =
    `Hallo ${author.display_name || "Koch"},\n\n` +
    `Dein Rezept «${recipeName}» wurde veröffentlicht!\n` +
    `Es ist jetzt für alle Benutzer*innen von chuchipirat sichtbar.\n\n` +
    (commentText ? `Kommentar:\n${commentText}\n\n` : "") +
    `Vielen Dank für deinen Beitrag!\n\n` +
    `Bei Fragen: hallo@chuchipirat.ch`;

  await sendEmail(emailEnv, author.email, subject, htmlContent, textContent);
  console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${author.email} (${subject})`);
}

/**
 * Sendet Benachrichtigung an Autor*in (Fehlermeldung bearbeitet).
 */
async function handleReportErrorFixed(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  recipeName: string,
): Promise<void> {
  const author = await getUser(supabaseAdmin, request.author_uid);
  if (!author?.email) return;

  // Letzten Kommentar laden (optionaler Abschluss-Kommentar)
  const {data: lastComment} = await supabaseAdmin
    .from("request_comments")
    .select("comment")
    .eq("request_id", request.id)
    .order("created_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  const commentText = lastComment?.comment?.trim() ?? "";

  const commentBlock = commentText
    ? `<p style="margin: 16px 0 8px; font-size: 14px; color: #757575; line-height: 1.5;">Kommentar:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(commentText.length > 500 ? commentText.slice(0, 497) + "…" : commentText)}</p>
                  </td>
                </tr>
              </table>`
    : "";

  const subject = `Die Fehlermeldung #${request.number} wurde bearbeitet`;
  const htmlContent = renderEmailTemplate(
    "request-error-fixed",
    {
      subject,
      authorDisplayName: author.display_name || "Koch",
      requestNumber: String(request.number),
      recipeName,
    },
    {commentBlock},
  );

  const textContent =
    `Hallo ${author.display_name || "Koch"},\n\n` +
    `Die Fehlermeldung #${request.number} zum Rezept «${recipeName}» wurde bearbeitet.\n\n` +
    (commentText ? `Kommentar:\n${commentText}\n\n` : "") +
    `Vielen Dank für deine Meldung!\n\n` +
    `Bei Fragen: hallo@chuchipirat.ch`;

  await sendEmail(emailEnv, author.email, subject, htmlContent, textContent);
  console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${author.email} (${subject})`);
}

/**
 * Sendet Benachrichtigung an Autor*in (Antrag abgelehnt, mit Begründung).
 */
async function handleDeclined(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  recipeName: string,
): Promise<void> {
  const author = await getUser(supabaseAdmin, request.author_uid);
  if (!author?.email) return;

  const requestTypeName =
    REQUEST_TYPE_NAMES[request.request_type] ?? request.request_type;

  // Letzten Kommentar als Begründung laden
  const {data: lastComment} = await supabaseAdmin
    .from("request_comments")
    .select("comment")
    .eq("request_id", request.id)
    .order("created_at", {ascending: false})
    .limit(1)
    .maybeSingle();

  const reasonText = lastComment?.comment?.trim() ?? "";

  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch").replace(
    /\/$/,
    "",
  );
  const requestUrl = `${siteUrl}/requestoverview/${request.id}`;

  // Begründungs-Block als vorbereitetes HTML
  const reasonBlock = reasonText
    ? `<p style="margin: 16px 0 8px; font-size: 14px; color: #757575; line-height: 1.5;">Begründung:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background-color: #f5f5f5; border-left: 4px solid #006064; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; font-size: 15px; color: #424242; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(reasonText.length > 500 ? reasonText.slice(0, 497) + "…" : reasonText)}</p>
                  </td>
                </tr>
              </table>`
    : "";

  const subject = `Antrag #${request.number} wurde abgelehnt`;
  const htmlContent = renderEmailTemplate(
    "request-declined",
    {
      subject,
      authorDisplayName: author.display_name || "Koch",
      requestNumber: String(request.number),
      requestTypeName,
      recipeName,
      requestUrl,
    },
    {reasonBlock},
  );

  const textContent =
    `Hallo ${author.display_name || "Koch"},\n\n` +
    `Dein Antrag #${request.number} (${requestTypeName}) zum Rezept «${recipeName}» wurde abgelehnt.\n` +
    (reasonText ? `\nBegründung:\n${reasonText}\n` : "") +
    `\nÖffne den Antrag:\n${requestUrl}\n\n` +
    `Bei Fragen: hallo@chuchipirat.ch`;

  await sendEmail(emailEnv, author.email, subject, htmlContent, textContent);
  console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${author.email} (${subject})`);
}

/**
 * Sendet Benachrichtigung an den Assignee (Autor*in hat Antrag erneut eingereicht).
 */
async function handleBackToReview(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  recipeName: string,
): Promise<void> {
  if (!request.assignee_uid) {
    console.log(`${FUNCTION_NAME}: Kein Assignee — keine Benachrichtigung`);
    return;
  }

  const assignee = await getUser(supabaseAdmin, request.assignee_uid);
  if (!assignee?.email) return;

  const authorName = await getUserDisplayName(supabaseAdmin, request.author_uid);
  const requestTypeName =
    REQUEST_TYPE_NAMES[request.request_type] ?? request.request_type;

  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch").replace(
    /\/$/,
    "",
  );
  const requestUrl = `${siteUrl}/requestoverview/${request.id}`;

  const subject = `Antrag #${request.number} erneut zur Prüfung eingereicht`;
  const htmlContent = renderEmailTemplate("request-back-to-review", {
    subject,
    recipientName: assignee.display_name || "Community Leader",
    authorName,
    requestNumber: String(request.number),
    requestTypeName,
    recipeName,
    requestUrl,
  });

  const textContent =
    `Hallo ${assignee.display_name || "Community Leader"},\n\n` +
    `${authorName} hat den Antrag #${request.number} (${requestTypeName}) erneut zur Prüfung eingereicht.\n` +
    `Rezept: «${recipeName}»\n\n` +
    `Öffne den Antrag:\n${requestUrl}\n\n` +
    `Bei Fragen: hallo@chuchipirat.ch`;

  await sendEmail(emailEnv, assignee.email, subject, htmlContent, textContent);
  console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${assignee.email} (${subject})`);
}

/**
 * Sendet Benachrichtigung an die Gegenpartei (neuer Kommentar).
 * Wenn Kommentator = Autor → Benachrichtigung an Assignee (und umgekehrt).
 */
async function handleNewComment(
  supabaseAdmin: SupabaseClient,
  emailEnv: EmailEnv,
  request: RequestData,
  commentId: string,
): Promise<void> {
  // Kommentar laden
  const {data: comment, error: commentError} = await supabaseAdmin
    .from("request_comments")
    .select("comment, created_by")
    .eq("id", commentId)
    .single();

  if (commentError || !comment) {
    console.log(`${FUNCTION_NAME}: Kommentar ${commentId} nicht gefunden`);
    return;
  }

  // Gegenpartei bestimmen
  const commenterUid = comment.created_by;
  let recipientUid: string | null = null;

  if (commenterUid === request.author_uid) {
    // Kommentator ist Autor → Benachrichtigung an Assignee
    recipientUid = request.assignee_uid;
  } else {
    // Kommentator ist Assignee/Leader → Benachrichtigung an Autor
    recipientUid = request.author_uid;
  }

  if (!recipientUid) {
    console.log(`${FUNCTION_NAME}: Kein Empfänger für Kommentar-Benachrichtigung`);
    return;
  }

  const recipient = await getUser(supabaseAdmin, recipientUid);
  if (!recipient?.email) return;

  const commenterName = await getUserDisplayName(supabaseAdmin, commenterUid);

  // Kommentartext auf 500 Zeichen kürzen
  const commentText =
    comment.comment.length > 500
      ? comment.comment.slice(0, 497) + "…"
      : comment.comment;

  // Antrags-Link zusammenbauen
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch").replace(
    /\/$/,
    "",
  );
  const requestUrl = `${siteUrl}/requestoverview/${request.id}`;

  const subject = `Neuer Kommentar zu Antrag #${request.number}`;
  const htmlContent = renderEmailTemplate("request-comment", {
    subject,
    recipientName: recipient.display_name || "Koch",
    commenterName,
    requestNumber: String(request.number),
    commentText,
    requestUrl,
  });

  const textContent =
    `Hallo ${recipient.display_name || "Koch"},\n\n` +
    `${commenterName} hat einen Kommentar zu Antrag #${request.number} hinterlassen:\n\n` +
    `${comment.comment}\n\n` +
    `Öffne den Antrag, um zu antworten:\n${requestUrl}\n\n` +
    `Bei Fragen: hallo@chuchipirat.ch`;

  await sendEmail(emailEnv, recipient.email, subject, htmlContent, textContent);
  console.log(`${FUNCTION_NAME}: E-Mail gesendet an ${recipient.email} (${subject})`);
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Lädt Benutzerdaten (E-Mail + Anzeigename) anhand der Auth-UID.
 */
async function getUser(
  supabaseAdmin: SupabaseClient,
  authUid: string,
): Promise<UserData | null> {
  const {data, error} = await supabaseAdmin
    .from("users")
    .select("email, display_name")
    .eq("id", authUid)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserData;
}

/**
 * Lädt nur den Anzeigenamen eines Benutzers.
 */
async function getUserDisplayName(
  supabaseAdmin: SupabaseClient,
  authUid: string,
): Promise<string> {
  const user = await getUser(supabaseAdmin, authUid);
  return user?.display_name || "Jemand";
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
    return errorResponse(FUNCTION_NAME, "Method not allowed", 405);
  }

  // Umgebungsvariablen lesen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const emailEnv = readEmailEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(FUNCTION_NAME, "Missing Supabase config", 500);
  }

  if (!isEmailConfigured(emailEnv)) {
    return errorResponse(
      FUNCTION_NAME,
      "Neither BREVO_API_KEY nor SMTP_HOST is set",
      500,
    );
  }

  // Payload lesen
  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse(FUNCTION_NAME, "Invalid JSON body", 400);
  }

  const {scenario, requestId, commentId} = payload;
  if (!scenario || !requestId) {
    return errorResponse(FUNCTION_NAME, "Missing scenario or requestId", 400);
  }

  // Admin-Client erstellen
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  try {
    // Antrag laden
    const {data: request, error: requestError} = await supabaseAdmin
      .from("requests")
      .select("id, number, status, request_type, author_uid, assignee_uid, request_object_uid")
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      return errorResponse(FUNCTION_NAME, `Request ${requestId} not found`, 404);
    }

    // Rezeptname laden
    const {data: recipe} = await supabaseAdmin
      .from("recipes")
      .select("name")
      .eq("id", request.request_object_uid)
      .maybeSingle();

    const recipeName = recipe?.name ?? "Unbekanntes Rezept";

    // Szenario ausführen
    switch (scenario) {
      case "newRecipePublishRequest":
      case "newReportErrorRequest":
        await handleNewRequest(supabaseAdmin, emailEnv, request as RequestData, recipeName);
        break;

      case "requestRecipePublished":
        await handleRecipePublished(supabaseAdmin, emailEnv, request as RequestData, recipeName);
        break;

      case "requestReportErrorFixed":
        await handleReportErrorFixed(supabaseAdmin, emailEnv, request as RequestData, recipeName);
        break;

      case "requestDeclined":
        await handleDeclined(supabaseAdmin, emailEnv, request as RequestData, recipeName);
        break;

      case "requestBackToReview":
        await handleBackToReview(supabaseAdmin, emailEnv, request as RequestData, recipeName);
        break;

      case "requestNewComment":
        if (!commentId) {
          return errorResponse(FUNCTION_NAME, "Missing commentId for comment notification", 400);
        }
        await handleNewComment(supabaseAdmin, emailEnv, request as RequestData, commentId);
        break;

      default:
        return errorResponse(FUNCTION_NAME, `Unknown scenario: ${scenario}`, 400);
    }

    return successResponse();
  } catch (err) {
    console.error(`${FUNCTION_NAME} error:`, err);
    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  }
});
