import React, {useEffect, useState} from "react";
import * as Sentry from "@sentry/react";

import {useDatabase} from "../Database/DatabaseContext";
import {isTransientNetworkError, toError} from "../../utils/errorUtils";

/** Intervall (ms), in dem der Wartungsmodus-Status im Hintergrund neu geladen wird. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Globale, für die gesamte App relevante Einstellungen (aktuell nur der
 * Wartungsmodus). Wird periodisch im Hintergrund aktualisiert, nicht in
 * Echtzeit.
 */
type GlobalSettingsState = {
  maintenanceMode: boolean;
};

const initialState: GlobalSettingsState = {
  maintenanceMode: false,
};

/**
 * React-Context für globale App-Einstellungen.
 *
 * Wird von `GlobalSettingsProvider` befüllt und über `useGlobalSettings()`
 * konsumiert. Liefert `{maintenanceMode: false}` ausserhalb eines Providers
 * (fail-open Default).
 */
export const GlobalSettingsContext =
  React.createContext<GlobalSettingsState>(initialState);

/**
 * Gibt die zuletzt geladenen globalen Einstellungen aus dem Context zurück.
 *
 * @returns Die aktuellen globalen Einstellungen.
 */
export const useGlobalSettings = (): GlobalSettingsState => {
  return React.useContext(GlobalSettingsContext);
};

/**
 * GlobalSettingsProvider — lädt globale Einstellungen (u.a. Wartungsmodus)
 * einmalig beim Start und danach periodisch im Hintergrund neu.
 *
 * Bewusst kein Realtime-Abo: Der Wartungsmodus ist eine seltene, weiche
 * Umschaltung ohne Sicherheitsanspruch (die tatsächliche Durchsetzung
 * erfolgt über den JWT-Ablauf / die "Alle Sessions abmelden"-Edge-Function).
 * Ein Polling-Intervall ist für diesen Zweck ausreichend und deutlich
 * einfacher als eine dauerhafte Realtime-Subscription.
 *
 * Schlägt ein Read fehl, bleibt der zuletzt bekannte Wert erhalten (kein
 * Reset auf `false`) — ein einzelner fehlgeschlagener Poll soll den
 * Wartungsmodus nicht fälschlich deaktivieren. Der allererste Ladevorgang
 * startet mit `maintenanceMode: false` (fail-open), bis ein Read erfolgreich
 * war.
 *
 * Vorübergehende Netzfehler (Mobilgerät kurz offline im Lager) werden bewusst
 * verschluckt und nicht an Sentry gemeldet; nur unerwartete Fehler werden
 * — als normalisierter `Error` — erfasst.
 *
 * @example
 * <GlobalSettingsProvider>
 *   <App />
 * </GlobalSettingsProvider>
 */
export const GlobalSettingsProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const database = useDatabase();
  const [state, setState] = useState<GlobalSettingsState>(initialState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const settings = await database.globalSettings.getSettings();
        if (!cancelled) {
          setState({maintenanceMode: settings?.maintenanceMode ?? false});
        }
      } catch (error) {
        // Vorübergehender Netzausfall (z.B. Mobilgerät offline im Lager): Der
        // zuletzt bekannte Wert bleibt erhalten — kein Sentry-Rauschen für
        // erwartetes Verhalten.
        if (isTransientNetworkError(error)) {
          return;
        }
        Sentry.captureException(toError(error), {
          extra: {context: "GlobalSettingsProvider - Einstellungen laden"},
        });
      }
    };

    load();
    const intervalId = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [database]);

  return (
    <GlobalSettingsContext.Provider value={state}>
      {children}
    </GlobalSettingsContext.Provider>
  );
};
