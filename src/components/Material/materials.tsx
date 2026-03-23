/**
 * MaterialPage — Übersichtsseite für Materialien (Stammdaten).
 *
 * Zeigt alle Materialien tabellarisch an und erlaubt das Bearbeiten
 * von Name, Typ und Verwendbarkeit. Nur geänderte Materialien werden
 * beim Speichern in die Datenbank geschrieben.
 */
import React, {SyntheticEvent, useCallback} from "react";
import * as Sentry from "@sentry/react";

import {
  Container,
  Backdrop,
  CircularProgress,
  Typography,
  Card,
  CardContent,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Stack,
  useTheme,
  SnackbarCloseReason,
} from "@mui/material";

import {
  MATERIALS as TEXT_MATERIALS,
  BUTTON_EDIT as TEXT_BUTTON_EDIT,
  BUTTON_SAVE as TEXT_BUTTON_SAVE,
  BUTTON_CANCEL as TEXT_BUTTON_CANCEL,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
  FIELD_PRODUCT as TEXT_FIELD_PRODUCT,
  MATERIAL_TYPE as TEXT_MATERIAL_TYPE,
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
  USABLE as TEXT_USABLE,
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  FROM as TEXT_FROM,
} from "../../constants/text";
import {Role as Roles} from "../../constants/roles";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";
import {EnhancedTable,
  TableColumnTypes,
  ColumnTextAlign,
} from "../Shared/enhancedTable";
import {DialogMaterial, MaterialDialog} from "./dialogMaterial";
import {AlertMessage} from "../Shared/AlertMessage";

import EditIcon from "@mui/icons-material/Edit";

import {CustomSnackbar,
  SNACKBAR_INITIAL_STATE_VALUES,
  SnackbarState,
} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";
import {SearchPanel} from "../Shared/searchPanel";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {Material, MaterialType} from "./material.types";
import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

enum ReducerActions {
  MATERIALS_FETCH_INIT,
  MATERIALS_FETCH_SUCCESS,
  MATERIAL_UPDATED,
  MATERIALS_SAVED,
  MATERIALS_EDIT_CANCELLED,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

/**
 * Diskriminierte Union für typsichere Reducer-Actions.
 */
type ReducerAction =
  | {type: ReducerActions.MATERIALS_FETCH_INIT}
  | {type: ReducerActions.MATERIALS_FETCH_SUCCESS; payload: Material[]}
  | {type: ReducerActions.MATERIAL_UPDATED; payload: Material}
  | {type: ReducerActions.MATERIALS_SAVED}
  | {type: ReducerActions.MATERIALS_EDIT_CANCELLED; payload: Material[]}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/**
 * State der MaterialPage.
 *
 * @property materials - Aktuelle Liste aller Materialien (inkl. laufender Änderungen)
 * @property changedUids - UIDs der Materialien, die seit dem letzten Speichern geändert wurden
 * @property error - Fehlerobjekt bei DB-Problemen
 * @property isLoading - Ladezustand
 * @property snackbar - Snackbar-Zustand
 */
type State = {
  materials: Material[];
  changedUids: Set<string>;
  error: Error | null;
  isLoading: boolean;
  snackbar: SnackbarState;
};

const initialState: State = {
  materials: [],
  changedUids: new Set(),
  error: null,
  isLoading: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

/**
 * Reducer für die MaterialPage.
 * Verwaltet Materialien, geänderte UIDs, Ladezustand, Fehler und Snackbar.
 *
 * @param state - Aktueller State
 * @param action - Auszuführende Aktion
 * @returns Neuer State
 */
const materialsReducer = (state: State, action: ReducerAction): State => {
  switch (action.type) {
    case ReducerActions.MATERIALS_FETCH_INIT:
      return {...state, isLoading: true, error: null};

    case ReducerActions.MATERIALS_FETCH_SUCCESS:
      return {
        ...state,
        materials: action.payload,
        changedUids: new Set(),
        isLoading: false,
      };

    case ReducerActions.MATERIAL_UPDATED: {
      // Geändertes Material immutabel ersetzen und UID als geändert markieren
      const updatedMaterials = state.materials.map((material) =>
        material.uid === action.payload.uid ? action.payload : material
      );
      const changedUids = new Set(state.changedUids);
      changedUids.add(action.payload.uid);
      return {...state, materials: updatedMaterials, changedUids};
    }

    case ReducerActions.MATERIALS_SAVED:
      return {
        ...state,
        changedUids: new Set(),
        snackbar: {open: true, severity: "success", message: TEXT_SAVE_SUCCESS},
      };

    case ReducerActions.MATERIALS_EDIT_CANCELLED:
      // Snapshot wiederherstellen und geänderte UIDs zurücksetzen
      return {
        ...state,
        materials: action.payload,
        changedUids: new Set(),
      };

    case ReducerActions.SNACKBAR_CLOSE:
      return {...state, snackbar: {...state.snackbar, open: false}};

    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload, isLoading: false};

    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

/** Anfangswerte für den Material-Bearbeitungs-Popup. */
const MATERIAL_POPUP_VALUES = {
  materialName: "",
  materialUid: "",
  materialType: MaterialType.none,
  usable: false,
  popUpOpen: false,
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptseite für Materialien (Stammdaten).
 *
 * Lädt alle Materialien aus der DB, zeigt sie in einer Tabelle an
 * und schreibt beim Speichern nur die tatsächlich geänderten zurück.
 *
 * @example
 * <MaterialPage />
 */
const MaterialPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [state, dispatch] = React.useReducer(materialsReducer, initialState);
  const [editMode, setEditMode] = React.useState(false);

  /** Snapshot der Materialien beim Wechsel in den Bearbeitungsmodus. */
  const materialsSnapshot = React.useRef<Material[]>([]);

  /* ------------------------------------------
  // Daten aus DB holen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.MATERIALS_FETCH_INIT});
    database.materials
      .getAllMaterials(false)
      .then((result) => {
        dispatch({
          type: ReducerActions.MATERIALS_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error, {extra: {context: "Materialien laden"}});
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  }, []);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Bearbeitungsmodus aktivieren
  // ------------------------------------------ */
  const onEditClick = () => {
    // Snapshot für Cancel speichern
    materialsSnapshot.current = state.materials.map((material) => ({...material}));
    setEditMode(true);
  };

  /* ------------------------------------------
  // Abbrechen ohne Speichern
  // ------------------------------------------ */
  const onCancelClick = () => {
    dispatch({
      type: ReducerActions.MATERIALS_EDIT_CANCELLED,
      payload: materialsSnapshot.current,
    });
    setEditMode(false);
  };

  /* ------------------------------------------
  // Nur geänderte Materialien speichern
  // ------------------------------------------ */
  const onSave = async () => {
    const changedMaterials = state.materials.filter((material) =>
      state.changedUids.has(material.uid)
    );
    if (changedMaterials.length === 0) return;

    try {
      for (const material of changedMaterials) {
        await database.materials.updateMaterial(material, authUser);
      }
      dispatch({type: ReducerActions.MATERIALS_SAVED});
    } catch (error) {
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Material geändert (inline oder über Dialog)
  // ------------------------------------------ */
  const onMaterialChange = (material: Material) => {
    dispatch({type: ReducerActions.MATERIAL_UPDATED, payload: material});
  };

  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") return;
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_MATERIALS} />
      <MaterialsButtonRow
        editMode={editMode}
        onEdit={onEditClick}
        onSave={onSave}
        onCancel={onCancelClick}
        authUser={authUser}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
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
        <MaterialsTable
          materials={state.materials}
          editMode={editMode}
          onMaterialChange={onMaterialChange}
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
 * Props für die MaterialsButtonRow.
 *
 * @property editMode - Ob der Bearbeitungsmodus aktiv ist
 * @property onEdit - Callback zum Aktivieren des Bearbeitungsmodus
 * @property onSave - Callback zum Speichern der Änderungen
 * @property onCancel - Callback zum Abbrechen ohne Speichern
 * @property authUser - Der angemeldete Benutzer (für Rollenprüfung)
 */
interface MaterialsButtonRowProps {
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  authUser: AuthUser;
}

/**
 * Aktionsbuttons für die MaterialPage (Bearbeiten, Speichern, Abbrechen).
 * Bearbeiten ist nur für Admins und Community-Leiter sichtbar.
 */
const MaterialsButtonRow = ({
  editMode,
  onEdit,
  onCancel,
  onSave,
  authUser,
}: MaterialsButtonRowProps) => {
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
          label: TEXT_BUTTON_EDIT,
          variant: "contained",
          color: "primary",
          onClick: onEdit,
        },
        {
          id: "save",
          hero: true,
          visible: editMode,
          label: TEXT_BUTTON_SAVE,
          variant: "contained",
          color: "primary",
          onClick: onSave,
        },
        {
          id: "cancel",
          hero: true,
          visible: editMode,
          label: TEXT_BUTTON_CANCEL,
          variant: "outlined",
          color: "primary",
          onClick: onCancel,
        },
      ]}
    />
  );
};

/* ===================================================================
// =========================== Material Panel ========================
// =================================================================== */

/**
 * Props für MaterialsTable.
 *
 * @property materials - Aktuelle Materialliste (aus dem Page-Reducer)
 * @property editMode - Ob der Bearbeitungsmodus aktiv ist
 * @property onMaterialChange - Callback wenn ein Material geändert wird
 * @property authUser - Der angemeldete Benutzer
 */
interface MaterialsTableProps {
  materials: Material[];
  editMode: boolean;
  onMaterialChange: (material: Material) => void;
  authUser: AuthUser;
}

/** UI-Zeilenstruktur für die Materialtabelle. */
interface MaterialLineUi {
  uid: Material["uid"];
  name: Material["name"];
  type: JSX.Element;
  usable: JSX.Element;
}

/**
 * Tabelle mit Suchfeld und Bearbeitungs-Dialog für Materialien.
 * Alle Daten kommen via Props — kein eigener Materials-State.
 * `filteredMaterials` und `filteredMaterialsUi` werden per `useMemo` berechnet.
 */
const MaterialsTable = ({
  materials,
  editMode,
  onMaterialChange,
  authUser,
}: MaterialsTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [materialPopUpValues, setMaterialPopUpValues] = React.useState(
    MATERIAL_POPUP_VALUES
  );

  const classes = useCustomStyles();
  const theme = useTheme();

  const tableColumns = React.useMemo(() => getTableColumns(editMode), [editMode]);

  /* ------------------------------------------
  // Inline-Änderungen (Radio + Checkbox)
  // ------------------------------------------ */
  const handleRadioButtonChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const uid = event.target.name.split("_")[1];
      const material = materials.find((candidate) => candidate.uid === uid);
      if (!material) return;
      onMaterialChange({
        ...material,
        type: parseInt(event.target.value) as MaterialType,
      });
    },
    [materials, onMaterialChange]
  );

  const handleCheckBoxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const uid = event.target.id.split("_")[1];
      const material = materials.find((candidate) => candidate.uid === uid);
      if (!material) return;
      onMaterialChange({...material, usable: event.target.checked});
    },
    [materials, onMaterialChange]
  );

  /* ------------------------------------------
  // Gefilterte Materialien (abgeleitet von materials + searchString)
  // ------------------------------------------ */
  const filteredMaterials = React.useMemo(() => {
    if (!searchString) return materials;
    const lower = searchString.toLowerCase();
    return materials.filter((material) => material.name.toLowerCase().includes(lower));
  }, [materials, searchString]);

  /* ------------------------------------------
  // UI-Darstellung (abgeleitet von filteredMaterials + editMode)
  // ------------------------------------------ */
  const filteredMaterialsUi = React.useMemo(
    () => prepareMaterialsListForUi(filteredMaterials, editMode, handleRadioButtonChange, handleCheckBoxChange),
    [filteredMaterials, editMode, handleRadioButtonChange, handleCheckBoxChange]
  );

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const clearSearchString = () => {
    setSearchString("");
  };

  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setSearchString(event.target.value);
  };

  /* ------------------------------------------
  // Popup öffnen
  // ------------------------------------------ */
  const openPopUp = (
    _event:
      | React.MouseEvent<HTMLSpanElement, MouseEvent>
      | React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    materialToEdit: MaterialLineUi | string
  ) => {
    const uid =
      typeof materialToEdit === "string" ? materialToEdit : materialToEdit.uid;
    const material = materials.find((candidate) => candidate.uid === uid);
    if (!material) return;

    setMaterialPopUpValues({
      materialUid: material.uid,
      materialName: material.name,
      materialType: material.type,
      usable: material.usable,
      popUpOpen: true,
    });
  };

  const onPopUpClose = () => {
    setMaterialPopUpValues(MATERIAL_POPUP_VALUES);
  };

  const onPopUpOk = (changedMaterial: Material) => {
    onMaterialChange(changedMaterial);
    setMaterialPopUpValues(MATERIAL_POPUP_VALUES);
  };

  return (
    <React.Fragment>
      <Card sx={classes.card} key={"materialTablePanel"}>
        <CardContent sx={classes.cardContent} key={"materialTableContent"}>
          <Stack sx={{marginBottom: theme.spacing(1)}}>
            <SearchPanel
              searchString={searchString}
              onUpdateSearchString={updateSearchString}
              onClearSearchString={clearSearchString}
            />
            <Typography
              variant="body2"
              sx={{mt: "0.5em", mb: "2em"}}
            >
              {filteredMaterialsUi.length === materials.length
                ? `${materials.length} ${TEXT_MATERIALS}`
                : `${filteredMaterialsUi.length} ${TEXT_FROM.toLowerCase()} ${
                    materials.length
                  } ${TEXT_MATERIALS}`}
            </Typography>

            <EnhancedTable
              tableData={filteredMaterialsUi}
              tableColumns={tableColumns}
              keyColum={"uid"}
              onIconClick={openPopUp}
            />
          </Stack>
        </CardContent>
      </Card>
      <DialogMaterial
        dialogType={MaterialDialog.EDIT}
        materialUid={materialPopUpValues.materialUid}
        materialName={materialPopUpValues.materialName}
        materialType={materialPopUpValues.materialType}
        materialUsable={materialPopUpValues.usable}
        materials={materials}
        dialogOpen={materialPopUpValues.popUpOpen}
        handleOk={onPopUpOk}
        handleClose={onPopUpClose}
        authUser={authUser}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Hilfsfunktionen ============================
// =================================================================== */

/**
 * Erzeugt die Spaltendefinitionen für die Materialtabelle.
 *
 * @param editMode - Ob der Bearbeitungsmodus aktiv ist (steuert Edit-Button-Spalte).
 * @returns Array von Spaltendefinitionen.
 */
function getTableColumns(editMode: boolean) {
  return [
    {
      id: "edit",
      type: TableColumnTypes.button,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      visible: editMode,
      label: "",
      iconButton: <EditIcon fontSize="small" />,
    },
    {
      id: "uid",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      label: TEXT_UID,
      visible: false,
    },
    {
      id: "name",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_FIELD_PRODUCT,
      visible: true,
    },
    {
      id: "type",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_MATERIAL_TYPE,
      visible: true,
    },
    {
      id: "usable",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      label: TEXT_USABLE,
      visible: true,
    },
  ];
}

/**
 * Bereitet die Materialliste für die UI-Tabelle auf.
 * Wandelt Typ und Verwendbarkeit in JSX-Elemente um.
 *
 * @param materials - Zu rendernde Materialien
 * @param editMode - Ob Steuerelemente aktiviert sein sollen
 * @param onRadioChange - Handler für Typ-Änderungen
 * @param onCheckboxChange - Handler für Verwendbarkeits-Änderungen
 * @returns Array von UI-Zeilen
 */
function prepareMaterialsListForUi(
  materials: Material[],
  editMode: boolean,
  onRadioChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
  onCheckboxChange: (event: React.ChangeEvent<HTMLInputElement>) => void
): MaterialLineUi[] {
  return materials.map((material) => ({
    uid: material.uid,
    name: material.name,
    usable: (
      <Checkbox
        id={"checkbox_" + material.uid}
        disabled={!editMode}
        checked={material.usable}
        onChange={onCheckboxChange}
      />
    ),
    type: (
      <RadioGroup
        aria-label="Typ"
        name={"radioGroup_" + material.uid}
        key={"radioGroup_" + material.uid}
        value={material.type}
        onChange={onRadioChange}
        row
      >
        <FormControlLabel
          value={MaterialType.consumable}
          control={<Radio size="small" disabled={!editMode} />}
          label={TEXT_MATERIAL_TYPE_CONSUMABLE}
        />
        <FormControlLabel
          value={MaterialType.usage}
          control={<Radio size="small" disabled={!editMode} />}
          label={TEXT_MATERIAL_TYPE_USAGE}
        />
      </RadioGroup>
    ),
  }));
}

export {MaterialPage, materialsReducer, ReducerActions, initialState};
export type {State, ReducerAction};
