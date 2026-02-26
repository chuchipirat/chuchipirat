import Utils from "../../Shared/utils.class";
import Feed, {FeedType} from "../../Shared/feed.class";
import Stats, {StatsField} from "../../Shared/stats.class";

import {
  IMAGES_SUFFIX,
  ImageSize,
} from "../../Firebase/Storage/firebase.storage.super.class";
import {
  ERROR_EVENT_NAME_CANT_BE_EMPTY as TEXT_ERROR_EVENT_NAME_CANT_BE_EMPTY,
  ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK as TEXT_ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK,
  ERROR_FROM_DATE_EMPTY as TEXT_ERROR_FROM_DATE_EMPTY,
  ERROR_TO_DATE_EMPTY as TEXT_ERROR_TO_DATE_EMPTY,
  ERROR_FORM_VALIDATION as TEXT_ERROR_FORM_VALIDATION,
  ERROR_FROM_DATE_BIGGER_THAN_TO_DATE as TEXT_ERROR_FROM_DATE_BIGGER_THAN_TO_DATE,
  ERROR_OVERLAPPING_DATES as TEXT_ERROR_OVERLAPPING_DATES,
} from "../../../constants/text";

import {
  AuthUser,
  AuthUserPublicProfile,
} from "../../Firebase/Authentication/authUser.class";
import Firebase from "../../Firebase/firebase.class";
import FirebaseAnalyticEvent from "../../../constants/firebaseEvent";
import UserPublicProfile, {
  UserPublicProfileStatsFields,
} from "../../User/user.public.profile.class";
import {
  Operator,
  SortOrder,
} from "../../Firebase/Db/firebase.db.super.class";
import Role from "../../../constants/roles";
import {ChangeRecord} from "../../Shared/global.interface";
import FieldValidationError, {
  FormValidationFieldError,
} from "../../Shared/fieldValidation.error.class";
import EventShort from "./eventShort.class";
import Menuplan, {Menue} from "../Menuplan/menuplan.class";
import ShoppingListCollection from "../ShoppingList/shoppingListCollection.class";
import Recipe from "../../Recipe/recipe.class";
import UsedRecipes from "../UsedRecipes/usedRecipes.class";
import MaterialList from "../MaterialList/materialList.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {getSupportUserUid} from "../../../constants/defaultValues";
import {CloudFunctionActivateSupportUserDocumentStructure} from "../../Firebase/Db/firebase.db.cloudfunction.activateSupportUser.class";
import {logEvent} from "firebase/analytics";

/**
 * Typ eines Events – unterscheidet zwischen aktuellem und historischem Anlass.
 */
export enum EventType {
  actual = "actual",
  history = "history",
}

/**
 * Dokumententypen, die einem Event zugeordnet werden können.
 * Wird verwendet, um zu tracken, welche Sub-Dokumente für einen Event existieren.
 */
export enum EventRefDocuments {
  usedRecipes = 1,
  shoppingList,
  materialList,
  recipeVariants,
  receipt,
}

/**
 * Koch/Teammitglied eines Events mit öffentlichem Profil und UID.
 */
export interface Cook extends AuthUserPublicProfile {
  /** Eindeutige Benutzer-ID des Kochs. */
  uid: string;
}

/**
 * Zeitscheibe eines Events mit Von-/Bis-Datum und Positionierung.
 */
export interface EventDate {
  /** Eindeutige ID der Zeitscheibe. */
  uid: string;
  /** Position in der sortierten Reihenfolge. */
  pos: number;
  /** Startdatum der Zeitscheibe. */
  from: Date;
  /** Enddatum der Zeitscheibe. */
  to: Date;
}

interface AddCookToEvent {
  firebase: Firebase;
  authUser: AuthUser;
  cookPublicProfile: UserPublicProfile;
  event: Event;
}
interface RemoveCookFromEvent {
  firebase: Firebase;
  authUser: AuthUser;
  cookUidToRemove: string;
  event: Event;
}

interface Save {
  firebase: Firebase;
  event: Event;
  authUser: AuthUser;
  localPicture?: File | null;
}
interface Delete {
  event: Event;
  firebase: Firebase;
  authUser: AuthUser;
}

interface UploadPicture {
  firebase: Firebase;
  file: File;
  event: Event;
  authUser: AuthUser;
}
interface DeletePicture {
  firebase: Firebase;
  event: Event;
  authUser: AuthUser;
  updateEventDocument?: boolean;
}

interface GetEvent {
  firebase: Firebase;
  uid: string;
}

interface GetAllEvents {
  firebase: Firebase;
}
interface GetEventListener {
  firebase: Firebase;
  uid: string;
  callback: (event: Event) => void;
  errorCallback: (error: Error) => void;
}
interface GetEvents {
  firebase: Firebase;
  userUid: string;
  eventType: EventType;
}
interface GetAllEventsOfUser {
  firebase: Firebase;
  userUid: string;
}
interface AddRefDocument {
  refDocuments: Event["refDocuments"];
  newDocumentType: EventRefDocuments;
}
interface CheckIfDeletedDayArePlanned {
  event: Event;
  menuplan: Menuplan;
}

interface RegisterSupportUser {
  firebase: Firebase;
  eventUid: Event["uid"];
  authUser: AuthUser;
  callback: ({
    done,
    errorMessage,
    eventUid,
    supportUserUid,
    date,
  }: CloudFunctionActivateSupportUserDocumentStructure) => void;
  errorCallback: (error: Error) => void;
}

/**
 * Zentrale Modellklasse für einen Event (Anlass).
 * Enthält CRUD-Operationen, Bildverwaltung, Validierung und Analytik.
 * Alle Datenbankzugriffe laufen über die Firebase-Abstraktion.
 */
export default class Event {
  uid: string;
  name: string;
  motto: string;
  location: string;
  cooks: Cook[];
  numberOfDays: number;
  dates: EventDate[];
  maxDate: Date;
  pictureSrc: string;
  authUsers: string[];
  created: ChangeRecord;
  lastChange: ChangeRecord;
  refDocuments?: EventRefDocuments[];
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  /**
   * Erstellt eine neue, leere Event-Instanz mit Standardwerten.
   */
  constructor() {
    this.uid = "";
    this.name = "";
    this.motto = "";
    this.location = "";
    this.pictureSrc = "";
    this.cooks = [];
    this.numberOfDays = 0;
    this.dates = [];
    this.maxDate = new Date(0);
    this.authUsers = [];
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }
  /* =====================================================================
  // Factory
  // ===================================================================== */
  /**
   * Erzeugt ein neues Event mit dem angemeldeten Benutzer als erstem Koch
   * und einer leeren Datumszeile.
   *
   * @param authUser Der aktuell angemeldete Benutzer.
   * @returns Neues Event mit Standardwerten und einem Koch.
   */
  static factory(authUser: AuthUser) {
    const event = new Event();
    if (authUser) {
      event.cooks = [
        {
          uid: authUser.uid,
          ...authUser.publicProfile,
        },
      ];
    } else {
      event.cooks = [];
    }
    event.created = Utils.createChangeRecord(authUser);
    const emptyDateLine = Event.createDateEntry();
    emptyDateLine.pos = 1;
    event.dates = [emptyDateLine];
    return event;
  }
  /* =====================================================================
  // Leere Datumszeile erzeugen
  // ===================================================================== */
  /**
   * Erzeugt einen leeren Datumseintrag mit generierter UID.
   *
   * @returns Neuer Datumseintrag mit Epoch-Daten (1.1.1970) und Position 0.
   */
  static createDateEntry(): EventDate {
    return {
      uid: Utils.generateUid(5),
      pos: 0,
      from: new Date(0),
      to: new Date(0),
    };
  }
  /* =====================================================================
  // Datumsfelder validieren (Von/Bis-Konsistenz und Überlappungen)
  // ===================================================================== */
  /**
   * Validiert die Datumseinträge eines Events auf Konsistenz und Überlappungen.
   * Prüft ob Von-/Bis-Daten gesetzt sind, ob Von vor Bis liegt und ob sich
   * Zeitscheiben überschneiden.
   *
   * @param dates Array der zu prüfenden Datumseinträge.
   * @returns Array mit Validierungsfehlern (leer wenn alles korrekt).
   */
  static validateDates(dates: EventDate[]): FormValidationFieldError[] {
    const errors: FormValidationFieldError[] = [];

    // Prüfen ob Von- und Bis-Datum konsistent
    const epoch = new Date(0).getTime();
    dates.forEach((date) => {
      const fromEmpty = date.from.getTime() === epoch;
      const toEmpty = date.to.getTime() === epoch;

      // Komplett leere Zeile überspringen – kein Fehler
      if (fromEmpty && toEmpty) {
        return;
      }

      if (fromEmpty) {
        errors.push({
          priority: 2,
          fieldName: "dateFrom_" + date.uid,
          errorMessage: TEXT_ERROR_FROM_DATE_EMPTY,
          errorObject: date,
        });
      }
      if (toEmpty) {
        errors.push({
          priority: 2,
          fieldName: "dateTo_" + date.uid,
          errorMessage: TEXT_ERROR_TO_DATE_EMPTY,
          errorObject: date,
        });
      }
      if (date.from > date.to && date.to.getFullYear() !== 1970) {
        errors.push({
          priority: 3,
          fieldName: "dateFrom_" + date.uid,
          errorMessage: TEXT_ERROR_FROM_DATE_BIGGER_THAN_TO_DATE,
          errorObject: date,
        });
        // Beide Felder als Fehler markieren
        errors.push({
          priority: 3,
          fieldName: "dateTo_" + date.uid,
          errorMessage: "",
          errorObject: date,
        });
      }
    });

    // Prüfen ob Zeitscheiben überlappend (leere Zeilen ignorieren)
    const nonEmptyDates = dates.filter(
      (d) => d.from.getTime() !== epoch || d.to.getTime() !== epoch,
    );
    nonEmptyDates.forEach((outerDate, outerCounter) => {
      nonEmptyDates.forEach((innerDate, innerCounter) => {
        if (outerCounter !== innerCounter) {
          if (
            outerDate.from >= innerDate.from &&
            outerDate.from <= innerDate.to
          ) {
            errors.push({
              priority: 3,
              fieldName: "dateFrom_" + outerDate.uid,
              errorMessage: TEXT_ERROR_OVERLAPPING_DATES(innerCounter + 1),
              errorObject: outerDate,
            });
            errors.push({
              priority: 3,
              fieldName: "dateTo_" + outerDate.uid,
              errorMessage: "",
              errorObject: outerDate,
            });
            // Die Überlappung auch als Fehler markieren
            errors.push({
              priority: 3,
              fieldName: "dateFrom_" + innerDate.uid,
              errorMessage: TEXT_ERROR_OVERLAPPING_DATES(outerCounter + 1),
              errorObject: innerCounter,
            });
            errors.push({
              priority: 3,
              fieldName: "dateTo_" + innerDate.uid,
              errorMessage: "",
              errorObject: innerCounter,
            });
          }
        }
      });
    });

    return errors;
  }
  /* =====================================================================
  // Daten prüfen
  // ===================================================================== */
  /**
   * Prüft die Pflichtfelder eines Events und wirft eine Exception bei Fehlern.
   * Validiert Name, Köche und Datumsangaben.
   *
   * @param event Das zu prüfende Event.
   * @throws {FieldValidationError} Wenn Pflichtfelder fehlen oder Daten ungültig sind.
   */
  static checkEventData(event: Event) {
    const formValidation: FormValidationFieldError[] = [];
    if (!event.name) {
      formValidation.push({
        priority: 1,
        fieldName: "name",
        errorMessage: TEXT_ERROR_EVENT_NAME_CANT_BE_EMPTY,
      });
    }

    if (event.cooks.length === 0) {
      formValidation.push({
        priority: 4,
        fieldName: "cooks",
        errorMessage: TEXT_ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK,
      });
    }

    // Datumsvalidierung delegieren
    formValidation.push(...Event.validateDates(event.dates));

    if (formValidation.length !== 0) {
      throw new FieldValidationError(
        TEXT_ERROR_FORM_VALIDATION,
        formValidation,
      );
    }
  }
  /* =====================================================================
  // Person/Koch hinzufügen
  // ===================================================================== */
  /**
   * Fügt einen Koch zur Kochmannschaft des Events hinzu.
   * Speichert die Änderung in der DB (falls der Event bereits existiert),
   * vergibt Credits und erstellt einen Feed-Eintrag.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @param cookPublicProfile Öffentliches Profil des neuen Kochs.
   * @param event Der Event, dem der Koch hinzugefügt wird.
   * @returns Aktualisiertes Array der Köche.
   */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static async addCookToEvent({
    firebase,
    authUser,
    cookPublicProfile,
    event,
  }: AddCookToEvent) {
    // Neue Person in Kochmannschaft aufnehmen
    event.cooks.push({
      displayName: cookPublicProfile.displayName,
      motto: cookPublicProfile.motto,
      pictureSrc: cookPublicProfile.pictureSrc,
      uid: cookPublicProfile.uid,
    });

    if (event.uid) {
      // Änderungen direkt speichern - aber nur, wenn der Anlass schon existiert
      await Event.save({
        firebase: firebase,
        event: event,
        authUser: authUser,
      });

      // Dem User Credit geben
      UserPublicProfile.incrementField({
        firebase: firebase,
        uid: cookPublicProfile.uid,
        field: UserPublicProfileStatsFields.noEvents,
        step: 1,
      });

      // Feed
      Feed.createFeedEntry({
        firebase: firebase,
        authUser: authUser,
        feedType: FeedType.eventCookAdded,
        feedVisibility: Role.basic,
        objectUid: event.uid,
        objectName: event.name,
        textElements: [event.name],
        objectPictureSrc: event.pictureSrc,
        objectUserUid: cookPublicProfile.uid,
        objectUserDisplayName: cookPublicProfile.displayName,
        objectUserPictureSrc: cookPublicProfile.pictureSrc,
      });
      logEvent(firebase.analytics, FirebaseAnalyticEvent.eventCookAdded);
    }

    return event.cooks;
  }

  /* =====================================================================
  // Person/Koch entfernen
  // ===================================================================== */
  /**
   * Entfernt einen Koch aus der Kochmannschaft des Events.
   * Speichert die Änderung in der DB (falls der Event bereits existiert)
   * und reduziert die Credits des entfernten Kochs.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @param cookUidToRemove UID des zu entfernenden Kochs.
   * @param event Der Event, aus dem der Koch entfernt wird.
   * @returns Aktualisiertes Array der Köche.
   */
  static async removeCookFromEvent({
    firebase,
    authUser,
    cookUidToRemove,
    event,
  }: RemoveCookFromEvent) {
    event.cooks = event.cooks.filter((cook) => cook.uid !== cookUidToRemove);

    if (event.uid) {
      // Änderungen direkt speichern - aber nur, wenn der Event auf der DB
      // schon existiert... sonst ist es nur eine Manipulation des Arrays
      await Event.save({
        firebase: firebase,
        event: event,
        authUser: authUser,
      });

      // Dem User Credit nehmen
      await UserPublicProfile.incrementField({
        firebase: firebase,
        field: UserPublicProfileStatsFields.noEvents,
        uid: cookUidToRemove,
        step: -1,
      });
    }
    logEvent(firebase.analytics, FirebaseAnalyticEvent.eventCookRemoved);

    return event.cooks;
  }
  /* =====================================================================
  // Daten in Firebase SPEICHERN
  // ===================================================================== */
  /**
   * Speichert einen Event in Firebase (neu anlegen oder aktualisieren).
   * Verwaltet auch das Hochladen/Löschen von Bildern, EventShort-Übersicht,
   * Statistiken, Credits und Feed-Einträge.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param event Der zu speichernde Event.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @param localPicture Optionales lokales Bild zum Hochladen.
   * @returns Der gespeicherte Event mit aktualisierter UID.
   * @throws {FieldValidationError} Wenn die Event-Daten ungültig sind.
   */
  static async save({firebase, event, authUser, localPicture}: Save) {
    let newEvent = false;
    let eventData = structuredClone(event);
    eventData.dates = Event.deleteEmptyDates(eventData.dates);
    eventData = Event.prepareSave(eventData);
    Event.checkEventData(eventData);

    if (!eventData.uid) {
      newEvent = true;
      const createResult = await firebase.event.create<Event>({
        value: eventData,
        authUser: authUser,
      });
      eventData = createResult.value;

      // Bild hochladen, wenn vorhanden
      if (localPicture instanceof File) {
        event.pictureSrc = await Event.uploadPicture({
          firebase: firebase,
          event: eventData,
          file: localPicture,
          authUser: authUser,
        });
      }
    } else {
      if (localPicture instanceof File) {
        // Falls ein Bild bereits vorhanden ist, zuerst löschen
        if (eventData.pictureSrc) {
          await Event.deletePicture({
            firebase: firebase,
            event: event,
            authUser: authUser,
          });
        }

        eventData.pictureSrc = await Event.uploadPicture({
          firebase: firebase,
          event: eventData,
          file: localPicture,
          authUser: authUser,
        });
      }

      await firebase.event.update<Event>({
        uids: [event.uid],
        value: eventData,
        authUser: authUser,
      });
    }

    // Übersichtsfile anpassen
    await firebase.eventShort.updateFields({
      uids: [""], // wird in der Klasse bestimmt
      values: {
        [eventData.uid]: EventShort.createShortEventFromEvent(eventData),
      },
      authUser: authUser,
    });

    if (newEvent) {
      logEvent(firebase.analytics, FirebaseAnalyticEvent.eventCreated);
      Stats.incrementStats({
        firebase: firebase,
        values: [
          {field: StatsField.noEvents, value: 1},
          {field: StatsField.noPlanedDays, value: eventData.numberOfDays},
        ],
      });

      // Allen Teammitgliedern Credits geben
      event.cooks.forEach((cook) =>
        UserPublicProfile.incrementField({
          firebase: firebase,
          uid: cook.uid,
          field: UserPublicProfileStatsFields.noEvents,
          step: 1,
        }),
      );
      // Feed-Eintrag
      Feed.createFeedEntry({
        firebase: firebase,
        authUser: authUser,
        feedType: FeedType.eventCreated,
        feedVisibility: Role.basic,
        textElements: [eventData.name],
        objectUid: eventData.uid,
        objectName: eventData.name,
        objectPictureSrc: eventData.pictureSrc,
        additionalData: {
          location: eventData.location,
          duration: eventData.numberOfDays,
        },
      });
    }

    // Sicherstellen, dass Daten mindestens einen Eintrag haben
    if (eventData.dates.length === 0) {
      event.dates.push(Event.createDateEntry());
    }
    return eventData;
  }
  /* =====================================================================
  // Speichern vorbereiten
  // ===================================================================== */
  /**
   * Bereitet einen Event fürs Speichern vor: berechnet maxDate,
   * Anzahl Tage, sortiert Dates und extrahiert berechtigte Benutzer.
   *
   * @param event Der vorzubereitende Event (wird mutiert).
   * @returns Der angepasste Event.
   */
  static prepareSave(event: Event) {
    // Max-Datum bestimmen
    event.maxDate = event.dates.reduce((maxDate, currentDate) => {
      // Vergleiche das "To Date" des aktuellen Elements mit dem bisher höchsten "To Date"
      return currentDate.to > maxDate.to ? currentDate : maxDate;
    }, event.dates[0]).to;

    event.maxDate = new Date(event.maxDate.setHours(0, 0, 0, 0));

    // Anzahl Tage Total berechnen
    event.numberOfDays = Event.defineEventDuration(event.dates);

    // Dates sortieren
    event.dates = Utils.sortArray({
      array: event.dates,
      attributeName: "from",
    });
    event.dates = Utils.renumberArray({
      array: event.dates,
      field: "pos",
    });
    event.authUsers = this.getAuthUsersFromCooks(event.cooks);
    return event;
  }
  /* =====================================================================
  // Anlass löschen
  // ===================================================================== */
  /**
   * Löscht einen Event und alle zugehörigen Dokumente (Rezeptvarianten,
   * Einkaufsliste, Materialliste, Menüplan, Gruppenkonfiguration, Bild).
   * Passt Statistiken und Credits an.
   *
   * @param event Der zu löschende Event.
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param authUser Der aktuell angemeldete Benutzer (muss Koch des Events sein).
   */
  static async delete({event, firebase, authUser}: Delete) {
    if (!event.cooks.find((cook) => cook.uid === authUser.uid)) {
      return;
    }

    // Zuerst alle angehörigen Dokumente löschen
    if (event.refDocuments?.includes(EventRefDocuments.recipeVariants)) {
      await Recipe.deleteAllVariants({
        eventUid: event.uid,
        firebase: firebase,
        authUser: authUser,
      });
    }

    if (event.refDocuments?.includes(EventRefDocuments.usedRecipes)) {
      await UsedRecipes.delete({
        eventUid: event.uid,
        firebase: firebase,
      });
    }

    if (event.refDocuments?.includes(EventRefDocuments.shoppingList)) {
      await ShoppingListCollection.delete({
        eventUid: event.uid,
        firebase: firebase,
      });
    }

    if (event.refDocuments?.includes(EventRefDocuments.materialList)) {
      await MaterialList.delete({
        eventUid: event.uid,
        firebase: firebase,
      });
    }

    await EventGroupConfiguration.delete({
      eventUid: event.uid,
      firebase: firebase,
    });

    await Menuplan.delete({eventUid: event.uid, firebase: firebase});

    // Feld aus Übersicht löschen
    await EventShort.delete({event: event, firebase: firebase});

    // Statistik anpassen
    Stats.incrementStats({
      firebase: firebase,
      values: [
        {field: StatsField.noEvents, value: -1},
        {field: StatsField.noPlanedDays, value: event.numberOfDays * -1},
      ],
    });

    // Credits den Köchen wieder entziehen
    event.cooks.forEach((cook) =>
      UserPublicProfile.incrementField({
        firebase: firebase,
        field: UserPublicProfileStatsFields.noEvents,
        uid: cook.uid,
        step: -1,
      }),
    );

    if (event.pictureSrc) {
      await Event.deletePicture({
        firebase: firebase,
        event: event,
        authUser: authUser,
        updateEventDocument: false,
      });
    }

    await firebase.event.delete({uids: [event.uid]});

    logEvent(firebase.analytics, FirebaseAnalyticEvent.eventDeleted);
  }
  /* =====================================================================
  // Dauer des Events bestimmen
  // ===================================================================== */
  /**
   * Berechnet die Gesamtdauer eines Events in Tagen anhand der Zeitscheiben.
   *
   * @param dates Array der Datumseinträge des Events.
   * @returns Gesamtanzahl Tage über alle Zeitscheiben.
   */
  static defineEventDuration(dates: Event["dates"]) {
    return dates.reduce((result, dateSlice) => {
      const difference = Utils.differenceBetweenTwoDates({
        dateFrom: dateSlice.from,
        dateTo: dateSlice.to,
      });

      if (difference) {
        result += difference;
      }

      return result;
    }, 0);
  }
  /* =====================================================================
  // Berechtigte Benutzer aus Kochmannschaft extrahieren
  // ===================================================================== */
  /**
   * Extrahiert die UIDs aller Köche als Array berechtigter Benutzer.
   *
   * @param cooks Array der Köche des Events.
   * @returns Array mit den UIDs der Köche.
   */
  static getAuthUsersFromCooks(cooks: Cook[]) {
    return cooks.map((cook) => cook.uid);
  }
  /* =====================================================================
  // Leere Daten löschen
  // ===================================================================== */
  /**
   * Entfernt leere Datumszeilen (Von und Bis = 1.1.1970), behält aber immer
   * den ersten Eintrag, damit mindestens eine Zeile vorhanden bleibt.
   *
   * @param dates Array der Datumseinträge.
   * @returns Gefiltertes Array ohne leere Einträge (ausser dem ersten).
   */
  static deleteEmptyDates(dates: EventDate[]) {
    return dates.filter(
      (date, index) =>
        date.from.getFullYear() !== 1970 ||
        date.to.getFullYear() !== 1970 ||
        index === 0,
    );
  }
  /* =====================================================================
  // Bild in Firebase Storage hochladen
  // ===================================================================== */
  /**
   * Lädt ein Bild in Firebase Storage hoch, holt die redimensionierte
   * Variante und aktualisiert das Event-Dokument mit der neuen Bild-URL.
   *
   * @param firebase Firebase-Instanz für Storage- und DB-Zugriff.
   * @param file Die hochzuladende Bilddatei.
   * @param event Der Event, dem das Bild zugeordnet wird.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @returns Die Download-URL des hochgeladenen Bilds.
   */
  static async uploadPicture({firebase, file, event, authUser}: UploadPicture) {
    await firebase.fileStore.events.uploadFile({
      file: file,
      filename: event.uid,
    });

    // Redimensionierte Varianten holen
    const variants = await firebase.fileStore.events.getPictureVariants({
      uid: event.uid,
      sizes: [ImageSize.size_500],
    });
    const pictureSrc = variants[0].downloadURL;

    // Den Wert in der DB aktualisieren
    await firebase.event.updateFields({
      uids: [event.uid],
      authUser: authUser,
      values: {pictureSrc: pictureSrc, lastChange: {}},
      updateChangeFields: true,
    });

    return pictureSrc;
  }
  /* =====================================================================
  // Bild löschen
  // ===================================================================== */
  /**
   * Löscht das Bild eines Events aus Firebase Storage und setzt optional
   * die Bild-URL im Event-Dokument zurück.
   *
   * @param firebase Firebase-Instanz für Storage- und DB-Zugriff.
   * @param event Der Event, dessen Bild gelöscht wird.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @param updateEventDocument Ob das Event-Dokument aktualisiert werden soll (Standard: true).
   */
  static async deletePicture({
    firebase,
    event,
    authUser,
    updateEventDocument = true,
  }: DeletePicture) {
    await firebase.fileStore.events.deleteFile(
      `${event.uid}${IMAGES_SUFFIX.size500.suffix}`,
    );

    if (updateEventDocument) {
      await firebase.event.updateFields({
        uids: [event.uid],
        authUser: authUser,
        values: {pictureSrc: "", lastChange: {}},
        updateChangeFields: true,
      });
    }
  }
  /* =====================================================================
  // Event lesen
  // ===================================================================== */
  /**
   * Liest ein einzelnes Event anhand seiner UID aus Firebase.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param uid Die UID des zu lesenden Events.
   * @returns Das gelesene Event.
   */
  static async getEvent({firebase, uid}: GetEvent) {
    const event = await firebase.event.read<Event>({uids: [uid]});
    return event;
  }
  /* =====================================================================
  // Alle Events holen
  // ===================================================================== */
  /**
   * Liest alle Events aus Firebase (absteigend nach Name sortiert).
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @returns Array aller Events.
   */
  static async getAllEvents({firebase}: GetAllEvents) {
    const eventList = await firebase.event.readCollection<Event>({
      uids: [],
      orderBy: {field: "name", sortOrder: SortOrder.desc},
      ignoreCache: true,
    });
    return eventList;
  }
  /* =====================================================================
  // Event-Listener registrieren
  // ===================================================================== */
  /**
   * Registriert einen Echtzeit-Listener auf ein Event-Dokument.
   * Bei jeder Änderung wird der Callback mit dem aktualisierten Event aufgerufen.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param uid Die UID des zu beobachtenden Events.
   * @param callback Funktion, die bei Änderungen aufgerufen wird.
   * @param errorCallback Funktion, die bei Fehlern aufgerufen wird.
   * @returns Unsubscribe-Funktion zum Abmelden des Listeners.
   */
  static async getEventListener({
    firebase,
    uid,
    callback,
    errorCallback,
  }: GetEventListener) {
    const eventCallback = (event: Event) => {
      // Event mit UID anreichern
      event.uid = uid;
      callback(event);
    };

    const eventListener = await firebase.event.listen<Event>({
      uids: [uid],
      callback: eventCallback,
      errorCallback: errorCallback,
    });
    return eventListener;
  }
  /* =====================================================================
  // Events einer Person lesen
  // ===================================================================== */
  /**
   * Liest alle Events eines Benutzers eines bestimmten Typs (aktuell oder historisch).
   * Filtert nach dem maxDate des Events relativ zum heutigen Datum.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param userUid UID des Benutzers.
   * @param eventType Typ der Events (aktuell oder historisch).
   * @returns Array der gefilterten Events.
   */
  static async getEventsOfUser({
    firebase,
    userUid,
    eventType = EventType.actual,
  }: GetEvents) {
    let whereOperator: Operator;

    switch (eventType) {
      case EventType.actual:
        logEvent(firebase.analytics, FirebaseAnalyticEvent.eventGetActual);
        whereOperator = Operator.GE;
        break;
      case EventType.history:
        logEvent(firebase.analytics, FirebaseAnalyticEvent.eventGetHistory);
        whereOperator = Operator.LE;
        break;
    }

    const events = await firebase.event.readCollection<Event>({
      uids: [""],
      orderBy: {field: "maxDate", sortOrder: SortOrder.asc},
      where: [
        {
          field: "authUsers",
          operator: Operator.ArrayContains,
          value: userUid,
        },
        {
          field: "maxDate",
          operator: whereOperator,
          value: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      ],
    });

    return events;
  }
  /* =====================================================================
  // Alle Events einer Person holen
  // ===================================================================== */
  /**
   * Liest alle Events eines Benutzers (sowohl aktuelle als auch historische).
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param userUid UID des Benutzers.
   * @returns Array aller Events des Benutzers.
   */
  static async getAllEventsOfUser({firebase, userUid}: GetAllEventsOfUser) {
    const events = await firebase.event.readCollection<Event>({
      uids: [""],
      orderBy: {field: "maxDate", sortOrder: SortOrder.asc},
      where: [
        {
          field: "authUsers",
          operator: Operator.ArrayContains,
          value: userUid,
        },
      ],
    });

    return events;
  }
  /* =====================================================================
  // Neuen Dokumententyp hinzufügen
  // ===================================================================== */
  /**
   * Fügt einen neuen Dokumententyp zur Liste der Referenzdokumente eines Events hinzu.
   *
   * @param refDocuments Bisherige Liste der Referenzdokumente.
   * @param newDocumentType Der neue Dokumententyp.
   * @returns Aktualisiertes Array der Referenzdokumente.
   */
  static addRefDocument({refDocuments, newDocumentType}: AddRefDocument) {
    let updatedDocuments: Event["refDocuments"] = [];
    if (refDocuments) {
      updatedDocuments = [...refDocuments];
    }
    updatedDocuments.push(newDocumentType);
    return updatedDocuments;
  }
  /* =====================================================================
  // Prüfen ob gelöschte Tage bereits geplant sind
  // ===================================================================== */
  /**
   * Prüft, ob durch die Anpassung der Event-Daten bereits geplante Menüplan-Tage
   * gelöscht würden. Vergleicht die neuen Datumsangaben mit den bestehenden
   * Menüplan-Daten.
   *
   * @param event Der angepasste Event.
   * @param menuplan Der bestehende Menüplan.
   * @returns `true` wenn geplante Tage betroffen wären, `false` sonst.
   */
  static checkIfDeletedDayArePlanned({
    event,
    menuplan,
  }: CheckIfDeletedDayArePlanned) {
    const newDayList = Menuplan.getEventDateList({event: event}).map((date) =>
      Utils.dateAsString(date),
    );
    const menuplanDates = menuplan.dates.map((date) =>
      Utils.dateAsString(date),
    );

    const missingDates = menuplanDates.filter(
      (date) => !newDayList.includes(date),
    );

    const affectedMeals = Object.values(menuplan.meals).filter((meal) =>
      missingDates.includes(meal.date),
    );
    const affectedMenues: Menue["uid"][] = affectedMeals.reduce<Menue["uid"][]>(
      (accumulator, meal) => accumulator.concat(meal.menuOrder),
      [],
    );

    const planedObjects = affectedMenues.reduce<number>(
      (accumulator, mealUid) => {
        return (
          accumulator +
          menuplan.menues[mealUid].mealRecipeOrder.length +
          menuplan.menues[mealUid].productOrder.length +
          menuplan.menues[mealUid].materialOrder.length
        );
      },
      0,
    );
    return Boolean(planedObjects !== 0);
  }
  /* =====================================================================
  // Support-User aktivieren
  // ===================================================================== */
  /**
   * Aktiviert den Support-User für einen Event via Cloud Function.
   * Registriert einen Listener, der bei Fertigstellung den Callback aufruft.
   *
   * @param firebase Firebase-Instanz für DB-Zugriff.
   * @param eventUid UID des Events.
   * @param authUser Der aktuell angemeldete Benutzer.
   * @param callback Wird aufgerufen, wenn die Aktivierung abgeschlossen ist.
   * @param errorCallback Wird bei Fehlern aufgerufen.
   */
  static async activateSupportUser({
    firebase,
    eventUid,
    authUser,
    callback,
    errorCallback,
  }: RegisterSupportUser) {
    const documentId =
      await firebase.cloudFunction.activateSupportUser.triggerCloudFunction({
        values: {
          date: new Date(),
          eventUid: eventUid,
          supportUserUid: getSupportUserUid(),
        },
        authUser: authUser,
      });

    let unsubscribe: () => void;

    // Listener für Fertigstellungsnachricht registrieren
    const callbackCaller = (
      data: CloudFunctionActivateSupportUserDocumentStructure,
    ) => {
      if (data?.done) {
        callback(data);
        unsubscribe();
      }
    };

    unsubscribe = await firebase.cloudFunction.activateSupportUser.listen({
      uids: [documentId],
      callback: callbackCaller,
      errorCallback: errorCallback,
    });
  }
}
