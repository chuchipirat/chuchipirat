/**
 * Enum-zu-Label-Tabellen und Übersetzungsmaps (Rollen, Status,
 * Feed-Texte, Firebase-/Supabase-Meldungen, Dimensionen usw.).
 */
import {MATERIAL_TYPE_CONSUMABLE, MATERIAL_TYPE_USAGE} from "./masterdata";
import {LACTOSE, GLUTEN} from "./recipes";

/* =====================================================================
// Rollen
// ===================================================================== */
export const ROLE_TYPES = {
  admin: "Admin",
  basic: "Basic",
  communityLeader: "Community-Leader*in",
};

/* =====================================================================
// Workflow / Status
// ===================================================================== */
export const STATUS_NAME = {
  created: "Neu",
  inReview: "wird geprüft",
  backToAuthor: "zurück zu Autor*in",
  declined: "Abgelehnt",
  done: "Erledigt",
};
export const REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE = {
  created: {
    inReview: {description: "Antrag prüfen"},
    declined: {description: "Antrag ablehnen"},
    backToAuthor: {description: "Zurück zu Author*in"},
    done: {description: "Rezept publizieren"},
  },
  backToAuthor: {
    inReview: {description: "Erneut zur Prüfung einreichen"},
  },
};
export const REQUEST_STATUS_TRANSITION_REPORT_ERROR = {
  created: {
    inReview: {description: "Meldung prüfen"},
    declined: {description: "Meldung ablehnen"},
    backToAuthor: {description: "Zurück zu Author*in"},
    done: {description: "Rezept wurde korrigiert"},
  },
  backToAuthor: {
    inReview: {description: "Erneut zur Prüfung einreichen"},
  },
};
export const REQUEST_TYPE = {
  recipePublish: "Rezeptveröffentlichung",
  reportError: "Fehler im Rezept",
};

/* =====================================================================
// Empfänger-Typ (Mail-Konsole)
// ===================================================================== */
export const RECIPIENT_TYPE = {
  0: "keine",
  1: "E-Mail-Adresse",
  2: "User-UID",
  3: "Rolle",
};

/* =====================================================================
// Menü- und Diät-Typen
// ===================================================================== */
export const MENU_TYPES = {
  1: "Hauptgang",
  2: "Beilage",
  3: "Vorspeise",
  4: "Dessert",
  5: "Frühstück",
  6: "Znüni/Zvieri",
  7: "Apero",
  8: "Getränk",
};
export const DIET_TYPES = {
  1: "Fleisch",
  2: "vegetarisch",
  3: "vegan",
};
// Wenn der Key fehlt, ist es...
export const ALLERGENS_FREE_TYPES = {
  1: "Laktosefrei",
  2: "Glutenfrei",
};
export const ALLERGEN_KEY_TEXT = {
  0: "-",
  1: LACTOSE,
  2: GLUTEN,
};
export const MATERIAL_TYPE_KEY_TEXT = {
  0: "-",
  1: MATERIAL_TYPE_CONSUMABLE,
  2: MATERIAL_TYPE_USAGE,
};

/* =====================================================================
// Dimensionen
// ===================================================================== */
export const UNIT_DIMENSION = {
  VOL: "Volumen",
  MAS: "Masse",
  DLS: "Dimensionslos",
};

/* =====================================================================
// Feed-Texte
// ===================================================================== */
export const FEED_TITLE = {
  USER_CREATED: "Arrr.... Neue*r Kapitän*in",
  RECIPE_CREATED: "Neues Rezept",
  RECIPE_PUBLISHED: "Neues Rezept",
  RECIPE_RATED: "Neues Rating für",
  RECIPE_COMMENTED: "Neuer Kommentar",
  EVENT_CREATED: "Gut geplant ist halb gewonnen",
  EVENT_COOK_ADDED: "Küchen-Crew vergrössert",
  SHOPPINGLIST_CREATED: "Einkaufen ist angesagt",
  PROFILE_PICTURE_CHANGED: "Neues Profilbild",
  DONATION_CONFIRMED: "Spende eingegangen",
};

export const FEED_TEXT = {
  USER_CREATED: "ist neu mit an Bord.",
  RECIPE_PUBLISHED: (textElements: string[]) =>
    `hat das Rezept «${textElements[0]}» der Community beigesteuert.`,

  RECIPE_CREATED: (textElements: string[]) =>
    `hat das Rezept «${textElements[0]}» erfasst.`,

  RECIPE_RATED: (textElements: string[]) => {
    switch (textElements[1]) {
      case "5":
        return `findet es superlecker und vergibt ${textElements[1]} ⭐️.`;
      case "4":
      case "4.5":
        return `mag es und vergibt ${textElements[1]} ⭐️.`;
      case "3":
      case "3.5":
        return `ist mässig überzeugt und vergibt ${textElements[1]} ⭐️.`;
      case "2":
      case "2.5":
        return `mag lieber was anderes und vergibt ${textElements[1]} ⭐️.`;
      case "1":
      case "1.5":
      case "0.5":
        return `mag das anscheinend nicht und vergibt ${textElements[1]} ⭐️`;
      case "0":
        return "hat seine Meinung geändert und das Rating entfernt.";
      default:
        return "?";
    }
  },
  EVENT_CREATED: (textElements: string[]) =>
    `hat den Anlass «${textElements[0]}» erstellt.`,
  EVENT_COOK_ADDED: (textElements: string[]) =>
    `wurde in das Team «${textElements[0]}» aufgenommen.`,
  SHOPPINGLIST_CREATED: (textElements: string[]) => {
    const item = textElements[0] ?? "";
    const remaining = parseInt(textElements[1] ?? "0", 10);
    if (remaining > 0) {
      return `schnappt sich ${item} und ${remaining} weitere Schätze.`;
    }
    return `schnappt sich ${item}.`;
  },
  RECIPE_COMMENTED: (textElements: string[]) =>
    `hat das Rezept «${textElements[0]}» kommentiert.`,
  PROFILE_PICTURE_CHANGED: "hat ein neues Profilbild hochgeladen.",
  DONATION_CONFIRMED: (textElements: string[]) => {
    const amountCents = parseInt(textElements[0] ?? "0", 10);
    const amountFormatted = (amountCents / 100).toFixed(2);
    return `hat CHF ${amountFormatted} gespendet. Merci 1000!`;
  },
};

/* =====================================================================
// Statistik-Captions
// ===================================================================== */
export const HOME_STATS_CAPTIONS = {
  noUsers: "Köche",
  noEvents: "Anlässe",
  noIngredients: "Lebensmittel",
  noRecipesPublic: "öffentliche Rezepte",
  noRecipesPrivate: "private Rezepte",
  noRecipesVariants: "Anlassvarianten Rezepte",
  noShoppingLists: "Generierte Einkaufslisten",
  noParticipants: "bekochte Personen",
  noPortions: "Geplante Portionen",
  noPlanedDays: "Geplante Anlasstage",
  noMaterials: "Materialien",
  noMaterialLists: "Generierte Materiallisten",
};

/* =====================================================================
// Firebase-Meldungen (englische Originalmeldungen → Deutsch)
// ===================================================================== */
export const FIREBASE_MESSAGES = {
  WEAK_PASSWORD:
    "Passwort zu schwach: Passwort muss aus mindestens 6 Zeichen bestehen.",
  INVALID_EMAIL: "E-Mail Adresse ungültig",
  EMAIL_ALREADY_IN_USE:
    "Es besteht bereits ein Account mit dieser Adresse. Setze das Passwort zurück, falls du dich nicht mehr daran erinnerst.",
  USER_DISABLED: "User ist deaktiviert. Melde dich unter hallo@chuchipirat.ch",
  USER_NOT_FOUND: "Ungültige Anmeldedaten.",
  WRONG_PASSWORD: "Ungültige Anmeldedaten.",
  ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL:
    "Es existiert bereits ein Konto mit der gleichen E-Mail-Adresse. Versuche dich anzumelden und verknüpfe die Social-Media-Accounts in deinem Profil miteinander.",
  PERMISSION_DENIED: "Dir fehlt die nötige Berechtigung, für diese Aktion.",
  INVALID_ACTION_CODE:
    "Der Verifizierungscode ist ungültig. Dies kann passieren, wenn der Code fehlerhaft ist, abläuft oder bereits verwendet wurde.",
  UNAVAILABLE:
    "Bist du bist Offline? Damit du die Daten bearbeiten und lesen kannst, musst du mit dem Internet verbunden sein.",
  REQUIRES_RECENT_LOGIN:
    "Dieser Vorgang ist sensibel und erfordert eine aktuelle Authentifizierung. Melde dich erneut an, bevor du diese Anfrage erneut versuchst.",
  TOO_MANY_REQUESTS:
    "Der Zugriff auf dieses Konto wurde aufgrund vieler fehlgeschlagener Anmeldeversuche vorübergehend deaktiviert. Du kannst das Konto entsperren, indem du dein Passwort zurücksetzt, oder du kannst es später erneut versuchen.",
  INTERNAL_ERROR:
    "Fehler bei der Anmeldung: Die eingegebenen Anmeldeinformationen sind ungültig.",
};

/* =====================================================================
// Supabase-Fehlermeldungen (englische Originalmeldungen → Deutsch)
// ===================================================================== */
/**
 * Übersetzungstabelle für Supabase Auth-Fehlermeldungen.
 * Schlüssel ist die originale englische Meldung (error.message),
 * Wert die deutsche Übersetzung.
 */
export const SUPABASE_MESSAGES: Record<string, string> = {
  "New password should be different from the old password.":
    "Das neue Passwort muss sich vom alten Passwort unterscheiden.",
  "Invalid login credentials": "Ungültige Anmeldedaten.",
  "User already registered":
    "Es besteht bereits ein Account mit dieser Adresse.",
  "Password should be at least 6 characters.":
    "Passwort zu schwach: Passwort muss aus mindestens 6 Zeichen bestehen.",
  // "For security purposes, you can only request this after X seconds."
  // → Wird pattern-basiert in SupabaseMessageHandler übersetzt (variable Sekundenanzahl)
  "Email not confirmed": "E-Mail-Adresse noch nicht bestätigt.",
};

/* =====================================================================
// Footer
// ===================================================================== */
export const FOOTER_CREATED_WITH_JOY_OF_LIFE = {
  part1: "Für und mit ",
  linkText: "Lebensfreu(n)de",
  part2: " entwickelt",
};
export const FOOTER_QUESTIONS_SUGGESTIONS = {
  TITLE: "Fragen und Anregungen?",
  CONTACTHERE: "Melde dich hier:",
  OR_LOOK_HERE: "oder schau im",
  HELPCENTER: "Helpcenter",
  OVER: "vorbei",
};
