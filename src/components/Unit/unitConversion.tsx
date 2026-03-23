/**
 * UnitConversionPage — Übersichtsseite für Einheitenumrechnungen.
 *
 * Zeigt Basis- und Produktspezifische Umrechnungen in zwei Tabs an.
 * Im Bearbeitungsmodus können Umrechnungen hinzugefügt, geändert und
 * gelöscht werden. Beim Speichern werden nur tatsächlich geänderte
 * Zeilen persistiert.
 */
import React from "react";
import {useSearchParams} from "react-router";

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
import {Role} from "../../constants/roles";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";
import {
  EnhancedTable,
  Column,
  ColumnTextAlign,
  TableColumnTypes,
} from "../Shared/enhancedTable";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  DialogCreateUnitConversion,
  UnitConversionType,
} from "./dialogCreateUnitConversion";

import {CustomSnackbar} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";

import {Unit} from "./unit.class";
import {UnitConversion} from "./unitConversion.class";

import * as Sentry from "@sentry/browser";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {UnitConversionBasicDomain} from "../Database/Repository/UnitConversionBasicRepository";
import {UnitConversionProductDomain} from "../Database/Repository/UnitConversionProductRepository";

import {
  unitConversionReducer,
  initialState,
  ReducerActions,
} from "./unitConversionReducer";

/* ===================================================================
// ======================== Tabellen-Spalten =========================
// =================================================================== */

const BASIC_TABLE_COLUMNS: Column[] = [
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

const PRODUCT_TABLE_COLUMNS: Column[] = [
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
// ======================== Konstanten ===============================
// =================================================================== */

/** Tab-Index für Basic-Umrechnungen. */
const TAB_BASIC = 0;
/** Tab-Index für Produkt-Umrechnungen. */
const TAB_PRODUCT = 1;

/**
 * Zuordnung von URL-Query-Parameter `?tab=` auf den Tab-Index.
 * Ermöglicht Deep-Links auf einen bestimmten Tab (z.B. aus dem Verwendungsnachweis).
 */
const TAB_QUERY_PARAM_MAP: Record<string, number> = {
  basic: TAB_BASIC,
  product: TAB_PRODUCT,
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptkomponente für die Einheitenumrechnungs-Verwaltung.
 *
 * Lädt Basis- und Produktumrechnungen beim Mount. Im Bearbeitungsmodus
 * werden zusätzlich Einheiten und Produkte geladen. Beim Speichern
 * werden nur geänderte/neue/gelöschte Zeilen persistiert.
 */
const UnitConversionPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const [searchParams] = useSearchParams();

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

  // Initialer Tab aus ?tab= Query-Parameter (Deep-Link-Unterstützung)
  const [tabValue, setTabValue] = React.useState(
    TAB_QUERY_PARAM_MAP[searchParams.get("tab") ?? ""] ?? TAB_BASIC
  );

  // Snapshots speichern den Zustand beim Eintritt in den Bearbeitungsmodus
  const basicSnapshot = React.useRef<UnitConversion[]>([]);
  const productSnapshot = React.useRef<UnitConversion[]>([]);

  /* ------------------------------------------
  // Daten aus der DB holen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({
      type: ReducerActions.FETCH_INIT,
      payload: {field: "unitConversionBasic"},
    });

    database.unitConversionBasic
      .getAllConversions()
      .then((result) => {
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS,
          payload: result as UnitConversion[],
        });
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });

    database.unitConversionProducts
      .getAllConversions()
      .then((result) => {
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS,
          payload: result as UnitConversion[],
        });
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  React.useEffect(() => {
    if (editMode) {
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
            Sentry.captureException(error);
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
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
  const onTabChange = (_event: React.SyntheticEvent, value: number) => {
    setTabValue(value);
  };

  /* ------------------------------------------
  // PopUp öffnen um neue Umrechnung anzulegen
  // ------------------------------------------ */
  const onAddUnitConversionClick = () => {
    let conversionType: UnitConversionType;

    switch (tabValue) {
      case TAB_BASIC:
        conversionType = UnitConversionType.BASIC;
        break;
      case TAB_PRODUCT:
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
  // Einheit hinzufügen → PopUp schliessen
  // ------------------------------------------ */
  const onPopUpClose = () => {
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
  // Selektives Speichern
  // ------------------------------------------ */
  /**
   * Speichert nur geänderte, neue und gelöschte Zeilen.
   * Unveränderte Umrechnungen werden nicht in die DB geschrieben.
   */
  const onSaveClick = async () => {
    const snapshotBasicMap = new Map(
      basicSnapshot.current.map((conversion) => [conversion.uid, conversion])
    );
    const snapshotProductMap = new Map(
      productSnapshot.current.map((conversion) => [conversion.uid, conversion])
    );

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
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | React.SyntheticEvent<Element, Event>,
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
  const onChangeEditTableField = React.useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const unitConversionField = event.target.id.split("_");
    switch (tabValue) {
      case TAB_BASIC:
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE,
          payload: {
            uid: unitConversionField[1],
            field: unitConversionField[0],
            value: event.target.value,
          },
        });
        break;
      case TAB_PRODUCT:
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
  }, [tabValue]);

  /* ------------------------------------------
  // Eintrag aus Tabelle löschen
  // ------------------------------------------ */
  const onTableRowDelete = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const pressedButton = event.currentTarget.id.split("_");
    switch (tabValue) {
      case TAB_BASIC:
        dispatch({
          type: ReducerActions.DELETE_BASIC_UNIT_CONVERSION,
          payload: {uid: pressedButton[1]},
        });
        break;
      case TAB_PRODUCT:
        dispatch({
          type: ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION,
          payload: {uid: pressedButton[1]},
        });
        break;
      default:
        throw new Error(TEXT_TYPE_UNKNOWN);
    }
  }, [tabValue]);

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
              <Tab label={TEXT_BASIC} />
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

          {tabValue === TAB_BASIC && (
            <Grid key={"BasicConversionPanel"} size={12} sx={{mt: 2}}>
              <ConversionPanel
                title={TEXT_BASIC}
                unitConversions={state.unitConversionBasic}
                tableColumns={BASIC_TABLE_COLUMNS}
                onChangeField={onChangeEditTableField}
                onDeleteClick={onTableRowDelete}
                editMode={editMode}
                showProductName={false}
              />
            </Grid>
          )}
          {tabValue === TAB_PRODUCT && (
            <Grid key={"ProductConversionPanel"} size={12} sx={{mt: 2}}>
              <ConversionPanel
                title={TEXT_PRODUCT_SPECIFIC}
                unitConversions={state.unitConversionProduct}
                tableColumns={PRODUCT_TABLE_COLUMNS}
                onChangeField={onChangeEditTableField}
                onDeleteClick={onTableRowDelete}
                editMode={editMode}
                showProductName={true}
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
// ====================== Conversion Panel ===========================
// =================================================================== */

/**
 * Gemeinsames Panel für Basis- und Produkt-Umrechnungen.
 *
 * Im Lesemodus wird eine EnhancedTable angezeigt; im Bearbeitungsmodus
 * editierbare Zeilen mit Löschen-Button.
 *
 * @param title - Überschrift des Panels.
 * @param unitConversions - Liste der Umrechnungen.
 * @param tableColumns - Spalten-Definition für die EnhancedTable.
 * @param onChangeField - Handler für Textfeld-Änderungen.
 * @param onDeleteClick - Handler zum Löschen einer Zeile.
 * @param editMode - Ob der Bearbeitungsmodus aktiv ist.
 * @param showProductName - Ob die Produktname-Spalte angezeigt wird.
 */
/** Grid-Spaltenbreiten — entweder ein fixer Wert oder ein responsive-Objekt. */
type GridSize = number | {xs: number; sm: number};

/** Spaltenbreiten für die editierbaren Umrechnungszeilen. */
type ColumnSizes = {
  product?: GridSize;
  denominator: GridSize;
  fromUnit: GridSize;
  numerator: GridSize;
  toUnit: GridSize;
  deleteBtn: GridSize;
};

interface ConversionPanelProps {
  title: string;
  unitConversions: UnitConversion[];
  tableColumns: Column[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  editMode: boolean;
  showProductName: boolean;
}

const ConversionPanel = React.memo(({
  title,
  unitConversions,
  tableColumns,
  onChangeField,
  onDeleteClick,
  editMode,
  showProductName,
}: ConversionPanelProps) => {
  const classes = useCustomStyles();

  // Spaltenbreiten für Basis (ohne Produkt) und Produkt (mit Produkt)
  const columnSizes: ColumnSizes = showProductName
    ? {
        product: {xs: 12, sm: 4},
        denominator: {xs: 3, sm: 2},
        fromUnit: {xs: 2, sm: 1},
        numerator: {xs: 3, sm: 2},
        toUnit: {xs: 2, sm: 1},
        deleteBtn: {xs: 2, sm: 2},
      }
    : {
        denominator: 3,
        fromUnit: 2,
        numerator: 3,
        toUnit: 2,
        deleteBtn: 2,
      };

  return (
    <Card sx={classes.card}>
      <CardContent sx={classes.cardContent}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {title}
        </Typography>
        {editMode ? (
          <Grid container spacing={2}>
            {/* Spaltenköpfe */}
            {showProductName && (
              <Grid size={{xs: 12, sm: 4}}>
                <Typography variant="subtitle1">{TEXT_PRODUCT}</Typography>
              </Grid>
            )}
            <Grid size={showProductName ? {xs: 3, sm: 2} : 3}>
              <Typography variant="subtitle1" align="center">
                {TEXT_DENOMINATOR}
              </Typography>
            </Grid>
            <Grid size={showProductName ? {xs: 2, sm: 1} : 2}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_FROM}
              </Typography>
            </Grid>
            <Grid size={showProductName ? {xs: 3, sm: 2} : 3}>
              <Typography variant="subtitle1" align="center">
                {TEXT_NUMERATOR}
              </Typography>
            </Grid>
            <Grid size={showProductName ? {xs: 2, sm: 1} : 2}>
              <Typography variant="subtitle1" align="center">
                {TEXT_UNIT_TO}
              </Typography>
            </Grid>
            <Grid size={2} />

            <Grid size={12}>
              <Divider />
            </Grid>

            {unitConversions.map((conversionRule) => (
              <ConversionEditRow
                key={"conversionRow_" + conversionRule.uid}
                unitConversion={conversionRule}
                onChangeField={onChangeField}
                onDeleteClick={onDeleteClick}
                showProductName={showProductName}
                columnSizes={columnSizes}
              />
            ))}
          </Grid>
        ) : (
          <EnhancedTable
            tableData={unitConversions}
            tableColumns={tableColumns}
            keyColum={"uid"}
          />
        )}
      </CardContent>
    </Card>
  );
});

/* ===================================================================
// ====================== Conversion Edit Row ========================
// =================================================================== */

/**
 * Editierbare Zeile für eine Einheitenumrechnung.
 *
 * Wird sowohl für Basis- als auch für Produkt-Umrechnungen verwendet.
 * Bei `showProductName=true` wird zusätzlich der Produktname angezeigt.
 *
 * @param unitConversion - Die angezeigte Umrechnung.
 * @param onChangeField - Handler für Textfeld-Änderungen.
 * @param onDeleteClick - Handler zum Löschen dieser Zeile.
 * @param showProductName - Ob die Produktname-Spalte angezeigt wird.
 * @param columnSizes - Grid-Spaltenbreiten (responsive oder fix).
 */
interface ConversionEditRowProps {
  unitConversion: UnitConversion;
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showProductName: boolean;
  columnSizes: ColumnSizes;
}

const ConversionEditRow = React.memo(({
  unitConversion,
  onChangeField,
  onDeleteClick,
  showProductName,
  columnSizes,
}: ConversionEditRowProps) => {
  return (
    <React.Fragment>
      {showProductName && (
        <Grid
          key={"grid_productName_" + unitConversion.uid}
          size={columnSizes.product as {xs: number; sm: number}}
        >
          <Typography color="textSecondary">
            {unitConversion.productName}
          </Typography>
        </Grid>
      )}
      <Grid
        key={"grid_denominator_" + unitConversion.uid}
        size={columnSizes.denominator}
      >
        <TextField
          id={"denominator_" + unitConversion.uid}
          key={"denominator_" + unitConversion.uid}
          value={unitConversion.denominator}
          onChange={onChangeField}
          fullWidth
          slotProps={{htmlInput: {style: {textAlign: "center"}}}}
        />
      </Grid>
      <Grid
        key={"grid_fromUnit_" + unitConversion.uid}
        size={columnSizes.fromUnit}
      >
        <Typography color="textSecondary" align="center">
          {unitConversion.fromUnit}
        </Typography>
      </Grid>
      <Grid
        key={"grid_numerator_" + unitConversion.uid}
        size={columnSizes.numerator}
      >
        <TextField
          id={"numerator_" + unitConversion.uid}
          key={"numerator_" + unitConversion.uid}
          value={unitConversion.numerator}
          onChange={onChangeField}
          fullWidth
          slotProps={{htmlInput: {style: {textAlign: "center"}}}}
        />
      </Grid>
      <Grid
        key={"grid_toUnit_" + unitConversion.uid}
        size={columnSizes.toUnit}
      >
        <Typography color="textSecondary" align="center">
          {unitConversion.toUnit}
        </Typography>
      </Grid>
      <Grid
        key={"grid_deleteRow_" + unitConversion.uid}
        size={columnSizes.deleteBtn}
      >
        <IconButton
          color="primary"
          id={"deleteRow_" + unitConversion.uid}
          onClick={onDeleteClick}
          size="large"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Grid>
      <Grid key={"grid_divider_" + unitConversion.uid} size={12}>
        <Divider />
      </Grid>
    </React.Fragment>
  );
});

export {UnitConversionPage};
