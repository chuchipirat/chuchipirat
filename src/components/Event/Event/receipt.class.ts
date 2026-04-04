import * as Sentry from "@sentry/react";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Firebase from "../../Firebase/firebase.class";
import {ChangeRecord} from "../../Shared/global.interface";
import {Event,EventRefDocuments} from "./event.class";

interface Save {
  firebase: Firebase;
  receipt: Receipt;
  authUser: AuthUser;
}
interface GetReceipt {
  firebase: Firebase;
  eventUid: Event["uid"];
}

export class Receipt {
  eventUid: Event["uid"];
  eventName: Event["name"];
  payDate: Date;
  amount: number;
  donorName: string;
  donorEmail: string;
  created: ChangeRecord;

  constructor() {
    this.eventUid = "";
    this.eventName = "";
    this.payDate = new Date();
    this.amount = 0;
    this.donorEmail = "";
    this.donorName = "";
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }  static save = async ({firebase, authUser, receipt}: Save) => {
    receipt.created = {
      fromDisplayName: authUser.publicProfile.displayName,
      fromUid: authUser.uid,
      date: new Date(),
    };

    await firebase.event.receipt.set({
      uids: [receipt.eventUid],
      value: {...receipt},
      authUser: authUser,
    });

    // @ts-expect-error — Legacy Firebase-Methode, wird bei Migration entfernt
    await Event.getEvent({firebase: firebase, uid: receipt.eventUid}).then(
      (result) => {
        if (!result.refDocuments?.includes(EventRefDocuments.receipt)) {
          result.refDocuments = Event.addRefDocument({
            refDocuments: result.refDocuments,
            newDocumentType: EventRefDocuments.receipt,
          });

          // @ts-expect-error — Legacy Firebase-Methode, wird bei Migration entfernt
          Event.save({
            firebase: firebase,
            event: result,
            authUser: authUser,
          }).catch((error) => {
            Sentry.captureException(error);
            throw error;
          });
        }
      }
    );
  };  static getReceipt = async ({firebase, eventUid}: GetReceipt) => {
    return firebase.event.receipt
      .read<Receipt>({uids: [eventUid]})
      .then((result) => {
        return result;
      });
  };
}
