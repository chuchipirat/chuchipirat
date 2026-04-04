import {Route, Routes} from "react-router";

import {routeConfig} from "./routeConfig";
import {GuardedRoute} from "../Session/GuardedRoute";
import {EmailVerificationGuard} from "../Session/emailVerificationGuard";
import {NotFoundPage} from "../404/404";

/**
 * Rendert alle Routen basierend auf der zentralen Route-Konfiguration.
 *
 * Mappt jede Route-Definition auf eine `<Route>`-Komponente und wendet
 * Guards (Autorisierung + E-Mail-Verifizierung) automatisch an.
 * Die Catch-All-Route rendert `<NotFoundPage />` inline, damit die
 * ursprüngliche URL im Browser erhalten bleibt.
 *
 * @returns Alle App-Routen als `<Routes>`-Baum.
 */
const AppRoutes = () => (
  <Routes>
    {routeConfig.map((route) => {
      const Component = route.component;
      let element = <Component />;

      if (route.guard) {
        element = (
          <GuardedRoute condition={route.guard}>{element}</GuardedRoute>
        );
      } else if (route.emailVerificationOnly) {
        element = <EmailVerificationGuard>{element}</EmailVerificationGuard>;
      }

      return <Route key={route.path} path={route.path} element={element} />;
    })}

    {/* Catch-All: URL bleibt erhalten, 404-Inhalt wird inline gerendert */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export {AppRoutes};
