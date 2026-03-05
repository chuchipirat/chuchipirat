/**
 * UnitsPage — Übersichtsseite für Einheiten (Stammdaten).
 *
 * Zeigt alle Einheiten tabellarisch an. Im Bearbeitungsmodus können
 * Name und Dimension geändert werden; nur tatsächlich geänderte
 * Einheiten werden beim Speichern in die DB geschrieben. Admins
 * können Einheiten über einen ConfirmSecure-Dialog löschen.
 */
import React, {SyntheticEvent} from "react";

import {
  Container,
  Typography,
  TextField,
  Divider,
  Card,
  CardContent,
  Backdrop,
  CircularProgress,
  Select,
  MenuItem,
  SnackbarCloseReason,
  Stack,
  SelectChangeEvent,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  NAME as TEXT_NAME,
  UNIT as TEXT_UNIT,
  DIMENSION as TEXT_DIMENSION,
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  UNIT_CREATED as TEXT_UNIT_CREATED,
  UNIT_DELETED as TEXT_UNIT_DELETED,
  UNITS as TEXT_UNITS,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  ADD as TEXT_ADD,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UNIT_DIMENSION as TEXT_UNIT_DIMENSION,
  DIALOG_TITLE_DELETION_CONFIRMATION as TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
  DIALOG_SUBTITLE_DELETION_CONFIRMATION as TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
  DIALOG_TEXT_DELETION_CONFIRMATION as TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
} from "../../constants/text";
import Role from "../../constants/roles";

import PageTitle from "../Shared/pageTitle";
import ButtonRow from "../Shared/buttonRow";
import EnhancedTable, {
  Column,
  ColumnTextAlign,
  TableColumnTypes,
} from "../Shared/enhancedTable";
import DialogCreateUnit from "./dialogCreateUnit";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
} from "../Shared/customSnackbar";
import AlertMessage from "../Shared/AlertMessage";

import useCustomStyles from "../../constants/styles";

import Unit, {UnitDimension} from "./unit.class";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {
  DialogType,
  useCustomDialog,
} from "../Shared/customDialogContext";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/**
 * Alle möglichen Aktionen des Reducers.
 */
enum ReducerActions {
  UNITS_FETCH_INIT,
  UNITS_FETCH_SUCCESS,
  UNITS_NEW_UNIT_ADDED,
  UNITS_ON_CHANGE,
  UNIT_DELETED,
  UNITS_SAVED,
  UNITS_EDIT_CANCELLED,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

/**
 * Diskriminierte Union für typsichere Reducer-Actions.
 */
type ReducerAction =
  | {type: ReducerActions.UNITS_FETCH_INIT}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {type: ReducerActions.UNITS_NEW_UNIT_ADDED; payload: Unit}
  | {
      type: ReducerActions.UNITS_ON_CHANGE;
      payload: {key: string; field: string; value: string};
    }
  | {type: ReducerActions.UNIT_DELETED; payload: string}
  | {type: ReducerActions.UNITS_SAVED}
  | {type: ReducerActions.UNITS_EDIT_CANCELLED; payload: Unit[]}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/**
 * State der UnitsPage.
 *
 * @param units - Liste aller Einheiten
 * @param changedKeys - Schlüssel der seit dem letzten Speichern geänderten Einheiten
 * @param error - Letzter aufgetretener Fehler (oder null)
 * @param isError - Ob aktuell ein Fehler vorliegt
 * @param isLoading - Ob gerade Daten geladen werden
 * @param snackbar - Zustand der Snackbar-Benachrichtigung
 */
type State = {
  units: Unit[];
  changedKeys: Set<string>;
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  snackbar: Snackbar;
};

const initialState: State = {
  units: [],
  changedKeys: new Set<string>(),
  isLoading: false,
  isError: false,
  error: null,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

/* ===================================================================
// ======================== Reducer ==================================
// =================================================================== */

/**
 * Reducer für die UnitsPage.
 *
 * Verwaltet Lade-, Bearbeitungs- und Fehlerzustände der Einheitenliste.
 *
 * @param state - Aktueller Zustand
 * @param action - Diskriminierte Union-Action
 * @returns Neuer Zustand
 */
const unitsReducer = (state: State, action: ReducerAction): State => {
  switch (action.type) {
    case ReducerActions.UNITS_FETCH_INIT:
      // Daten werden geladen
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      // Daten erfolgreich geholt — changedKeys zurücksetzen
      return {
        ...state,
        units: action.payload,
        changedKeys: new Set<string>(),
        isLoading: false,
        isError: false,
      };
    case ReducerActions.UNITS_NEW_UNIT_ADDED:
      // Neue Einheit wurde angelegt
      return {
        ...state,
        isError: false,
        changedKeys: new Set<string>(),
        units: state.units.concat([action.payload]),
        snackbar: {
          severity: "success",
          message: TEXT_UNIT_CREATED(
            action.payload.key + " - " + action.payload.name
          ),
          open: true,
        },
      };
    case ReducerActions.UNITS_ON_CHANGE: {
      // Feldwert geändert — immutable update + key als geändert markieren
      const updatedKeys = new Set(state.changedKeys);
      updatedKeys.add(action.payload.key);
      return {
        ...state,
        changedKeys: updatedKeys,
        units: state.units.map((unit) => {
          if (unit.key === action.payload.key) {
            return {...unit, [action.payload.field]: action.payload.value};
          }
          return unit;
        }),
      };
    }
    case ReducerActions.UNIT_DELETED:
      // Einheit wurde gelöscht
      return {
        ...state,
        isError: false,
        changedKeys: new Set<string>(),
        units: state.units.filter((unit) => unit.key !== action.payload),
        snackbar: {
          severity: "success",
          message: TEXT_UNIT_DELETED(action.payload),
          open: true,
        },
      };
    case ReducerActions.UNITS_SAVED:
      // Nur geänderte Einheiten gespeichert — changedKeys zurücksetzen
      return {
        ...state,
        isError: false,
        error: null,
        changedKeys: new Set<string>(),
        snackbar: {
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
          open: true,
        },
      };
    case ReducerActions.UNITS_EDIT_CANCELLED:
      // Änderungen verwerfen — Snapshot wiederherstellen
      return {
        ...state,
        units: action.payload,
        changedKeys: new Set<string>(),
      };
    case ReducerActions.GENERIC_ERROR:
      // Allgemeiner Fehler
      return {
        ...state,
        isError: true,
        error: action.payload,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      // Snackbar schliessen
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    default: {
      // Exhaustive-Check: TypeScript meldet einen Fehler, falls ein
      // neuer ReducerActions-Wert nicht behandelt wird.
      const _exhaustiveCheck: never = action;
      throw new Error(
        `Unbekannter ActionType: ${JSON.stringify(_exhaustiveCheck)}`
      );
    }
  }
};

const TABLE_COLUMS: Column[] = [
  {
    id: "key",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.left,
    disablePadding: false,
    label: TEXT_UNIT,
    visible: true,
  },
  {
    id: "name",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.left,
    disablePadding: false,
    label: TEXT_NAME,
    visible: true,
  },
  {
    id: "dimension",
    type: TableColumnTypes.string,
    textAlign: ColumnTextAlign.left,
    disablePadding: false,
    label: TEXT_DIMENSION,
    visible: true,
  },
];

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */

/**
 * Hauptkomponente für die Einheitenverwaltung.
 *
 * Lädt alle Einheiten beim Mount, bietet einen Bearbeitungsmodus
 * zum Ändern von Name und Dimension sowie das Anlegen und Löschen
 * von Einheiten. Beim Speichern werden nur tatsächlich geänderte
 * Einheiten in die DB geschrieben.
 */
const UnitsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(unitsReducer, initialState);

  const [unitCreateValues, setUnitCreateValues] = React.useState({
    popUpOpen: false,
  });
  const [editMode, setEditMode] = React.useState(false);
  // Snapshot der Einheiten beim Wechsel in den Bearbeitungsmodus —
  // wird bei Abbruch verwendet, um Änderungen zu verwerfen.
  const unitsSnapshot = React.useRef<Unit[]>([]);

  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.UNITS_FETCH_INIT});

    database.units
      .getAllUnits()
      .then((result) => {
        dispatch({
          type: ReducerActions.UNITS_FETCH_SUCCESS,
          payload: result as Unit[],
        });
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // onChangeField
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLInputElement> | SelectChangeEvent
  ) => {
    const unitField = event.target.name.split("_");

    dispatch({
      type: ReducerActions.UNITS_ON_CHANGE,
      payload: {
        key: unitField[1],
        field: unitField[0],
        value: event.target.value,
      },
    });
  };

  /* ------------------------------------------
  // Speichern (nur geänderte Einheiten)
  // ------------------------------------------ */
  /**
   * Speichert nur die seit dem letzten Speichern geänderten Einheiten.
   * Unveränderte Einheiten werden nicht in die DB geschrieben.
   */
  const onSaveClick = async () => {
    const changedUnits = state.units.filter((unit) =>
      state.changedKeys.has(unit.key)
    );
    if (changedUnits.length === 0) {
      return;
    }
    try {
      for (const unit of changedUnits) {
        await database.units.updateUnit(unit, authUser);
      }
      dispatch({type: ReducerActions.UNITS_SAVED});
    } catch (error) {
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Edit Mode: Bearbeiten starten
  // ------------------------------------------ */
  const onEditClick = () => {
    // Snapshot speichern, damit Abbruch die Änderungen rückgängig machen kann
    unitsSnapshot.current = state.units.map((unit) => ({...unit}));
    setEditMode(true);
  };

  /* ------------------------------------------
  // Edit Mode: Bearbeiten abbrechen
  // ------------------------------------------ */
  const onCancelEdit = () => {
    dispatch({
      type: ReducerActions.UNITS_EDIT_CANCELLED,
      payload: unitsSnapshot.current,
    });
    setEditMode(false);
  };

  /* ------------------------------------------
  // PopUp öffnen
  // ------------------------------------------ */
  const onAddUnitClick = () => {
    setUnitCreateValues({...unitCreateValues, popUpOpen: true});
  };

  /* ------------------------------------------
  // Einheit hinzufügen --> PopUp schliessen
  // ------------------------------------------ */
  const onPopUpClose = () => {
    setUnitCreateValues({...unitCreateValues, popUpOpen: false});
  };

  /* ------------------------------------------
  // Einheit wurde angelegt
  // ------------------------------------------ */
  const onAddUnit = (unit: Unit) => {
    database.units
      .createUnit(unit, authUser)
      .then(() => {
        dispatch({
          type: ReducerActions.UNITS_NEW_UNIT_ADDED,
          payload: unit,
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });

    setUnitCreateValues({...unitCreateValues, popUpOpen: false});
  };

  /* ------------------------------------------
  // Einheit löschen (mit ConfirmSecure-Dialog)
  // ------------------------------------------ */
  /**
   * Öffnet den ConfirmSecure-Dialog für die angegebene Einheit.
   * Die Einheit wird nur gelöscht, wenn der Benutzer den Schlüssel
   * korrekt eingibt und bestätigt.
   *
   * @param unit - Die zu löschende Einheit
   */
  const onDeleteUnit = async (unit: Unit) => {
    const isConfirmed = await customDialog({
      dialogType: DialogType.ConfirmSecure,
      deletionDialogProperties: {confirmationString: unit.key},
      title: TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
      subtitle: TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
      text: TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) {
      return;
    }
    database.units
      .deleteUnit(unit.key, authUser)
      .then(() => {
        dispatch({type: ReducerActions.UNIT_DELETED, payload: unit.key});
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };

  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_UNITS} />
      <ButtonRow
        key="buttons_edit"
        buttons={[
          {
            id: "edit",
            hero: true,
            visible: !editMode && authUser.roles.includes(Role.admin),
            label: TEXT_EDIT,
            variant: "contained",
            color: "primary",
            onClick: onEditClick,
          },
          {
            id: "save",
            hero: true,
            visible: editMode && authUser.roles.includes(Role.admin),
            label: TEXT_SAVE,
            variant: "outlined",
            color: "primary",
            onClick: onSaveClick,
          },
          {
            id: "add",
            hero: true,
            visible: editMode && authUser.roles.includes(Role.admin),
            label: TEXT_ADD,
            variant: "contained",
            color: "primary",
            onClick: onAddUnitClick,
          },
          {
            id: "cancel",
            hero: true,
            visible: editMode && authUser.roles.includes(Role.admin),
            label: TEXT_CANCEL,
            variant: "text",
            color: "primary",
            onClick: onCancelEdit,
          },
        ]}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Stack spacing={2}>
          {state.isError && (
            <AlertMessage
              error={state.error as Error}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}
          {/* Tabelle */}
          <TablePanel
            units={state.units}
            editMode={editMode}
            onChangeField={onChangeField}
            onChangeSelect={onChangeField}
            onDeleteUnit={onDeleteUnit}
          />
        </Stack>
      </Container>
      <DialogCreateUnit
        dialogOpen={unitCreateValues.popUpOpen}
        handleCreate={onAddUnit}
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
// =============================== Table =============================
// =================================================================== */

/**
 * Tabellenkomponente für die Einheitenliste.
 *
 * Zeigt im Lesemodus eine EnhancedTable, im Bearbeitungsmodus
 * editierbare Felder sowie einen Löschen-Button pro Zeile.
 *
 * @param units - Liste der Einheiten
 * @param editMode - Ob der Bearbeitungsmodus aktiv ist
 * @param onChangeField - Handler für Textfeld-Änderungen
 * @param onChangeSelect - Handler für Select-Änderungen (Dimension)
 * @param onDeleteUnit - Handler zum Löschen einer Einheit
 */
interface TablePanelProps {
  units: Unit[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeSelect: (event: SelectChangeEvent) => void;
  onDeleteUnit: (unit: Unit) => void;
  editMode: boolean;
}
const TablePanel = ({
  units,
  onChangeField,
  onChangeSelect,
  onDeleteUnit,
  editMode,
}: TablePanelProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      <Card sx={classes.card} key={"cardUnits"}>
        <CardContent sx={classes.cardContent} key={"cardContentUnits"}>
          {editMode ? (
            <Grid container spacing={2}>
              {/* Spaltenköpfe — Breiten 3/4/4/1 passend zur Datenzeile */}
              <Grid size={3}>
                <Typography variant="subtitle1">{TEXT_UNIT}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="subtitle1">{TEXT_NAME}</Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="subtitle1">{TEXT_DIMENSION}</Typography>
              </Grid>
              {/* Platzhalter für die Löschen-Spalte */}
              <Grid size={1} />
              {/* Trennlinie korrekt in einer Grid-Zelle, damit die erste
                  Datenzeile korrekt ausgerichtet wird */}
              <Grid size={12}>
                <Divider />
              </Grid>
              {units.map((unit) => (
                <React.Fragment key={"unitFragment_" + unit.key}>
                  <Grid size={3} key={"gridItemKey_" + unit.key}>
                    <TextField
                      id={"key_" + unit.key}
                      key={"key_" + unit.key}
                      name={"key_" + unit.key}
                      disabled
                      value={unit.key}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={4} key={"gridItemName_" + unit.key}>
                    <TextField
                      id={"name_" + unit.key}
                      key={"name_" + unit.key}
                      name={"name_" + unit.key}
                      value={unit.name}
                      onChange={onChangeField}
                      fullWidth
                    />
                  </Grid>
                  <Grid size={4} key={"gridItemDim_" + unit.key}>
                    <Select
                      labelId="unit-dimension"
                      id={"dimension_" + unit.key}
                      name={"dimension_" + unit.key}
                      value={unit.dimension}
                      onChange={onChangeSelect}
                      fullWidth
                    >
                      <MenuItem value={UnitDimension.volume}>
                        {TEXT_UNIT_DIMENSION[UnitDimension.volume]}
                      </MenuItem>
                      <MenuItem value={UnitDimension.mass}>
                        {TEXT_UNIT_DIMENSION[UnitDimension.mass]}
                      </MenuItem>
                      <MenuItem value={UnitDimension.dimensionless}>
                        {TEXT_UNIT_DIMENSION[UnitDimension.dimensionless]}
                      </MenuItem>
                    </Select>
                  </Grid>
                  <Grid size={1} key={"gridItemDelete_" + unit.key}>
                    <IconButton
                      aria-label="Einheit löschen"
                      color="error"
                      onClick={() => onDeleteUnit(unit)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                  <Grid size={12} key={"gridItemDivider_" + unit.key}>
                    <Divider />
                  </Grid>
                </React.Fragment>
              ))}
            </Grid>
          ) : (
            <EnhancedTable
              tableData={units}
              tableColumns={TABLE_COLUMS}
              keyColum={"key"}
            />
          )}
        </CardContent>
      </Card>
    </React.Fragment>
  );
};

export default UnitsPage;
