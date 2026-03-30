import React from "react";
import {createRoot} from "react-dom/client";
import * as Sentry from "@sentry/react";

import {App} from "../src/components/App/App";
import {FirebaseContext} from "./components/Firebase/firebaseContext";
import {AuthUserProvider} from "./components/Session/authUserContext";
import packageJson from "../package.json";

import "typeface-roboto";
import "@fontsource/roboto-mono";

import {CustomDialogContextProvider} from "./components/Shared/customDialogContext";
import {NavigationContextProvider} from "./components/Navigation/NavigationContext";
import Firebase from "./components/Firebase/firebase.class";
import {DatabaseContext} from "./components/Database/DatabaseContext";
import DatabaseService from "./components/Database/DatabaseService";
import {ErrorPage} from "./components/500/500";
import {Utils} from "./components/Shared/utils.class";
import {initAnalytics} from "./components/Analytics/analyticsService";
import {LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDateFns} from "@mui/x-date-pickers/AdapterDateFns";
import {de} from "date-fns/locale";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  //FIXME:
  enabled: !Utils.isDevEnvironment(),
  environment: import.meta.env.VITE_ENVIRONMENT,
  release: packageJson.version,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/chuchipirat\.ch/,
    /^https:\/\/chuchipirat-tst\.web\.app/,
  ],
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
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
        <DatabaseContext.Provider value={new DatabaseService()}>
          <FirebaseContext.Provider value={new Firebase()}>
            <AuthUserProvider>
              <CustomDialogContextProvider>
                <NavigationContextProvider>
                  <App />
                </NavigationContextProvider>
              </CustomDialogContextProvider>
            </AuthUserProvider>
          </FirebaseContext.Provider>
        </DatabaseContext.Provider>
      </LocalizationProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
