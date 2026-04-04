/**
 * Tests fuer die Typdefinitionen und Factory-Funktionen in `recipe.types.ts`.
 */
import {RecipeType} from "../recipe.class";
import {Diet} from "../../Product/product.types";
import {recipe} from "../__mocks__/recipe.mock";
import {
  Rating,
  RecipeComment,
  PublicRecipeRating,
  RecipeShort,
  createEmptyRecipeShort,
  createShortRecipeFromRecipe,
} from "../recipe.types";

/* =====================================================================
// createEmptyRecipeShort
// ===================================================================== */

test("createEmptyRecipeShort(): Gibt ein Kurzrezept mit korrekten Standardwerten zurueck", () => {
  const result = createEmptyRecipeShort();

  expect(result.uid).toBe("");
  expect(result.name).toBe("");
  expect(result.pictureSrc).toBe("");
  expect(result.tags).toEqual([]);
  expect(result.linkedRecipes).toEqual([]);
  expect(result.dietProperties).toEqual({
    allergens: [],
    diet: Diet.Meat,
  });
  expect(result.menuTypes).toEqual([]);
  expect(result.outdoorKitchenSuitable).toBe(false);
  expect(result.created).toEqual(
    expect.objectContaining({
      fromUid: "",
      fromDisplayName: "",
    })
  );
  expect(result.created.date).toBeInstanceOf(Date);
  expect(result.source).toBe("");
  expect(result.type).toBe(RecipeType.private);
  expect(result.rating).toEqual({avgRating: 0, noRatings: 0});
  expect(result.noComments).toBe(0);
  expect(result.variantName).toBeUndefined();
});

/* =====================================================================
// createShortRecipeFromRecipe
// ===================================================================== */

test("createShortRecipeFromRecipe(): Konvertiert ein vollstaendiges Rezept korrekt", () => {
  const result = createShortRecipeFromRecipe(recipe);

  expect(result.uid).toBe(recipe.uid);
  expect(result.name).toBe(recipe.name);
  expect(result.source).toBe(recipe.source);
  expect(result.pictureSrc).toBe(recipe.pictureSrc);
  expect(result.tags).toEqual(recipe.tags);
  expect(result.linkedRecipes).toEqual(recipe.linkedRecipes);
  expect(result.dietProperties).toEqual(recipe.dietProperties);
  expect(result.menuTypes).toEqual(recipe.menuTypes);
  expect(result.outdoorKitchenSuitable).toBe(recipe.outdoorKitchenSuitable);
  expect(result.created).toEqual(recipe.created);
  expect(result.type).toBe(recipe.type);
  expect(result.rating).toEqual({
    avgRating: recipe.rating.avgRating,
    noRatings: recipe.rating.noRatings,
  });
});

test("createShortRecipeFromRecipe(): Behandelt fehlende optionale Felder (tags, linkedRecipes, menuTypes)", () => {
  const minimalRecipe = {
    ...recipe,
    tags: undefined as unknown as string[],
    linkedRecipes: undefined as unknown as RecipeShort[],
    menuTypes: undefined as unknown as [],
  };

  const result = createShortRecipeFromRecipe(minimalRecipe);

  expect(result.tags).toEqual([]);
  expect(result.linkedRecipes).toEqual([]);
  expect(result.menuTypes).toEqual([]);
});

test("createShortRecipeFromRecipe(): Setzt variantName fuer Varianten-Rezepte", () => {
  const variantRecipe = {
    ...recipe,
    type: RecipeType.variant,
    variantProperties: {variantName: "Vegane Variante"},
  };

  const result = createShortRecipeFromRecipe(variantRecipe);

  expect(result.variantName).toBe("Vegane Variante");
});

test("createShortRecipeFromRecipe(): Setzt variantName NICHT fuer Nicht-Varianten-Rezepte", () => {
  const publicRecipe = {
    ...recipe,
    type: RecipeType.public,
    variantProperties: {variantName: "Sollte ignoriert werden"},
  };

  const result = createShortRecipeFromRecipe(publicRecipe);

  expect(result.variantName).toBeUndefined();
});

/* =====================================================================
// Typ-Assertions
// ===================================================================== */

test("Rating: Typ hat die korrekte Struktur", () => {
  const rating: Rating = {
    avgRating: 4.5,
    noRatings: 10,
    myRating: 5,
  };

  expect(rating.avgRating).toBe(4.5);
  expect(rating.noRatings).toBe(10);
  expect(rating.myRating).toBe(5);
});

test("RecipeComment: Typ hat die korrekte Struktur", () => {
  const comment: RecipeComment = {
    uid: "comment-1",
    user: {
      userUid: "user-1",
      displayName: "Test User",
      pictureSrc: "",
      motto: "",
    },
    createdAt: new Date("2026-01-15"),
    comment: "Sehr leckeres Rezept!",
  };

  expect(comment.uid).toBe("comment-1");
  expect(comment.user.userUid).toBe("user-1");
  expect(comment.user.displayName).toBe("Test User");
  expect(comment.createdAt).toBeInstanceOf(Date);
  expect(comment.comment).toBe("Sehr leckeres Rezept!");
});

test("PublicRecipeRating: Typ hat die korrekte Struktur", () => {
  const publicRating: PublicRecipeRating = {
    avgRating: 3.8,
    noRatings: 25,
  };

  expect(publicRating.avgRating).toBe(3.8);
  expect(publicRating.noRatings).toBe(25);
  // Sicherstellen, dass myRating nicht vorhanden ist
  expect(publicRating).not.toHaveProperty("myRating");
});
