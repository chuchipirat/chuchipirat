/**
 * MaterialPage — Übersichtsseite für Materialien (Stammdaten).
 *
 * Zeigt alle Materialien tabellarisch an und erlaubt das Bearbeiten
 * von Name, Typ und Verwendbarkeit. Nur geänderte Materialien werden
 * beim Speichern in die Datenbank geschrieben.
 *
 * Enthält QA-Funktionen: Issue-Erkennung, QA-Checkbox, Kontextmenü
 * mit Löschfunktion inkl. Where-Used-Prüfung.
 */
import React, {SyntheticEvent} from "react";
import * as Sentry from "@sentry/react";

import {
  Container,
  Backdrop,
  CircularProgress,
  Typography,
  Checkbox,
  useTheme,
  SnackbarCloseReason,
  Menu,
  MenuItem,
  ListItemIcon,
  IconButton,
  Box,
  Tooltip,
  Select,
  SelectChangeEvent,
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
} from "../../constants/text";
import {
  QA_CHECKED as TEXT_QA_CHECKED,
  QA_ISSUES as TEXT_QA_ISSUES,
  DELETE_MATERIAL as TEXT_DELETE_MATERIAL,
  DELETE_MATERIAL_CONFIRM as TEXT_DELETE_MATERIAL_CONFIRM,
  DELETE_MATERIAL_SUCCESS as TEXT_DELETE_MATERIAL_SUCCESS,
  MATERIAL_IN_USE_WARNING as TEXT_MATERIAL_IN_USE_WARNING,
  MATERIAL_NOT_IN_USE as TEXT_MATERIAL_NOT_IN_USE,
  CONVERT_TO_PRODUCT as TEXT_CONVERT_TO_PRODUCT,
  MATERIAL_CONVERTED_TO_PRODUCT as TEXT_MATERIAL_CONVERTED_TO_PRODUCT,
} from "../../constants/text/materialQa";
import {Role as Roles} from "../../constants/roles";

import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";
import {DialogMaterial, MaterialDialog} from "./dialogMaterial";
import {AlertMessage} from "../Shared/AlertMessage";
import {MaterialsQaBulkActions} from "./materialsQaBulkActions";

import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Cached as CachedIcon,
} from "@mui/icons-material";

import {CustomSnackbar,
  SNACKBAR_INITIAL_STATE_VALUES,
  SnackbarState,
} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";
import {
  MaterialsQaFilterBar,
  QaFilterStatus,
  MaterialTypeFilter,
} from "./materialsQaFilterBar";
import {
  WhereUsedEntry,
  MergeMaterialsResult,
} from "../Database/Repository/AdminOperationsRepository";
import {DialogMergeMaterials} from "./dialogMergeMaterials";
import {DialogConvertMaterialToProduct} from "./dialogConvertMaterialToProduct";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {Material, MaterialType} from "./material.types";
import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {detectMaterialIssues, MaterialIssue} from "./materialQaUtils";

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
  MATERIAL_DELETED,
  ISSUE_FLAGS_LOADED,
  QA_TOGGLE,
  MATERIAL_MERGED,
  MATERIAL_CONVERTED_TO_PRODUCT,
  SELECTED_MATERIALS_CHANGED,
  BULK_QA_CHECK,
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
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {type: ReducerActions.MATERIAL_DELETED; payload: Material}
  | {type: ReducerActions.ISSUE_FLAGS_LOADED; payload: MaterialIssue[]}
  | {type: ReducerActions.QA_TOGGLE; payload: {uid: string; checked: boolean}}
  | {type: ReducerActions.MATERIAL_MERGED; payload: {sourceMaterialUid: string; result: MergeMaterialsResult}}
  | {type: ReducerActions.MATERIAL_CONVERTED_TO_PRODUCT; payload: Material}
  | {type: ReducerActions.SELECTED_MATERIALS_CHANGED; payload: string[]}
  | {type: ReducerActions.BULK_QA_CHECK; payload: string[]};

/**
 * State der MaterialPage.
 *
 * @property materials - Aktuelle Liste aller Materialien (inkl. laufender Änderungen)
 * @property changedUids - UIDs der Materialien, die seit dem letzten Speichern geändert wurden
 * @property error - Fehlerobjekt bei DB-Problemen
 * @property isLoading - Ladezustand
 * @property snackbar - Snackbar-Zustand
 * @property issueFlags - Erkannte Qualitätsprobleme pro Material
 * @property selectedMaterialUids - UIDs der aktuell ausgewählten Materialien (für Merge)
 */
type State = {
  materials: Material[];
  changedUids: Set<string>;
  error: Error | null;
  isLoading: boolean;
  snackbar: SnackbarState;
  issueFlags: MaterialIssue[];
  selectedMaterialUids: string[];
};

const initialState: State = {
  materials: [],
  changedUids: new Set(),
  error: null,
  isLoading: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
  issueFlags: [],
  selectedMaterialUids: [],
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

    case ReducerActions.MATERIAL_DELETED:
      return {
        ...state,
        materials: state.materials.filter(
          (material) => material.uid !== action.payload.uid,
        ),
        snackbar: {
          severity: "success",
          open: true,
          message: TEXT_DELETE_MATERIAL_SUCCESS(action.payload.name),
        },
      };

    case ReducerActions.ISSUE_FLAGS_LOADED:
      return {...state, issueFlags: action.payload};

    case ReducerActions.QA_TOGGLE: {
      const {uid, checked} = action.payload;
      const updatedMaterials = state.materials.map((material) =>
        material.uid === uid
          ? {
              ...material,
              qaChecked: checked,
              qaCheckedAt: checked ? new Date().toISOString() : null,
            }
          : material,
      );
      const changedUids = new Set(state.changedUids);
      changedUids.add(uid);
      return {...state, materials: updatedMaterials, changedUids};
    }

    case ReducerActions.MATERIAL_MERGED:
      return {
        ...state,
        materials: state.materials.filter(
          (material) => material.uid !== action.payload.sourceMaterialUid,
        ),
        selectedMaterialUids: [],
        snackbar: {
          open: true,
          severity: "success",
          message: `Materialien zusammengeführt. ${action.payload.result.recipe_materials} Rezeptmaterialien, ${action.payload.result.material_list_items} Materiallisten, ${action.payload.result.menue_materials} Menüplan, ${action.payload.result.shopping_list_items} Einkaufslisten aktualisiert.`,
        },
      };

    case ReducerActions.MATERIAL_CONVERTED_TO_PRODUCT:
      return {
        ...state,
        materials: state.materials.filter(
          (material) => material.uid !== action.payload.uid,
        ),
        selectedMaterialUids: [],
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_MATERIAL_CONVERTED_TO_PRODUCT(action.payload.name),
        },
      };

    case ReducerActions.SELECTED_MATERIALS_CHANGED:
      return {...state, selectedMaterialUids: action.payload};

    case ReducerActions.BULK_QA_CHECK: {
      const uidSet = new Set(action.payload);
      const updatedMaterials = state.materials.map((material) =>
        uidSet.has(material.uid)
          ? {...material, qaChecked: true, qaCheckedAt: new Date().toISOString()}
          : material,
      );
      const changedUids = new Set(state.changedUids);
      action.payload.forEach((uid) => changedUids.add(uid));
      return {
        ...state,
        materials: updatedMaterials,
        changedUids,
        selectedMaterialUids: [],
      };
    }

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

/** Menschenlesbare Labels für Where-Used-Tabellennamen. */
const WHERE_USED_TABLE_LABELS: Record<string, string> = {
  recipe_materials: "Rezepte (Material)",
  event_material_list_items: "Materiallisten",
  event_menue_materials: "Menüpläne (Material)",
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
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(materialsReducer, initialState);
  const [editMode, setEditMode] = React.useState(false);

  // Merge-Dialog State
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);
  const [mergeSourceUid, setMergeSourceUid] = React.useState("");
  const [mergeTargetUid, setMergeTargetUid] = React.useState("");

  // Convert-Dialog State
  const [convertDialogOpen, setConvertDialogOpen] = React.useState(false);
  const [convertMaterial, setConvertMaterial] = React.useState<Material | null>(null);

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

  // Issue-Detection: Flags bei Materialänderungen neu berechnen
  React.useEffect(() => {
    if (state.materials.length > 0) {
      const issues = detectMaterialIssues(state.materials);
      dispatch({
        type: ReducerActions.ISSUE_FLAGS_LOADED,
        payload: issues,
      });
    }
  }, [state.materials]);

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
  // QA-Toggle
  // ------------------------------------------ */
  const onQaToggle = (uid: string, checked: boolean) => {
    dispatch({type: ReducerActions.QA_TOGGLE, payload: {uid, checked}});
  };

  /* ------------------------------------------
  // Selektion (DataGrid liefert komplettes Array)
  // ------------------------------------------ */
  const onSelectionChange = (uids: string[]) => {
    dispatch({type: ReducerActions.SELECTED_MATERIALS_CHANGED, payload: uids});
  };

  /**
   * Öffnet den Merge-Dialog mit den beiden ausgewählten Materialien.
   */
  const openMergeFromSelection = () => {
    if (state.selectedMaterialUids.length === 2) {
      openMergeDialog(
        state.selectedMaterialUids[0],
        state.selectedMaterialUids[1],
      );
    }
  };

  /* ------------------------------------------
  // Bulk QA-Check
  // ------------------------------------------ */
  const onBulkQaCheck = () => {
    dispatch({
      type: ReducerActions.BULK_QA_CHECK,
      payload: state.selectedMaterialUids,
    });
  };

  /* ------------------------------------------
  // Material löschen (mit Where-Used-Prüfung)
  // ------------------------------------------ */
  const handleDeleteMaterial = async (material: Material) => {
    try {
      const references = await database.adminOps.whereUsed(
        material.uid,
        "material",
      );

      // Dialog-Text zusammenbauen
      let dialogText: string | JSX.Element;
      if (references.length > 0) {
        // Referenzen nach Tabelle gruppieren
        const grouped = new Map<string, WhereUsedEntry[]>();
        for (const entry of references) {
          const existing = grouped.get(entry.table_name) ?? [];
          existing.push(entry);
          grouped.set(entry.table_name, existing);
        }

        dialogText = (
          <React.Fragment>
            <Typography
              variant="body2"
              color="warning.main"
              gutterBottom
              sx={{fontWeight: "bold"}}
            >
              {TEXT_MATERIAL_IN_USE_WARNING}
            </Typography>
            {Array.from(grouped.entries()).map(
              ([tableName, tableEntries]) => (
                <Box key={tableName} sx={{marginBottom: 1}}>
                  <Typography variant="subtitle2">
                    {WHERE_USED_TABLE_LABELS[tableName] ?? tableName} (
                    {tableEntries.length})
                  </Typography>
                  <Box
                    component="ul"
                    sx={{paddingLeft: 2, margin: 0, marginTop: 0.5}}
                  >
                    {tableEntries.map((entry, index) => (
                      <Typography
                        component="li"
                        variant="body2"
                        color="text.secondary"
                        key={`${tableName}-${entry.record_id}-${index}`}
                      >
                        {entry.context}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ),
            )}
          </React.Fragment>
        );
      } else {
        dialogText = (
          <Typography variant="body2" color="text.secondary">
            {TEXT_MATERIAL_NOT_IN_USE}
          </Typography>
        );
      }

      const confirmed = await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_DELETE_MATERIAL_CONFIRM(material.name),
        text: dialogText,
      });

      if (confirmed) {
        await database.materials.deleteMaterial(material.uid);
        dispatch({
          type: ReducerActions.MATERIAL_DELETED,
          payload: material,
        });
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Material löschen", materialUid: material.uid},
      });
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };

  /* ------------------------------------------
  // Materialien zusammenführen (Merge)
  // ------------------------------------------ */
  const handleMergeMaterials = async (
    sourceUid: string,
    targetUid: string,
  ): Promise<MergeMaterialsResult | null> => {
    try {
      const result = await database.adminOps.mergeMaterials(
        sourceUid,
        targetUid,
      );
      dispatch({
        type: ReducerActions.MATERIAL_MERGED,
        payload: {sourceMaterialUid: sourceUid, result},
      });
      return result;
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Materialien zusammenführen"},
      });
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
      return null;
    }
  };

  /**
   * Öffnet den Merge-Dialog für zwei Materialien.
   */
  const openMergeDialog = (sourceUid: string, targetUid: string) => {
    setMergeSourceUid(sourceUid);
    setMergeTargetUid(targetUid);
    setMergeDialogOpen(true);
  };

  /* ------------------------------------------
  // Material zu Produkt konvertieren (Dialog öffnen)
  // ------------------------------------------ */
  const handleOpenConvertDialog = (material: Material) => {
    setConvertMaterial(material);
    setConvertDialogOpen(true);
  };

  /** Wird vom Dialog aufgerufen, nachdem der User die Produkteigenschaften gewählt hat. */
  const handleConvertMaterialToProduct = async (
    material: Material,
    departmentId?: string,
    shoppingUnit?: string,
  ) => {
    setConvertDialogOpen(false);
    try {
      await database.adminOps.convertMaterialToProduct(
        material.uid,
        departmentId,
        shoppingUnit,
      );
      dispatch({
        type: ReducerActions.MATERIAL_CONVERTED_TO_PRODUCT,
        payload: material,
      });
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Material zu Produkt konvertieren", materialUid: material.uid},
      });
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
        {/* Bulk-Aktionen Toolbar */}
        {editMode && state.selectedMaterialUids.length > 0 && (
          <MaterialsQaBulkActions
            selectedCount={state.selectedMaterialUids.length}
            onBulkQaCheck={onBulkQaCheck}
            onMerge={openMergeFromSelection}
            canMerge={state.selectedMaterialUids.length === 2}
          />
        )}

        <MaterialsTable
          materials={state.materials}
          editMode={editMode}
          issueFlags={state.issueFlags}
          selectedMaterialUids={state.selectedMaterialUids}
          onMaterialChange={onMaterialChange}
          onQaToggle={onQaToggle}
          onSelectionChange={onSelectionChange}
          onDeleteMaterial={handleDeleteMaterial}
          onConvertMaterialToProduct={handleOpenConvertDialog}
          onOpenMergeDialog={openMergeDialog}
          authUser={authUser}
        />
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={handleSnackbarClose}
        />
      </Container>

      {/* Merge-Dialog */}
      {mergeDialogOpen && (
        <DialogMergeMaterials
          open={mergeDialogOpen}
          onClose={() => setMergeDialogOpen(false)}
          materials={state.materials}
          sourceMaterialUid={mergeSourceUid}
          targetMaterialUid={mergeTargetUid}
          onMerge={handleMergeMaterials}
        />
      )}

      {/* Convert-Dialog Material→Produkt */}
      {convertDialogOpen && convertMaterial && (
        <DialogConvertMaterialToProduct
          open={convertDialogOpen}
          material={convertMaterial}
          onClose={() => setConvertDialogOpen(false)}
          onConvert={handleConvertMaterialToProduct}
        />
      )}
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
 * @property issueFlags - Erkannte Qualitätsprobleme pro Material
 * @property selectedMaterialUids - UIDs der ausgewählten Materialien
 * @property onMaterialChange - Callback wenn ein Material geändert wird
 * @property onQaToggle - Callback für QA-Checkbox-Änderung
 * @property onSelectionChange - Callback für DataGrid-Selektion
 * @property onDeleteMaterial - Callback zum Löschen eines Materials
 * @property onConvertMaterialToProduct - Callback zum Konvertieren in ein Produkt
 * @property onOpenMergeDialog - Callback zum Öffnen des Merge-Dialogs
 * @property authUser - Der angemeldete Benutzer
 */
interface MaterialsTableProps {
  materials: Material[];
  editMode: boolean;
  issueFlags: MaterialIssue[];
  selectedMaterialUids: string[];
  onMaterialChange: (material: Material) => void;
  onQaToggle: (uid: string, checked: boolean) => void;
  onSelectionChange: (uids: string[]) => void;
  onDeleteMaterial: (material: Material) => void;
  onConvertMaterialToProduct: (material: Material) => void;
  onOpenMergeDialog: (sourceUid: string, targetUid: string) => void;
  authUser: AuthUser;
}

/** UI-Zeilenstruktur für die DataGrid-Tabelle. */
interface MaterialLineUi {
  uid: string;
  name: string;
  materialType: number;
  usable: boolean;
  qaChecked: boolean;
  issueCount: number;
  issueTexts: string;
}

/**
 * Tabelle mit DataGrid, Filterleiste und Kontextmenü für Materialien.
 * Gleiche Struktur wie die Produkte-Tabelle: DataGrid mit sticky Header,
 * Checkbox-Selektion im Edit-Modus und renderCell für Inline-Bearbeitung.
 */
const MaterialsTable = ({
  materials,
  editMode,
  issueFlags,
  selectedMaterialUids,
  onMaterialChange,
  onQaToggle,
  onSelectionChange,
  onDeleteMaterial: onDeleteMaterialSuper,
  onConvertMaterialToProduct: onConvertMaterialToProductSuper,
  onOpenMergeDialog,
  authUser,
}: MaterialsTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [materialTypeFilter, setMaterialTypeFilter] = React.useState<MaterialTypeFilter>("");
  const [qaFilter, setQaFilter] = React.useState<QaFilterStatus>("all");
  const [showIssuesOnly, setShowIssuesOnly] = React.useState(false);
  const [materialPopUpValues, setMaterialPopUpValues] = React.useState(
    MATERIAL_POPUP_VALUES
  );
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    React.useState<HTMLElement | null>(null);
  const [contextMenuMaterialUid, setContextMenuMaterialUid] =
    React.useState("");
  const [paginationModel, setPaginationModel] = React.useState({
    page: 0,
    pageSize: 100,
  });

  const theme = useTheme();

  // Issue-Flags als Map für schnellen Zugriff
  const issueFlagMap = React.useMemo(() => {
    const map = new Map<string, MaterialIssue>();
    issueFlags.forEach((issue) => map.set(issue.materialUid, issue));
    return map;
  }, [issueFlags]);

  /** Mapping MaterialTypeFilter-String → numerischer MaterialType. */
  const MATERIAL_TYPE_FILTER_MAP: Record<string, number> = {
    none: MaterialType.none,
    consumable: MaterialType.consumable,
    usage: MaterialType.usage,
  };

  /** Mapping numerischer MaterialType → lesbares Label. */
  const MATERIAL_TYPE_LABELS: Record<number, string> = {
    [MaterialType.none]: "—",
    [MaterialType.consumable]: TEXT_MATERIAL_TYPE_CONSUMABLE,
    [MaterialType.usage]: TEXT_MATERIAL_TYPE_USAGE,
  };

  /* ------------------------------------------
  // Kontextmenü
  // ------------------------------------------ */
  const openContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    materialUid: string,
  ) => {
    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuMaterialUid(materialUid);
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuMaterialUid("");
  };
  const onDeleteMaterial = () => {
    const material = materials.find(
      (candidate) => candidate.uid === contextMenuMaterialUid,
    );
    if (!material) return;
    closeContextMenu();
    onDeleteMaterialSuper(material);
  };
  const onConvertMaterialToProduct = () => {
    const material = materials.find(
      (candidate) => candidate.uid === contextMenuMaterialUid,
    );
    if (!material) return;
    closeContextMenu();
    onConvertMaterialToProductSuper(material);
  };

  /* ------------------------------------------
  // Gefilterte Materialien
  // ------------------------------------------ */
  const filteredMaterials = React.useMemo(() => {
    let result = materials;

    if (searchString) {
      const lower = searchString.toLowerCase();
      result = result.filter((material) =>
        material.name.toLowerCase().includes(lower),
      );
    }

    if (materialTypeFilter) {
      const numericType = MATERIAL_TYPE_FILTER_MAP[materialTypeFilter];
      result = result.filter((material) => material.type === numericType);
    }

    if (qaFilter === "checked") {
      result = result.filter((material) => material.qaChecked);
    } else if (qaFilter === "unchecked") {
      result = result.filter((material) => !material.qaChecked);
    }

    if (showIssuesOnly) {
      const issueUids = new Set(issueFlags.map((issue) => issue.materialUid));
      result = result.filter((material) => issueUids.has(material.uid));
    }

    return result;
  }, [materials, searchString, materialTypeFilter, qaFilter, showIssuesOnly, issueFlags]);

  /* ------------------------------------------
  // UI-Daten für DataGrid
  // ------------------------------------------ */
  const filteredMaterialsUi = React.useMemo(
    (): MaterialLineUi[] =>
      filteredMaterials.map((material) => {
        const issueFlag = issueFlagMap.get(material.uid);
        return {
          uid: material.uid,
          name: material.name,
          materialType: material.type,
          usable: material.usable,
          qaChecked: material.qaChecked,
          issueCount: issueFlag?.issues.length ?? 0,
          issueTexts: issueFlag?.issues.join(", ") ?? "",
        };
      }),
    [filteredMaterials, issueFlagMap],
  );

  /* ------------------------------------------
  // DataGrid Spalten
  // ------------------------------------------ */
  const dataGridColumns: GridColDef[] = React.useMemo(
    () => [
      {
        field: "open",
        headerName: "",
        sortable: false,
        width: 60,
        renderCell: (params) => (
          <IconButton
            aria-label="Material öffnen"
            sx={{margin: theme.spacing(1)}}
            size="small"
            disabled={!editMode}
            onClick={() => openPopUp(params.id as string)}
          >
            <EditIcon fontSize="inherit" />
          </IconButton>
        ),
      },
      {
        field: "uid",
        headerName: TEXT_UID,
        editable: false,
        width: 200,
      },
      {
        field: "name",
        headerName: TEXT_FIELD_PRODUCT,
        editable: false,
        width: 250,
        flex: 1,
      },
      {
        field: "materialType",
        headerName: TEXT_MATERIAL_TYPE,
        editable: false,
        width: 200,
        renderCell: (params) => {
          if (!editMode) {
            return MATERIAL_TYPE_LABELS[params.value as number] ?? "—";
          }
          return (
            <Select
              size="small"
              fullWidth
              variant="standard"
              value={params.value as number}
              onChange={(event: SelectChangeEvent<number>) => {
                const material = materials.find(
                  (candidate) => candidate.uid === params.id,
                );
                if (material) {
                  onMaterialChange({
                    ...material,
                    type: event.target.value as MaterialType,
                  });
                }
              }}
              disableUnderline
            >
              <MenuItem value={MaterialType.consumable}>
                {TEXT_MATERIAL_TYPE_CONSUMABLE}
              </MenuItem>
              <MenuItem value={MaterialType.usage}>
                {TEXT_MATERIAL_TYPE_USAGE}
              </MenuItem>
            </Select>
          );
        },
      },
      {
        field: "usable",
        headerName: TEXT_USABLE,
        editable: false,
        width: 80,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={(event) => {
              const material = materials.find(
                (candidate) => candidate.uid === params.id,
              );
              if (material) {
                onMaterialChange({...material, usable: event.target.checked});
              }
            }}
          />
        ),
      },
      {
        field: "qaChecked",
        headerName: TEXT_QA_CHECKED,
        editable: false,
        width: 80,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={(event) =>
              onQaToggle(params.id as string, event.target.checked)
            }
          />
        ),
      },
      {
        field: "issueCount",
        headerName: TEXT_QA_ISSUES,
        editable: false,
        width: 80,
        renderCell: (params) => {
          const count = params.value as number;
          if (count === 0) return null;
          return (
            <Tooltip
              title={(params.row as MaterialLineUi).issueTexts}
              arrow
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "warning.main",
                }}
              >
                <WarningIcon fontSize="small" />
                <Typography variant="body2">{count}</Typography>
              </Box>
            </Tooltip>
          );
        },
      },
      {
        field: "context",
        headerName: "",
        editable: false,
        width: 60,
        sortable: false,
        renderCell: (params) => (
          <IconButton
            aria-label="Kontextmenü"
            sx={{margin: theme.spacing(1)}}
            size="small"
            disabled={!editMode}
            onClick={(event) =>
              openContextMenu(event, params.id as string)
            }
          >
            <MoreVertIcon fontSize="inherit" />
          </IconButton>
        ),
      },
    ],
    [editMode, theme, materials, issueFlagMap],
  );

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const clearSearchString = () => setSearchString("");
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => setSearchString(event.target.value);

  /* ------------------------------------------
  // Selektion (DataGrid)
  // ------------------------------------------ */
  const handleSelectionChange = (selectionModel: GridRowSelectionModel) => {
    onSelectionChange(selectionModel as string[]);
  };

  /* ------------------------------------------
  // Popup öffnen
  // ------------------------------------------ */
  const openPopUp = (materialUid: string) => {
    const material = materials.find(
      (candidate) => candidate.uid === materialUid,
    );
    if (!material) return;

    setMaterialPopUpValues({
      materialUid: material.uid,
      materialName: material.name,
      materialType: material.type,
      usable: material.usable,
      popUpOpen: true,
    });
  };
  const onPopUpClose = () => setMaterialPopUpValues(MATERIAL_POPUP_VALUES);
  const onPopUpOk = (changedMaterial: Material) => {
    onMaterialChange(changedMaterial);
    setMaterialPopUpValues(MATERIAL_POPUP_VALUES);
  };

  return (
    <React.Fragment>
      {/* Erweiterte Filterleiste */}
      <MaterialsQaFilterBar
        searchString={searchString}
        onUpdateSearchString={updateSearchString}
        onClearSearchString={clearSearchString}
        materialTypeFilter={materialTypeFilter}
        onMaterialTypeFilterChange={setMaterialTypeFilter}
        qaFilter={qaFilter}
        onQaFilterChange={setQaFilter}
        showIssuesOnly={showIssuesOnly}
        onShowIssuesOnlyChange={setShowIssuesOnly}
        totalCount={materials.length}
        filteredCount={filteredMaterials.length}
      />

      {/* DataGrid mit sticky Header */}
      <Box sx={{height: "calc(100vh - 200px)", width: "100%"}}>
        <DataGrid
          rows={filteredMaterialsUi}
          columns={dataGridColumns}
          columnVisibilityModel={{uid: false}}
          getRowId={(row) => row.uid}
          pagination
          checkboxSelection={editMode}
          rowSelectionModel={selectedMaterialUids}
          onRowSelectionModelChange={handleSelectionChange}
          localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[20, 50, 100]}
        />
      </Box>

      {/* Kontextmenü */}
      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={onConvertMaterialToProduct}>
          <ListItemIcon>
            <CachedIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_CONVERT_TO_PRODUCT}
          </Typography>
        </MenuItem>
        <MenuItem onClick={onDeleteMaterial}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_DELETE_MATERIAL}
          </Typography>
        </MenuItem>
      </Menu>

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

export {MaterialPage, materialsReducer, ReducerActions, initialState};
export type {State, ReducerAction};
