// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {TermOfUsePage, TermOfUseText} from "../termOfUse";
import {MemoryRouter} from "react-router";

describe("TermOfUsePage", () => {
  test("rendert Titel und Karte", () => {
    render(
      <MemoryRouter>
        <TermOfUsePage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Nutzungsbedingungen").length).toBeGreaterThan(0);
  });
});

describe("TermOfUseText", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <TermOfUseText />
      </MemoryRouter>
    );
  });

  test("rendert Kostenhinweis-Abschnitt", () => {
    expect(screen.getByText("Kostenhinweis für die Nutzung")).toBeInTheDocument();
  });

  test("rendert Haftungsausschluss-Abschnitt", () => {
    expect(screen.getByText("Allgemeiner Haftungsausschluss")).toBeInTheDocument();
  });

  test("enthält Stand-Datum", () => {
    expect(screen.getByText("Stand, 1. März 2024.")).toBeInTheDocument();
  });
});
