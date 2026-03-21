/**
 * Edge Function: notify-recipe-comment
 *
 * Sendet eine E-Mail-Benachrichtigung an den Rezeptautor, wenn ein neuer
 * Kommentar zu einem öffentlichen Rezept hinterlassen wurde.
 * Keine Benachrichtigung, wenn der Kommentator der Autor selbst ist.
 *
 * E-Mail-Versand:
 *   1. Primär: Brevo Transactional Email API (wenn BREVO_API_KEY gesetzt)
 *   2. Fallback: SMTP (für lokale Entwicklung mit MailPit)
 *
 * Erwartet einen POST-Body mit:
 *   { commentId: string, recipeId: string }
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   BREVO_API_KEY                          (Produktion)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_ADMIN_EMAIL, SMTP_SENDER_NAME
 *                                          (Fallback / lokale Entwicklung)
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

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Payload-Struktur des POST-Bodys.
 *
 * @param commentId - UUID des neuen Kommentars in recipe_comments
 * @param recipeId - UUID des kommentierten Rezepts in recipes
 */
interface NotifyPayload {
  commentId: string;
  recipeId: string;
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
    return errorResponse("notify-recipe-comment", "Method not allowed", 405);
  }

  // Umgebungsvariablen lesen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const emailEnv = readEmailEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(
      "notify-recipe-comment",
      "Server configuration error: missing Supabase config",
      500,
    );
  }

  if (!isEmailConfigured(emailEnv)) {
    return errorResponse(
      "notify-recipe-comment",
      "Server configuration error: neither BREVO_API_KEY nor SMTP_HOST is set",
      500,
    );
  }

  // Payload aus dem Request-Body lesen
  let payload: NotifyPayload;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("notify-recipe-comment", "Invalid JSON body", 400);
  }

  const {commentId, recipeId} = payload;
  if (!commentId || !recipeId) {
    return errorResponse(
      "notify-recipe-comment",
      "Missing commentId or recipeId",
      400,
    );
  }

  // Admin-Client erstellen (bypasses RLS für DB-Abfragen)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  try {
    // Kommentar laden (Text + Ersteller-UUID)
    const {data: comment, error: commentError} = await supabaseAdmin
      .from("recipe_comments")
      .select("comment, created_by")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return errorResponse(
        "notify-recipe-comment",
        `Comment ${commentId} not found`,
        404,
      );
    }

    // Rezept laden (Name + Ersteller-UUID)
    const {data: recipe, error: recipeError} = await supabaseAdmin
      .from("recipes")
      .select("name, created_by")
      .eq("id", recipeId)
      .single();

    if (recipeError || !recipe) {
      return errorResponse(
        "notify-recipe-comment",
        `Recipe ${recipeId} not found`,
        404,
      );
    }

    // Keine Benachrichtigung wenn Kommentator === Rezeptautor (Self-Comment)
    if (
      comment.created_by &&
      recipe.created_by &&
      comment.created_by === recipe.created_by
    ) {
      console.log(
        "notify-recipe-comment: Kommentator ist Rezeptautor — keine Benachrichtigung",
      );
      return successResponse({skipped: true, reason: "self-comment"});
    }

    // Rezeptautor aus public.users laden (E-Mail + Anzeigename)
    const {data: author, error: authorError} = await supabaseAdmin
      .from("users")
      .select("email, display_name")
      .eq("id", recipe.created_by)
      .single();

    if (authorError || !author?.email) {
      return errorResponse(
        "notify-recipe-comment",
        `Recipe author not found or has no email (recipe_id=${recipeId})`,
        404,
      );
    }

    // Anzeigenamen des Kommentators laden (best-effort)
    const {data: commenter} = await supabaseAdmin
      .from("users")
      .select("display_name")
      .eq("id", comment.created_by)
      .maybeSingle();

    const commenterName = commenter?.display_name || "Jemand";
    const authorDisplayName = author.display_name || "Koch";

    // Kommentartext auf 500 Zeichen kürzen
    const commentText =
      comment.comment.length > 500
        ? comment.comment.slice(0, 497) + "…"
        : comment.comment;

    // E-Mail-Inhalte aufbauen
    const subject = `Neuer Kommentar zu deinem Rezept «${recipe.name}»`;
    const htmlContent = renderEmailTemplate("recipe-comment", {
      subject,
      recipeName: recipe.name,
      commenterName,
      commentText,
      authorDisplayName,
    });
    const textContent =
      `Hallo ${authorDisplayName},\n\n` +
      `${commenterName} hat dein Rezept «${recipe.name}» kommentiert:\n\n` +
      `${comment.comment}\n\n` +
      `Melde dich auf chuchipirat.ch an, um zu antworten.\n\n` +
      `Bei Fragen: hallo@chuchipirat.ch`;

    // E-Mail senden
    await sendEmail(emailEnv, author.email, subject, htmlContent, textContent);
    const transport = emailEnv.brevoApiKey ? "Brevo" : "SMTP";
    console.log(
      `notify-recipe-comment [${transport}]: E-Mail gesendet an ${author.email} ` +
        `(Rezept: ${recipeId}, Kommentar: ${commentId})`,
    );

    return successResponse();
  } catch (err) {
    console.error("notify-recipe-comment error:", err);
    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...CORS_HEADERS, "Content-Type": "application/json"},
    });
  }
});
