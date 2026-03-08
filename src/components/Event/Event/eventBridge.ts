import Event, {Cook, EventDate} from "./event.class";
import {
  EventDomain,
  EventDateDomain,
  EventCookDomain,
} from "../../Database/Repository/EventRepository";

/**
 * Konvertiert ein EventDomain-Objekt (Supabase) in eine Event-Klasseninstanz (Firebase-Struktur).
 * Köche werden nur mit der userId gemappt – die öffentlichen Profildaten (displayName, motto,
 * pictureSrc) sind im Domain nicht vorhanden und müssen separat geladen werden.
 *
 * @param domain - Das EventDomain-Objekt aus dem Supabase-Repository.
 * @returns Eine befüllte Event-Instanz.
 *
 * @example
 * const event = eventDomainToClass(domainFromRepo);
 * console.log(event.name); // z.B. "Sommerfest"
 */
export function eventDomainToClass(domain: EventDomain): Event {
  const event = new Event();

  event.uid = domain.uid;
  event.name = domain.name;
  event.motto = domain.motto;
  event.location = domain.location;
  event.pictureSrc = domain.pictureSrc;

  // Köche: Nur userId ist aus dem Domain verfügbar.
  // Die UI muss die öffentlichen Profile separat laden.
  event.cooks = domain.cooks.map(
    (cookDomain: EventCookDomain): Cook => ({
      uid: cookDomain.userId,
      displayName: "",
      motto: "",
      pictureSrc: "",
    }),
  );

  // Zeitscheiben: sortOrder wird als index * 10 gespeichert
  event.dates = domain.dates.map(
    (dateDomain: EventDateDomain): EventDate => ({
      uid: dateDomain.uid,
      pos: dateDomain.sortOrder / 10,
      from: dateDomain.dateFrom,
      to: dateDomain.dateTo,
    }),
  );

  // Leere Datumszeile anhängen, damit die UI immer eine neue Zeile zum Bearbeiten hat
  const emptyDate = Event.createDateEntry();
  emptyDate.pos = event.dates.length + 1;
  event.dates.push(emptyDate);

  // Audit-Felder
  event.created = {
    date: domain.createdAt,
    fromUid: domain.createdBy ?? "",
    fromDisplayName: "",
  };
  event.lastChange = {
    date: domain.updatedAt,
    fromUid: domain.updatedBy ?? "",
    fromDisplayName: "",
  };

  // Berechtigte Benutzer aus den Köchen extrahieren
  event.authUsers = domain.cooks.map((c) => c.userId);

  // maxDate aus den Zeitscheiben berechnen (analog zu Event.prepareSave)
  if (event.dates.length > 0) {
    event.maxDate = event.dates.reduce((maxDate, currentDate) => {
      return currentDate.to > maxDate.to ? currentDate : maxDate;
    }, event.dates[0]).to;
    event.maxDate = new Date(event.maxDate.getTime());
    event.maxDate.setHours(0, 0, 0, 0);
  }

  // Anzahl Tage berechnen
  event.numberOfDays = Event.defineEventDuration(event.dates);

  return event;
}

/**
 * Konvertiert eine Event-Klasseninstanz (Firebase-Struktur) in ein EventDomain-Objekt (Supabase).
 * Köche und Zeitscheiben werden als leere Arrays gesetzt, da diese über separate
 * Repository-Methoden (addCook/removeCook, saveDates) verwaltet werden.
 *
 * @param event - Die Event-Klasseninstanz.
 * @returns Ein EventDomain-Objekt für das Supabase-Repository.
 *
 * @example
 * const domain = eventClassToDomain(event);
 * await eventRepository.updateEvent(domain, authUser);
 */
export function eventClassToDomain(event: Event): EventDomain {
  return {
    uid: event.uid,
    name: event.name,
    motto: event.motto,
    location: event.location,
    pictureSrc: event.pictureSrc,
    cooks: [], // Köche werden separat via addCook/removeCook verwaltet
    dates: [], // Zeitscheiben werden separat via saveDates verwaltet
    createdAt: event.created.date,
    createdBy: event.created.fromUid || null,
    updatedAt: event.lastChange.date,
    updatedBy: event.lastChange.fromUid || null,
  };
}

/**
 * Konvertiert Event-Zeitscheiben (EventDate[]) in das Domain-Format für saveDates().
 * Die uid wird weggelassen, da saveDates() alle bestehenden Einträge löscht und
 * neue mit generierten IDs anlegt.
 *
 * @param dates - Array der Event-Zeitscheiben aus der Klassenstruktur.
 * @returns Array der Domain-Zeitscheiben ohne uid.
 *
 * @example
 * const dateDomains = eventDatesToDateDomains(event.dates);
 * await eventRepository.saveDates(event.uid, dateDomains, authUser);
 */
export function eventDatesToDateDomains(
  dates: EventDate[],
): Omit<EventDateDomain, "uid">[] {
  // Leere Datumszeilen herausfiltern (Epoch-Daten = Platzhalterzeilen der UI)
  return Event.deleteEmptyDates(dates).map((date) => ({
    sortOrder: date.pos * 10,
    dateFrom: date.from,
    dateTo: date.to,
  }));
}
