import * as Sentry from "@sentry/react";
import Firebase from "../../Firebase/firebase.class";
import {ChangeRecord} from "../../Shared/global.interface";
import {Event} from "./event.class";

interface Delete {
  event: Event;
  firebase: Firebase;
}

interface GetShortEvents {
  firebase: Firebase;
}

export class EventShort {
  uid: string;
  name: string;
  motto: string;
  location: string;
  noOfCooks: number;
  numberOfDays: number;
  startDate: Date;
  endDate: Date;
  created: ChangeRecord;
  pictureSrc: string;

  // ===================================================================== */
  /**
   * Konstruktor der Klasse
   */
  constructor() {
    this.uid = "";
    this.name = "";
    this.motto = "";
    this.location = "";
    this.noOfCooks = 0;
    this.numberOfDays = 0;
    this.startDate = new Date(0);
    this.endDate = new Date(0);
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.pictureSrc = "";
  }
  // ===================================================================== */
  /**
   * Kurz-Event aus Event erzeugen
   * @param event Objekt Event
   * @returns Kurz-Event
   */
  static createShortEventFromEvent(event: Event): EventShort {
    return {
      uid: event.uid,
      name: event.name,
      motto: event.motto,
      location: event.location,
      noOfCooks: event.authUsers.length,
      numberOfDays: Event.defineEventDuration(event.dates),
      startDate: event.dates[0].from,
      endDate: event.maxDate,
      created: event.created,
      pictureSrc: event.pictureSrc,
    };
  }
  // ===================================================================== */
  /**
   * Eintrag löschen
   * Anhand der Zeitscheiben, ein Array mit allen Daten erstellen
   * @param Object - Objekt mit Angepasstem Event und Menüplan
   * @returns boolean - Hat die Anpassung zur Folge, dass geplante Tage
   *                    gelöscht werden.
   */
  static delete = async ({event, firebase}: Delete) => {
    firebase.eventShort
      .deleteField({fieldName: event.uid, uids: []})
      .catch((error) => {
        Sentry.captureException(error);
        throw error;
      });
  };
  // ===================================================================== */
  /**
   * Alle Anlässe (in Kurzform) holen. Es wird das Dokument ausgelesen, welches
   * alle Anlässe beinhaltet. Die Methode ändert den Aufbau von einem Objekt
   * (pro Property ein Anlass) zu einem Array mit einem Anlass pro Eintrag
   * @param param0 - Objekt mit Firebase-Referenz und authUser
   */
  static async getShortEvents({firebase}: GetShortEvents) {
    const eventsShort: EventShort[] = [];

    await firebase.eventShort.read<EventShort>({uids: []}).then((result) => {
      Object.entries(result).forEach(([key, value]) => {
        eventsShort.push({
          uid: key,
          name: value.name,
          motto: value.motto,
          location: value.location,
          noOfCooks: value.noOfCooks,
          numberOfDays: value.numberOfDays,
          startDate: value.startDate,
          endDate: value.endDate,
          created: value.created,
          pictureSrc: value.pictureSrc,
        });
      });
    });
    return eventsShort;
  }
}

export {EventShort};
