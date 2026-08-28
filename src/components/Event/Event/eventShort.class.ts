import {ChangeRecord} from "../../Shared/global.interface";
import {Event} from "./event.class";

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
}
