import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {ThemeProvider, createTheme} from "@mui/material/styles";

import {HeroSection} from "../HeroSection";

const theme = createTheme();

const renderHero = (onSignIn = jest.fn(), onSignUp = jest.fn()) => {
  return {
    onSignIn,
    onSignUp,
    ...render(
      <ThemeProvider theme={theme}>
        <HeroSection onSignIn={onSignIn} onSignUp={onSignUp} />
      </ThemeProvider>,
    ),
  };
};

describe("HeroSection", () => {
  test("zeigt den App-Namen als Überschrift an", () => {
    renderHero();
    expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("chuchipirat");
  });

  test("zeigt den Claim-Text als Unterüberschrift an", () => {
    renderHero();
    expect(screen.getByRole("heading", {level: 2})).toHaveTextContent(
      "einfach kochen für Gruppen",
    );
  });

  test("zeigt Anmelden- und Registrieren-Buttons", () => {
    renderHero();
    expect(screen.getByRole("button", {name: /Anmelden/i})).toBeInTheDocument();
    expect(screen.getByRole("button", {name: /Registrieren/i})).toBeInTheDocument();
  });

  test("ruft onSignIn beim Klick auf Anmelden auf", async () => {
    const {onSignIn} = renderHero();
    await userEvent.click(screen.getByRole("button", {name: /Anmelden/i}));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  test("ruft onSignUp beim Klick auf Registrieren auf", async () => {
    const {onSignUp} = renderHero();
    await userEvent.click(screen.getByRole("button", {name: /Registrieren/i}));
    expect(onSignUp).toHaveBeenCalledTimes(1);
  });

  test("zeigt das Logo mit beschreibendem Alt-Text", () => {
    renderHero();
    const logo = screen.getByAltText(/chuchipirat Logo/i);
    expect(logo).toBeInTheDocument();
  });
});
