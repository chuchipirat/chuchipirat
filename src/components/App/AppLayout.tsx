import {useLocation} from "react-router";
import {useMediaQuery, useTheme} from "@mui/material";

import GoBackFab from "../Navigation/goBack";
import Footer from "../Footer/footer";
import {FeedbackFab} from "./FeedbackFab";
import {routeConfig} from "./routeConfig";
import type {RouteLayout} from "./routeConfig";

/**
 * Prüft, ob der aktuelle Pfad zu einer Route-Definition passt.
 * Unterstützt sowohl exakte Treffer als auch Subpfade und Pfade mit Parametern.
 *
 * @param pathname - Der aktuelle Pfad aus `useLocation()`.
 * @param routePath - Der Pfad aus der Route-Konfiguration (z.B. "/event/:id").
 * @returns `true`, wenn der Pfad übereinstimmt.
 */
const matchesPath = (pathname: string, routePath: string): boolean => {
  // Parameterrouten wie "/event/:id" → matche "/event/" als Präfix
  if (routePath.includes(":")) {
    const prefix = routePath.substring(0, routePath.indexOf(":"));
    return pathname.startsWith(prefix);
  }
  return pathname === routePath || pathname.startsWith(routePath + "/");
};

/**
 * Ermittelt die Layout-Metadaten für den aktuellen Pfad aus der Route-Konfiguration.
 *
 * @param pathname - Der aktuelle URL-Pfad.
 * @returns Das `RouteLayout`-Objekt der passenden Route oder `undefined`.
 */
const getLayoutForPath = (pathname: string): RouteLayout | undefined => {
  const matchedRoute = routeConfig.find((route) =>
    matchesPath(pathname, route.path)
  );
  return matchedRoute?.layout;
};

/**
 * Custom Hook — gibt die Layout-Metadaten für den aktuellen Pfad zurück.
 *
 * @returns Das `RouteLayout`-Objekt der passenden Route oder `undefined`.
 */
const useRouteLayout = (): RouteLayout | undefined => {
  const {pathname} = useLocation();
  return getLayoutForPath(pathname);
};

/**
 * GoBackFab — wird nur auf kleinem Viewport und auf Routen mit `showGoBackFab` angezeigt.
 * Muss vor `<Suspense>` gerendert werden, damit der Button sofort sichtbar ist.
 *
 * @returns GoBackFab oder `null`.
 */
const ConditionalGoBackFab = () => {
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down("sm"));
  const layout = useRouteLayout();

  if (!isMobileViewport || !layout?.showGoBackFab) return null;
  return <GoBackFab />;
};

/**
 * FeedbackFab — wird auf Routen mit `showFeedbackFab` angezeigt.
 *
 * @returns FeedbackFab oder `null`.
 */
const ConditionalFeedbackFab = () => {
  const layout = useRouteLayout();
  if (!layout?.showFeedbackFab) return null;
  return <FeedbackFab />;
};

/**
 * Footer — wird auf Routen mit `showFooter` angezeigt.
 * Muss nach den Routen gerendert werden, damit er am Seitenende erscheint.
 *
 * @returns Footer oder `null`.
 */
const ConditionalFooter = () => {
  const layout = useRouteLayout();
  if (!layout?.showFooter) return null;
  return <Footer />;
};

export {ConditionalGoBackFab, ConditionalFeedbackFab, ConditionalFooter};
