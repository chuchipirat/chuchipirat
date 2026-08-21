/**
 * Unit-Tests für EventGroupConfigurationPage.
 *
 * Fokussiert auf das Portionen-Eingabefeld: negative Zahlen dürfen nicht
 * übernommen werden, sondern müssen auf 0 gekappt werden.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {EventGroupConfigurationPage} from "../groupConfiguration";
import {EventGroupConfiguration} from "../groupConfiguration.class";
import {Event} from "../../Event/event.class";
import type Firebase from "../../../Firebase/firebase.class";
import AuthUser from "../../../Firebase/Authentication/authUser.class";
import {DatabaseContext} from "../../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: NavigationValuesContext */
jest.mock("../../../Navigation/navigationContext", () => ({
  NavigationValuesContext: React.createContext({
    setNavigationValues: jest.fn(),
  }),
  NavigationObject: {groupConfiguration: 1, none: 0},
}));

/** Mock: useCustomStyles */
jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({
    container: {},
    card: {},
    itemGroupConfigurationRow: {},
    button: {},
  })),
}));

/** Mock: useCustomDialog */
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
}));

/** Mock-DatabaseService — in diesen Tests nicht angesprochen */
const mockDatabase = {
  eventGroupConfig: {
    groupConfigUiToDomain: jest.fn(),
    saveGroupConfig: jest.fn(),
  },
} as any;

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

/** Erzeugt eine minimale GroupConfig mit einer Diät und einer Intoleranz. */
function createMinimalGroupConfig(portions = 5): EventGroupConfiguration {
  const groupConfig = new EventGroupConfiguration();
  const dietUid = "diet-1";
  const intoleranceUid = "intol-1";

  groupConfig.diets = {
    entries: {
      [dietUid]: {uid: dietUid, name: "Fleisch", totalPortions: portions},
    },
    order: [dietUid],
  };
  groupConfig.intolerances = {
    entries: {
      [intoleranceUid]: {
        uid: intoleranceUid,
        name: "Ohne Unverträglichkeit",
        totalPortions: portions,
      },
    },
    order: [intoleranceUid],
  };
  groupConfig.portions = {[dietUid]: {[intoleranceUid]: portions}};
  groupConfig.totalPortions = portions;

  return groupConfig;
}

const renderPage = (groupConfiguration: EventGroupConfiguration) => {
  return render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <EventGroupConfigurationPage
          firebase={{} as Firebase}
          authUser={new AuthUser()}
          event={new Event()}
          groupConfiguration={groupConfiguration}
        />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

describe("EventGroupConfigurationPage — Portionen-Eingabe", () => {
  test("kappt eine negativ eingegebene Portionenzahl auf 0", () => {
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;
    expect(portionsInput).toBeInTheDocument();

    fireEvent.change(portionsInput, {target: {value: "-7"}});

    expect(portionsInput.value).toBe("0");
  });

  test("uebernimmt eine positive Portionenzahl unveraendert", () => {
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    fireEvent.change(portionsInput, {target: {value: "12"}});

    expect(portionsInput.value).toBe("12");
  });

  test("kappt eine Portionenzahl ausserhalb des Postgres-integer-Bereichs auf das Maximum", () => {
    // Regression: event_groupconfiguration_portions.servings ist vom Typ
    // `integer` (Postgres int4). Ohne clientseitige Kappung führt eine zu
    // grosse Zahl zu einem rohen, unübersetzten DB-Fehler beim Speichern.
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    fireEvent.change(portionsInput, {target: {value: "99999999999"}});

    expect(portionsInput.value).toBe("2147483647");
  });

  test("behandelt leere Eingabe (nicht parsebar) als 0", () => {
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    fireEvent.change(portionsInput, {target: {value: ""}});

    expect(portionsInput.value).toBe("0");
  });

  test("das Eingabefeld ist ein natives number-Input mit min=0", () => {
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    expect(portionsInput).toHaveAttribute("type", "number");
    expect(portionsInput).toHaveAttribute("min", "0");
  });
});
