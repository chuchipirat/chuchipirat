/**
 * Alle Event-Namen für das Umami-Analytics-Tracking.
 *
 * Jeder Schlüssel ist ein eindeutiger Bezeichner, der Wert entspricht
 * dem Event-Namen, der an Umami gesendet wird.
 */
export const AnalyticsEvent = {
  // ── Auth ──
  EMAIL_CHANGED: "email_changed",
  PASSWORD_CHANGED: "password_changed",
  PASSWORD_RESET: "password_reset",

  // ── Rezepte ──
  RECIPE_CREATED: "recipe_created",
  RECIPE_DELETED: "recipe_deleted",
  RECIPE_VARIANT_CREATED: "recipe_variant_created",
  RECIPE_SCALED: "recipe_scaled",
  RECIPE_SEARCH: "recipe_search",
  RECIPE_DRAWER_SEARCH: "recipe_drawer_search",
  RECIPE_FILTER_APPLIED: "recipe_filter_applied",
  RECIPE_COMMENT_CREATED: "recipe_comment_created",
  RECIPE_RATING_SET: "recipe_rating_set",
  RECIPE_TYPE_CHANGED: "recipe_type_changed",

  // ── Events (Lager/Kurse) ──
  EVENT_CREATED: "event_created",
  EVENT_COPIED: "event_copied",
  EVENT_DELETED: "event_deleted",
  EVENT_COOK_ADDED: "event_cook_added",
  EVENT_COOK_REMOVED: "event_cook_removed",
  GROUP_CONFIG_CHANGED: "group_config_changed",

  // ── Menuplan ──
  MENUPLAN_CREATED: "menuplan_created",
  MENUPLAN_RECIPE_ADDED: "menuplan_recipe_added",
  MENUPLAN_RECIPE_PORTIONS_EDITED: "menuplan_recipe_portions_edited",
  MENUPLAN_RECIPE_REMOVED: "menuplan_recipe_removed",
  MENUPLAN_RECIPE_MOVED: "menuplan_recipe_moved",
  MENUPLAN_PRODUCT_ADDED: "menuplan_product_added",
  MENUPLAN_PRODUCT_PLAN_EDITED: "menuplan_product_plan_edited",
  MENUPLAN_PRODUCT_REMOVED: "menuplan_product_removed",
  MENUPLAN_MATERIAL_ADDED: "menuplan_material_added",
  MENUPLAN_MATERIAL_PLAN_EDITED: "menuplan_material_plan_edited",
  MENUPLAN_MATERIAL_REMOVED: "menuplan_material_removed",
  MENUPLAN_MEAL_TYPE_ADDED: "menuplan_meal_type_added",
  MENUPLAN_MEAL_TYPE_EDITED: "menuplan_meal_type_edited",
  MENUPLAN_MEAL_TYPE_DELETED: "menuplan_meal_type_deleted",
  MENUPLAN_CONSISTENCY_ERRORS: "menuplan_consistency_errors",
  MENUPLAN_CONSISTENCY_OK: "menuplan_consistency_ok",

  // ── Listen ──
  USED_RECIPES_GENERATED: "used_recipes_generated",
  USED_RECIPES_REFRESHED: "used_recipes_refreshed",
  USED_RECIPES_DELETED: "used_recipes_deleted",
  SHOPPING_LIST_GENERATED: "shopping_list_generated",
  SHOPPING_LIST_REFRESHED: "shopping_list_refreshed",
  SHOPPING_LIST_DELETED: "shopping_list_deleted",
  MATERIAL_LIST_GENERATED: "material_list_generated",
  MATERIAL_LIST_REFRESHED: "material_list_refreshed",
  MATERIAL_LIST_DELETED: "material_list_deleted",

  // ── Masterdata ──
  PRODUCT_CREATED: "product_created",
  PRODUCT_DELETED: "product_deleted",
  MATERIAL_CREATED: "material_created",
  MATERIAL_DELETED: "material_deleted",
  UNIT_DELETED: "unit_deleted",

  // ── Medien ──
  PICTURE_UPLOADED: "picture_uploaded",
  PICTURE_DELETED: "picture_deleted",

  // ── PDF / Export ──
  PDF_EXPORTED: "pdf_exported",

  // ── Spenden-Funnel ──
  DONATION_PAGE_VIEWED: "donation_page_viewed",
  DONATION_SKIPPED: "donation_skipped",
  DONATION_STARTED: "donation_started",
  DONATION_AMOUNT_CHANGED: "donation_amount_changed",
  DONATION_MESSAGE_ADDED: "donation_message_added",
  DONATION_COMPLETED: "donation_completed",
  DONATION_CANCELLED: "donation_cancelled",
  DONATION_RECEIPT_DOWNLOADED: "donation_receipt_downloaded",

  // ── Fehler / UX ──
  SEARCH_NO_RESULTS: "search_no_results",

  // ── System ──
  SYSTEM_LOG_OUT_ALL_USERS: "system_log_out_all_users",
} as const;

/** Typ für einen gültigen Analytics-Event-Namen. */
export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];
