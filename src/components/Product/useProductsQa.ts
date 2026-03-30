/**
 * Custom Hook für die Produkt-QA-Seite.
 *
 * Kapselt den Reducer, die Datenbeschaffung und alle Handler,
 * die die UI-Komponente benötigt. Erweitert die bestehende
 * Produktverwaltung um QA-Tracking, Duplikaterkennung,
 * Bulk-Operationen und Synonym-Management.
 */
import React from "react";
import * as Sentry from "@sentry/react";

import {Product, Allergen, Diet} from "./product.types";
import {SimilarProductPair} from "../Database/Repository/ProductRepository";
import {ProductSynonymDomain} from "../Database/Repository/ProductSynonymRepository";
import {MergeProductsResult} from "../Database/Repository/AdminOperationsRepository";
import Department from "../Department/department.class";
import {Unit} from "../Unit/unit.class";
import {SnackbarState} from "../Shared/customSnackbar";
import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  NO_NEWEST_PRODUCTS_FOUND as TEXT_NO_NEWEST_PRODUCTS_FOUND,
  PRODUCT_CONVERTED_TO_MATERIAL as TEXT_PRODUCT_CONVERTED_TO_MATERIAL,
} from "../../constants/text";
import {DELETE_PRODUCT_SUCCESS as TEXT_DELETE_PRODUCT_SUCCESS} from "../../constants/text/productQa";

/* ===================================================================
// ======================== Reducer-Typen ============================
// =================================================================== */

/**
 * QA-Filter-Status für die Filterleiste.
 */
export type QaFilterStatus = "all" | "checked" | "unchecked";

/**
 * Erkannte Probleme eines Produkts (Auto-Detection).
 *
 * @param productUid - UID des betroffenen Produkts
 * @param issues - Liste der erkannten Probleme als Texte
 */
export type ProductIssue = {
  productUid: string;
  issues: string[];
};

export enum ReducerActions {
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
  // Neue QA-Actions
  QA_TOGGLE,
  BULK_UPDATE,
  DUPLICATES_LOADED,
  DUPLICATES_CLEARED,
  SYNONYM_PAIRS_LOADED,
  PRODUCTS_MERGED,
  SELECTED_PRODUCTS_CHANGED,
  ISSUE_FLAGS_LOADED,
  DUPLICATE_DISMISSED,
  PRODUCT_DELETED,
}

/**
 * Diskriminierte Union für alle Reducer-Actions der ProductsPage.
 */
export type ReducerAction =
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
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  // Neue QA-Actions
  | {type: ReducerActions.QA_TOGGLE; payload: {uid: string; checked: boolean}}
  | {type: ReducerActions.BULK_UPDATE; payload: Product[]}
  | {type: ReducerActions.DUPLICATES_LOADED; payload: SimilarProductPair[]}
  | {type: ReducerActions.DUPLICATES_CLEARED}
  | {type: ReducerActions.SYNONYM_PAIRS_LOADED; payload: ProductSynonymDomain[]}
  | {
      type: ReducerActions.PRODUCTS_MERGED;
      payload: {sourceProductUid: string; result: MergeProductsResult};
    }
  | {type: ReducerActions.SELECTED_PRODUCTS_CHANGED; payload: string[]}
  | {type: ReducerActions.ISSUE_FLAGS_LOADED; payload: ProductIssue[]}
  | {type: ReducerActions.DUPLICATE_DISMISSED; payload: {productAId: string; productBId: string}}
  | {type: ReducerActions.PRODUCT_DELETED; payload: Product};

/**
 * Zustand der ProductsPage.
 */
export type State = {
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
  // Neue QA-Felder
  similarProducts: SimilarProductPair[];
  synonymPairs: ProductSynonymDomain[];
  selectedProductUids: string[];
  issueFlags: ProductIssue[];
};

export const initialState: State = {
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
  similarProducts: [],
  synonymPairs: [],
  selectedProductUids: [],
  issueFlags: [],
};

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Berechnet den overall-Ladezustand anhand der Teilzustände.
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
  const {overall: _overall, ...rest} = isLoading;
  const updated = {...rest, [changedField]: newValue};
  return Object.values(updated).some((value) => value === true);
};

/* ===================================================================
// ======================== Reducer ==================================
// =================================================================== */

export const productsReducer = (state: State, action: ReducerAction): State => {
  switch (action.type) {
    case ReducerActions.PRODUCTS_FETCH_INIT:
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          products: true,
        },
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
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
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: {...state.isLoading, overall: false},
      };

    // ===== Neue QA-Actions =====
    case ReducerActions.QA_TOGGLE: {
      const {uid, checked} = action.payload;
      const updatedProducts = state.products.map((product) =>
        product.uid === uid
          ? {
              ...product,
              qaChecked: checked,
              qaCheckedAt: checked ? new Date().toISOString() : null,
            }
          : product,
      );
      const changedUids = new Set(state.changedUids);
      changedUids.add(uid);
      return {...state, products: updatedProducts, changedUids};
    }
    case ReducerActions.BULK_UPDATE: {
      // Mehrere Produkte auf einmal ersetzen (für Bulk-Aktionen)
      const updatedMap = new Map(
        action.payload.map((product) => [product.uid, product]),
      );
      const updatedProducts = state.products.map(
        (product) => updatedMap.get(product.uid) ?? product,
      );
      const changedUids = new Set(state.changedUids);
      action.payload.forEach((product) => changedUids.add(product.uid));
      return {...state, products: updatedProducts, changedUids};
    }
    case ReducerActions.DUPLICATES_LOADED:
      return {...state, similarProducts: action.payload};
    case ReducerActions.DUPLICATES_CLEARED:
      return {...state, similarProducts: []};
    case ReducerActions.SYNONYM_PAIRS_LOADED:
      return {...state, synonymPairs: action.payload};
    case ReducerActions.PRODUCTS_MERGED: {
      // Quellprodukt aus der Liste entfernen nach Merge
      const filteredProducts = state.products.filter(
        (product) => product.uid !== action.payload.sourceProductUid,
      );
      // Duplikate-Liste bereinigen (Paare mit dem entfernten Produkt)
      const filteredSimilar = state.similarProducts.filter(
        (pair) =>
          pair.product_a_id !== action.payload.sourceProductUid &&
          pair.product_b_id !== action.payload.sourceProductUid,
      );
      return {
        ...state,
        products: filteredProducts,
        similarProducts: filteredSimilar,
        selectedProductUids: [],
        snackbar: {
          open: true,
          severity: "success",
          message: `Produkte zusammengeführt. ${action.payload.result.recipe_ingredients} Rezeptzutaten, ${action.payload.result.shopping_list_items} Einkaufslisteneinträge, ${action.payload.result.menue_products} Menüplan-Einträge aktualisiert.`,
        },
      };
    }
    case ReducerActions.SELECTED_PRODUCTS_CHANGED:
      return {...state, selectedProductUids: action.payload};
    case ReducerActions.ISSUE_FLAGS_LOADED:
      return {...state, issueFlags: action.payload};
    case ReducerActions.DUPLICATE_DISMISSED: {
      // Abgelehntes Paar aus der Duplikatliste entfernen
      const {productAId, productBId} = action.payload;
      return {
        ...state,
        similarProducts: state.similarProducts.filter(
          (pair) =>
            !(
              (pair.product_a_id === productAId && pair.product_b_id === productBId) ||
              (pair.product_a_id === productBId && pair.product_b_id === productAId)
            ),
        ),
      };
    }
    case ReducerActions.PRODUCT_DELETED:
      return {
        ...state,
        products: state.products.filter(
          (product) => product.uid !== action.payload.uid,
        ),
        snackbar: {
          severity: "success",
          open: true,
          message: TEXT_DELETE_PRODUCT_SUCCESS(action.payload.name),
        },
      };
    default: {
      const _: never = action;
      throw new Error(`Unbekannter ActionType: ${JSON.stringify(_)}`);
    }
  }
};

/* ===================================================================
// ======================== Custom Hook ==============================
// =================================================================== */

/**
 * Rückgabetyp des useProductsQa-Hooks.
 */
export type UseProductsQaReturn = {
  state: State;
  editMode: boolean;
  onEditClick: () => void;
  onCancelClick: () => void;
  onSave: () => Promise<void>;
  onProductChange: (product: Product) => void;
  loadNewestProducts: () => void;
  onConvertProductToMaterial: (product: Product) => void;
  handleSnackbarClose: (
    event: Event | React.SyntheticEvent,
    reason: string,
  ) => void;
  // Neue QA-Handler
  onQaToggle: (uid: string, checked: boolean) => void;
  onBulkDepartmentChange: (departmentUid: string, departmentName: string) => void;
  onBulkDietChange: (diet: Diet) => void;
  onBulkQaCheck: () => void;
  onSelectionChange: (uids: string[]) => void;
  onFindDuplicates: () => void;
  onClearDuplicates: () => void;
  onMergeProducts: (
    sourceUid: string,
    targetUid: string,
  ) => Promise<MergeProductsResult | null>;
  onLoadSynonyms: () => void;
  onDismissDuplicate: (productAId: string, productBId: string) => void;
  onDeleteProduct: (product: Product) => void;
  dispatch: React.Dispatch<ReducerAction>;
};

/**
 * Custom Hook für die erweiterte Produkt-QA-Seite.
 *
 * Kapselt den gesamten Zustand, die Datenbeschaffung und alle Handler
 * für die Produkt-Qualitätssicherung.
 *
 * @returns Zustand und Handler für die UI-Komponente
 */
export const useProductsQa = (): UseProductsQaReturn => {
  const database = useDatabase();
  const authUser = useAuthUser();

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
        // Domain → UI-Typ: QA-Felder durchreichen
        const products: Product[] = result.map((product) => ({
          uid: product.uid,
          name: product.name,
          department: product.department,
          shoppingUnit: product.shoppingUnit,
          dietProperties: {
            allergens: product.dietProperties.allergens as Allergen[],
            diet: product.dietProperties.diet as Diet,
          },
          usable: product.usable,
          qaChecked: product.qaChecked,
          qaCheckedAt: product.qaCheckedAt,
        }));
        dispatch({
          type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
          payload: products,
        });
      })
      .catch((error) => {
        Sentry.captureException(error, {extra: {context: "Produkte laden"}});
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  // Abteilungen und Einheiten lazy laden beim Edit-Modus
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
            Sentry.captureException(error, {
              extra: {context: "Abteilungen laden"},
            });
            dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
          });
      }
      if (state.units.length === 0) {
        dispatch({type: ReducerActions.UNITS_FETCH_INIT});
        database.units
          .getAllUnits()
          .then((result) => {
            // leeres Feld gehoert auch dazu
            result.push({
              key: "",
              name: "",
              dimension: "",
            });
            dispatch({
              type: ReducerActions.UNITS_FETCH_SUCCESS,
              payload: result as unknown as Unit[],
            });
          })
          .catch((error) => {
            Sentry.captureException(error, {
              extra: {context: "Einheiten laden"},
            });
            dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
          });
      }
    }
  }, [editMode]);

  /* ------------------------------------------
  // Edit Mode wechseln
  // ------------------------------------------ */
  const onEditClick = () => {
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
          authUser!,
        );
      }
      dispatch({type: ReducerActions.PRODUCTS_SAVED});
      setEditMode(false);
    } catch (error) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };

  /* ------------------------------------------
  // Produkt-Änderung
  // ------------------------------------------ */
  const onProductChange = (product: Product) => {
    dispatch({type: ReducerActions.PRODUCT_UPDATED, payload: product});
  };

  /* ------------------------------------------
  // Neueste Produkte
  // ------------------------------------------ */
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
      dispatch({type: ReducerActions.NEWEST_PRODUCTS_CLEAR});
    }
  };

  /* ------------------------------------------
  // Konvertierung zu Material (wird von UI aufgerufen)
  // ------------------------------------------ */
  const onConvertProductToMaterial = (product: Product) => {
    dispatch({
      type: ReducerActions.PRODUCT_CONVERTED_TO_MATERIAL,
      payload: product,
    });
  };

  /* ------------------------------------------
  // Snackbar
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | React.SyntheticEvent,
    reason: string,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  /* ------------------------------------------
  // QA-Toggle
  // ------------------------------------------ */
  const onQaToggle = (uid: string, checked: boolean) => {
    dispatch({type: ReducerActions.QA_TOGGLE, payload: {uid, checked}});
  };

  /* ------------------------------------------
  // Bulk-Aktionen
  // ------------------------------------------ */
  const onBulkDepartmentChange = (
    departmentUid: string,
    departmentName: string,
  ) => {
    const updatedProducts = state.products
      .filter((product) => state.selectedProductUids.includes(product.uid))
      .map((product) => ({
        ...product,
        department: {uid: departmentUid, name: departmentName},
      }));
    dispatch({type: ReducerActions.BULK_UPDATE, payload: updatedProducts});
  };

  const onBulkDietChange = (diet: Diet) => {
    const updatedProducts = state.products
      .filter((product) => state.selectedProductUids.includes(product.uid))
      .map((product) => ({
        ...product,
        dietProperties: {...product.dietProperties, diet},
      }));
    dispatch({type: ReducerActions.BULK_UPDATE, payload: updatedProducts});
  };

  const onBulkQaCheck = () => {
    const now = new Date().toISOString();
    const updatedProducts = state.products
      .filter((product) => state.selectedProductUids.includes(product.uid))
      .map((product) => ({
        ...product,
        qaChecked: true,
        qaCheckedAt: now,
      }));
    dispatch({type: ReducerActions.BULK_UPDATE, payload: updatedProducts});
  };

  const onSelectionChange = (uids: string[]) => {
    dispatch({
      type: ReducerActions.SELECTED_PRODUCTS_CHANGED,
      payload: uids,
    });
  };

  /* ------------------------------------------
  // Duplikaterkennung
  // ------------------------------------------ */
  const onFindDuplicates = () => {
    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {severity: "info", message: "Duplikate werden gesucht..."},
    });
    database.adminOps
      .findSimilarProducts(0.3)
      .then((result) => {
        dispatch({type: ReducerActions.DUPLICATES_LOADED, payload: result});
        dispatch({
          type: ReducerActions.SNACKBAR_SHOW,
          payload: {
            severity: "success",
            message: `${result.length} ähnliche Paare gefunden.`,
          },
        });
      })
      .catch((error) => {
        Sentry.captureException(error, {
          extra: {context: "Duplikaterkennung"},
        });
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  };

  const onClearDuplicates = () => {
    dispatch({type: ReducerActions.DUPLICATES_CLEARED});
  };

  /* ------------------------------------------
  // Produkte zusammenführen
  // ------------------------------------------ */
  const onMergeProducts = async (
    sourceUid: string,
    targetUid: string,
  ): Promise<MergeProductsResult | null> => {
    try {
      const result = await database.adminOps.mergeProducts(
        sourceUid,
        targetUid,
      );
      dispatch({
        type: ReducerActions.PRODUCTS_MERGED,
        payload: {sourceProductUid: sourceUid, result},
      });
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Produkte zusammenführen"},
      });
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
      return null;
    }
  };

  /* ------------------------------------------
  // Synonym-Paare laden
  // ------------------------------------------ */
  const onLoadSynonyms = () => {
    database.productSynonyms
      .getAllSynonyms()
      .then((result) => {
        dispatch({type: ReducerActions.SYNONYM_PAIRS_LOADED, payload: result});
      })
      .catch((error) => {
        Sentry.captureException(error, {
          extra: {context: "Synonyme laden"},
        });
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  };

  /* ------------------------------------------
  // Duplikat-Paar bestätigen (kein echtes Duplikat)
  // ------------------------------------------ */
  const onDismissDuplicate = (productAId: string, productBId: string) => {
    database.adminOps
      .dismissDuplicatePair(productAId, productBId)
      .then(() => {
        dispatch({
          type: ReducerActions.DUPLICATE_DISMISSED,
          payload: {productAId, productBId},
        });
      })
      .catch((error) => {
        Sentry.captureException(error, {
          extra: {context: "Duplikat bestätigen"},
        });
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  };

  /* ------------------------------------------
  // Produkt gelöscht (wird von UI aufgerufen nach DB-Löschung)
  // ------------------------------------------ */
  const onDeleteProduct = (product: Product) => {
    dispatch({
      type: ReducerActions.PRODUCT_DELETED,
      payload: product,
    });
  };

  return {
    state,
    editMode,
    onEditClick,
    onCancelClick,
    onSave,
    onProductChange,
    loadNewestProducts,
    onConvertProductToMaterial,
    handleSnackbarClose,
    onQaToggle,
    onBulkDepartmentChange,
    onBulkDietChange,
    onBulkQaCheck,
    onSelectionChange,
    onFindDuplicates,
    onClearDuplicates,
    onMergeProducts,
    onLoadSynonyms,
    onDismissDuplicate,
    onDeleteProduct,
    dispatch,
  };
};
