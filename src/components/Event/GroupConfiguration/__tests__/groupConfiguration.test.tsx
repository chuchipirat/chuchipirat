/**
 * Unit-Tests für EventGroupConfigurationPage.
 *
 * Fokussiert auf das Portionen-Eingabefeld: negative Zahlen dürfen nicht
 * übernommen werden, sondern müssen auf 0 gekappt werden.
 *
 * Regression CHUCHIPIRAT-FV: Ein Fehler beim Speichern lief als
 * UnhandledRejection aus dem Click-Handler, ohne Rückmeldung an den Nutzer.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, fireEvent, screen, waitFor} from "@testing-library/react";
import * as Sentry from "@sentry/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {EventGroupConfigurationPage} from "../groupConfiguration";
import {EventGroupConfiguration} from "../groupConfiguration.class";
import {Event} from "../../Event/event.class";
import AuthUser from "../../../Session/authUser.class";
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

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

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

const renderPage = (
  groupConfiguration: EventGroupConfiguration,
  onConfirm?: {buttonText: string; onClick: jest.Mock},
) => {
  return render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <EventGroupConfigurationPage
          authUser={new AuthUser()}
          event={new Event()}
          groupConfiguration={groupConfiguration}
          onConfirm={onConfirm}
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

    // 0 wird als leeres Feld mit Platzhalter angezeigt
    expect(portionsInput.value).toBe("");
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

    expect(portionsInput.value).toBe("");
  });

  test("das Eingabefeld ist ein natives number-Input mit min=0", () => {
    renderPage(createMinimalGroupConfig(5));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    expect(portionsInput).toHaveAttribute("type", "number");
    expect(portionsInput).toHaveAttribute("min", "0");
  });

  test("zeigt 0 Portionen als leeres Feld mit Platzhalter, damit kein '01' entsteht", () => {
    // Regression: React lässt "01" im number-Input stehen, weil es numerisch
    // 1 entspricht. Ein leeres Feld verhindert die führende 0.
    renderPage(createMinimalGroupConfig(0));

    const portionsInput = document.getElementById(
      "portions_diet-1_intol-1",
    ) as HTMLInputElement;

    expect(portionsInput.value).toBe("");
    expect(portionsInput).toHaveAttribute("placeholder", "0");

    fireEvent.change(portionsInput, {target: {value: "1"}});

    expect(portionsInput.value).toBe("1");
  });
});

describe("EventGroupConfigurationPage — Speichern (CHUCHIPIRAT-FV)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("zeigt bei einem Netzfehler eine Meldung, bleibt auf der Seite und meldet nicht", async () => {
    mockDatabase.eventGroupConfig.saveGroupConfig.mockRejectedValueOnce({
      code: "",
      details: "TypeError: Failed to fetch",
      hint: "",
      message: "TypeError: Failed to fetch (api.chuchipirat.ch)",
    });
    const onConfirm = {buttonText: "Speichern", onClick: jest.fn()};
    renderPage(createMinimalGroupConfig(), onConfirm);

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(await screen.findByText(/Failed to fetch/)).toBeInTheDocument();
    expect(onConfirm.onClick).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("meldet einen echten Fehler an Sentry", async () => {
    mockDatabase.eventGroupConfig.saveGroupConfig.mockRejectedValueOnce({
      code: "23505",
      message: "duplicate key value",
    });
    const onConfirm = {buttonText: "Speichern", onClick: jest.fn()};
    renderPage(createMinimalGroupConfig(), onConfirm);

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    expect(onConfirm.onClick).not.toHaveBeenCalled();
  });

  test("ruft onConfirm nach erfolgreichem Speichern auf", async () => {
    mockDatabase.eventGroupConfig.saveGroupConfig.mockResolvedValueOnce(undefined);
    const onConfirm = {buttonText: "Speichern", onClick: jest.fn()};
    renderPage(createMinimalGroupConfig(), onConfirm);

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    await waitFor(() => expect(onConfirm.onClick).toHaveBeenCalledTimes(1));
  });
});

/**
 * Rendert die Seite wie im Erstellungsassistenten: ohne bestehende
 * Gruppenkonfiguration und mit aufgeschobenem Speichern.
 *
 * @param onConfirm Callback, das die bestätigte Gruppenkonfiguration erhält.
 * @returns Render-Resultat von Testing Library.
 */
const renderWizardPage = (onConfirm: {buttonText: string; onClick: jest.Mock}) =>
  render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <EventGroupConfigurationPage
          authUser={new AuthUser()}
          event={new Event()}
          deferSave={true}
          onConfirm={onConfirm}
        />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

/**
 * Liefert die Gruppenkonfiguration, die beim letzten Klick auf
 * "Weiter" an onConfirm übergeben wurde.
 *
 * @param onConfirmClick Gemocktes onClick von onConfirm.
 * @returns Übergebene Gruppenkonfiguration.
 */
const lastConfirmedGroupConfig = (onConfirmClick: jest.Mock): EventGroupConfiguration =>
  onConfirmClick.mock.calls[onConfirmClick.mock.calls.length - 1][1];

describe("EventGroupConfigurationPage — neuer Anlass startet frisch", () => {
  // Regression: Der Startzustand wurde einmal pro Modul erzeugt und im
  // Assistenten wiederverwendet. Ein zweiter Anlass in derselben Sitzung
  // übernahm Portionen, Gruppen und sogar die IDs des vorherigen — die IDs
  // haben beim Speichern die Zeilen des ersten Anlasses umgehängt.
  test("übernimmt weder Portionen, Gruppen noch IDs des vorherigen Anlasses", () => {
    const firstConfirm = {buttonText: "Weiter", onClick: jest.fn()};
    const firstRender = renderWizardPage(firstConfirm);
    const firstPortionsInput = document.querySelector(
      'input[id^="portions_"]',
    ) as HTMLInputElement;
    fireEvent.change(firstPortionsInput, {target: {value: "7"}});
    fireEvent.click(screen.getByRole("button", {name: "Weiter"}));
    const firstGroupConfig = structuredClone(lastConfirmedGroupConfig(firstConfirm.onClick));
    firstRender.unmount();

    const secondConfirm = {buttonText: "Weiter", onClick: jest.fn()};
    renderWizardPage(secondConfirm);
    fireEvent.click(screen.getByRole("button", {name: "Weiter"}));
    const secondGroupConfig = lastConfirmedGroupConfig(secondConfirm.onClick);

    expect(firstGroupConfig.totalPortions).toBe(7);
    expect(secondGroupConfig.totalPortions).toBe(0);
    // Einzelne Zellen prüfen: das Total allein verrät die übernommenen Werte nicht
    Object.values(secondGroupConfig.portions).forEach((intolerancePortions) =>
      Object.values(intolerancePortions).forEach((servings) => expect(servings).toBe(0)),
    );
    expect(secondGroupConfig.diets.order).toHaveLength(firstGroupConfig.diets.order.length);
    secondGroupConfig.diets.order.forEach((dietUid) =>
      expect(firstGroupConfig.diets.order).not.toContain(dietUid),
    );
    secondGroupConfig.intolerances.order.forEach((intoleranceUid) =>
      expect(firstGroupConfig.intolerances.order).not.toContain(intoleranceUid),
    );
  });
});

describe("EventGroupConfigurationPage — bestätigte Zustände bleiben unverändert", () => {
  // Die Portionen-Eingabe veränderte die Portionenmatrix direkt. Ein bereits
  // an den Aufrufer übergebener Zustand änderte sich dadurch nachträglich mit.
  test("eine spätere Portionen-Eingabe verändert die zuvor bestätigte Konfiguration nicht", () => {
    const onConfirm = {buttonText: "Weiter", onClick: jest.fn()};
    renderWizardPage(onConfirm);
    fireEvent.click(screen.getByRole("button", {name: "Weiter"}));
    const confirmedGroupConfig = lastConfirmedGroupConfig(onConfirm.onClick);
    const snapshotBefore = structuredClone(confirmedGroupConfig);

    const portionsInput = document.querySelector('input[id^="portions_"]') as HTMLInputElement;
    fireEvent.change(portionsInput, {target: {value: "4"}});

    // Beide Seiten durch structuredClone, weil der Jest-Polyfill Dates zu Strings macht
    expect(structuredClone(confirmedGroupConfig)).toEqual(snapshotBefore);
  });
});
