// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {LandingPage} from "../Landing";
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


// IntersectionObserver-Mock: observe() löst Callback aus (nach Konstruktor-Return)
type IntersectionCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  global.IntersectionObserver = jest.fn((callback: IntersectionCallback) => {
    return {
      observe: jest.fn((target: Element) => {
        callback([{isIntersecting: true, target}]);
      }),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: jest.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

const mockFirebase = {} as unknown;

const renderLanding = (authUserValue: unknown = null) => {
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

  // --- Bestehende Tests (migriert) ---

  test("Buttons aktiv", () => {
    renderLanding(null);
    const signInButtons = screen.getAllByRole("button", {name: /Anmelden/i});
    expect(signInButtons[0]).toBeEnabled();
    const signUpButtons = screen.getAllByRole("button", {name: /Registrieren/i});
    expect(signUpButtons[0]).toBeEnabled();
  });

  test("Navigation funktioniert", async () => {
    renderLanding(null);
    const signInButtons = screen.getAllByRole("button", {name: /Anmelden/i});
    await userEvent.click(signInButtons[0]);
    expect(testLocation.pathname).toBe(ROUTE_SIGN_IN);

    const signUpButtons = screen.getAllByRole("button", {name: /Registrieren/i});
    await userEvent.click(signUpButtons[0]);
    expect(testLocation.pathname).toBe(ROUTE_SIGN_UP);
  });

  test("Authuser != null, Weiterleitung zu Home", () => {
    renderLanding(authUser);
    expect(testLocation.pathname).toBe(ROUTE_HOME);
  });

  // --- Neue Tests ---

  test("Hero-Bereich zeigt App-Name und Claim", () => {
    renderLanding(null);
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("chuchipirat");
    expect(
      screen.getByRole("heading", {level: 2, name: /einfach kochen/i}),
    ).toBeInTheDocument();
  });

  test("rendert alle Feature-Titel", () => {
    renderLanding(null);
    expect(screen.getByText("Entdecke neue Rezepte")).toBeInTheDocument();
    expect(screen.getByText("Menüplanung leicht gemacht")).toBeInTheDocument();
    expect(screen.getByText("Skalierbare Rezepte")).toBeInTheDocument();
    expect(screen.getByText("Einkaufsliste per Klick")).toBeInTheDocument();
  });

  test("CTA-Bereich wird gerendert", () => {
    renderLanding(null);
    expect(screen.getByText("Bereit fürs nächste Lager?")).toBeInTheDocument();
  });

  test("Bilder und Animationen haben barrierefreie Beschreibung", () => {
    renderLanding(null);
    const images = screen.getAllByRole("img");
    for (const image of images) {
      // Jedes Element mit role="img" muss entweder alt oder aria-label haben
      const altText = image.getAttribute("alt") ?? image.getAttribute("aria-label") ?? "";
      expect(altText).not.toBe("");
    }
  });

  test("h1 und h2 Headings existieren im Hero-Bereich", () => {
    renderLanding(null);
    expect(screen.getByRole("heading", {level: 1})).toBeInTheDocument();
    const h2Elements = screen.getAllByRole("heading", {level: 2});
    expect(h2Elements.length).toBeGreaterThanOrEqual(1);
  });

  test("mehrere Feature-Sections werden gerendert", () => {
    renderLanding(null);
    const h3Elements = screen.getAllByRole("heading", {level: 3});
    expect(h3Elements.length).toBe(7);
  });
});
