import {lazy, type ComponentType, type LazyExoticComponent} from "react";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {Role} from "../../constants/roles";
import * as ROUTES from "../../constants/routes";

// Eagerly loaded (above the fold / critical path)
import {LandingPage} from "../Landing/Landing";
import {SignInPage} from "../SignIn/signIn";
import {SignUpPage} from "../SignUp/signUp";
import {NotFoundPage} from "../404/404";
import {NoAuthPage} from "../Session/noAuth";
import {PublicProfilePage} from "../User/publicProfile";

// Lazy loaded
const PasswordChange = lazy(() =>
  import("../PasswordChange/passwordChange").then((module) => ({default: module.PasswordChangePage}))
);
const Units = lazy(() =>
  import("../Unit/units").then((module) => ({default: module.UnitsPage}))
);
const UnitConversion = lazy(() =>
  import("../Unit/unitConversion").then((module) => ({default: module.UnitConversionPage}))
);
const Products = lazy(() =>
  import("../Product/products").then((module) => ({default: module.ProductsPage}))
);
const Materials = lazy(() =>
  import("../Material/materials").then((module) => ({default: module.MaterialPage}))
);
const Departments = lazy(() =>
  import("../Department/departments").then((module) => ({default: module.DepartmentsPage}))
);
const RequestOverview = lazy(() =>
  import("../Request/requestOverview").then((module) => ({default: module.RequestOverviewPage}))
);
const HomePage = lazy(() =>
  import("../Home/Home").then((module) => ({default: module.HomePage}))
);
const UserProfile = lazy(() =>
  import("../User/userProfile").then((module) => ({default: module.UserProfilePage}))
);
const PrivacyPolicyPage = lazy(() =>
  import("./privacyPolicy").then((module) => ({default: module.PrivacyPolicyPage}))
);
const TermOfUsePage = lazy(() =>
  import("./termOfUse").then((module) => ({default: module.TermOfUsePage}))
);
const Schema = lazy(() => import("../Temp/schema"));
const Event = lazy(() =>
  import("../Event/Event/event").then((module) => ({default: module.EventPage}))
);
const Events = lazy(() =>
  import("../Event/Event/events").then((module) => ({default: module.EventsPage}))
);
const Recipe = lazy(() =>
  import("../Recipe/recipe").then((module) => ({default: module.RecipePage}))
);
const CreateNewEvent = lazy(() =>
  import("../Event/Event/createNewEvent").then((module) => ({default: module.CreateEventPage}))
);
const Recipes = lazy(() =>
  import("../Recipe/recipes").then((module) => ({default: module.RecipesPage}))
);
const Donate = lazy(() =>
  import("../Donate/DonatePage").then((module) => ({default: module.DonatePage}))
);
const DonateResult = lazy(() =>
  import("../Donate/DonationResult").then((module) => ({default: module.DonationResultPage}))
);
const AuthServiceHandler = lazy(() =>
  import("../AuthServiceHandler/authServiceHandler").then((module) => ({default: module.AuthServiceHandlerPage}))
);
const PasswordReset = lazy(() =>
  import("../AuthServiceHandler/passwordReset").then((module) => ({
    default: module.PasswordResetPage,
  }))
);
const System = lazy(() => import("../Admin/system"));
const GlobalSettings = lazy(
  () => import("../Admin/GlobalSettings/globalSettings")
);
const SystemMessageOverview = lazy(
  () => import("../Admin/SystemMessage/systemMessageOverview")
);
const SystemMessage = lazy(
  () => import("../Admin/SystemMessage/systemMessage")
);
const WhereUsed = lazy(() => import("../Admin/whereUsed"));
const MergeItems = lazy(() => import("../Admin/mergeItems"));
const ConvertItem = lazy(() => import("../Admin/convertItem"));
const OverviewRecipes = lazy(
  () => import("../Admin/Overview/overviewRecipes")
);
const OverviewEvents = lazy(
  () => import("../Admin/Overview/overviewEvents")
);
const OverviewUsers = lazy(() => import("../Admin/Overview/overviewUsers"));
const OverviewMailbox = lazy(() => import("../Admin/overviewMailbox"));
const OverviewFeeds = lazy(() => import("../Admin/Overview/overviewFeeds"));
const OverviewDonations = lazy(() =>
  import("../Admin/Overview/overviewDonations").then((module) => ({default: module.OverviewDonationsPage}))
);
const ActivateSupportUser = lazy(
  () => import("../Admin/activateSupportUser")
);
const MailConsole = lazy(() => import("../Admin/mailConsole"));
const Migration = lazy(() => import("../Admin/migration"));
const DataIntegrity = lazy(
  () => import("../Admin/DataIntegrity/dataIntegrity")
);
const CronJobs = lazy(() => import("../Admin/CronJobs/cronJobs"));
const DonationGoals = lazy(() =>
  import("../Admin/DonationGoals/donationGoals").then((module) => ({default: module.DonationGoalsPage}))
);

/* ===================================================================
// ====================== Autorisierungsbedingungen ==================
// =================================================================== */

/**
 * Prüft, ob ein Benutzer authentifiziert ist.
 *
 * @param authUser - Der aktuelle AuthUser oder null.
 * @returns `true`, wenn der Benutzer eingeloggt ist.
 */
const isAuthenticated = (authUser: AuthUser | null): boolean => !!authUser;

/**
 * Prüft, ob der Benutzer die Admin-Rolle besitzt.
 *
 * @param authUser - Der aktuelle AuthUser oder null.
 * @returns `true`, wenn der Benutzer Admin ist.
 */
const isAdmin = (authUser: AuthUser | null): boolean =>
  !!authUser && authUser.roles.includes(Role.admin);

/**
 * Prüft, ob der Benutzer Admin oder CommunityLeader ist.
 *
 * @param authUser - Der aktuelle AuthUser oder null.
 * @returns `true`, wenn der Benutzer Admin oder CommunityLeader ist.
 */
const isAdminOrCommunityLeader = (authUser: AuthUser | null): boolean =>
  !!authUser &&
  (authUser.roles.includes(Role.admin) ||
    authUser.roles.includes(Role.communityLeader));

/**
 * Prüft, ob der Benutzer die CommunityLeader-Rolle besitzt.
 *
 * @param authUser - Der aktuelle AuthUser oder null.
 * @returns `true`, wenn der Benutzer CommunityLeader ist.
 */
const isCommunityLeader = (authUser: AuthUser | null): boolean =>
  !!authUser && authUser.roles.includes(Role.communityLeader);

/* ===================================================================
// ====================== Layout-Metadaten ===========================
// =================================================================== */

/**
 * Layout-Optionen pro Route — steuert, welche Elemente angezeigt werden.
 *
 * @param showGoBackFab - Ob der Zurück-Button angezeigt wird (auf kleinem Viewport).
 * @param showFeedbackFab - Ob der Feedback-Button angezeigt wird.
 * @param showFooter - Ob der Footer angezeigt wird.
 */
type RouteLayout = {
  showGoBackFab?: boolean;
  showFeedbackFab?: boolean;
  showFooter?: boolean;
};

/**
 * Definition einer einzelnen Route — enthält Pfad, Komponente, Schutz und Layout.
 *
 * @param path - Der URL-Pfad (passend zu react-router).
 * @param component - Die zu rendernde Komponente (lazy oder eager).
 * @param guard - Optionale Autorisierungsbedingung.
 * @param emailVerificationOnly - Wenn `true`, nur E-Mail-Verifizierung ohne Auth-Guard.
 * @param layout - Optionale Layout-Steuerung.
 */
type RouteDefinition = {
  path: string;
  component: LazyExoticComponent<ComponentType<unknown>> | ComponentType;
  guard?: (authUser: AuthUser | null) => boolean;
  emailVerificationOnly?: boolean;
  layout?: RouteLayout;
};

/* ===================================================================
// ====================== Routen-Konfiguration =======================
// =================================================================== */

/**
 * Zentrale Routen-Konfiguration — ersetzt die repetitiven JSX-Routen
 * und die separaten Pfad-Arrays (GO_BACK_PATHS, FEEDBACK_PATHS, FOOTER_PATHS).
 *
 * Jede Route definiert ihren Pfad, die Komponente, optionale Guards und
 * Layout-Metadaten. Die Layout-Metadaten steuern, ob GoBackFab,
 * FeedbackFab und Footer auf dieser Route angezeigt werden.
 */
const routeConfig: RouteDefinition[] = [
  // ── Öffentliche Routen ──
  {
    path: ROUTES.LANDING,
    component: LandingPage,
    layout: {showFooter: true},
  },
  {
    path: ROUTES.SIGN_IN,
    component: SignInPage,
    layout: {showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SIGN_UP,
    component: SignUpPage,
    layout: {showFooter: true},
  },
  {
    path: ROUTES.PRIVACY_POLICY,
    component: PrivacyPolicyPage,
  },
  {
    path: ROUTES.TERM_OF_USE,
    component: TermOfUsePage,
  },
  {
    path: ROUTES.PASSWORD_RESET,
    component: PasswordReset,
    layout: {showFeedbackFab: true},
  },
  {
    path: ROUTES.AUTH_SERVICE_HANDLER,
    component: AuthServiceHandler,
    layout: {showFeedbackFab: true},
  },
  {
    path: ROUTES.NOT_FOUND,
    component: NotFoundPage,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.NO_AUTH,
    component: NoAuthPage,
    layout: {showFeedbackFab: true},
  },

  // ── Authentifizierte Routen ──
  {
    path: ROUTES.HOME,
    component: HomePage,
    guard: isAuthenticated,
    layout: {showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.CREATE_NEW_EVENT,
    component: CreateNewEvent,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.EVENTS,
    component: Events,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true},
  },
  {
    path: ROUTES.EVENT_UID,
    component: Event,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.RECIPES,
    component: Recipes,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.RECIPE,
    component: Recipe,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.RECIPE_UID,
    component: Recipe,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true},
  },
  {
    path: ROUTES.USER_PUBLIC_PROFILE_UID,
    component: PublicProfilePage,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true},
  },
  {
    path: ROUTES.UNITS,
    component: Units,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.UNITCONVERSION,
    component: UnitConversion,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.REQUEST_OVERVIEW,
    component: RequestOverview,
    guard: isAuthenticated,
    layout: {showFeedbackFab: true},
  },
  {
    path: ROUTES.REQUEST_OVERVIEW_UID,
    component: RequestOverview,
    guard: isAuthenticated,
    layout: {showFeedbackFab: true},
  },
  {
    path: ROUTES.USER_PROFILE,
    component: UserProfile,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true},
  },
  {
    path: ROUTES.USER_PROFILE_UID,
    component: UserProfile,
    guard: isAuthenticated,
    layout: {showGoBackFab: true, showFeedbackFab: true},
  },
  {
    path: ROUTES.DONATE_RESULT,
    component: DonateResult,
    guard: isAuthenticated,
  },
  {
    path: ROUTES.DONATE,
    component: Donate,
    guard: isAuthenticated,
  },

  // ── Nur E-Mail-Verifizierung (kein Auth-Redirect) ──
  {
    path: ROUTES.PASSWORD_CHANGE,
    component: PasswordChange,
    emailVerificationOnly: true,
    layout: {showFeedbackFab: true},
  },

  // ── Admin oder CommunityLeader ──
  {
    path: ROUTES.PRODUCTS,
    component: Products,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.MATERIALS,
    component: Materials,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.DEPARTMENTS,
    component: Departments,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFeedbackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM,
    component: System,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_WHERE_USED,
    component: WhereUsed,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_MERGE_ITEM,
    component: MergeItems,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_CONVERT_ITEM,
    component: ConvertItem,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_OVERVIEW_RECIPES,
    component: OverviewRecipes,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_OVERVIEW_EVENTS,
    component: OverviewEvents,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_ACTIVATE_SUPPORT_USER,
    component: ActivateSupportUser,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_MAIL_CONSOLE,
    component: MailConsole,
    guard: isAdminOrCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },

  // ── Nur Admin ──
  {
    path: ROUTES.SYSTEM_SYSTEM_MESSAGES,
    component: SystemMessageOverview,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_SYSTEM_MESSAGE_NEW,
    component: SystemMessage,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_SYSTEM_MESSAGE_EDIT,
    component: SystemMessage,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_GLOBAL_SETTINGS,
    component: GlobalSettings,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_MIGRATION,
    component: Migration,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_OVERVIEW_USERS,
    component: OverviewUsers,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_OVERVIEW_MAILBOX,
    component: OverviewMailbox,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_DATA_INTEGRITY,
    component: DataIntegrity,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_OVERVIEW_DONATIONS,
    component: OverviewDonations,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_DONATION_GOALS,
    component: DonationGoals,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },
  {
    path: ROUTES.SYSTEM_CRON_JOBS,
    component: CronJobs,
    guard: isAdmin,
    layout: {showGoBackFab: true, showFooter: true},
  },

  // ── CommunityLeader ──
  {
    path: ROUTES.SYSTEM_OVERVIEW_FEEDS,
    component: OverviewFeeds,
    guard: isCommunityLeader,
    layout: {showGoBackFab: true, showFooter: true},
  },

  // ── Schema (Admin) ──
  {
    path: ROUTES.SCHEMA,
    component: Schema,
    guard: isAdmin,
  },
];

export {routeConfig};
export type {RouteDefinition, RouteLayout};
