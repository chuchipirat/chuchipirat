import * as Sentry from "@sentry/react";
import Firebase from "../Firebase/firebase.class";
import {AuthUser} from "../Firebase/Authentication/authUser.class";
import {FeedType} from "../Shared/feed.class";
import Recipe from "./recipe.class";
import {Role} from "../../constants/roles";
import DatabaseService from "../Database/DatabaseService";

// Re-export aus recipe.types.ts für Abwärtskompatibilität
export type {Rating} from "./recipe.types";
interface GetRatingOfUser {
  firebase: Firebase;
  recipeUid: string;
  userUid: string;
}
interface UpdateUserRating {
  firebase: Firebase;
  database: DatabaseService;
  recipe: Recipe;
  newRating: number;
  authUser: AuthUser;
}

// ===================================================================== */
/**
 * Rezept Rating
 * @ avgRating - Durchschnittliche Bewertung
 * @ noRating - Anzahl abgegebene Bewertungen
 * @ myRaing - Meine Bewertung
 */
export class RecipeRating {
  rating: number;
  // ===================================================================== */
  /**
   * Constructor
   */
  constructor() {
    this.rating = 0;
  }
  // ===================================================================== */
  /**
   * Bewertung eines Users für ein bestimmtes Rezept holen
   * @param param0 - Objekt mit Firebase-Referenz, Rezept-UID, und User-UID
   * @returns Bewertung des angegebenen Users
   */
  static async getUserRating({firebase, recipeUid, userUid}: GetRatingOfUser) {
    let recipeUserRating = 0;

    await firebase.recipePublic.rating
      .read<RecipeRating>({uids: [recipeUid, userUid]})
      .then((result) => {
        recipeUserRating = result.rating;
      })
      .catch(() => {
        // Kein Dokument vorhanden
        recipeUserRating = 0;
      });

    return recipeUserRating;
  }
  // ===================================================================== */
  /**
   * Bewertung eines Users speichern/aktualisieren. Das Dokument wird
   * angelegt/überschrieben.
   * @param param0 - Objekt mit Firebase-Referenz, Database, Rezept, Rating und User
   */
  static async updateUserRating({
    firebase,
    database,
    recipe,
    newRating,
    authUser,
  }: UpdateUserRating) {
    const userRating: RecipeRating = {rating: newRating};

    await firebase.recipePublic.rating
      .update({
        uids: [recipe.uid, authUser.uid],
        value: userRating,
        authUser: authUser,
      })
      .catch((error) => {
        Sentry.captureException(error);
        throw error;
      });

    // Feed-Eintrag erstellen
    database.feeds
      .insertFeed(
        {
          feedType: FeedType.recipeRated,
          visibility: Role.basic,
          sourceObjectType: "recipe",
          sourceObjectUid: recipe.uid,
          sourceObjectData: {rating: newRating},
        },
        authUser,
      )
      .catch((error) => {
        Sentry.captureException(error, {
          extra: {context: "Feed-Eintrag konnte nicht erstellt werden"},
        });
      });
  }
}
export default RecipeRating;
