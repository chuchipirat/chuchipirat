/**
 * Unit-Tests fuer den passwordChangeReducer.
 *
 * Reine Funktions-Tests ohne Rendering — prüft alle Reducer-Actions
 * auf korrekte State-Transitionen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {
  passwordChangeReducer,
  ReducerActions,
  initialState,
} from "../passwordChange";
import type {State} from "../passwordChange";
import {FirebaseError} from "@firebase/util";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("passwordChangeReducer", () => {
  test("UPDATE_FIELD aktualisiert das richtige Feld", () => {
    const result = passwordChangeReducer(initialState, {
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: "email", value: "test@example.com"},
    });

    expect(result.passwordChangeData.email).toBe("test@example.com");
    expect(result.passwordChangeData.password).toBe("");
  });

  test("UPDATE_FIELD aktualisiert passwordConfirm", () => {
    const result = passwordChangeReducer(initialState, {
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: "passwordConfirm", value: "geheim123"},
    });

    expect(result.passwordChangeData.passwordConfirm).toBe("geheim123");
  });

  test("EMAIL_ERROR setzt emailError und loescht successEmailChange", () => {
    const stateWithSuccess: State = {
      ...initialState,
      successEmailChange: true,
    };
    const error = {code: "test", message: "Fehler"} as FirebaseError;

    const result = passwordChangeReducer(stateWithSuccess, {
      type: ReducerActions.EMAIL_ERROR,
      payload: error,
    });

    expect(result.emailError).toBe(error);
    expect(result.successEmailChange).toBe(false);
    expect(result.isSubmittingEmail).toBe(false);
  });

  test("PASSWORD_ERROR setzt passwordError und loescht successPwChange", () => {
    const stateWithSuccess: State = {
      ...initialState,
      successPwChange: true,
    };
    const error = {code: "test", message: "Fehler"} as FirebaseError;

    const result = passwordChangeReducer(stateWithSuccess, {
      type: ReducerActions.PASSWORD_ERROR,
      payload: error,
    });

    expect(result.passwordError).toBe(error);
    expect(result.successPwChange).toBe(false);
    expect(result.isSubmittingPassword).toBe(false);
  });

  test("SUCCESS_MAIL_CHANGE setzt Erfolg und loescht Fehler", () => {
    const stateWithError: State = {
      ...initialState,
      emailError: {code: "test", message: "Fehler"} as FirebaseError,
      isSubmittingEmail: true,
    };

    const result = passwordChangeReducer(stateWithError, {
      type: ReducerActions.SUCCESS_MAIL_CHANGE,
    });

    expect(result.successEmailChange).toBe(true);
    expect(result.emailError).toBeNull();
    expect(result.isSubmittingEmail).toBe(false);
  });

  test("SUCCESS_PW_CHANGE setzt Erfolg und loescht Fehler", () => {
    const stateWithError: State = {
      ...initialState,
      passwordError: {code: "test", message: "Fehler"} as FirebaseError,
      isSubmittingPassword: true,
    };

    const result = passwordChangeReducer(stateWithError, {
      type: ReducerActions.SUCCESS_PW_CHANGE,
    });

    expect(result.successPwChange).toBe(true);
    expect(result.passwordError).toBeNull();
    expect(result.isSubmittingPassword).toBe(false);
  });

  test("SUCCESS_REAUTHENTICATION oeffnet Snackbar mit Erfolgsmeldung", () => {
    const result = passwordChangeReducer(initialState, {
      type: ReducerActions.SUCCESS_REAUTHENTICATION,
    });

    expect(result.snackbar.open).toBe(true);
    expect(result.snackbar.severity).toBe("success");
  });

  test("SNACKBAR_CLOSE schliesst die Snackbar", () => {
    const stateWithSnackbar: State = {
      ...initialState,
      snackbar: {open: true, severity: "success", message: "OK"},
    };

    const result = passwordChangeReducer(stateWithSnackbar, {
      type: ReducerActions.SNACKBAR_CLOSE,
    });

    expect(result.snackbar.open).toBe(false);
  });

  test("SET_SUBMITTING setzt den Ladezustand fuer E-Mail", () => {
    const result = passwordChangeReducer(initialState, {
      type: ReducerActions.SET_SUBMITTING,
      payload: {field: "email", value: true},
    });

    expect(result.isSubmittingEmail).toBe(true);
    expect(result.isSubmittingPassword).toBe(false);
  });

  test("SET_SUBMITTING setzt den Ladezustand fuer Passwort", () => {
    const result = passwordChangeReducer(initialState, {
      type: ReducerActions.SET_SUBMITTING,
      payload: {field: "password", value: true},
    });

    expect(result.isSubmittingPassword).toBe(true);
    expect(result.isSubmittingEmail).toBe(false);
  });
});
