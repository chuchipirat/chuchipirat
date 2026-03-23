import React, {SyntheticEvent} from "react";
import * as Sentry from "@sentry/react";

import {
  Backdrop,
  CircularProgress,
  Container,
  Typography,
  Card,
  CardContent,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  IconButton,
  useTheme,
  Box,
  SnackbarCloseReason,
} from "@mui/material";

import {
  DEPARTMENT as TEXT_DEPARTMENT,
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  PRODUCTS as TEXT_PRODUCTS,
  NOTHING_WORKS_WITHOUT_US as TEXT_NOTHING_WORKS_WITHOUT_US,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  CANCEL as TEXT_CANCEL,
  UID as TEXT_UID,
  // PRODUCT as TEXT_PRODUCT,
  SHOPPING_UNIT as TEXT_SHOPPING_UNIT,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  DIET as TEXT_DIET,
  USABLE as TEXT_USABLE,
  // IS_MEAT as TEXT_IS_MEAT,
  // IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  // IS_VEGAN as TEXT_IS_VEGAN,
  FROM as TEXT_FROM,
  NAME as TEXT_NAME,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  CHOOSE_MATERIAL_TYPE as TEXT_CHOOSE_MATERIAL_TYPE,
  MATERIAL_TYPE as TEXT_MATERIAL_TYPE,
  PRODUCT_CONVERTED_TO_MATERIAL as TEXT_PRODUCT_CONVERTED_TO_MATERIAL,
  OPEN as TEXT_OPEN,
  DIET_TYPES as TEXT_DIET_TYPES,
  SHOW_ALL_PRODUCTS as TEXT_SHOW_ALL_PRODUCTS,
  SHOW_ONLY_NEWEST_PRODUCTS as TEXT_SHOW_ONLY_NEWEST_PRODUCTS,
  NO_NEWEST_PRODUCTS_FOUND as TEXT_NO_NEWEST_PRODUCTS_FOUND,
  CONVERT_TO_MATERIAL as TEXT_CONVERT_TO_MATERIAL,
} from "../../constants/text";
import {Role as Roles} from "../../constants/roles";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";
import {DialogProduct, ProductDialog} from "./dialogProduct";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Cached as CachedIcon,
} from "@mui/icons-material";

import {CustomSnackbar, SnackbarState} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";

import {SearchPanel} from "../Shared/searchPanel";

import {Product, Allergen, Diet, createEmptyDietProperty} from "./product.types";
import {Unit, UnitDimension} from "../Unit/unit.class";
import Department from "../Department/department.class";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {Material, MaterialType} from "../Material/material.types";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../Shared/customDialogContext";
import {useAuthUser} from "../Session/authUserContext";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import {DataGrid, GridColDef, gridClasses} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import {ProductDomain} from "../Database/Repository/ProductRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  PRODUCTS_FETCH_INIT,
  PRODUCTS_FETCH_SUCCESS,
  PRODUCT_UPDATED,
  PRODUCTS_SAVED,
  PRODUCTS_EDIT_CANCELLED,
  NEWEST_PRODUCTS_FETCH_INIT,
  NEWEST_PRODUCTS_FETCH_SUCCESS,
  NEWEST_PRODUCTS_CLEAR,
  PRODUCT_CONVERTED_TO_MATERIAL,
  DEPARTMENT_FETCH_INIT,
  DEPARTMENTS_FETCH_SUCCESS,
  UNITS_FETCH_INIT,
  UNITS_FETCH_SUCCESS,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

/**
 * Diskriminierte Union für alle Reducer-Actions der ProductsPage.
 */
type ReducerAction =
  | {type: ReducerActions.PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.PRODUCT_UPDATED; payload: Product}
  | {type: ReducerActions.PRODUCTS_SAVED}
  | {type: ReducerActions.PRODUCTS_EDIT_CANCELLED; payload: Product[]}
  | {type: ReducerActions.NEWEST_PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.NEWEST_PRODUCTS_FETCH_SUCCESS; payload: string[]}
  | {type: ReducerActions.NEWEST_PRODUCTS_CLEAR}
  | {type: ReducerActions.PRODUCT_CONVERTED_TO_MATERIAL; payload: Product}
  | {type: ReducerActions.DEPARTMENT_FETCH_INIT}
  | {type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS; payload: Department[]}
  | {type: ReducerActions.UNITS_FETCH_INIT}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: SnackbarState["severity"]; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/**
 * Zustand der ProductsPage.
 *
 * @param products - Aktuelle Produktliste (Bearbeitungsstand)
 * @param changedUids - UIDs der seit dem letzten Speichern geänderten Produkte
 * @param departments - Geladene Abteilungen (nur im Edit-Modus)
 * @param units - Geladene Einheiten (nur im Edit-Modus)
 * @param newestProductUids - UIDs der in den letzten N Tagen angelegten Produkte
 * @param error - Letzter aufgetretener Fehler
 * @param isLoading - Ladezustände pro Ressource
 * @param snackbar - Zustand der Erfolgsmeldung
 */
type State = {
  products: Product[];
  changedUids: Set<string>;
  departments: Department[];
  units: Unit[];
  newestProductUids: string[];
  error: Error | null;
  isLoading: {
    overall: boolean;
    products: boolean;
    units: boolean;
    departments: boolean;
  };
  snackbar: SnackbarState;
};

const initialState: State = {
  products: [],
  changedUids: new Set<string>(),
  departments: [],
  units: [],
  newestProductUids: [],
  error: null,
  isLoading: {
    overall: false,
    products: false,
    units: false,
    departments: false,
  },
  snackbar: {open: false, severity: "success", message: ""},
};

/**
 * Berechnet den overall-Ladezustand anhand der Teilzustände, ohne den
 * bestehenden Zustand zu mutieren.
 * Das overall-Flag selbst wird aus der Berechnung ausgeschlossen,
 * da es das Ergebnis dieser Funktion ist und nicht als Eingabe zählt.
 *
 * @param isLoading - Vollständiger isLoading-Zustand (overall wird ignoriert)
 * @param changedField - Das Feld, dessen Wert sich ändert
 * @param newValue - Neuer Wert für changedField
 * @returns true, wenn mindestens ein Teilzustand noch aktiv ist
 */
const computeOverallLoading = (
  isLoading: State["isLoading"],
  changedField: keyof Omit<State["isLoading"], "overall">,
  newValue: boolean,
): boolean => {
  // overall wird bewusst ausgeschlossen — es ist das Ergebnis, kein Eingang
  const {overall: _overall, ...rest} = isLoading;
  const updated = {...rest, [changedField]: newValue};
  return Object.values(updated).some((value) => value === true);
};

const productsReducer = (state: State, action: ReducerAction): State => {
  switch (action.type) {
    case ReducerActions.PRODUCTS_FETCH_INIT:
      // Daten werden geladen
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          products: true,
        },
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      // Produkte erfolgreich geladen — changedUids zurücksetzen
      return {
        ...state,
        products: action.payload,
        changedUids: new Set<string>(),
        isLoading: {
          ...state.isLoading,
          overall: computeOverallLoading(state.isLoading, "products", false),
          products: false,
        },
      };
    case ReducerActions.PRODUCT_UPDATED: {
      // Einzelnes Produkt immutabel ersetzen und UID als geändert markieren
      const updated = state.products.map((product) =>
        product.uid === action.payload.uid ? action.payload : product,
      );
      const changedUids = new Set(state.changedUids);
      changedUids.add(action.payload.uid);
      return {...state, products: updated, changedUids};
    }
    case ReducerActions.PRODUCTS_SAVED:
      return {
        ...state,
        changedUids: new Set<string>(),
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
        },
      };
    case ReducerActions.PRODUCTS_EDIT_CANCELLED:
      // Snapshot wiederherstellen und changedUids leeren
      return {
        ...state,
        products: action.payload,
        changedUids: new Set<string>(),
      };
    case ReducerActions.DEPARTMENT_FETCH_INIT:
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          departments: true,
        },
      };
    case ReducerActions.DEPARTMENTS_FETCH_SUCCESS:
      // Abteilungen erfolgreich geladen
      return {
        ...state,
        departments: action.payload,
        isLoading: {
          ...state.isLoading,
          overall: computeOverallLoading(state.isLoading, "departments", false),
          departments: false,
        },
      };
    case ReducerActions.UNITS_FETCH_INIT:
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          units: true,
        },
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      // Einheiten erfolgreich geladen
      return {
        ...state,
        units: action.payload,
        isLoading: {
          ...state.isLoading,
          overall: computeOverallLoading(state.isLoading, "units", false),
          units: false,
        },
      };
    case ReducerActions.NEWEST_PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: {...state.isLoading, overall: false},
        newestProductUids: action.payload,
      };
    case ReducerActions.NEWEST_PRODUCTS_FETCH_INIT:
      return {...state, isLoading: {...state.isLoading, overall: true}};
    case ReducerActions.NEWEST_PRODUCTS_CLEAR:
      return {...state, newestProductUids: []};
    case ReducerActions.PRODUCT_CONVERTED_TO_MATERIAL:
      // Konvertiertes Produkt aus Liste entfernen
      return {
        ...state,
        products: state.products.filter(
          (product) => product.uid !== action.payload.uid,
        ),
        snackbar: {
          severity: "success",
          open: true,
          message: TEXT_PRODUCT_CONVERTED_TO_MATERIAL(action.payload.name),
        },
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        isLoading: {...state.isLoading, overall: false},
        snackbar: {
          severity: action.payload.severity,
          message: action.payload.message,
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      // Snackbar schliessen
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    case ReducerActions.GENERIC_ERROR:
      // allgemeiner Fehler
      return {
        ...state,
        error: action.payload,
        isLoading: {...state.isLoading, overall: false},
      };
    default: {
      const _: never = action;
      throw new Error(`Unbekannter ActionType: ${JSON.stringify(_)}`);
    }
  }
};

const PRODUCT_POPUP_VALUES = {
  productName: "",
  productUid: "",
  department: {name: "", uid: ""},
  shoppingUnit: {key: "", name: "", dimension: UnitDimension.dimensionless},
  usable: false,
  popUpOpen: false,
  dietProperties: createEmptyDietProperty(),
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptseite für die Produkt-/Zutaten-Verwaltung.
 * Lädt Produkte aus Supabase und ermöglicht Bearbeiten, selektives Speichern
 * und Konvertierung zu Material.
 */
const ProductsPage = () => {
  // firebase wird nur noch für onConvertProductToMaterial (Cloud-FX) benötigt
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(productsReducer, initialState);
  const [editMode, setEditMode] = React.useState(false);
  // Snapshot für Cancel: Deep-Copy der Produkte vor dem Bearbeitungsbeginn
  const productsSnapshot = React.useRef<Product[]>([]);

  /* ------------------------------------------
	// Daten aus DB holen
	// ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.PRODUCTS_FETCH_INIT});
    database.products
      .getAllProducts({onlyUsable: false, withDepartmentName: true})
      .then((result) => {
        dispatch({
          type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error, {extra: {context: "Produkte laden"}});
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error,
        });
      });
  }, []);

  React.useEffect(() => {
    if (editMode) {
      if (state.departments.length === 0) {
        dispatch({type: ReducerActions.DEPARTMENT_FETCH_INIT});
        database.departments
          .getAllDepartments()
          .then((result) => {
            dispatch({
              type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS,
              payload: result,
            });
          })
          .catch((error) => {
            Sentry.captureException(error, {extra: {context: "Abteilungen laden"}});
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      if (state.units.length === 0) {
        dispatch({type: ReducerActions.UNITS_FETCH_INIT});
        database.units
          .getAllUnits()
          .then((result) => {
            // leeres Feld gehoert auch dazu
            result.push({
              uid: "",
              key: "",
              name: "",
              dimension: UnitDimension.dimensionless,
            });

            dispatch({
              type: ReducerActions.UNITS_FETCH_SUCCESS,
              payload: result,
            });
          })
          .catch((error) => {
            Sentry.captureException(error, {extra: {context: "Einheiten laden"}});
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
    }
  }, [editMode]);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
	// Edit Mode wechseln
	// ------------------------------------------ */
  const onEditClick = () => {
    // Snapshot erstellen, damit Cancel die Originalwerte wiederherstellen kann
    productsSnapshot.current = state.products.map((product) => ({
      ...product,
      dietProperties: {
        ...product.dietProperties,
        allergens: [...product.dietProperties.allergens],
      },
    }));
    setEditMode(true);
  };

  const onCancelClick = () => {
    dispatch({
      type: ReducerActions.PRODUCTS_EDIT_CANCELLED,
      payload: productsSnapshot.current,
    });
    setEditMode(false);
  };

  /* ------------------------------------------
  // Selektives Speichern (nur geänderte Produkte)
  // ------------------------------------------ */
  const onSave = async () => {
    const changedProducts = state.products.filter((product) =>
      state.changedUids.has(product.uid),
    );
    if (changedProducts.length === 0) {
      return;
    }
    try {
      for (const product of changedProducts) {
        // Product → ProductDomain: nameSingular mit Name belegen (Tech-Debt: Typ-Vereinheitlichung)
        await database.products.updateProduct(
          {...product, nameSingular: product.name},
          authUser,
        );
      }
      dispatch({type: ReducerActions.PRODUCTS_SAVED});
      setEditMode(false);
    } catch (error) {
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Produkt-Änderung aus Unterkomponente
  // ------------------------------------------ */
  const onProductChange = (product: Product) => {
    dispatch({type: ReducerActions.PRODUCT_UPDATED, payload: product});
  };

  /**
   * Schaltet die Ansicht der neuesten Produkte ein oder aus.
   * Beim ersten Aufruf werden die UIDs der in den letzten 10 Tagen
   * angelegten Produkte aus Supabase geladen. Beim zweiten Aufruf
   * wird die Filterung zurückgesetzt und alle Produkte wieder angezeigt.
   */
  const loadNewestProducts = () => {
    if (state.newestProductUids.length === 0) {
      dispatch({type: ReducerActions.NEWEST_PRODUCTS_FETCH_INIT});
      database.products
        .getRecentProductUids(10)
        .then((result) => {
          if (result.length > 0) {
            dispatch({
              type: ReducerActions.NEWEST_PRODUCTS_FETCH_SUCCESS,
              payload: result,
            });
          } else {
            dispatch({
              type: ReducerActions.SNACKBAR_SHOW,
              payload: {
                severity: "info",
                message: TEXT_NO_NEWEST_PRODUCTS_FOUND,
              },
            });
          }
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error as Error,
          });
        });
    } else {
      // Filterung zurücksetzen, damit alle Produkte wieder angezeigt werden
      dispatch({type: ReducerActions.NEWEST_PRODUCTS_CLEAR});
    }
  };

  const onConvertProductToMaterial = async (product: Product) => {
    // Fragen welcher Material-Typ gesetzt werden soll?
    const userInput = (await customDialog({
      dialogType: DialogType.SelectOptions,
      title: TEXT_MATERIAL_TYPE,
      text: TEXT_CHOOSE_MATERIAL_TYPE,
      singleTextInputProperties: {
        initialValue: "",
        textInputLabel: TEXT_NAME,
      },
      options: [
        {key: MaterialType.usage, text: TEXT_MATERIAL_TYPE_USAGE},
        {key: MaterialType.consumable, text: TEXT_MATERIAL_TYPE_CONSUMABLE},
      ],
    })) as SingleTextInputResult;

    if (userInput.valid) {
      // Materialtyp-Zuordnung: 1 = consumable, 2 = usage
      const materialTypeMap: Record<number, string> = {
        [MaterialType.consumable]: "consumable",
        [MaterialType.usage]: "usage",
      };
      const materialType = materialTypeMap[parseInt(userInput.input)] ?? "consumable";

      database.adminOps
        .convertProductToMaterial(product.uid, materialType)
        .then(() => {
          dispatch({
            type: ReducerActions.PRODUCT_CONVERTED_TO_MATERIAL,
            payload: product,
          });
        });
    }
  };

  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    event: Event | SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_PRODUCTS}
        subTitle={TEXT_NOTHING_WORKS_WITHOUT_US}
      />
      <ProductsButtonRow
        editMode={editMode}
        onEdit={onEditClick}
        onSave={onSave}
        onCancel={onCancelClick}
        onLoadNewestProducts={loadNewestProducts}
        showLoadNewestProducts={state.newestProductUids.length === 0}
        authUser={authUser}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading.overall}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {state.error && (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}
        <ProductsTable
          editMode={editMode}
          products={state.products}
          departments={state.departments}
          units={state.units}
          newestProductUids={state.newestProductUids}
          onProductChange={onProductChange}
          onConvertProductToMaterial={onConvertProductToMaterial}
          authUser={authUser}
        />
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={handleSnackbarClose}
        />
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ============================ Buttons ==============================
// =================================================================== */
/**
 * Props für die Schaltflächen-Zeile der Produkt-Seite.
 *
 * @param editMode - Gibt an, ob der Bearbeitungsmodus aktiv ist
 * @param onEdit - Callback zum Aktivieren des Bearbeitungsmodus
 * @param onCancel - Callback zum Abbrechen und Verwerfen der Änderungen
 * @param onSave - Callback zum Speichern der Änderungen
 * @param onLoadNewestProducts - Callback zum Umschalten der Neueste-Produkte-Ansicht
 * @param showLoadNewestProducts - true wenn «Neueste anzeigen» sichtbar sein soll
 * @param authUser - Angemeldeter Benutzer (für Rollenprüfung)
 */
interface ProductsButtonRowProps {
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onLoadNewestProducts: () => void;
  showLoadNewestProducts: boolean;
  authUser: AuthUser;
}

/**
 * Schaltflächen-Zeile für die Produkt-Seite.
 * Zeigt je nach Modus Edit/Save/Cancel-Buttons und den Neueste-Produkte-Toggle.
 */
const ProductsButtonRow = ({
  editMode,
  onEdit,
  onCancel,
  onSave,
  onLoadNewestProducts,
  showLoadNewestProducts,
  authUser,
}: ProductsButtonRowProps) => {
  return (
    <ButtonRow
      key="action_buttons"
      buttons={[
        {
          id: "edit",
          hero: true,
          visible:
            !editMode &&
            (authUser.roles.includes(Roles.communityLeader) ||
              authUser.roles.includes(Roles.admin)),
          label: TEXT_EDIT,
          variant: "contained",
          color: "primary",
          onClick: onEdit,
        },
        {
          id: "newestProducts",
          hero: true,
          visible: showLoadNewestProducts,
          label: TEXT_SHOW_ONLY_NEWEST_PRODUCTS,
          variant: "outlined",
          color: "primary",
          onClick: onLoadNewestProducts,
        },
        {
          id: "showAll",
          hero: true,
          visible: !showLoadNewestProducts,
          label: TEXT_SHOW_ALL_PRODUCTS,
          variant: "outlined",
          color: "primary",
          onClick: onLoadNewestProducts,
        },
        {
          id: "save",
          hero: true,
          visible: editMode,
          label: TEXT_SAVE,
          variant: "contained",
          color: "primary",
          onClick: onSave,
        },
        {
          id: "cancel",
          hero: true,
          visible: editMode,
          label: TEXT_CANCEL,
          variant: "outlined",
          color: "primary",
          onClick: onCancel,
        },
      ]}
    />
  );
};

/* ===================================================================
// =========================== Produkte Panel ========================
// =================================================================== */
/**
 * Props für die Produkte-Tabelle.
 *
 * @param products - Aktuelle Produktliste (vom Reducer verwaltet)
 * @param departments - Verfügbare Abteilungen (für Dialog und Anzeige)
 * @param units - Verfügbare Einheiten (für Dialog und Anzeige)
 * @param newestProductUids - UIDs der neuesten Produkte für die Filteransicht
 * @param editMode - Gibt an, ob der Bearbeitungsmodus aktiv ist
 * @param onProductChange - Callback bei Inline-Änderung eines Produkts
 * @param onConvertProductToMaterial - Callback zur Konvertierung eines Produkts
 * @param authUser - Angemeldeter Benutzer
 */
interface ProductsTableProps {
  products: Product[];
  departments: Department[];
  units: Unit[];
  newestProductUids: string[];
  editMode: boolean;
  onProductChange: (product: Product) => void;
  onConvertProductToMaterial: (product: Product) => void;
  authUser: AuthUser;
}

/**
 * UI-Zeile für die Produkte-Tabelle.
 *
 * @param uid - Eindeutige ID des Produkts
 * @param name - Produktname
 * @param departmentName - Name der zugehörigen Abteilung
 * @param shoppingUnit - Einkaufseinheit
 * @param containsLactose - Enthält das Produkt Laktose
 * @param containsGluten - Enthält das Produkt Gluten
 * @param diet - Diät-Klassifikation
 * @param usable - Gibt an, ob das Produkt aktiv ist
 */
interface ProductLineUi {
  uid: Product["uid"];
  name: Product["name"];
  departmentName: Department["name"];
  shoppingUnit: Unit["name"];
  containsLactose: boolean;
  containsGluten: boolean;
  diet: Diet;
  usable: boolean;
}

/**
 * Tabellen-Komponente für die Produkt-Verwaltung.
 * Rendert einen DataGrid mit Such-Panel, Inline-Checkboxen und Kontext-Menü.
 * Die eigentliche Produktliste wird vom übergeordneten Reducer verwaltet.
 */
const ProductsTable = ({
  products,
  departments,
  units,
  newestProductUids,
  editMode,
  onProductChange,
  onConvertProductToMaterial: onConvertProductToMaterialSuper,
  authUser,
}: ProductsTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [productPopUpValues, setProductPopUpValues] =
    React.useState(PRODUCT_POPUP_VALUES);
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    React.useState<HTMLElement | null>(null);
  const [contextMenuProductUid, setContextMenuProductUid] = React.useState("");
  const [paginationModel, setPaginationModel] = React.useState({page: 0, pageSize: 100});

  const classes = useCustomStyles();
  const theme = useTheme();

  /* ------------------------------------------
  // Daten für UI aufbereiten
  // ------------------------------------------ */
  const prepareProductsListForUi = (productList: Product[]): ProductLineUi[] => {
    return productList.map((product) => {
      return {
        uid: product.uid,
        name: product.name,
        departmentName: product.department.name,
        shoppingUnit: product.shoppingUnit,
        containsLactose: product.dietProperties?.allergens?.includes(
          Allergen.Lactose,
        ),
        containsGluten: product.dietProperties?.allergens?.includes(
          Allergen.Gluten,
        ),
        diet: product.dietProperties.diet,
        usable: product.usable,
      };
    });
  };

  /* ------------------------------------------
  // Abgeleitete Listen via useMemo
  // ------------------------------------------ */
  const filteredProducts = React.useMemo(() => {
    let result = searchString
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(searchString.toLowerCase()) ||
            product?.department?.name
              .toLowerCase()
              .includes(searchString.toLowerCase()) ||
            product?.shoppingUnit
              ?.toLowerCase()
              .includes(searchString.toLowerCase()),
        )
      : products;

    if (newestProductUids.length > 0) {
      // Nur Produkte anzeigen, die in den letzten Tagen angelegt wurden
      result = result.filter((product) =>
        newestProductUids.includes(product.uid),
      );
    }
    return result;
  }, [products, searchString, newestProductUids]);

  const filteredProductsUi = React.useMemo(
    () => prepareProductsListForUi(filteredProducts),
    // editMode als Abhaengigkeit, damit die Grid-Zeilen bei Moduswechsel neu rendern
    [filteredProducts, editMode],
  );

  const dataGridColumns: GridColDef[] = React.useMemo(
    () => [
      {
        field: "open",
        headerName: TEXT_OPEN,
        sortable: false,
        renderCell: (params) => {
          const onClick = () => openPopUp(params.id as string);

          return (
            <IconButton
              aria-label="open User"
              sx={{margin: theme.spacing(1)}}
              size="small"
              disabled={!editMode}
              onClick={onClick}
            >
              <EditIcon fontSize="inherit" />
            </IconButton>
          );
        },
      },
      {
        field: "uid",
        headerName: TEXT_UID,
        editable: false,
        width: 200,
        cellClassName: () => `super-app ${classes.typographyCode}`,
      },
      {
        field: "name",
        headerName: TEXT_NAME,
        editable: false,
        width: 200,
      },
      {
        field: "departmentName",
        headerName: TEXT_DEPARTMENT,
        editable: false,
        width: 200,
      },
      {
        field: "shoppingUnit",
        headerName: TEXT_SHOPPING_UNIT,
        editable: false,
        width: 200,
      },
      {
        field: "containsLactose",
        headerName: TEXT_HAS_LACTOSE,
        editable: false,
        width: 200,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_" + Allergen.Lactose + "_" + params.id}
            name={"checkbox_" + Allergen.Lactose + "_" + params.id}
          />
        ),
      },
      {
        field: "containsGluten",
        headerName: TEXT_HAS_GLUTEN,
        editable: false,
        width: 200,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_" + Allergen.Gluten + "_" + params.id}
            name={"checkbox_" + Allergen.Gluten + "_" + params.id}
          />
        ),
      },
      {
        field: "diet",
        headerName: TEXT_DIET,
        editable: false,
        width: 200,
        renderCell: (params) => TEXT_DIET_TYPES[params.value as number],
      },
      {
        field: "usable",
        headerName: TEXT_USABLE,
        editable: false,
        width: 200,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_usable_" + params.id}
            name={"checkbox_usable_" + params.id}
          />
        ),
      },
      {
        field: "context",
        headerName: "",
        editable: false,
        width: 200,
        renderCell: (params) => {
          const onClick = (event: React.MouseEvent<HTMLElement>) =>
            openContextMenu(event, params.id as string);

          return (
            <IconButton
              aria-label="open User"
              sx={{margin: theme.spacing(1)}}
              size="small"
              disabled={!editMode}
              onClick={onClick}
            >
              <MoreVertIcon fontSize="inherit" />
            </IconButton>
          );
        },
      },
    ],
    [editMode, theme],
  );

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const clearSearchString = () => {
    setSearchString("");
  };
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value as string);
  };

  /* ------------------------------------------
  // Checkboxen-Edit (immutabel)
  // ------------------------------------------ */
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parts = event.target.name.split("_");
    const product = products.find((candidate) => candidate.uid === parts[2]);
    if (!product) {
      return;
    }

    if (parts[1] === "usable") {
      onProductChange({...product, usable: event.target.checked});
    } else {
      const allergen = parseInt(parts[1]) as Allergen;
      const current = product.dietProperties.allergens;
      const updated = event.target.checked
        ? [...current, allergen]
        : current.filter((candidate) => candidate !== allergen);
      onProductChange({
        ...product,
        dietProperties: {...product.dietProperties, allergens: updated},
      });
    }
  };

  /* ------------------------------------------
	// Context-Menü
	// ------------------------------------------ */
  const openContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    productUid: Product["uid"],
  ) => {
    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuProductUid(productUid);
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuProductUid("");
  };
  const onConvertProductToMaterial = () => {
    const product = products.find(
      (candidate) => candidate.uid === contextMenuProductUid,
    );
    if (!product) {
      return;
    }
    // Reducer in der Elternkomponente entfernt das Produkt via PRODUCT_CONVERTED_TO_MATERIAL
    onConvertProductToMaterialSuper(product);
    closeContextMenu();
  };

  /* ------------------------------------------
	// PopUp
	// ------------------------------------------ */
  const openPopUp = (productUid: string) => {
    const product = products.find(
      (candidate) => candidate.uid === productUid,
    ) as Product;

    if (!product) {
      return;
    }
    setProductPopUpValues({
      productUid: product.uid,
      productName: product.name,
      department: {
        uid: product.department.uid,
        name: product.department.name,
      },
      shoppingUnit: {
        key: product.shoppingUnit,
        name: "",
        dimension: UnitDimension.dimensionless,
      },
      dietProperties: product.dietProperties,
      usable: product.usable,
      popUpOpen: true,
    });
  };
  const onPopUpClose = () => {
    setProductPopUpValues(PRODUCT_POPUP_VALUES);
  };

  /**
   * Verarbeitet das OK-Event des Produkt-Dialogs (immutabel).
   *
   * @param changedProduct - Das vom Dialog zurückgegebene Produkt
   */
  const onPopUpOk = (changedProduct: Product) => {
    onProductChange({
      ...changedProduct,
      shoppingUnit: changedProduct.shoppingUnit || "",
    });
    setProductPopUpValues(PRODUCT_POPUP_VALUES);
  };

  const onPopUpChooseExisting = () => {
    // Intentionally empty — im EDIT-Modus nicht verwendet
  };

  return (
    <React.Fragment>
      <Card sx={classes.card} key={"requestTablePanel"}>
        <CardContent sx={classes.cardContent} key={"requestTableContent"}>
          <SearchPanel
            searchString={searchString}
            onUpdateSearchString={updateSearchString}
            onClearSearchString={clearSearchString}
          />
          <Typography
            variant="body2"
            sx={{marginTop: "0.5em", marginBottom: "2em"}}
          >
            {filteredProducts.length === products.length
              ? `${products.length} ${TEXT_PRODUCTS}`
              : `${filteredProducts.length} ${TEXT_FROM.toLowerCase()} ${
                  products.length
                } ${TEXT_PRODUCTS}`}
          </Typography>
          <Box sx={{width: "100%"}}>
            <DataGrid
              autoHeight
              rows={filteredProductsUi}
              columns={dataGridColumns}
              columnVisibilityModel={{uid: false}}
              getRowId={(row) => row.uid}
              pagination
              localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
              getRowClassName={(params) => {
                if (params.row?.disabled) {
                  return `super-app ${classes.dataGridDisabled}`;
                } else {
                  return `super-app-theme`;
                }
              }}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              pageSizeOptions={[20, 50, 100]}
              sx={(theme) => ({
                [`.${gridClasses.main}`]: {
                  overflow: "unset",
                },
                [`.${gridClasses.columnHeaders}`]: {
                  position: "sticky",
                  top: 0,
                  backgroundColor: theme.palette.background.paper,
                  zIndex: 1,
                },
                [`.${gridClasses.virtualScroller}`]: {
                  marginTop: "0 !important",
                },
              })}
            />
          </Box>

          <Menu
            open={Boolean(contextMenuAnchorElement)}
            keepMounted
            anchorEl={contextMenuAnchorElement}
            onClose={closeContextMenu}
          >
            <MenuItem onClick={onConvertProductToMaterial}>
              <ListItemIcon>
                <CachedIcon />
              </ListItemIcon>
              <Typography variant="inherit" noWrap>
                {TEXT_CONVERT_TO_MATERIAL}
              </Typography>
            </MenuItem>
          </Menu>
        </CardContent>
      </Card>
      <DialogProduct
        dialogType={ProductDialog.EDIT}
        productUid={productPopUpValues.productUid}
        productName={productPopUpValues.productName}
        productDietProperties={productPopUpValues.dietProperties}
        productUsable={productPopUpValues.usable}
        products={products}
        dialogOpen={productPopUpValues.popUpOpen}
        handleOk={onPopUpOk}
        handleClose={onPopUpClose}
        handleChooseExisting={onPopUpChooseExisting}
        selectedDepartment={
          departments.find(
            (department) =>
              department.uid === productPopUpValues.department.uid,
          )!
        }
        selectedUnit={productPopUpValues.shoppingUnit}
        usable={productPopUpValues.usable}
        departments={departments}
        units={units}
        authUser={authUser}
      />
    </React.Fragment>
  );
};

export {ProductsPage, productsReducer, ReducerActions, initialState};
export type {State, ReducerAction};
