import React, {SyntheticEvent} from "react";

import {useNavigate, useLocation} from "react-router";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";
import {useDebouncedValue} from "../../hooks/useDebouncedValue";

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
  LinearProgress,
  SelectChangeEvent,
  SnackbarCloseReason,
  Paper,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";

import {RECIPE as ROUTE_RECIPE} from "../../constants/routes";
import {Action} from "../../constants/actions";
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
  RECIPE_LIST_LOAD_MORE as TEXT_RECIPE_LIST_LOAD_MORE,
  RECIPE_LIST_RETRY as TEXT_RECIPE_LIST_RETRY,
  RECIPE_LIST_LOAD_ERROR as TEXT_RECIPE_LIST_LOAD_ERROR,
  RECIPE_LIST_LOAD_MORE_ERROR as TEXT_RECIPE_LIST_LOAD_MORE_ERROR,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";

import {RecipeShort} from "./recipe.types";
import {MenuType, RecipeType} from "./recipe.class";
import {
  INITIAL_SEARCH_SETTINGS,
  SearchSettings,
} from "./recipeList.types";
import {useRecipeList} from "./useRecipeList";
import {
  clearRecipeListCache,
  consumeRecipeListScrollY,
  loadRecipeListCache,
  saveRecipeListScrollY,
  skipScrollToTopIfRestorable,
} from "./recipeListCache";

import {PageTitle} from "../Shared/pageTitle";
import {SearchPanel} from "../Shared/searchPanel";

import {RecipeCard, RecipeCardLoading} from "./recipeCard";
import {AlertMessage} from "../Shared/AlertMessage";
import {CustomSnackbar, SnackbarState} from "../Shared/customSnackbar";

import {Lock as LockIcon, Category as CategoryIcon} from "@mui/icons-material";

import {Allergen, Diet} from "../Product/product.types";
import {useAuthUser} from "../Session/authUserContext";
import AuthUser from "../Session/authUser.class";

/** Verzögerung bevor eine erfolglose Suche als Analytics-Event getrackt wird. */
const SEARCH_ANALYTICS_DEBOUNCE_MS = 600;

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */

/** Aktionen für den Rezepte-Reducer (nur Snackbar, die Liste lädt der Hook). */
enum ReducerActions {
  SET_SNACKBAR = "SET_SNACKBAR",
  CLOSE_SNACKBAR = "CLOSE_SNACKBAR",
}

/** Diskriminierte Union für Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.SET_SNACKBAR; payload: SnackbarState}
  | {type: ReducerActions.CLOSE_SNACKBAR};

/**
 * Zustand der Rezeptseite.
 *
 * @param snackbar Aktueller Snackbar-Zustand.
 */
type State = {
  snackbar: SnackbarState;
};

const initialState: State = {
  snackbar: {} as SnackbarState,
};

/**
 * Reducer für die Rezeptseite. Verwaltet den Snackbar-Zustand.
 *
 * @param state Aktueller Zustand.
 * @param action Auszuführende Aktion.
 * @returns Neuer Zustand.
 * @throws {Error} Bei unbekanntem Aktionstyp.
 */
const recipesReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SET_SNACKBAR:
      return {...state, snackbar: action.payload};
    case ReducerActions.CLOSE_SNACKBAR:
      return {
        ...state,
        snackbar: {severity: "success", message: "", open: false},
      };
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unbekannter ActionType: ${JSON.stringify(_exhaustive)}`);
    }
  }
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
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptseite für die Rezeptübersicht. Zeigt die öffentlichen und die eigenen
 * privaten Rezepte seitenweise (weitere Karten laden beim Scrollen nach) mit
 * Suche und erweiterten Filtern in der Datenbank.
 *
 * @returns JSX-Element der Rezeptübersichtsseite.
 */
export const RecipesPage = () => {
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const location = useLocation();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(recipesReducer, initialState);

  // Nach dem Löschen eines Rezepts (Snackbar-Hinweis) den Zwischenspeicher
  // verwerfen, bevor die Liste ihn liest (die Liste wird beim Rendern initialisiert).
  if (location.state?.snackbar) {
    clearRecipeListCache();
  }

  // Snackbar aus dem location.state anzeigen (z.B. nach Rezept-Löschung)
  React.useEffect(() => {
    if (location.state?.snackbar && !state.snackbar.open) {
      dispatch({
        type: ReducerActions.SET_SNACKBAR,
        payload: location.state.snackbar!,
      });
    }
  }, [location.state]);

  // Ist ein gespeicherter Stand samt Scroll-Wert vorhanden, ScrollToTop
  // synchron unterdrücken (bevor dessen useEffect läuft)
  skipScrollToTopIfRestorable();

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Neues Rezept anlegen
  // ------------------------------------------ */
  const onNewClick = () => {
    // Zwischenspeicher verwerfen, damit die Liste beim Zurückkehren neu geladen wird
    clearRecipeListCache();
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
    // Scroll-Position speichern, damit sie beim Zurückkehren wiederhergestellt wird
    saveRecipeListScrollY(window.scrollY);
    navigate(`${ROUTE_RECIPE}/${recipe.uid}`, {
      state: {
        action: Action.VIEW,
        recipeShort: recipe,
        recipeType: recipe.type,
      },
    });
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
        <RecipeSearch
          onNewClick={onNewClick}
          onCardClick={onCardClick}
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
 * @param onNewClick Callback zum Erstellen eines neuen Rezepts.
 * @param onCardClick Callback beim Klick auf eine Rezept-Karte.
 * @param onFabButtonClick Optionaler Callback für den FAB-Button auf der Karte.
 * @param embeddedMode Ob die Komponente eingebettet angezeigt wird (z.B. im Menüplan).
 * @param fabButtonIcon Optionales Icon für den FAB-Button.
 * @param authUser Angemeldeter Benutzer.
 * @param eventUid Anlass, dessen Varianten in der eingebetteten Suche erscheinen.
 * @param enabled Ob geladen wird (die Schublade im Menüplan lädt erst beim Öffnen).
 * @param reloadToken Ändert sich dieser Wert, lädt die Liste neu (z.B. nach dem Anlegen eines Rezepts).
 */
interface RecipeSearchProps {
  onNewClick: () => void;
  onCardClick: ({event, recipe}: OnRecipeCardClickProps) => void;
  onFabButtonClick?: ({event, recipe}: OnRecipeCardClickProps) => void;
  embeddedMode?: boolean;
  fabButtonIcon?: JSX.Element;
  authUser: AuthUser;
  eventUid?: string;
  enabled?: boolean;
  reloadToken?: number;
}

/**
 * Ob mindestens ein Filter der erweiterten Suche aktiv ist (ohne Suchtext).
 *
 * @param searchSettings Sucheinstellungen.
 * @returns `true`, wenn ein Filter vom Standard abweicht.
 */
const hasActiveFilters = (searchSettings: SearchSettings): boolean =>
  searchSettings.diet !== INITIAL_SEARCH_SETTINGS.diet ||
  !searchSettings.allergens.includes(Allergen.None) ||
  searchSettings.menuTypes.length > 0 ||
  searchSettings.outdoorKitchenSuitable ||
  searchSettings.recipeType !== INITIAL_SEARCH_SETTINGS.recipeType ||
  searchSettings.showOnlyMyRecipes;

/**
 * Rezeptsuche mit Freitext, erweiterten Filtern und Ergebnisanzeige als
 * Kartenraster. Die Liste wächst beim Scrollen; Suche und Filter fragen die
 * Datenbank. Unterstützt den eingebetteten Modus (z.B. im Menüplan). Auf der
 * Rezeptseite bleiben Karten, Suche und Scroll-Position beim Öffnen eines
 * Rezepts erhalten.
 */
export const RecipeSearch = ({
  onNewClick,
  onCardClick,
  onFabButtonClick,
  embeddedMode = false,
  fabButtonIcon,
  authUser,
  eventUid,
  enabled = true,
  reloadToken = 0,
}: RecipeSearchProps) => {
  const classes = useCustomStyles();
  const [restoredCache] = React.useState(() =>
    embeddedMode ? null : loadRecipeListCache(authUser.uid),
  );
  const [searchSettings, setSearchSettings] = React.useState<SearchSettings>(
    () => restoredCache?.searchSettings ?? INITIAL_SEARCH_SETTINGS,
  );

  const list = useRecipeList({
    searchSettings,
    userId: authUser.uid,
    eventUid,
    enabled,
    useCache: !embeddedMode,
    restoredCache,
  });

  /* ------------------------------------------
  // Scroll-Position nach der Rückkehr aus einem Rezept wiederherstellen
  // ------------------------------------------ */
  const scrollRestoredRef = React.useRef(false);
  React.useEffect(() => {
    if (
      embeddedMode ||
      scrollRestoredRef.current ||
      !list.restoredFromCache ||
      list.recipes.length === 0
    ) {
      return;
    }
    scrollRestoredRef.current = true;
    const savedScrollY = consumeRecipeListScrollY();
    if (savedScrollY === null) return;
    // Doppeltes requestAnimationFrame damit das DOM fertig gerendert ist
    // und die ScrollToTop-Komponente bereits gelaufen ist
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo({top: savedScrollY}));
    });
  }, [embeddedMode, list.restoredFromCache, list.recipes.length]);

  /* ------------------------------------------
  // Neu laden, wenn sich das Rezeptangebot geändert hat (z.B. neues Rezept)
  // ------------------------------------------ */
  const previousReloadToken = React.useRef(reloadToken);
  const {reload} = list;
  React.useEffect(() => {
    if (previousReloadToken.current === reloadToken) return;
    previousReloadToken.current = reloadToken;
    reload();
  }, [reloadToken, reload]);

  /* ------------------------------------------
  // Analytics: Erfolglose Suchen tracken
  // ------------------------------------------ */
  const debouncedSearchString = useDebouncedValue(
    searchSettings.searchString,
    SEARCH_ANALYTICS_DEBOUNCE_MS,
  );
  const lastReportedTermRef = React.useRef("");
  React.useEffect(() => {
    const term = debouncedSearchString.trim();
    // Nur melden, wenn die Datenbank «keine Treffer» bestätigt hat und kein
    // anderer Filter das Ergebnis leert (sonst wäre es keine erfolglose Suche).
    if (
      !term ||
      term !== searchSettings.searchString.trim() ||
      !list.hasConfirmedNoResults ||
      hasActiveFilters(searchSettings) ||
      lastReportedTermRef.current === term
    ) {
      return;
    }
    lastReportedTermRef.current = term;
    trackEvent(AnalyticsEvent.SEARCH_NO_RESULTS, {
      source: embeddedMode ? "recipe_drawer" : "recipe",
      searchTerm: term,
    });
  }, [debouncedSearchString, list.hasConfirmedNoResults, searchSettings, embeddedMode]);

  /* ------------------------------------------
  // Hilfsfunktion: Sucheinstellungen anwenden
  // ------------------------------------------ */
  /**
   * Wendet eine partielle Aktualisierung der Sucheinstellungen an.
   *
   * @param update Teilweise Sucheinstellungen zum Zusammenführen.
   */
  const applySearchSettings = (update: Partial<SearchSettings>) => {
    setSearchSettings({...searchSettings, ...update});
  };

  /* ------------------------------------------
  // Update der Sucheigenschaften
  // ------------------------------------------ */
  const onAdvancedSearchClick = () => {
    // wenn die Erweiterte Suche geschlossen wird, die Einstellungen zurücksetzen
    if (searchSettings.showAdvancedSearch) {
      setSearchSettings({
        ...INITIAL_SEARCH_SETTINGS,
        searchString: searchSettings.searchString,
        showAdvancedSearch: false,
      });
    } else {
      setSearchSettings({
        ...searchSettings,
        showAdvancedSearch: true,
      });
    }
  };

  const onResetFilters = () => {
    setSearchSettings({
      ...INITIAL_SEARCH_SETTINGS,
      searchString: searchSettings.searchString,
      showAdvancedSearch: true,
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
    trackEvent(AnalyticsEvent.RECIPE_FILTER_APPLIED, {filterType: "diet"});
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
    trackEvent(AnalyticsEvent.RECIPE_FILTER_APPLIED, {filterType: "allergens"});
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
    trackEvent(AnalyticsEvent.RECIPE_FILTER_APPLIED, {filterType: "menutype"});
    applySearchSettings({menuTypes: selectedMenuTypes});
  };

  const onSearchSettingOutdoorKitchenSuitableUpdate = () => {
    trackEvent(AnalyticsEvent.RECIPE_FILTER_APPLIED, {filterType: "outdoor"});
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
  const findRecipeOfEvent = (event: React.MouseEvent<HTMLButtonElement>) =>
    list.recipes.find(
      (recipe) => recipe.uid === event.currentTarget.id.split("_")[1],
    );

  const handleCardClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Neben dem Event auch recipeShort mitgeben
    const selectedRecipe = findRecipeOfEvent(event);
    if (!selectedRecipe) {
      return;
    }
    onCardClick({event: event, recipe: selectedRecipe});
  };

  const handleFabButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedRecipe = findRecipeOfEvent(event);

    if (!selectedRecipe || !onFabButtonClick) {
      return;
    }
    onFabButtonClick({event: event, recipe: selectedRecipe});
  };

  /* ------------------------------------------
  // Anzahl: exakt nach der Antwort der Datenbank, davor «n+»
  // ------------------------------------------ */
  const shownCount = list.total ?? list.recipes.length;
  const countLabel = `${shownCount}${list.isProvisional ? "+" : ""} ${
    shownCount === 1 && !list.isProvisional ? TEXT_RECIPE : TEXT_RECIPES
  }`;

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
          <Typography variant="subtitle2">{countLabel}</Typography>
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
            onClick={onNewClick}
          >
            {TEXT_CREATE_RECIPE}
          </Button>
        </Grid>
      </Grid>
      {list.isProvisional && list.recipes.length > 0 && !list.error && (
        <LinearProgress sx={{mb: 2}} />
      )}
      {list.error && (
        <React.Fragment>
          <AlertMessage
            error={list.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
          <Typography align="center" sx={{my: 2}}>
            {TEXT_RECIPE_LIST_LOAD_ERROR}
          </Typography>
          <Grid container justifyContent="center" sx={{mb: 2}}>
            <Button variant="outlined" onClick={list.reload}>
              {TEXT_RECIPE_LIST_RETRY}
            </Button>
          </Grid>
        </React.Fragment>
      )}
      <RecipeResultsGrid
        recipes={list.recipes}
        isLoading={list.isProvisional && list.recipes.length === 0 && !list.error}
        hasConfirmedNoResults={list.hasConfirmedNoResults}
        embeddedMode={embeddedMode}
        fabButtonIcon={fabButtonIcon}
        onCardClick={handleCardClick}
        onFabButtonClick={onFabButtonClick ? handleFabButtonClick : undefined}
        onNewClick={onNewClick}
        hasMore={list.hasMore}
        isLoadingMore={list.isLoadingMore}
        loadMoreError={list.loadMoreError}
        onLoadMore={list.loadMore}
        sentinelRef={list.sentinelRef}
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
 * @param recipes Anzuzeigende Rezepte.
 * @param isLoading Ob noch nichts anzuzeigen ist und geladen wird (zeigt Skeleton-Karten).
 * @param hasConfirmedNoResults Ob die Datenbank «keine Treffer» bestätigt hat.
 * @param embeddedMode Ob die Komponente eingebettet angezeigt wird.
 * @param fabButtonIcon Optionales Icon für den FAB-Button auf jeder Karte.
 * @param onCardClick Callback beim Klick auf eine Rezept-Karte.
 * @param onFabButtonClick Optionaler Callback für den FAB-Button.
 * @param onNewClick Callback zum Erstellen eines neuen Rezepts.
 * @param hasMore Ob weitere Rezepte nachgeladen werden können.
 * @param isLoadingMore Ob gerade weitere Rezepte geladen werden.
 * @param loadMoreError Fehler beim Nachladen.
 * @param onLoadMore Lädt weitere Rezepte (auch als erneuter Versuch).
 * @param sentinelRef Ref für das Element am Listenende (löst das automatische Nachladen aus).
 */
interface RecipeResultsGridProps {
  recipes: RecipeShort[];
  isLoading: boolean;
  hasConfirmedNoResults: boolean;
  embeddedMode: boolean;
  fabButtonIcon?: JSX.Element;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onFabButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onNewClick: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError: Error | null;
  onLoadMore: () => void;
  sentinelRef: (node: Element | null) => void;
}

/** Breite einer Karte im Raster (abhängig vom Bildschirm und vom eingebetteten Modus). */
const getCardGridSize = (embeddedMode: boolean) => ({
  xs: 12,
  sm: embeddedMode ? 6 : 4,
  md: embeddedMode ? 4 : 3,
  lg: embeddedMode ? 4 : 3,
  xl: embeddedMode ? 3 : 2,
});

/** Skeleton-Karten als Platzhalter (erstes Laden und beim Nachladen). */
const LoadingCards = ({count, embeddedMode}: {count: number; embeddedMode: boolean}) => (
  <React.Fragment>
    {Array.from({length: count}, (_, index) => (
      <Grid
        size={{
          xs: 12,
          sm: embeddedMode ? 12 : 6,
          md: embeddedMode ? 6 : 4,
          lg: embeddedMode ? 4 : 3,
        }}
        key={"recipeLoadingCardGrid_" + index}
      >
        <RecipeCardLoading key={"recipeLoadingCard_" + index} />
      </Grid>
    ))}
  </React.Fragment>
);

/**
 * Zeigt die Rezepte als Kartenraster an. Während des ersten Ladens werden
 * Skeleton-Karten angezeigt, beim Nachladen einige Platzhalter am Ende. Erst
 * wenn die Datenbank «keine Treffer» bestätigt, erscheint die Leer-Meldung
 * mit FAB zum Erstellen.
 */
const RecipeResultsGrid = ({
  recipes,
  isLoading,
  hasConfirmedNoResults,
  embeddedMode,
  fabButtonIcon,
  onCardClick,
  onFabButtonClick,
  onNewClick,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  sentinelRef,
}: RecipeResultsGridProps) => {
  // Ohne IntersectionObserver (alte Browser) lädt nur der Knopf nach
  const needsLoadMoreButton =
    hasMore &&
    !isLoadingMore &&
    (Boolean(loadMoreError) || typeof IntersectionObserver === "undefined");

  return (
    <Grid container spacing={2}>
      {isLoading ? (
        // 8 Karten zum Überbrücken, bis die Daten da sind
        <LoadingCards count={8} embeddedMode={embeddedMode} />
      ) : (
        <React.Fragment>
          {recipes.map((recipe) => (
            <Grid size={getCardGridSize(embeddedMode)} key={"recipe_" + recipe.uid}>
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
          {isLoadingMore && <LoadingCards count={4} embeddedMode={embeddedMode} />}
          {/* Keine Rezepte gefunden --> Neues Erfassen? */}
          {hasConfirmedNoResults && (
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
          {loadMoreError && (
            <Grid size={12}>
              <Typography align="center" color="error">
                {TEXT_RECIPE_LIST_LOAD_MORE_ERROR}
              </Typography>
            </Grid>
          )}
          {needsLoadMoreButton && (
            <Grid size={12} sx={{display: "flex", justifyContent: "center"}}>
              <Button variant="outlined" onClick={onLoadMore}>
                {loadMoreError ? TEXT_RECIPE_LIST_RETRY : TEXT_RECIPE_LIST_LOAD_MORE}
              </Button>
            </Grid>
          )}
          {/* Unsichtbares Ende der Liste: Sobald es sich nähert, wird nachgeladen */}
          {hasMore && (
            <Grid size={12}>
              <div ref={sentinelRef} data-testid="recipeListSentinel" style={{height: 1}} />
            </Grid>
          )}
        </React.Fragment>
      )}
    </Grid>
  );
};
