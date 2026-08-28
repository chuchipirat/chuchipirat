/**
 * Helfer zum Erstellen von Aktivitäts-Feed-Einträgen.
 *
 * Feed-Einträge (Aktivitätsübersicht: „Einkaufsliste erstellt", „Rezept
 * bewertet" …) sind rein kosmetisch. Ihr Erstellen läuft „fire-and-forget":
 * Ein Fehlschlag bleibt für den Nutzer folgenlos und darf weder sichtbar
 * werden noch — bei einem vorübergehenden Netzfehler — Sentry fluten.
 */
import * as Sentry from "@sentry/react";

import type {DatabaseService} from "../Database/DatabaseService";
import type {CreateFeedParams} from "../Database/Repository/FeedRepository";
import type {AuthUser} from "../Session/authUser.class";
import {isTransientNetworkError, toError} from "../../utils/errorUtils";

/**
 * Parameter für {@link postActivityFeed}.
 *
 * @param database - Die DatabaseService-Instanz.
 * @param feed - Die Feed-Parameter (Typ, Quellobjekt, Zusatzdaten).
 * @param authUser - Der angemeldete Benutzer.
 * @param context - Kurzbeschreibung der auslösenden Aktion für den Sentry-Kontext
 *   (z.B. "Einkaufsliste erstellt").
 */
export type PostActivityFeedParams = {
  database: DatabaseService;
  feed: CreateFeedParams;
  authUser: AuthUser;
  context: string;
};

/**
 * Erstellt einen Aktivitäts-Feed-Eintrag ohne den Aufrufer zu blockieren.
 *
 * Vorübergehende Netzfehler werden verschluckt (der Eintrag ist verzichtbar),
 * alle übrigen Fehler als normalisierter `Error` mit Kontext an Sentry
 * gemeldet — genau einmal, auf Level `warning`.
 *
 * @param params - Siehe {@link PostActivityFeedParams}.
 * @returns Nichts — der Aufruf ist bewusst „fire-and-forget".
 * @example
 * postActivityFeed({
 *   database,
 *   feed: {feedType: FeedType.shoppingListCreated, sourceObjectType: "event", sourceObjectUid: event.uid},
 *   authUser,
 *   context: "Einkaufsliste erstellt",
 * });
 */
export function postActivityFeed({
  database,
  feed,
  authUser,
  context,
}: PostActivityFeedParams): void {
  database.feeds.insertFeed(feed, authUser).catch((error: unknown) => {
    if (isTransientNetworkError(error)) return;
    Sentry.captureException(toError(error), {
      level: "warning",
      extra: {context: `Aktivitäts-Feed: ${context}`},
    });
  });
}
