// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {Footer} from "../Footer";
import packageJson from "../../../../package.json";

import {
  TERM_OF_USE as ROUTE_TERM_OF_USE,
  PRIVACY_POLICY as ROUTE_PRIVACY_POLICY,
} from "../../../constants/routes";
import {
  TERM_OF_USE as TEXT_TERM_OF_USE,
  APP_NAME as TEXT_APP_NAME,
  PRIVACY_POLICY as TEXT_PRIVACY_POLICY,
  FOOTER_QUESTIONS_SUGGESTIONS as TEXT_FOOTER_QUESTIONS_SUGGESTIONS,
} from "../../../constants/text";

import {MemoryRouter} from "react-router";

import {
  MAILADDRESS as DEFAULT_VALUES_MAILADDRESS,
  HELPCENTER_URL as DEFAULT_VALUES_HELPCENTER_URL,
  INSTAGRAM_URL as DEFAULT_VALUES_INSTAGRAM_URL,
} from "../../../constants/defaultValues";

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );

describe("Footer Links funktionieren", () => {
  test("jubla.ch", () => {
    renderFooter();

    const link = screen.getByRole("link", {name: "Lebensfreu(n)de"});
    expect(link).toHaveAttribute("href", "https://jubla.ch");
  });

  test("Versionsnummer", () => {
    renderFooter();

    const link = screen.getByRole("link", {name: packageJson.version});
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/gcettuzz/chuchipirat"
    );
  });

  test("E-Mail", () => {
    renderFooter();

    const link = screen.getByRole("link", {name: DEFAULT_VALUES_MAILADDRESS});
    expect(link).toHaveAttribute(
      "href",
      `mailto:${DEFAULT_VALUES_MAILADDRESS}`
    );
  });

  test("Helpcenter", () => {
    renderFooter();

    const link = screen.getByRole("link", {
      name: TEXT_FOOTER_QUESTIONS_SUGGESTIONS.HELPCENTER,
    });
    expect(link).toHaveAttribute("href", DEFAULT_VALUES_HELPCENTER_URL);
  });

  test("Nutzungsbedingungen", () => {
    renderFooter();

    const link = screen.getByRole("link", {name: TEXT_TERM_OF_USE});
    expect(link).toHaveAttribute("href", ROUTE_TERM_OF_USE);
  });

  test("Datenschutzerklärung", () => {
    renderFooter();

    const link = screen.getByRole("link", {name: TEXT_PRIVACY_POLICY});
    expect(link).toHaveAttribute("href", ROUTE_PRIVACY_POLICY);
  });

  test("Instagram Link", () => {
    renderFooter();

    const link = screen.getByLabelText("Instagram");
    expect(link).toHaveAttribute("href", DEFAULT_VALUES_INSTAGRAM_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Externe Links haben rel='noopener noreferrer'", () => {
  beforeEach(() => renderFooter());

  test("jubla.ch", () => {
    const link = screen.getByRole("link", {name: "Lebensfreu(n)de"});
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("GitHub", () => {
    const link = screen.getByRole("link", {name: packageJson.version});
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("Helpcenter", () => {
    const link = screen.getByRole("link", {
      name: TEXT_FOOTER_QUESTIONS_SUGGESTIONS.HELPCENTER,
    });
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("chuchipirat.ch (Copyright)", () => {
    const link = screen.getByRole("link", {name: TEXT_APP_NAME});
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("Copyright", () => {
  beforeEach(() => renderFooter());

  test("Zeigt aktuelles Jahr an", () => {
    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();
  });

  test("Zeigt App-Name als Link mit korrektem href", () => {
    const link = screen.getByRole("link", {name: TEXT_APP_NAME});
    expect(link).toHaveAttribute("href", "https://chuchipirat.ch/");
  });

  test("Link hat rel='noopener noreferrer'", () => {
    const link = screen.getByRole("link", {name: TEXT_APP_NAME});
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
