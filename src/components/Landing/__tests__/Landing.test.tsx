// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import LandingPage from "../landing";
import userEvent from "@testing-library/user-event";
import {
  SIGN_IN as ROUTE_SIGN_IN,
  SIGN_UP as ROUTE_SIGN_UP,
  HOME as ROUTE_HOME,
} from "../../../constants/routes";

import {MemoryRouter, useLocation} from "react-router";
import {AuthUserContext} from "../../Session/authUserContext";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import authUser from "../../Firebase/Authentication/__mocks__/authuser.mock";

jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({LANDING_LOGO: "mock-logo.png"}),
    getLandingPageEnvironmentRelatedPicture: () => ({
      recipes: "mock-recipes.png",
      groupconfig: "mock-groupconfig.png",
      menuplan: "mock-menuplan.png",
      scaling: "mock-scaling.png",
      shoppinglist: "mock-shoppinglist.png",
    }),
  },
}));

let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

const mockFirebase = {} as any;

const renderLanding = (authUserValue: any = null) => {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <AuthUserContext.Provider value={authUserValue}>
          <LandingPage />
          <LocationDisplay />
        </AuthUserContext.Provider>
      </FirebaseContext.Provider>
    </MemoryRouter>,
  );
};

describe("LandingPage", () => {
  beforeEach(() => jest.clearAllMocks());

  test("Buttons aktiv", () => {
    renderLanding(null);

    let button = screen.getByRole("button", {name: /Anmelden/i});
    expect(button).toBeEnabled();
    button = screen.getByRole("button", {name: /Registrieren/i});
    expect(button).toBeEnabled();
  });

  test("Navigation funktioniert", async () => {
    renderLanding(null);
    let button = screen.getByRole("button", {name: /Anmelden/i});
    await userEvent.click(button);

    expect(testLocation.pathname).toBe(ROUTE_SIGN_IN);
    button = screen.getByRole("button", {name: /Registrieren/i});

    await userEvent.click(button);
    expect(testLocation.pathname).toBe(ROUTE_SIGN_UP);
  });

  test("Authuser != null, Weiterleitung zu Home", () => {
    renderLanding(authUser);
    expect(testLocation.pathname).toBe(ROUTE_HOME);
  });
});
