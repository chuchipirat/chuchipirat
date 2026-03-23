/**
 * Unit-Tests fuer DonationForm.
 *
 * Testet Betragsauswahl (Presets und Custom), Nachrichten-Feld,
 * Submit-Button-Zustand und Authentifizierungspruefung.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

/* ===================================================================
// Mock-Setup
// =================================================================== */

/** Mock: supabaseClient */
jest.mock("../../Database/supabaseClient", () => ({
  supabase: {functions: {invoke: jest.fn()}},
}));

/** Mock: useAuthUser — standardmaessig authentifiziert. */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "test@chuchipirat.ch",
  roles: [],
  publicProfile: {
    displayName: "Test Koch",
    motto: "Testmotto",
    pictureSrc: "",
  },
};

let authUserValue: typeof mockAuthUser | null = mockAuthUser;

jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => authUserValue,
}));

import {DonationForm} from "../DonationForm";

/* ===================================================================
// Hilfs-Render-Funktion
// =================================================================== */

/**
 * Rendert DonationForm mit optionalen Props.
 */
const renderDonationForm = (
  props: Partial<React.ComponentProps<typeof DonationForm>> = {},
) => {
  return render(<DonationForm {...props} />);
};

/* ===================================================================
// Tests
// =================================================================== */

describe("DonationForm", () => {
  beforeEach(() => {
    authUserValue = mockAuthUser;
  });

  /* ----- Betragsauswahl (Presets) ----- */

  describe("Preset-Betraege", () => {
    test("zeigt die vier vordefinierten Betraege an (5, 10, 20, 50)", () => {
      renderDonationForm();

      expect(screen.getByText("CHF 5")).toBeInTheDocument();
      expect(screen.getByText("CHF 10")).toBeInTheDocument();
      expect(screen.getByText("CHF 20")).toBeInTheDocument();
      expect(screen.getByText("CHF 50")).toBeInTheDocument();
    });

    test("CHF 10 ist standardmaessig ausgewaehlt", () => {
      renderDonationForm();

      // Der ToggleButton fuer CHF 10 sollte aria-pressed=true haben
      const button10 = screen.getByText("CHF 10").closest("button");
      expect(button10).toHaveAttribute("aria-pressed", "true");
    });

    test("Klick auf Preset aktualisiert die Auswahl", () => {
      renderDonationForm();

      const button20 = screen.getByText("CHF 20").closest("button")!;
      fireEvent.click(button20);

      expect(button20).toHaveAttribute("aria-pressed", "true");

      // CHF 10 sollte nicht mehr ausgewaehlt sein
      const button10 = screen.getByText("CHF 10").closest("button");
      expect(button10).toHaveAttribute("aria-pressed", "false");
    });
  });

  /* ----- Custom-Betrag ----- */

  describe("Custom-Betrag", () => {
    test("Klick auf 'Anderer Betrag' zeigt Custom-Feld und deselektiert Presets", async () => {
      renderDonationForm();

      // Zuerst «Anderer Betrag» anklicken, damit das Custom-Feld erscheint
      const customToggle = screen.getByText("Anderer Betrag").closest("button")!;
      await userEvent.click(customToggle);

      const customInput = screen.getByPlaceholderText("z.B. 15");
      expect(customInput).toBeInTheDocument();

      // Kein Preset sollte aktiv sein
      const button10 = screen.getByText("CHF 10").closest("button");
      expect(button10).toHaveAttribute("aria-pressed", "false");
    });

    test("Custom-Feld akzeptiert numerische Eingabe", async () => {
      renderDonationForm();

      // Zuerst «Anderer Betrag» anklicken
      const customToggle = screen.getByText("Anderer Betrag").closest("button")!;
      await userEvent.click(customToggle);

      const customInput = screen.getByPlaceholderText("z.B. 15");
      await userEvent.type(customInput, "25");

      expect(customInput).toHaveValue("25");
    });
  });

  /* ----- Nachrichten-Feld ----- */

  describe("Nachrichten-Feld", () => {
    test("zeigt Zeichenzaehler an", () => {
      renderDonationForm();

      expect(screen.getByText("0/200")).toBeInTheDocument();
    });

    test("Zeichenzaehler aktualisiert sich bei Eingabe", async () => {
      renderDonationForm();

      const messageInput = screen.getByPlaceholderText(
        "Deine Nachricht an uns...",
      );
      await userEvent.type(messageInput, "Danke!");

      expect(screen.getByText("6/200")).toBeInTheDocument();
    });

    test("Nachricht ist auf 200 Zeichen begrenzt (maxLength-Attribut)", () => {
      renderDonationForm();

      const messageInput = screen.getByPlaceholderText(
        "Deine Nachricht an uns...",
      );
      expect(messageInput).toHaveAttribute("maxlength", "200");
    });
  });

  /* ----- Submit-Button ----- */

  describe("Submit-Button", () => {
    test("zeigt den Betrag an, wenn gueltig", () => {
      renderDonationForm();

      // Standard: CHF 10, Button sollte "Jetzt spenden — CHF 10.00" anzeigen
      expect(
        screen.getByRole("button", {name: /Jetzt spenden — CHF 10\.00/}),
      ).toBeInTheDocument();
    });

    test("ist deaktiviert, wenn Betrag unter CHF 5", async () => {
      renderDonationForm();

      // Zuerst «Anderer Betrag» anklicken
      const customToggle = screen.getByText("Anderer Betrag").closest("button")!;
      await userEvent.click(customToggle);

      const customInput = screen.getByPlaceholderText("z.B. 15");
      await userEvent.type(customInput, "2");

      const submitButton = screen.getByRole("button", {
        name: /Jetzt spenden/,
      });
      expect(submitButton).toBeDisabled();
    });
  });

  /* ----- Authentifizierung ----- */

  describe("Authentifizierung", () => {
    test("gibt null zurueck, wenn nicht authentifiziert", () => {
      authUserValue = null;

      const {container} = renderDonationForm();
      expect(container.innerHTML).toBe("");
    });

    test("zeigt Spender-Info aus authUser an", () => {
      renderDonationForm();

      expect(
        screen.getByText(/Test Koch.*test@chuchipirat\.ch/),
      ).toBeInTheDocument();
    });
  });
});
