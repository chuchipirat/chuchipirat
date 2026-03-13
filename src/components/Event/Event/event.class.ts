import Utils from "../../Shared/utils.class";

import {
  ERROR_EVENT_NAME_CANT_BE_EMPTY as TEXT_ERROR_EVENT_NAME_CANT_BE_EMPTY,
  ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK as TEXT_ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK,
  ERROR_EVENT_MUST_HAVE_MIN_ONE_DATE as TEXT_ERROR_EVENT_MUST_HAVE_MIN_ONE_DATE,
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
import {ChangeRecord} from "../../Shared/global.interface";
import FieldValidationError, {
  FormValidationFieldError,
} from "../../Shared/fieldValidation.error.class";
import {Menue, MenuplanData} from "../Menuplan/menuplan.types";
import {getEventDateList} from "../Menuplan/menuplanService";

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

interface AddRefDocument {
  refDocuments: Event["refDocuments"];
  newDocumentType: EventRefDocuments;
}
interface CheckIfDeletedDayArePlanned {
  event: Event;
  menuplan: MenuplanData;
}

/**
 * Zentrale Modellklasse für einen Event (Anlass).
 * Enthält Validierung, Datenaufbereitung und reine Geschäftslogik.
 * Persistenz wird durch Supabase-Repositories und Bridge-Funktionen abgedeckt.
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
      (dates) => dates.from.getTime() !== epoch || dates.to.getTime() !== epoch,
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

    // Mindestens eine nicht-leere Zeitscheibe erforderlich
    const epoch = new Date(0).getTime();
    const hasNonEmptyDate = event.dates.some(
      (d) => d.from.getTime() !== epoch || d.to.getTime() !== epoch,
    );
    if (!hasNonEmptyDate) {
      formValidation.push({
        priority: 2,
        fieldName: "dateFrom_" + event.dates[0]?.uid,
        errorMessage: TEXT_ERROR_EVENT_MUST_HAVE_MIN_ONE_DATE,
      });
    }

    // Datumsvalidierung delegieren (Konsistenz und Überlappungen)
    formValidation.push(...Event.validateDates(event.dates));

    if (formValidation.length !== 0) {
      throw new FieldValidationError(
        TEXT_ERROR_FORM_VALIDATION,
        formValidation,
      );
    }
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
    const newDayList = getEventDateList({event: event}).map((date) =>
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
}
