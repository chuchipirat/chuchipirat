import * as DEFAULT_VALUES from "../../constants/defaultValues";
import {ChangeRecord} from "./global.interface";
import Firebase from "../Firebase/firebase.class";
import {AuthUser} from "../Firebase/Authentication/authUser.class";
import Role from "../../constants/roles";

import {
  SortOrder,
  Operator,
  Where,
} from "../Firebase/Db/firebase.db.super.class";
import {
  FEED_TITLE as TEXT_FEED_TITLE,
  FEED_TEXT as TEXT_FEED_TEXT,
  ERROR_PARAMETER_NOT_PASSED as TEXT_ERROR_PARAMETER_NOT_PASSED,
} from "../../constants/text";

//ATTENTION: Muss auch im Cloud-Function File nachgeführt werden.
export enum FeedType {
  userCreated = "userCreated",
  recipeCreated = "recipeCreated",
  recipePublished = "recipePublished",
  eventCreated = "eventCreated",
  eventCookAdded = "eventCookAdded",
  menuplanCreated = "menuplanCreated",
  shoppingListCreated = "shoppingListCreated",
  recipeRated = "recipeRated",
  materialCreated = "materialCreated",
  productCreated = "productCreated",
  none = "none",
}

interface CreateFeedEntry {
  firebase: Firebase;
  authUser: AuthUser;
  feedType: FeedType;
  feedVisibility: Role;
  objectUid: string;
  objectName: string;
  objectPictureSrc?: string;
  objectType?: string;
  textElements?: string[];
  objectUserUid?: string;
  objectUserDisplayName?: string;
  objectUserPictureSrc?: string;
  additionalData?: {[key: string]: number | string | boolean};
}
interface GetNewestFeeds {
  firebase: Firebase;
  limitTo: number;
  visibility: Role | "*";
  feedType?: FeedType;
  daysOffset?: number;
}
interface DeleteFeedsDaysOffset {
  firebase: Firebase;
  daysOffset: number;
  authUser: AuthUser;
  callbackDone: (noOfDeletedDocuments: number) => void;
}
interface DeleteFeed {
  feedUid: Feed["uid"];
  firebase: Firebase;
}
interface GetFeedsLog {
  firebase: Firebase;
}
interface GetFeed {
  firebase: Firebase;
  feedUid: Feed["uid"];
}

export interface FeedLogEntry {
  uid: string;
  created: ChangeRecord;
  text: Feed["text"];
  title: Feed["text"];
  type: Feed["type"];
  visibility: Feed["visibility"];
}
// ==================================================================== */
/**
 * Feed Klasse
 * Regelt und Strukturiert den Feed -> verbindung zur DB
 * @param uid - UID des Feedeintrag
 * @param title - Titel des Feedeintrages
 * @param text - Text im Feedeintrag
 * @param type - Feed Typ
 * @param visibility - Sichtbarkeit für User (anhand der Rolle)
 * @param sourceObject - Objekt, welches den Feedeintrag auslöst (Rezept, Event, User, etc)
 * @param user - Informationen zum User, der im Feedeintrag angezeigt werden (muss nicht zwingend)
 *               mit der Person, die den Eintrag anlegt, übereinstmmen
 * @param created - Informationen zur Anlage des Feedeintrag (Datum, User)
 */
export default class Feed {
  uid: string;
  title: string;
  text: string;
  type: FeedType;
  visibility: Role;
  sourceObject: {
    uid: string;
    name: string;
    pictureSrc: string;
    type?: string;
    additionalData?: {[key: string]: number | string | boolean};
  };
  user: {uid: string; displayName: string; pictureSrc: string};
  created: ChangeRecord;

  /* ====================================================================
  // Constructor
  / ==================================================================== */
  constructor() {
    this.uid = "";
    this.title = "";
    this.text = "";
    this.type = FeedType.none;
    this.visibility = Role.basic;
    this.sourceObject = {uid: "", name: "", pictureSrc: ""};
    this.user = {uid: "", displayName: "", pictureSrc: ""};
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }

  /* ====================================================================
  // Feed Eintrag erzeugen
  / ==================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  /**
   * Schnittstelle für createFeedEntry (im Objektformat!)
   *
   * @param firebase - Object zur DB
   * @param authUser AuthUser -  Die Person die den Feedeintrag erstellt;
   * @param feedType Typ des Feeds (siehe enum FeedType);
   * @param objectUid UID des Objektes, dass zum Feed gehört;
   * @param objectName optional Name des Objektes, dass zum Feed gehört
   * @param objectPictureSrc optional Bildquelle zum Objekt, dass zum Feed gehört
   * @param textElements optional Testbausteine (Array), die in den Text eingefügt werden
   * @param objectUserUid optional UID der Person, die im Feed erwähnt wird (nicht AuthUser)
   * @param objectUserDisplayName optional Anzeigename der Person, die im Feed erwähnt wird
   * @param objectUserPictureSrc optional Bildquelle, der Person, die im Feed erwähnt wird.
   */
  static async createFeedEntry({
    firebase,
    authUser,
    feedType,
    feedVisibility = Role.basic,
    objectUid,
    objectName,
    objectPictureSrc = "",
    objectType = "",
    textElements = [""],
    objectUserUid = "",
    objectUserDisplayName = "",
    objectUserPictureSrc = "",
    additionalData,
  }: CreateFeedEntry) {
    const feed: Feed = {
      uid: "",
      title: Feed.getTitle(feedType, textElements),
      text: Feed.getText(feedType, textElements),
      type: feedType,
      visibility: feedVisibility,
      sourceObject: {
        uid: objectUid,
        name: objectName,
        pictureSrc: objectPictureSrc,
        type: objectType,
      },
      user: objectUserUid
        ? {
            uid: objectUserUid,
            displayName: objectUserDisplayName,
            pictureSrc: objectUserPictureSrc,
          }
        : {
            uid: authUser.uid,
            displayName: authUser.publicProfile.displayName,
            pictureSrc: authUser.publicProfile.pictureSrc,
          },
      created: {
        date: new Date(),
        fromUid: authUser.uid,
        fromDisplayName: authUser.publicProfile.displayName,
      },
    };

    if (additionalData) {
      feed.sourceObject.additionalData = additionalData;
    }

    await firebase.feed
      .create<Feed>({value: feed, authUser: authUser})
      .then((result) => {
        // Log nachführen, dass ein Feed erstellt wurde
        firebase.feed.log.update({
          uids: [],
          value: {
            [result.documentUid]: {
              created: feed.created,
              type: feed.type,
              visibility: feed.visibility,
              title: feed.title,
              text: feed.text,
            },
          },
          authUser: authUser,
        });
      });
  }
  /* =====================================================================
  // Neuste X Feed holen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static getNewestFeeds = async ({
    firebase,
    limitTo = DEFAULT_VALUES.FEEDS_DISPLAY,
    visibility = Role.basic,
    feedType,
    daysOffset,
  }: GetNewestFeeds) => {
    let feeds: Feed[] = [];
    let whereClause: Where[] = [];

    if (visibility != "*") {
      whereClause = [
        {
          field: "visibility",
          operator: Operator.EQ,
          value: visibility,
        },
      ] as Where[];
    }

    feedType &&
      whereClause.push({
        field: "type",
        operator: Operator.EQ,
        value: feedType,
      });

    if (daysOffset) {
      const offsetDate = new Date();
      offsetDate.setDate(offsetDate.getDate() - daysOffset);
      whereClause.push({
        field: "created.date",
        operator: Operator.GE,
        value: offsetDate,
      });
    }

    await firebase.feed
      .readCollection<Feed>({
        uids: [""],
        orderBy: {field: "created.date", sortOrder: SortOrder.desc},
        where: whereClause,
        limit: limitTo,
        ignoreCache: visibility == "*",
      })
      .then((result) => {
        feeds = result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return feeds;
  };
  // ===================================================================== */
  /**
   * Anhand des Feed Typs den Titel bestimmen
   * @param feedType - Was für eine Art von Feed ist es
   * @param textElement - Textbaustein, der im Titel eingebaut wird
   * @returns Titel des Feedeintrag
   */
  static getTitle(feedType: FeedType, textElement: string[]) {
    switch (feedType) {
      case FeedType.userCreated:
        return TEXT_FEED_TITLE.USER_CREATED;
      case FeedType.recipeCreated:
        return TEXT_FEED_TITLE.RECIPE_CREATED;
      case FeedType.recipePublished:
        return TEXT_FEED_TITLE.RECIPE_PUBLISHED;
      case FeedType.recipeRated:
        return `${TEXT_FEED_TITLE.RECIPE_RATED} ${textElement[0]}`;
      case FeedType.eventCreated:
        return TEXT_FEED_TITLE.EVENT_CREATED;
      case FeedType.eventCookAdded:
        return TEXT_FEED_TITLE.EVENT_COOK_ADDED;
      case FeedType.shoppingListCreated:
        return TEXT_FEED_TITLE.SHOPPINGLIST_CREATED;
      case FeedType.menuplanCreated:
        return TEXT_FEED_TITLE.MENUPLAN_CREATED;
      case FeedType.productCreated:
      case FeedType.materialCreated:
        return textElement[0];
      default:
        return "?";
    }
  }
  // ===================================================================== */
  /**
   * Anhand des Feed Typs den Text bestimmen
   * @param feedType - Was für eine Art von Feed ist es
   * @param textElement - Textbaustein, der im Titel eingebaut wird
   * @returns zusammengebauter Text für den Feedeintrag
   */
  static getText(feedType: FeedType, textElements: string[]) {
    switch (feedType) {
      case FeedType.userCreated:
        return TEXT_FEED_TEXT.USER_CREATED;
      // return "ist neu mit an Bord.";
      case FeedType.recipeCreated:
        return TEXT_FEED_TEXT.RECIPE_CREATED(textElements);
      case FeedType.recipePublished:
        return TEXT_FEED_TEXT.RECIPE_PUBLISHED(textElements);
      // return `hat das Rezept «${text}» erfasst.`;
      case FeedType.recipeRated:
        return TEXT_FEED_TEXT.RECIPE_RATED(textElements);
      case FeedType.eventCreated:
        return TEXT_FEED_TEXT.EVENT_CREATED(textElements);
      // return `hat den Anlass «${text}» erstellt.`;
      case FeedType.eventCookAdded:
        return TEXT_FEED_TEXT.EVENT_COOK_ADDED(textElements);
      // return `wurde in das Team «${text}» aufgenommen.`;
      case FeedType.menuplanCreated:
        return TEXT_FEED_TEXT.MENUPLAN_CREATED(textElements);
      // return `Plant gerade den ${text}`;
      case FeedType.shoppingListCreated:
        return TEXT_FEED_TEXT.SHOPPINGLIST_CREATED(textElements);
      // return `kauft ${text} ein.`;
      default:
        return "?";
    }
  }
  // ===================================================================== */
  /**
   * Cloud Function ausführen, die alle Feed-Einträge löscht, die älter
   * als X-Tage sind
   * @param object - Object mit Referenz zu Firebase, Anzahl Offset-Tage
   *                 AuthUser und Listener-Funktion, die die Löschung
   *                 überwacht.
   */
  static deleteFeedsDaysOffset = async ({
    firebase,
    daysOffset,
    authUser,
    callbackDone,
  }: DeleteFeedsDaysOffset) => {
    if (!firebase || !daysOffset) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }
    let unsubscribe: () => void;
    let documentId = "";

    await firebase.cloudFunction.deleteFeeds
      .triggerCloudFunction({
        values: {daysOffset: daysOffset},
        authUser: authUser,
      })
      .then(async (result) => {
        documentId = result;
      })
      .then(() => {
        // Melden wenn fertig
        const callback = (data) => {
          if (data?.done) {
            callbackDone(data.noOfDeletedDocuments);
            unsubscribe();
          }
        };
        const errorCallback = (error: Error) => {
          throw error;
        };

        firebase.cloudFunction.deleteFeeds
          .listen({
            uids: [documentId],
            callback: callback,
            errorCallback: errorCallback,
          })
          .then((result) => {
            unsubscribe = result;
          });
      })
      .catch((error) => {
        throw error;
      });
  };

  // ===================================================================== */
  /**
   * Einzelner Feed löschen
   * @param Object - Feed-UID und Firebase referenz
   */
  static deleteFeed = async ({firebase, feedUid}: DeleteFeed) => {
    if (!firebase || !feedUid) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }

    await firebase.feed
      .delete({uids: [feedUid]})
      .then(() => {
        // Log-Eintrag auch löschen!
        firebase.feed.log
          .deleteField({fieldName: feedUid, uids: []})
          .catch((error) => {
            console.error(error);
            throw error;
          });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Log aller Feeds holen
   * @param Object - Firebase
   */
  static getFeedsLog = async ({firebase}: GetFeedsLog) => {
    const feedLog: FeedLogEntry[] = [];

    if (!firebase) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }

    await firebase.feed.log
      .read({uids: []})
      .then((result) => {
        Object.entries(result).forEach(([key, value]) => {
          feedLog.push({uid: key, ...value});
        });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return feedLog;
  };
  // ===================================================================== */
  /**
   * Einzelner Feed holen
   * @param Object - Firebase und Feed-UID
   */
  static getFeed = async ({firebase, feedUid}: GetFeed) => {
    if (!firebase) {
      throw new Error(TEXT_ERROR_PARAMETER_NOT_PASSED);
    }

    return firebase.feed
      .read<Feed>({uids: [feedUid]})
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
}
