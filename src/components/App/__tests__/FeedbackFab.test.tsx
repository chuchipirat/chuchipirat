// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {ThemeProvider, createTheme} from "@mui/material/styles";

import {getTheme} from "../customTheme";
import {Environment, Utils} from "../../Shared/utils.class";

type FeedbackOptions = Record<string, unknown>;
type FeedbackColors = Record<string, string>;

const detachMock = jest.fn();
const attachToMock = jest.fn(
  (_element: HTMLElement, _options: FeedbackOptions) => detachMock,
);
const feedbackIntegrationMock = jest.fn((_options: FeedbackOptions) => ({
  attachTo: attachToMock,
}));

jest.mock("@sentry/react", () => ({
  feedbackIntegration: (options: FeedbackOptions) =>
    feedbackIntegrationMock(options),
}));

jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({fabBottom: {position: "fixed", bottom: 16, right: 16}})),
}));

jest.mock("../../Shared/icons", () => ({
  FeedbackIcon: () => <span data-testid="feedback-icon">Feedback</span>,
}));

jest.mock("../../../constants/text", () => ({
  FEEDBACK: {
    title: "Feedback",
    submitButton: "Senden",
    cancelButton: "Abbrechen",
    addScreenshotButton: "Screenshot",
    removeScreenshotButton: "Entfernen",
    namePlaceholder: "Name",
    emailPlaceholder: "E-Mail",
    messageLabel: "Nachricht",
    messagePlaceholder: "Beschreibe...",
    successMessage: "Danke!",
    isRequired: "Pflichtfeld",
  },
}));

import {FeedbackFab} from "../FeedbackFab";

/**
 * Liefert die Optionen, mit denen die Feedback-Integration erstellt wurde.
 */
const getIntegrationOptions = (): FeedbackOptions => {
  expect(feedbackIntegrationMock).toHaveBeenCalledTimes(1);
  return feedbackIntegrationMock.mock.calls[0][0];
};

/**
 * Liefert die Optionen, mit denen das Formular an den Button gehängt wurde.
 */
const getAttachOptions = (): FeedbackOptions => {
  expect(attachToMock).toHaveBeenCalledTimes(1);
  return attachToMock.mock.calls[0][1];
};

describe("FeedbackFab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rendert einen Fab mit id='custom-feedback-button'", () => {
    render(<FeedbackFab />);
    const fab = screen.getByRole("button");
    expect(fab).toHaveAttribute("id", "custom-feedback-button");
  });

  test("hat aria-label 'Feedback geben'", () => {
    render(<FeedbackFab />);
    const fab = screen.getByLabelText("Feedback geben");
    expect(fab).toBeInTheDocument();
  });

  test("erstellt die Integration ohne automatischen Button und mit Systemfarbschema", () => {
    render(<FeedbackFab />);

    expect(getIntegrationOptions()).toMatchObject({
      autoInject: false,
      colorScheme: "system",
    });
  });

  test("hängt das Sentry-Feedback-Formular beim Mount an den Button", () => {
    render(<FeedbackFab />);

    expect(attachToMock).toHaveBeenCalledTimes(1);
    const [element] = attachToMock.mock.calls[0];
    expect(element).toHaveAttribute("id", "custom-feedback-button");
    expect(getAttachOptions()).toMatchObject({formTitle: "Feedback"});
  });

  test("übergibt beim Anhängen nur Texte, keine Farben", () => {
    render(<FeedbackFab />);

    const attachOptions = getAttachOptions();
    expect(attachOptions).not.toHaveProperty("colorScheme");
    expect(attachOptions).not.toHaveProperty("themeLight");
    expect(attachOptions).not.toHaveProperty("themeDark");
  });

  test("löst die Feedback-Anbindung beim Unmount wieder", () => {
    const {unmount} = render(<FeedbackFab />);
    expect(detachMock).not.toHaveBeenCalled();

    unmount();
    expect(detachMock).toHaveBeenCalledTimes(1);
  });

  test("erstellt bei einem Wechsel des App-Themes keine zweite Integration", () => {
    const lightTheme = createTheme({palette: getTheme(false)});
    const darkTheme = createTheme({palette: getTheme(true)});
    const {rerender} = render(
      <ThemeProvider theme={lightTheme}>
        <FeedbackFab />
      </ThemeProvider>,
    );

    rerender(
      <ThemeProvider theme={darkTheme}>
        <FeedbackFab />
      </ThemeProvider>,
    );

    expect(feedbackIntegrationMock).toHaveBeenCalledTimes(1);
  });

  describe("Farben", () => {
    let getEnvironmentSpy: jest.SpyInstance;

    beforeEach(() => {
      getEnvironmentSpy = jest
        .spyOn(Utils, "getEnvironment")
        .mockReturnValue(Environment.development);
    });

    afterEach(() => {
      getEnvironmentSpy.mockRestore();
    });

    test("leitet hell und dunkel aus der jeweiligen App-Palette ab", () => {
      const lightPalette = createTheme({palette: getTheme(false)}).palette;
      const darkPalette = createTheme({palette: getTheme(true)}).palette;

      render(<FeedbackFab />);

      const {themeLight, themeDark} = getIntegrationOptions();
      expect(themeLight).toEqual({
        foreground: lightPalette.text.primary,
        background: lightPalette.background.default,
        accentBackground: lightPalette.primary.main,
        accentForeground: lightPalette.primary.contrastText,
        successColor: lightPalette.success.main,
        errorColor: lightPalette.error.main,
      });
      expect(themeDark).toEqual({
        foreground: darkPalette.text.primary,
        background: darkPalette.background.default,
        accentBackground: darkPalette.primary.main,
        accentForeground: darkPalette.primary.contrastText,
        successColor: darkPalette.success.main,
        errorColor: darkPalette.error.main,
      });
    });

    test("verwendet ausserhalb von TEST die Produktionsfarben", () => {
      render(<FeedbackFab />);

      const themeLight = getIntegrationOptions().themeLight as FeedbackColors;
      const themeDark = getIntegrationOptions().themeDark as FeedbackColors;
      expect(themeLight.accentBackground).toBe("#006064");
      expect(themeLight.background).toBe("#fff");
      expect(themeDark.accentBackground).toBe("#00bcd4");
      expect(themeDark.background).toBe("#121212");
    });

    test("verwendet auf TEST auch im Dunkelmodus die lila Testfarben", () => {
      getEnvironmentSpy.mockReturnValue(Environment.test);

      render(<FeedbackFab />);

      const themeLight = getIntegrationOptions().themeLight as FeedbackColors;
      const themeDark = getIntegrationOptions().themeDark as FeedbackColors;
      expect(themeLight.accentBackground).toBe("#6a1b9a");
      expect(themeDark.accentBackground).toBe("#AB47BC");
    });
  });
});
