/**
 * Unit-Tests für die Kachel «Ø pro Mahlzeit» (mealAverageTile.tsx).
 *
 * Reine Anzeige-Komponente (Story 6.5), darum ohne Contexts: Props direkt.
 * Schwerpunkte: Zahlen und Zeilen, der Hinweis ohne eingeplante Mahlzeiten
 * und die Chips für die Mahlzeitentypen.
 */
import React from "react";
import {fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {MealAverageTile} from "../mealAverageTile";
import {MealType} from "../../../Menuplan/menuplan.types";
import {formatAmountFromCents} from "../../../../Shared/utils/currencyUtils";
import {
  EVALUATION_MEAL_BASIS as TEXT_EVALUATION_MEAL_BASIS,
  EVALUATION_NO_PLANNED_MEALS as TEXT_EVALUATION_NO_PLANNED_MEALS,
  EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL as TEXT_EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL,
  EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR as TEXT_EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR,
} from "../../../../../constants/text/expenseTracking";

/**
 * Normalisiert Leerzeichen eines Textes (geschützte → normale), für Texte,
 * die einen formatierten Betrag enthalten.
 *
 * @param text - Zu normalisierender Text.
 * @returns Text mit normalen Leerzeichen.
 */
const normalizeSpaces = (text: string): string => text.replace(/\s/g, " ");

const MEAL_TYPES: MealType[] = [
  {uid: "zmorge", name: "Zmorge"},
  {uid: "zmittag", name: "Zmittag"},
  {uid: "zvieri", name: "Zvieri"},
];

/**
 * Rendert die Kachel mit Standardwerten (12 Mahlzeiten, 20 Personen, CHF).
 *
 * @param overrides - Props, die vom Standard abweichen sollen.
 * @returns Render-Ergebnis und der Mock für den Chip-Klick.
 */
const renderTile = (
  overrides: Partial<React.ComponentProps<typeof MealAverageTile>> = {},
) => {
  const onToggleMealType = jest.fn();
  const view = render(
    <MealAverageTile
      mealTypes={MEAL_TYPES}
      excludedMealTypeIds={[]}
      onToggleMealType={onToggleMealType}
      mealCount={12}
      averagePerMealInCents={2525}
      averagePerParticipantAndMealInCents={126}
      participantCount={20}
      currency="CHF"
      {...overrides}
    />,
  );
  return {view, onToggleMealType};
};

/**
 * Liefert den Chip eines Mahlzeitentyps.
 *
 * @param name - Name des Mahlzeitentyps.
 * @returns Der Chip (Rolle `button`).
 */
const getChip = (name: string): HTMLElement =>
  within(
    screen.getByRole("group", {
      name: TEXT_EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL,
    }),
  ).getByRole("button", {name});

describe("MealAverageTile, Zahlen", () => {
  test("Ø pro Mahlzeit, pro Person & Mahlzeit und Rechengrundlage", () => {
    const {view} = renderTile();
    const text = normalizeSpaces(view.container.textContent ?? "");

    expect(text).toContain(normalizeSpaces(formatAmountFromCents(2525, "CHF")));
    expect(text).toContain(
      normalizeSpaces(
        TEXT_EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR(126, "CHF"),
      ),
    );
    expect(screen.getByText("12 Mahlzeiten · 20 Personen")).toBeInTheDocument();
  });

  test("ohne Teilnehmende keine Zeile pro Person, Grundlage nur Mahlzeiten", () => {
    renderTile({
      averagePerParticipantAndMealInCents: null,
      participantCount: 0,
    });

    expect(screen.queryByText(/pro Person & Mahlzeit/)).not.toBeInTheDocument();
    expect(screen.getByText("12 Mahlzeiten")).toBeInTheDocument();
  });

  test("keine eingeplante Mahlzeit → Hinweis statt Zahl, Chips bleiben", () => {
    renderTile({
      mealCount: 0,
      averagePerMealInCents: null,
      averagePerParticipantAndMealInCents: null,
    });

    expect(
      screen.getByText(TEXT_EVALUATION_NO_PLANNED_MEALS),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^CHF/)).not.toBeInTheDocument();
    expect(getChip("Zmorge")).toBeInTheDocument();
  });
});

describe("MealAverageTile, Chips", () => {
  test("in Menüplan-Reihenfolge, ausgewählte mit aria-pressed", () => {
    renderTile({excludedMealTypeIds: ["zvieri"]});

    const chips = within(
      screen.getByRole("group", {
        name: TEXT_EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL,
      }),
    ).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Zmorge",
      "Zmittag",
      "Zvieri",
    ]);
    expect(getChip("Zmorge")).toHaveAttribute("aria-pressed", "true");
    expect(getChip("Zvieri")).toHaveAttribute("aria-pressed", "false");
  });

  test("Klick auf einen Chip ruft onToggleMealType mit der UID", () => {
    const {onToggleMealType} = renderTile();

    fireEvent.click(getChip("Zvieri"));

    expect(onToggleMealType).toHaveBeenCalledWith("zvieri");
  });

  test("der letzte ausgewählte Typ lässt sich nicht abwählen", () => {
    renderTile({excludedMealTypeIds: ["zmittag", "zvieri"]});

    expect(getChip("Zmorge")).toHaveAttribute("aria-disabled", "true");
    // abgewählte Typen bleiben anwählbar
    expect(getChip("Zvieri")).not.toHaveAttribute("aria-disabled");
  });
});

describe("EVALUATION_MEAL_BASIS", () => {
  test("Einzahl und Mehrzahl", () => {
    expect(TEXT_EVALUATION_MEAL_BASIS(1, 1)).toEqual("1 Mahlzeit · 1 Person");
    expect(TEXT_EVALUATION_MEAL_BASIS(12, 20)).toEqual(
      "12 Mahlzeiten · 20 Personen",
    );
  });

  test("ohne Teilnehmende nur die Mahlzeiten", () => {
    expect(TEXT_EVALUATION_MEAL_BASIS(12, 0)).toEqual("12 Mahlzeiten");
  });
});
