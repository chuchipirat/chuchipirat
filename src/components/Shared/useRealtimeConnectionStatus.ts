/**
 * Hook zum Bündeln mehrerer gleichzeitiger Realtime-Subscriptions einer Seite
 * zu einem einzigen, aggregierten Verbindungsstatus für die UI.
 *
 * Eine Seite wie die Event-Detailseite hält mehrere unabhängige
 * `subscribeWithRetry`-Subscriptions (Event, Menuplan, Einkaufsliste, …).
 * Nutzer:innen interessiert nicht, WELCHER einzelne Kanal gerade Probleme
 * hat — nur, ob die Live-Aktualisierung insgesamt funktioniert. Dieser Hook
 * registriert pro Subscription einen Status + eine `reconnect()`-Funktion und
 * liefert einen aggregierten Gesamtstatus sowie eine `retryAll()`-Funktion für
 * einen zentralen "Erneut versuchen"-Button.
 */
import {useCallback, useMemo, useRef, useState} from "react";
import {RealtimeConnectionStatus} from "../Database/Repository/realtimeSubscription";

/**
 * Aggregiert mehrere Einzelstatus zu einem Gesamtstatus.
 *
 * `failed` hat Vorrang vor `reconnecting` — sobald auch nur eine Subscription
 * endgültig aufgegeben hat, soll der "Erneut versuchen"-Hinweis erscheinen,
 * selbst wenn andere Subscriptions noch automatisch retryen.
 *
 * @param statuses - Die Einzelstatus aller aktuell registrierten Subscriptions.
 * @returns Der aggregierte Gesamtstatus (`connected`, wenn `statuses` leer ist).
 * @example
 * aggregateRealtimeStatus(["connected", "reconnecting"]) // "reconnecting"
 * aggregateRealtimeStatus(["reconnecting", "failed"])    // "failed"
 */
export function aggregateRealtimeStatus(
  statuses: RealtimeConnectionStatus[],
): RealtimeConnectionStatus {
  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("reconnecting")) return "reconnecting";
  return "connected";
}

/**
 * Rückgabewert von {@link useRealtimeConnectionStatus}.
 *
 * @param overallStatus - Aggregierter Status über alle registrierten Subscriptions.
 * @param register - Registriert die `reconnect()`-Funktion einer Subscription unter einem Key.
 * @param unregister - Entfernt eine Subscription wieder (z.B. im Effect-Cleanup).
 * @param setStatus - Aktualisiert den Status einer einzelnen Subscription.
 * @param retryAll - Ruft `reconnect()` auf allen aktuell registrierten Subscriptions auf.
 */
export type UseRealtimeConnectionStatusResult = {
  overallStatus: RealtimeConnectionStatus;
  register: (key: string, reconnect: () => void) => void;
  unregister: (key: string) => void;
  setStatus: (key: string, status: RealtimeConnectionStatus) => void;
  retryAll: () => void;
};

/**
 * Bündelt den Verbindungsstatus mehrerer Realtime-Subscriptions einer Seite.
 *
 * @returns Siehe {@link UseRealtimeConnectionStatusResult}.
 * @example
 * const realtime = useRealtimeConnectionStatus();
 *
 * useEffect(() => {
 *   const {unsubscribe, reconnect} = database.events.subscribeToEvent(
 *     eventUid, onData, onError,
 *     (status) => realtime.setStatus("event", status),
 *   );
 *   realtime.register("event", reconnect);
 *   return () => { unsubscribe(); realtime.unregister("event"); };
 * }, []);
 *
 * <RealtimeStatusBanner status={realtime.overallStatus} onRetry={realtime.retryAll} />
 */
export function useRealtimeConnectionStatus(): UseRealtimeConnectionStatusResult {
  const [statuses, setStatuses] = useState<
    Record<string, RealtimeConnectionStatus>
  >({});
  const reconnectFnsRef = useRef<Record<string, () => void>>({});

  const register = useCallback((key: string, reconnect: () => void) => {
    reconnectFnsRef.current[key] = reconnect;
  }, []);

  const unregister = useCallback((key: string) => {
    delete reconnectFnsRef.current[key];
    setStatuses((prev) => {
      if (!(key in prev)) return prev;
      const next = {...prev};
      delete next[key];
      return next;
    });
  }, []);

  const setStatus = useCallback(
    (key: string, status: RealtimeConnectionStatus) => {
      setStatuses((prev) => ({...prev, [key]: status}));
    },
    [],
  );

  const retryAll = useCallback(() => {
    Object.values(reconnectFnsRef.current).forEach((reconnect) => reconnect());
  }, []);

  const overallStatus = useMemo(
    () => aggregateRealtimeStatus(Object.values(statuses)),
    [statuses],
  );

  return {overallStatus, register, unregister, setStatus, retryAll};
}
