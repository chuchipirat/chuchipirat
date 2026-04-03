/**
 * Unit-Tests fuer die PasswordStrengthMeter-Komponente.
 * Prueft Score-Label-Zuordnung und Fortschrittsbalken-Farben.
 */

// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";

import {PasswordStrengthMeter} from "../passwordStrengthMeter";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer @zxcvbn-ts/core — gibt einen kontrollierten Score zurueck. */
let mockScore = 0;
jest.mock("@zxcvbn-ts/core", () => ({
  zxcvbnAsync: jest.fn(() => Promise.resolve({score: mockScore})),
  zxcvbnOptions: {setOptions: jest.fn()},
}));

/** Mock fuer die Sprachpakete — leere Objekte genuegen fuer Tests. */
jest.mock("@zxcvbn-ts/language-common", () => ({
  adjacencyGraphs: {},
  dictionary: {},
}));
jest.mock("@zxcvbn-ts/language-de", () => ({
  translations: {},
  dictionary: {},
}));

/** Mock fuer useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die PasswordStrengthMeter-Komponente mit dem uebergebenen Passwort.
 *
 * @param password Das zu bewertende Passwort.
 * @returns Render-Ergebnis von @testing-library/react.
 */
const renderMeter = (password: string) => {
  return render(<PasswordStrengthMeter password={password} />);
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockScore = 0;
});

describe("PasswordStrengthMeter", () => {
  describe("Score-Label-Zuordnung", () => {
    test("Score 0 zeigt 'Schwach' an", async () => {
      mockScore = 0;

      renderMeter("a");

      await waitFor(() => {
        expect(screen.getByText("Schwach")).toBeInTheDocument();
      });
    });

    test("Score 2 zeigt 'Ausreichend' an", async () => {
      mockScore = 2;

      renderMeter("mittleres-passwort");

      await waitFor(() => {
        expect(screen.getByText("Ausreichend")).toBeInTheDocument();
      });
    });

    test("Score 3 zeigt 'Gut' an", async () => {
      mockScore = 3;

      renderMeter("gutes-passwort123");

      await waitFor(() => {
        expect(screen.getByText("Gut")).toBeInTheDocument();
      });
    });

    test("Score 4 zeigt 'Stark' an", async () => {
      mockScore = 4;

      renderMeter("sehr-starkes-passwort!");

      await waitFor(() => {
        expect(screen.getByText("Stark")).toBeInTheDocument();
      });
    });
  });

  describe("Leeres Passwort", () => {
    test("Zeigt kein Label an wenn das Passwort leer ist", async () => {
      mockScore = 0;

      renderMeter("");

      // Der Praefix-Text wird immer angezeigt, aber kein Label in <strong>
      await waitFor(() => {
        expect(screen.queryByText("Schwach")).not.toBeInTheDocument();
        expect(screen.queryByText("Ausreichend")).not.toBeInTheDocument();
        expect(screen.queryByText("Gut")).not.toBeInTheDocument();
        expect(screen.queryByText("Stark")).not.toBeInTheDocument();
      });
    });
  });

  describe("Fortschrittsbalken-Farbe", () => {
    test("Score 0 zeigt Farbe 'error'", async () => {
      mockScore = 0;

      const {container} = renderMeter("a");

      await waitFor(() => {
        const progressBar = container.querySelector(".MuiLinearProgress-root");
        expect(progressBar).toHaveClass("MuiLinearProgress-colorError");
      });
    });

    test("Score 2 zeigt Farbe 'warning'", async () => {
      mockScore = 2;

      const {container} = renderMeter("mittel");

      await waitFor(() => {
        const progressBar = container.querySelector(".MuiLinearProgress-root");
        expect(progressBar).toHaveClass("MuiLinearProgress-colorWarning");
      });
    });

    test("Score 3 zeigt Farbe 'info'", async () => {
      mockScore = 3;

      const {container} = renderMeter("gutes-pw");

      await waitFor(() => {
        const progressBar = container.querySelector(".MuiLinearProgress-root");
        expect(progressBar).toHaveClass("MuiLinearProgress-colorInfo");
      });
    });

    test("Score 4 zeigt Farbe 'success'", async () => {
      mockScore = 4;

      const {container} = renderMeter("starkes-pw!");

      await waitFor(() => {
        const progressBar = container.querySelector(".MuiLinearProgress-root");
        expect(progressBar).toHaveClass("MuiLinearProgress-colorSuccess");
      });
    });
  });
});
