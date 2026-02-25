import React, {Suspense, lazy} from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router";
import {MobileView} from "react-device-detect";

import "./App.css";

import Navigation from "../Navigation/navigation";
import ScrollToTop from "../Navigation/scrollToTop";
import GoBackFab from "../Navigation/goBack";
import Footer from "../Footer/footer";
import LandingPage from "../Landing/landing";
import AuthServiceHandler from "../AuthServiceHandler/authServiceHandler";

import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from "@mui/material/styles";

import NotFound from "../404/404";
import FallbackLoading from "../Shared/fallbackLoading";

import * as ROUTES from "../../constants/routes";

import CustomDialog from "../Shared/customDialog";
import PublicProfile from "../User/publicProfile";
import NoAuthPage from "../Session/noAuth";
import CustomTheme from "./customTheme.class";
// Für nachträglicher Load --> Code Splitting
import SignUpPage from "../SignUp/signUp";
import SignInPage from "../SignIn/signIn";
import Fab from "@mui/material/Fab";
import {FeedbackIcon} from "../Shared/icons";
import * as Sentry from "@sentry/react";

import {AuthorizationGuard} from "../Session/authUserContext";
import {EmailVerificationGuard} from "../Session/emailVerificationGuard";
import Role from "../../constants/roles";
import {FEEDBACK as TEXT_FEEDBACK} from "../../constants/text";
import {CssBaseline, useMediaQuery} from "@mui/material";
import useCustomStyles from "../../constants/styles";

const PasswordChange = lazy(() => import("../PasswordChange/passwordChange"));
const Units = lazy(() => import("../Unit/units"));
const UnitConversion = lazy(() => import("../Unit/unitConversion"));
const Products = lazy(() => import("../Product/products"));
const Materials = lazy(() => import("../Material/materials"));
const Departments = lazy(() => import("../Department/departments"));
const RequestOverview = lazy(() => import("../Request/requestOverview"));
const HomePage = lazy(() => import("../Home/home"));
const UserProfile = lazy(() => import("../User/userProfile"));
const PrivacyPolicyPage = lazy(() => import("./privacyPolicy"));
const TermOfUsePage = lazy(() => import("./termOfUse"));
const Temp = lazy(() => import("../Temp/temp"));
const Schema = lazy(() => import("../Temp/schema"));

const Event = lazy(() => import("../Event/Event/event"));
const Events = lazy(() => import("../Event/Event/events"));
const Recipe = lazy(() => import("../Recipe/recipe"));

const CreateNewEvent = lazy(() => import("../Event/Event/createNewEvent"));
const Recipes = lazy(() => import("../Recipe/recipes"));
const Donate = lazy(() => import("../Donate/donate"));

const PasswordReset = lazy(() => import("../AuthServiceHandler/passwordReset"));

const System = lazy(() => import("../Admin/system"));
const GlobalSettings = lazy(() => import("../Admin/globalSettings"));
const SystemMessage = lazy(() => import("../Admin/systemMessage"));
const WhereUsed = lazy(() => import("../Admin/whereUsed"));
const MergeItems = lazy(() => import("../Admin/mergeItems"));
const ConvertItem = lazy(() => import("../Admin/convertItem"));
const Jobs = lazy(() => import("../Admin/executeJob"));
const BuildDbIndices = lazy(() => import("../Admin/buildDbIndex"));
const OverviewRecipes = lazy(() => import("../Admin/overviewRecipes"));
const OverviewEvents = lazy(() => import("../Admin/overviewEvents"));
const OverviewUsers = lazy(() => import("../Admin/overviewUsers"));
const OverviewMailbox = lazy(() => import("../Admin/overviewMailbox"));
const OverviewCloudFx = lazy(() => import("../Admin/overviewCloudFunctions"));
const OverviewFeeds = lazy(() => import("../Admin/overviewFeeds"));
const ActivateSupportUser = lazy(() => import("../Admin/activateSupportUser"));
const MailConsole = lazy(() => import("../Admin/mailConsole"));
const Migration = lazy(() => import("../Admin/migration"));

/* ===================================================================
// ====================== Authorization Conditions ===================
// =================================================================== */
const isAuthenticated = (authUser) => !!authUser;

const isAdmin = (authUser) =>
  !!authUser && !!authUser.roles.includes(Role.admin);

const isAdminOrCommunityLeader = (authUser) =>
  !!authUser &&
  (!!authUser.roles.includes(Role.admin) ||
    !!authUser.roles.includes(Role.communityLeader));

const isCommunityLeader = (authUser) =>
  !!authUser && !!authUser.roles.includes(Role.communityLeader);

/* ===================================================================
// ====================== Guarded Route Helpers ======================
// =================================================================== */
const GuardedRoute = ({condition, element}) => (
  <AuthorizationGuard condition={condition}>
    <EmailVerificationGuard>{element}</EmailVerificationGuard>
  </AuthorizationGuard>
);

/* ===================================================================
// ============== Path-matching wrappers for layout components =======
// =================================================================== */
const GO_BACK_PATHS = [
  ROUTES.RECIPE,
  ROUTES.RECIPES,
  ROUTES.CREATE_NEW_EVENT,
  ROUTES.EVENT,
  ROUTES.EVENTS,
  ROUTES.UNITS,
  ROUTES.UNITCONVERSION,
  ROUTES.PRODUCTS,
  ROUTES.MATERIALS,
  ROUTES.DEPARTMENTS,
  ROUTES.SYSTEM,
  ROUTES.NOT_FOUND,
  ROUTES.SYSTEM_OVERVIEW_USERS,
  ROUTES.USER_PUBLIC_PROFILE,
  ROUTES.USER_PROFILE,
];

const FEEDBACK_PATHS = [
  ROUTES.HOME,
  ROUTES.SIGN_IN,
  ROUTES.PASSWORD_CHANGE,
  ROUTES.PASSWORD_RESET,
  ROUTES.AUTH_SERVICE_HANDLER,
  ROUTES.CREATE_NEW_EVENT,
  ROUTES.EVENTS,
  ROUTES.EVENT,
  ROUTES.RECIPES,
  ROUTES.RECIPE,
  ROUTES.USER_PROFILE,
  ROUTES.USER_PUBLIC_PROFILE,
  ROUTES.UNITS,
  ROUTES.UNITCONVERSION,
  ROUTES.PRODUCTS,
  ROUTES.MATERIALS,
  ROUTES.DEPARTMENTS,
  ROUTES.REQUEST_OVERVIEW,
  ROUTES.NOT_FOUND,
  ROUTES.NO_AUTH,
];

const FOOTER_PATHS = [
  ROUTES.LANDING,
  ROUTES.HOME,
  ROUTES.RECIPE,
  ROUTES.RECIPES,
  ROUTES.CREATE_NEW_EVENT,
  ROUTES.EVENT,
  ROUTES.UNITS,
  ROUTES.UNITCONVERSION,
  ROUTES.PRODUCTS,
  ROUTES.MATERIALS,
  ROUTES.DEPARTMENTS,
  ROUTES.SIGN_IN,
  ROUTES.SIGN_UP,
  ROUTES.SYSTEM,
  ROUTES.NOT_FOUND,
];

const pathMatches = (pathname, paths) =>
  paths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

const ConditionalGoBackFab = () => {
  const {pathname} = useLocation();
  return pathMatches(pathname, GO_BACK_PATHS) ? <GoBackFab /> : null;
};

const ConditionalFeedbackFab = () => {
  const {pathname} = useLocation();
  return pathMatches(pathname, FEEDBACK_PATHS) ? <FeedbackFab /> : null;
};

const ConditionalFooter = () => {
  const {pathname} = useLocation();
  return pathMatches(pathname, FOOTER_PATHS) ? <Footer /> : null;
};

const App = () => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  /* ------------------------------------------
  // Theme für App
  // ------------------------------------------ */
  const theme = React.useMemo(
    () => createTheme({palette: CustomTheme.getTheme(prefersDarkMode)}),
    [prefersDarkMode]
  );

  React.useEffect(() => {
    const handleBeforeUnload = (event) => {
      // Wenn auf Auffrischen geklickt wird, soll der Session-Storage gelöscht werden
      // Wir gehen davon aus, dass die Person über das Resultat irritiert ist und darum
      // laden wir die Daten frisch aus der DB.
      // SessionStorageHandler.clearAll();
    };

    // Event Listener für das beforeunload-Ereignis hinzufügen
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Aufräumarbeiten: Event Listener entfernen, um Speicherlecks zu vermeiden
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  React.useEffect(() => {
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
  }, []);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Navigation />
          <ScrollToTop />
          <MobileView>
            <ConditionalGoBackFab />
          </MobileView>
          <Suspense fallback={<FallbackLoading />}>
            <ConditionalFeedbackFab />
            <Routes>
              {/* Public routes */}
              <Route path={ROUTES.LANDING} element={<LandingPage />} />
              <Route path={ROUTES.SIGN_IN} element={<SignInPage />} />
              <Route path={ROUTES.SIGN_UP} element={<SignUpPage />} />
              <Route
                path={ROUTES.PRIVACY_POLICY}
                element={<PrivacyPolicyPage />}
              />
              <Route path={ROUTES.TERM_OF_USE} element={<TermOfUsePage />} />
              <Route path={ROUTES.PASSWORD_RESET} element={<PasswordReset />} />
              <Route
                path={ROUTES.AUTH_SERVICE_HANDLER}
                element={<AuthServiceHandler />}
              />
              <Route path={ROUTES.NOT_FOUND} element={<NotFound />} />
              <Route path={ROUTES.NO_AUTH} element={<NoAuthPage />} />

              {/* Authenticated routes (isAuthenticated + EmailVerification) */}
              <Route
                path={ROUTES.HOME}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<HomePage />}
                  />
                }
              />
              <Route
                path={ROUTES.CREATE_NEW_EVENT}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<CreateNewEvent />}
                  />
                }
              />
              <Route
                path={ROUTES.EVENTS}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Events />}
                  />
                }
              />
              <Route
                path={ROUTES.EVENT_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Event />}
                  />
                }
              />
              <Route
                path={ROUTES.RECIPES}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Recipes />}
                  />
                }
              />
              <Route
                path={ROUTES.RECIPE}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Recipe />}
                  />
                }
              />
              <Route
                path={ROUTES.RECIPE_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Recipe />}
                  />
                }
              />
              <Route
                path={ROUTES.RECIPE_USER_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Recipe />}
                  />
                }
              />
              <Route
                path={ROUTES.USER_PUBLIC_PROFILE_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<PublicProfile />}
                  />
                }
              />
              <Route
                path={ROUTES.UNITS}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Units />}
                  />
                }
              />
              <Route
                path={ROUTES.UNITCONVERSION}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<UnitConversion />}
                  />
                }
              />
              <Route
                path={ROUTES.REQUEST_OVERVIEW}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<RequestOverview />}
                  />
                }
              />
              <Route
                path={ROUTES.REQUEST_OVERVIEW_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<RequestOverview />}
                  />
                }
              />
              <Route
                path={ROUTES.USER_PROFILE}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<UserProfile />}
                  />
                }
              />
              <Route
                path={ROUTES.USER_PROFILE_UID}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<UserProfile />}
                  />
                }
              />
              <Route
                path={ROUTES.DONATE}
                element={
                  <GuardedRoute
                    condition={isAuthenticated}
                    element={<Donate />}
                  />
                }
              />

              {/* Password change: EmailVerification guard but no Authorization redirect */}
              <Route
                path={ROUTES.PASSWORD_CHANGE}
                element={
                  <EmailVerificationGuard>
                    <PasswordChange />
                  </EmailVerificationGuard>
                }
              />

              {/* Admin or CommunityLeader routes */}
              <Route
                path={ROUTES.PRODUCTS}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<Products />}
                  />
                }
              />
              <Route
                path={ROUTES.MATERIALS}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<Materials />}
                  />
                }
              />
              <Route
                path={ROUTES.DEPARTMENTS}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<Departments />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<System />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_WHERE_USED}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<WhereUsed />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_MERGE_ITEM}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<MergeItems />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_CONVERT_ITEM}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<ConvertItem />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_SYSTEM_MESSAGE}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<SystemMessage />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_RECIPES}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<OverviewRecipes />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_EVENTS}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<OverviewEvents />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_DB_INDICES}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<BuildDbIndices />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_ACTIVATE_SUPPORT_USER}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<ActivateSupportUser />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_MAIL_CONSOLE}
                element={
                  <GuardedRoute
                    condition={isAdminOrCommunityLeader}
                    element={<MailConsole />}
                  />
                }
              />

              {/* Admin-only routes */}
              <Route
                path={ROUTES.SYSTEM_GLOBAL_SETTINGS}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<GlobalSettings />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_JOBS}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<Jobs />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_MIGRATION}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<Migration />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_USERS}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<OverviewUsers />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_MAILBOX}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<OverviewMailbox />}
                  />
                }
              />
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_CLOUDFX}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<OverviewCloudFx />}
                  />
                }
              />

              {/* CommunityLeader routes */}
              <Route
                path={ROUTES.SYSTEM_OVERVIEW_FEEDS}
                element={
                  <GuardedRoute
                    condition={isCommunityLeader}
                    element={<OverviewFeeds />}
                  />
                }
              />

              {/* Temp/Schema: admin only */}
              <Route
                path={ROUTES.TEMP}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<Temp />}
                  />
                }
              />
              <Route
                path={ROUTES.SCHEMA}
                element={
                  <GuardedRoute
                    condition={isAdmin}
                    element={<Schema />}
                  />
                }
              />

              <Route path="*" element={<Navigate to="/404" />} />
            </Routes>
          </Suspense>
          <ConditionalFooter />
        </Router>
        <CustomDialog />
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

const FeedbackFab = () => {
  const classes = useCustomStyles();

  return (
    <Fab
      id="custom-feedback-button"
      color="secondary"
      size="small"
      aria-label="Feedback geben"
      sx={classes.fabBottom}
    >
      <FeedbackIcon />
    </Fab>
  );
};

export default App;
