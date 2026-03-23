// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import Footer from "../footer";
import packageJson from "../../../../package.json";

import {
  TERM_OF_USE as ROUTE_TERM_OF_USE,
  PRIVACY_POLICY as ROUTE_PRIVACY_POLICY,
} from "../../../constants/routes";
import {
  TERM_OF_USE as TEXT_TERM_OF_USE,
  PRIVACY_POLICY as TEXT_PRIVACY_POLICY,
  FOOTER_QUESTIONS_SUGGESTIONS as TEXT_FOOTER_QUESTIONS_SUGGESTIONS,
} from "../../../constants/text";

import {MemoryRouter, useLocation} from "react-router";

import {
  MAILADDRESS as DEFAULT_VALUES_MAILADDRESS,
  HELPCENTER_URL as DEFAULT_VALUES_HELPCENTER_URL,
  INSTAGRAM_URL as DEFAULT_VALUES_INSTAGRAM_URL,
} from "../../../constants/defaultValues";

// Helper to capture the current location for navigation assertions
let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

describe("Footer Links funktionieren", () => {
  test("jubla.ch", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", {name: "Lebensfreu(n)de"});
    expect(link).toHaveAttribute("href", "https://jubla.ch");
  });
  test("Versionsnummer", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", {name: packageJson.version});
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/gcettuzz/chuchipirat"
    );
  });
  test("E-Mail", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", {name: DEFAULT_VALUES_MAILADDRESS});
    expect(link).toHaveAttribute(
      "href",
      `mailto:${DEFAULT_VALUES_MAILADDRESS}`
    );
  });
  test("Helpcenter", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const link = screen.getByRole("link", {
      name: TEXT_FOOTER_QUESTIONS_SUGGESTIONS.HELPCENTER,
    });
    expect(link).toHaveAttribute("href", DEFAULT_VALUES_HELPCENTER_URL);
  });
  test("Nutzungsbedingungen", () => {
    render(
      <MemoryRouter>
        <Footer />
        <LocationDisplay />
      </MemoryRouter>
    );

    const link = screen.getByText(TEXT_TERM_OF_USE);

    fireEvent.click(link);
    expect(testLocation.pathname).toBe(ROUTE_TERM_OF_USE);
  });
  test("Datenschutzerklärung", () => {
    render(
      <MemoryRouter>
        <Footer />
        <LocationDisplay />
      </MemoryRouter>
    );

    const link = screen.getByText(TEXT_PRIVACY_POLICY);

    fireEvent.click(link);
    expect(testLocation.pathname).toBe(ROUTE_PRIVACY_POLICY);
  });
  test("Instagram Link", () => {
    const originalOpen = window.open;
    window.open = jest.fn();

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const iconButton = screen.getByLabelText("Instagramm");
    fireEvent.click(iconButton);

    expect(window.open).toHaveBeenCalledWith(
      DEFAULT_VALUES_INSTAGRAM_URL,
      "_blank"
    );

    window.open = originalOpen;
  });
});
