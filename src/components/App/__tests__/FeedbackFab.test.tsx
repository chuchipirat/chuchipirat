// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

const detachMock = jest.fn();
const attachToMock = jest.fn(() => detachMock);
const feedbackIntegrationMock = jest.fn(() => ({attachTo: attachToMock}));

jest.mock("@sentry/react", () => ({
  feedbackIntegration: (...args: unknown[]) => feedbackIntegrationMock(...args),
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

  test("hängt das Sentry-Feedback-Formular beim Mount an den Button", () => {
    render(<FeedbackFab />);

    expect(feedbackIntegrationMock).toHaveBeenCalledWith({autoInject: false});
    expect(attachToMock).toHaveBeenCalledTimes(1);

    const [element, options] = attachToMock.mock.calls[0] as [
      HTMLElement,
      Record<string, unknown>,
    ];
    expect(element).toHaveAttribute("id", "custom-feedback-button");
    expect(options).toMatchObject({formTitle: "Feedback", colorScheme: "system"});
  });

  test("löst die Feedback-Anbindung beim Unmount wieder", () => {
    const {unmount} = render(<FeedbackFab />);
    expect(detachMock).not.toHaveBeenCalled();

    unmount();
    expect(detachMock).toHaveBeenCalledTimes(1);
  });
});
