import MailTemplate from "../../constants/mailTemplates";
import {Request} from "./internal";

import {ImageRepository} from "../../constants/imageRepository";

import {ValueObject} from "../Firebase/Db/firebase.db.super.class";

import {REQUEST_STATUS_TRANSITION_REPORT_ERROR as TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR} from "../../constants/text";
import {
  CreateRequestPostFunction,
  PrepareObjectForRequestCreation,
  RequestStatus,
  RequestTransition,
  RequestType,
  TransitionPostFunction,
} from "./request.class";
import {RecipientType} from "../Admin/mailConsole.class";
import Role from "../../constants/roles";

/**
 * Klasse für den Rezept-Review Prozess
 * @param uid: UID String des Files auf der DB
 * @param number: Request Nummer
 * @param status: Aktueller Status des Requests
 * @param date: Datum an dem der Request erstellt wurde
 * @param recipe: Objekt mit UID und Name des Rezeptes
 * @param author: Objekt mit UID, Display-Name, Vor-, Nachname und E-Mailadresse des\*r Rezeptautor\*in
 */
export class RequestReportError extends Request {
  uid: string;
  number: number;
  status: Request["status"];
  author: Request["author"];
  assignee: Request["assignee"];
  comments: Request["comments"];
  changeLog: Request["changeLog"];
  createDate: Request["createDate"];
  resolveDate: Request["resolveDate"];
  requestObject: Request["requestObject"];
  requestType: Request["requestType"];
  transitions: Request["transitions"];
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor() {
    super();
    this.uid = "";
    this.number = 0;
    this.status = RequestStatus.created;
    this.createDate = new Date();
    this.resolveDate = new Date("9999-12-31");
    this.author = {} as Request["author"];
    this.assignee = {} as Request["assignee"];
    this.comments = [];
    this.changeLog = [];
    this.requestObject = {};
    this.requestType = RequestType.reportError;
    this.transitions = this.definitionTransitions();
  }
  /* =====================================================================
  // Übergänge definieren
  // ===================================================================== */
  definitionTransitions(): Array<RequestTransition> {
    return [
      {
        fromState: RequestStatus.created,
        toState: RequestStatus.inReview,
        description:
          TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.inReview
            .description,
      },
      {
        fromState: RequestStatus.inReview,
        toState: RequestStatus.declined,
        description:
          TEXT_REQUEST_STATUS_TRANSITION_REPORT_ERROR.created.declined
            .description,
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
    ];
  }
  /* =====================================================================
  // PostFunctionos nach einem Übergäng
  // ===================================================================== */
  static async transitionPostFunction({
    request,
    firebase,
    authUser,
  }: TransitionPostFunction) {
    switch (request.status) {
      case RequestStatus.done:
        // Mail auslösen // --> über cloud Function! weil Adresse unbekannt.
        firebase.cloudFunction.sendMail.triggerCloudFunction({
          values: {
            templateData: {
              recipeName: request.requestObject.name,
              headerPictureSrc: request.requestObject.pictureSrc,
              recipeUid: request.requestObject.uid,
              requestNumber: request.number,
            },
            recipients: request.author.uid,
            recipientType: RecipientType.uid,
            mailTemplate: MailTemplate.requestReportErrorFixed,
          },
          authUser: authUser,
        });

        break;
      case RequestStatus.declined:
        //TODO: Mail auslösen
        break;
      default:
        return;
    }
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareObjectForRequestCreation<T extends ValueObject>({
    requestObject,
  }: PrepareObjectForRequestCreation<T>): Record<string, unknown> {
    return {
      name: requestObject.name,
      uid: requestObject.uid,
      pictureSrc: requestObject.pictureSrc
        ? requestObject.pictureSrc
        : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA,
    };
  }
  /* =====================================================================
  // Postfunction --> Mail auslösen
  // ===================================================================== */
  createRequestPostFunction({
    firebase,
    request,
    authUser,
  }: CreateRequestPostFunction) {
    // Mail auslösen --> Die Adressen der Content-Admins werden per
    // Cloudfunction ausgelesen (Datenschutz!)
    firebase.cloudFunction.sendMail.triggerCloudFunction({
      values: {
        recipients: Role.communityLeader,
        recipientType: RecipientType.role,
        mailTemplate: MailTemplate.newReportErrorRequest,
        templateData: {
          recipeName: request.requestObject.name,
          headerPictureSrc: request.requestObject.pictureSrc,
          requestAuthor: authUser.publicProfile.displayName,
          requestNumber: request.number,
        },
      },
      authUser: authUser,
    });
  }
  /* =====================================================================
  // Bestimmen was für Status nachfolgend möglich sind
  // ===================================================================== */
  static getNextPossibleTransitions(
    status: RequestStatus,
  ): Array<RequestTransition> {
    // Übergänge holen
    const request = new RequestReportError();

    return request.transitions.filter(
      (transition) => transition.fromState == status,
    );
  }
}
