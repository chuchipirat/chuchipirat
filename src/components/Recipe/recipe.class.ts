import Utils from "../Shared/utils.class";
import RecipeShort from "./recipeShort.class";
import {Rating} from "./recipe.rating.class";
import {ChangeRecord} from "../Shared/global.interface";
import * as TEXT from "../../constants/text";
import Unit, {UnitDimension} from "../Unit/unit.class";
import Product, {Diet, DietProperties} from "../Product/product.class";
import Event from "../Event/Event/event.class";
import _ from "lodash";
import UnitConversion, {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../Unit/unitConversion.class";
import Material from "../Material/material.class";
import type {RecipeDomain} from "../Database/Repository/RecipeRepository";
import type {RecipeIngredientDomain} from "../Database/Repository/RecipeIngredientRepository";
import type {RecipePreparationStepDomain} from "../Database/Repository/RecipePreparationStepRepository";
import type {RecipeMaterialDomain} from "../Database/Repository/RecipeMaterialRepository";

/* =====================================================================
// Öffentliche Typen und Schnittstellen
// ===================================================================== */

/**
 * Generische Datenstruktur für geordnete Rezept-Positionen (Zutaten,
 * Zubereitungsschritte, Materialien).
 *
 * @template T Typ der einzelnen Einträge.
 */
export interface RecipeObjectStructure<T> {
  entries: {[key: string]: T};
  order: string[];
}

/**
 * Skalierungsoptionen für die Zutatenberechnung.
 */
export interface ScalingOptions {
  convertUnits: boolean;
}

/**
 * Basisinterface für alle Positionstypen (Zutat, Schritt, Abschnitt).
 */
export interface PositionBase {
  uid: string;
  posType: PositionType;
}

/**
 * Eine Zutat (Positionstyp: ingredient) im Rezept.
 */
export interface Ingredient extends PositionBase {
  product: IngredientProduct;
  quantity: number;
  unit: Unit["key"];
  detail: string;
  scalingFactor: number;
}

/**
 * Eine Materialposition im Rezept.
 */
export interface RecipeMaterialPosition {
  uid: string;
  quantity: number;
  material: RecipeProduct;
}

/**
 * Vereinfachtes Referenz-Objekt für Produkt oder Material (uid + name).
 */
export interface RecipeProduct {
  uid: string;
  name: string;
}

/**
 * Unterscheidet Zutaten, Zubereitungsschritte und Abschnitte.
 */
export enum PositionType {
  ingredient,
  preparationStep,
  section,
}

/**
 * Typ eines Rezepts (öffentlich, privat, Variante).
 */
export enum RecipeType {
  public = "public",
  private = "private",
  variant = "variant",
}

/**
 * Menü-Typus, dem ein Rezept zugeordnet werden kann.
 */
export enum MenuType {
  None,
  MainCourse,
  SideDish,
  Appetizer,
  Dessert,
  Breakfast,
  Snack,
  Apero,
  Beverage,
}

/**
 * Produkt-Referenz im Zutaten-Context.
 */
export interface IngredientProduct {
  uid: string;
  name: string;
}

/**
 * Zubereitungsschritt im Rezept.
 */
export interface PreparationStep extends PositionBase {
  step: string;
}

/**
 * Abschnitt-Trennzeile innerhalb einer Positionsliste.
 */
export interface Section extends PositionBase {
  name: string;
}

/**
 * Eigenschaften einer Rezeptvariante.
 */
export interface RecipeVariantProperties {
  note: string;
  variantName: string;
  eventUid: string;
  originalRecipeUid: string;
  originalRecipeType: RecipeType;
  originalRecipeCreator: ChangeRecord["fromUid"];
}

/**
 * Eindeutige Identifikation eines Rezepts über alle Typen hinweg.
 */
export interface RecipeIndetifier {
  uid: Recipe["uid"];
  recipeType: RecipeType;
  createdFromUid: ChangeRecord["fromUid"];
  eventUid: Event["uid"];
}

/**
 * Sammlung mehrerer Rezepte, indiziert nach UID.
 */
export interface Recipes {
  [key: Recipe["uid"]]: Recipe;
}

/* =====================================================================
// Interne Schnittstellen für Geschäftslogik-Methoden
// ===================================================================== */
interface CreateRecipeVariant {
  recipe: Recipe;
  eventUid: Event["uid"];
}
interface CreateEmptyListEntries {
  recipe: Recipe;
}
interface DeleteTag {
  tags: string[];
  tagToDelete: string;
}
interface AddTag {
  tags: string[];
  tagsToAdd: string;
}
interface PrepareSave {
  recipe: Recipe;
  products: Product[];
}
interface DefineDietProperties {
  recipe: Recipe;
  products: Product[];
}
interface DefinePositionSectionAdjusted {
  uid: string;
  order: string[];
  entries: {[key: string]: {posType: PositionType}};
}
interface Scale {
  recipe: Recipe;
  portionsToScale: number;
  scalingOptions?: ScalingOptions;
  units?: Unit[] | null;
  unitConversionBasic?: UnitConversionBasic | null;
  unitConversionProducts?: UnitConversionProducts | null;
  products?: Product[];
}

/* =====================================================================
// Recipe-Klasse
// ===================================================================== */

/**
 * Domänenklasse für ein Rezept.
 *
 * Enthält Geschäftslogik (Validierung, Diät-Berechnung, Skalierung) und
 * Konverter-Methoden zwischen dem in-memory `RecipeObjectStructure`-Format
 * und den flachen Repository-Domain-Typen.
 *
 * Firebase-Persistenz-Methoden wurden im Rahmen der Supabase-Migration
 * entfernt. Persistenz erfolgt nun über RecipeRepository und die
 * zugehörigen child-Repositories via DatabaseService.
 */
export default class Recipe {
  uid: string;
  name: string;
  portions: number;
  source: string;
  times: {
    preparation: number;
    rest: number;
    cooking: number;
  };
  pictureSrc: string;
  note: string;
  tags: string[];
  /** Verknüpfte Rezepte (für Firebase-Kompatibilität; bei Supabase stets `[]`). */
  linkedRecipes: RecipeShort[];
  ingredients: RecipeObjectStructure<Ingredient | Section>;
  preparationSteps: RecipeObjectStructure<PreparationStep | Section>;
  materials: RecipeObjectStructure<RecipeMaterialPosition>;
  dietProperties: DietProperties;
  menuTypes: MenuType[];
  outdoorKitchenSuitable: boolean;
  /** Ob das Rezept öffentlich sichtbar/freigegeben ist. */
  usable: boolean;
  rating: Rating;
  usedProducts?: Product["uid"][];
  usedMaterials?: Material["uid"][];
  created: ChangeRecord;
  lastChange: ChangeRecord;
  type: RecipeType;
  variantProperties?: RecipeVariantProperties;

  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.name = "";
    this.portions = 0;
    this.source = "";
    this.times = {
      preparation: 0,
      rest: 0,
      cooking: 0,
    };
    this.pictureSrc = "";
    this.note = "";
    this.tags = [];
    this.linkedRecipes = [];
    this.ingredients = {entries: {}, order: []};
    this.preparationSteps = {entries: {}, order: []};
    this.materials = {entries: {}, order: []};
    this.dietProperties = Product.createEmptyDietProperty();
    this.menuTypes = [];
    this.outdoorKitchenSuitable = false;
    this.usable = true;
    this.usedProducts = [];
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};

    const ingredient = Recipe.createEmptyIngredient();
    this.ingredients.entries[ingredient.uid] = ingredient;
    this.ingredients.order.push(ingredient.uid);

    const preparationStep = Recipe.createEmptyPreparationStep();
    this.preparationSteps.entries[preparationStep.uid] = preparationStep;
    this.preparationSteps.order.push(preparationStep.uid);

    const material = Recipe.createEmptyMaterial();
    this.materials.entries[material.uid] = material;
    this.materials.order.push(material.uid);

    this.rating = {
      avgRating: 0,
      noRatings: 0,
      myRating: 0,
    };
    this.type = RecipeType.private;
  }

  /* =====================================================================
  // Variante erstellen
  // ===================================================================== */
  /**
   * Erstellt eine Rezeptvariante (tiefer Clone) für einen bestimmten Event.
   *
   * @param recipe - Das Originalrezept, von dem die Variante abgeleitet wird.
   * @param eventUid - UID des Events, zu dem die Variante gehört.
   * @returns Neue Recipe-Instanz mit `type = variant` und gesetzten `variantProperties`.
   */
  static createRecipeVariant({recipe, eventUid}: CreateRecipeVariant) {
    const recipeVariant: Recipe = _.cloneDeep(recipe);

    recipeVariant.type = RecipeType.variant;
    recipeVariant.variantProperties = {
      note: "",
      variantName: "",
      eventUid: eventUid,
      originalRecipeUid: recipe.uid,
      originalRecipeType: recipe.type,
      originalRecipeCreator: recipe.created.fromUid,
    };
    // Temp-UID bis gespeichert wurde
    recipeVariant.uid = "";
    recipeVariant.created = {
      date: new Date(0),
      fromUid: "",
      fromDisplayName: "",
    };
    recipeVariant.lastChange = {
      date: new Date(0),
      fromUid: "",
      fromDisplayName: "",
    };

    return recipeVariant;
  }

  /* =====================================================================
  // Leere Einträge erzeugen
  // ===================================================================== */
  /**
   * Stellt sicher, dass Zutaten-, Zubereitungs- und Materiallisten mindestens
   * eine leere Position enthalten.
   *
   * @param recipe - Das zu prüfende Rezept.
   * @returns Rezept mit garantiert mindestens einer leeren Position pro Liste.
   */
  static createEmptyListEntries({recipe}: CreateEmptyListEntries) {
    recipe.ingredients = Recipe.createEmptyListEntryIngredients(
      recipe.ingredients,
    );
    recipe.preparationSteps = Recipe.createEmptyListEntryPreparationSteps(
      recipe.preparationSteps,
    );
    recipe.materials = Recipe.createEmptyListEntryMaterials(recipe.materials);
    return recipe;
  }

  /**
   * Fügt am Ende der Zutatenliste eine leere Position ein, wenn nötig.
   *
   * @param ingredients - Die bestehende Zutatenliste.
   * @returns Aktualisierte Zutatenliste.
   */
  static createEmptyListEntryIngredients(ingredients: Recipe["ingredients"]) {
    if (ingredients.order.length == 0) {
      const ingredient = Recipe.createEmptyIngredient();
      ingredients.entries[ingredient.uid] = ingredient;
      ingredients.order.push(ingredient.uid);
    } else {
      let lastEntry =
        ingredients.entries[ingredients.order[ingredients.order.length - 1]];

      if (lastEntry && lastEntry.posType == PositionType.ingredient) {
        lastEntry = lastEntry as Ingredient;

        if (lastEntry.product.uid) {
          const ingredient = Recipe.createEmptyIngredient();
          ingredients.entries[ingredient.uid] = ingredient;
          ingredients.order.push(ingredient.uid);
        }
      }
    }
    return ingredients;
  }

  /**
   * Fügt am Ende der Zubereitungsschrittliste eine leere Position ein, wenn nötig.
   *
   * @param preparationSteps - Die bestehende Zubereitungsliste.
   * @returns Aktualisierte Zubereitungsliste.
   */
  static createEmptyListEntryPreparationSteps(
    preparationSteps: Recipe["preparationSteps"],
  ) {
    if (Object.keys(preparationSteps.entries).length == 0) {
      const preparationStep = Recipe.createEmptyPreparationStep();
      preparationSteps.entries[preparationStep.uid] = preparationStep;
      preparationSteps.order.push(preparationStep.uid);
    } else {
      let lastEntry =
        preparationSteps.entries[
          preparationSteps.order[preparationSteps.order.length - 1]
        ];

      if (lastEntry && lastEntry.posType == PositionType.preparationStep) {
        lastEntry = lastEntry as PreparationStep;
        if (lastEntry.step) {
          const preparationStep = Recipe.createEmptyPreparationStep();
          preparationSteps.entries[preparationStep.uid] = preparationStep;
          preparationSteps.order.push(preparationStep.uid);
        }
      }
    }
    return preparationSteps;
  }

  /**
   * Fügt am Ende der Materialliste eine leere Position ein, wenn nötig.
   *
   * @param materials - Die bestehende Materialliste.
   * @returns Aktualisierte Materialliste.
   */
  static createEmptyListEntryMaterials(materials: Recipe["materials"]) {
    if (Object.keys(materials.entries).length == 0) {
      const material = Recipe.createEmptyMaterial();
      materials.entries[material.uid] = material;
      materials.order.push(material.uid);
    } else {
      const lastEntry =
        materials.entries[materials.order[materials.order.length - 1]];

      if (lastEntry && lastEntry.material.uid) {
        // Leere Position am Schluss
        const material = Recipe.createEmptyMaterial();
        materials.entries[material.uid] = material;
        materials.order.push(material.uid);
      }
    }
    return materials;
  }

  /* =====================================================================
  // Tag löschen
  // ===================================================================== */
  /**
   * Entfernt einen Tag aus der Tag-Liste.
   *
   * @param tags - Bestehende Tag-Liste.
   * @param tagToDelete - Zu entfernender Tag.
   * @returns Neue Tag-Liste ohne den gelöschten Tag.
   */
  static deleteTag({tags, tagToDelete}: DeleteTag) {
    return tags.filter((tag) => tag !== tagToDelete);
  }

  /* =====================================================================
  // Tag hinzufügen
  // ===================================================================== */
  /**
   * Fügt einen oder mehrere Tags (durch Leerzeichen getrennt) zur Liste hinzu.
   * Duplikate werden ignoriert.
   *
   * @param tags - Bestehende Tag-Liste.
   * @param tagsToAdd - Neuer Tag(s) als Leerzeichen-getrennter String.
   * @returns Aktualisierte Tag-Liste.
   */
  static addTag({tags, tagsToAdd}: AddTag) {
    if (!tagsToAdd) {
      return tags;
    }

    // Wenn der Input Leerzeichen hat, in mehrere Tags splitten
    const newTags = tagsToAdd.split(" ");

    newTags.forEach((newTag) => {
      // Nur neue Tags hinzufügen
      if (tags.find((tag) => tag === newTag.toLowerCase()) === undefined) {
        tags.push(newTag.toLowerCase());
      }
    });
    return tags;
  }

  /* =====================================================================
  // Daten prüfen
  // ===================================================================== */
  /**
   * Validiert Pflichtfelder eines Rezepts.
   *
   * @param recipe - Das zu prüfende Rezept.
   * @throws {Error} Wenn Pflichtfelder fehlen oder ungültige Werte enthalten.
   */
  static checkRecipeData(recipe: Recipe) {
    if (!recipe.name) {
      throw new Error(TEXT.RECIPE_NAME_CANT_BE_EMPTY);
    }
    if (
      recipe.type == RecipeType.variant &&
      !recipe.variantProperties?.variantName
    ) {
      throw new Error(TEXT.RECIPE_VARIANT_NAME_CANT_BE_EMPTY);
    }

    if (!recipe.portions) {
      throw new Error(TEXT.ERROR_GIVE_FIELD_VALUE("Portionen"));
    }

    if (recipe.portions < 0) {
      throw new Error(TEXT.ERROR_PORTIONS_NEGATIV);
    }

    if (isNaN(recipe.portions)) {
      throw new Error(TEXT.ERROR_PORTIONS_NOT_NUMERIC);
    }

    if (recipe.ingredients.order.length == 0) {
      throw new Error(TEXT.ERROR_NO_INGREDIENTS_GIVEN);
    } else if (recipe.ingredients.order.length == 1) {
      let lastEntry = recipe.ingredients.entries[recipe.ingredients.order[0]];

      if (lastEntry.posType == PositionType.section) {
        throw new Error(TEXT.ERROR_NO_INGREDIENTS_GIVEN);
      }
      lastEntry = lastEntry as Ingredient;
      if (lastEntry.product.uid == "") {
        throw new Error(TEXT.ERROR_NO_INGREDIENTS_GIVEN);
      }
    }

    Object.values(recipe.ingredients.entries).forEach((position, counter) => {
      if (position.posType == PositionType.ingredient) {
        position = position as Ingredient;
        if (
          !position.product.uid &&
          (position.quantity || position.unit || position.product.name)
        ) {
          throw new Error(TEXT.ERROR_POS_WITHOUT_PRODUCT(counter + 1));
        }
      }
    });
    Object.values(recipe.materials.entries).forEach((position, counter) => {
      if (
        !position.material.uid &&
        (position.quantity || position.material.name)
      ) {
        throw new Error(TEXT.ERROR_POS_WITHOUT_MATERIAL(counter));
      }
    });
  }

  /* =====================================================================
  // Speichern vorbereiten
  // ===================================================================== */
  /**
   * Bereitet ein Rezept für das Speichern vor: bereinigt leere Positionen,
   * berechnet Diät-Eigenschaften, validiert und normalisiert numerische Werte.
   *
   * @param recipe - Das zu speichernde Rezept.
   * @param products - Produktliste für die Diät-Berechnung.
   * @returns Bereinigtes und validiertes Rezept.
   * @throws {Error} Wenn die Validierung fehlschlägt.
   */
  static prepareSave({recipe, products}: PrepareSave) {
    // Leere Positionen entfernen
    if (Object.keys(recipe.ingredients.entries).length > 0) {
      recipe.ingredients = Recipe.deleteEmptyIngredients(recipe.ingredients);
    }
    if (Object.values(recipe.materials.entries).length > 0) {
      recipe.materials = Recipe.deleteEmptyMaterials(recipe.materials);
    }
    if (Object.values(recipe.preparationSteps.entries).length > 0) {
      recipe.preparationSteps = Recipe.deleteEmptyPreparationSteps(
        recipe.preparationSteps,
      );
    }

    // Diät-Eigenschaften berechnen
    recipe.dietProperties = Recipe.defineDietProperties({
      recipe: recipe,
      products: products,
    });

    // Nochmals prüfen ob alles ok
    try {
      Recipe.checkRecipeData(recipe);
    } catch (error) {
      console.error(error);
      throw error;
    }

    // Sicherstellen, dass numerische Werte korrekt gespeichert werden
    Object.values(recipe.ingredients.entries).forEach((ingredient) => {
      if (ingredient.posType == PositionType.ingredient) {
        ingredient = ingredient as Ingredient;
        if (!ingredient.quantity) {
          ingredient.quantity = 0;
        }
        if (!ingredient.unit || ingredient.unit == null) {
          ingredient.unit = "";
        }
        if (!isNaN(ingredient.quantity)) {
          ingredient.quantity = parseFloat(`${ingredient.quantity}`);
        }
        if (!isNaN(ingredient.scalingFactor)) {
          ingredient.scalingFactor = parseFloat(`${ingredient.scalingFactor}`);
        }
      }
    });

    Object.values(recipe.materials.entries).forEach((material) => {
      if (
        isNaN(material.quantity) ||
        (material.quantity as number | string) === ""
      ) {
        material.quantity = 0;
      } else {
        material.quantity = parseFloat(`${material.quantity}`);
      }
    });

    recipe.portions = parseInt(recipe.portions.toString());
    return recipe;
  }

  /* =====================================================================
  // Diät-Eigenschaften bestimmen
  // ===================================================================== */
  /**
   * Berechnet die Diät-Eigenschaften (Diättyp, Allergene) des Rezepts
   * aus den verwendeten Produkten.
   *
   * @param recipe - Das Rezept, dessen Zutaten ausgewertet werden.
   * @param products - Produktliste mit Diät-Informationen.
   * @returns Berechnete `DietProperties`.
   * @throws {Error} Wenn ein Produkt aus der Zutat nicht in der Produktliste gefunden wird.
   */
  static defineDietProperties({recipe, products}: DefineDietProperties) {
    // HINT: diese Funktion muss auch in der Cloud-FX nachgeführt werden
    const dietProperties = {allergens: [], diet: Diet.Vegan} as DietProperties;

    // Ein Vorkommnis reicht, damit ein Rezept die entsprechende Allergie erhält
    Object.values(recipe.ingredients.entries).forEach((ingredient) => {
      if (ingredient.posType == PositionType.ingredient) {
        ingredient = ingredient as Ingredient;
        const productUid = ingredient.product.uid;

        const product = products.find(
          (product) => product.uid === productUid,
        ) as Product;

        if (!product) {
          throw new Error(TEXT.ERROR_PRODUCT_UNKNOWN(ingredient.product.name));
        }

        if (product?.dietProperties?.allergens?.length > 0) {
          dietProperties.allergens = dietProperties.allergens.concat(
            product.dietProperties.allergens,
          );
        }

        if (dietProperties?.diet > product.dietProperties.diet) {
          dietProperties.diet = product.dietProperties.diet;
        }
      }
    });

    if (dietProperties.allergens.length > 0) {
      dietProperties.allergens = [...new Set(dietProperties.allergens)];
    }
    return dietProperties;
  }

  /* =====================================================================
  // Position mit Sektions-Anpassung bestimmen
  // ===================================================================== */
  /**
   * Gibt die bereinigte Positionsnummer einer Zutat/eines Schritts zurück,
   * wobei Abschnitte nicht mitgezählt werden.
   *
   * @param uid - UID der gesuchten Position.
   * @param order - Reihenfolge-Array der Einträge.
   * @param entries - Eintrags-Map mit posType.
   * @returns Positionsnummer (1-basiert, Abschnitte ausgeblendet).
   */
  static definePositionSectionAdjusted({
    uid,
    entries,
    order,
  }: DefinePositionSectionAdjusted) {
    let positionCounter = 0;

    if (Object.keys(entries).length !== order.length) {
      return positionCounter;
    }

    for (let i = 0; i < order.length; i++) {
      if (entries[order[i]]?.posType !== PositionType.section) {
        positionCounter++;
      }

      if (order[i] == uid) {
        return positionCounter;
      }
    }

    return positionCounter;
  }

  /* =====================================================================
  // Leere Zutaten entfernen
  // ===================================================================== */
  /**
   * Entfernt leere Zutaten-Positionen aus der Zutatenliste.
   *
   * @param ingredients - Zutatenliste mit möglichen Leereinträgen.
   * @returns Bereinigte Zutatenliste.
   */
  static deleteEmptyIngredients(
    ingredients: RecipeObjectStructure<Ingredient | Section>,
  ) {
    const ingredientUids = [...ingredients.order];
    ingredientUids.forEach((ingredientUid) => {
      if (
        ingredients.entries[ingredientUid].posType == PositionType.ingredient
      ) {
        const ingredient = ingredients.entries[ingredientUid] as Ingredient;
        if (
          !ingredient.quantity &&
          !ingredient.unit &&
          !ingredient.product.name
        ) {
          delete ingredients.entries[ingredientUid];
          ingredients.order = ingredients.order.filter(
            (orderUid) => orderUid !== ingredientUid,
          );
        }
      }
    });
    return ingredients;
  }

  /* =====================================================================
  // Leere Zubereitungsschritte entfernen
  // ===================================================================== */
  /**
   * Entfernt leere Zubereitungsschritte aus der Zubereitungsliste.
   *
   * @param preparationSteps - Zubereitungsliste mit möglichen Leereinträgen.
   * @returns Bereinigte Zubereitungsliste.
   */
  static deleteEmptyPreparationSteps(
    preparationSteps: RecipeObjectStructure<PreparationStep | Section>,
  ) {
    const preparationStepUids = [...preparationSteps.order];
    const cleanedPreparationSteps = _.cloneDeep(preparationSteps);

    preparationStepUids.forEach((preparationStepUid) => {
      if (
        cleanedPreparationSteps.entries[preparationStepUid].posType ==
        PositionType.preparationStep
      ) {
        const preparationStep = cleanedPreparationSteps.entries[
          preparationStepUid
        ] as PreparationStep;
        if (preparationStep.step == "") {
          delete cleanedPreparationSteps.entries[preparationStepUid];
          cleanedPreparationSteps.order = cleanedPreparationSteps.order.filter(
            (orderUid) => orderUid !== preparationStepUid,
          );
        }
      }
    });
    return cleanedPreparationSteps;
  }

  /* =====================================================================
  // Leere Materialien entfernen
  // ===================================================================== */
  /**
   * Entfernt leere Materialpositionen aus der Materialliste.
   *
   * @param materials - Materialliste mit möglichen Leereinträgen.
   * @returns Bereinigte Materialliste.
   */
  static deleteEmptyMaterials(
    materials: RecipeObjectStructure<RecipeMaterialPosition>,
  ) {
    const materialUids = [...materials.order];
    materialUids.forEach((materialUid) => {
      if (!materials.entries[materialUid].material.name) {
        delete materials.entries[materialUid];
        materials.order = materials.order.filter(
          (orderUid) => orderUid !== materialUid,
        );
      }
    });
    return materials;
  }

  /* =====================================================================
  // Leere Objekte erzeugen
  // ===================================================================== */
  /**
   * Erstellt eine leere Zutaten-Position.
   *
   * @returns Leere `Ingredient`-Instanz mit zufälliger UID.
   */
  static createEmptyIngredient(): Ingredient {
    return {
      uid: crypto.randomUUID(),
      posType: PositionType.ingredient,
      product: {uid: "", name: ""},
      quantity: 0,
      unit: "",
      detail: "",
      scalingFactor: 1,
    };
  }

  /**
   * Erstellt eine leere Abschnitt-Trennzeile.
   *
   * @returns Leere `Section`-Instanz mit zufälliger UID.
   */
  static createEmptySection(): Section {
    return {
      uid: crypto.randomUUID(),
      posType: PositionType.section,
      name: "",
    };
  }

  /**
   * Erstellt einen leeren Zubereitungsschritt.
   *
   * @returns Leere `PreparationStep`-Instanz mit zufälliger UID.
   */
  static createEmptyPreparationStep(): PreparationStep {
    return {
      uid: crypto.randomUUID(),
      posType: PositionType.preparationStep,
      step: "",
    };
  }

  /**
   * Erstellt eine leere Materialposition.
   *
   * @returns Leere `RecipeMaterialPosition`-Instanz mit zufälliger UID.
   */
  static createEmptyMaterial(): RecipeMaterialPosition {
    return {
      uid: crypto.randomUUID(),
      quantity: 0,
      material: {uid: "", name: ""},
    } as RecipeMaterialPosition;
  }

  /* =====================================================================
  // Skalierung
  // ===================================================================== */
  /**
   * Skaliert die Zutatenmengen auf eine neue Portionenzahl.
   * Optional werden Einheiten umgerechnet (z.B. EL → dl).
   *
   * @param recipe - Das Originalrezept.
   * @param portionsToScale - Zielportionenzahl.
   * @param scalingOptions - Optionale Einheitenumrechnung aktivieren.
   * @param units - Einheitenliste (benötigt bei convertUnits).
   * @param unitConversionBasic - Standard-Umrechnungsregeln.
   * @param unitConversionProducts - Produkt-spezifische Umrechnungsregeln.
   * @param products - Produktliste (benötigt bei convertUnits).
   * @returns Neue `RecipeObjectStructure` mit skalierten Zutatenmengen.
   */
  static scaleIngredients = ({
    recipe,
    portionsToScale,
    scalingOptions,
    units,
    unitConversionBasic,
    unitConversionProducts,
    products,
  }: Scale) => {
    const scaledIngredients = {} as RecipeObjectStructure<Ingredient>;

    Object.values(recipe?.ingredients?.entries ?? {}).forEach((ingredient) => {
      if (ingredient.posType == PositionType.ingredient) {
        ingredient = ingredient as Ingredient;

        if (ingredient.product.uid) {
          // Leere Positionen interessieren uns nicht

          const scaledIngredient = {...ingredient};
          if (
            !scaledIngredient.scalingFactor ||
            scaledIngredient.scalingFactor > 1
          ) {
            scaledIngredient.scalingFactor = 1;
          }

          if (ingredient.quantity) {
            if (scaledIngredient.scalingFactor === 1) {
              scaledIngredient.quantity =
                (ingredient.quantity / recipe.portions) * portionsToScale;
            } else {
              // Die Ursprungsmenge * Skalierungsfaktor, dann hochrechnen
              scaledIngredient.quantity =
                (ingredient.scalingFactor *
                  ingredient.quantity *
                  portionsToScale) /
                recipe.portions;

              if (
                portionsToScale > recipe.portions &&
                scaledIngredient.quantity < ingredient.quantity
              ) {
                // Wenn zwar mehr Portionen zubereitet werden, aber die Menge weniger
                // ist als die Originalmenge, übernehmen wir die Originalmenge
                scaledIngredient.quantity = ingredient.quantity;
              }
            }
          }
          scaledIngredients[ingredient.uid] = scaledIngredient;
          if (scalingOptions?.convertUnits) {
            // Einheit versuchen umzurechnen

            // Produkt suchen, damit die Ziel-Einheit bestimmt werden kann
            const product = products?.find(
              (product) => product.uid == scaledIngredient.product.uid,
            );
            if (!product?.shoppingUnit) {
              // Produkt nicht im Katalog oder ohne Einkaufseinheit — skalierte Menge
              // in Originaleinheit übernehmen, keine Umrechnung versuchen.
              return;
            }
            let {convertedQuantity, convertedUnit} =
              UnitConversion.convertQuantity({
                quantity: scaledIngredient.quantity,
                productUid: scaledIngredient.product.uid,
                fromUnit: scaledIngredient.unit,
                toUnit: product.shoppingUnit,
                units: units!,
                unitConversionBasic: unitConversionBasic!,
                unitConversionProducts: unitConversionProducts!,
              });
            if (
              convertedUnit === scaledIngredient.unit &&
              scaledIngredient.unit !== product.shoppingUnit
            ) {
              // Die Umrechnung hat nicht geklappt, nochmals versuchen:
              // Möglicherweise muss zuerst von TL nach EL konvertiert werden
              if (
                Unit.getDimensionOfUnit(units!, scaledIngredient.unit) ===
                UnitDimension.volume
              ) {
                let conversionFound = false;
                let tempConvertedQuantity: number;
                let tempConvertedUnit: string;

                Object.values(unitConversionBasic!).forEach(
                  (conversionRule) => {
                    if (
                      conversionFound === false &&
                      conversionRule.fromUnit === scaledIngredient.unit &&
                      Unit.getDimensionOfUnit(
                        units!,
                        conversionRule.fromUnit,
                      ) === UnitDimension.volume
                    ) {
                      // Umrechnen ohne Produkt
                      let {convertedQuantity, convertedUnit} =
                        UnitConversion.convertQuantity({
                          quantity: scaledIngredient.quantity,
                          fromUnit: scaledIngredient.unit,
                          toUnit: conversionRule.toUnit,
                          units: units!,
                          unitConversionBasic: unitConversionBasic!,
                        });

                      if (convertedUnit == conversionRule.toUnit) {
                        tempConvertedQuantity = convertedQuantity;
                        tempConvertedUnit = convertedUnit;

                        // Die Umrechnung nochmals versuchen mit der neuen Einheit
                        ({convertedQuantity, convertedUnit} =
                          UnitConversion.convertQuantity({
                            quantity: tempConvertedQuantity,
                            productUid: scaledIngredient.product.uid,
                            fromUnit: tempConvertedUnit,
                            toUnit: product.shoppingUnit,
                            units: units!,
                            unitConversionBasic: unitConversionBasic!,
                            unitConversionProducts: unitConversionProducts!,
                          }));
                        if (convertedUnit === product.shoppingUnit) {
                          tempConvertedQuantity = convertedQuantity;
                          tempConvertedUnit = convertedUnit;
                          conversionFound = true;
                        }
                      }
                    }
                  },
                );

                if (conversionFound) {
                  convertedQuantity = tempConvertedQuantity!;
                  convertedUnit = tempConvertedUnit!;
                }
              }
            }

            if (convertedQuantity != undefined && convertedUnit != undefined) {
              // Nur übernehmen, wenn konsistent
              scaledIngredient.quantity = convertedQuantity;
              scaledIngredient.unit = convertedUnit;
            }
          }
        }
      }
    });
    return scaledIngredients;
  };

  /**
   * Skaliert die Materialmengen auf eine neue Portionenzahl.
   *
   * @param recipe - Das Originalrezept.
   * @param portionsToScale - Zielportionenzahl.
   * @returns Neue `RecipeObjectStructure` mit skalierten Materialmengen.
   */
  static scaleMaterials = ({recipe, portionsToScale}: Scale) => {
    const scaledMaterials = {} as RecipeObjectStructure<RecipeMaterialPosition>;

    Object.values(recipe.materials.entries).forEach((material) => {
      const scaledMaterial = {...material};

      if (material.quantity) {
        scaledMaterial.quantity =
          (scaledMaterial.quantity / recipe.portions) * portionsToScale;
      }
      scaledMaterials[material.uid] = scaledMaterial;
    });
    return scaledMaterials;
  };

  /* =====================================================================
  // Konverter: Repository-Daten → Recipe
  // ===================================================================== */
  /**
   * Erstellt eine vollständige Recipe-Instanz aus den flachen Repository-Daten.
   * Baut die `RecipeObjectStructure`-Listen aus den sortierten Flat-Arrays auf.
   *
   * @param header - Rezept-Kopfdaten (RecipeDomain).
   * @param ingredients - Zutatenliste, sortiert nach sortOrder.
   * @param steps - Zubereitungsschrittliste, sortiert nach sortOrder.
   * @param materials - Materialliste, sortiert nach sortOrder.
   * @returns Vollständige Recipe-Instanz.
   * @example
   * const recipe = Recipe.fromRepositoryData(header, ingredients, steps, materials);
   */
  static fromRepositoryData(
    header: RecipeDomain,
    ingredients: RecipeIngredientDomain[],
    steps: RecipePreparationStepDomain[],
    materials: RecipeMaterialDomain[],
  ): Recipe {
    const recipe = new Recipe();

    // Header-Felder übernehmen
    recipe.uid = header.uid;
    recipe.name = header.name;
    recipe.portions = header.portions;
    recipe.source = header.source;
    recipe.times = {...header.times};
    recipe.pictureSrc = header.pictureSrc;
    recipe.note = header.note;
    recipe.tags = [...header.tags];
    recipe.menuTypes = [...header.menuTypes];
    recipe.dietProperties = {
      diet: header.dietProperties.diet,
      allergens: [...header.dietProperties.allergens],
    };
    recipe.outdoorKitchenSuitable = header.outdoorKitchenSuitable;
    recipe.usable = header.usable;
    recipe.type = header.recipeType as RecipeType;
    recipe.rating = {
      avgRating: header.avgRating,
      noRatings: header.noRatings,
      myRating: 0, // Nutzerspezifisch — wird separat nachgeladen
    };
    recipe.created = {
      date: header.createdAt,
      fromUid: header.createdBy,
      fromDisplayName: "",
    };
    recipe.lastChange = {...recipe.created};
    recipe.linkedRecipes = [];
    recipe.usedProducts = [];
    recipe.usedMaterials = [];

    if (header.variantProperties) {
      recipe.variantProperties = {
        note: header.variantProperties.note,
        variantName: header.variantProperties.variantName,
        eventUid: header.variantProperties.eventUid,
        originalRecipeUid: header.variantProperties.originalRecipeUid,
        originalRecipeType:
          header.variantProperties.originalRecipeType as RecipeType,
        originalRecipeCreator:
          header.variantProperties.originalRecipeCreatorUid,
      };
    }

    // Zutaten: flaches Array → RecipeObjectStructure
    recipe.ingredients = {entries: {}, order: []};
    for (const ingredientRow of [...ingredients].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )) {
      const uid = ingredientRow.uid;
      if (ingredientRow.posType === "section") {
        recipe.ingredients.entries[uid] = {
          uid,
          posType: PositionType.section,
          name: ingredientRow.sectionName,
        } as Section;
      } else {
        recipe.ingredients.entries[uid] = {
          uid,
          posType: PositionType.ingredient,
          product: {uid: ingredientRow.productId ?? "", name: ingredientRow.productName ?? ""},
          quantity: ingredientRow.quantity,
          unit: ingredientRow.unit ?? "",
          detail: ingredientRow.detail,
          scalingFactor: ingredientRow.scalingFactor,
        } as Ingredient;
      }
      recipe.ingredients.order.push(uid);
    }

    // Zubereitungsschritte: flaches Array → RecipeObjectStructure
    recipe.preparationSteps = {entries: {}, order: []};
    for (const stepRow of [...steps].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )) {
      const uid = stepRow.uid;
      if (stepRow.posType === "section") {
        recipe.preparationSteps.entries[uid] = {
          uid,
          posType: PositionType.section,
          name: stepRow.sectionName,
        } as Section;
      } else {
        recipe.preparationSteps.entries[uid] = {
          uid,
          posType: PositionType.preparationStep,
          step: stepRow.step,
        } as PreparationStep;
      }
      recipe.preparationSteps.order.push(uid);
    }

    // Materialien: flaches Array → RecipeObjectStructure
    recipe.materials = {entries: {}, order: []};
    for (const materialRow of [...materials].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )) {
      const uid = materialRow.uid;
      recipe.materials.entries[uid] = {
        uid,
        material: {uid: materialRow.materialId ?? "", name: materialRow.materialName ?? ""},
        quantity: materialRow.quantity,
      } as RecipeMaterialPosition;
      recipe.materials.order.push(uid);
    }

    return recipe;
  }

  /* =====================================================================
  // Konverter: Recipe → Repository-Zeilen
  // ===================================================================== */
  /**
   * Konvertiert die Zutatenliste eines Rezepts in ein flaches
   * `RecipeIngredientDomain`-Array für das Repository.
   * Abschnitte werden als posType `'section'` gespeichert.
   *
   * @param recipe - Das Rezept mit der Zutatenliste.
   * @param recipeId - ID des übergeordneten Rezepts (FK).
   * @returns Flaches Array von `RecipeIngredientDomain`-Objekten.
   * @example
   * const rows = Recipe.toIngredientRows(recipe, recipe.uid);
   * await database.recipeIngredients.saveAllForRecipe(recipe.uid, rows, authUser);
   */
  static toIngredientRows(
    recipe: Recipe,
    recipeId: string,
  ): RecipeIngredientDomain[] {
    const rows: RecipeIngredientDomain[] = [];
    let sortOrder = 0;

    for (const uid of recipe.ingredients.order) {
      sortOrder += 10;
      const position = recipe.ingredients.entries[uid];

      if (position.posType === PositionType.section) {
        const section = position as Section;
        rows.push({
          uid,
          recipeId,
          sortOrder,
          posType: "section",
          productId: null,
          quantity: 0,
          unit: null,
          detail: "",
          scalingFactor: 1,
          sectionName: section.name,
        });
      } else {
        const ingredient = position as Ingredient;
        rows.push({
          uid,
          recipeId,
          sortOrder,
          posType: "ingredient",
          productId: ingredient.product.uid || null,
          quantity: ingredient.quantity,
          unit: ingredient.unit || null,
          detail: ingredient.detail,
          scalingFactor: ingredient.scalingFactor,
          sectionName: "",
        });
      }
    }

    return rows;
  }

  /**
   * Konvertiert die Zubereitungsschrittliste eines Rezepts in ein flaches
   * `RecipePreparationStepDomain`-Array für das Repository.
   *
   * @param recipe - Das Rezept mit der Zubereitungsliste.
   * @param recipeId - ID des übergeordneten Rezepts (FK).
   * @returns Flaches Array von `RecipePreparationStepDomain`-Objekten.
   * @example
   * const rows = Recipe.toPreparationStepRows(recipe, recipe.uid);
   */
  static toPreparationStepRows(
    recipe: Recipe,
    recipeId: string,
  ): RecipePreparationStepDomain[] {
    const rows: RecipePreparationStepDomain[] = [];
    let sortOrder = 0;

    for (const uid of recipe.preparationSteps.order) {
      sortOrder += 10;
      const position = recipe.preparationSteps.entries[uid];

      if (position.posType === PositionType.section) {
        const section = position as Section;
        rows.push({
          uid,
          recipeId,
          sortOrder,
          posType: "section",
          step: "",
          sectionName: section.name,
        });
      } else {
        const step = position as PreparationStep;
        rows.push({
          uid,
          recipeId,
          sortOrder,
          posType: "preparation_step",
          step: step.step,
          sectionName: "",
        });
      }
    }

    return rows;
  }

  /**
   * Konvertiert die Materialliste eines Rezepts in ein flaches
   * `RecipeMaterialDomain`-Array für das Repository.
   *
   * @param recipe - Das Rezept mit der Materialliste.
   * @param recipeId - ID des übergeordneten Rezepts (FK).
   * @returns Flaches Array von `RecipeMaterialDomain`-Objekten.
   * @example
   * const rows = Recipe.toMaterialRows(recipe, recipe.uid);
   */
  static toMaterialRows(
    recipe: Recipe,
    recipeId: string,
  ): RecipeMaterialDomain[] {
    const rows: RecipeMaterialDomain[] = [];
    let sortOrder = 0;

    for (const uid of recipe.materials.order) {
      sortOrder += 10;
      const material = recipe.materials.entries[uid];
      rows.push({
        uid,
        recipeId,
        sortOrder,
        materialId: material.material.uid || null,
        quantity: material.quantity,
      });
    }

    return rows;
  }

  /* =====================================================================
  // Konverter: Recipe → RecipeDomain (für Repository-Speicherung)
  // ===================================================================== */
  /**
   * Konvertiert eine Recipe-Instanz in ein flaches RecipeDomain-Objekt.
   * Wird vor dem Speichern über `RecipeRepository.insertRecipe` oder
   * `RecipeRepository.updateRecipe` verwendet.
   *
   * @param recipe - Die Recipe-Instanz (in-memory).
   * @returns RecipeDomain-Objekt für Datenbankoperationen.
   * @example
   * const domain = Recipe.toDomain(preparedRecipe);
   * await database.recipes.insertRecipe(domain, authUser);
   */
  static toDomain(recipe: Recipe): RecipeDomain {
    return {
      uid: recipe.uid,
      name: recipe.name,
      portions: recipe.portions,
      source: recipe.source ?? "",
      times: {
        preparation: recipe.times?.preparation ?? 0,
        rest: recipe.times?.rest ?? 0,
        cooking: recipe.times?.cooking ?? 0,
      },
      pictureSrc: recipe.pictureSrc ?? "",
      note: recipe.note ?? "",
      tags: [...(recipe.tags ?? [])],
      menuTypes: [...(recipe.menuTypes ?? [])],
      dietProperties: {
        diet: recipe.dietProperties?.diet ?? 0,
        allergens: [...(recipe.dietProperties?.allergens ?? [])],
      },
      outdoorKitchenSuitable: recipe.outdoorKitchenSuitable ?? false,
      usable: recipe.usable ?? true,
      avgRating: recipe.rating?.avgRating ?? 0,
      noRatings: recipe.rating?.noRatings ?? 0,
      recipeType: recipe.type ?? RecipeType.private,
      variantProperties: recipe.variantProperties
        ? {
            note: recipe.variantProperties.note,
            variantName: recipe.variantProperties.variantName,
            eventUid: recipe.variantProperties.eventUid,
            originalRecipeUid: recipe.variantProperties.originalRecipeUid,
            originalRecipeType: recipe.variantProperties.originalRecipeType,
            originalRecipeCreatorUid:
              recipe.variantProperties.originalRecipeCreator,
          }
        : undefined,
      createdAt: recipe.created?.date ?? new Date(0),
      createdBy: recipe.created?.fromUid ?? "",
    };
  }
}
