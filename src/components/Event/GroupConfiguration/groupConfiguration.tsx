import React, {SyntheticEvent} from "react";
import {trackEvent} from "../../Analytics/analyticsService";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";

import {
  Stack,
  Button,
  Backdrop,
  CircularProgress,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  useTheme,
  Box,
  SnackbarCloseReason,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  GROUP_CONFIGURATION_SETTINGS as TEXT_GROUP_CONFIGURATION_SETTINGS,
  GROUP_CONFIGURATION_SETTINGS_DESCRIPTION as TEXT_GROUP_CONFIGURATION_SETTINGS_DESCRIPTION,
  GROUPS as TEXT_GROUPS,
  ADD_DIET as TEXT_ADD_DIET,
  TOTAL as TEXT_TOTAL,
  PORTIONS as TEXT_PORTIONS,
  RENAME as TEXT_RENAME,
  DELETE as TEXT_DELETE,
  INTOLERANCE as TEXT_INTOLERANCE,
  DIET_GROUP as TEXT_DIET_GROUP,
  EDIT as TEXT_EDIT,
  ADD as TEXT_ADD,
  NAME as TEXT_NAME,
  CONFIRM_CHANGES_ARE_LOST as TEXT_CONFIRM_CHANGES_ARE_LOST,
  UNSAVED_CHANGES as TEXT_UNSAVED_CHANGES,
  DISCARD_CHANGES as TEXT_DISCARD_CHANGES,
  RECALCULATE_PORTIONS as TEXT_RECALCULATE_PORTIONS,
  PORTIONS_RECALCULATED as TEXT_PORTIONS_RECALCULATED,
  AND as TEXT_AND,
  SAVE as TEXT_SAVE,
} from "../../../constants/text";

import {useCustomStyles} from "../../../constants/styles";
import {ButtonAction} from "../../Shared/global.interface";
import {AlertMessage} from "../../Shared/AlertMessage";
import {Event} from "../Event/event.class";
import {EventGroupConfiguration} from "./groupConfiguration.class";

import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/NavigationContext";
import {Action} from "../../../constants/actions";
import {useDatabase} from "../../Database/DatabaseContext";
// Bridge-Import eliminiert — Konvertierung erfolgt direkt im Repository
/** Alle verfügbaren Aktionstypen für den Gruppen-Konfiguration-Reducer. */
enum ReducerActions {
  UPDATE_FIELD = "UPDATE_FIELD",
  UPDATE_GROUP_CONFIG = "UPDATE_GROUP_CONFIG",
  GENERIC_ERROR = "GENERIC_ERROR",
  SNACKBAR_SHOW = "SNACKBAR_SHOW",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
}

/** Dimension der Gruppenkonfiguration (Diätgruppe oder Unverträglichkeit). */
enum GroupConfigDimension {
  diet,
  intolerance,
}

/**
 * Typisierte Reducer-Aktionen als Discriminated Union.
 * Jede Aktion hat einen eigenen Payload-Typ, damit der Reducer
 * den Payload automatisch einschränken kann (kein `as`-Cast nötig).
 */
type DispatchAction =
  | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: unknown}}
  | {type: ReducerActions.UPDATE_GROUP_CONFIG; payload: EventGroupConfiguration}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: SnackbarState["severity"]; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE};
/** Zustand der Gruppenkonfiguration-Komponente. */
type State = {
  /** Aktuelle Gruppenkonfiguration (Diäten, Intoleranzen, Portionen). */
  groupConfig: EventGroupConfiguration;
  /** Ob ein Fehler aufgetreten ist. */
  isError: boolean;
  /** Ob gerade geladen wird. */
  isLoading: boolean;
  /** Aktuelles Fehler-Objekt (falls vorhanden). */
  error: Error | null;
  /** Snackbar-Zustand für Benachrichtigungen. */
  snackbar: SnackbarState;
};

const initialState: State = {
  groupConfig: EventGroupConfiguration.factory(),
  isError: false,
  isLoading: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

/**
 * Reducer für die Gruppenkonfiguration.
 * Verwaltet Zustandsänderungen für Diäten, Intoleranzen und Portionen.
 *
 * @param state Aktueller State.
 * @param action Typisierte Aktion (Discriminated Union).
 * @returns Neuer State.
 * @throws {Error} Bei unbekanntem Aktionstyp.
 */
const groupConfigurationReducer = (
  state: State,
  action: DispatchAction
): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        groupConfig: {
          ...state.groupConfig,
          [action.payload.field]: action.payload.value,
        },
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        error: action.payload,
      };
    case ReducerActions.UPDATE_GROUP_CONFIG:
      return {
        ...state,
        groupConfig: action.payload,
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
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
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

/** Props für die Gruppenkonfiguration-Seite. */
interface EventGroupConfigurationPageProps {
  /** Firebase-Instanz für DB-Zugriffe. */
  firebase: Firebase;
  /** Authentifizierter Benutzer. */
  authUser: AuthUser;
  /** Das zugehörige Event. */
  event: Event;
  /** Bestehende Gruppenkonfiguration (beim Bearbeiten). */
  groupConfiguration?: EventGroupConfiguration;
  /** Wenn true, wird die Gruppenkonfiguration nicht sofort gespeichert. */
  deferSave?: boolean;
  /** Callback und Button-Text für die Bestätigungs-Aktion. */
  onConfirm?: ButtonAction<EventGroupConfiguration>;
  /** Callback und Button-Text für die Abbruch-Aktion. */
  onCancel?: ButtonAction;
  /** Callback bei Änderung der Portionen (löst Neuberechnung im Menüplan aus). */
  onGroupConfigurationUpdate?: (
    groupConfiguration: EventGroupConfiguration
  ) => void;
}

/**
 * Hauptseite für die Gruppenkonfiguration eines Events.
 * Erlaubt das Erfassen und Bearbeiten von Diätgruppen, Intoleranzen
 * und deren Portionenzuordnung.
 */
const EventGroupConfigurationPage = ({
  firebase,
  authUser,
  event,
  groupConfiguration,
  deferSave = false,
  onConfirm,
  onCancel,
  onGroupConfigurationUpdate,
}: EventGroupConfigurationPageProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  const database = useDatabase();
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [state, dispatch] = React.useReducer(
    groupConfigurationReducer,
    initialState
  );
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    React.useState<HTMLElement | null>(null);
  const [contextMenuSelectedItem, setContextMenuSelectedItem] = React.useState({
    intoleranceUid: "",
    dietUid: "",
  });
  const [showUpdateConfigButtons, setShowUpdateConfigButtons] =
    React.useState(false);

  // Einmalige Initialisierung beim Mounten
  React.useEffect(() => {
    if (!state.groupConfig.uid) {
      dispatch({
        type: ReducerActions.UPDATE_FIELD,
        payload: {field: "uid", value: event.uid},
      });
      if (groupConfiguration) {
        dispatch({
          type: ReducerActions.UPDATE_GROUP_CONFIG,
          payload: structuredClone(groupConfiguration),
        });
      }
    }
  }, []);

  // Externe Änderungen synchronisieren (z.B. durch andere Benutzer)
  React.useEffect(() => {
    if (
      groupConfiguration &&
      state.groupConfig.lastChange.date < groupConfiguration.lastChange.date
    ) {
      dispatch({
        type: ReducerActions.UPDATE_GROUP_CONFIG,
        payload: structuredClone(groupConfiguration),
      });
    }
  }, [groupConfiguration]);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.groupConfiguration,
    });
  }, []);
  /* ------------------------------------------
  // Weiter // Zurück
  // ------------------------------------------ */
  const saveEvent = async (mouseEvent: React.MouseEvent<HTMLButtonElement>) => {
    if (!deferSave) {
      const gcDomain = database.eventGroupConfig.groupConfigUiToDomain(state.groupConfig, event.uid);
      await database.eventGroupConfig.saveGroupConfig(gcDomain, authUser);
      trackEvent(AnalyticsEvent.GROUP_CONFIG_CHANGED, {
        numberOfGroups: state.groupConfig.diets.order.length,
      });
    }
    onConfirm?.onClick && onConfirm.onClick(mouseEvent, state.groupConfig);
  };
  const cancelCreate = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onCancel?.onClick) {
      if (state.groupConfig.totalPortions !== 0) {
        const isConfirmed = await customDialog({
          dialogType: DialogType.Confirm,
          text: TEXT_CONFIRM_CHANGES_ARE_LOST,
          title: TEXT_UNSAVED_CHANGES,
          buttonTextConfirm: TEXT_DISCARD_CHANGES,
        });
        if (!isConfirmed) {
          return;
        }
        onCancel.onClick(event);
      } else {
        onCancel.onClick(event);
      }
    }
  };
  const onDiscardChanges = () => {
    dispatch({
      type: ReducerActions.UPDATE_GROUP_CONFIG,
      payload: structuredClone(groupConfiguration as EventGroupConfiguration),
    });
  };
  const onRecalculatePortions = async () => {
    if (!onGroupConfigurationUpdate) {
      return;
    }

    try {
      const gcDomain = database.eventGroupConfig.groupConfigUiToDomain(state.groupConfig, event.uid);
      await database.eventGroupConfig.saveGroupConfig(gcDomain, authUser);

      // Neue Mengen hochgeben, damit der Menüplan neu berechnet wird
      onGroupConfigurationUpdate(state.groupConfig);

      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {severity: "success", message: TEXT_PORTIONS_RECALCULATED},
      });
      setShowUpdateConfigButtons(false);
    } catch (error) {
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };
  /* ------------------------------------------
  // Portion anpassen
  // ------------------------------------------ */
  const onPortionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let updatedGroupConfig = {...state.groupConfig};
    const changedField = event.target.id.split("_");
    const changedDiet = changedField[1];
    const changedIntolerance = changedField[2];

    updatedGroupConfig.portions[changedDiet][changedIntolerance] = Number.isNaN(
      parseInt(event.target.value)
    )
      ? 0
      : parseInt(event.target.value);

    updatedGroupConfig = EventGroupConfiguration.calculateTotals({
      groupConfig: updatedGroupConfig,
    });

    markConfigDirty();

    dispatch({
      type: ReducerActions.UPDATE_GROUP_CONFIG,
      payload: updatedGroupConfig,
    });
  };
  /* ------------------------------------------
  // Hilfsfunktionen
  // ------------------------------------------ */
  /** Setzt das Kontextmenü und die Auswahl zurück. */
  const resetContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuSelectedItem({intoleranceUid: "", dietUid: ""});
  };
  /** Markiert die Konfiguration als geändert, wenn ein Update-Callback vorhanden ist. */
  const markConfigDirty = () => {
    if (onGroupConfigurationUpdate) {
      setShowUpdateConfigButtons(true);
    }
  };
  /* ------------------------------------------
  // Kontex-Menü-Befehle
  // ------------------------------------------ */
  const openIntoleranceContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    const pressedButton = event.currentTarget.id.split("_");
    setContextMenuSelectedItem({
      dietUid: "",
      intoleranceUid: pressedButton[2],
    });
    setContextMenuAnchorElement(event.currentTarget);
  };
  const openDietContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    const pressedButton = event.currentTarget.id.split("_");
    setContextMenuSelectedItem({
      intoleranceUid: "",
      dietUid: pressedButton[2],
    });
    setContextMenuAnchorElement(event.currentTarget);
  };
  const closeContextMenu = () => {
    resetContextMenu();
  };
  const onRenameItem = async () => {
    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${
        contextMenuSelectedItem.dietUid ? TEXT_DIET_GROUP : TEXT_INTOLERANCE
      } ${TEXT_EDIT}`,
      text: "",
      singleTextInputProperties: {
        initialValue: contextMenuSelectedItem.dietUid
          ? state.groupConfig.diets.entries[contextMenuSelectedItem.dietUid]
              .name
          : state.groupConfig.intolerances.entries[
              contextMenuSelectedItem.intoleranceUid
            ].name,
        textInputLabel: TEXT_NAME,
      },
    })) as SingleTextInputResult;

    if (userInput.valid && userInput.input !== "") {
      if (contextMenuSelectedItem.dietUid) {
        const diets = {...state.groupConfig.diets};
        const diet = diets.entries[contextMenuSelectedItem.dietUid];
        diet.name = userInput.input;
        dispatch({
          type: ReducerActions.UPDATE_FIELD,
          payload: {field: "diets", value: diets},
        });
      } else if (contextMenuSelectedItem.intoleranceUid) {
        const updatedIntolerances = {...state.groupConfig.intolerances};
        const intolerance =
          updatedIntolerances.entries[contextMenuSelectedItem.intoleranceUid];
        intolerance.name = userInput.input;
        dispatch({
          type: ReducerActions.UPDATE_FIELD,
          payload: {field: "intolerances", value: updatedIntolerances},
        });
      }
    }
    markConfigDirty();
    resetContextMenu();
  };
  const onDeleteItem = () => {
    let updatedGroupConfig = {...state.groupConfig};
    if (contextMenuSelectedItem.intoleranceUid) {
      updatedGroupConfig = EventGroupConfiguration.deleteIntolerance({
        groupConfig: state.groupConfig,
        intoleranceUidToDelete: contextMenuSelectedItem.intoleranceUid,
      });
    } else if (contextMenuSelectedItem.dietUid) {
      updatedGroupConfig = EventGroupConfiguration.deleteDiet({
        groupConfig: state.groupConfig,
        dietUidToDelete: contextMenuSelectedItem.dietUid,
      });
    }
    dispatch({
      type: ReducerActions.UPDATE_GROUP_CONFIG,
      payload: updatedGroupConfig,
    });
    markConfigDirty();
    resetContextMenu();
  };
  const onAddItem = async (type: GroupConfigDimension) => {
    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${
        type === GroupConfigDimension.diet ? TEXT_DIET_GROUP : TEXT_INTOLERANCE
      } ${TEXT_ADD}`,
      text: "",
      singleTextInputProperties: {
        initialValue: "",
        textInputLabel: TEXT_NAME,
      },
    })) as SingleTextInputResult;

    if (userInput.valid && userInput.input !== "") {
      if (type === GroupConfigDimension.diet) {
        const groupConfig = EventGroupConfiguration.addDietGroup({
          groupConfig: state.groupConfig,
          dietGroupName: userInput.input,
        });
        dispatch({
          type: ReducerActions.UPDATE_GROUP_CONFIG,
          payload: groupConfig,
        });
      } else if (type === GroupConfigDimension.intolerance) {
        const updatedGroupConfig = EventGroupConfiguration.addIntolerance({
          groupConfig: {...state.groupConfig},
          intoleranceName: userInput.input,
        });
        dispatch({
          type: ReducerActions.UPDATE_GROUP_CONFIG,
          payload: updatedGroupConfig,
        });
      }
    }
    markConfigDirty();
    resetContextMenu();
  };
  /* ------------------------------------------
  // Snackback schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    event: globalThis.Event | SyntheticEvent<any, globalThis.Event>,
    reason: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };
  return (
    <React.Fragment>
      <Stack spacing={1}>
        {state.isError && (
          <AlertMessage
            error={state.error as Error}
            messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
          />
        )}

        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <EventGroupConfigurationCard
          groupConfig={state.groupConfig}
          onAddItem={onAddItem}
          openIntoleranceContextMenu={openIntoleranceContextMenu}
          openDietContextMenu={openDietContextMenu}
          onPortionChange={onPortionChange}
          onDiscardChanges={onDiscardChanges}
          onRecalculatePortions={onRecalculatePortions}
          showUpdateConfigButtons={showUpdateConfigButtons}
        />
        <Box component="div" sx={{display: "flex", justifyContent: "flex-end"}}>
          {onCancel && (
            <Button variant="outlined" color="primary" onClick={cancelCreate}>
              {onCancel.buttonText}
            </Button>
          )}
          {onConfirm && (
            <Button
              variant="contained"
              color="primary"
              style={{
                marginLeft: theme.spacing(2),
              }}
              onClick={saveEvent}
            >
              {onConfirm.buttonText}
            </Button>
          )}
        </Box>
      </Stack>
      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={onRenameItem}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_RENAME}
          </Typography>
        </MenuItem>
        <MenuItem
          onClick={onDeleteItem}
          disabled={
            (!!contextMenuSelectedItem.dietUid &&
              Object.keys(state.groupConfig.diets.entries).length === 1) ||
            (!!contextMenuSelectedItem.intoleranceUid &&
              Object.keys(state.groupConfig.intolerances.entries).length === 1)
          }
        >
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_DELETE}
          </Typography>
        </MenuItem>
      </Menu>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};
/** Props für die Gruppenkonfiguration-Karte. */
interface EventGroupConfigurationCardProps {
  /** Aktuelle Gruppenkonfiguration. */
  groupConfig: EventGroupConfiguration;
  /** Callback zum Hinzufügen eines neuen Elements (Diät oder Intoleranz). */
  onAddItem: (type: GroupConfigDimension) => void;
  /** Öffnet das Kontextmenü für eine Intoleranz. */
  openIntoleranceContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  /** Öffnet das Kontextmenü für eine Diätgruppe. */
  openDietContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  /** Callback bei Änderung einer Portionenzahl. */
  onPortionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Verwirft alle Änderungen und stellt den Originalzustand wieder her. */
  onDiscardChanges: () => void;
  /** Speichert die Änderungen und berechnet die Portionen im Menüplan neu. */
  onRecalculatePortions: () => void;
  /** Ob die Buttons zum Speichern/Verwerfen angezeigt werden sollen. */
  showUpdateConfigButtons?: boolean;
}

/**
 * Karte mit der tabellarischen Darstellung der Gruppenkonfiguration.
 * Zeigt Intoleranzen (Zeilen), Diätgruppen (Spalten) und Total-Spalte.
 */
const EventGroupConfigurationCard = ({
  groupConfig,
  onAddItem,
  openIntoleranceContextMenu,
  openDietContextMenu,
  onPortionChange,
  onDiscardChanges,
  onRecalculatePortions,
  showUpdateConfigButtons = false,
}: EventGroupConfigurationCardProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  // Mindestbreite dynamisch anpassen, damit jede Diät-Spalte genug Platz hat
  const dietCount = Object.keys(groupConfig.diets.entries).length;
  const dynamicMinWidth = Math.max(750, 550 + dietCount * 150);

  return (
    <div style={{overflowX: "auto", minWidth: `${dynamicMinWidth}px`, padding: "1px"}}>
      <Card sx={classes.card}>
        <CardHeader
          title={TEXT_GROUP_CONFIGURATION_SETTINGS}
          subheader={TEXT_GROUP_CONFIGURATION_SETTINGS_DESCRIPTION}
        />
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={3}>
              <EventGroupConfigLeadColumn
                groupConfig={groupConfig}
                onAddIntolerance={() =>
                  onAddItem(GroupConfigDimension.intolerance)
                }
                openIntoleranceContextMenu={openIntoleranceContextMenu}
              />
            </Grid>
            <Grid size={9}>
              <Box sx={{display: "flex", gap: 2}}>
                <EventGroupConfigDietColumn
                  groupConfig={groupConfig}
                  openDietContextMenu={openDietContextMenu}
                  onFieldChange={onPortionChange}
                />
                {/* Trennlinie mit Diät-hinzufügen-Button */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Box sx={classes.itemGroupConfigurationRow}>
                    <Tooltip title={TEXT_ADD_DIET}>
                      <IconButton
                        aria-label="Diät hinzufügen"
                        color="primary"
                        onClick={() => onAddItem(GroupConfigDimension.diet)}
                        size="large"
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Divider
                    orientation="vertical"
                    flexItem
                    sx={{flexGrow: 1}}
                  />
                </Box>
                <EventGroupConfigTotalColumn
                  groupConfig={groupConfig}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      {showUpdateConfigButtons && (
        <Box
          component="div"
          style={{
            marginTop: theme.spacing(2),
            justifyContent: "flex-end",
            display: "flex",
          }}
        >
          <Button
            color="primary"
            variant="outlined"
            onClick={onDiscardChanges}
            sx={{marginRight: theme.spacing(2)}}
          >
            {TEXT_DISCARD_CHANGES}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={onRecalculatePortions}
          >
            {TEXT_SAVE} {TEXT_AND} {TEXT_RECALCULATE_PORTIONS}
          </Button>
        </Box>
      )}
    </div>
  );
};
/** Props für die Lead-Spalte (Intoleranzen + Total-Label). */
interface EventGroupConfigLeadColumnProps {
  /** Aktuelle Gruppenkonfiguration. */
  groupConfig: EventGroupConfiguration;
  /** Callback zum Hinzufügen einer neuen Intoleranz. */
  onAddIntolerance: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Öffnet das Kontextmenü für eine Intoleranz. */
  openIntoleranceContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
}

/**
 * Erste Spalte der Gruppenkonfigurations-Tabelle.
 * Zeigt die Intoleranznamen mit Kontextmenü-Button und einen
 * Button zum Hinzufügen neuer Intoleranzen.
 */
const EventGroupConfigLeadColumn = ({
  groupConfig,
  onAddIntolerance,
  openIntoleranceContextMenu,
}: EventGroupConfigLeadColumnProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      <Grid container spacing={2}>
        <Grid size={12} sx={classes.itemGroupConfigurationRow}>
          <Typography variant="h6" component="h2">
            {TEXT_GROUPS}
          </Typography>
        </Grid>
        {groupConfig.intolerances.order.map((intoleranceUid) => (
          <Grid size={12}
            sx={classes.itemGroupConfigurationRow}
            key={"intolerance_grid_" + intoleranceUid}
          >
            <Grid container alignItems="center" wrap="nowrap" sx={{width: "100%"}}>
              <Grid sx={{overflow: "hidden", flex: 1, minWidth: 0}}>
                <Typography variant="body1">
                  {groupConfig.intolerances.entries[intoleranceUid].name}
                </Typography>
              </Grid>
              <Grid>
                <IconButton
                  id={"MoreBtn_intolerance_" + intoleranceUid}
                  aria-label="position-options"
                  onClick={openIntoleranceContextMenu}
                  size="small"
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Grid>
            </Grid>
          </Grid>
        ))}
        <Grid
          size={12}
          sx={classes.itemGroupConfigurationRow}
          style={{alignItems: "center"}}
        >
          <Button
            color="primary"
            startIcon={<AddIcon />}
            onClick={onAddIntolerance}
            style={{whiteSpace: "nowrap", minWidth: "auto"}}
          >
            {TEXT_INTOLERANCE}
          </Button>
        </Grid>
        <Grid size={12}>
          <Divider />
        </Grid>
        <Grid size={12} sx={classes.itemGroupConfigurationRow}>
          <Typography variant="h6" component="h2">
            {TEXT_TOTAL}
          </Typography>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/** Props für die Diät-Spalten (je eine pro Diätgruppe). */
interface EventGroupConfigDietColumnProps {
  /** Aktuelle Gruppenkonfiguration. */
  groupConfig: EventGroupConfiguration;
  /** Öffnet das Kontextmenü für eine Diätgruppe. */
  openDietContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  /** Callback bei Änderung einer Portionenzahl im Eingabefeld. */
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Spalten für die einzelnen Diätgruppen.
 * Pro Diätgruppe wird eine Spalte mit Portioneneingabefeldern
 * (je Intoleranz) und dem Spaltentotal dargestellt.
 */
const EventGroupConfigDietColumn = ({
  groupConfig,
  openDietContextMenu,
  onFieldChange,
}: EventGroupConfigDietColumnProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      {groupConfig.diets.order.map((dietUid) => (
        <Box key={"grid_diet" + dietUid} sx={{flex: 1, minWidth: 0}}>
          <Grid container spacing={2}>
            <Grid size={12} sx={classes.itemGroupConfigurationRow}>
              <Grid container alignItems="center" wrap="nowrap" sx={{width: "100%"}}>
                <Grid sx={{overflow: "hidden", flex: 1, minWidth: 0}}>
                  <Tooltip title={groupConfig.diets.entries[dietUid].name}>
                    <Typography
                      variant="h6"
                      component="h2"
                      noWrap
                    >
                      {groupConfig.diets.entries[dietUid].name}
                    </Typography>
                  </Tooltip>
                </Grid>
                <Grid>
                  <IconButton
                    id={"MoreBtn_diet_" + dietUid}
                    aria-label="position-options"
                    style={{paddingRight: "0px"}}
                    size="small"
                    onClick={openDietContextMenu}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            </Grid>

            {groupConfig.intolerances.order.map((intoleranceUid) => (
              <Grid size={12}
                sx={classes.itemGroupConfigurationRow}
                key={
                  "grid_column_" + dietUid + "_intolerance_" + intoleranceUid
                }
              >
                <TextField
                  key={"portions_" + dietUid + "_" + intoleranceUid}
                  id={"portions_" + dietUid + "_" + intoleranceUid}
                  label={TEXT_PORTIONS}
                  variant="outlined"
                  size="small"
                  fullWidth
                  InputProps={{
                    inputProps: {
                      min: 0,
                      step: 1,
                    },
                    inputComponent: "input",
                  }}
                  onWheel={(event) =>
                    event.target instanceof HTMLElement && event.target.blur()
                  }
                  value={groupConfig.portions[dietUid][intoleranceUid]}
                  onChange={onFieldChange}
                />
              </Grid>
            ))}

            <Grid size={12} sx={classes.itemGroupConfigurationRow} />
            {/* Leer da Button nicht nötig */}
            <Grid size={12}>
              <Divider />
            </Grid>
            <Grid size={12} sx={classes.itemGroupConfigurationRow}>
              <TextField
                key={"total_diet_" + dietUid}
                id={"total_diet_" + dietUid}
                label={TEXT_PORTIONS}
                variant="outlined"
                disabled
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <strong>=</strong>
                    </InputAdornment>
                  ),
                }}
                value={groupConfig.diets.entries[dietUid].totalPortions}
              />
            </Grid>
          </Grid>
        </Box>
      ))}
    </React.Fragment>
  );
};
/** Props für die Total-Spalte. */
interface EventGroupConfigTotalColumnProps {
  /** Aktuelle Gruppenkonfiguration. */
  groupConfig: EventGroupConfiguration;
}

/**
 * Letzte Spalte der Gruppenkonfigurations-Tabelle.
 * Zeigt die Zeilensummen pro Intoleranz und die Gesamtsumme
 * aller Portionen.
 */
const EventGroupConfigTotalColumn = ({
  groupConfig,
}: EventGroupConfigTotalColumnProps) => {
  const classes = useCustomStyles();

  return (
    <Box sx={{flex: 1, minWidth: 0}}>
      <Grid container spacing={2}>
        <Grid size={12} sx={classes.itemGroupConfigurationRow}>
          <Typography variant="h6" component="h2">
            {TEXT_TOTAL}
          </Typography>
        </Grid>
        {groupConfig.intolerances.order.map((intoleranceUid) => (
          <Grid size={12}
            sx={classes.itemGroupConfigurationRow}
            key={"grid_total_colum_" + intoleranceUid}
          >
            <TextField
              key={"intolerance_total_" + intoleranceUid}
              label={TEXT_PORTIONS}
              variant="outlined"
              size="small"
              fullWidth
              disabled
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <strong>=</strong>
                  </InputAdornment>
                ),
              }}
              value={
                groupConfig.intolerances.entries[intoleranceUid].totalPortions
              }
            />
          </Grid>
        ))}
        <Grid size={12}
          sx={classes.itemGroupConfigurationRow}
          style={{alignItems: "center"}}
        >
          <div> </div>
        </Grid>
        <Grid size={12}>
          <Divider />
        </Grid>
        <Grid size={12} sx={classes.itemGroupConfigurationRow}>
          <TextField
            label={TEXT_PORTIONS}
            variant="outlined"
            size="small"
            fullWidth
            disabled
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <strong>=</strong>
                </InputAdornment>
              ),
            }}
            value={groupConfig.totalPortions}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export {EventGroupConfigurationPage};
