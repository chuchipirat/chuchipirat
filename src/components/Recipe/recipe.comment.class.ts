import * as Sentry from "@sentry/react";
import {UserShort} from "../User/user.class";
import Firebase from "../Firebase/firebase.class";
import {SortOrder} from "../Firebase/Db/firebase.db.super.class";

import * as DEFAULT_VALUES from "../../constants/defaultValues";
import {AuthUser} from "../Firebase/Authentication/authUser.class";

interface GetComments {
  firebase: Firebase;
  recipeUid: string;
  lastComment?: RecipeComment;
}
interface Save {
  firebase: Firebase;
  recipeUid: string;
  comment: string;
  authUser: AuthUser;
}

// ===================================================================== */
/**
 * Rezept Kommentar
 * @ User - User
 * @ createdAt - Zeitpunkt an dem der Kommentar erfasst wurde
 * @ comment - Kommentar
 */
export class RecipeComment {
  uid: string;
  user: UserShort;
  createdAt: Date;
  comment: string;
  constructor() {
    this.uid = "";
    this.user = {userUid: "", displayName: "", pictureSrc: "", motto: ""};
    this.createdAt = new Date(0);
    this.comment = "";
  }
  // ===================================================================== */
  /**
   * Kommentare holen
   * @param param0 - Objekt mit Firebase-Referenz und Rezept-UID
   */
  static async getComments({firebase, recipeUid, lastComment}: GetComments) {
    let comments: RecipeComment[] = [];

    await firebase.recipePublic.comment
      .readCollection<RecipeComment>({
        uids: [recipeUid],
        orderBy: {field: "createdAt", sortOrder: SortOrder.desc},
        limit: DEFAULT_VALUES.COMMENT_DISPLAY,
        startAfter: lastComment?.createdAt,
      })
      .then((result) => {
        comments = result as RecipeComment[];
      })
      .catch((error) => {
        Sentry.captureException(error);
        throw error;
      });
    return comments;
  }
  // ===================================================================== */
  /**
   * Kommentar speichern
   * @param param0 Objekt mit Firebase-Referenz, Rezept-UID, den neuen
   *        Kommentar und dem authUser
   */
  static async save({firebase, recipeUid, comment, authUser}: Save) {
    console.info(recipeUid);
    // Umbiegen auf Objekt
    let newComment: RecipeComment = {
      uid: "",
      comment: comment,
      createdAt: new Date(),
      user: {
        userUid: authUser.uid,
        displayName: authUser.publicProfile.displayName,
        pictureSrc: authUser.publicProfile.pictureSrc,
        motto: authUser.publicProfile.motto,
      },
    };

    firebase.recipePublic.comment
      .create<RecipeComment>({
        value: newComment,
        authUser: authUser,
      })
      .then((result) => {
        newComment = result.value;
      })
      .catch((error) => {
        Sentry.captureException(error);
        throw error;
      });
    return newComment;
  }
}
export default RecipeComment;
