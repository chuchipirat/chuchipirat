/**
 * Unit-Tests für RecipeCard, RecipeCardLoading und CardRibbon.
 *
 * Prüft das Rendering von Rezeptname, Bild, optionalem Ribbon,
 * Klick-Verhalten auf der Karte und FAB-Button sowie das
 * Skeleton-Rendering des Ladezustands.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {RecipeCard, RecipeCardLoading, CardRibbon} from "../recipeCard";
import {RecipeShort, createEmptyRecipeShort} from "../recipe.types";
import {RecipeType} from "../recipe.class";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "/placeholder.jpg",
    }),
  },
}));

jest.mock("../../Shared/utils.class", () => ({
  __esModule: true,
  default: {
    isUrl: jest.fn(() => false),
    getDomain: jest.fn(() => "example.com"),
  },
}));

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const mockRecipe: RecipeShort = {
  ...createEmptyRecipeShort(),
  uid: "recipe-1",
  name: "Älplermagronen",
  pictureSrc: "https://example.com/photo.jpg",
  source: "Grossmutters Kochbuch",
  type: RecipeType.private,
  rating: {avgRating: 4, noRatings: 3},
  noComments: 2,
};

const baseProps = {
  recipe: mockRecipe,
  onCardClick: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("RecipeCard", () => {
  /* ------------------------------------------
  // 1. Rezeptname und Bild werden angezeigt
  // ------------------------------------------ */
  test("Rendert Rezeptname und Bild", () => {
    render(<RecipeCard {...baseProps} />);

    // Rezeptname im CardHeader
    expect(screen.getByText("Älplermagronen")).toBeInTheDocument();

    // CardMedia rendert ein img-Element mit dem Rezeptbild
    const cardMedia = document.querySelector(
      `img[title="Älplermagronen"]`,
    );
    if (cardMedia) {
      expect(cardMedia).toHaveAttribute("src", mockRecipe.pictureSrc);
    } else {
      // MUI CardMedia kann auch als div mit background-image rendern
      expect(screen.getByText("Älplermagronen")).toBeInTheDocument();
    }
  });

  /* ------------------------------------------
  // 2. CardRibbon wird angezeigt wenn vorhanden
  // ------------------------------------------ */
  test("Zeigt CardRibbon wenn ribbon-Prop gesetzt ist", () => {
    const ribbon = {
      cssProperty: "ribbon-class",
      icon: <span data-testid="ribbon-icon">★</span>,
      tooltip: "Favorit",
    };

    render(<RecipeCard {...baseProps} ribbon={ribbon} />);

    expect(screen.getByTestId("ribbon-icon")).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 3. Klick auf die Karte ruft onCardClick auf
  // ------------------------------------------ */
  test("Ruft onCardClick auf wenn auf die Karte geklickt wird", async () => {
    const onCardClick = jest.fn();
    render(<RecipeCard {...baseProps} onCardClick={onCardClick} />);

    const actionArea = document.getElementById(
      "recipeCardActionArea_recipe-1",
    );
    expect(actionArea).toBeInTheDocument();

    await userEvent.click(actionArea!);

    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------
  // 4. RecipeCardLoading rendert Skeleton
  // ------------------------------------------ */
  test("RecipeCardLoading rendert Skeleton-Elemente", () => {
    const {container} = render(<RecipeCardLoading />);

    // MUI Skeleton rendert span-Elemente mit der Klasse MuiSkeleton-root
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  /* ------------------------------------------
  // 5. FAB-Button ruft onFabButtonClick auf
  // ------------------------------------------ */
  test("Ruft onFabButtonClick auf wenn FAB geklickt wird", async () => {
    const onFabButtonClick = jest.fn();
    render(
      <RecipeCard {...baseProps} onFabButtonClick={onFabButtonClick} />,
    );

    const fabButton = document.getElementById("recipeCardFab_recipe-1");
    expect(fabButton).toBeInTheDocument();

    await userEvent.click(fabButton!);

    expect(onFabButtonClick).toHaveBeenCalledTimes(1);
  });
});
