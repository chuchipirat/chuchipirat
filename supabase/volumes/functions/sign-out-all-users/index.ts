/**
 * Edge Function: sign-out-all-users
 *
 * Meldet alle nicht-Admin-Benutzer ab, indem ihre Auth-Sessions
 * und Refresh-Tokens in der Datenbank gelöscht werden.
 *
 * Die Access-Tokens (JWTs) bleiben bis zum Ablauf gültig (JWT_EXPIRY,
 * Standard 3600s = 1 Stunde), können danach aber nicht mehr erneuert werden.
 * Beim nächsten Token-Refresh wird der Benutzer zur Anmeldung aufgefordert.
 *
 * Erfordert Authentifizierung: Nur Admins dürfen diese Funktion aufrufen.
 *
 * Voraussetzung: Die SQL-Funktion `revoke_user_sessions(UUID[])` muss in der
 * Datenbank existieren (siehe Migration).
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

/** CORS-Header für alle Antworten */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-client-info, apikey",
};

serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: corsHeaders});
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({error: "Method not allowed"}), {
      status: 405,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response(
      JSON.stringify({error: "Server configuration error"}),
      {status: 500, headers: {...corsHeaders, "Content-Type": "application/json"}}
    );
  }

  // JWT aus Authorization-Header extrahieren und Benutzer-ID ermitteln
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({error: "Missing authorization header"}), {
      status: 401,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }

  let callerAuthUid: string;
  try {
    const token = authHeader.replace("Bearer ", "");
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) throw new Error("JWT_SECRET not configured");

    const secretKey = new TextEncoder().encode(jwtSecret);
    const {payload} = await jose.jwtVerify(token, secretKey);
    callerAuthUid = payload.sub as string;
  } catch (err) {
    console.error("JWT verification failed:", err);
    return new Response(JSON.stringify({error: "Invalid token"}), {
      status: 401,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }

  // Admin-Client erstellen (Service Role umgeht RLS)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Prüfen ob der Aufrufer Admin ist
  const {data: callerUser, error: callerError} = await supabaseAdmin
    .from("users")
    .select("roles")
    .eq("id", callerAuthUid)
    .single();

  if (callerError || !callerUser) {
    return new Response(JSON.stringify({error: "User not found"}), {
      status: 403,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }

  const isAdmin = (callerUser.roles as string[]).includes("admin");
  if (!isAdmin) {
    return new Response(JSON.stringify({error: "Forbidden: admin role required"}), {
      status: 403,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }

  try {
    // Alle Nicht-Admin-Benutzer laden
    const {data: users, error: usersError} = await supabaseAdmin
      .from("users")
      .select("id, roles");

    if (usersError) throw usersError;

    const nonAdminAuthUids: string[] = [];
    const signedOutUsers: string[] = [];

    for (const user of users ?? []) {
      if ((user.roles as string[]).includes("admin")) continue;
      nonAdminAuthUids.push(user.id);
      signedOutUsers.push(user.id);
    }

    if (nonAdminAuthUids.length > 0) {
      // Sessions und Refresh-Tokens via SQL-Funktion löschen.
      // Die Funktion löscht Einträge in auth.sessions und auth.refresh_tokens.
      const {error: rpcError} = await supabaseAdmin.rpc(
        "revoke_user_sessions",
        {target_user_ids: nonAdminAuthUids}
      );

      if (rpcError) {
        throw new Error(
          `revoke_user_sessions fehlgeschlagen: ${rpcError.message}. ` +
            "Stelle sicher, dass die SQL-Funktion existiert."
        );
      }
    }

    console.log(`${signedOutUsers.length} Benutzer abgemeldet`);

    return new Response(
      JSON.stringify({
        success: true,
        signedOutUsers,
        count: signedOutUsers.length,
      }),
      {
        status: 200,
        headers: {...corsHeaders, "Content-Type": "application/json"},
      }
    );
  } catch (err) {
    console.error("sign-out-all-users error:", err);
    return new Response(JSON.stringify({error: String(err)}), {
      status: 500,
      headers: {...corsHeaders, "Content-Type": "application/json"},
    });
  }
});
