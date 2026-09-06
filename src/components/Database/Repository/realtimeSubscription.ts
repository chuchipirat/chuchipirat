/**
 * Gemeinsamer Helfer für Supabase-Realtime-Subscriptions mit automatischem
 * Reconnect.
 *
 * Ein `CHANNEL_ERROR` bzw. `TIMED_OUT` von Supabase Realtime tritt bei jedem
 * transienten WebSocket-Abbruch auf (Netz-Blip, Standby, Tab im Hintergrund,
 * Server-Neustart, Token-Refresh). Solche Abbrüche sind erwartbar und dürfen
 * nicht als Fehler gemeldet werden — stattdessen wird mit exponentiellem
 * Backoff neu verbunden. Erst wenn der Reconnect `maxRetries` Mal scheitert,
 * gilt die Verbindung als dauerhaft verloren.
 */
import * as Sentry from "@sentry/react";
import {SupabaseClient} from "@supabase/supabase-js";
import {isTransientNetworkError, toError} from "../../../utils/errorUtils";

/** Basis-Verzögerung für den exponentiellen Backoff (1s). */
const BASE_DELAY_MS = 1000;
/** Obergrenze für die Backoff-Verzögerung (30s). */
const MAX_DELAY_MS = 30_000;
/** Standard-Anzahl an Reconnect-Versuchen vor dem permanenten Fehler. */
const DEFAULT_MAX_RETRIES = 5;

/**
 * Beschreibt eine Tabelle im `public`-Schema, deren Änderungen den
 * `onChange`-Callback auslösen sollen.
 *
 * @param table - Tabellenname im `public`-Schema.
 * @param filter - PostgREST-Filterausdruck, z.B. `event_id=eq.<uuid>`.
 * @param event - Zu überwachende Änderungsart. Default: `*` (alle).
 */
export type RealtimeTableBinding = {
  table: string;
  filter: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
};

/**
 * Verbindungsstatus einer Realtime-Subscription, für die UI gedacht.
 *
 * - `connected` — verbunden (oder noch nie ein Problem hatte, siehe unten).
 * - `reconnecting` — ein Verbindungsabbruch wird gerade automatisch behoben.
 * - `failed` — alle automatischen Versuche ausgeschöpft; nur noch ein
 *   manueller {@link RealtimeSubscriptionHandle.reconnect} hilft.
 *
 * `onStatusChange` wird bewusst NICHT beim ganz ersten erfolgreichen Connect
 * aufgerufen (kein UI-Flackern bei normalem Seitenaufruf) — erst ab dem
 * ersten tatsächlichen Problem, danach auch wieder bei Erholung.
 */
export type RealtimeConnectionStatus = "connected" | "reconnecting" | "failed";

/**
 * Rückgabewert von {@link subscribeWithRetry}.
 *
 * @param unsubscribe - Entfernt den aktiven Channel und bricht einen
 *   ausstehenden Reconnect-Timer ab.
 * @param reconnect - Bricht einen laufenden Retry-Zyklus ab und startet sofort
 *   neu, mit frischem Retry-Budget (z.B. für einen "Erneut versuchen"-Button).
 */
export type RealtimeSubscriptionHandle = {
  unsubscribe: () => void;
  reconnect: () => void;
};

/**
 * Parameter für {@link subscribeWithRetry}.
 *
 * @param client - Der Supabase-Client.
 * @param channelName - Eindeutiger Channel-Name; dient zugleich als Label in
 *   Breadcrumbs und Fehlermeldungen (z.B. `event:<uuid>`).
 * @param bindings - Tabellen, deren Änderungen `onChange` auslösen.
 * @param onChange - Wird bei jeder relevanten DB-Änderung aufgerufen (Daten neu
 *   laden). Darf synchron oder asynchron sein; Fehler landen in `onError`.
 * @param onError - Wird NUR bei einem Fehler in `onChange` aufgerufen (z.B.
 *   Reload nach Realtime-Event schlägt fehl). Ein dauerhafter Verbindungsverlust
 *   (nach `maxRetries`) läuft stattdessen über `onStatusChange` — Sentry wird
 *   dafür bereits intern einmalig gemeldet, keine Doppelmeldung nötig.
 * @param onStatusChange - Optional: wird bei Statuswechseln aufgerufen (siehe
 *   {@link RealtimeConnectionStatus}) — zum Anzeigen eines
 *   Reconnect-Hinweises in der UI.
 * @param maxRetries - Maximale Reconnect-Versuche. Default: 5.
 */
export type SubscribeWithRetryParams = {
  client: SupabaseClient;
  channelName: string;
  bindings: RealtimeTableBinding[];
  onChange: () => void | Promise<void>;
  onError: (error: Error) => void;
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
  maxRetries?: number;
};

/**
 * Abonniert Realtime-Änderungen für die angegebenen Tabellen und verbindet bei
 * transienten Verbindungsabbrüchen automatisch mit exponentiellem Backoff neu.
 *
 * @param params - Siehe {@link SubscribeWithRetryParams}.
 * @returns {@link RealtimeSubscriptionHandle} mit `unsubscribe()` und `reconnect()`.
 * @example
 * const {unsubscribe, reconnect} = subscribeWithRetry({
 *   client,
 *   channelName: `event:${eventId}`,
 *   bindings: [{table: "events", filter: `id=eq.${eventId}`}],
 *   onChange: () => reloadEvent(),
 *   onError: (error) => Sentry.captureException(error),
 *   onStatusChange: (status) => setConnectionStatus(status),
 * });
 * // Später: unsubscribe(); oder bei Bedarf: reconnect();
 */
export function subscribeWithRetry({
  client,
  channelName,
  bindings,
  onChange,
  onError,
  onStatusChange,
  maxRetries = DEFAULT_MAX_RETRIES,
}: SubscribeWithRetryParams): RealtimeSubscriptionHandle {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let activeChannel: ReturnType<typeof client.channel> | null = null;
  let cancelled = false;
  // Nur gesetzt, nachdem onStatusChange mindestens einmal mit "reconnecting"
  // oder "failed" aufgerufen wurde — steuert, ob ein SUBSCRIBED als
  // "Erholung" gilt (dann onStatusChange("connected")) oder als stiller
  // Normalfall (dann keine Meldung, kein UI-Flackern).
  let lastReportedStatus: RealtimeConnectionStatus | null = null;

  /**
   * Meldet einen Fehler aus `onChange`. Vorübergehende Netzfehler (z.B. während
   * eines Reconnect-Fensters) werden verschluckt — das nächste erfolgreiche
   * Realtime-Event lädt die Daten ohnehin erneut. Alle übrigen Werte werden in
   * eine echte `Error`-Instanz normalisiert (Supabase wirft rohe Objekte, deren
   * `String()` sonst als "[object Object]" in Sentry landet).
   */
  const reportChangeError = (error: unknown) => {
    if (isTransientNetworkError(error)) return;
    onError(toError(error));
  };

  /** Ruft onChange auf und leitet synchrone wie asynchrone Fehler weiter. */
  const handleChange = () => {
    try {
      const result = onChange();
      if (result instanceof Promise) {
        result.catch(reportChangeError);
      }
    } catch (error) {
      reportChangeError(error);
    }
  };

  /**
   * Baut den Channel auf und abonniert ihn. Bei `CHANNEL_ERROR`/`TIMED_OUT`
   * wird der Channel entfernt und nach Backoff-Verzögerung erneut aufgebaut.
   */
  const connect = () => {
    if (cancelled) return;

    let channel = client.channel(channelName);
    for (const binding of bindings) {
      channel = channel.on(
        "postgres_changes",
        {
          event: binding.event ?? "*",
          schema: "public",
          table: binding.table,
          filter: binding.filter,
        },
        handleChange,
      );
    }

    channel.subscribe((status, err) => {
      if (cancelled) return;

      if (status === "SUBSCRIBED") {
        // Erfolgreich verbunden — Retry-Zähler zurücksetzen. Nur als
        // "Erholung" an die UI melden, wenn zuvor tatsächlich ein Problem
        // gemeldet wurde — der ganz normale erste Connect bleibt still.
        retryCount = 0;
        if (lastReportedStatus !== null) {
          lastReportedStatus = null;
          onStatusChange?.("connected");
        }
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        Sentry.addBreadcrumb({
          category: "realtime",
          message: `${channelName} ${status} (Versuch ${retryCount + 1}/${maxRetries})`,
          level: "warning",
          data: {channelName, status, error: err?.message},
        });

        client.removeChannel(channel);
        activeChannel = null;

        if (retryCount >= maxRetries) {
          // Endgültig aufgegeben — einmalig an Sentry melden (nicht über
          // onError, das ist ausschliesslich für onChange-Fehler reserviert;
          // sonst würde jede Aufrufstelle das hier ein zweites Mal melden).
          const permanentError = new Error(
            `Realtime-Verbindung für ${channelName} nach ${maxRetries} Versuchen fehlgeschlagen`,
          );
          Sentry.captureException(permanentError, {
            extra: {channelName, retryCount},
          });
          lastReportedStatus = "failed";
          onStatusChange?.("failed");
          return;
        }

        lastReportedStatus = "reconnecting";
        onStatusChange?.("reconnecting");

        // Exponentieller Backoff: 1s, 2s, 4s, 8s, 16s (gedeckelt bei 30s).
        const delay = Math.min(
          BASE_DELAY_MS * Math.pow(2, retryCount),
          MAX_DELAY_MS,
        );
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      }
    });

    activeChannel = channel;
  };

  connect();

  return {
    unsubscribe: () => {
      cancelled = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (activeChannel) {
        client.removeChannel(activeChannel);
        activeChannel = null;
      }
    },
    reconnect: () => {
      if (cancelled) return;

      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (activeChannel) {
        client.removeChannel(activeChannel);
        activeChannel = null;
      }

      // Sofortige, optimistische Rückmeldung — der eigentliche Connect
      // braucht noch einen Moment.
      retryCount = 0;
      lastReportedStatus = "reconnecting";
      onStatusChange?.("reconnecting");
      connect();
    },
  };
}
