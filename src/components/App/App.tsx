import {Suspense, useMemo, useEffect} from "react";
import {BrowserRouter as Router} from "react-router";
import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from "@mui/material/styles";
import {CssBaseline, useMediaQuery} from "@mui/material";

import "./App.css";
import {Navigation} from "../Navigation/navigation";
import {ScrollToTop} from "../Navigation/scrollToTop";
import {FallbackLoading} from "../Shared/fallbackLoading";
import {CustomDialog} from "../Shared/customDialog";
import {getTheme} from "./customTheme";
import {AppRoutes} from "./AppRoutes";
import {
  ConditionalGoBackFab,
  ConditionalFeedbackFab,
  ConditionalFooter,
} from "./AppLayout";
import {SessionStorageHandler} from "../Shared/sessionStorageHandler.class";
import {SentryRouteTracker} from "../Sentry/SentryRouteTracker";

/**
 * Wurzelkomponente der Anwendung — stellt Theme, Router und globale
 * Layout-Elemente bereit.
 *
 * Verantwortlich für:
 * - MUI-Theme (Light/Dark basierend auf System-Präferenz)
 * - Session-Storage-Bereinigung beim Seitenneuladen
 * - Provider-Hierarchie (Theme → Router → Layout + Routen)
 *
 * @returns Die vollständige App mit allen Providern und Routen.
 */
const App = () => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const theme = useMemo(
    () => createTheme({palette: getTheme(prefersDarkMode)}),
    [prefersDarkMode]
  );

  // Beim Neuladen der Seite den Session-Storage leeren, damit
  // keine veralteten Daten aus dem Cache verwendet werden.
  useEffect(() => {
    const handleBeforeUnload = (_event: BeforeUnloadEvent) => {
      SessionStorageHandler.clearAll();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <SentryRouteTracker />
          <Navigation />
          <ScrollToTop />
          <ConditionalGoBackFab />
          <Suspense fallback={<FallbackLoading />}>
            <ConditionalFeedbackFab />
            <AppRoutes />
          </Suspense>
          <ConditionalFooter />
        </Router>
        <CustomDialog />
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export {App};
