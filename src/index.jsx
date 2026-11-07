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
import {isChunkLoadError} from "./utils/errorUtils";
import {buildSentryOptions} from "./sentryOptions";
import {LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import "dayjs/locale/de";

Sentry.init(
  buildSentryOptions({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT,
    release: packageJson.version,
    enabled: !Utils.isDevEnvironment(),
  }),
);

// Umami Analytics initialisieren (cookie-freies, datenschutzkonformes Tracking)
initAnalytics();

const CHUNK_RELOAD_ATTEMPTED_KEY = "chunkReloadAttempted";

/**
 * Lädt die Seite einmalig neu, wenn ein dynamischer Chunk-Import fehlschlägt
 * (veralteter Tab nach einem Deployment). Ein `sessionStorage`-Flag
 * verhindert eine Neulade-Schleife, falls der Fehler bestehen bleibt.
 *
 * @param error - Der von der ErrorBoundary gefangene Fehler.
 */
const handleErrorBoundaryError = (error) => {
  if (!isChunkLoadError(error)) return;
  if (sessionStorage.getItem(CHUNK_RELOAD_ATTEMPTED_KEY)) return;

  sessionStorage.setItem(CHUNK_RELOAD_ATTEMPTED_KEY, "true");
  window.location.reload();
};

const root = createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={<ErrorPage />}
      onError={handleErrorBoundaryError}
    >
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
