// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {SessionStorageHandler} from "../../Firebase/Db/sessionStorageHandler.class";

/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isTestEnvironment: jest.fn(() => false),
    isDevEnvironment: jest.fn(() => true),
    isProductionEnvironment: jest.fn(() => false),
    getEnvironment: jest.fn(() => 2),
    isUrl: jest.fn(() => false),
    getDomain: jest.fn(() => ""),
    sortArray: jest.fn(({array}: {array: unknown[]}) => array),
    generateUid: jest.fn(() => "mock-uid"),
  },
  Environment: {
    development: 0,
    test: 1,
    production: 2,
  },
}));

// Mocks müssen vor dem Import der Komponente definiert werden
jest.mock("../../Navigation/navigation", () => ({
  Navigation: () => <div>Navigation</div>,
}));
jest.mock("../../Navigation/scrollToTop", () => ({
  ScrollToTop: () => null,
}));
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({fabBottom: {}})),
}));
jest.mock("../../Shared/fallbackLoading", () => ({
  FallbackLoading: () => <div>Loading...</div>,
}));
jest.mock("../../Shared/customDialog", () => ({
  CustomDialog: () => null,
}));
jest.mock("../AppRoutes", () => ({
  AppRoutes: () => <div>Routes</div>,
}));
jest.mock("../AppLayout", () => ({
  ConditionalGoBackFab: () => null,
  ConditionalFeedbackFab: () => null,
  ConditionalFooter: () => null,
}));
jest.mock("@sentry/react", () => ({
  feedbackIntegration: () => ({attachTo: jest.fn()}),
}));
jest.mock("../../Firebase/Db/sessionStorageHandler.class", () => ({
  SessionStorageHandler: {
    clearAll: jest.fn(),
  },
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

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import {App} from "../App";

describe("App", () => {
  test("rendert ohne Absturz (Smoke-Test)", () => {
    render(<App />);
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Routes")).toBeInTheDocument();
  });

  test("registriert beforeunload Event-Listener beim Mount", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<App />);

    expect(addSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
    addSpy.mockRestore();
  });

  test("entfernt beforeunload Listener beim Unmount", () => {
    const removeSpy = jest.spyOn(window, "removeEventListener");
    const {unmount} = render(<App />);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function)
    );
    removeSpy.mockRestore();
  });

  test("ruft SessionStorageHandler.clearAll beim beforeunload auf", () => {
    render(<App />);

    // beforeunload-Event simulieren
    window.dispatchEvent(new Event("beforeunload"));

    expect(SessionStorageHandler.clearAll).toHaveBeenCalled();
  });
});
