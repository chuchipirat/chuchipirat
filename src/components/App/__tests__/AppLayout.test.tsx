// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

// firebase/auth benötigt Web-APIs die in jsdom nicht vorhanden sind
jest.mock("firebase/auth", () => ({}));

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";
import {ThemeProvider, createTheme} from "@mui/material/styles";

// Mocks
jest.mock("../../Navigation/GoBackFab", () => ({
  GoBackFab: () => <div data-testid="go-back-fab">GoBack</div>,
}));
jest.mock("../../Footer/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));
jest.mock("../FeedbackFab", () => ({
  FeedbackFab: () => <div data-testid="feedback-fab">Feedback</div>,
}));
jest.mock("../../../constants/styles", () => () => ({
  fabBottom: {},
}));

import {
  ConditionalGoBackFab,
  ConditionalFeedbackFab,
  ConditionalFooter,
} from "../AppLayout";

const theme = createTheme();

/**
 * Rendert eine Komponente innerhalb von Theme- und Router-Providern.
 * initialPath steuert den simulierten URL-Pfad.
 */
const renderWithProviders = (
  component: React.ReactElement,
  initialPath: string = "/"
) => {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>{component}</MemoryRouter>
    </ThemeProvider>
  );
};

describe("ConditionalFeedbackFab", () => {
  test("rendert FeedbackFab auf passender Route", () => {
    // /signin hat showFeedbackFab: true
    renderWithProviders(<ConditionalFeedbackFab />, "/signin");
    expect(screen.getByTestId("feedback-fab")).toBeInTheDocument();
  });

  test("rendert nichts auf Route ohne showFeedbackFab", () => {
    // /signup hat kein showFeedbackFab
    renderWithProviders(<ConditionalFeedbackFab />, "/signup");
    expect(screen.queryByTestId("feedback-fab")).not.toBeInTheDocument();
  });
});

describe("ConditionalFooter", () => {
  test("rendert Footer auf passender Route", () => {
    // / (Landing) hat showFooter: true
    renderWithProviders(<ConditionalFooter />, "/");
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  test("rendert nichts auf Route ohne showFooter", () => {
    // /privacypolicy hat kein showFooter
    renderWithProviders(<ConditionalFooter />, "/privacypolicy");
    expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
  });
});

describe("ConditionalGoBackFab", () => {
  test("rendert nichts auf Desktop-Viewport (unabhängig vom Pfad)", () => {
    // Standard jsdom-Viewport ist Desktop-Grösse
    renderWithProviders(<ConditionalGoBackFab />, "/home");
    expect(screen.queryByTestId("go-back-fab")).not.toBeInTheDocument();
  });
});
