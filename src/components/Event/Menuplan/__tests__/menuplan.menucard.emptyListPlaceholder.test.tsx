/**
 * Unit-Tests für den Drop-Platzhalter bei leeren Listen in menuplan.menucard.tsx
 * und menuplan.menucard.list.tsx.
 *
 * Diese Tests rufen die bei `dropTargetForElements` registrierten Callbacks
 * (onDragEnter/onDrag/onDragLeave) direkt auf, statt echte native
 * Drag-Events zu simulieren — jsdom unterstützt die vom
 * @atlaskit/pragmatic-drag-and-drop-Adapter benötigte native
 * Drag-and-Drop-Hit-Test-Logik (elementsFromPoint etc.) nicht zuverlässig.
 * Das direkte Aufrufen der registrierten Callbacks testet exakt dieselbe
 * Logik, die die Bibliothek zur Laufzeit aufrufen würde.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// menuplan.menucard.tsx importiert transitiv davon (via menuplanService.ts
// → menuplan.tsx → RecipeDrawer.tsx → recipe.view.tsx → pdfUtils.ts).
jest.mock("@react-pdf/renderer", () => ({
  Document: () => null,
  Page: () => null,
  View: () => null,
  Text: () => null,
  Link: () => null,
  Svg: () => null,
  Path: () => null,
  Font: {register: jest.fn(), registerEmojiSource: jest.fn()},
  StyleSheet: {create: (styles: unknown) => styles},
  pdf: jest.fn(),
}));
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

import React from "react";
import {act, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

type DropTargetConfig = {
  element: Element;
  canDrop?: (args: {source: {data: Record<string | symbol, unknown>}}) => boolean;
  getData?: (args: {source: {data: Record<string | symbol, unknown>}}) => unknown;
  onDragEnter?: (args: {source: {data: Record<string | symbol, unknown>}}) => void;
  onDrag?: (args: {source: {data: Record<string | symbol, unknown>}}) => void;
  onDragLeave?: (args: {source: {data: Record<string | symbol, unknown>}}) => void;
  onDrop?: (args: {source: {data: Record<string | symbol, unknown>}}) => void;
};

let registeredDropTargets: DropTargetConfig[] = [];

jest.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => {
  const actual = jest.requireActual(
    "@atlaskit/pragmatic-drag-and-drop/element/adapter",
  );
  return {
    ...actual,
    dropTargetForElements: (config: DropTargetConfig) => {
      registeredDropTargets.push(config);
      return () => {
        registeredDropTargets = registeredDropTargets.filter(
          (registered) => registered !== config,
        );
      };
    },
  };
});

/**
 * Auto-mockender Proxy für useCustomStyles: jeder Property-Zugriff
 * (`classes.x.y`) und jeder Funktionsaufruf (`classes.x.y(...)`) liefert
 * wieder einen Proxy zurück, statt einen konkreten Style-Wert zu benötigen.
 */
function createStyleProxy(): unknown {
  const handler: ProxyHandler<object> = {
    get: () => createStyleProxy(),
    apply: () => createStyleProxy(),
  };
  return new Proxy(() => {}, handler);
}

jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => createStyleProxy()),
}));

jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn().mockResolvedValue({valid: false, input: ""})}),
}));

import {MenueListOfMeal} from "../menuplan.menucard";
import {
  getCardListItemData,
  isListContainerDropTargetData,
} from "../menuplan.menucard.list";
import {MenuplanDragDropTypes} from "../menuplan.constants";
import {HighlightedMenueContext} from "../highlightContext";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";
import type {Meal, Menue, MenuplanData} from "../menuplan.types";

const MENUE_UID = "menue-1";
const MEAL_UID = "meal-1";
const MEALTYPE_UID = "mealtype-1";
const FAKE_RECT = {height: 40} as DOMRect;

function buildMenue(overrides: Partial<Menue> = {}): Menue {
  return {
    uid: MENUE_UID,
    name: "Testmenü",
    mealRecipeOrder: [],
    materialOrder: [],
    productOrder: [],
    ...overrides,
  };
}

function buildMeal(): Meal {
  return {
    uid: MEAL_UID,
    date: "2026-03-10",
    mealType: MEALTYPE_UID,
    menuOrder: [MENUE_UID],
  };
}

function buildDefaultProps(menue: Menue) {
  return {
    meal: buildMeal(),
    menues: {[MENUE_UID]: menue} as MenuplanData["menues"],
    mealRecipes: {} as MenuplanData["mealRecipes"],
    products: {} as MenuplanData["products"],
    materials: {} as MenuplanData["materials"],
    notes: {} as MenuplanData["notes"],
    menuplanSettings: {showDetails: false, enableDragAndDrop: true},
    groupConfiguration: new EventGroupConfiguration(),
    mealTypes: {
      entries: {[MEALTYPE_UID]: {uid: MEALTYPE_UID, name: "Zmittag"}},
      order: [MEALTYPE_UID],
    } as MenuplanData["mealTypes"],
    onUpdateMenue: jest.fn(),
    onAddRecipe: jest.fn(),
    onAddProduct: jest.fn(),
    onAddMaterial: jest.fn(),
    onEditMenue: jest.fn(),
    onDeleteMenue: jest.fn(),
    onNoteUpdate: jest.fn(),
    onMealRecipeOpen: jest.fn(),
    onMealProductOpen: jest.fn(),
    onMealMaterialOpen: jest.fn(),
    onMoveDragAndDropElement: jest.fn(),
  };
}

function renderMenueCard(menue: Menue) {
  return render(
    <HighlightedMenueContext.Provider value={new Set()}>
      <MenueListOfMeal {...buildDefaultProps(menue)} />
    </HighlightedMenueContext.Provider>,
  );
}

function buildCardListItemSource(itemType: MenuplanDragDropTypes) {
  return {
    data: getCardListItemData({
      listItem: {id: "dragged-item", primaryText: "", secondaryText: "", type: itemType},
      rect: FAKE_RECT,
      menueUid: MENUE_UID,
    }),
  };
}

/**
 * Findet unter allen registrierten Drop-Targets das Container-Level-Target
 * (Liste-als-Ganzes bzw. Fallback-Target), NICHT das Edge-Target eines
 * einzelnen Listeneintrags. Beide können bei einem Source `canDrop` mit
 * `true` beantworten — sie unterscheiden sich aber in der Form ihrer
 * `getData()`-Rückgabe (Item-Edge-Targets liefern `TCardListDropTargetData`
 * inkl. `attachClosestEdge`, wofür `element`/`input` nötig sind — deshalb
 * der try/catch, um solche Targets sicher zu überspringen).
 */
function findContainerDropTarget(source: {
  data: Record<string | symbol, unknown>;
}): DropTargetConfig | undefined {
  return registeredDropTargets.find((config) => {
    if (!config.canDrop?.({source})) return false;
    try {
      return isListContainerDropTargetData(
        config.getData?.({source}) as Record<string | symbol, unknown>,
      );
    } catch {
      return false;
    }
  });
}

describe("Menuplan DnD — Platzhalter für leere Listen", () => {
  beforeEach(() => {
    registeredDropTargets = [];
  });

  it("zeigt einen Platzhalter, wenn ein Rezept über die leere Rezeptliste gezogen wird", () => {
    renderMenueCard(buildMenue());

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    const source = buildCardListItemSource(MenuplanDragDropTypes.MEALRECIPE);
    const recipeContainer = findContainerDropTarget(source);
    expect(recipeContainer).toBeDefined();

    act(() => {
      recipeContainer!.onDragEnter?.({source});
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    act(() => {
      recipeContainer!.onDragLeave?.({source});
    });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("zeigt einen Platzhalter, wenn ein Produkt über die leere Produktliste gezogen wird", () => {
    renderMenueCard(buildMenue());

    const source = buildCardListItemSource(MenuplanDragDropTypes.PRODUCT);
    const productFallbackTarget = findContainerDropTarget(source);
    expect(productFallbackTarget).toBeDefined();

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    act(() => {
      productFallbackTarget!.onDragEnter?.({source});
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    act(() => {
      productFallbackTarget!.onDrop?.({source});
    });

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("zeigt keinen zusätzlichen Platzhalter, wenn über einen Eintrag einer nicht-leeren Rezeptliste gezogen wird", () => {
    const mealRecipes = {
      "recipe-1": {
        uid: "recipe-1",
        recipe: {
          recipeUid: "r-1",
          name: "Testrezept",
          type: "recipe",
          createdFromUid: null,
        },
        plan: [],
        totalPortions: 0,
      },
    } as unknown as MenuplanData["mealRecipes"];

    render(
      <HighlightedMenueContext.Provider value={new Set()}>
        <MenueListOfMeal
          {...buildDefaultProps(buildMenue({mealRecipeOrder: ["recipe-1"]}))}
          mealRecipes={mealRecipes}
        />
      </HighlightedMenueContext.Provider>,
    );

    // Genau ein Listeneintrag vorhanden (das echte Rezept), noch kein Drag im Gang.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    const source = buildCardListItemSource(MenuplanDragDropTypes.MEALRECIPE);
    // Der Container ist ein Vorfahre jedes Listeneintrags und erhält daher
    // ebenfalls onDragEnter/onDrag — muss aber wegen der internen
    // Leer-Prüfung (Liste hat 1 Eintrag) keinen Platzhalter rendern.
    const recipeContainer = findContainerDropTarget(source);
    expect(recipeContainer).toBeDefined();

    act(() => {
      recipeContainer!.onDragEnter?.({source});
      recipeContainer!.onDrag?.({source});
    });

    // Weiterhin nur der eine echte Eintrag — kein zweiter, falscher Platzhalter.
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
