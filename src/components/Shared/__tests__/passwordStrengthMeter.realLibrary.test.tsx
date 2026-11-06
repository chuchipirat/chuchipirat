/**
 * Prüft die Passwortstärke mit der echten zxcvbn-Bibliothek, ohne Mock.
 *
 * Der übrige Test der Komponente mockt zxcvbn und sieht deshalb nicht, wenn
 * eine neue Version ihre Schnittstelle ändert oder die Wörterbücher nicht
 * mehr ankommen. Dieser Test fällt dann auf.
 */

// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";

import {PasswordStrengthMeter} from "../passwordStrengthMeter";

/** Zufälliges Passwort, das zxcvbn sicher als «Stark» bewertet. */
const STRONG_PASSWORD = "vT9#qLm2!xRw7&Zp";

/**
 * Rendert die Anzeige zuerst mit einem starken Passwort und wechselt dann auf
 * das zu prüfende. Die Anzeige startet mit Score 0 («Schwach»), ein schwaches
 * Ergebnis wäre sonst schon vor der Bewertung sichtbar und der Test sinnlos.
 *
 * @param password Das zu bewertende Passwort.
 * @param expectedLabel Erwartetes Label, z.B. «Schwach».
 */
const expectLabel = async (password: string, expectedLabel: string) => {
  const {rerender} = render(
    <PasswordStrengthMeter password={STRONG_PASSWORD} />,
  );
  await waitFor(() => {
    expect(screen.getByText("Stark")).toBeInTheDocument();
  });

  rerender(<PasswordStrengthMeter password={password} />);

  await waitFor(() => {
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
};

describe("PasswordStrengthMeter mit echter Bibliothek", () => {
  it("stuft ein häufiges Passwort als schwach ein", async () => {
    await expectLabel("passwort", "Schwach");
  });

  it("stuft ein langes zufälliges Passwort als stark ein", async () => {
    render(<PasswordStrengthMeter password={STRONG_PASSWORD} />);

    await waitFor(() => {
      expect(screen.getByText("Stark")).toBeInTheDocument();
    });
  });

  it("erkennt ein deutsches Wort aus dem Wörterbuch", async () => {
    // ohne das deutsche Wörterbuch gälte das Wort als zufällig und damit als stark
    await expectLabel("Eichhörnchen", "Schwach");
  });
});
