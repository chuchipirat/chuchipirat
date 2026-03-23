import {Suspense, useMemo, useEffect} from "react";
import {BrowserRouter as Router} from "react-router";
import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from "@mui/material/styles";
import {CssBaseline, useMediaQuery} from "@mui/material";
import * as Sentry from "@sentry/react";

import "./App.css";
import {Navigation} from "../Navigation/Navigation";
import {ScrollToTop} from "../Navigation/ScrollToTop";
import {FallbackLoading} from "../Shared/fallbackLoading";
import {CustomDialog} from "../Shared/customDialog";
import {getTheme} from "./customTheme";
import {AppRoutes} from "./AppRoutes";
import {
  ConditionalGoBackFab,
  ConditionalFeedbackFab,
  ConditionalFooter,
} from "./AppLayout";
import {SessionStorageHandler} from "../Firebase/Db/sessionStorageHandler.class";
import {FEEDBACK as TEXT_FEEDBACK} from "../../constants/text";

/**
 * Wurzelkomponente der Anwendung — stellt Theme, Router und globale
 * Layout-Elemente bereit.
 *
 * Verantwortlich für:
 * - MUI-Theme (Light/Dark basierend auf System-Präferenz)
 * - Session-Storage-Bereinigung beim Seitenneuladen
 * - Sentry-Feedback-Integration
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

  // Sentry-Feedback-Formular an den Custom-Button anhängen.
  // Abhängig von `theme`, damit Farben bei Dark/Light-Wechsel aktualisiert werden.
  useEffect(() => {
    const initFeedback = async () => {
      const feedback = Sentry.feedbackIntegration({autoInject: false});
      const button = document.getElementById("custom-feedback-button");

      if (button) {
        feedback.attachTo(button, {
          formTitle: TEXT_FEEDBACK.title,
          colorScheme: "system",
          submitButtonLabel: TEXT_FEEDBACK.submitButton,
          cancelButtonLabel: TEXT_FEEDBACK.cancelButton,
          addScreenshotButtonLabel: TEXT_FEEDBACK.addScreenshotButton,
          removeScreenshotButtonLabel: TEXT_FEEDBACK.removeScreenshotButton,
          namePlaceholder: TEXT_FEEDBACK.namePlaceholder,
          emailPlaceholder: TEXT_FEEDBACK.emailPlaceholder,
          messageLabel: TEXT_FEEDBACK.messageLabel,
          messagePlaceholder: TEXT_FEEDBACK.messagePlaceholder,
          successMessageText: TEXT_FEEDBACK.successMessage,
          isRequiredLabel: TEXT_FEEDBACK.isRequired,
          themeLight: {
            foreground: theme.palette.text.primary,
            background: theme.palette.background.default,
            accentBackground: theme.palette.primary.main,
            successColor: theme.palette.success.main,
            errorColor: theme.palette.error.main,
          },
          themeDark: {
            foreground: "#fff",
            background: "#121212",
            accentBackground: "#00bcd4",
            accentForeground: "#000",
            successColor: "#4caf50",
            errorColor: "#f44336",
          },
        });
      }
    };
    initFeedback();
  }, [theme]);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
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
