import React from "react";
import {createRoot} from "react-dom/client";
import * as Sentry from "@sentry/react";

import {App} from "../src/components/App/App";
import {AuthUserProvider} from "./components/Session/authUserContext";
import {GlobalSettingsProvider} from "./components/Session/globalSettingsContext";
import packageJson from "../package.json";

import "@fontsource/roboto";
import "@fontsource/roboto-mono";

import {CustomDialogContextProvider} from "./components/Shared/customDialogContext";
import {NavigationContextProvider} from "./components/Navigation/navigationContext";
import {DatabaseContext} from "./components/Database/DatabaseContext";
import DatabaseService from "./components/Database/DatabaseService";
import {ErrorPage} from "./components/500/500";
import {Utils} from "./components/Shared/utils.class";
import {initAnalytics} from "./components/Analytics/analyticsService";
import {LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/de";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: !Utils.isDevEnvironment(),
  environment: import.meta.env.VITE_ENVIRONMENT,
  release: packageJson.version,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Alle Eingaben sichtbar lassen (keine sensiblen Daten in der App),
      // nur Passwortfelder werden explizit maskiert via CSS-Selektor.
      maskAllInputs: false,
      maskAllText: false,
      blockAllMedia: false,
      mask: ['input[type="password"]'],
    }),
    Sentry.consoleLoggingIntegration({levels: ["log", "warn", "error"]}),
  ],
  // Rauschen von Drittanbietern / Browser-APIs ausfiltern, das nicht aus
  // unserem Code stammt und über das die App keine Kontrolle hat.
  ignoreErrors: [
    // Der SafeLink-/Vorschau-Crawler von Microsoft Outlook injiziert beim
    // Vorab-Scannen von E-Mail-Links (u.a. /authservicehandler) eine kaputte
    // Bridge und wirft dann diesen String als unhandled rejection. Kein
    // App-Fehler, kein Stacktrace, nur von Crawler-"Nutzern" ausgelöst.
    /Object Not Found Matching Id/,
    // @supabase/auth-js kann den Web-Locks-API-Lock für den Auth-Token nicht
    // innerhalb von 10s bekommen, wenn ein anderer Tab (oder ein gedrosselter
    // Hintergrund-Tab / Crawler) ihn hält. Transient, der Client verbindet
    // sich anschliessend selbst neu — kein App-Fehler.
    /Navigator LockManager lock .* timed out/,
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/chuchipirat\.ch/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
});

// Umami Analytics initialisieren (cookie-freies, datenschutzkonformes Tracking)
initAnalytics();

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorPage />}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="de">
        <DatabaseContext.Provider value={new DatabaseService()}>
          <GlobalSettingsProvider>
            <AuthUserProvider>
              <CustomDialogContextProvider>
                <NavigationContextProvider>
                  <App />
                </NavigationContextProvider>
              </CustomDialogContextProvider>
            </AuthUserProvider>
          </GlobalSettingsProvider>
        </DatabaseContext.Provider>
      </LocalizationProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
