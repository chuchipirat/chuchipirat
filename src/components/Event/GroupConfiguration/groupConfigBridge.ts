/**
 * Bridge-Funktionen für die Konvertierung zwischen der Firebase-Klassenstruktur
 * (EventGroupConfiguration) und dem Supabase-Domain-Modell (GroupConfigDomain).
 *
 * Wird während der Migration benötigt, damit UI-Komponenten mit beiden
 * Datenformaten arbeiten können.
 */
import EventGroupConfiguration, {
  Diet,
  Intolerance,
  Portions,
} from "./groupConfiguration.class";
import {
  GroupConfigDomain,
  GroupConfigItemDomain,
  PortionEntryDomain,
} from "../../Database/Repository/EventGroupConfigRepository";

/**
 * Konvertiert ein Supabase-GroupConfigDomain in eine Firebase-EventGroupConfiguration-Instanz.
 *
 * Die Diäten und Unverträglichkeiten werden nach `sortOrder` sortiert. Die verschachtelte
 * Portionenmatrix wird aus der flachen `domain.portions`-Liste aufgebaut. Abschliessend
 * werden die Totale via `EventGroupConfiguration.calculateTotals()` berechnet.
 *
 * @param domain Das GroupConfigDomain-Objekt aus dem Supabase-Repository.
 * @param eventUid Die UID des zugehörigen Events (wird als `uid` auf der Klasseninstanz gesetzt).
 * @returns Eine vollständig befüllte EventGroupConfiguration-Instanz mit berechneten Totalen.
 *
 * @example
 * const gc = groupConfigDomainToClass(domain, "event-123");
 * console.log(gc.totalPortions); // z.B. 42
 */
export function groupConfigDomainToClass(
  domain: GroupConfigDomain,
  eventUid: string
): EventGroupConfiguration {
  const groupConfig = new EventGroupConfiguration();
  groupConfig.uid = eventUid;

  // Diäten nach sortOrder sortieren und in die entries/order-Struktur überführen
  const sortedDiets = [...domain.diets].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const diet of sortedDiets) {
    const dietEntry: Diet = {
      uid: diet.uid,
      name: diet.name,
      totalPortions: 0, // Wird durch calculateTotals() berechnet
    };
    groupConfig.diets.entries[diet.uid] = dietEntry;
    groupConfig.diets.order.push(diet.uid);
  }

  // Unverträglichkeiten nach sortOrder sortieren und in die entries/order-Struktur überführen
  const sortedIntolerances = [...domain.intolerances].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const intolerance of sortedIntolerances) {
    const intoleranceEntry: Intolerance = {
      uid: intolerance.uid,
      name: intolerance.name,
      totalPortions: 0, // Wird durch calculateTotals() berechnet
    };
    groupConfig.intolerances.entries[intolerance.uid] = intoleranceEntry;
    groupConfig.intolerances.order.push(intolerance.uid);
  }

  // Verschachtelte Portionenmatrix aufbauen: portions[dietId][intoleranceId] = servings
  // Zuerst leere Struktur initialisieren
  for (const dietUid of groupConfig.diets.order) {
    const intolerancePortions: {[key: string]: number} = {};
    for (const intUid of groupConfig.intolerances.order) {
      intolerancePortions[intUid] = 0;
    }
    groupConfig.portions[dietUid] = intolerancePortions;
  }

  // Dann die tatsächlichen Werte einfüllen
  for (const portion of domain.portions) {
    if (
      groupConfig.portions[portion.dietId] !== undefined &&
      groupConfig.portions[portion.dietId][portion.intoleranceId] !== undefined
    ) {
      groupConfig.portions[portion.dietId][portion.intoleranceId] =
        portion.servings;
    }
  }

  // Totale berechnen (totalPortions pro Diät, pro Unverträglichkeit und gesamt)
  EventGroupConfiguration.calculateTotals({groupConfig});

  return groupConfig;
}

/**
 * Konvertiert eine Firebase-EventGroupConfiguration-Instanz in das flache
 * Supabase-GroupConfigDomain-Format für das Repository.
 *
 * Die `diets.order`- und `intolerances.order`-Arrays bestimmen die Sortierreihenfolge
 * (Index × 10 als sortOrder). Die verschachtelte Portionenmatrix wird in eine flache
 * Liste von PortionEntryDomain-Objekten überführt. Neue Einträge erhalten eine leere
 * uid — die ID-Vergabe übernimmt das Repository.
 *
 * @param gc Die EventGroupConfiguration-Instanz mit der verschachtelten Map-Struktur.
 * @param eventId Die ID des zugehörigen Events in Supabase.
 * @returns Ein flaches GroupConfigDomain für `saveGroupConfig()`.
 *
 * @example
 * const domain = groupConfigClassToDomain(groupConfig, "event-123");
 * await repo.saveGroupConfig(domain, authUser);
 */
export function groupConfigClassToDomain(
  gc: EventGroupConfiguration,
  eventId: string
): GroupConfigDomain {
  // Diäten in die flache Domain-Struktur überführen
  const diets: GroupConfigItemDomain[] = gc.diets.order.map(
    (dietUid, index) => ({
      uid: dietUid,
      name: gc.diets.entries[dietUid].name,
      sortOrder: index * 10,
    })
  );

  // Unverträglichkeiten in die flache Domain-Struktur überführen
  const intolerances: GroupConfigItemDomain[] = gc.intolerances.order.map(
    (intUid, index) => ({
      uid: intUid,
      name: gc.intolerances.entries[intUid].name,
      sortOrder: index * 10,
    })
  );

  // Verschachtelte Portionenmatrix in eine flache Liste umwandeln
  const portions: PortionEntryDomain[] = [];
  for (const dietUid of gc.diets.order) {
    for (const intUid of gc.intolerances.order) {
      portions.push({
        uid: "",
        dietId: dietUid,
        intoleranceId: intUid,
        servings: gc.portions[dietUid]?.[intUid] ?? 0,
      });
    }
  }

  return {
    eventId,
    diets,
    intolerances,
    portions,
  };
}
