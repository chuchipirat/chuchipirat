import React from "react";

import {
  Container,
  Typography,
  TextField,
  Divider,
  Card,
  CardContent,
  Grid,
  Backdrop,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
  SnackbarCloseReason,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";

import {
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  UID as TEXT_UID,
  DENOMINATOR as TEXT_DENOMINATOR,
  NUMERATOR as TEXT_NUMERATOR,
  UNIT_FROM as TEXT_UNIT_FROM,
  UNIT_TO as TEXT_UNIT_TO,
  PRODUCT as TEXT_PRODUCT,
  TYPE_UNKNOWN as TEXT_TYPE_UNKNOWN,
  PAGE_TITLE_UNIT_CONVERSION as TEXT_PAGE_TITLE_UNIT_CONVERSION,
  PAGE_SUBTITLE_UNIT_CONVERSION as TEXT_PAGE_SUBTITLE_UNIT_CONVERSION,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  ADD as TEXT_ADD,
  BASIC as TEXT_BASIC,
  PRODUCT_SPECIFIC as TEXT_PRODUCT_SPECIFIC,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  CANCEL as TEXT_CANCEL,
} from "../../constants/text";
import Role from "../../constants/roles";

import PageTitle from "../Shared/pageTitle";
import ButtonRow from "../Shared/buttonRow";
import EnhancedTable, {
  Column,
  ColumnTextAlign,
  TableColumnTypes,
} from "../Shared/enhancedTable";
import AlertMessage from "../Shared/AlertMessage";

import DialogCreateUnitConversion, {
  UnitConversionType,
} from "./dialogCreateUnitConversion";

import CustomSnackbar, {Snackbar} from "../Shared/customSnackbar";
import useCustomStyles from "../../constants/styles";

import Unit from "./unit.class";
import UnitConversion from "./unitConversion.class";
import Product from "../Product/product.class";

import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {UnitConversionBasicDomain} from "../Database/Repository/UnitConversionBasicRepository";
import {UnitConversionProductDomain} from "../Database/Repository/UnitConversionProductRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  FETCH_INIT,
  UNIT_CONVERSION_BASIC_FETCH_SUCCESS,
  UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS,
  SNACKBAR_CLOSE,
  PRODUCTS_FETCH_SUCCESS,
  UNITS_FETCH_SUCCESS,
  NEW_UNIT_CONVERSION_BASIC,
  NEW_UNIT_CONVERSION_PRODUCT,
  UNIT_CONVERSION_BASIC_ON_CHANGE,
  UNIT_CONVERSION_PRODUCT_ON_CHANGE,
  UNIT_CONVERSIONS_SAVED,
  UNIT_CONVERSIONS_EDIT_CANCELLED,
  DELETE_BASIC_UNIT_CONVERSION,
  DELETE_PRODUCT_UNIT_CONVERSION,
  GENERIC_ERROR,
}

type isLoading = {
  overall: boolean;
  products: boolean;
  units: boolean;
  unitConversionBasic: boolean;
  unitConversionProduct: boolean;
};

type State = {
  unitConversionBasic: UnitConversion[];
  unitConversionProduct: UnitConversion[];
  products: Product[];
  units: Unit[];
  error: Error | null;
  isLoading: isLoading;
  snackbar: Snackbar;
};

/** Diskriminierte Union für Reducer-Actions — typsichere Payloads. */
type ReducerAction =
  | {type: ReducerActions.FETCH_INIT; payload: {field: string}}
  | {
      type: ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS;
      payload: UnitConversion[];
    }
  | {
      type: ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS;
      payload: UnitConversion[];
    }
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {type: ReducerActions.NEW_UNIT_CONVERSION_BASIC; payload: UnitConversion}
  | {type: ReducerActions.NEW_UNIT_CONVERSION_PRODUCT; payload: UnitConversion}
  | {
      type: ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE;
      payload: {uid: string; field: string; value: string};
    }
  | {
      type: ReducerActions.UNIT_CONVERSION_PRODUCT_ON_CHANGE;
      payload: {uid: string; field: string; value: string};
    }
  | {type: ReducerActions.UNIT_CONVERSIONS_SAVED; payload: Record<string, never>}
  | {
      type: ReducerActions.UNIT_CONVERSIONS_EDIT_CANCELLED;
      payload: {basic: UnitConversion[]; product: UnitConversion[]};
    }
  | {type: ReducerActions.DELETE_BASIC_UNIT_CONVERSION; payload: {uid: string}}
  | {
      type: ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION;
      payload: {uid: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE; payload: Record<string, never>}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

const initialState: State = {
  unitConversionBasic: [],
  unitConversionProduct: [],
  products: [],
  units: [],
  error: null,
  isLoading: {
    overall: false,
    products: false,
    units: false,
    unitConversionBasic: false,
    unitConversionProduct: false,
  },
  snackbar: {open: false, severity: "success", message: ""},
};

/* ------------------------------------------
// Berechnet ob noch Daten geladen werden (pure Funktion ohne Seiteneffekte)
// ------------------------------------------ */
/**
 * Berechnet den Gesamtlade-Status ohne den Zustand zu mutieren.
 *
 * @param current - Aktueller isLoading-Zustand
 * @param changedField - Das Feld, dessen Wert sich ändert
 * @param newValue - Neuer Wert für das geänderte Feld
 * @returns true wenn mindestens ein Nicht-overall-Feld true ist
 */
const computeOverallLoading = (
  current: isLoading,
  changedField: keyof Omit<isLoading, "overall">,
  newValue: boolean
): boolean => {
  const updated = {...current, [changedField]: newValue};
  return Object.keys(updated).some(
    (key) => key !== "overall" && updated[key as keyof isLoading] === true
  );
};

const unitConversionReducer = (
  state: State,
  action: ReducerAction
): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      // Daten werden geladen
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          [action.payload.field]: true,
        },
      };
    case ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS:
      // Basic Umrechnung erfolgreich gelesen
      return {
        ...state,
        unitConversionBasic: action.payload,
        isLoading: {
          ...state.isLoading,
          unitConversionBasic: false,
          overall: computeOverallLoading(
            state.isLoading,
            "unitConversionBasic",
            false
          ),
        },
      };
    case ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS:
      // Produkte Umrechnung erfolgreich gelesen
      return {
        ...state,
        unitConversionProduct: action.payload,
        isLoading: {
          ...state.isLoading,
          unitConversionProduct: false,
          overall: computeOverallLoading(
            state.isLoading,
            "unitConversionProduct",
            false
          ),
        },
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      // Produkte erfolgreich gelesen
      return {
        ...state,
        products: action.payload,
        isLoading: {
          ...state.isLoading,
          products: false,
          overall: computeOverallLoading(state.isLoading, "products", false),
        },
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      // Einheiten erfolgreich gelesen
      return {
        ...state,
        units: action.payload,
        isLoading: {
          ...state.isLoading,
          overall: computeOverallLoading(state.isLoading, "units", false),
          units: false,
        },
      };
    case ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE:
      // Änderung der Feldwerte — immutabler Spread statt Mutation
      return {
        ...state,
        unitConversionBasic: state.unitConversionBasic.map(
          (unitConversion) => {
            if (unitConversion.uid === action.payload.uid) {
              return {
                ...unitConversion,
                [action.payload.field]: action.payload.value,
              };
            }
            return unitConversion;
          }
        ) as UnitConversion[],
      };
    case ReducerActions.UNIT_CONVERSION_PRODUCT_ON_CHANGE:
      // Änderung der Feldwerte — immutabler Spread statt Mutation
      return {
        ...state,
        unitConversionProduct: state.unitConversionProduct.map(
          (unitConversion) => {
            if (unitConversion.uid === action.payload.uid) {
              return {
                ...unitConversion,
                [action.payload.field]: action.payload.value,
              };
            }
            return unitConversion;
          }
        ) as UnitConversion[],
      };
    case ReducerActions.NEW_UNIT_CONVERSION_BASIC: {
      // Neue Umrechnung wurde erfasst
      return {
        ...state,
        unitConversionBasic: [...state.unitConversionBasic, action.payload],
      };
    }
    case ReducerActions.NEW_UNIT_CONVERSION_PRODUCT: {
      return {
        ...state,
        unitConversionProduct: [
          ...state.unitConversionProduct,
          action.payload,
        ],
      };
    }
    case ReducerActions.DELETE_BASIC_UNIT_CONVERSION:
      // Einzelne Unit Conversion wurde gelöscht
      return {
        ...state,
        unitConversionBasic: UnitConversion.deleteUnitConversion({
          unitConversion: state.unitConversionBasic,
          unitConversionUidToDelete: action.payload.uid,
        }),
      };
    case ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION:
      // Einzelne Unit Conversion wurde gelöscht
      return {
        ...state,
        unitConversionProduct: UnitConversion.deleteUnitConversion({
          unitConversion: state.unitConversionProduct,
          unitConversionUidToDelete: action.payload.uid,
        }),
      };
    case ReducerActions.UNIT_CONVERSIONS_SAVED:
      // Alles gespeichert
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
          open: true,
        } as Snackbar,
      };
    case ReducerActions.UNIT_CONVERSIONS_EDIT_CANCELLED:
      // Bearbeitung abgebrochen — Snapshot wiederherstellen
      return {
        ...state,
        unitConversionBasic: action.payload.basic,
        unitConversionProduct: action.payload.product,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      // Snackbar schliessen
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        } as Snackbar,
      };
    case ReducerActions.GENERIC_ERROR:
      // allgemeiner Fehler
      return {
        ...state,
        error: action.payload,
      };
    default: {
      // Exhaustive check — TypeScript meldet Fehler bei unbekanntem ActionType
      const _exhaustive: never = action;
      throw new Error(
        `Unbekannter ActionType: ${(_exhaustive as ReducerAction).type}`
      );
    }
  }
};

const BASIC_TABLE_COLUMS: Column[] = [
  {
    id: "uid",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UID,
    visible: false,
  },
  {
    id: "denominator",
    type: TableColumnTypes.number,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_DENOMINATOR,
    visible: true,
  },
  {
    id: "fromUnit",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UNIT_FROM,
    visible: true,
  },
  {
    id: "numerator",
    type: TableColumnTypes.number,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_NUMERATOR,
    visible: true,
  },
  {
    id: "toUnit",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UNIT_TO,
    visible: true,
  },
];
const PRODUCT_TABLE_COLUMS: Column[] = [
  {
    id: "uid",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UID,
    visible: false,
  },
  {
    id: "productName",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.left,
    disablePadding: false,
    label: TEXT_PRODUCT,
    visible: true,
  },
  {
    id: "denominator",
    type: TableColumnTypes.number,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_DENOMINATOR,
    visible: true,
  },
  {
    id: "fromUnit",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UNIT_TO,
    visible: true,
  },
  {
    id: "numerator",
    type: TableColumnTypes.number,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_NUMERATOR,
    visible: true,
  },
  {
    id: "toUnit",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_UNIT_TO,
    visible: true,
  },
];
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const UnitConversionPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [state, dispatch] = React.useReducer(
    unitConversionReducer,
    initialState
  );

  const [unitConversionCreateValues, setUnitConversionCreateValues] =
    React.useState({
      popUpOpen: false,
      unitConversionType: UnitConversionType.NONE,
    });
  const [editMode, setEditMode] = React.useState(false);
  const [tabValue, setTabValue] = React.useState(0);

  // Snapshots speichern den Zustand beim Eintritt in den Bearbeitungsmodus
  const basicSnapshot = React.useRef<UnitConversion[]>([]);
  const productSnapshot = React.useRef<UnitConversion[]>([]);

  /* ------------------------------------------
	// Daten aus der db holen
	// ------------------------------------------ */
  React.useEffect(() => {
    // Umrechnungen Basic holen
    dispatch({
      type: ReducerActions.FETCH_INIT,
      payload: {field: "unitConversionBasic"},
    });

    database.unitConversionBasic.getAllConversions().then((result) => {
      dispatch({
        type: ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS,
        payload: result as UnitConversion[],
      });
    });
    // Umrechnungen Produkte holen
    database.unitConversionProducts.getAllConversions().then((result) => {
      dispatch({
        type: ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS,
        payload: result as UnitConversion[],
      });
    });
  }, []);
  React.useEffect(() => {
    if (editMode) {
      // Produkte holen
      if (state.products.length === 0) {
        dispatch({
          type: ReducerActions.FETCH_INIT,
          payload: {field: "products"},
        });
        database.products
          .getAllProducts({onlyUsable: true})
          .then((result) => {
            dispatch({
              type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
              payload: result,
            });
          })
          .catch((error) => {
            console.error(error);
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      // Einheiten holen
      if (state.units.length === 0) {
        dispatch({
          type: ReducerActions.FETCH_INIT,
          payload: {field: "units"},
        });
        database.units
          .getAllUnits()
          .then((result) => {
            dispatch({
              type: ReducerActions.UNITS_FETCH_SUCCESS,
              payload: result as unknown as Unit[],
            });
          })
          .catch((error) => {
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
	// Edit Mode starten — Snapshot anlegen
	// ------------------------------------------ */
  const onEditClick = () => {
    basicSnapshot.current = state.unitConversionBasic.map((conversion) => ({
      ...conversion,
    }));
    productSnapshot.current = state.unitConversionProduct.map((conversion) => ({
      ...conversion,
    }));
    setEditMode(true);
  };
  /* ------------------------------------------
	// Bearbeitung abbrechen — Snapshot wiederherstellen
	// ------------------------------------------ */
  const onCancelClick = () => {
    dispatch({
      type: ReducerActions.UNIT_CONVERSIONS_EDIT_CANCELLED,
      payload: {
        basic: basicSnapshot.current,
        product: productSnapshot.current,
      },
    });
    setEditMode(false);
  };
  /* ------------------------------------------
	// Tab wechseln
	// ------------------------------------------ */
  const onTabChange = (event: React.BaseSyntheticEvent, value: any) => {
    setTabValue(value);
  };
  /* ------------------------------------------
	// PopUp öffnen um neue Umrechnung anzulegen
	// ------------------------------------------ */
  const onAddUnitConversionClick = () => {
    let conversionType: UnitConversionType;

    switch (tabValue) {
      case 0:
        conversionType = UnitConversionType.BASIC;
        break;
      case 1:
        conversionType = UnitConversionType.PRODUCT;
        break;
      default:
        throw new Error(TEXT_TYPE_UNKNOWN);
    }

    setUnitConversionCreateValues({
      ...unitConversionCreateValues,
      popUpOpen: true,
      unitConversionType: conversionType,
    });
  };
  /* ------------------------------------------
	// Einheit hinzufügen --> PopUp schliessen
	// ------------------------------------------ */
  const onPopUpClose = () => {
    setUnitConversionCreateValues({
      ...unitConversionCreateValues,
      popUpOpen: false,
    });
  };
  /* ------------------------------------------
	// Fehler beim anlegen der Einheit
	// ------------------------------------------ */
  const onPopUpError = (error: Error) => {
    dispatch({
      type: ReducerActions.GENERIC_ERROR,
      payload: error,
    });
    setUnitConversionCreateValues({
      ...unitConversionCreateValues,
      popUpOpen: false,
    });
  };
  /* ------------------------------------------
	// Einheit wurde angelegt
	// ------------------------------------------ */
  const onAddUnitConversion = (unitConversion: UnitConversion) => {
    switch (unitConversionCreateValues.unitConversionType) {
      case UnitConversionType.BASIC:
        dispatch({
          type: ReducerActions.NEW_UNIT_CONVERSION_BASIC,
          payload: unitConversion,
        });
        break;
      case UnitConversionType.PRODUCT:
        dispatch({
          type: ReducerActions.NEW_UNIT_CONVERSION_PRODUCT,
          payload: unitConversion,
        });
        break;
    }
    setUnitConversionCreateValues({
      ...unitConversionCreateValues,
      popUpOpen: false,
    });
  };
  /* ------------------------------------------
	// Selektives Speichern: nur geänderte/neue/gelöschte Zeilen werden persistiert
	// ------------------------------------------ */
  const onSaveClick = async () => {
    const snapshotBasicMap = new Map(
      basicSnapshot.current.map((conversion) => [conversion.uid, conversion])
    );
    const snapshotProductMap = new Map(
      productSnapshot.current.map((conversion) => [conversion.uid, conversion])
    );

    // UIDs im Snapshot, die im aktuellen State fehlen → gelöscht
    const deletedBasicUids = basicSnapshot.current
      .filter(
        (snap) =>
          !state.unitConversionBasic.some((current) => current.uid === snap.uid)
      )
      .map((snap) => snap.uid);
    const deletedProductUids = productSnapshot.current
      .filter(
        (snap) =>
          !state.unitConversionProduct.some(
            (current) => current.uid === snap.uid
          )
      )
      .map((snap) => snap.uid);

    // Neue oder geänderte Zeilen (Numerator oder Denominator hat sich verändert)
    const changedBasic = state.unitConversionBasic.filter((conversion) => {
      const snap = snapshotBasicMap.get(conversion.uid);
      return (
        !snap ||
        snap.numerator !== conversion.numerator ||
        snap.denominator !== conversion.denominator
      );
    });
    const changedProduct = state.unitConversionProduct.filter((conversion) => {
      const snap = snapshotProductMap.get(conversion.uid);
      return (
        !snap ||
        snap.numerator !== conversion.numerator ||
        snap.denominator !== conversion.denominator
      );
    });

    const hasChanges =
      deletedBasicUids.length > 0 ||
      deletedProductUids.length > 0 ||
      changedBasic.length > 0 ||
      changedProduct.length > 0;

    // Keine Änderungen — einfach den Bearbeitungsmodus schliessen
    if (!hasChanges) {
      setEditMode(false);
      return;
    }

    try {
      for (const uid of deletedBasicUids) {
        await database.unitConversionBasic.deleteConversion(uid);
      }
      for (const uid of deletedProductUids) {
        await database.unitConversionProducts.deleteConversion(uid);
      }
      for (const conversion of changedBasic) {
        await database.unitConversionBasic.upsertConversion(
          conversion as unknown as UnitConversionBasicDomain,
          authUser!
        );
      }
      for (const conversion of changedProduct) {
        await database.unitConversionProducts.upsertConversion(
          conversion as unknown as UnitConversionProductDomain,
          authUser!
        );
      }
      // Snapshot auf den soeben gespeicherten Zustand aktualisieren
      basicSnapshot.current = state.unitConversionBasic.map((conversion) => ({
        ...conversion,
      }));
      productSnapshot.current = state.unitConversionProduct.map(
        (conversion) => ({...conversion})
      );
      dispatch({type: ReducerActions.UNIT_CONVERSIONS_SAVED, payload: {}});
      setEditMode(false);
    } catch (error) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };
  /* ------------------------------------------
	// Snackback schliessen
	// ------------------------------------------ */
  const handleSnackbarClose = (
    event: Event | React.SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({
      type: ReducerActions.SNACKBAR_CLOSE,
      payload: {},
    });
  };
  /* ------------------------------------------
	// OnChange der EditTable
	// ------------------------------------------ */
  const onChangeEditTableField = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const unitConversionField = event.target.id.split("_");
    switch (tabValue) {
      case 0:
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE,
          payload: {
            uid: unitConversionField[1],
            field: unitConversionField[0],
            value: event.target.value,
          },
        });
        break;
      case 1:
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_PRODUCT_ON_CHANGE,
          payload: {
            uid: unitConversionField[1],
            field: unitConversionField[0],
            value: event.target.value,
          },
        });
        break;
      default:
        throw new Error(TEXT_TYPE_UNKNOWN);
    }
  };
  /* ------------------------------------------
	// Eintrag aus Tabelle löschen
	// ------------------------------------------ */
  const onTableRowDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
    const pressedButton = event.currentTarget.id.split("_");
    switch (tabValue) {
      case 0:
        dispatch({
          type: ReducerActions.DELETE_BASIC_UNIT_CONVERSION,
          payload: {uid: pressedButton[1]},
        });

        break;
      case 1:
        dispatch({
          type: ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION,
          payload: {uid: pressedButton[1]},
        });
        break;
      default:
        throw new Error(TEXT_TYPE_UNKNOWN);
    }
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_PAGE_TITLE_UNIT_CONVERSION}
        subTitle={TEXT_PAGE_SUBTITLE_UNIT_CONVERSION}
      />
      <ButtonRow
        key="buttons_edit"
        buttons={[
          {
            id: "edit",
            hero: true,
            visible: !editMode && authUser.roles.includes(Role.communityLeader),
            label: TEXT_EDIT,
            variant: "contained",
            color: "primary",
            onClick: onEditClick,
          },
          {
            id: "cancel",
            hero: true,
            visible: editMode && authUser.roles.includes(Role.communityLeader),
            label: TEXT_CANCEL,
            variant: "outlined",
            color: "primary",
            onClick: onCancelClick,
          },
          {
            id: "save",
            hero: true,
            visible: editMode && authUser.roles.includes(Role.communityLeader),
            label: TEXT_SAVE,
            variant: "contained",
            color: "primary",
            onClick: onSaveClick,
          },
          {
            id: "add",
            hero: true,
            visible: authUser.roles.includes(Role.communityLeader) && editMode,
            label: TEXT_ADD,
            variant: "outlined",
            color: "primary",
            onClick: onAddUnitConversionClick,
          },
        ]}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="md">
        <Backdrop sx={classes.backdrop} open={state.isLoading.overall}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Grid container spacing={2}>
          <Grid key={"gridTabs"} size={12}>
            <Tabs value={tabValue} onChange={onTabChange} centered>
              <Tab
                // className={classes.tabs}
                label={TEXT_BASIC}
              />
              <Tab label={TEXT_PRODUCT_SPECIFIC} />
            </Tabs>
          </Grid>

          {state.error && (
            <Grid key={"error"} size={12}>
              <AlertMessage
                error={state.error}
                messageTitle={TEXT_ALERT_TITLE_UUPS}
              />
            </Grid>
          )}

          {/* Tabs */}
          {tabValue === 0 && (
            <Grid key={"BasicConversionPanel"} size={12}>
              <br />
              <BasicConversionPanel
                unitConversions={state.unitConversionBasic}
                onChangeField={onChangeEditTableField}
                onDeleteClick={onTableRowDelete}
                editMode={editMode}
              />
            </Grid>
          )}
          {tabValue === 1 && (
            <Grid key={"BasicConversionPanel"} size={12}>
              <br />
              <ProductConversionPanel
                unitConversions={state.unitConversionProduct}
                onChangeField={onChangeEditTableField}
                onDeleteClick={onTableRowDelete}
                editMode={editMode}
              />
            </Grid>
          )}
          <Grid key={"empty"} size={12}></Grid>
        </Grid>
      </Container>
      <DialogCreateUnitConversion
        units={state.units}
        products={state.products}
        dialogOpen={unitConversionCreateValues.popUpOpen}
        unitConversionType={unitConversionCreateValues.unitConversionType}
        handleCreate={onAddUnitConversion}
        handleClose={onPopUpClose}
        handleError={onPopUpError}
      />
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
// ====================== Basic Conversion Panel  ====================
// =================================================================== */
interface BasicConversionPanelProps {
  unitConversions: UnitConversion[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  editMode: boolean;
}
const BasicConversionPanel = ({
  unitConversions,
  onChangeField,
  onDeleteClick,
  editMode,
}: BasicConversionPanelProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardBasicUnitConversion"}>
      <CardContent sx={classes.cardContent} key={"cardTagsContent"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_BASIC}
        </Typography>
        {editMode ? (
          <Grid container spacing={2}>
            {/* Überschriften */}
            <Grid size={3}>
              <Typography variant="subtitle1" align="center">
                {TEXT_DENOMINATOR}
              </Typography>
            </Grid>
            <Grid size={2}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_FROM}
              </Typography>
            </Grid>
            <Grid size={3}>
              <Typography variant="subtitle1" align="center">
                {TEXT_NUMERATOR}
              </Typography>
            </Grid>
            <Grid size={2}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_TO}
              </Typography>
            </Grid>
            <Grid size={2} />

            {/* Trennlinie als vollbreites Grid-Item, damit kein Flex-Layout-Versatz entsteht */}
            <Grid size={12}>
              <Divider />
            </Grid>
            {unitConversions.map((conversionRule) => (
              <BasicConversionEditRow
                key={"basicConversionRow_" + conversionRule.uid}
                unitConversion={conversionRule}
                onChangeField={onChangeField}
                onDeleteClick={onDeleteClick}
              />
            ))}
          </Grid>
        ) : (
          <EnhancedTable
            tableData={unitConversions}
            tableColumns={BASIC_TABLE_COLUMS}
            keyColum={"uid"}
          />
        )}
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ====================== Reihe Conversion Basic  ===================£=
// =================================================================== */
interface BasicConversionEditRowProps {
  unitConversion: UnitConversion;
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
const BasicConversionEditRow = ({
  unitConversion,
  onChangeField,
  onDeleteClick,
}: BasicConversionEditRowProps) => {
  return (
    <React.Fragment>
      {/* Überschriften */}
      <Grid key={"grid_denominator_" + unitConversion.uid} size={3}>
        <TextField
          id={"denominator_" + unitConversion.uid}
          key={"denominator_" + unitConversion.uid}
          value={unitConversion.denominator}
          onChange={onChangeField}
          fullWidth
          inputProps={{style: {textAlign: "center"}}}
        />
      </Grid>
      <Grid key={"grid_fromUnit_" + unitConversion.uid} size={2}>
        <Typography color="textSecondary" align="center">
          {unitConversion.fromUnit}
        </Typography>
      </Grid>
      <Grid key={"grid_numerator_" + unitConversion.uid} size={3}>
        <TextField
          id={"numerator_" + unitConversion.uid}
          key={"numerator_" + unitConversion.uid}
          value={unitConversion.numerator}
          onChange={onChangeField}
          fullWidth
          inputProps={{style: {textAlign: "center"}}}
        />
      </Grid>
      <Grid key={"grid_toUnit_" + unitConversion.uid} size={2}>
        <Typography color="textSecondary" align="center">
          {unitConversion.toUnit}
        </Typography>
      </Grid>
      <Grid key={"grid_deleteRow_" + unitConversion.uid} size={2}>
        <IconButton
          color="primary"
          component="span"
          id={"deleteRow_" + unitConversion.uid}
          onClick={onDeleteClick}
          size="large"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Grid>
      <Grid key={"grid_divider" + unitConversion.uid} size={12}>
        <Divider />
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ====================== Poduct Conversion Panel  ===================
// =================================================================== */
interface ProductConversionPanelProps {
  unitConversions: UnitConversion[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  editMode: boolean;
}
const ProductConversionPanel = ({
  unitConversions,
  onChangeField,
  onDeleteClick,
  editMode,
}: ProductConversionPanelProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardBasicUnitConversion"}>
      <CardContent sx={classes.cardContent} key={"cardTagsContent"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_PRODUCT_SPECIFIC}
        </Typography>
        {editMode ? (
          <Grid container spacing={2}>
            {/* Überschriften */}
            <Grid
              size={{
                xs: 12,
                sm: 4,
              }}>
              <Typography variant="subtitle1">{TEXT_PRODUCT}</Typography>
            </Grid>
            <Grid
              size={{
                xs: 3,
                sm: 2,
              }}>
              <Typography variant="subtitle1" align="center">
                {TEXT_DENOMINATOR}
              </Typography>
            </Grid>
            <Grid
              size={{
                xs: 2,
                sm: 1,
              }}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_FROM}
              </Typography>
            </Grid>
            <Grid
              size={{
                xs: 3,
                sm: 2,
              }}>
              <Typography variant="subtitle1" align="center">
                {TEXT_NUMERATOR}
              </Typography>
            </Grid>
            <Grid
              size={{
                xs: 2,
                sm: 1,
              }}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_TO}
              </Typography>
            </Grid>
            <Grid size={2} />

            {/* Trennlinie als vollbreites Grid-Item, damit kein Flex-Layout-Versatz entsteht */}
            <Grid size={12}>
              <Divider />
            </Grid>
            {unitConversions.map((conversionRule) => (
              <ProductConversionEditRow
                key={"productConversionRow_" + conversionRule.uid}
                unitConversion={conversionRule}
                onChangeField={onChangeField}
                onDeleteClick={onDeleteClick}
              />
            ))}
          </Grid>
        ) : (
          <EnhancedTable
            tableData={unitConversions}
            tableColumns={PRODUCT_TABLE_COLUMS}
            keyColum={"uid"}
          />
        )}
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ===================== Reihe Conversion Produkt  ===================
// =================================================================== */
interface ProductConversionEditRowProps {
  unitConversion: UnitConversion;
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
const ProductConversionEditRow = ({
  unitConversion,
  onChangeField,
  onDeleteClick,
}: ProductConversionEditRowProps) => {
  return (
    <React.Fragment>
      <Grid
        key={"grid_productName_" + unitConversion.uid}
        size={{
          xs: 12,
          sm: 4,
        }}>
        <Typography color="textSecondary">
          {unitConversion.productName}
        </Typography>
      </Grid>
      <Grid
        key={"grid_denominator_" + unitConversion.uid}
        size={{
          xs: 3,
          sm: 2,
        }}>
        <TextField
          id={"denominator_" + unitConversion.uid}
          key={"denominator_" + unitConversion.uid}
          value={unitConversion.denominator}
          onChange={onChangeField}
          fullWidth
          inputProps={{style: {textAlign: "center"}}}
        />
      </Grid>
      <Grid
        key={"grid_fromUnit_" + unitConversion.uid}
        size={{
          xs: 2,
          sm: 1,
        }}>
        <Typography color="textSecondary" align="center">
          {unitConversion.fromUnit}
        </Typography>
      </Grid>
      <Grid
        key={"grid_numerator_" + unitConversion.uid}
        size={{
          xs: 3,
          sm: 2,
        }}>
        <TextField
          id={"numerator_" + unitConversion.uid}
          key={"numerator_" + unitConversion.uid}
          value={unitConversion.numerator}
          onChange={onChangeField}
          fullWidth
          inputProps={{style: {textAlign: "center"}}}
        />
      </Grid>
      <Grid
        key={"grid_toUnit_" + unitConversion.uid}
        size={{
          xs: 2,
          sm: 1,
        }}>
        <Typography color="textSecondary" align="center">
          {unitConversion.toUnit}
        </Typography>
      </Grid>
      <Grid
        key={"grid_deleteRow_" + unitConversion.uid}
        size={{
          xs: 2,
          sm: 2,
        }}>
        <IconButton
          color="primary"
          component="span"
          id={"deleteRow_" + unitConversion.uid}
          onClick={onDeleteClick}
          size="large"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Grid>
      <Grid key={"grid_divider" + unitConversion.uid} size={12}>
        <Divider />
      </Grid>
    </React.Fragment>
  );
};

export default UnitConversionPage;
