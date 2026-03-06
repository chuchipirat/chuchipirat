import Recipe, {PositionType, RecipeType} from "../recipe.class";
import recipe from "../__mocks__/recipe.mock";
import products from "../../Product/__mocks__/products.mock";
import units from "../../Unit/__mocks__/units.mock";
import {Allergen, Diet} from "../../Product/product.class";
import {
  RECIPE_NAME_CANT_BE_EMPTY as TEXT_RECIPE_NAME_CANT_BE_EMPTY,
  RECIPE_VARIANT_NAME_CANT_BE_EMPTY as TEXT_RECIPE_VARIANT_NAME_CANT_BE_EMPTY,
  ERROR_GIVE_FIELD_VALUE as TEXT_ERROR_GIVE_FIELD_VALUE,
  ERROR_PORTIONS_NEGATIV as TEXT_ERROR_PORTIONS_NEGATIV,
  // ERROR_PORTIONS_NOT_NUMERIC as TEXT_ERROR_PORTIONS_NOT_NUMERIC,
  ERROR_NO_INGREDIENTS_GIVEN as TEXT_ERROR_NO_INGREDIENTS_GIVEN,
  ERROR_POS_WITHOUT_PRODUCT as TEXT_ERROR_POS_WITHOUT_PRODUCT,
  ERROR_POS_WITHOUT_MATERIAL as TEXT_ERROR_POS_WITHOUT_MATERIAL,
  ERROR_PRODUCT_UNKNOWN as TEXT_ERROR_PRODUCT_UNKNOWN,
} from "../../../constants/text";
import _ from "lodash";
import unitConversionBasic from "../../Unit/__mocks__/unitConversionBasic.mock";
import unitConversionProducts from "../../Unit/__mocks__/unitConversionProducts.mock";
/* =====================================================================
// Kostruktor
// ===================================================================== */
test("Recipe.constructor(): Konstruktor der Klasse", () => {
  const recipe = new Recipe();

  expect(recipe).toBeDefined();

  expect(recipe).toHaveProperty("uid");
  expect(recipe.uid).toBe("");

  expect(recipe).toHaveProperty("name");
  expect(recipe.name).toBe("");

  expect(recipe).toHaveProperty("portions");
  expect(recipe.portions).toBe(0);

  expect(recipe).toHaveProperty("source");
  expect(recipe.source).toBe("");

  expect(recipe).toHaveProperty("times");
  expect(Object.keys(recipe.times).length).toBe(3);

  expect(recipe).toHaveProperty("pictureSrc");
  expect(recipe.pictureSrc).toBe("");

  expect(recipe).toHaveProperty("note");
  expect(recipe.note).toBe("");

  expect(recipe).toHaveProperty("tags");
  expect(recipe.note.length).toBe(0);

  expect(recipe).toHaveProperty("type");
  expect(recipe.type).toBe(RecipeType.private);

  expect(recipe).toHaveProperty("ingredients");
  expect(Object.keys(recipe.ingredients).length).toBe(2);
  expect(recipe.ingredients).toHaveProperty("entries");
  expect(recipe.ingredients).toHaveProperty("order");

  expect(recipe).toHaveProperty("preparationSteps");
  expect(Object.keys(recipe.preparationSteps).length).toBe(2);
  expect(recipe.preparationSteps).toHaveProperty("entries");
  expect(recipe.preparationSteps).toHaveProperty("order");

  expect(recipe).toHaveProperty("materials");
  expect(Object.keys(recipe.materials).length).toBe(2);
  expect(recipe.materials).toHaveProperty("entries");
  expect(recipe.materials).toHaveProperty("order");

  expect(recipe).toHaveProperty("dietProperties");
  expect(Object.keys(recipe.dietProperties).length).toBe(2);
  expect(recipe.dietProperties).toHaveProperty("diet", Diet.Meat);
  expect(recipe.dietProperties).toHaveProperty("allergens", []);

  expect(recipe).toHaveProperty("menuTypes", []);

  expect(recipe).toHaveProperty("outdoorKitchenSuitable");
  expect(recipe.outdoorKitchenSuitable).toBeFalsy();

  expect(recipe).toHaveProperty("usedProducts", []);

  expect(recipe).toHaveProperty("created");
  expect(Object.keys(recipe.created).length).toBe(3);

  expect(recipe).toHaveProperty("lastChange");
  expect(Object.keys(recipe.lastChange).length).toBe(3);

  expect(recipe).toHaveProperty("rating");
  expect(Object.keys(recipe.rating).length).toBe(3);

  expect(recipe).toHaveProperty("isInReview");
  expect(recipe.isInReview).toBeFalsy();
});
/* =====================================================================
// Variante erstellen
// ===================================================================== */
test("Recipe.createRecipeVariant(), erwartete Werte in den Attributen", () => {
  const eventUid = "YhrA1BfwES7SM61P1WdW";
  const recipeMock = _.cloneDeep(recipe);

  // Calling the method
  const recipeVariant = Recipe.createRecipeVariant({
    recipe: recipeMock,
    eventUid: eventUid,
  });

  expect(recipeVariant).toBeDefined();
  expect(typeof recipeVariant).toBe("object");

  // Check if the returned object has the expected properties
  expect(recipeVariant).toHaveProperty("uid", ""); // Check if uid is an empty string
  expect(recipeVariant).toHaveProperty("type", RecipeType.variant);
  expect(recipeVariant).toHaveProperty("variantProperties");
  expect(recipeVariant.variantProperties).toEqual({
    note: "",
    variantName: "",
    eventUid: eventUid,
    originalRecipeUid: recipeMock.uid,
    originalRecipeType: recipeMock.type,
    originalRecipeCreator: recipeMock.created.fromUid,
  });

  // Check if the original recipe object remains unchanged
  expect(recipeMock).not.toBe(recipeVariant); // Check if a new object is created
  expect(recipeMock.uid).toEqual("HWEvHBnRM56GDapkWtsd");
});
/* =====================================================================
// Leere Einträge erzeugen
// ===================================================================== */
test("Recipe.createEmptyListEntries(), leere Einträge erzeugen", () => {
  let recipeMock = _.cloneDeep(recipe);

  let recipeWithEmptyEntries = Recipe.createEmptyListEntries({
    recipe: recipeMock,
  });

  // Assertions
  expect(recipeWithEmptyEntries).toBeDefined(); // Check if the returned value is defined
  expect(recipeWithEmptyEntries).toHaveProperty("ingredients"); // Check if the recipe has ingredients property
  expect(recipeWithEmptyEntries).toHaveProperty("preparationSteps"); // Check if the recipe has preparationSteps property
  expect(recipeWithEmptyEntries).toHaveProperty("materials"); // Check if the recipe has materials property

  // Check if the ingredients, preparationSteps, and materials properties are arrays
  expect(Array.isArray(recipeWithEmptyEntries.ingredients.order)).toBe(true);
  expect(typeof recipeWithEmptyEntries.ingredients.entries).toBe("object");
  expect(Array.isArray(recipeWithEmptyEntries.preparationSteps.order)).toBe(
    true
  );
  expect(typeof recipeWithEmptyEntries.preparationSteps.entries).toBe("object");
  expect(Array.isArray(recipeWithEmptyEntries.materials.order)).toBe(true);
  expect(typeof recipeWithEmptyEntries.materials.entries).toBe("object");

  // Prüfen ob ein Eintrag eingefügt wurde
  expect(recipeWithEmptyEntries.ingredients.order).toHaveLength(8);

  recipeMock = _.cloneDeep(recipe);
  recipeMock.ingredients = {
    entries: {
      abcde: {
        uid: "abcde",
        product: {uid: "xyz", name: "Oktopus"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "Bitte Bio",
        scalingFactor: 1,
      },
    },
    order: ["abcde"],
  };
  recipeMock.preparationSteps = {
    entries: {
      abcdef: {
        uid: "abcdef",
        posType: PositionType.preparationStep,
        step: "Schneiden",
      },
    },
    order: ["abcdef"],
  };
  recipeMock.materials = {
    entries: {
      xxx: {
        uid: "xxx",
        material: {name: "Schwingbesen", uid: "öjökasdölfkj"},
        quantity: 1,
      },
    },
    order: ["xxx"],
  };

  recipeWithEmptyEntries = Recipe.createEmptyListEntries({
    recipe: recipeMock,
  });
  expect(recipeWithEmptyEntries.ingredients.order).toHaveLength(2);
  expect(recipeWithEmptyEntries.preparationSteps.order).toHaveLength(2);
  expect(recipeWithEmptyEntries.materials.order).toHaveLength(2);
});

test("Recipe.createEmptyListEntries(), mit leeren Listen", () => {
  const recipeMock = _.cloneDeep(recipe);

  recipeMock.ingredients = {entries: {}, order: []};
  recipeMock.preparationSteps = {entries: {}, order: []};
  recipeMock.materials = {entries: {}, order: []};

  const recipeWithEmptyEntries = Recipe.createEmptyListEntries({
    recipe: recipeMock,
  });

  // Assertions
  expect(recipeWithEmptyEntries).toBeDefined(); // Check if the returned value is defined
  expect(recipeWithEmptyEntries).toHaveProperty("ingredients"); // Check if the recipe has ingredients property
  expect(recipeWithEmptyEntries).toHaveProperty("preparationSteps"); // Check if the recipe has preparationSteps property
  expect(recipeWithEmptyEntries).toHaveProperty("materials"); // Check if the recipe has materials property

  // Check if the ingredients, preparationSteps, and materials properties are arrays
  expect(Array.isArray(recipeWithEmptyEntries.ingredients.order)).toBe(true);
  expect(typeof recipeWithEmptyEntries.ingredients.entries).toBe("object");
  expect(Array.isArray(recipeWithEmptyEntries.preparationSteps.order)).toBe(
    true
  );
  expect(typeof recipeWithEmptyEntries.preparationSteps.entries).toBe("object");
  expect(Array.isArray(recipeWithEmptyEntries.materials.order)).toBe(true);
  expect(typeof recipeWithEmptyEntries.materials.entries).toBe("object");

  expect(recipeWithEmptyEntries.ingredients.order).toHaveLength(1);
});
/* =====================================================================
// Tags löschen
// ===================================================================== */
test("Recipe.deleteTag(), existierender Tag löschen", () => {
  const tagToDelete = "klassiker";

  const updatedTags = Recipe.deleteTag({
    tags: recipe.tags,
    tagToDelete: tagToDelete,
  });

  expect(updatedTags).toBeDefined();
  expect(Array.isArray(updatedTags)).toBe(true);
  expect(updatedTags).not.toContain(tagToDelete);
  expect(updatedTags.length).toBe(recipe.tags.length - 1);
});
test("Recipe.deleteTag(), nicht existierender Tag löschen", () => {
  const tagToDelete = "bestof";

  const updatedTags = Recipe.deleteTag({
    tags: recipe.tags,
    tagToDelete: tagToDelete,
  });

  // Assertions
  expect(updatedTags).toBeDefined();
  expect(Array.isArray(updatedTags)).toBe(true);
  expect(updatedTags).toEqual(recipe.tags);
});
/* =====================================================================
// Tags hinzufügen
// ===================================================================== */
test("Recipe.addTag(), neuer Tag hinzufügen", () => {
  const tagToAdd = "bestof";

  const updatedTags = Recipe.addTag({tags: recipe.tags, tagsToAdd: tagToAdd});

  expect(updatedTags).toBeDefined();
  expect(Array.isArray(updatedTags)).toBe(true);
  expect(updatedTags).toHaveLength(recipe.tags.length);
  expect(updatedTags).toContain("bestof");
  expect(updatedTags).toContain("klassiker");
});
test("Recipe.addTag(), bestehender Tag hinzufügen", () => {
  const tagToAdd = "klassiker";

  const updatedTags = Recipe.addTag({tags: recipe.tags, tagsToAdd: tagToAdd});

  expect(updatedTags).toBeDefined();
  expect(Array.isArray(updatedTags)).toBe(true);
  expect(updatedTags).toEqual(recipe.tags); // Check if the updated array is the same as the original array
});
test("Recipe.addTag(), Tag in Kleinbuchstaben umwandeln", () => {
  const tagToAdd = "PaSta Plausch";

  const updatedTags = Recipe.addTag({tags: recipe.tags, tagsToAdd: tagToAdd});

  expect(updatedTags).toContain("pasta");
  expect(updatedTags).toContain("plausch");
});
test("Recipe.addTag(), leerer Input behandeln", () => {
  // Mocking data
  const tagToAdd = "    ";

  let updatedTags = Recipe.addTag({tags: recipe.tags, tagsToAdd: tagToAdd});
  expect(updatedTags).toEqual(recipe.tags);

  updatedTags = Recipe.addTag({tags: recipe.tags, tagsToAdd: ""});
  expect(updatedTags).toEqual(recipe.tags);
});
/* =====================================================================
// Prüfung Rezept
// ===================================================================== */
test("Recipe.checkRecipeData(), kein Name", () => {
  const recipeMock = _.cloneDeep(recipe);
  recipeMock.name = "";

  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_RECIPE_NAME_CANT_BE_EMPTY
  );
});
test("Recipe.checkRecipeData(), fehlender Variantennamen", () => {
  const recipeMock = _.cloneDeep(recipe);

  recipeMock.type = RecipeType.variant;
  recipeMock.variantProperties = {
    note: "",
    variantName: "",
    eventUid: "",
    originalRecipeUid: "",
    originalRecipeCreator: "",
    originalRecipeType: RecipeType.public,
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_RECIPE_VARIANT_NAME_CANT_BE_EMPTY
  );
});
test("Recipe.checkRecipeData(), fehlende Portionen", () => {
  const recipeMock = _.cloneDeep(recipe);

  recipeMock.portions = 0;
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_GIVE_FIELD_VALUE("Portionen")
  );

  recipeMock.portions = -10;
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_PORTIONS_NEGATIV
  );

  // Hack damit ich einen Text in das Feld kriege (TS --> type:number)
  // const field = "portions";
  // recipeMock[field] = "Nan";
  // expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
  //   TEXT_ERROR_PORTIONS_NOT_NUMERIC
  // );
});
test("Recipe.checkRecipeData(), Zutaten", () => {
  let recipeMock = _.cloneDeep(recipe);
  recipeMock.ingredients = {entries: {}, order: []};
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_NO_INGREDIENTS_GIVEN
  );

  recipeMock = _.cloneDeep(recipe);
  recipeMock.ingredients = {
    order: ["section1"],
    entries: {
      section1: {posType: PositionType.section, name: "", uid: "section1"},
    },
  };

  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_NO_INGREDIENTS_GIVEN
  );
  recipeMock = _.cloneDeep(recipe);
  recipeMock.ingredients = {
    order: ["abc"],
    entries: {
      abc: {
        posType: PositionType.ingredient,
        name: "",
        product: {uid: "", name: ""},
        uid: "abc",
      },
    },
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_NO_INGREDIENTS_GIVEN
  );

  recipeMock = _.cloneDeep(recipe);
  recipeMock.ingredients = {
    order: ["abc", "def"],
    entries: {
      abc: {
        posType: PositionType.ingredient,
        name: "",
        product: {uid: "aaaa", name: "Banane"},
        uid: "abc",
      },
      def: {
        posType: PositionType.ingredient,
        name: "",
        product: {uid: "", name: "Banane"},
        uid: "der",
      },
    },
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_POS_WITHOUT_PRODUCT(2)
  );
});
test("Recipe.checkRecipeData(), Materialien", () => {
  const recipeMock = _.cloneDeep(recipe);
  recipeMock.materials = {
    entries: {abc: {uid: "abc", quantity: 1, material: {uid: "", name: ""}}},
    order: ["abc"],
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_POS_WITHOUT_MATERIAL(0)
  );
  recipeMock.materials = {
    entries: {
      abc: {uid: "abc", quantity: 1, material: {uid: "", name: ""}},
    },
    order: ["abc"],
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_POS_WITHOUT_MATERIAL(0)
  );
  recipeMock.materials = {
    entries: {
      abc: {uid: "abc", quantity: 0, material: {uid: "", name: "Messer"}},
    },
    order: ["abc"],
  };
  expect(() => Recipe.checkRecipeData(recipeMock)).toThrow(
    TEXT_ERROR_POS_WITHOUT_MATERIAL(0)
  );
});
/* =====================================================================
// Speichern vorbereiten
// ===================================================================== */
describe("Recipe.preparesave()", () => {
  test("Leere Einträge in Listen entfernen", () => {
    let recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);

    recipeMock = Recipe.prepareSave({
      recipe: recipeMock,
      products: productsMock,
    });

    expect(recipeMock.ingredients.order).toHaveLength(
      recipe.ingredients.order.length - 1
    );
    expect(recipeMock.preparationSteps.order).toHaveLength(3);
    expect(recipeMock.materials.order).toHaveLength(2);
  });
  test("Exception bei fehlerhaften Rezept", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);

    recipeMock.portions = -4;

    expect(() =>
      Recipe.prepareSave({recipe: recipeMock, products: productsMock})
    ).toThrow(TEXT_ERROR_PORTIONS_NEGATIV);
  });
});
/* =====================================================================
// Diät Eigenschaften bestimmen
// ===================================================================== */
describe("Recipe.defineDietProperties()", () => {
  test("unknown Product", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    (recipeMock.ingredients.entries.abc = {
      uid: "abc",
      product: {uid: "123", name: "Fake"},
      posType: PositionType.ingredient,
      quantity: 42,
      unit: "",
      detail: "",
      scalingFactor: 1,
    }),
      expect(() =>
        Recipe.defineDietProperties({
          recipe: recipeMock,
          products: productsMock,
        })
      ).toThrow(TEXT_ERROR_PRODUCT_UNKNOWN("Fake"));
  });
  test("Vegan", () => {
    const recipeMock = _.cloneDeep(recipe);
    recipeMock.ingredients.entries = {
      a: {
        uid: "a",
        product: {uid: "peperoni", name: "Peperoni"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
      b: {
        uid: "abcde",
        product: {uid: "tomato", name: "Tomaten"},
        posType: PositionType.ingredient,
        quantity: 20,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
    };
    recipeMock.ingredients.order = ["a", "b"];
    const productsMock = [
      {
        uid: "peperoni",
        name: "Peperoni",
        department: {uid: "vegies", name: "Gemüse"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
      {
        uid: "tomato",
        name: "Tomaten",
        department: {uid: "vegies", name: "Gemüse"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
    ];
    const dietProperties = Recipe.defineDietProperties({
      recipe: recipeMock,
      products: productsMock,
    });
    expect(dietProperties.diet).toBe(Diet.Vegan);
  });
  test("Vegetarisch", () => {
    const recipeMock = _.cloneDeep(recipe);
    recipeMock.ingredients.entries = {
      a: {
        uid: "a",
        product: {uid: "cheese", name: "Käse"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
      b: {
        uid: "abcde",
        product: {uid: "tomato", name: "Tomaten"},
        posType: PositionType.ingredient,
        quantity: 20,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
    };
    recipeMock.ingredients.order = ["a", "b"];
    const productsMock = [
      {
        uid: "cheese",
        name: "Käse",
        department: {uid: "molk", name: "Molkerei"},
        shoppingUnit: "g",
        dietProperties: {allergens: [1], diet: Diet.Vegetarian},
        usable: true,
      },
      {
        uid: "tomato",
        name: "Tomaten",
        department: {uid: "molk", name: "Molkerei"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
    ];
    const dietProperties = Recipe.defineDietProperties({
      recipe: recipeMock,
      products: productsMock,
    });
    expect(dietProperties.diet).toBe(Diet.Vegetarian);
    expect(dietProperties.allergens).toContain(Allergen.Lactose);
  });
  test("Fleisch", () => {
    const productsMock = _.cloneDeep(products);
    const recipeMock = Recipe.prepareSave({
      recipe: _.cloneDeep(recipe),
      products: productsMock,
    });
    const dietProperties = Recipe.defineDietProperties({
      recipe: recipeMock,
      products: productsMock,
    });

    expect(dietProperties.diet).toBe(Diet.Meat);
  });
  test("keine Allergene", () => {
    const recipeMock = _.cloneDeep(recipe);
    recipeMock.ingredients.entries = {
      a: {
        uid: "a",
        product: {uid: "peperoni", name: "Peperoni"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
      b: {
        uid: "abcde",
        product: {uid: "tomato", name: "Tomaten"},
        posType: PositionType.ingredient,
        quantity: 20,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
    };
    recipeMock.ingredients.order = ["a", "b"];
    const productsMock = [
      {
        uid: "peperoni",
        name: "Peperoni",
        department: {uid: "vegies", name: "Gemüse"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
      {
        uid: "tomato",
        name: "Tomaten",
        department: {uid: "vegies", name: "Gemüse"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
    ];
    const dietProperties = Recipe.defineDietProperties({
      recipe: recipeMock,
      products: productsMock,
    });
    expect(dietProperties.allergens).toHaveLength(0);
  });
  test("mit Allergene", () => {
    const recipeMock = _.cloneDeep(recipe);
    recipeMock.ingredients.entries = {
      a: {
        uid: "a",
        product: {uid: "cheese", name: "Käse"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
      b: {
        uid: "b",
        product: {uid: "tomato", name: "Tomaten"},
        posType: PositionType.ingredient,
        quantity: 20,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
      c: {
        uid: "c",
        product: {uid: "flour", name: "Mehl"},
        posType: PositionType.ingredient,
        quantity: 100,
        unit: "g",
        detail: "",
        scalingFactor: 1,
      },
    };
    recipeMock.ingredients.order = ["a", "b", "c"];
    const productsMock = [
      {
        uid: "cheese",
        name: "Käse",
        department: {uid: "molk", name: "Molkerei"},
        shoppingUnit: "g",
        dietProperties: {allergens: [1], diet: Diet.Vegetarian},
        usable: true,
      },
      {
        uid: "tomato",
        name: "Tomaten",
        department: {uid: "vegies", name: "Gemüse"},
        shoppingUnit: "g",
        dietProperties: {allergens: [], diet: Diet.Vegan},
        usable: true,
      },
      {
        uid: "flour",
        name: "Mehl",
        department: {uid: "baking", name: "Backen"},
        shoppingUnit: "g",
        dietProperties: {allergens: [2], diet: Diet.Vegan},
        usable: true,
      },
    ];
    const dietProperties = Recipe.defineDietProperties({
      recipe: recipeMock,
      products: productsMock,
    });
    expect(dietProperties.allergens).toContain(Allergen.Lactose);
    expect(dietProperties.allergens).toContain(Allergen.Gluten);
  });
});
/* =====================================================================
// Diät Eigenschaften bestimmen
// ===================================================================== */
describe("Recipe.definePositionSectionAdjusted()", () => {
  test("Resultat 0, wenn Entries und Order nicht übereinstimmen", () => {
    const result = Recipe.definePositionSectionAdjusted({
      uid: "someUid",
      entries: {
        entry1: {posType: PositionType.ingredient},
        entry2: {posType: PositionType.ingredient},
      },
      order: ["entry1"],
    });

    expect(result).toBe(0);
  });

  test("Positionscounter erhöhen für nicht Abschnitsseinträge", () => {
    const result = Recipe.definePositionSectionAdjusted({
      uid: "someUid",
      entries: {
        entry1: {posType: PositionType.ingredient},
        entry2: {posType: PositionType.section},
      },
      order: ["entry1", "entry2"],
    });

    expect(result).toBe(1);
  });

  test("Wenn UID nicht gefunden wid, Counter zurückgeben", () => {
    const result = Recipe.definePositionSectionAdjusted({
      uid: "entry3",
      entries: {
        entry1: {posType: PositionType.ingredient},
        entry2: {posType: PositionType.section},
        entry3: {posType: PositionType.ingredient},
      },
      order: ["entry1", "entry2", "entry3"],
    });

    expect(result).toBe(2);
  });
});
/* =====================================================================
// Abschnitt erzeugen
// ===================================================================== */
describe("Recipe.createEmptySection()", () => {
  test("Abschnitt erzeugen", () => {
    const section = Recipe.createEmptySection();

    expect(section.uid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(section.posType).toBe(PositionType.section);
    expect(section.name).toBe("");
  });
});
/* =====================================================================
// Skalieren
// ===================================================================== */
describe("Recipe.scaleIngredients()", () => {
  test("linear skalieren, gleiche Einheit", () => {
    const recipeMock = _.cloneDeep(recipe);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
    });

    expect(scaledIngredients["abc"].quantity).toBe(462);
  });
  test("linear skalieren, andere Einheit", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    expect(scaledIngredients["def"].quantity).toBe(1.32);
    expect(scaledIngredients["def"].unit).toBe("kg");
  });
  test("linear skalieren, skalierung ohne Umrechnung - ScalingOption = Off", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: false},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    expect(scaledIngredients["def"].quantity).toBe(1320);
    expect(scaledIngredients["def"].unit).toBe("g");
  });
  test("Produktspezifisch skalieren", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    // von EL nach L.
    expect(scaledIngredients["mno"].quantity).toBe(0.495);
    expect(scaledIngredients["mno"].unit).toBe("l");
  });
  test("Keine Umrechung gefunden", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    // Keine Produktspezifische Umrechnung von EL --> -Kg
    expect(scaledIngredients["pqr"].quantity).toBe(22);
    expect(scaledIngredients["pqr"].unit).toBe("EL");
  });
  test("Von TL nach EL nach KG", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    // von TL muss zuerst auf EL und dann in KG umgerechnet werden
    // (von Basic -> zu EL -> über Produktspezifisch nach KG)
    expect(scaledIngredients["stu"].quantity).toBe(0.22);
    expect(scaledIngredients["stu"].unit).toBe("kg");
  });
  test("linear skalieren mit Skalierungsfaktor", () => {
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 44,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    expect(scaledIngredients["ghi"].quantity).toBe(11);
    expect(scaledIngredients["ghi"].unit).toBe("");
  });
  test("kein Absturz wenn Produkt nicht im Produktkatalog enthalten (convertUnits=true)", () => {
    // Regression: product.uid in der Zutat ist nicht in products[] vorhanden.
    // scaleIngredients() darf nicht mit "Cannot read properties of undefined
    // (reading 'shoppingUnit')" abstürzen — stattdessen wird die skalierte
    // Menge in der Originaleinheit übernommen.
    const recipeMock = _.cloneDeep(recipe);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    // Produkte-Array enthält das Produkt der Zutat "abc" (okt0) absichtlich nicht.
    const partialProducts = [
      {
        uid: "mozza",
        name: "Mozzarella",
        department: {uid: "molk", name: "Molkerei"},
        shoppingUnit: "kg",
        dietProperties: {allergens: [], diet: 0},
        usable: true,
      },
    ];

    expect(() => {
      const result = Recipe.scaleIngredients({
        recipe: recipeMock,
        portionsToScale: 44,
        scalingOptions: {convertUnits: true},
        products: partialProducts as any,
        units: unitsMock,
        unitConversionBasic: unitConversionMock,
        unitConversionProducts: unitConversionProductsMock,
      });
      // "abc" hat Produkt "okt0" (nicht in partialProducts) → keine Umrechnung,
      // aber die skalierte Menge muss trotzdem korrekt sein.
      expect(result["abc"].quantity).toBe(462);
      expect(result["abc"].unit).toBe("");
    }).not.toThrow();
  });
  test("linear skalieren mit Skalierungsfaktor - kleine Menge", () => {
    // angenommen es wird skaliert, aber die skalierte Menge ist weniger
    // als die Menge mit der Originalmenge, dann belassen wir die Originalmenge
    const recipeMock = _.cloneDeep(recipe);
    const productsMock = _.cloneDeep(products);
    const unitsMock = _.cloneDeep(units);
    const unitConversionMock = _.cloneDeep(unitConversionBasic);
    const unitConversionProductsMock = _.cloneDeep(unitConversionProducts);

    const scaledIngredients = Recipe.scaleIngredients({
      recipe: recipeMock,
      portionsToScale: 6,
      scalingOptions: {convertUnits: true},
      products: productsMock,
      units: unitsMock,
      unitConversionBasic: unitConversionMock,
      unitConversionProducts: unitConversionProductsMock,
    });
    expect(scaledIngredients["ghi"].quantity).toBe(2);
    expect(scaledIngredients["ghi"].unit).toBe("");
  });
});

describe("Recipe.scaleMaterials()", () => {
  test("Material skalieren, mit Mengen", () => {
    const recipeMock = _.cloneDeep(recipe);
    const scaledMaterials = Recipe.scaleMaterials({
      recipe: recipeMock,
      portionsToScale: 42,
    });

    expect(scaledMaterials["xxx"].quantity).toBe(10.5);
  });
  test("Material skalieren, ohne Mengen", () => {
    const recipeMock = _.cloneDeep(recipe);
    const scaledMaterials = Recipe.scaleMaterials({
      recipe: recipeMock,
      portionsToScale: 42,
    });

    expect(scaledMaterials["yyy"].quantity).toBe(0);
  });
});
