/**
 * Unit-Tests für den UsedRecipes-Reducer.
 *
 * Testet alle State-Transitionen:
 * - SHOW_LOADING: Loading-Flag und Error-Reset
 * - SET_SELECTED_LIST_ITEM: Listenauswahl und sortierte Menüs
 * - RECIPES_LOADED: Rezepte laden und Loading beenden
 * - GENERIC_ERROR: Fehler setzen und Loading beenden
 * - SNACKBAR_SHOW / SNACKBAR_CLOSE: Snackbar-State
 * - Default: Fehler bei unbekannter Action
 */
import {
  usedRecipesReducer,
  ReducerActions,
  initialState,
  State,
} from "../usedRecipesReducer";
import {MenueCoordinates} from "../../Menuplan/menuplan.types";
import Recipe from "../../../Recipe/recipe.class";


const createModifiedState = (overrides: Partial<State>): State => ({
  ...initialState,
  ...overrides,
});

const mockMenueCoordinates: MenueCoordinates[] = [
  {
    menueUid: "menue-001",
    date: new Date("2026-03-15"),
    menueName: "Menü 1",
    mealUid: "meal-001",
    mealType: {uid: "mt-001", name: "Mittagessen"},
  },
];

const mockRecipes: Record<string, Recipe> = {
  "recipe-001": {uid: "recipe-001", name: "Pasta"} as unknown as Recipe,
  "recipe-002": {uid: "recipe-002", name: "Risotto"} as unknown as Recipe,
};


describe("usedRecipesReducer", () => {  describe("SHOW_LOADING", () => {
    it("should set isLoading to true and clear error", () => {
      const stateWithError = createModifiedState({
        error: new Error("vorheriger Fehler"),
      });

      const result = usedRecipesReducer(stateWithError, {
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: true},
      });

      expect(result.isLoading).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should set isLoading to false", () => {
      const loadingState = createModifiedState({isLoading: true});

      const result = usedRecipesReducer(loadingState, {
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: false},
      });

      expect(result.isLoading).toBe(false);
    });

    it("should not mutate other state properties", () => {
      const stateWithRecipes = createModifiedState({
        loadedRecipes: mockRecipes,
        selectedListItem: "list-1",
      });

      const result = usedRecipesReducer(stateWithRecipes, {
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: true},
      });

      expect(result.loadedRecipes).toBe(mockRecipes);
      expect(result.selectedListItem).toBe("list-1");
    });
  });  describe("SET_SELECTED_LIST_ITEM", () => {
    it("should set selectedListItem and sortedMenueList", () => {
      const result = usedRecipesReducer(initialState, {
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {uid: "list-42", sortedMenueList: mockMenueCoordinates},
      });

      expect(result.selectedListItem).toBe("list-42");
      expect(result.sortedMenueList).toBe(mockMenueCoordinates);
    });

    it("should clear selection with empty uid", () => {
      const selected = createModifiedState({
        selectedListItem: "list-1",
        sortedMenueList: mockMenueCoordinates,
      });

      const result = usedRecipesReducer(selected, {
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {uid: "", sortedMenueList: []},
      });

      expect(result.selectedListItem).toBe("");
      expect(result.sortedMenueList).toEqual([]);
    });

    it("should not affect loading or error state", () => {
      const loadingState = createModifiedState({
        isLoading: true,
        error: new Error("test"),
      });

      const result = usedRecipesReducer(loadingState, {
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {uid: "list-1", sortedMenueList: []},
      });

      expect(result.isLoading).toBe(true);
      expect(result.error).toEqual(new Error("test"));
    });
  });  describe("RECIPES_LOADED", () => {
    it("should populate loadedRecipes and clear isLoading", () => {
      const loadingState = createModifiedState({isLoading: true});

      const result = usedRecipesReducer(loadingState, {
        type: ReducerActions.RECIPES_LOADED,
        payload: {recipes: mockRecipes},
      });

      expect(result.loadedRecipes).toBe(mockRecipes);
      expect(result.isLoading).toBe(false);
    });

    it("should handle empty recipes", () => {
      const result = usedRecipesReducer(initialState, {
        type: ReducerActions.RECIPES_LOADED,
        payload: {recipes: {}},
      });

      expect(result.loadedRecipes).toEqual({});
      expect(result.isLoading).toBe(false);
    });

    it("should replace previously loaded recipes", () => {
      const stateWithRecipes = createModifiedState({
        loadedRecipes: mockRecipes,
      });
      const newRecipes = {
        "recipe-999": {uid: "recipe-999"} as unknown as Recipe,
      };

      const result = usedRecipesReducer(stateWithRecipes, {
        type: ReducerActions.RECIPES_LOADED,
        payload: {recipes: newRecipes},
      });

      expect(result.loadedRecipes).toBe(newRecipes);
      expect(result.loadedRecipes["recipe-001"]).toBeUndefined();
    });
  });  describe("GENERIC_ERROR", () => {
    it("should set error and clear isLoading", () => {
      const loadingState = createModifiedState({isLoading: true});
      const error = new Error("Netzwerkfehler");

      const result = usedRecipesReducer(loadingState, {
        type: ReducerActions.GENERIC_ERROR,
        payload: error,
      });

      expect(result.error).toBe(error);
      expect(result.isLoading).toBe(false);
    });

    it("should preserve other state properties", () => {
      const stateWithSelection = createModifiedState({
        selectedListItem: "list-1",
        loadedRecipes: mockRecipes,
      });

      const result = usedRecipesReducer(stateWithSelection, {
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error("test"),
      });

      expect(result.selectedListItem).toBe("list-1");
      expect(result.loadedRecipes).toBe(mockRecipes);
    });
  });  describe("SNACKBAR_SHOW", () => {
    it("should open snackbar with severity and message", () => {
      const result = usedRecipesReducer(initialState, {
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {severity: "error", message: "Etwas ist schiefgelaufen"},
      });

      expect(result.snackbar).toEqual({
        open: true,
        severity: "error",
        message: "Etwas ist schiefgelaufen",
      });
    });

    it("should handle success severity", () => {
      const result = usedRecipesReducer(initialState, {
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {severity: "success", message: "Gespeichert"},
      });

      expect(result.snackbar.open).toBe(true);
      expect(result.snackbar.severity).toBe("success");
    });
  });  describe("SNACKBAR_CLOSE", () => {
    it("should reset snackbar to initial values", () => {
      const openSnackbar = createModifiedState({
        snackbar: {open: true, severity: "error", message: "Fehler!"},
      });

      const result = usedRecipesReducer(openSnackbar, {
        type: ReducerActions.SNACKBAR_CLOSE,
      });

      expect(result.snackbar).toEqual({
        open: false,
        severity: "success",
        message: "",
      });
    });
  });  describe("default case", () => {
    it("should throw on unknown action type", () => {
      expect(() =>
        usedRecipesReducer(initialState, {type: 999} as any),
      ).toThrow();
    });
  });  describe("initialState", () => {
    it("should have correct default values", () => {
      expect(initialState).toEqual({
        selectedListItem: null,
        sortedMenueList: [],
        loadedRecipes: {},
        isLoading: false,
        error: null,
        snackbar: {open: false, severity: "success", message: ""},
      });
    });
  });
});
