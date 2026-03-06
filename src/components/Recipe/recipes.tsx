import React, {SyntheticEvent} from "react";

import {useNavigate, useLocation} from "react-router";

import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import {
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  InputLabel,
  Select,
  OutlinedInput,
  MenuItem,
  Checkbox,
  ListItemText,
  FormControl,
  FormControlLabel,
  Switch,
  Fab,
  Typography,
  Backdrop,
  CircularProgress,
  SelectChangeEvent,
  SnackbarCloseReason,
  Paper,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";

import {RECIPE as ROUTE_RECIPE} from "../../constants/routes";
import Action from "../../constants/actions";
import {
  ALL as TEXT_ALL,
  PUBLIC as TEXT_PUBLIC,
  PRIVATE as TEXT_PRIVATE,
  VARIANT as TEXT_VARIANT,
  ADVANCED_SEARCH as TEXT_ADVANCED_SEARCH,
  RECIPE as TEXT_RECIPE,
  RECIPES as TEXT_RECIPES,
  RESTRICTIONS as TEXT_RESTRICTIONS,
  FIND_YOUR_FAVORITE_RECIPES as TEXT_FIND_YOUR_FAVORITE_RECIPES,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  CONSIDER_INTOLERANCES as TEXT_CONSIDER_INTOLERANCES,
  NONE_RESTRICTION as TEXT_NONE_RESTRICTION,
  LACTOSE as TEXT_LACTOSE,
  GLUTEN as TEXT_GLUTEN,
  IS_VEGAN as TEXT_IS_VEGAN,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  RECIPETYPE as TEXT_RECIPETYPE,
  CREATE_RECIPE as TEXT_CREATE_RECIPE,
  PRIVATE_RECIPE as TEXT_PRIVATE_RECIPE,
  VARIANT_RECIPE as TEXT_VARIANT_RECIPE,
  NO_RECIPE_FOUND as TEXT_NO_RECIPE_FOUND,
  CREATE_A_NEW_ONE as TEXT_CREATE_A_NEW_ONE,
  MENU_TYPE as TEXT_MENU_TYPE,
  MENU_TYPES as TEXT_MENU_TYPES,
  OUTDOOR_KITCHEN_SUITABLE as TEXT_OUTDOOR_KITCHEN_SUITABLE,
  SHOW_ONLY_MY_RECIPES as TEXT_SHOW_ONLY_MY_RECIPES,
  RESET as TEXT_RESET,
} from "../../constants/text";

import useCustomStyles from "../../constants/styles";

import RecipeShort from "./recipeShort.class";
import {MenuType, RecipeType} from "./recipe.class";

import PageTitle from "../Shared/pageTitle";
import SearchPanel from "../Shared/searchPanel";

import RecipeCard, {RecipeCardLoading} from "./recipeCard";
import AlertMessage from "../Shared/AlertMessage";
import CustomSnackbar, {Snackbar} from "../Shared/customSnackbar";

import {Lock as LockIcon, Category as CategoryIcon} from "@mui/icons-material";

import {useDatabase} from "../Database/DatabaseContext";
import type {RecipeShortDomain} from "../Database/Repository/RecipeRepository";
import {Allergen, Diet} from "../Product/product.class";
import {
  STORAGE_OBJECT_PROPERTY,
  SessionStorageHandler,
} from "../Firebase/Db/sessionStorageHandler.class";
import {useAuthUser} from "../Session/authUserContext";
import AuthUser from "../Firebase/Authentication/authUser.class";

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */

/** Aktionen für den Rezepte-Reducer. */
enum ReducerActions {
  RECIPES_FETCH_INIT = "RECIPES_FETCH_INIT",
  RECIPES_FETCH_SUCCESS = "RECIPES_FETCH_SUCCESS",
  RECIPES_FETCH_ERROR = "RECIPES_FETCH_ERROR",
  SET_SNACKBAR = "SET_SNACKBAR",
  CLOSE_SNACKBAR = "CLOSE_SNACKBAR",
}

/**
 * Diskriminierte Union für Reducer-Aktionen.
 * Jede Aktion hat einen eindeutigen Typ und optional ein typsicheres Payload.
 */
type DispatchAction =
  | {type: ReducerActions.RECIPES_FETCH_INIT}
  | {type: ReducerActions.RECIPES_FETCH_SUCCESS; payload: RecipeShort[]}
  | {type: ReducerActions.RECIPES_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.SET_SNACKBAR; payload: Snackbar}
  | {type: ReducerActions.CLOSE_SNACKBAR};

/**
 * Zustand der Rezeptseite.
 *
 * @param recipes Liste der geladenen Kurz-Rezepte.
 * @param isLoading Ob gerade Daten geladen werden.
 * @param snackbar Aktueller Snackbar-Zustand.
 * @param error Fehler beim Laden, falls vorhanden.
 */
type State = {
  recipes: RecipeShort[];
  isLoading: boolean;
  snackbar: Snackbar;
  error: Error | null;
};

const initialState: State = {
  recipes: [],
  isLoading: false,
  snackbar: {} as Snackbar,
  error: null,
};

/**
 * Props für die Filterfunktion der Rezepte.
 *
 * @param searchSettings Aktuelle Sucheinstellungen.
 * @param recipes Liste der zu filternden Rezepte.
 */
interface FilterRecipesProps {
  searchSettings: SearchSettings;
  recipes: RecipeShort[];
}

/**
 * Reducer für die Rezeptseite. Verwaltet Lade-, Fehler- und Snackbar-Zustände.
 *
 * @param state Aktueller Zustand.
 * @param action Auszuführende Aktion.
 * @returns Neuer Zustand.
 * @throws {Error} Bei unbekanntem Aktionstyp.
 */
const recipesReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.RECIPES_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.RECIPES_FETCH_SUCCESS:
      return {
        ...state,
        recipes: action.payload,
        error: null,
        isLoading: false,
      };
    case ReducerActions.RECIPES_FETCH_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    case ReducerActions.SET_SNACKBAR:
      return {
        ...state,
        snackbar: action.payload,
      };
    case ReducerActions.CLOSE_SNACKBAR:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unbekannter ActionType: ${JSON.stringify(_exhaustive)}`);
    }
  }
};

/**
 * Initiale Sucheinstellungen für die Rezeptsuche.
 * Wird als Ausgangszustand und beim Zurücksetzen der erweiterten Suche verwendet.
 */
export const INITIAL_SEARCH_SETTINGS: SearchSettings = {
  showAdvancedSearch: false,
  searchString: "",
  allergens: [0],
  diet: Diet.Meat,
  menuTypes: [],
  recipeType: "all",
  outdoorKitchenSuitable: false,
  showOnlyMyRecipes: false,
};

/* ===================================================================
// ========================= Menü-Konstanten =========================
// =================================================================== */

/** Höhe eines einzelnen Menüeintrags in der Menütyp-Auswahl. */
const ITEM_HEIGHT = 48;

/** Oberer Abstand im Menütyp-Dropdown. */
const ITEM_PADDING_TOP = 8;

/** Konfiguration für das Menütyp-Dropdown-Menü (maximale Höhe und Breite). */
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

/* ===================================================================
// ====================== Hilfsfunktionen ============================
// =================================================================== */

/**
 * Wandelt ein RecipeShortDomain-Objekt in ein RecipeShort-Objekt um.
 * Wird benötigt, um die Supabase-Repository-Daten mit den bestehenden
 * UI-Komponenten (RecipeCard) kompatibel zu machen.
 *
 * @param domain - Das RecipeShortDomain-Objekt aus dem Supabase-Repository.
 * @returns Ein RecipeShort-Objekt für die UI.
 */
const domainToRecipeShort = (domain: RecipeShortDomain): RecipeShort => {
  const recipeShort = new RecipeShort();
  recipeShort.uid = domain.uid;
  recipeShort.name = domain.name;
  recipeShort.source = domain.source;
  recipeShort.pictureSrc = domain.pictureSrc;
  recipeShort.tags = domain.tags;
  recipeShort.linkedRecipes = [];
  recipeShort.dietProperties = {
    diet: domain.dietProperties.diet,
    allergens: domain.dietProperties.allergens,
  };
  recipeShort.menuTypes = domain.menuTypes as RecipeShort["menuTypes"];
  recipeShort.outdoorKitchenSuitable = domain.outdoorKitchenSuitable;
  recipeShort.created = {
    date: domain.createdAt,
    fromUid: domain.createdBy,
    fromDisplayName: "",
  };
  recipeShort.type = domain.recipeType as RecipeShort["type"];
  recipeShort.rating = {avgRating: domain.avgRating, noRatings: domain.noRatings};
  recipeShort.noComments = domain.noComments;
  if (domain.variantName) {
    recipeShort.variantName = domain.variantName;
  }
  return recipeShort;
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/* ===================================================================
// =============================== Base ==============================
// =================================================================== */

/**
 * Hauptseite für die Rezeptübersicht. Lädt alle Rezepte und zeigt sie
 * mit Suchfunktion und Filtermöglichkeiten an.
 */
const RecipesPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const location = useLocation();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(recipesReducer, initialState);

  // Snackbar aus dem location.state anzeigen (z.B. nach Rezept-Löschung)
  React.useEffect(() => {
    if (location.state?.snackbar && !state.snackbar.open) {
      dispatch({
        type: ReducerActions.SET_SNACKBAR,
        payload: location.state.snackbar!,
      });
    }
  }, [location.state]);

  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!authUser) {
      return;
    }

    dispatch({type: ReducerActions.RECIPES_FETCH_INIT});
    // Nur die für die Übersicht benötigten Spalten laden (Kurz-Abfrage)
    Promise.all([
      database.recipes.getAllPublicRecipeShorts(),
      database.recipes.getPrivateRecipeShortsForUser(authUser.authUid),
    ])
      .then(([publicRecipes, privateRecipes]) => {
        const all = [...publicRecipes, ...privateRecipes].map(
          domainToRecipeShort,
        );
        // alphabetisch sortieren
        all.sort((a, b) => a.name.localeCompare(b.name));
        dispatch({
          type: ReducerActions.RECIPES_FETCH_SUCCESS,
          payload: all,
        });
      })
      .catch((error) => {
        dispatch({
          type: ReducerActions.RECIPES_FETCH_ERROR,
          payload: error,
        });
      });
  }, [authUser]);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
 // Neues Rezept anlegen
 // ------------------------------------------ */
  const onNewClick = () => {
    navigate(ROUTE_RECIPE, {
      state: {action: Action.NEW},
    });
  };
  /* ------------------------------------------
  // Klick auf Rezept-Karte
  // ------------------------------------------ */
  const onCardClick = ({recipe}: OnRecipeCardClickProps) => {
    if (!recipe) {
      return;
    }
    if (recipe.type === RecipeType.private) {
      navigate(`${ROUTE_RECIPE}/${authUser.uid}/${recipe.uid}`, {
        state: {
          action: Action.VIEW,
          recipeShort: recipe,
          recipeType: recipe.type,
        },
      });
    } else if (recipe.type === RecipeType.public) {
      navigate(`${ROUTE_RECIPE}/${recipe.uid}`, {
        state: {
          action: Action.VIEW,
          recipeShort: recipe,
          recipeType: recipe.type,
        },
      });
    }
  };
  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | SyntheticEvent<Element, Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    delete location.state?.snackbar;
    dispatch({
      type: ReducerActions.CLOSE_SNACKBAR,
    });
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_RECIPES}
        subTitle={TEXT_FIND_YOUR_FAVORITE_RECIPES}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="lg">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        {state.error && (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}
        <RecipeSearch
          recipes={state.recipes}
          onNewClick={onNewClick}
          onCardClick={onCardClick}
          isLoading={state.isLoading}
          authUser={authUser}
        />
      </Container>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ============================ Rezept Suche =========================
// =================================================================== */

/**
 * Props für die Rezept-Karten-Klick-Aktion.
 *
 * @param event Das Maus-Event des Klicks.
 * @param recipe Das angeklickte Kurz-Rezept.
 */
export interface OnRecipeCardClickProps {
  event: React.MouseEvent<HTMLButtonElement>;
  recipe: RecipeShort;
}

/**
 * Props für die RecipeSearch-Komponente.
 *
 * @param recipes Liste aller verfügbaren Rezepte.
 * @param onNewClick Callback zum Erstellen eines neuen Rezepts.
 * @param onCardClick Callback beim Klick auf eine Rezept-Karte.
 * @param onFabButtonClick Optionaler Callback für den FAB-Button auf der Karte.
 * @param embeddedMode Ob die Komponente eingebettet angezeigt wird (z.B. im Menüplan).
 * @param fabButtonIcon Optionales Icon für den FAB-Button.
 * @param error Optionaler Fehler.
 * @param isLoading Ob Daten geladen werden.
 * @param authUser Angemeldeter Benutzer.
 */
interface RecipeSearchProps {
  recipes: RecipeShort[];
  onNewClick: () => void;
  onCardClick: ({event, recipe}: OnRecipeCardClickProps) => void;
  onFabButtonClick?: ({event, recipe}: OnRecipeCardClickProps) => void;
  embeddedMode?: boolean;
  fabButtonIcon?: JSX.Element;
  error?: Error | null;
  isLoading?: boolean;
  authUser: AuthUser;
}

/**
 * Sucheinstellungen für die Rezeptsuche inkl. erweiterte Filter.
 *
 * @param showAdvancedSearch Ob die erweiterte Suche angezeigt wird.
 * @param searchString Freitextsuche.
 * @param allergens Ausgewählte Allergene zum Ausfiltern.
 * @param diet Gewählte Ernährungsform (Fleisch, Vegetarisch, Vegan).
 * @param menuTypes Ausgewählte Menütypen.
 * @param outdoorKitchenSuitable Nur Rezepte für Outdoorküche anzeigen.
 * @param recipeType Filterung nach Rezepttyp (alle, öffentlich, privat).
 * @param showOnlyMyRecipes Nur eigene Rezepte anzeigen.
 */
interface SearchSettings {
  showAdvancedSearch: boolean;
  searchString: string;
  allergens: Allergen[];
  diet: Diet;
  menuTypes: MenuType[];
  outdoorKitchenSuitable: boolean;
  recipeType: RecipeType | "all";
  showOnlyMyRecipes: boolean;
}

/**
 * Rezeptsuche mit Freitext, erweiterten Filtern und Ergebnisanzeige als Kartenraster.
 * Unterstützt eingebetteten Modus (z.B. im Menüplan) und persistiert
 * Sucheinstellungen im Session Storage.
 */
export const RecipeSearch = ({
  recipes,
  onNewClick,
  onCardClick,
  onFabButtonClick,
  embeddedMode = false,
  fabButtonIcon,
  isLoading = false,
  authUser,
}: RecipeSearchProps) => {
  const classes = useCustomStyles();
  const [searchSettings, setSearchSettings] = React.useState<SearchSettings>(
    INITIAL_SEARCH_SETTINGS,
  );
  const [filteredData, setFilteredData] = React.useState<RecipeShort[]>([]);

  /* ------------------------------------------
  // Rezepte filtern
  // ------------------------------------------ */
  /**
   * Filtert die Rezeptliste anhand der aktuellen Sucheinstellungen.
   * Prüft nacheinander: Suchtext, Diät, Allergene, Menütypen,
   * Outdoorküche, Rezepttyp und "nur eigene Rezepte".
   *
   * @param params Sucheinstellungen und Rezeptliste.
   * @returns Gefilterte Rezeptliste.
   */
  const filterRecipes = ({searchSettings, recipes}: FilterRecipesProps) => {
    return recipes.filter((recipe) => {
      // Zuerst prüfen ob Text stimmt
      if (
        searchSettings.searchString &&
        !recipe.name
          .toLowerCase()
          .includes(searchSettings.searchString.toLowerCase()) &&
        recipe.tags.filter(
          (tag) =>
            tag
              .toLowerCase()
              .includes(searchSettings.searchString.toLocaleLowerCase()) ||
            recipe.variantName
              ?.toLowerCase()
              .includes(searchSettings.searchString.toLocaleLowerCase()),
        ).length === 0
      ) {
        return false;
      }

      // prüfen ob Diät passt
      if (
        searchSettings.diet !== Diet.Meat &&
        recipe.dietProperties?.diet !== searchSettings.diet
      ) {
        return false;
      }

      // prüfen ob Allergie passt
      if (
        !searchSettings.allergens.includes(Allergen.None) &&
        searchSettings.allergens.filter((allergen) =>
          recipe.dietProperties.allergens.includes(allergen),
        ).length > 0
      ) {
        return false;
      }

      // prüfen ob Menütypen passen
      if (
        searchSettings.menuTypes.length > 0 &&
        searchSettings.menuTypes.filter((menuType) =>
          recipe.menuTypes.includes(menuType),
        ).length === 0
      ) {
        return false;
      }

      // prüfen ob Outdoorküche --> nur filtern wenn Schalter an
      if (
        searchSettings.outdoorKitchenSuitable &&
        recipe.outdoorKitchenSuitable !== searchSettings.outdoorKitchenSuitable
      ) {
        return false;
      }

      // prüfen über Rezept-Typ
      if (
        searchSettings.recipeType !== "all" &&
        recipe.type !== searchSettings.recipeType
      ) {
        return false;
      }

      if (
        searchSettings.showOnlyMyRecipes &&
        recipe.created.fromUid !== authUser.authUid
      ) {
        return false;
      }

      // Das Rezept hat allen Anforderungen entsprochen
      return true;
    });
  };

  /* ------------------------------------------
  // Sucheinstellungen aus Session Storage wiederherstellen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (recipes.length === 0 || filteredData.length > 0) return;

    let restoredSettings: SearchSettings | null = null;
    if (!embeddedMode) {
      const stored = SessionStorageHandler.getDocument({
        storageObjectProperty: STORAGE_OBJECT_PROPERTY.SEARCH_SETTINGS,
        documentUid: "searchSettings",
      });
      if (stored) {
        restoredSettings = stored as SearchSettings;
      }
    }

    const settings = restoredSettings ?? INITIAL_SEARCH_SETTINGS;
    setSearchSettings(settings);
    setFilteredData(filterRecipes({searchSettings: settings, recipes}));
  }, [recipes]); // eslint-disable-line

  /* ------------------------------------------
  // Hilfsfunktion: Sucheinstellungen anwenden und filtern
  // ------------------------------------------ */
  /**
   * Wendet eine partielle Aktualisierung der Sucheinstellungen an
   * und filtert die Rezeptliste entsprechend neu.
   *
   * @param update Teilweise Sucheinstellungen zum Zusammenführen.
   */
  const applySearchSettings = (update: Partial<SearchSettings>) => {
    const newSettings = {...searchSettings, ...update};
    setSearchSettings(newSettings);
    setFilteredData(filterRecipes({searchSettings: newSettings, recipes}));
  };

  /* ------------------------------------------
  // Update der Sucheigenschaften
  // ------------------------------------------ */
  const onAdvancedSearchClick = () => {
    // wenn die Erweiterte Suche geschlossen wird, die Einstellungen zurücksetzen
    if (searchSettings.showAdvancedSearch) {
      const newSettings = {
        ...INITIAL_SEARCH_SETTINGS,
        searchString: searchSettings.searchString,
        showAdvancedSearch: false,
      };
      setSearchSettings(newSettings);
      setFilteredData(filterRecipes({searchSettings: newSettings, recipes}));

      SessionStorageHandler.deleteDocument({
        storageObjectProperty: STORAGE_OBJECT_PROPERTY.SEARCH_SETTINGS,
        documentUid: "searchSettings",
        prefix: "",
      });
    } else {
      setSearchSettings({
        ...searchSettings,
        showAdvancedSearch: true,
      });
    }
  };

  const onResetFilters = () => {
    const newSettings = {
      ...INITIAL_SEARCH_SETTINGS,
      searchString: searchSettings.searchString,
      showAdvancedSearch: true,
    };
    setSearchSettings(newSettings);
    setFilteredData(filterRecipes({searchSettings: newSettings, recipes}));

    SessionStorageHandler.deleteDocument({
      storageObjectProperty: STORAGE_OBJECT_PROPERTY.SEARCH_SETTINGS,
      documentUid: "searchSettings",
      prefix: "",
    });
  };

  const onSearch = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    applySearchSettings({searchString: event.target.value});
  };

  const onClearSearchString = () => {
    applySearchSettings({searchString: ""});
  };

  const onSearchSettingDietUpdate = (
    _event: React.MouseEvent<HTMLElement>,
    value: string,
  ) => {
    if (!value) {
      value = Diet.Meat.toString();
    }
    applySearchSettings({diet: parseInt(value)});
  };

  const onSearchSettingAllergensUpdate = (
    _event: React.MouseEvent<HTMLElement>,
    values: string[],
  ) => {
    let selectedAllergens: Allergen[] = [];
    if (values.length === 0) {
      selectedAllergens.push(0);
    } else {
      // Neuer Wert herausfinden
      const newValue = parseInt(
        values.filter(
          (value) => !searchSettings.allergens.includes(parseInt(value)),
        )[0],
      );

      if (newValue === Allergen.None) {
        // Keine - Reset der anderen Buttons
        selectedAllergens = [Allergen.None];
      } else {
        // Keine wieder entfernen
        selectedAllergens = values.map((allergen) => parseInt(allergen));
        selectedAllergens = selectedAllergens.filter(
          (allergen) => allergen !== Allergen.None,
        );
      }
    }
    applySearchSettings({allergens: selectedAllergens});
  };

  const onSearchSettingMenuTypeUpdate = (
    event: SelectChangeEvent<MenuType[]>,
  ) => {
    let selectedMenuTypes: MenuType[] = (
      event.target.value as unknown as string[]
    ).map((value: string) => parseInt(value));
    let newValue: MenuType;
    // Der Wert wird als String zurückgegeben, wir speichern ihn aber als Number
    // Wenn das Array nun zwei mal den gleichen Wert hat (als String und als Number)
    // müssen beide Werte entfernt werden --> Checkbox deselektiert.
    // der Neuste Wert ist immer der letzte im Array. Nach diesem kann gesucht werden
    if (selectedMenuTypes.length > 0) {
      newValue = selectedMenuTypes.slice(-1)[0];
    }
    if (selectedMenuTypes.filter((value) => value === newValue!).length > 1) {
      // Mehrere Einträge... alles löschen was dem neuen Wert entspricht
      selectedMenuTypes = selectedMenuTypes.filter(
        (value) => value !== newValue!,
      );
    }

    selectedMenuTypes.sort();
    applySearchSettings({menuTypes: selectedMenuTypes});
  };

  const onSearchSettingOutdoorKitchenSuitableUpdate = () => {
    applySearchSettings({
      outdoorKitchenSuitable: !searchSettings.outdoorKitchenSuitable,
    });
  };

  const onSearchSettingRecipeTypeUpdate = (
    _event: React.MouseEvent<HTMLElement>,
    value: SearchSettings["recipeType"],
  ) => {
    if (!value) {
      value = "all";
    }
    applySearchSettings({recipeType: value});
  };

  const onSearchSettingShowOnlyMyRecipesUpdate = () => {
    applySearchSettings({
      showOnlyMyRecipes: !searchSettings.showOnlyMyRecipes,
    });
  };

  /* ------------------------------------------
  // Card-Aktionen
  // ------------------------------------------ */
  const handleCardClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    SessionStorageHandler.upsertDocument({
      storageObjectProperty: STORAGE_OBJECT_PROPERTY.SEARCH_SETTINGS,
      documentUid: "searchSettings",
      value: searchSettings,
    });

    // Neben dem Event auch recipeShort mitgeben
    const selectedRecipe = recipes.find(
      (recipe) => recipe.uid === event.currentTarget.id.split("_")[1],
    );
    if (!selectedRecipe) {
      return;
    }
    onCardClick({event: event, recipe: selectedRecipe});
  };

  const handleFabButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedRecipe = recipes.find(
      (recipe) => recipe.uid === event.currentTarget.id.split("_")[1],
    );

    if (!selectedRecipe || !onFabButtonClick) {
      return;
    }
    onFabButtonClick({event: event, recipe: selectedRecipe});
  };

  const handleNewClick = () => {
    // Sucheinstellungen speichern
    SessionStorageHandler.upsertDocument({
      storageObjectProperty: STORAGE_OBJECT_PROPERTY.SEARCH_SETTINGS,
      documentUid: "searchSettings",
      value: searchSettings,
    });

    onNewClick();
  };

  return (
    <React.Fragment>
      <Grid container spacing={2} sx={{mb: 4}}>
        <Grid size={9}>
          <SearchPanel
            searchString={searchSettings.searchString}
            onUpdateSearchString={onSearch}
            onClearSearchString={onClearSearchString}
          />
        </Grid>
        <Grid size={3} sx={classes.centerCenter}>
          <ToggleButton
            value="advancedSearch"
            selected={searchSettings.showAdvancedSearch}
            onClick={onAdvancedSearchClick}
            color="primary"
            size="small"
          >
            {TEXT_ADVANCED_SEARCH}
          </ToggleButton>
        </Grid>
        <Grid size={12}>
          <Typography variant="subtitle2">{`${filteredData.length} ${
            filteredData.length !== 1 ? TEXT_RECIPES : TEXT_RECIPE
          }`}</Typography>
        </Grid>
      </Grid>

      <RecipeFilterPanel
        searchSettings={searchSettings}
        embeddedMode={embeddedMode}
        onDietUpdate={onSearchSettingDietUpdate}
        onAllergensUpdate={onSearchSettingAllergensUpdate}
        onMenuTypeUpdate={onSearchSettingMenuTypeUpdate}
        onOutdoorKitchenToggle={onSearchSettingOutdoorKitchenSuitableUpdate}
        onRecipeTypeUpdate={onSearchSettingRecipeTypeUpdate}
        onShowOnlyMyRecipesToggle={onSearchSettingShowOnlyMyRecipesUpdate}
        onResetFilters={onResetFilters}
      />

      <Grid container sx={{mb: 2, mt: 2}}>
        <Grid size={12} sx={classes.centerCenter}>
          <Button
            sx={classes.button}
            id={"new_recipe"}
            key={"new_recipe"}
            variant={"outlined"}
            color={"primary"}
            onClick={handleNewClick}
          >
            {TEXT_CREATE_RECIPE}
          </Button>
        </Grid>
      </Grid>
      <RecipeResultsGrid
        recipes={filteredData}
        isLoading={isLoading}
        embeddedMode={embeddedMode}
        fabButtonIcon={fabButtonIcon}
        onCardClick={handleCardClick}
        onFabButtonClick={onFabButtonClick ? handleFabButtonClick : undefined}
        onNewClick={handleNewClick}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ======================== Rezept-Filterpanel ========================
// =================================================================== */

/**
 * Props für das Filterpanel der Rezeptsuche.
 *
 * @param searchSettings Aktuelle Sucheinstellungen.
 * @param embeddedMode Ob die Komponente eingebettet angezeigt wird.
 * @param onDietUpdate Callback bei Änderung der Diät-Einstellung.
 * @param onAllergensUpdate Callback bei Änderung der Allergen-Filter.
 * @param onMenuTypeUpdate Callback bei Änderung der Menütyp-Auswahl.
 * @param onOutdoorKitchenToggle Callback beim Umschalten des Outdoorküche-Filters.
 * @param onRecipeTypeUpdate Callback bei Änderung des Rezepttyp-Filters.
 * @param onShowOnlyMyRecipesToggle Callback beim Umschalten von "nur eigene Rezepte".
 * @param onResetFilters Callback zum Zurücksetzen aller Filter auf die Standardwerte.
 */
interface RecipeFilterPanelProps {
  searchSettings: SearchSettings;
  embeddedMode: boolean;
  onDietUpdate: (event: React.MouseEvent<HTMLElement>, value: string) => void;
  onAllergensUpdate: (
    event: React.MouseEvent<HTMLElement>,
    values: string[],
  ) => void;
  onMenuTypeUpdate: (event: SelectChangeEvent<MenuType[]>) => void;
  onOutdoorKitchenToggle: () => void;
  onRecipeTypeUpdate: (
    event: React.MouseEvent<HTMLElement>,
    value: SearchSettings["recipeType"],
  ) => void;
  onShowOnlyMyRecipesToggle: () => void;
  onResetFilters: () => void;
}

/**
 * Filterpanel mit Diät-, Allergen-, Menütyp-, Outdoorküche-,
 * Rezepttyp- und "nur eigene Rezepte"-Filtern.
 * Wird über die erweiterte Suche ein-/ausgeklappt.
 */
const RecipeFilterPanel = ({
  searchSettings,
  embeddedMode,
  onDietUpdate,
  onAllergensUpdate,
  onMenuTypeUpdate,
  onOutdoorKitchenToggle,
  onRecipeTypeUpdate,
  onShowOnlyMyRecipesToggle,
  onResetFilters,
}: RecipeFilterPanelProps) => {
  const classes = useCustomStyles();

  return (
    <Collapse in={searchSettings.showAdvancedSearch} sx={{mt: 1}}>
      <Paper variant="outlined" sx={{p: 2, borderRadius: 2}}>
        <Grid container spacing={4} alignItems="center">
          {/* Ernährung */}
          <Grid size="auto">
            <Typography
              variant="caption"
              display="block"
              color="textSecondary"
              sx={{mb: 0.5}}
            >
              {TEXT_RESTRICTIONS}
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={searchSettings.diet}
              exclusive
              onChange={onDietUpdate}
              size="small"
              aria-label="Diät"
              id="diet"
              key="diet"
            >
              <ToggleButton value={Diet.Meat} aria-label="Keine">
                {TEXT_NONE_RESTRICTION}
              </ToggleButton>
              <ToggleButton value={Diet.Vegetarian} aria-label="Vegetarisch">
                {TEXT_IS_VEGETARIAN}
              </ToggleButton>
              <ToggleButton value={Diet.Vegan} aria-label="Vegan">
                {TEXT_IS_VEGAN}
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Allergene */}
          <Grid size="auto">
            <Typography
              variant="caption"
              display="block"
              color="textSecondary"
              sx={{mb: 0.5}}
            >
              {TEXT_CONSIDER_INTOLERANCES}
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={searchSettings.allergens}
              onChange={onAllergensUpdate}
              size="small"
              aria-label="Allergene"
              id="allergens"
              key="allergens"
            >
              <ToggleButton value={0} aria-label="Keine">
                {TEXT_NONE_RESTRICTION}
              </ToggleButton>
              <ToggleButton value={Allergen.Lactose} aria-label="Laktose">
                {TEXT_LACTOSE}
              </ToggleButton>
              <ToggleButton value={Allergen.Gluten} aria-label="Gluten">
                {TEXT_GLUTEN}
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          {/* Menütyp */}
          <Grid size={{xs: 12, sm: 6, md: 3}}>
            <FormControl variant="outlined" fullWidth size="small">
              <InputLabel id="menuTypesLabel">{TEXT_MENU_TYPE}</InputLabel>
              <Select
                labelId="menuTypesLabel"
                id="menuTypes"
                key="menuTypes"
                name="menuTypes"
                multiple
                value={searchSettings.menuTypes}
                onChange={onMenuTypeUpdate}
                input={<OutlinedInput fullWidth label={TEXT_MENU_TYPE} />}
                renderValue={(selected) => {
                  const selectedValues = selected as unknown as string[];
                  const textArray = selectedValues.map(
                    (value) => TEXT_MENU_TYPES[value],
                  ) as string[];
                  return (textArray as string[]).join(", ");
                }}
                MenuProps={MenuProps}
                fullWidth
              >
                {Object.keys(MenuType).map(
                  (menuType) =>
                    parseInt(menuType) > 0 && (
                      <MenuItem key={menuType} value={menuType}>
                        <Checkbox
                          checked={
                            searchSettings.menuTypes.indexOf(
                              parseInt(menuType),
                            ) > -1
                          }
                        />
                        <ListItemText primary={TEXT_MENU_TYPES[menuType]} />
                      </MenuItem>
                    ),
                )}
              </Select>
            </FormControl>
          </Grid>

          {/* Outdoorküche */}
          <Grid size="auto">
            <FormControlLabel
              checked={searchSettings.outdoorKitchenSuitable}
              onChange={onOutdoorKitchenToggle}
              control={<Switch size="small" />}
              label={
                <Typography variant="caption" color="textSecondary">
                  {TEXT_OUTDOOR_KITCHEN_SUITABLE}
                </Typography>
              }
            />
          </Grid>

          {/* Rezept-Typ */}
          <Grid size="auto">
            <Typography
              variant="caption"
              display="block"
              color="textSecondary"
              sx={{mb: 0.5}}
            >
              {TEXT_RECIPETYPE}
            </Typography>
            <ToggleButtonGroup
              color="primary"
              value={searchSettings.recipeType}
              exclusive
              onChange={onRecipeTypeUpdate}
              size="small"
              aria-label="Rezepttyp"
              id="recipeType"
              key="recipeType"
            >
              <ToggleButton value={"all"} aria-label="Alle">
                {TEXT_ALL}
              </ToggleButton>
              <ToggleButton
                color="primary"
                value={RecipeType.public}
                aria-label="öffentlich"
              >
                {TEXT_PUBLIC}
              </ToggleButton>
              <ToggleButton value={RecipeType.private} aria-label="Privat">
                {TEXT_PRIVATE}
              </ToggleButton>
              {embeddedMode && (
                <ToggleButton value={RecipeType.variant} aria-label="Variante">
                  {TEXT_VARIANT}
                </ToggleButton>
              )}
            </ToggleButtonGroup>
          </Grid>

          {/* Nur Meine Rezepte */}
          <Grid size="auto">
            <FormControlLabel
              checked={searchSettings.showOnlyMyRecipes}
              onChange={onShowOnlyMyRecipesToggle}
              control={<Switch size="small" />}
              label={
                <Typography variant="caption" color="textSecondary">
                  {TEXT_SHOW_ONLY_MY_RECIPES}
                </Typography>
              }
            />
          </Grid>

          {/* Filter zurücksetzen */}
          <Grid size={"auto"} sx={classes.centerCenter}>
            <Button
              variant="text"
              color="primary"
              size="small"
              onClick={onResetFilters}
            >
              {TEXT_RESET}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Collapse>
  );
};

/* ===================================================================
// ====================== Rezept-Ergebnisraster ======================
// =================================================================== */

/**
 * Props für das Ergebnisraster der Rezeptsuche.
 *
 * @param recipes Gefilterte Rezeptliste zur Anzeige.
 * @param isLoading Ob gerade geladen wird (zeigt Skeleton-Karten).
 * @param embeddedMode Ob die Komponente eingebettet angezeigt wird.
 * @param fabButtonIcon Optionales Icon für den FAB-Button auf jeder Karte.
 * @param onCardClick Callback beim Klick auf eine Rezept-Karte.
 * @param onFabButtonClick Optionaler Callback für den FAB-Button.
 * @param onNewClick Callback zum Erstellen eines neuen Rezepts.
 */
interface RecipeResultsGridProps {
  recipes: RecipeShort[];
  isLoading: boolean;
  embeddedMode: boolean;
  fabButtonIcon?: JSX.Element;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFabButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNewClick: () => void;
}

/**
 * Zeigt die Rezepte als Kartenraster an. Während des Ladens werden
 * Skeleton-Karten angezeigt. Bei leerer Ergebnisliste wird eine
 * Leer-Zustand-Nachricht mit FAB zum Erstellen angezeigt.
 */
const RecipeResultsGrid = ({
  recipes,
  isLoading,
  embeddedMode,
  fabButtonIcon,
  onCardClick,
  onFabButtonClick,
  onNewClick,
}: RecipeResultsGridProps) => {
  return (
    <Grid container spacing={2}>
      {isLoading ? (
        // 8 Karten zum Überbrücken, bis die Daten da sind
        [1, 2, 3, 4, 5, 6, 7, 8].map((counter) => (
          <Grid
            size={{
              xs: 12,
              sm: embeddedMode ? 12 : 6,
              md: embeddedMode ? 6 : 4,
              lg: embeddedMode ? 4 : 3,
            }}
            key={"recipeLoadingCardGrid_" + counter}
          >
            <RecipeCardLoading key={"recipeLoadingCard_" + counter} />
          </Grid>
        ))
      ) : (
        <React.Fragment>
          {recipes.map((recipe) => (
            <Grid
              size={{
                xs: 12,
                sm: embeddedMode ? 6 : 4,
                md: embeddedMode ? 4 : 3,
                lg: embeddedMode ? 4 : 3,
                xl: embeddedMode ? 3 : 2,
              }}
              key={"recipe_" + recipe.uid}
            >
              <RecipeCard
                key={"recipe_card_" + recipe.uid}
                recipe={recipe}
                onCardClick={onCardClick}
                ribbon={
                  recipe.type === RecipeType.private
                    ? {
                        tooltip: TEXT_PRIVATE_RECIPE,
                        cssProperty: "cardRibbon  cardRibbon--red",
                        icon: <LockIcon fontSize="small" />,
                      }
                    : recipe.type === RecipeType.variant
                      ? {
                          tooltip: TEXT_VARIANT_RECIPE,
                          cssProperty: "cardRibbon  cardRibbon--purple",
                          icon: <CategoryIcon fontSize="small" />,
                        }
                      : undefined
                }
                fabButtonIcon={fabButtonIcon}
                onFabButtonClick={onFabButtonClick}
              />
            </Grid>
          ))}
          {/* Keine Rezepte gefunden --> Neues Erfassen? */}
          {recipes.length === 0 && (
            <Grid size={{xs: 12, sm: 12, md: 12}} key={"noRecipe"}>
              <Typography
                variant="h5"
                align="center"
                color="textSecondary"
                sx={{mb: 2}}
              >
                {TEXT_NO_RECIPE_FOUND}
              </Typography>

              <Typography align="center" sx={{mb: 2}}>
                {TEXT_CREATE_A_NEW_ONE}
              </Typography>
              <Grid container spacing={2} justifyContent="center">
                <Grid>
                  <Fab
                    onClick={onNewClick}
                    color="primary"
                    aria-label="neues Rezept"
                  >
                    <AddIcon />
                  </Fab>
                </Grid>
              </Grid>
            </Grid>
          )}
        </React.Fragment>
      )}
    </Grid>
  );
};

export default RecipesPage;
