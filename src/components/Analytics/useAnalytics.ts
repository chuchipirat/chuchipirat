/**
 * Convenience-Hook für Analytics-Tracking in React-Komponenten.
 *
 * Gibt `trackEvent` zurück, damit Komponenten Events an Umami senden
 * können, ohne den Service direkt importieren zu müssen.
 *
 * @example
 * const { trackEvent } = useAnalytics();
 * trackEvent(AnalyticsEvent.RECIPE_CREATED);
 */
import {useCallback} from "react";
import {trackEvent as serviceTrackEvent} from "./analyticsService";
import {AnalyticsEventName} from "./analyticsEvents";

/**
 * Hook, der eine stabile `trackEvent`-Referenz liefert.
 *
 * @returns Objekt mit `trackEvent`-Funktion.
 */
export function useAnalytics() {
  const trackEvent = useCallback(
    (
      eventName: AnalyticsEventName,
      eventData?: Record<string, string | number | boolean>,
    ) => {
      serviceTrackEvent(eventName, eventData);
    },
    [],
  );

  return {trackEvent};
}
