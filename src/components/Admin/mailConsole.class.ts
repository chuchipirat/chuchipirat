import {ImageRepository} from "../../constants/imageRepository";
import MailTemplate from "../../constants/mailTemplates";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";
import Firebase from "../Firebase/firebase.class";

export enum RecipientType {
  none,
  email,
  uid,
  role,
}

export interface MailLogOverviewStructure {
  uid: string;
  recipients: string;
  noRecipients: number;
  templateName: MailTemplate;
  timestamp: Date;
}

export interface MailLogEntry {
  uid: string;
  recipients: string[];
  noRecipients: number;
  template: {data: {[key: string]: any}; name: MailTemplate};
  timestamp: Date;
}

export interface MailProtocol {
  uid: string;
  to: string | string[];
  bcc: string | string[];
  delivery: {
    attempts: number;
    endTime: Date;
    error: string | null;
    info: {
      accepted: string[];
      messageId: string;
      pending: string[];
      rejected: string[];
      response: string;
    };
    leaseEpireTime: Date | null;
    startTime: Date;
    state: string;
  };
  template: {
    data: ValueObject;
    name: string;
  };
}

interface Send {
  firebase: Firebase;
  authUser: AuthUser;
  mailContent: Mail;
  recipients: string;
  recipientType: RecipientType;
}
interface GetMailboxOverview {
  firebase: Firebase;
}
interface GetSendProtocol {
  firebase: Firebase;
  mailUid: string;
}
interface DeleteMailProtocols {
  firebase: Firebase;
  authUser: AuthUser;
  dayOffset: number;
  mailLog: MailLogEntry[];
}
// ===================================================================== */
/**
 * Mail versenden
 * Mail über die Cloud-Fx versenden
 * @param param0 - Objekt
 */
export class Mail {
  subject: string;
  mailtext: string;
  title: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  headerPictureSrc?: string;

  // ===================================================================== */
  /**
   * Constructor
   */
  constructor() {
    this.subject = "";
    this.mailtext = "";
    this.title = "ich bin der Titel";
    this.subtitle = "";
    this.buttonLink = "";
    this.buttonText = "";
    this.headerPictureSrc =
      ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;
  }
}

class MailConsole {
  // ===================================================================== */
  /**
   * Mail versenden
   */
  static send = ({
    firebase,
    authUser,
    mailContent,
    recipients,
    recipientType,
  }: Send) => {
    firebase.cloudFunction.sendMail.triggerCloudFunction({
      values: {
        recipients: recipients,
        recipientType: recipientType,
        mailTemplate: MailTemplate.newletter,
        templateData: {
          subject: mailContent.subject,
          mailtext: mailContent.mailtext,
          title: mailContent.title,
          subtitle: mailContent?.subtitle,
          showLinkButton:
            mailContent?.buttonText && mailContent?.buttonLink ? true : false,
          buttonText: mailContent?.buttonText,
          buttonLink: mailContent?.buttonLink,
          headerPictureSrc: mailContent.headerPictureSrc,
        },
      },
      authUser: authUser,
    });
  };
  // ===================================================================== */
  /**
   * Versand-Protokoll holen
   */
  static getSendProtocol = async ({firebase, mailUid}: GetSendProtocol) => {
    return await firebase.mailbox
      .read({uids: [mailUid]})
      .then((result) => {
        result.uid = mailUid;
        return result as MailProtocol;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Mail-Log auslesen
   */
  static getMailboxOverview = async ({firebase}: GetMailboxOverview) => {
    const mailOverview: MailLogEntry[] = [];

    await firebase.mailbox.short
      .read({uids: []})
      .then((result) => {
        Object.keys(result).forEach((key) => {
          mailOverview.push({uid: key, ...result[key]});
        });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return mailOverview;
  };
  // ===================================================================== */
  /**
   * Mail-Protokolle löschen
   */
  static deleteMailProtocols = async ({
    firebase,
    authUser,
    dayOffset,
    mailLog,
  }: DeleteMailProtocols) => {
    let counter = 0;
    const offsetDate = new Date();
    offsetDate.setDate(offsetDate.getDate() - dayOffset);
    const offsetTimestamp = offsetDate.getTime();

    const deletedDocuments: Promise<void>[] = [];

    const newMailLog: {[key: string]: any} = {};
    // Dokumente löschen und Maillog gleich anpassen
    mailLog.forEach((logEntry) => {
      if (logEntry.timestamp.getTime() <= offsetTimestamp) {
        // Dokument löschen
        deletedDocuments.push(
          firebase.mailbox
            .delete({uids: [logEntry.uid]})
            .catch((error) => console.error(error)),
        );
        counter++;
      } else {
        // den behalten wir
        newMailLog[logEntry.uid] = {
          noRecipients: logEntry.noRecipients,
          recipients: logEntry.recipients,
          template: logEntry.template,
          timestamp: logEntry.timestamp,
        };
      }
    });

    await Promise.all(deletedDocuments);

    // Neue Struktur updaten
    firebase.mailbox.short
      .set({uids: [], value: newMailLog, authUser: authUser})
      .catch((error) => {
        console.error(error);
        throw error;
      });

    mailLog = mailLog.filter(
      (logEntry) => logEntry.timestamp.getTime() >= offsetTimestamp,
    );

    return {counter, mailLog};
  };
}

export default MailConsole;
