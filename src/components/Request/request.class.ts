/**
 * Request — Statische Utility-Klasse für Antrags-Logik.
 *
 * Enthält ENUMs, Typen, Übergangs-Definitionen und reine Hilfsfunktionen
 * für das Request-System. Kein Datenbankzugriff — die Persistenz erfolgt
 * über {@link RequestRepository} und {@link RequestCommentRepository}.
 *
 * @example
 * const transitions = Request.getNextPossibleTransitions('inReview', 'recipePublish');
 * const statusText = Request.translateStatus('done');
 */
import {
  STATUS_NAME as TEXT_STATUS_NAME,
  REQUEST_TYPE as TEXT_REQUEST_TYPE,
  REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE as TEXT_REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE,
  REQUEST_STATUS_TRANSITION_REPORT_ERROR as TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR,
} from "../../constants/text";
import {ChangeLogEntry} from "../Database/Repository/RequestRepository";

/* =====================================================================
// ENUMs
// ===================================================================== */

/** Mögliche Status eines Antrags. */
export enum RequestStatus {
  created = "created",
  inReview = "inReview",
  declined = "declined",
  backToAuthor = "backToAuthor",
  done = "done",
}

/** Typ eines Antrags. */
export enum RequestType {
  recipePublish = "recipePublish",
  reportError = "reportError",
}

/** Aktions-Typ für Changelog-Einträge. */
export enum RequestAction {
  none = "",
  created = "created",
  assign = "assign",
  changeState = "changeState",
}

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Definition eines Statusübergangs.
 *
 * @param fromState - Ausgangsstatus ('*' = beliebig)
 * @param toState - Zielstatus
 * @param description - Deutschsprachige Beschreibung des Übergangs
 */
export interface RequestTransition {
  fromState: RequestStatus | "*";
  toState: RequestStatus;
  description: string;
}

/* =====================================================================
// Übergangs-Definitionen pro Antragstyp
// ===================================================================== */

/** Erlaubte Statusübergänge für Rezept-Veröffentlichungsanträge. */
const PUBLISH_RECIPE_TRANSITIONS: RequestTransition[] = [
  {
    fromState: RequestStatus.created,
    toState: RequestStatus.inReview,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE.created.inReview
        .description,
  },
  {
    fromState: RequestStatus.inReview,
    toState: RequestStatus.declined,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE.created.declined
        .description,
  },
  {
    fromState: RequestStatus.inReview,
    toState: RequestStatus.done,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE.created.done.description,
  },
  {
    fromState: RequestStatus.backToAuthor,
    toState: RequestStatus.inReview,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_PUBLISH_RECIPE.backToAuthor.inReview
        .description,
  },
];

/** Erlaubte Statusübergänge für Fehlermeldungen. */
const REPORT_ERROR_TRANSITIONS: RequestTransition[] = [
  {
    fromState: RequestStatus.created,
    toState: RequestStatus.inReview,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.inReview.description,
  },
  {
    fromState: RequestStatus.inReview,
    toState: RequestStatus.declined,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.declined.description,
  },
  {
    fromState: RequestStatus.inReview,
    toState: RequestStatus.backToAuthor,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.backToAuthor
        .description,
  },
  {
    fromState: RequestStatus.inReview,
    toState: RequestStatus.done,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.done.description,
  },
  {
    fromState: RequestStatus.backToAuthor,
    toState: RequestStatus.inReview,
    description:
      TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.backToAuthor.inReview
        .description,
  },
];

/** Alle Übergänge nach Antragstyp. */
const TRANSITIONS: Record<string, RequestTransition[]> = {
  [RequestType.recipePublish]: PUBLISH_RECIPE_TRANSITIONS,
  [RequestType.reportError]: REPORT_ERROR_TRANSITIONS,
};

/* =====================================================================
// Request — Statische Utility-Klasse
// ===================================================================== */

/**
 * Statische Utility-Klasse für Antrags-Logik.
 *
 * Enthält Übergangs-Definitionen, Textübersetzungen und Changelog-Erstellung.
 * Kein Datenbankzugriff — reine Business-Logik.
 */
export class Request {
  /* =====================================================================
  // Übergänge
  // ===================================================================== */

  /**
   * Gibt die nächsten möglichen Statusübergänge zurück.
   *
   * @param status - Aktueller Status des Antrags
   * @param requestType - Typ des Antrags
   * @returns Array der möglichen Übergänge (leer, wenn keine vorhanden)
   */
  static getNextPossibleTransitions(
    status: RequestStatus | string,
    requestType: RequestType | string,
  ): RequestTransition[] {
    if (!status || !requestType) return [];
    const transitions = TRANSITIONS[requestType];
    if (!transitions) return [];
    return transitions.filter(
      (t) => t.fromState === status || t.fromState === "*",
    );
  }

  /* =====================================================================
  // Textübersetzungen
  // ===================================================================== */

  /**
   * Übersetzt einen Status-Wert in den deutschen Anzeigenamen.
   *
   * @param status - DB-Status (z.B. 'inReview')
   * @returns Deutschsprachiger Text (z.B. 'wird geprüft')
   */
  static translateStatus(status: string): string {
    return TEXT_STATUS_NAME[status as keyof typeof TEXT_STATUS_NAME] ?? status;
  }

  /**
   * Übersetzt einen Antragstyp in den deutschen Anzeigenamen.
   *
   * @param type - DB-Typ (z.B. 'recipePublish')
   * @returns Deutschsprachiger Text (z.B. 'Rezeptveröffentlichung')
   */
  static translateType(type: string): string {
    return TEXT_REQUEST_TYPE[type as keyof typeof TEXT_REQUEST_TYPE] ?? type;
  }

  /* =====================================================================
  // Changelog
  // ===================================================================== */

  /**
   * Erstellt einen neuen Changelog-Eintrag und fügt ihn am Anfang des Arrays ein.
   *
   * @param changeLog - Bestehendes Changelog-Array (wird nicht mutiert)
   * @param action - Art der Aktion (created, assign, changeState)
   * @param authUser - Der ausführende Benutzer
   * @param newValue - Der neue Wert (z.B. {status: 'inReview'})
   * @returns Neues Array mit dem Eintrag am Anfang
   */
  static createChangeLogEntry(
    changeLog: ChangeLogEntry[],
    action: RequestAction,
    authUser: {authUid: string; displayName: string},
    newValue: Record<string, unknown>,
  ): ChangeLogEntry[] {
    const entry: ChangeLogEntry = {
      date: new Date().toISOString(),
      userUid: authUser.authUid,
      userDisplayName: authUser.displayName,
      action,
      newValue,
    };
    return [entry, ...changeLog];
  }

  /**
   * Prüft ob ein Status als «abgeschlossen» gilt (done oder declined).
   *
   * @param status - Der zu prüfende Status
   * @returns true, wenn der Status done oder declined ist
   */
  static isClosedStatus(status: string): boolean {
    return status === RequestStatus.done || status === RequestStatus.declined;
  }
}
