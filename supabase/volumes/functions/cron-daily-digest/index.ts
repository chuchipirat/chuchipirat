/**
 * Edge Function: cron-daily-digest
 *
 * Tägliche Aktivitäts-Zusammenfassung für Community Leaders.
 * Fragt Quelltabellen direkt ab (Benutzer, Anlässe, Rezepte, Produkte,
 * Material) und zeigt aktionsbasierte Feed-Zähler sowie offene Anträge.
 *
 * Zeitplan: Täglich um 02:15 UTC (03:15/04:15 Zürich)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 *   BREVO_API_KEY (Produktion) oder SMTP_HOST/SMTP_PORT (lokal)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient, type SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  sendEmail,
  readEmailEnv,
  isEmailConfigured,
  errorResponse,
  successResponse,
  escapeHtml,
} from "../_shared/emailService.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";
import {
  authenticateCronRequest,
  startCronJob,
  completeCronJob,
  failCronJob,
  sentryCheckIn,
} from "../_shared/cronJobHelper.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";

/* =====================================================================
// Konstanten & Label-Maps
// ===================================================================== */

const JOB_NAME = "cron-daily-digest";

/** Deutsche Labels für Diät-Typen. */
const DIET_LABELS: Record<string, string> = {
  meat: "Fleisch",
  vegetarian: "Vegetarisch",
  vegan: "Vegan",
};

/** Deutsche Labels für Allergen-Typen. */
const ALLERGEN_LABELS: Record<string, string> = {
  lactose: "Laktose",
  gluten: "Gluten",
};

/** Deutsche Labels für Material-Typen. */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  none: "—",
  consumable: "Verbrauchsmaterial",
  usage: "Gebrauchsmaterial",
};

/** Deutsche Labels für Rezept-Typen. */
const RECIPE_TYPE_LABELS: Record<string, string> = {
  public: "Öffentlich",
  private: "Privat",
  variant: "Variante",
};

/** Deutsche Labels für aktionsbasierte Feed-Typen. */
const ACTION_FEED_LABELS: Record<string, string> = {
  recipeRated: "Rezept-Bewertungen",
  recipeCommented: "Rezept-Kommentare",
  eventCookAdded: "Köche hinzugefügt",
  shoppingListCreated: "Einkaufslisten erstellt",
  profilePictureChanged: "Profilbilder geändert",
};

/** Feed-Typen, die als aktionsbasierte Zähler angezeigt werden. */
const ACTION_FEED_TYPES = Object.keys(ACTION_FEED_LABELS);

/* =====================================================================
// Typen
// ===================================================================== */

/** Neuer Benutzer für die Digest-Anzeige. */
type NewUser = {display_name: string};

/** Neuer Anlass mit berechneter Dauer. */
type NewEvent = {name: string; location: string; days: number};

/** Neues Rezept für die Digest-Anzeige. */
type NewRecipe = {name: string; recipe_type: string};

/** Neues Produkt mit Abteilungs- und Zusatzinformationen. */
type NewProduct = {
  name: string;
  department_name: string;
  shopping_unit: string;
  allergens: string[];
  diet: string;
};

/** Neues Material für die Digest-Anzeige. */
type NewMaterial = {name: string; type: string};

/** Rezept-Kommentar für die Digest-Anzeige. */
type NewRecipeComment = {
  recipe_name: string;
  comment: string;
  author_name: string;
};

/** Bestätigte Spende für die Digest-Anzeige. */
type ConfirmedDonation = {
  donor_name: string;
  amount: string;
  event_name: string;
  message: string;
};

/** Aggregierter Zähler pro aktionsbasiertem Feed-Typ. */
type ActionCount = {feed_type: string; count: number};

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Berechnet den gestrigen Tag in der Zeitzone Europe/Zurich.
 * Gibt Start- und End-Zeitpunkt als ISO-Strings zurück.
 *
 * @returns Objekt mit `yesterdayStart` und `yesterdayEnd` als ISO-Strings,
 *          sowie `yesterdayLabel` als formatiertes Datum (z.B. "20.03.2026").
 */
function getYesterdayBoundaries(): {
  yesterdayStart: string;
  yesterdayEnd: string;
  yesterdayLabel: string;
} {
  // Aktuelles Datum in Zürich ermitteln
  const now = new Date();
  const zurichFormatter = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Gestern in Zürich = heute minus 1 Tag
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const parts = zurichFormatter.formatToParts(yesterday);
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  const day = parts.find((part) => part.type === "day")!.value;

  // UTC-Grenzen für den Zürcher Tag berechnen
  // Zürich ist UTC+1 (Winter) oder UTC+2 (Sommer)
  const yesterdayStart = `${year}-${month}-${day}T00:00:00+01:00`;
  const yesterdayEnd = `${year}-${month}-${day}T23:59:59.999+01:00`;
  const yesterdayLabel = `${day}.${month}.${year}`;

  return {yesterdayStart, yesterdayEnd, yesterdayLabel};
}

/**
 * Berechnet die Dauer eines Anlasses in Tagen aus den Datumsbereichen.
 * Nimmt den frühesten Start und den spätesten End-Termin und berechnet
 * die Differenz in Tagen (inklusiv beider Endpunkte).
 *
 * @param dates Array von Datumsbereichen mit date_from und date_to.
 * @returns Dauer in Tagen, oder 0 wenn keine Daten vorhanden.
 */
function calculateEventDays(
  dates: {date_from: string; date_to: string}[]
): number {
  if (dates.length === 0) return 0;
  const fromTimestamps = dates.map(
    (dateRange) => new Date(dateRange.date_from).getTime()
  );
  const toTimestamps = dates.map(
    (dateRange) => new Date(dateRange.date_to).getTime()
  );
  const earliest = Math.min(...fromTimestamps);
  const latest = Math.max(...toTimestamps);
  // +1 weil Start- und Endtag beide zählen
  return Math.round((latest - earliest) / (24 * 60 * 60 * 1000)) + 1;
}

/* =====================================================================
// HTML-Hilfsfunktionen
// ===================================================================== */

/**
 * Erzeugt eine Sektionsüberschrift im Digest-Stil.
 *
 * @param title Überschriftstext.
 * @returns HTML-String der Überschrift.
 */
function sectionHeading(title: string): string {
  return `<p style="margin: 24px 0 8px; font-size: 16px; color: #212121; line-height: 1.5; font-weight: 600;">${escapeHtml(title)}</p>`;
}

/**
 * Erzeugt den öffnenden HTML-Tag einer Digest-Tabelle mit Kopfzeile.
 *
 * @param headers Array der Spaltenüberschriften.
 * @returns HTML-String mit Tabellen-Start und Header-Zeile.
 */
function tableOpen(headers: string[]): string {
  const headerCells = headers
    .map(
      (header) =>
        `<th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #757575; font-weight: 600;">${escapeHtml(header)}</th>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
    style="margin: 8px 0 16px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
    <tr style="background-color: #f5f5f5;">${headerCells}</tr>`;
}

/** Schliesst eine Digest-Tabelle. */
const TABLE_CLOSE = `</table>`;

/**
 * Erzeugt eine einzelne Tabellenzelle im Digest-Stil.
 *
 * @param text Zelleninhalt (wird HTML-escaped).
 * @param options Optionale Stil-Angaben (Ausrichtung, Schriftstärke).
 * @returns HTML-String der Zelle.
 */
function td(
  text: string,
  options?: {align?: string; fontWeight?: string}
): string {
  const align = options?.align ?? "left";
  const fontWeight = options?.fontWeight ?? "normal";
  return `<td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 14px; color: #424242; text-align: ${align}; font-weight: ${fontWeight};">${escapeHtml(text)}</td>`;
}

/* =====================================================================
// Daten-Abfragen
// ===================================================================== */

/**
 * Lädt alle gestern erstellten Benutzer.
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array neuer Benutzer.
 */
async function fetchNewUsers(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewUser[]> {
  const {data, error} = await client
    .from("users")
    .select("display_name")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("display_name");

  if (error) throw new Error(`Benutzer-Abfrage fehlgeschlagen: ${error.message}`);
  return (data ?? []) as NewUser[];
}

/**
 * Lädt alle gestern erstellten Anlässe mit berechneter Dauer.
 * Nutzt eine verschachtelte Abfrage über die Beziehung events → event_dates.
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array neuer Anlässe mit Name, Ort und Dauer.
 */
async function fetchNewEvents(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewEvent[]> {
  const {data, error} = await client
    .from("events")
    .select("name, location, event_dates(date_from, date_to)")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("name");

  if (error) throw new Error(`Anlass-Abfrage fehlgeschlagen: ${error.message}`);

  return (data ?? []).map((event) => ({
    name: event.name as string,
    location: (event.location as string) || "—",
    days: calculateEventDays(
      (event.event_dates as {date_from: string; date_to: string}[]) ?? []
    ),
  }));
}

/**
 * Lädt alle gestern erstellten Rezepte.
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array neuer Rezepte mit Name und Typ.
 */
async function fetchNewRecipes(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewRecipe[]> {
  const {data, error} = await client
    .from("recipes")
    .select("name, recipe_type")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("name");

  if (error) throw new Error(`Rezept-Abfrage fehlgeschlagen: ${error.message}`);
  return (data ?? []) as NewRecipe[];
}

/**
 * Lädt alle gestern erstellten Produkte mit Abteilungsnamen.
 * Nutzt eine verschachtelte Abfrage über die Beziehung products → departments.
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array neuer Produkte mit Detailinformationen.
 */
async function fetchNewProducts(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewProduct[]> {
  const {data, error} = await client
    .from("products")
    .select("name, shopping_unit, allergens, diet, departments(name)")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("name");

  if (error) throw new Error(`Produkt-Abfrage fehlgeschlagen: ${error.message}`);

  return (data ?? []).map((product) => ({
    name: product.name as string,
    department_name:
      (product.departments as {name: string} | null)?.name ?? "—",
    shopping_unit: (product.shopping_unit as string) ?? "—",
    allergens: (product.allergens as string[]) ?? [],
    diet: product.diet as string,
  }));
}

/**
 * Lädt alle gestern erstellten Materialien.
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array neuer Materialien mit Name und Typ.
 */
async function fetchNewMaterials(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewMaterial[]> {
  const {data, error} = await client
    .from("materials")
    .select("name, type")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("name");

  if (error) throw new Error(`Material-Abfrage fehlgeschlagen: ${error.message}`);
  return (data ?? []) as NewMaterial[];
}

/**
 * Lädt alle gestern erstellten Rezept-Kommentare mit Rezeptname und Autor.
 * Nutzt verschachtelte Abfragen über die Beziehungen recipe_comments → recipes
 * und recipe_comments → users (via created_by FK).
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Array von Rezept-Kommentaren mit Rezeptname, Kommentartext und Autor.
 */
async function fetchRecipeComments(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<NewRecipeComment[]> {
  // Kommentare via View laden (enthält Rezeptname und Autorname)
  const {data, error} = await client
    .from("recipe_comments_view")
    .select("comment, created_at, recipe_name, user_display_name")
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", {ascending: true});

  if (error) throw new Error(`Rezept-Kommentar-Abfrage fehlgeschlagen: ${error.message}`);

  return (data ?? []).map((row: {recipe_name: string | null; comment: string; user_display_name: string | null}) => ({
    recipe_name: row.recipe_name ?? "—",
    comment: row.comment ?? "",
    author_name: row.user_display_name ?? "Unbekannt",
  }));
}

/**
 * Lädt aktionsbasierte Feed-Zähler des Vortags.
 * Berücksichtigt nur Feed-Typen, die nicht durch direkte Quell-Tabellen
 * abgedeckt werden (z.B. Bewertungen, Kommentare, Koch-Zuweisungen).
 *
 * @param client Supabase-Client mit Service-Role-Key.
 * @param start ISO-String des Tagesstarts.
 * @param end ISO-String des Tagesendes.
 * @returns Aggregierte Zähler pro Feed-Typ, absteigend sortiert.
 */
async function fetchActionFeedCounts(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<ActionCount[]> {
  const {data, error} = await client
    .from("feeds")
    .select("feed_type")
    .in("feed_type", ACTION_FEED_TYPES)
    .gte("created_at", start)
    .lte("created_at", end);

  if (error) throw new Error(`Feed-Abfrage fehlgeschlagen: ${error.message}`);

  // Manuell aggregieren (Supabase JS-Client hat kein GROUP BY)
  const countMap = new Map<string, number>();
  for (const feed of data ?? []) {
    const feedType = feed.feed_type as string;
    countMap.set(feedType, (countMap.get(feedType) ?? 0) + 1);
  }

  return Array.from(countMap.entries())
    .map(([feed_type, count]) => ({feed_type, count}))
    .sort((sortA, sortB) => sortB.count - sortA.count);
}

/**
 * Lädt alle gestern bestätigten Spenden aus der donations_view.
 */
async function fetchConfirmedDonations(
  client: SupabaseClient,
  start: string,
  end: string
): Promise<ConfirmedDonation[]> {
  const {data, error} = await client
    .from("donations_view")
    .select("donor_display_name, amount_in_cents, event_name, donor_message")
    .eq("status", "confirmed")
    .gte("paid_at", start)
    .lte("paid_at", end)
    .order("paid_at", {ascending: true});

  if (error) throw new Error(`Spenden-Abfrage fehlgeschlagen: ${error.message}`);

  return (data ?? []).map((row: {donor_display_name: string | null; amount_in_cents: number; event_name: string | null; donor_message: string | null}) => ({
    donor_name: row.donor_display_name ?? "Anonym",
    amount: `CHF ${(row.amount_in_cents / 100).toFixed(2)}`,
    event_name: row.event_name ?? "—",
    message: row.donor_message ?? "",
  }));
}

/* =====================================================================
// Sektions-Builder
// ===================================================================== */

/**
 * Baut die HTML-Sektion für neue Benutzer (Aufzählungsliste).
 *
 * @param users Array neuer Benutzer.
 * @returns HTML-String oder leerer String wenn keine Benutzer.
 */
function buildUsersSection(users: NewUser[]): string {
  if (users.length === 0) return "";

  const items = users
    .map(
      (user) =>
        `<li style="margin: 4px 0; font-size: 14px; color: #424242;">${escapeHtml(user.display_name)}</li>`
    )
    .join("\n");

  return (
    sectionHeading("Neue Benutzer") +
    `<ul style="margin: 8px 0 16px; padding-left: 24px;">${items}</ul>`
  );
}

/**
 * Baut die HTML-Sektion für neue Anlässe (Tabelle).
 *
 * @param events Array neuer Anlässe.
 * @returns HTML-String oder leerer String wenn keine Anlässe.
 */
function buildEventsSection(events: NewEvent[]): string {
  if (events.length === 0) return "";

  const rows = events
    .map(
      (event) =>
        `<tr>${td(event.name)}${td(event.location)}${td(event.days > 0 ? String(event.days) : "—", {align: "right"})}</tr>`
    )
    .join("\n");

  return (
    sectionHeading("Neue Anlässe") +
    tableOpen(["Name", "Ort", "Dauer (Tage)"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut die HTML-Sektion für neue Rezepte (Tabelle).
 *
 * @param recipes Array neuer Rezepte.
 * @returns HTML-String oder leerer String wenn keine Rezepte.
 */
function buildRecipesSection(recipes: NewRecipe[]): string {
  if (recipes.length === 0) return "";

  const rows = recipes
    .map(
      (recipe) =>
        `<tr>${td(recipe.name)}${td(RECIPE_TYPE_LABELS[recipe.recipe_type] ?? recipe.recipe_type)}</tr>`
    )
    .join("\n");

  return (
    sectionHeading("Neue Rezepte") +
    tableOpen(["Rezept", "Typ"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Kürzt einen Text auf die angegebene Maximallänge und fügt "…" an.
 *
 * @param text Der zu kürzende Text.
 * @param maxLength Maximale Zeichenlänge (Standard: 120).
 * @returns Gekürzter Text oder Originaltext wenn kürzer als maxLength.
 */
function truncate(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

/**
 * Baut die HTML-Sektion für Rezept-Kommentare (Tabelle mit 3 Spalten).
 * Lange Kommentare werden auf 120 Zeichen gekürzt.
 *
 * @param comments Array der Rezept-Kommentare.
 * @returns HTML-String oder leerer String wenn keine Kommentare.
 */
function buildRecipeCommentsSection(comments: NewRecipeComment[]): string {
  if (comments.length === 0) return "";

  const rows = comments
    .map(
      (comment) =>
        `<tr>${td(comment.recipe_name)}${td(truncate(comment.comment))}${td(comment.author_name)}</tr>`
    )
    .join("\n");

  return (
    sectionHeading("Rezept-Kommentare") +
    tableOpen(["Rezept", "Kommentar", "Autor"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut die HTML-Sektion für neue Produkte (Tabelle mit 5 Spalten).
 *
 * @param products Array neuer Produkte.
 * @returns HTML-String oder leerer String wenn keine Produkte.
 */
function buildProductsSection(products: NewProduct[]): string {
  if (products.length === 0) return "";

  const rows = products
    .map((product) => {
      const allergenText =
        product.allergens.length > 0
          ? product.allergens
              .map((allergen) => ALLERGEN_LABELS[allergen] ?? allergen)
              .join(", ")
          : "—";
      const dietText = DIET_LABELS[product.diet] ?? product.diet;

      return `<tr>${td(product.name)}${td(product.department_name)}${td(product.shopping_unit)}${td(allergenText)}${td(dietText)}</tr>`;
    })
    .join("\n");

  return (
    sectionHeading("Neue Produkte") +
    tableOpen(["Produkt", "Abteilung", "Einheit", "Allergene", "Diät"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut die HTML-Sektion für neues Material (Tabelle).
 *
 * @param materials Array neuer Materialien.
 * @returns HTML-String oder leerer String wenn keine Materialien.
 */
function buildMaterialsSection(materials: NewMaterial[]): string {
  if (materials.length === 0) return "";

  const rows = materials
    .map(
      (material) =>
        `<tr>${td(material.name)}${td(MATERIAL_TYPE_LABELS[material.type] ?? material.type)}</tr>`
    )
    .join("\n");

  return (
    sectionHeading("Neues Material") +
    tableOpen(["Material", "Typ"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut die HTML-Sektion für aktionsbasierte Feed-Zähler (kompakte Tabelle).
 *
 * @param counts Aggregierte Zähler pro Feed-Typ.
 * @returns HTML-String oder leerer String wenn keine Aktivität.
 */
function buildActionCountsSection(counts: ActionCount[]): string {
  if (counts.length === 0) return "";

  const rows = counts
    .map((row) => {
      const label = ACTION_FEED_LABELS[row.feed_type] ?? row.feed_type;
      return `<tr>${td(label)}${td(String(row.count), {align: "right", fontWeight: "600"})}</tr>`;
    })
    .join("\n");

  return (
    sectionHeading("Weitere Aktivitäten") +
    tableOpen(["Aktivität", "Anzahl"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut den HTML-Block für bestätigte Spenden.
 */
function buildDonationsSection(donations: ConfirmedDonation[]): string {
  if (donations.length === 0) return "";

  const totalCents = donations.reduce((sum, donation) => {
    const cents = Math.round(parseFloat(donation.amount.replace("CHF ", "")) * 100);
    return sum + cents;
  }, 0);
  const totalFormatted = `CHF ${(totalCents / 100).toFixed(2)}`;

  const rows = donations
    .map((donation) => {
      const messageCol = donation.message ? ` — «${donation.message}»` : "";
      return `<tr>${td(donation.donor_name + messageCol)}${td(donation.amount, {align: "right", fontWeight: "600"})}${td(donation.event_name)}</tr>`;
    })
    .join("\n");

  return (
    sectionHeading(`Spenden (${donations.length}, Total: ${totalFormatted})`) +
    tableOpen(["Spender*in", "Betrag", "Anlass"]) +
    rows +
    TABLE_CLOSE
  );
}

/**
 * Baut den HTML-Block für offene Anträge.
 *
 * @param openRequests Array offener Anträge aus requests_view.
 * @returns HTML-String oder leerer String wenn keine offenen Anträge.
 */
function buildOpenRequestsHtml(
  openRequests: {
    id: string;
    number: number;
    recipe_name: string | null;
    created_at: string;
    author_display_name: string | null;
  }[]
): string {
  if (openRequests.length === 0) return "";

  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch").replace(/\/$/, "");

  const rows = openRequests
    .map((request) => {
      const requestUrl = `${siteUrl}/requestoverview/${request.id}`;
      const recipeName = request.recipe_name ?? "–";
      const author = request.author_display_name ?? "Unbekannt";
      // Explizite Formatierung mit führenden Nullen (de-CH ohne Optionen = kein Nullpadding)
      const date = new Date(request.created_at).toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      // Verlinktes Nummernfeld — td() nicht verwendbar da escapeHtml() Anchor-Tags entfernt
      const numberCell =
        `<td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 14px;">` +
        `<a href="${requestUrl}" style="color: #1565c0; text-decoration: none; font-weight: 500;">#${request.number}</a></td>`;
      return `<tr>
        ${numberCell}
        ${td(recipeName)}
        ${td(author)}
        <td style="padding: 8px 12px; border-bottom: 1px solid #e0e0e0; font-size: 14px; color: #757575;">${date}</td>
      </tr>`;
    })
    .join("\n");

  return (
    sectionHeading("Offene Anträge (nicht zugewiesen)") +
    tableOpen(["Nr.", "Rezept", "Autor", "Erstellt"]) +
    rows +
    TABLE_CLOSE
  );
}

/* =====================================================================
// Plaintext-Builder
// ===================================================================== */

/**
 * Baut den Plaintext-Inhalt der Digest-E-Mail für Clients ohne HTML-Unterstützung.
 *
 * @param recipientName Name des Empfängers.
 * @param yesterdayLabel Formatiertes Datum.
 * @param users Neue Benutzer.
 * @param events Neue Anlässe.
 * @param recipes Neue Rezepte.
 * @param recipeComments Rezept-Kommentare des Vortags.
 * @param products Neue Produkte.
 * @param materials Neue Materialien.
 * @param actionCounts Aktionsbasierte Feed-Zähler.
 * @param openRequestCount Anzahl offener Anträge.
 * @returns Plaintext-String.
 */
function buildPlaintext(
  recipientName: string,
  yesterdayLabel: string,
  users: NewUser[],
  events: NewEvent[],
  recipes: NewRecipe[],
  recipeComments: NewRecipeComment[],
  products: NewProduct[],
  materials: NewMaterial[],
  actionCounts: ActionCount[],
  donations: ConfirmedDonation[],
  openRequestCount: number
): string {
  const sections: string[] = [];

  if (users.length > 0) {
    sections.push(
      "Neue Benutzer:\n" +
        users.map((user) => `  • ${user.display_name}`).join("\n")
    );
  }

  if (events.length > 0) {
    sections.push(
      "Neue Anlässe:\n" +
        events
          .map(
            (event) =>
              `  • ${event.name} (${event.location}, ${event.days > 0 ? `${event.days} Tage` : "—"})`
          )
          .join("\n")
    );
  }

  if (recipes.length > 0) {
    sections.push(
      "Neue Rezepte:\n" +
        recipes
          .map(
            (recipe) =>
              `  • ${recipe.name} (${RECIPE_TYPE_LABELS[recipe.recipe_type] ?? recipe.recipe_type})`
          )
          .join("\n")
    );
  }

  if (recipeComments.length > 0) {
    sections.push(
      "Rezept-Kommentare:\n" +
        recipeComments
          .map(
            (recipeComment) =>
              `  • ${recipeComment.recipe_name} — ${recipeComment.author_name}: ${truncate(recipeComment.comment)}`
          )
          .join("\n")
    );
  }

  if (products.length > 0) {
    sections.push(
      "Neue Produkte:\n" +
        products
          .map(
            (product) =>
              `  • ${product.name} — ${product.department_name}, ${product.shopping_unit}`
          )
          .join("\n")
    );
  }

  if (materials.length > 0) {
    sections.push(
      "Neues Material:\n" +
        materials
          .map(
            (material) =>
              `  • ${material.name} (${MATERIAL_TYPE_LABELS[material.type] ?? material.type})`
          )
          .join("\n")
    );
  }

  if (actionCounts.length > 0) {
    sections.push(
      "Weitere Aktivitäten:\n" +
        actionCounts
          .map(
            (row) =>
              `  • ${ACTION_FEED_LABELS[row.feed_type] ?? row.feed_type}: ${row.count}`
          )
          .join("\n")
    );
  }

  if (donations.length > 0) {
    sections.push(
      "Spenden:\n" +
        donations
          .map(
            (donation) =>
              `  • ${donation.donor_name}: ${donation.amount}` +
              (donation.event_name !== "—" ? ` (${donation.event_name})` : "") +
              (donation.message ? ` — «${donation.message}»` : "")
          )
          .join("\n")
    );
  }

  if (openRequestCount > 0) {
    sections.push(`Offene Anträge: ${openRequestCount}`);
  }

  return (
    `Hallo ${recipientName},\n\n` +
    `Aktivitäts-Zusammenfassung für den ${yesterdayLabel}:\n\n` +
    sections.join("\n\n") +
    `\n\nBei Fragen: hallo@chuchipirat.ch`
  );
}

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  // ── Authentifizierung: service_role oder Admin-Benutzer ──
  const authError = await authenticateCronRequest(req, JOB_NAME);
  if (authError) return authError;

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const emailEnv = readEmailEnv();

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(JOB_NAME, "Missing Supabase config", 500);
  }

  if (!isEmailConfigured(emailEnv)) {
    return errorResponse(JOB_NAME, "No email transport configured", 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Cron-Job-Logging und Sentry starten
  let logId: string | undefined;
  let checkInId: string | null = null;

  try {
    logId = await startCronJob(supabaseAdmin, JOB_NAME);
    checkInId = await sentryCheckIn(JOB_NAME, "in_progress");

    // Zeitgrenzen für gestern berechnen
    const {yesterdayStart, yesterdayEnd, yesterdayLabel} =
      getYesterdayBoundaries();

    // 1. Alle Datenquellen parallel abfragen
    const [newUsers, newEvents, newRecipes, recipeComments, newProducts, newMaterials, actionCounts, confirmedDonations, requestResult] =
      await Promise.all([
        fetchNewUsers(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchNewEvents(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchNewRecipes(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchRecipeComments(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchNewProducts(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchNewMaterials(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchActionFeedCounts(supabaseAdmin, yesterdayStart, yesterdayEnd),
        fetchConfirmedDonations(supabaseAdmin, yesterdayStart, yesterdayEnd),
        supabaseAdmin
          .from("requests_view")
          .select("id, number, recipe_name, created_at, author_display_name")
          .in("status", ["created", "inReview"])
          .is("assignee_uid", null)
          .order("created_at", {ascending: false}),
      ]);

    // Offene Anträge auswerten
    if (requestResult.error) {
      throw new Error(`Antrags-Abfrage fehlgeschlagen: ${requestResult.error.message}`);
    }
    const openRequests = (requestResult.data ?? []) as {
      id: string;
      number: number;
      recipe_name: string | null;
      created_at: string;
      author_display_name: string | null;
    }[];

    // 2. Prüfen ob es etwas zu senden gibt
    const totalActionFeeds = actionCounts.reduce(
      (sum, row) => sum + row.count,
      0
    );
    const hasCreationActivity =
      newUsers.length > 0 ||
      newEvents.length > 0 ||
      newRecipes.length > 0 ||
      recipeComments.length > 0 ||
      newProducts.length > 0 ||
      newMaterials.length > 0 ||
      confirmedDonations.length > 0;
    const hasContent =
      hasCreationActivity || totalActionFeeds > 0 || openRequests.length > 0;

    if (!hasContent) {
      console.log(
        `${JOB_NAME}: Keine Aktivität gestern und keine offenen Anträge — übersprungen`
      );
      await completeCronJob(supabaseAdmin, logId, 0, {
        skipped: true,
        reason: "no_activity",
      });
      await sentryCheckIn(JOB_NAME, "ok", checkInId);
      return successResponse({skipped: true, reason: "no_activity"});
    }

    // 3. Community Leaders laden
    const {data: leaders, error: leaderError} = await supabaseAdmin
      .from("users")
      .select("email, display_name")
      .contains("roles", ["communityLeader"]);

    if (leaderError)
      throw new Error(
        `Leader-Abfrage fehlgeschlagen: ${leaderError.message}`
      );

    if (!leaders || leaders.length === 0) {
      console.log(
        `${JOB_NAME}: Keine Community Leaders gefunden — übersprungen`
      );
      await completeCronJob(supabaseAdmin, logId, 0, {
        skipped: true,
        reason: "no_leaders",
      });
      await sentryCheckIn(JOB_NAME, "ok", checkInId);
      return successResponse({skipped: true, reason: "no_leaders"});
    }

    // 4. HTML-Sektionen bauen
    const contentSections =
      buildUsersSection(newUsers) +
      buildEventsSection(newEvents) +
      buildRecipesSection(newRecipes) +
      buildRecipeCommentsSection(recipeComments) +
      buildProductsSection(newProducts) +
      buildMaterialsSection(newMaterials) +
      buildActionCountsSection(actionCounts) +
      buildDonationsSection(confirmedDonations);

    const openRequestsHtml = buildOpenRequestsHtml(openRequests);

    // 5. E-Mails senden
    let sentCount = 0;
    const errors: string[] = [];

    for (const leader of leaders) {
      if (!leader.email) continue;

      try {
        const recipientName = leader.display_name || "Community Leader";
        const subject = `chuchipirat Digest — ${yesterdayLabel}`;

        const htmlContent = renderEmailTemplate(
          "daily-digest",
          {subject, recipientName, date: yesterdayLabel},
          {contentSections, openRequestsBlock: openRequestsHtml}
        );

        const textContent = buildPlaintext(
          recipientName,
          yesterdayLabel,
          newUsers,
          newEvents,
          newRecipes,
          recipeComments,
          newProducts,
          newMaterials,
          actionCounts,
          confirmedDonations,
          openRequests.length
        );

        await sendEmail(
          emailEnv,
          leader.email,
          subject,
          htmlContent,
          textContent
        );
        sentCount++;
      } catch (err) {
        errors.push(`${leader.email}: ${String(err)}`);
      }
    }

    // 6. Zusammenfassung der Zähler für Logging
    const categoryCounts = {
      newUsers: newUsers.length,
      newEvents: newEvents.length,
      newRecipes: newRecipes.length,
      recipeComments: recipeComments.length,
      newProducts: newProducts.length,
      newMaterials: newMaterials.length,
      confirmedDonations: confirmedDonations.length,
      actionFeeds: totalActionFeeds,
      openRequests: openRequests.length,
    };

    // 7. mail_log Eintrag
    await supabaseAdmin.from("mail_log").insert({
      recipients: leaders.map((leader) => leader.email).filter(Boolean),
      recipient_type: "role",
      subject: `chuchipirat Digest — ${yesterdayLabel}`,
      body: contentSections + openRequestsHtml,
      template_name: "daily-digest",
      delivery_status: errors.length === 0 ? "success" : "error",
      error_message: errors.length > 0 ? errors.join("; ") : null,
      details: {
        date: yesterdayLabel,
        ...categoryCounts,
        sentTo: sentCount,
      },
    });

    // 8. Job abschliessen
    await completeCronJob(supabaseAdmin, logId, sentCount, {
      date: yesterdayLabel,
      ...categoryCounts,
      emailsSent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: Digest gesendet an ${sentCount}/${leaders.length} Leaders ` +
        `(${newUsers.length} Benutzer, ${newEvents.length} Anlässe, ` +
        `${newRecipes.length} Rezepte, ${recipeComments.length} Kommentare, ` +
        `${newProducts.length} Produkte, ${newMaterials.length} Material, ` +
        `${confirmedDonations.length} Spenden, ` +
        `${totalActionFeeds} Feeds, ${openRequests.length} offene Anträge)`
    );

    return successResponse({
      emailsSent: sentCount,
      ...categoryCounts,
    });
  } catch (err) {
    console.error(`${JOB_NAME} error:`, err);
    await sentryCaptureError(err, JOB_NAME);

    if (logId) {
      await failCronJob(supabaseAdmin, logId, String(err));
    }
    await sentryCheckIn(JOB_NAME, "error", checkInId);

    return new Response(
      JSON.stringify({error: "Ein interner Fehler ist aufgetreten."}),
      {
        status: 500,
        headers: {...CORS_HEADERS, "Content-Type": "application/json"},
      },
    );
  }
});
