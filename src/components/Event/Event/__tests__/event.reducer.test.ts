/**
 * Unit-Tests für eventReducer (event.tsx).
 *
 * Regressionstest für CHUCHIPIRAT-HE: der GENERIC_ERROR-Fall meldete jeden
 * Fehler unbedingt an Sentry (ausser FieldValidationError), auch erwartbare
 * vorübergehende Netzfehler ("Failed to fetch") und abgelaufene Sitzungen.
 * Da praktisch alle ~20 dispatch(GENERIC_ERROR)-Aufrufstellen in event.tsx
 * über diesen einen Reducer-Fall laufen, reicht ein zentraler Fix/Test hier.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import * as Sentry from "@sentry/react";

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

// event.tsx importiert transitiv @react-pdf/renderer über diverse
// PDF-Feature-Dateien (Menuplan-, Einkaufslisten-, Rezept-PDF etc.) — ein
// ESM-only-Package, das Jest ohne Transform nicht parsen kann. Für einen
// reinen Reducer-Test irrelevant, daher direkt an der Quelle mocken statt
// jede einzelne Zwischendatei zu verfolgen.
jest.mock("@react-pdf/renderer", () => ({
  StyleSheet: {create: (styles: unknown) => styles},
  Document: "Document",
  Page: "Page",
  View: "View",
  Text: "Text",
  Image: "Image",
  Svg: "Svg",
  Path: "Path",
  Link: "Link",
  Font: {register: jest.fn()},
  pdf: jest.fn(),
}));

import {eventReducer, ReducerActions, INITITIAL_STATE} from "../event";
import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("eventReducer — GENERIC_ERROR", () => {
  test("meldet einen abgelaufenen JWT nicht an Sentry", () => {
    const error = {
      code: "PGRST303",
      details: null,
      hint: null,
      message: "JWT expired",
    };

    const result = eventReducer(INITITIAL_STATE, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error as unknown as Error,
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.isLoading).toBe(false);
    expect(result.error?.message).toBe("JWT expired");
  });

  test("meldet einen vorübergehenden Netzfehler nicht an Sentry", () => {
    const error = new TypeError("Failed to fetch");

    const result = eventReducer(INITITIAL_STATE, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error,
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.error).toBe(error);
  });

  test("meldet eine FieldValidationError weiterhin nicht an Sentry", () => {
    const error = new FieldValidationError("Ungültiger Link", []);

    const result = eventReducer(INITITIAL_STATE, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error,
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.error).toBe(error);
  });

  test("meldet einen unerwarteten Fehler weiterhin an Sentry", () => {
    const error = {
      code: "23505",
      details: null,
      hint: null,
      message: "duplicate key value violates unique constraint",
    };

    const result = eventReducer(INITITIAL_STATE, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error as unknown as Error,
    });

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(result.error?.message).toBe(
      "duplicate key value violates unique constraint",
    );
  });

  test("setzt isLoading auf false und übernimmt den Fehler in den State", () => {
    const loadingState = {...INITITIAL_STATE, isLoading: true};
    const error = new Error("boom");

    const result = eventReducer(loadingState, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error,
    });

    expect(result.isLoading).toBe(false);
    expect(result.error).toBe(error);
  });
});
