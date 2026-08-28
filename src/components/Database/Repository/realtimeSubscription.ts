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
 * Parameter für {@link subscribeWithRetry}.
 *
 * @param client - Der Supabase-Client.
 * @param channelName - Eindeutiger Channel-Name; dient zugleich als Label in
 *   Breadcrumbs und Fehlermeldungen (z.B. `event:<uuid>`).
 * @param bindings - Tabellen, deren Änderungen `onChange` auslösen.
 * @param onChange - Wird bei jeder relevanten DB-Änderung aufgerufen (Daten neu
 *   laden). Darf synchron oder asynchron sein; Fehler landen in `onError`.
 * @param onError - Wird nur bei dauerhaftem Verbindungsverlust (nach
 *   `maxRetries`) oder bei einem Fehler in `onChange` aufgerufen.
 * @param maxRetries - Maximale Reconnect-Versuche. Default: 5.
 */
export type SubscribeWithRetryParams = {
  client: SupabaseClient;
  channelName: string;
  bindings: RealtimeTableBinding[];
  onChange: () => void | Promise<void>;
  onError: (error: Error) => void;
  maxRetries?: number;
};

/**
 * Abonniert Realtime-Änderungen für die angegebenen Tabellen und verbindet bei
 * transienten Verbindungsabbrüchen automatisch mit exponentiellem Backoff neu.
 *
 * @param params - Siehe {@link SubscribeWithRetryParams}.
 * @returns Unsubscribe-Funktion, die den aktiven Channel entfernt und einen
 *   ausstehenden Reconnect-Timer abbricht.
 * @example
 * const unsubscribe = subscribeWithRetry({
 *   client,
 *   channelName: `event:${eventId}`,
 *   bindings: [{table: "events", filter: `id=eq.${eventId}`}],
 *   onChange: () => reloadEvent(),
 *   onError: (error) => Sentry.captureException(error),
 * });
 * // Später: unsubscribe();
 */
export function subscribeWithRetry({
  client,
  channelName,
  bindings,
  onChange,
  onError,
  maxRetries = DEFAULT_MAX_RETRIES,
}: SubscribeWithRetryParams): () => void {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let activeChannel: ReturnType<typeof client.channel> | null = null;
  let cancelled = false;

  /** Ruft onChange auf und leitet synchrone wie asynchrone Fehler an onError. */
  const handleChange = () => {
    try {
      const result = onChange();
      if (result instanceof Promise) {
        result.catch((error: unknown) =>
          onError(error instanceof Error ? error : new Error(String(error))),
        );
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
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
        // Erfolgreich verbunden — Retry-Zähler zurücksetzen.
        retryCount = 0;
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
          const permanentError = new Error(
            `Realtime-Verbindung für ${channelName} nach ${maxRetries} Versuchen fehlgeschlagen`,
          );
          Sentry.captureException(permanentError, {
            extra: {channelName, retryCount},
          });
          onError(permanentError);
          return;
        }

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

  return () => {
    cancelled = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (activeChannel) {
      client.removeChannel(activeChannel);
      activeChannel = null;
    }
  };
}
