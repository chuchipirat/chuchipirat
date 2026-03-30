import {useEffect, useRef} from "react";
import {useLocation} from "react-router";
import * as Sentry from "@sentry/react";

/**
 * Zeichnet bei jedem Routenwechsel einen Sentry-Breadcrumb auf.
 *
 * Muss innerhalb des React-Router `<Router>` platziert werden,
 * damit `useLocation()` verfügbar ist. Rendert nichts sichtbares.
 *
 * @returns `null` — reine Seiteneffekt-Komponente.
 */
export const SentryRouteTracker = (): null => {
  const location = useLocation();
  const previousPathname = useRef<string>(location.pathname);

  useEffect(() => {
    // Beim initialen Render keinen Breadcrumb schreiben
    if (previousPathname.current === location.pathname) return;

    Sentry.addBreadcrumb({
      category: "navigation",
      message: `${previousPathname.current} → ${location.pathname}`,
      level: "info",
      data: {
        from: previousPathname.current,
        to: location.pathname,
      },
    });

    previousPathname.current = location.pathname;
  }, [location.pathname]);

  return null;
};
