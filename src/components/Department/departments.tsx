/**
 * DepartmentsPage — Übersichtsseite für Abteilungen (Stammdaten).
 *
 * Zeigt alle Abteilungen tabellarisch an, erlaubt das Bearbeiten von
 * Namen und Sortierreihenfolge sowie das Anlegen neuer Abteilungen.
 */
import React, {SyntheticEvent} from "react";

import {
  DEPARTMENTS as TEXT_DEPARTMENTS,
  SO_YOU_DONT_GET_LOST_IN_THE_STORE as TEXT_SO_YOU_DONT_GET_LOST_IN_THE_STORE,
  ADD_DEPARTMENT as TEXT_ADD_DEPARTMENT,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
  DEPARTMENT as TEXT_DEPARTMENT,
  RANK as TEXT_RANK,
  ORDER as TEXT_ORDER,
  DEPARTMENT_CREATED as TEXT_DEPARTMENT_CREATED,
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
} from "../../constants/text";

import {useDatabase} from "../Database/DatabaseContext";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
} from "../Shared/customSnackbar";

import Roles from "../../constants/roles";
import {DepartmentDomain} from "../Database/Repository/DepartmentRepository";
import ButtonRow from "../Shared/buttonRow";
import PageTitle from "../Shared/pageTitle";
import useCustomStyles from "../../constants/styles";
import {
  Backdrop,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  SnackbarCloseReason,
  TextField,
  Typography,
} from "@mui/material";
import AlertMessage from "../Shared/AlertMessage";
import EnhancedTable, {
  Column,
  ColumnTextAlign,
  TableColumnTypes,
} from "../Shared/enhancedTable";
import DialogDepartment from "./dialogDepartment";
import {useAuthUser} from "../Session/authUserContext";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  FETCH_INIT,
  DEPARTMENTS_FETCH_SUCCESS,
  DEPARTMENT_ON_CHANGE,
  DEPARTMENTS_SAVED,
  NEW_DEPARTMENT_CREATED,
  SET_NEW_POSITION_FOR_DEPARTMENT,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

/**
 * Diskriminierte Union für typsichere Reducer-Actions.
 */
type ReducerAction =
  | {type: ReducerActions.FETCH_INIT}
  | {
      type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS;
      payload: DepartmentDomain[];
    }
  | {
      type: ReducerActions.DEPARTMENT_ON_CHANGE;
      payload: {field: string; key: string; value: string};
    }
  | {
      type: ReducerActions.SET_NEW_POSITION_FOR_DEPARTMENT;
      payload: DepartmentDomain[];
    }
  | {type: ReducerActions.DEPARTMENTS_SAVED}
  | {type: ReducerActions.NEW_DEPARTMENT_CREATED; payload: DepartmentDomain}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/**
 * State der DepartmentsPage.
 *
 * @param departments - Liste aller Abteilungen
 * @param positionList - Verfügbare Positionen (1..N als Strings)
 * @param error - Letzter aufgetretener Fehler (oder null)
 * @param isLoading - Ob gerade Daten geladen werden
 * @param snackbar - Zustand der Snackbar-Benachrichtigung
 */
interface State {
  departments: DepartmentDomain[];
  positionList: string[];
  error: Error | null;
  isLoading: boolean;
  snackbar: Snackbar;
}

const initialState: State = {
  departments: [],
  positionList: [],
  error: null,
  isLoading: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Normalisiert die Positionen aller Abteilungen auf lückenlose 1..N-Werte.
 *
 * Sortiert zuerst nach `pos` und weist dann jedem Eintrag eine
 * fortlaufende Position zu. Damit wird das MUI-Select-Problem mit
 * nicht-zusammenhängenden Positionswerten behoben.
 *
 * @param departments - Liste der Abteilungen mit ggf. lückenhaften Positionen
 * @returns Neue Liste mit normalisierten Positionen (1-basiert)
 */
const normalizeDepartmentPositions = (
  departments: DepartmentDomain[],
): DepartmentDomain[] => {
  return [...departments]
    .sort((a, b) => a.pos - b.pos)
    .map((dept, index) => ({...dept, pos: index + 1}));
};

/**
 * Erzeugt eine Positionsliste ["1", "2", ..., "N"] für das Select-Dropdown.
 *
 * @param arrayLength - Anzahl der Einträge
 * @returns Array mit Positions-Strings
 */
const createPositionList = (arrayLength: number): string[] => {
  return Array.from({length: arrayLength}, (_, i) => String(i + 1));
};

/**
 * Verschiebt eine Abteilung an eine neue Position und nummeriert alle
 * Positionen neu (1..N).
 *
 * @param departments - Aktuelle Liste der Abteilungen (mit normalisierten Positionen)
 * @param departmentUid - UID der zu verschiebenden Abteilung
 * @param newPos - Neue Zielposition (1-basiert)
 * @returns Neu sortierte und normalisierte Liste, oder undefined wenn uid nicht gefunden
 */
const reorderDepartment = (
  departments: DepartmentDomain[],
  departmentUid: string,
  newPos: number,
): DepartmentDomain[] | undefined => {
  const sorted = [...departments].sort((deptA, deptB) => deptA.pos - deptB.pos);
  const currentIndex = sorted.findIndex((department) => department.uid === departmentUid);
  if (currentIndex === -1) {
    return undefined;
  }

  // Abteilung entfernen und an neuer Position einfügen
  const [moved] = sorted.splice(currentIndex, 1);
  sorted.splice(newPos - 1, 0, moved);

  // Positionen direkt aus der neuen Array-Reihenfolge zuweisen
  // (nicht normalizeDepartmentPositions verwenden, da diese nach
  // den alten pos-Werten sortiert und die Umordnung rückgängig macht)
  return sorted.map((dept, index) => ({...dept, pos: index + 1}));
};

/* ===================================================================
// ======================== Reducer ==================================
// =================================================================== */

/**
 * Reducer für die DepartmentsPage.
 *
 * Verwaltet Lade-, Bearbeitungs- und Fehlerzustände der Abteilungsliste.
 *
 * @param state - Aktueller Zustand
 * @param action - Diskriminierte Union-Action
 * @returns Neuer Zustand
 */
const departmentsReducer = (state: State, action: ReducerAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      // Daten werden geladen
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.DEPARTMENTS_FETCH_SUCCESS: {
      // Abteilungen geholt — Positionen normalisieren
      const normalized = normalizeDepartmentPositions(action.payload);
      return {
        ...state,
        departments: normalized,
        positionList: createPositionList(normalized.length),
        isLoading: false,
      };
    }
    case ReducerActions.DEPARTMENT_ON_CHANGE:
      // Feldwert geändert (immutabel)
      return {
        ...state,
        departments: state.departments.map((department) => {
          if (department.uid === action.payload.key) {
            return {
              ...department,
              [action.payload.field]: action.payload.value,
            };
          }
          return department;
        }),
      };
    case ReducerActions.SET_NEW_POSITION_FOR_DEPARTMENT:
      // Position geändert
      return {...state, departments: action.payload};
    case ReducerActions.DEPARTMENTS_SAVED:
      // Alle Einträge gespeichert
      return {
        ...state,
        error: null,
        snackbar: {
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
          open: true,
        },
      };
    case ReducerActions.NEW_DEPARTMENT_CREATED: {
      // Neue Abteilung wurde angelegt — Liste normalisieren
      const withNew = normalizeDepartmentPositions(
        state.departments.concat([action.payload]),
      );
      return {
        ...state,
        departments: withNew,
        positionList: createPositionList(withNew.length),
        snackbar: {
          severity: "success",
          message: TEXT_DEPARTMENT_CREATED(action.payload.name),
          open: true,
        },
      };
    }
    case ReducerActions.SNACKBAR_CLOSE:
      // Snackbar schliessen
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    case ReducerActions.GENERIC_ERROR:
      // Fehler
      return {
        ...state,
        isLoading: false,
        error: action.payload,
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
    label: TEXT_DEPARTMENT,
    visible: true,
  },
  {
    id: "pos",
    type: TableColumnTypes.number,
    textAlign: ColumnTextAlign.center,
    disablePadding: false,
    label: TEXT_RANK,
    visible: true,
  },
];

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */

/**
 * Hauptkomponente für die Abteilungsverwaltung.
 *
 * Lädt alle Abteilungen beim Mount, bietet einen Bearbeitungsmodus
 * zum Umbenennen und Umsortieren und erlaubt das Anlegen neuer
 * Abteilungen über einen Dialog.
 */
const DepartmentsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [editMode, setEditMode] = React.useState(false);
  const [state, dispatch] = React.useReducer(departmentsReducer, initialState);
  const [addDepartmentPopUp, setAddDepartmentPopUp] = React.useState(false);

  /* ------------------------------------------
  // Daten aus der DB holen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.FETCH_INIT});

    database.departments
      .getAllDepartments()
      .then((result) => {
        dispatch({
          type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS,
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
  }, [database]);

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Edit Mode wechsel
  // ------------------------------------------ */
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };
  /* ------------------------------------------
  // PopUp Handler
  // ------------------------------------------ */
  const onAddDepartment = () => {
    setAddDepartmentPopUp(true);
  };
  const onPopUpClose = () => {
    setAddDepartmentPopUp(false);
  };
  const onPopUpError = (error: Error) => {
    dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
    setAddDepartmentPopUp(false);
  };
  /* ------------------------------------------
  // Abteilung wurde angelegt
  // ------------------------------------------ */
  const onCreateDepartment = (department: DepartmentDomain) => {
    dispatch({
      type: ReducerActions.NEW_DEPARTMENT_CREATED,
      payload: department,
    });
    setAddDepartmentPopUp(false);
  };
  /* ------------------------------------------
  // Feldwert geändert
  // ------------------------------------------ */
  const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const departmentField = event.target.id.split("_");
    dispatch({
      type: ReducerActions.DEPARTMENT_ON_CHANGE,
      payload: {
        field: departmentField[0],
        key: departmentField[1],
        value: event.target.value,
      },
    });
  };
  /* ------------------------------------------
  //  Position von Abteilung ändern
  // ------------------------------------------ */
  const onChangeSelect = (event: SelectChangeEvent) => {
    const selectedItem = event.target?.name?.split("_");
    if (!selectedItem || selectedItem?.length === 0) {
      return;
    }

    const reordered = reorderDepartment(
      state.departments,
      selectedItem[1],
      parseInt(event.target.value as string),
    );

    if (!reordered) {
      return;
    }
    dispatch({
      type: ReducerActions.SET_NEW_POSITION_FOR_DEPARTMENT,
      payload: reordered,
    });
  };
  /* ------------------------------------------
  // Speichern
  // ------------------------------------------ */
  const onSave = () => {
    database.departments
      .saveAllDepartments(state.departments, authUser)
      .then(() => {
        dispatch({type: ReducerActions.DEPARTMENTS_SAVED});
      })
      .catch((error) => {
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error,
        });
      });
  };
  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const onSnackbarClose = (
    _event: Event | SyntheticEvent,
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
        title={TEXT_DEPARTMENTS}
        subTitle={TEXT_SO_YOU_DONT_GET_LOST_IN_THE_STORE}
      />
      <ButtonRow
        key="buttons_edit"
        buttons={[
          {
            id: "edit",
            hero: true,
            visible:
              !editMode && authUser.roles.includes(Roles.communityLeader),
            label: TEXT_EDIT,
            variant: "contained",
            color: "primary",
            onClick: toggleEditMode,
          },
          {
            id: "save",
            hero: true,
            visible: editMode && authUser.roles.includes(Roles.communityLeader),
            label: TEXT_SAVE,
            variant: "contained",
            color: "primary",
            onClick: onSave,
          },
          {
            id: "add",
            hero: true,
            visible: authUser.roles.includes(Roles.communityLeader) && editMode,
            label: TEXT_ADD_DEPARTMENT,
            variant: "outlined",
            color: "primary",
            onClick: onAddDepartment,
          },
        ]}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Grid container spacing={2}>
          {/* Fehler anzeigen? */}
          {state.error && (
            <Grid key={"error"} size={12}>
              <AlertMessage
                error={state.error}
                messageTitle={TEXT_ALERT_TITLE_UUPS}
              />
            </Grid>
          )}
          <Grid key={"DepartmentsPanel"} size={12}>
            <br />
            <DepartmentTable
              departments={state.departments}
              positionList={state.positionList}
              onChangeField={onChangeField}
              onChangeSelect={onChangeSelect}
              editMode={editMode}
            />
          </Grid>
        </Grid>
      </Container>
      <DialogDepartment
        dialogOpen={addDepartmentPopUp}
        nextHigherPos={state.positionList.length + 1}
        handleCreate={onCreateDepartment}
        handleClose={onPopUpClose}
        handleError={onPopUpError}
        authUser={authUser}
      />
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={onSnackbarClose}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ========================= Departments Tabelle =====================
// =================================================================== */

/**
 * Tabellenkomponente für die Abteilungsliste.
 *
 * Zeigt im Lesemodus eine EnhancedTable, im Bearbeitungsmodus
 * editierbare Textfelder und Positions-Dropdowns.
 *
 * @param departments - Liste der Abteilungen
 * @param positionList - Verfügbare Positionen als Strings
 * @param onChangeField - Handler für Namensänderungen
 * @param onChangeSelect - Handler für Positionsänderungen
 * @param editMode - Ob der Bearbeitungsmodus aktiv ist
 */
interface DepartmentTableProps {
  departments: DepartmentDomain[];
  positionList: string[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeSelect: (event: SelectChangeEvent) => void;
  editMode: boolean;
}
const DepartmentTable = ({
  departments,
  positionList,
  onChangeField,
  onChangeSelect,
  editMode,
}: DepartmentTableProps) => {
  const classes = useCustomStyles();
  return (
    <Card sx={classes.card} key={"cardDepartmentsPanel"}>
      <CardContent sx={classes.cardContent} key={"cardDepartments"}>
        {editMode ? (
          <Grid container spacing={2}>
            <Grid size={8}>
              <Typography variant="subtitle1">{TEXT_DEPARTMENT}</Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="subtitle1">{TEXT_ORDER}</Typography>
            </Grid>
            <Grid size={12}>
              <Divider />
            </Grid>

            {departments.map((department) => (
              <React.Fragment key={"departmentFragment_" + department.uid}>
                <Grid key={"gridItemName_" + department.uid} size={8}>
                  <TextField
                    id={"name_" + department.uid}
                    key={"name_" + department.uid}
                    value={department.name}
                    label={TEXT_DEPARTMENT}
                    onChange={onChangeField}
                    fullWidth
                  />
                </Grid>
                <Grid key={"gridItemPos_" + department.uid} size={4}>
                  <FormControl fullWidth sx={classes.formControl}>
                    <InputLabel key="label_pos">{TEXT_ORDER}</InputLabel>
                    <Select
                      labelId="label_pos"
                      label={TEXT_ORDER}
                      id={"pos_" + department.uid}
                      name={"pos_" + department.uid}
                      value={department.pos.toString()}
                      onChange={onChangeSelect}
                    >
                      {positionList.map((pos) => (
                        <MenuItem
                          id={department.uid + "_" + pos.toString()}
                          key={department.uid + "_" + pos.toString()}
                          value={pos}
                        >
                          {pos.toString()}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid key={"gridItemDivider_" + department.uid} size={12}>
                  <Divider />
                </Grid>
              </React.Fragment>
            ))}
          </Grid>
        ) : (
          <EnhancedTable
            tableData={departments}
            tableColumns={TABLE_COLUMS}
            keyColum={"uid"}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default DepartmentsPage;
