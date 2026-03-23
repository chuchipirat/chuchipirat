// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {PrivacyPolicyPage, PrivacyPolicyText} from "../privacyPolicy";
import {MemoryRouter} from "react-router";

describe("PrivacyPolicyPage", () => {
  test("rendert Titel und Karte", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText("Datenschutzerklärung").length).toBeGreaterThan(0);
  });
});

describe("PrivacyPolicyText", () => {
  beforeEach(() => {
    render(
      <MemoryRouter>
        <PrivacyPolicyText />
      </MemoryRouter>
    );
  });

  test("rendert alle 10 Abschnitte", () => {
    // Einige Überschriften sind als <strong> in <li>-Elementen,
    // die auch den Fliesstext enthalten — daher getAllByText nutzen.
    expect(screen.getAllByText(/Verantwortliche Stelle/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Datenschutzbeauftragte/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Erhebung und Verarbeitung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Datenübermittlung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cookies/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SSL-Verschlüsselung/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nutzung von Umami Analytics/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nutzung von Supabase/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rechte der betroffenen Person/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Änderungen dieser Datenschutzerklärung/).length).toBeGreaterThan(0);
  });

  test("enthält E-Mail-Link zu hallo@chuchipirat.ch", () => {
    const emailLinks = screen.getAllByRole("link", {name: "hallo@chuchipirat.ch"});
    expect(emailLinks.length).toBeGreaterThan(0);
    expect(emailLinks[0]).toHaveAttribute("href", "mailto:hallo@chuchipirat.ch");
  });

  test("enthält aktuelles Stand-Datum", () => {
    expect(screen.getByText("Stand: 21. März 2026")).toBeInTheDocument();
  });
});
