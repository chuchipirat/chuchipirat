import {
  FEED_TITLE as TEXT_FEED_TITLE,
  FEED_TEXT as TEXT_FEED_TEXT,
} from "../../constants/text";

/**
 * Feed-Typ — beschreibt die Art des Aktivitätseintrags.
 *
 * Jeder Typ hat eine zugehörige Titel- und Textgenerierung
 * in {@link getFeedTitle} und {@link getFeedText}.
 */
export enum FeedType {
  userCreated = "userCreated",
  recipePublished = "recipePublished",
  recipeRated = "recipeRated",
  recipeCommented = "recipeCommented",
  eventCreated = "eventCreated",
  eventCookAdded = "eventCookAdded",
  shoppingListCreated = "shoppingListCreated",
  productCreated = "productCreated",
  materialCreated = "materialCreated",
  profilePictureChanged = "profilePictureChanged",
}

// ===================================================================== */
/**
 * Erzeugt den Titel eines Feed-Eintrags anhand des Feed-Typs.
 *
 * @param feedType - Der Feed-Typ
 * @param textElements - Textbausteine, die in den Titel eingefügt werden
 * @returns Titel des Feed-Eintrags
 */
export function getFeedTitle(
  feedType: FeedType,
  textElements: string[] = [],
): string {
  switch (feedType) {
    case FeedType.userCreated:
      return TEXT_FEED_TITLE.USER_CREATED;
    case FeedType.recipePublished:
      return TEXT_FEED_TITLE.RECIPE_PUBLISHED;
    case FeedType.recipeRated:
      return `${TEXT_FEED_TITLE.RECIPE_RATED} ${textElements[0] ?? ""}`;
    case FeedType.recipeCommented:
      return TEXT_FEED_TITLE.RECIPE_COMMENTED;
    case FeedType.eventCreated:
      return TEXT_FEED_TITLE.EVENT_CREATED;
    case FeedType.eventCookAdded:
      return TEXT_FEED_TITLE.EVENT_COOK_ADDED;
    case FeedType.shoppingListCreated:
      return TEXT_FEED_TITLE.SHOPPINGLIST_CREATED;
    case FeedType.profilePictureChanged:
      return TEXT_FEED_TITLE.PROFILE_PICTURE_CHANGED;
    case FeedType.productCreated:
    case FeedType.materialCreated:
      return textElements[0] ?? "";
    default:
      return "?";
  }
}

// ===================================================================== */
/**
 * Erzeugt den Text eines Feed-Eintrags anhand des Feed-Typs.
 *
 * @param feedType - Der Feed-Typ
 * @param textElements - Textbausteine, die in den Text eingefügt werden
 * @returns Zusammengebauter Text für den Feed-Eintrag
 */
export function getFeedText(
  feedType: FeedType,
  textElements: string[] = [],
): string {
  switch (feedType) {
    case FeedType.userCreated:
      return TEXT_FEED_TEXT.USER_CREATED;
    case FeedType.recipePublished:
      return TEXT_FEED_TEXT.RECIPE_PUBLISHED(textElements);
    case FeedType.recipeRated:
      return TEXT_FEED_TEXT.RECIPE_RATED(textElements);
    case FeedType.recipeCommented:
      return TEXT_FEED_TEXT.RECIPE_COMMENTED(textElements);
    case FeedType.eventCreated:
      return TEXT_FEED_TEXT.EVENT_CREATED(textElements);
    case FeedType.eventCookAdded:
      return TEXT_FEED_TEXT.EVENT_COOK_ADDED(textElements);
    case FeedType.shoppingListCreated:
      return TEXT_FEED_TEXT.SHOPPINGLIST_CREATED(textElements);
    case FeedType.profilePictureChanged:
      return TEXT_FEED_TEXT.PROFILE_PICTURE_CHANGED;
    default:
      return "?";
  }
}
