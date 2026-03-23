import React, {useCallback, useRef} from "react";
import {useNavigate, useSearchParams} from "react-router";
import * as Sentry from "@sentry/browser";

import {
  Stack,
  Container,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Skeleton,
  Autocomplete,
  AutocompleteChangeReason,
  LinearProgress,
  Chip,
} from "@mui/material";
import {
  Fastfood as FastfoodIcon,
  ShoppingCart as ShoppingCartIcon,
  Restaurant as RestaurantIcon,
  Build as BuildIcon,
  SwapHoriz as SwapHorizIcon,
  Event as EventIcon,
  OpenInNew as OpenInNewIcon,
  AccountTree as AccountTreeIcon,
} from "@mui/icons-material";

import {
  TRACE as TEXT_TRACE,
  WHERE_ARE_YOUR as TEXT_WHERE_ARE_YOUR,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  START_TRACE as TEXT_START_TRACE,
  WHERE_USED as TEXT_WHERE_USED,
  OR as TEXT_OR,
  RECIPE as TEXT_RECIPE,
  FOUND_REFERENCE as TEXT_FOUND_REFERENCES,
} from "../../constants/text";
import {
  RECIPE as ROUTE_RECIPE,
  EVENT as ROUTE_EVENT,
  UNITCONVERSION as ROUTE_UNITCONVERSION,
} from "../../constants/routes";

import {useCustomStyles} from "../../constants/styles";
import {PageTitle} from "../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "./system";

import {Product} from "../Product/product.types";
import {Material} from "../Material/material.types";
import {AlertMessage} from "../Shared/AlertMessage";
import {
  ItemAutocomplete,
  MaterialItem,
  ProductItem,
} from "../Event/ShoppingList/itemAutocomplete";
import {ItemType} from "../Event/ShoppingList/shoppingList.class";
import {TextFieldSize} from "../../constants/defaultValues";
import {useDatabase} from "../Database/DatabaseContext";
import {WhereUsedEntry} from "../Database/Repository/AdminOperationsRepository";
import {RecipeShortDomain} from "../Database/Repository/RecipeRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/**
 * Zuordnung von Tabellennamen auf den Query-Parameter für den Event-Tab-Deep-Link.
 * Einträge ohne Mapping landen auf dem Standard-Tab (Menüplan).
 */
const TAB_PARAM_BY_TABLE: Record<string, string> = {
  event_shopping_list_items: "shoppinglist",
  event_material_list_items: "materiallist",
};

/**
 * Typ des zu suchenden Objekts für den Verwendungsnachweis.
 */
type WhereUsedItemType = "product" | "material" | "recipe";

enum ReducerActions {
  PRODUCTS_FETCH_INIT = "PRODUCTS_FETCH_INIT",
  PRODUCTS_FETCH_SUCCESS = "PRODUCTS_FETCH_SUCCESS",
  MATERIALS_FETCH_INIT = "MATERIALS_FETCH_INIT",
  MATERIALS_FETCH_SUCCESS = "MATERIALS_FETCH_SUCCESS",
  RECIPES_FETCH_INIT = "RECIPES_FETCH_INIT",
  RECIPES_FETCH_SUCCESS = "RECIPES_FETCH_SUCCESS",
  UPDATE_SELECTION = "UPDATE_SELECTION",
  TRACE_START = "TRACE_START",
  TRACE_DONE = "TRACE_DONE",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
  GENERIC_ERROR = "GENERIC_ERROR",
}

type DispatchAction =
  | {type: ReducerActions.PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.MATERIALS_FETCH_INIT}
  | {type: ReducerActions.MATERIALS_FETCH_SUCCESS; payload: Material[]}
  | {type: ReducerActions.RECIPES_FETCH_INIT}
  | {type: ReducerActions.RECIPES_FETCH_SUCCESS; payload: RecipeShortDomain[]}
  | {
      type: ReducerActions.UPDATE_SELECTION;
      payload: Partial<Pick<State, "selectedItem" | "selectedRecipe">>;
    }
  | {type: ReducerActions.TRACE_START}
  | {type: ReducerActions.TRACE_DONE; payload: WhereUsedEntry[]}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  selectedItem: ProductItem | MaterialItem | null;
  selectedRecipe: RecipeShortDomain | null;
  products: Product[];
  materials: Material[];
  recipes: RecipeShortDomain[];
  isTracing: boolean;
  isLoading: boolean;
  loadingComponents: {
    materials: boolean;
    products: boolean;
    recipes: boolean;
  };
  error: Error | null;
  tracedEntries: WhereUsedEntry[];
  noOfFoundFiles: number;
};

const initialState: State = {
  selectedItem: null,
  selectedRecipe: null,
  products: [],
  materials: [],
  recipes: [],
  isTracing: false,
  isLoading: false,
  loadingComponents: {materials: false, products: false, recipes: false},
  error: null,
  tracedEntries: [],
  noOfFoundFiles: -1,
};

/**
 * Hilfsfunktion: Prüft ob mindestens eine Ladeoperation noch läuft.
 */
const deriveIsLoading = (components: State["loadingComponents"]): boolean =>
  Object.values(components).some(Boolean);

const whereUsedReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.PRODUCTS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, products: true},
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        products: action.payload,
        isLoading: deriveIsLoading({
          ...state.loadingComponents,
          products: false,
        }),
        loadingComponents: {...state.loadingComponents, products: false},
      };
    case ReducerActions.MATERIALS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, materials: true},
      };
    case ReducerActions.MATERIALS_FETCH_SUCCESS:
      return {
        ...state,
        materials: action.payload,
        isLoading: deriveIsLoading({
          ...state.loadingComponents,
          materials: false,
        }),
        loadingComponents: {...state.loadingComponents, materials: false},
      };
    case ReducerActions.RECIPES_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, recipes: true},
      };
    case ReducerActions.RECIPES_FETCH_SUCCESS:
      return {
        ...state,
        recipes: action.payload,
        isLoading: deriveIsLoading({
          ...state.loadingComponents,
          recipes: false,
        }),
        loadingComponents: {...state.loadingComponents, recipes: false},
      };
    case ReducerActions.UPDATE_SELECTION:
      return {...state, ...action.payload};
    case ReducerActions.TRACE_START:
      // Ladebalken anzeigen, vorherige Ergebnisse zurücksetzen
      return {
        ...state,
        isTracing: true,
        tracedEntries: initialState.tracedEntries,
        noOfFoundFiles: initialState.noOfFoundFiles,
      };
    case ReducerActions.TRACE_DONE:
      return {
        ...state,
        isTracing: false,
        tracedEntries: action.payload,
        noOfFoundFiles: action.payload.length,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return state;
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isTracing: false,
        error: action.payload,
      };
    default:
      // Sollte nie auftreten — alle Aktionen sind abgedeckt
      throw new Error("Unbekannter ReducerAction-Typ");
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für den Verwendungsnachweis (Where-Used).
 *
 * Ermöglicht die Suche nach Referenzen eines Produkts, Materials oder
 * Rezepts in der gesamten Datenbank. Der Benutzer wählt ein Produkt/Material
 * aus der Autocomplete-Liste oder gibt eine Rezept-UID ein und erhält
 * eine Liste aller Fundstellen.
 *
 * @returns React-Komponente für die Where-Used-Seite.
 */
const WhereUsedPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const [searchParams, setSearchParams] = useSearchParams();

  const [state, dispatch] = React.useReducer(whereUsedReducer, initialState);

  // Verhindert doppeltes Wiederherstellen aus URL-Parametern
  const restoredFromUrl = useRef(false);

  /* ------------------------------------------
  // Produkte laden
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.PRODUCTS_FETCH_INIT});
    database.products
      .getAllProducts()
      .then((result) => {
        // Domain-Objekte auf Product-Klasse casten (strukturell kompatibel)
        dispatch({
          type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
          payload: result as unknown as Product[],
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  /* ------------------------------------------
  // Materialien laden
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.MATERIALS_FETCH_INIT});
    database.materials
      .getAllMaterials()
      .then((result) => {
        // Domain-Objekte auf Material-Klasse casten (strukturell kompatibel)
        dispatch({
          type: ReducerActions.MATERIALS_FETCH_SUCCESS,
          payload: result as unknown as Material[],
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  /* ------------------------------------------
  // Rezepte laden
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.RECIPES_FETCH_INIT});
    database.recipes
      .getAllRecipeShorts()
      .then((result) => {
        dispatch({
          type: ReducerActions.RECIPES_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  /* ------------------------------------------
  // Felder aktualisieren
  // ------------------------------------------ */
  const onFieldUpdate = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | MaterialItem | ProductItem | null,
    action?: AutocompleteChangeReason,
  ) => {
    let updatedValues: Partial<Pick<State, "selectedItem" | "selectedRecipe">> =
      {};
    switch (event.target.id.split("_")[0]) {
      case "item":
        if (action === "blur" && typeof newValue === "string") {
          // Der Blur bringt nur den Text-Eintrag
          // --> nicht das Objekt, daher Abbruch
          return;
        }
        updatedValues = {
          selectedItem: newValue as ProductItem | MaterialItem | null,
        };
        break;
      default:
        if (action === "clear") {
          // Autocomplete wurde gelöscht
          updatedValues = {
            selectedItem: null,
          };
        } else {
          return;
        }
    }

    dispatch({type: ReducerActions.UPDATE_SELECTION, payload: updatedValues});
  };

  /** Callback für die Rezept-Autocomplete-Auswahl. */
  const onRecipeChange = (
    _event: React.SyntheticEvent,
    newValue: RecipeShortDomain | null,
  ) => {
    dispatch({
      type: ReducerActions.UPDATE_SELECTION,
      payload: {selectedRecipe: newValue},
    });
  };

  /* ------------------------------------------
  // Objekttyp aus der Auswahl ableiten
  // ------------------------------------------ */
  const deriveItemType = (): WhereUsedItemType | null => {
    if (state.selectedRecipe) {
      return "recipe";
    }
    if (state.selectedItem?.itemType === ItemType.food) {
      return "product";
    }
    if (state.selectedItem?.itemType === ItemType.material) {
      return "material";
    }
    return null;
  };

  /* ------------------------------------------
  // Verwendungsnachweis starten
  // ------------------------------------------ */

  /**
   * Führt den Trace aus und schreibt die Suchparameter in die URL.
   * Bei Back-Navigation werden diese Parameter ausgelesen und die Suche
   * automatisch wiederholt.
   */
  const runTrace = useCallback(
    async (itemId: string, itemType: WhereUsedItemType) => {
      dispatch({type: ReducerActions.TRACE_START});

      // Suchparameter in URL schreiben (replace, um History nicht aufzublähen)
      setSearchParams({itemId, itemType}, {replace: true});

      try {
        const entries = await database.adminOps.whereUsed(itemId, itemType);
        dispatch({type: ReducerActions.TRACE_DONE, payload: entries});
      } catch (error) {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      }
    },
    [database.adminOps, setSearchParams],
  );

  const onStartTrace = async () => {
    const itemId = state.selectedRecipe
      ? state.selectedRecipe.uid
      : (state.selectedItem?.uid ?? "");

    const itemType = deriveItemType();

    if (!itemId || !itemType) {
      return;
    }

    await runTrace(itemId, itemType);
  };

  /* ------------------------------------------
  // URL-Parameter restaurieren (Back-Navigation)
  // ------------------------------------------ */
  React.useEffect(() => {
    if (restoredFromUrl.current || state.isLoading) {
      return;
    }

    const urlItemId = searchParams.get("itemId");
    const urlItemType = searchParams.get("itemType") as WhereUsedItemType | null;

    if (!urlItemId || !urlItemType) {
      return;
    }

    restoredFromUrl.current = true;

    // Auswahl im Autocomplete wiederherstellen
    if (urlItemType === "recipe") {
      const recipe = state.recipes.find((recipe) => recipe.uid === urlItemId);
      if (recipe) {
        dispatch({
          type: ReducerActions.UPDATE_SELECTION,
          payload: {selectedRecipe: recipe},
        });
      }
    } else if (urlItemType === "product") {
      const product = state.products.find((product) => product.uid === urlItemId);
      if (product) {
        dispatch({
          type: ReducerActions.UPDATE_SELECTION,
          payload: {selectedItem: {...product, itemType: ItemType.food} as ProductItem},
        });
      }
    } else if (urlItemType === "material") {
      const material = state.materials.find((material) => material.uid === urlItemId);
      if (material) {
        dispatch({
          type: ReducerActions.UPDATE_SELECTION,
          payload: {selectedItem: {...material, itemType: ItemType.material} as MaterialItem},
        });
      }
    }

    // Trace automatisch starten
    runTrace(urlItemId, urlItemType);
  }, [state.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_TRACE}
        subTitle={TEXT_WHERE_ARE_YOUR}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          {state.isLoading ? (
            <Skeleton />
          ) : (
            <SearchPanel
              products={state.products}
              materials={state.materials}
              recipes={state.recipes}
              selectedItem={state.selectedItem}
              selectedRecipe={state.selectedRecipe}
              isTracing={state.isTracing}
              onStartTrace={onStartTrace}
              onFieldUpdate={onFieldUpdate}
              onRecipeChange={onRecipeChange}
            />
          )}
          {state.noOfFoundFiles >= 0 && (
            <ResultPanel entries={state.tracedEntries} />
          )}
        </Stack>
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// =========================== Panel Suche ===========================
// =================================================================== */

/**
 * Props für das Such-Panel.
 *
 * @param products - Verfügbare Produkte für die Autocomplete-Auswahl.
 * @param materials - Verfügbare Materialien für die Autocomplete-Auswahl.
 * @param recipes - Verfügbare Rezepte für die Autocomplete-Auswahl.
 * @param selectedItem - Aktuell ausgewähltes Produkt oder Material.
 * @param selectedRecipe - Ausgewähltes Rezept (oder null).
 * @param isTracing - Ob gerade eine Suche läuft.
 * @param onFieldUpdate - Callback bei Änderungen am Produkt/Material-Feld.
 * @param onRecipeChange - Callback bei Änderungen am Rezept-Feld.
 * @param onStartTrace - Callback zum Starten der Suche.
 */
type SearchPanelProps = {
  products: Product[];
  materials: Material[];
  recipes: RecipeShortDomain[];
  selectedItem: ProductItem | MaterialItem | null;
  selectedRecipe: RecipeShortDomain | null;
  isTracing: boolean;
  onFieldUpdate: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | MaterialItem | ProductItem | null,
  ) => void;
  onRecipeChange: (
    event: React.SyntheticEvent,
    newValue: RecipeShortDomain | null,
  ) => void;
  onStartTrace: () => void;
};

const SearchPanel = ({
  products,
  materials,
  recipes,
  selectedItem,
  selectedRecipe,
  isTracing,
  onFieldUpdate,
  onRecipeChange,
  onStartTrace,
}: SearchPanelProps) => {
  const classes = useCustomStyles();

  // Genau eine Auswahl muss gesetzt sein (Produkt/Material ODER Rezept)
  const hasItemSelected = !!selectedItem && selectedItem.uid !== "";
  const hasRecipeSelected = !!selectedRecipe;
  const canTrace =
    (hasItemSelected || hasRecipeSelected) &&
    !(hasItemSelected && hasRecipeSelected);

  return (
    <Card sx={classes.card} key={"cardProduct"}>
      <CardContent sx={classes.cardContent} key={"cardContentProduct"}>
        <Stack spacing={2}>
          <Typography gutterBottom={true} variant="h5" component="h2">
            {TEXT_WHERE_USED}
          </Typography>

          <ItemAutocomplete
            componentKey="item"
            materials={materials}
            products={products}
            item={selectedItem}
            disabled={false}
            onChange={onFieldUpdate}
            error={{isError: false, errorText: ""}}
            allowCreateNewItem={false}
            size={TextFieldSize.medium}
          />
          <Divider>{TEXT_OR.toLocaleUpperCase()}</Divider>
          <Autocomplete
            id="recipe"
            options={recipes}
            getOptionLabel={(option) => option.name}
            value={selectedRecipe}
            onChange={onRecipeChange}
            renderOption={(props, option) => (
              <li {...props} key={option.uid}>
                <ListItemText
                  primary={option.name}
                  secondary={option.uid}
                  slotProps={{
                    secondary: {
                      variant: "caption",
                      color: "text.secondary",
                    },
                  }}
                />
              </li>
            )}
            isOptionEqualToValue={(option, value) => option.uid === value.uid}
            renderInput={(params) => (
              <TextField {...params} label={TEXT_RECIPE} />
            )}
          />
          <Button
            disabled={!canTrace}
            fullWidth
            variant="contained"
            color="primary"
            onClick={onStartTrace}
            component="span"
          >
            {TEXT_START_TRACE}
          </Button>
          {isTracing && <LinearProgress />}
        </Stack>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// =========================== Panel Ergebnis =========================
// =================================================================== */

/**
 * Zuordnung von Tabellennamen zu menschenlesbaren Gruppentiteln und Icons.
 */
const TABLE_GROUP_CONFIG: Record<
  string,
  {label: string; icon: React.ReactElement}
> = {
  recipe_ingredients: {label: "Rezepte (Zutaten)", icon: <FastfoodIcon />},
  recipe_materials: {label: "Rezepte (Material)", icon: <BuildIcon />},
  event_shopping_list_items: {
    label: "Einkaufslisten",
    icon: <ShoppingCartIcon />,
  },
  event_material_list_items: {label: "Materiallisten", icon: <BuildIcon />},
  event_menue_products: {
    label: "Menüpläne (Produkte)",
    icon: <RestaurantIcon />,
  },
  event_menue_materials: {
    label: "Menüpläne (Material)",
    icon: <RestaurantIcon />,
  },
  event_menue_recipes: {label: "Menüpläne (Rezepte)", icon: <RestaurantIcon />},
  unit_conversion_products: {
    label: "Einheitenumrechnungen",
    icon: <SwapHorizIcon />,
  },
  recipe_variants: {label: "Varianten", icon: <AccountTreeIcon />},
  recipe_original: {label: "Original-Rezept", icon: <AccountTreeIcon />},
};

/**
 * Gruppiert Einträge nach table_name.
 *
 * @param entries Flache Liste aller Fundstellen.
 * @returns Map: table_name → Einträge.
 */
const groupByTable = (
  entries: WhereUsedEntry[],
): Map<string, WhereUsedEntry[]> => {
  const groups = new Map<string, WhereUsedEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.table_name) ?? [];
    existing.push(entry);
    groups.set(entry.table_name, existing);
  }
  return groups;
};

/**
 * Props für das Ergebnis-Panel.
 *
 * @param entries Gefundene Verwendungsstellen aus der Datenbank.
 */
type ResultPanelProps = {
  entries: WhereUsedEntry[];
};

/**
 * Zeigt die Ergebnisse des Verwendungsnachweises gruppiert nach Tabelle an.
 *
 * Jede Gruppe wird als eigene Card dargestellt. Die Einträge zeigen den
 * Namen des Rezepts/Events als Primärtext und die UID als Sekundärtext.
 * Klickbare Einträge navigieren zum jeweiligen Rezept oder Event.
 */
const ResultPanel = ({entries}: ResultPanelProps) => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  /** Navigiert zum übergeordneten Objekt (Rezept oder Event). */
  const handleNavigate = useCallback(
    (entry: WhereUsedEntry) => {
      if (entry.table_name === "unit_conversion_products") {
        navigate(`${ROUTE_UNITCONVERSION}?tab=product`);
      } else if (entry.parent_type === "recipe") {
        navigate(`${ROUTE_RECIPE}/${entry.parent_id}`);
      } else if (entry.parent_type === "event") {
        // Tab-Parameter für Deep-Link auf den passenden Event-Tab
        const tabParam = TAB_PARAM_BY_TABLE[entry.table_name] ?? "";
        const query = tabParam ? `?tab=${tabParam}` : "";
        // Bei Einkaufslisten zusätzlich die Listen-ID übergeben
        const listParam = entry.list_id ? `&listId=${entry.list_id}` : "";
        navigate(`${ROUTE_EVENT}/${entry.parent_id}${query}${listParam}`);
      }
    },
    [navigate],
  );

  const grouped = groupByTable(entries);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        {`${TEXT_FOUND_REFERENCES}: ${entries.length}`}
      </Typography>

      {Array.from(grouped.entries()).map(([tableName, tableEntries]) => {
        const config = TABLE_GROUP_CONFIG[tableName] ?? {
          label: tableName,
          icon: <EventIcon />,
        };
        const isNavigable =
          tableEntries[0]?.parent_type === "recipe" ||
          tableEntries[0]?.parent_type === "event" ||
          tableName === "unit_conversion_products";

        return (
          <Card sx={classes.card} key={tableName}>
            <CardHeader
              avatar={config.icon}
              title={config.label}
              action={
                <Chip
                  label={tableEntries.length}
                  size="small"
                  color="primary"
                />
              }
            />
            <CardContent sx={{pt: 0}}>
              <List dense disablePadding>
                {tableEntries.map((entry, index) =>
                  isNavigable ? (
                    <ListItemButton
                      key={`${tableName}_${index}`}
                      divider={index < tableEntries.length - 1}
                      onClick={() => handleNavigate(entry)}
                    >
                      <ListItemText
                        primary={entry.context}
                        secondary={entry.parent_id}
                      />
                      <ListItemIcon sx={{minWidth: "auto"}}>
                        <OpenInNewIcon fontSize="small" color="action" />
                      </ListItemIcon>
                    </ListItemButton>
                  ) : (
                    <ListItem
                      key={`${tableName}_${index}`}
                      divider={index < tableEntries.length - 1}
                    >
                      <ListItemText
                        primary={entry.context}
                        secondary={entry.record_id}
                      />
                    </ListItem>
                  ),
                )}
              </List>
            </CardContent>
          </Card>
        );
      })}

      {entries.length === 0 && (
        <Card sx={classes.card}>
          <CardContent>
            <Typography color="textSecondary" align="center">
              Keine Verwendung gefunden.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default WhereUsedPage;
