/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {render, act} from "@testing-library/react";
import {useScrollReveal} from "../useScrollReveal";

declare const global: any;

// IntersectionObserver existiert nicht in jsdom — Mock bereitstellen
type IntersectionCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

let mockObserve: jest.Mock;
let mockUnobserve: jest.Mock;
let mockDisconnect: jest.Mock;
let capturedCallback: IntersectionCallback;

beforeEach(() => {
  mockObserve = jest.fn();
  mockUnobserve = jest.fn();
  mockDisconnect = jest.fn();

  global.IntersectionObserver = jest.fn((callback: IntersectionCallback) => {
    capturedCallback = callback;
    return {
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: jest.fn(),
    };
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => jest.restoreAllMocks());

/**
 * Test-Komponente, die den Hook mit einem realen DOM-Element verbindet.
 * Gibt den aktuellen isVisible-Wert als data-Attribut zurück.
 */
let lastResult: {isVisible: boolean} = {isVisible: false};

const TestComponent = () => {
  const {elementRef, isVisible} = useScrollReveal();
  lastResult = {isVisible};
  return React.createElement("div", {ref: elementRef, "data-testid": "target"});
};

describe("useScrollReveal", () => {
  test("isVisible startet mit false", () => {
    render(React.createElement(TestComponent));
    expect(lastResult.isVisible).toBe(false);
  });

  test("isVisible wird true bei Intersection", () => {
    render(React.createElement(TestComponent));

    act(() => {
      capturedCallback([{isIntersecting: true, target: document.createElement("div")}]);
    });

    expect(lastResult.isVisible).toBe(true);
  });

  test("Observer entfernt Element nach erster Intersection (unobserve)", () => {
    render(React.createElement(TestComponent));
    const target = document.createElement("div");

    act(() => {
      capturedCallback([{isIntersecting: true, target}]);
    });

    expect(mockUnobserve).toHaveBeenCalledWith(target);
  });

  test("Observer wird beim Unmount getrennt (disconnect)", () => {
    const {unmount} = render(React.createElement(TestComponent));
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
