// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isTestEnvironment: jest.fn(() => false),
    isDevEnvironment: jest.fn(() => true),
    isProductionEnvironment: jest.fn(() => false),
    getEnvironment: jest.fn(() => 2),
    isUrl: jest.fn(() => false),
    getDomain: jest.fn(() => ""),
    sortArray: jest.fn(({array}: {array: unknown[]}) => array),
    generateUid: jest.fn(() => "mock-uid"),
  },
  Environment: {
    development: 0,
    test: 1,
    production: 2,
  },
}));

// Mock Guards und Komponenten
jest.mock("../../Session/GuardedRoute", () => ({
  GuardedRoute: ({children}: {children: React.ReactNode}) => (
    <div data-testid="guarded-route">{children}</div>
  ),
}));
jest.mock("../../Session/emailVerificationGuard", () => ({
  EmailVerificationGuard: ({children}: {children: React.ReactNode}) => (
    <div data-testid="email-guard">{children}</div>
  ),
}));
jest.mock("../../404/404", () => ({
  NotFoundPage: () => <div data-testid="not-found">404</div>,
}));

// Mock alle eagerly-loaded Komponenten als named exports
jest.mock("../../Landing/Landing", () => ({
  LandingPage: () => <div data-testid="landing">Landing</div>,
}));
jest.mock("../../SignIn/signIn", () => ({
  SignInPage: () => <div data-testid="signin">SignIn</div>,
}));
jest.mock("../../SignUp/signUp", () => ({
  SignUpPage: () => <div data-testid="signup">SignUp</div>,
}));
jest.mock("../../AuthServiceHandler/authServiceHandler", () => ({
  AuthServiceHandlerPage: () => <div>AuthServiceHandler</div>,
}));
jest.mock("../../Session/noAuth", () => ({
  NoAuthPage: () => <div>NoAuth</div>,
}));
jest.mock("../../User/publicProfile", () => ({
  PublicProfilePage: () => <div>PublicProfile</div>,
}));

// Lazy-loaded Module — named exports passend zu routeConfig.ts
jest.mock("../../PasswordChange/passwordChange", () => ({
  PasswordChangePage: () => <div>PasswordChange</div>,
}));
jest.mock("../../Unit/units", () => ({
  UnitsPage: () => <div>Units</div>,
}));
jest.mock("../../Unit/unitConversion", () => ({
  UnitConversionPage: () => <div>UnitConversion</div>,
}));
jest.mock("../../Product/products", () => ({
  ProductsPage: () => <div>Products</div>,
}));
jest.mock("../../Material/materials", () => ({
  MaterialPage: () => <div>Materials</div>,
}));
jest.mock("../../Department/departments", () => ({
  DepartmentsPage: () => <div>Departments</div>,
}));
jest.mock("../../Request/requestOverview", () => ({
  RequestOverviewPage: () => <div>RequestOverview</div>,
}));
jest.mock("../../Home/Home", () => ({
  HomePage: () => <div>Home</div>,
}));
jest.mock("../../User/userProfile", () => ({
  UserProfilePage: () => <div>UserProfile</div>,
}));
jest.mock("../privacyPolicy", () => ({
  PrivacyPolicyPage: () => <div>PrivacyPolicy</div>,
}));
jest.mock("../termOfUse", () => ({
  TermOfUsePage: () => <div>TermOfUse</div>,
}));
jest.mock("../../Event/Event/event", () => ({
  EventPage: () => <div>Event</div>,
}));
jest.mock("../../Event/Event/events", () => ({
  EventsPage: () => <div>Events</div>,
}));
jest.mock("../../Recipe/recipe", () => ({
  RecipePage: () => <div>Recipe</div>,
}));
jest.mock("../../Event/Event/createNewEvent", () => ({
  CreateEventPage: () => <div>CreateNewEvent</div>,
}));
jest.mock("../../Recipe/recipes", () => ({
  RecipesPage: () => <div>Recipes</div>,
}));
jest.mock("../../Donate/DonatePage", () => ({
  DonatePage: () => <div>Donate</div>,
}));
jest.mock("../../Donate/DonationResult", () => ({
  DonationResultPage: () => <div>DonateResult</div>,
}));
jest.mock("../../AuthServiceHandler/passwordReset", () => ({
  PasswordResetPage: () => <div>PasswordReset</div>,
}));
jest.mock("../../Admin/system", () => ({
  __esModule: true,
  default: () => <div>System</div>,
}));
jest.mock("../../Admin/GlobalSettings/globalSettings", () => ({
  __esModule: true,
  default: () => <div>GlobalSettings</div>,
}));
jest.mock("../../Admin/SystemMessage/systemMessageOverview", () => ({
  __esModule: true,
  default: () => <div>SystemMessageOverview</div>,
}));
jest.mock("../../Admin/SystemMessage/systemMessage", () => ({
  __esModule: true,
  default: () => <div>SystemMessage</div>,
}));
jest.mock("../../Admin/whereUsed", () => ({
  __esModule: true,
  default: () => <div>WhereUsed</div>,
}));
jest.mock("../../Admin/mergeItems", () => ({
  __esModule: true,
  default: () => <div>MergeItems</div>,
}));
jest.mock("../../Admin/convertItem", () => ({
  __esModule: true,
  default: () => <div>ConvertItem</div>,
}));
jest.mock("../../Admin/Overview/overviewRecipes", () => ({
  __esModule: true,
  default: () => <div>OverviewRecipes</div>,
}));
jest.mock("../../Admin/Overview/overviewEvents", () => ({
  __esModule: true,
  default: () => <div>OverviewEvents</div>,
}));
jest.mock("../../Admin/Overview/overviewUsers", () => ({
  __esModule: true,
  default: () => <div>OverviewUsers</div>,
}));
jest.mock("../../Admin/overviewMailbox", () => ({
  __esModule: true,
  default: () => <div>OverviewMailbox</div>,
}));
jest.mock("../../Admin/Overview/overviewFeeds", () => ({
  __esModule: true,
  default: () => <div>OverviewFeeds</div>,
}));
jest.mock("../../Admin/Overview/overviewDonations", () => ({
  OverviewDonationsPage: () => <div>OverviewDonations</div>,
}));
jest.mock("../../Admin/activateSupportUser", () => ({
  __esModule: true,
  default: () => <div>ActivateSupportUser</div>,
}));
jest.mock("../../Admin/mailConsole", () => ({
  __esModule: true,
  default: () => <div>MailConsole</div>,
}));
jest.mock("../../Admin/migration", () => ({
  __esModule: true,
  default: () => <div>Migration</div>,
}));
jest.mock("../../Admin/DataIntegrity/dataIntegrity", () => ({
  __esModule: true,
  default: () => <div>DataIntegrity</div>,
}));
jest.mock("../../Admin/CronJobs/cronJobs", () => ({
  __esModule: true,
  default: () => <div>CronJobs</div>,
}));
jest.mock("../../Admin/DonationGoals/donationGoals", () => ({
  DonationGoalsPage: () => <div>DonationGoals</div>,
}));

import {AppRoutes} from "../AppRoutes";

const renderAtPath = (path: string) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <React.Suspense fallback={<div>Loading...</div>}>
        <AppRoutes />
      </React.Suspense>
    </MemoryRouter>,
  );
};

describe("AppRoutes", () => {
  test("öffentliche Route /signin rendert ohne Guard", async () => {
    renderAtPath("/signin");
    expect(await screen.findByTestId("signin")).toBeInTheDocument();
    expect(screen.queryByTestId("guarded-route")).not.toBeInTheDocument();
  });

  test("geschützte Route /home wird mit GuardedRoute gewrappt", async () => {
    renderAtPath("/home");
    expect(await screen.findByTestId("guarded-route")).toBeInTheDocument();
  });

  test("Catch-All rendert NotFoundPage", async () => {
    renderAtPath("/diese-route-gibt-es-nicht");
    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
  });
});
