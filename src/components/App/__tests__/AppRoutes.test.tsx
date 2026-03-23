// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

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

// Mock alle lazy-loaded Komponenten als simple Stubs
jest.mock("../../Landing/landing", () => () => (
  <div data-testid="landing">Landing</div>
));
jest.mock("../../SignIn/signIn", () => () => (
  <div data-testid="signin">SignIn</div>
));
jest.mock("../../SignUp/signUp", () => () => (
  <div data-testid="signup">SignUp</div>
));
jest.mock("../../AuthServiceHandler/authServiceHandler", () => () => (
  <div>AuthServiceHandler</div>
));
jest.mock("../../Session/noAuth", () => () => <div>NoAuth</div>);
jest.mock("../../User/publicProfile", () => () => <div>PublicProfile</div>);

// Lazy-loaded Module als default-Exporte mocken
jest.mock("../../PasswordChange/passwordChange", () => ({
  __esModule: true,
  default: () => <div>PasswordChange</div>,
}));
jest.mock("../../Unit/units", () => ({
  __esModule: true,
  default: () => <div>Units</div>,
}));
jest.mock("../../Unit/unitConversion", () => ({
  __esModule: true,
  default: () => <div>UnitConversion</div>,
}));
jest.mock("../../Product/products", () => ({
  __esModule: true,
  default: () => <div>Products</div>,
}));
jest.mock("../../Material/materials", () => ({
  __esModule: true,
  default: () => <div>Materials</div>,
}));
jest.mock("../../Department/departments", () => ({
  __esModule: true,
  default: () => <div>Departments</div>,
}));
jest.mock("../../Request/requestOverview", () => ({
  __esModule: true,
  default: () => <div>RequestOverview</div>,
}));
jest.mock("../../Home/home", () => ({
  __esModule: true,
  default: () => <div>Home</div>,
}));
jest.mock("../../User/userProfile", () => ({
  __esModule: true,
  default: () => <div>UserProfile</div>,
}));
jest.mock("../privacyPolicy", () => ({
  __esModule: true,
  PrivacyPolicyPage: () => <div>PrivacyPolicy</div>,
}));
jest.mock("../termOfUse", () => ({
  __esModule: true,
  TermOfUsePage: () => <div>TermOfUse</div>,
}));
jest.mock("../../Temp/schema", () => ({
  __esModule: true,
  default: () => <div>Schema</div>,
}));
jest.mock("../../Event/Event/event", () => ({
  __esModule: true,
  default: () => <div>Event</div>,
}));
jest.mock("../../Event/Event/events", () => ({
  __esModule: true,
  default: () => <div>Events</div>,
}));
jest.mock("../../Recipe/recipe", () => ({
  __esModule: true,
  default: () => <div>Recipe</div>,
}));
jest.mock("../../Event/Event/createNewEvent", () => ({
  __esModule: true,
  default: () => <div>CreateNewEvent</div>,
}));
jest.mock("../../Recipe/recipes", () => ({
  __esModule: true,
  default: () => <div>Recipes</div>,
}));
jest.mock("../../Donate/donate", () => ({
  __esModule: true,
  default: () => <div>Donate</div>,
}));
jest.mock("../../AuthServiceHandler/passwordReset", () => ({
  __esModule: true,
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

import {AppRoutes} from "../AppRoutes";

const renderAtPath = (path: string) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <React.Suspense fallback={<div>Loading...</div>}>
        <AppRoutes />
      </React.Suspense>
    </MemoryRouter>
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
