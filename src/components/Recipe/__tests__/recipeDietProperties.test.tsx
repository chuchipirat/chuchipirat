/**
 * Unit-Tests für die Diät-Eigenschaften in der Rezeptansicht.
 *
 * Auf dem Handy sind die drei Spalten nur gut 50 px breit, «Laktosefrei» und
 * «Glutenfrei» brauchen mehr. Ohne Umbruch laufen die Wörter ineinander.
 */
import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {DietProperties} from "../recipeDietProperties";
import {recipe} from "../__mocks__/recipe.mock";
import {Allergen, Diet} from "../../Product/product.types";
import {
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_MEAT as TEXT_HAS_MEAT,
  IS_VEGAN as TEXT_IS_VEGAN,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  IS_GLUTENFREE as TEXT_IS_GLUTENFREE,
  IS_LACTOSEFREE as TEXT_IS_LACTOSEFREE,
} from "../../../constants/text/recipes";

describe("DietProperties", () => {
  test("zeigt die drei Eigenschaften des Rezepts", () => {
    render(<DietProperties recipe={recipe} />);

    expect(screen.getByText(TEXT_IS_LACTOSEFREE)).toBeInTheDocument();
    expect(screen.getByText(TEXT_IS_GLUTENFREE)).toBeInTheDocument();
    expect(screen.getByText(TEXT_HAS_MEAT)).toBeInTheDocument();
  });

  test.each([TEXT_IS_LACTOSEFREE, TEXT_IS_GLUTENFREE, TEXT_HAS_MEAT])(
    "«%s» darf umbrechen statt in die Nachbarspalte zu laufen",
    (label) => {
      render(<DietProperties recipe={recipe} />);

      expect(screen.getByText(label)).toHaveStyle({
        overflowWrap: "anywhere",
        hyphens: "auto",
      });
    },
  );

  test("zeigt Laktose und Gluten, wenn das Rezept sie enthält", () => {
    render(
      <DietProperties
        recipe={{
          ...recipe,
          dietProperties: {
            allergens: [Allergen.Lactose, Allergen.Gluten],
            diet: Diet.Meat,
          },
        }}
      />,
    );

    expect(screen.getByText(TEXT_HAS_LACTOSE)).toBeInTheDocument();
    expect(screen.getByText(TEXT_HAS_GLUTEN)).toBeInTheDocument();
  });

  test.each([
    [Diet.Vegetarian, TEXT_IS_VEGETARIAN],
    [Diet.Vegan, TEXT_IS_VEGAN],
  ])("zeigt die Ernährungsform %s als «%s»", (diet, label) => {
    render(
      <DietProperties
        recipe={{...recipe, dietProperties: {allergens: [], diet}}}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(TEXT_HAS_MEAT)).not.toBeInTheDocument();
  });
});
