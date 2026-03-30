import React, {SyntheticEvent} from "react";

import {
  Backdrop,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  SnackbarCloseReason,
  Stack,
  Switch,
  useTheme,
} from "@mui/material";

import {
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  GLOBAL_SETTINGS as TEXT_GLOBAL_SETTINGS,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  CANCEL as TEXT_CANCEL,
  SIGN_OUT as TEXT_SIGN_OUT,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  GLOBAL_SETTINGS_ALLOW_SIGNUP_LABEL as TEXT_GLOBAL_SETTINGS_ALLOW_SIGNUP_LABEL,
  GLOBAL_SETTINGS_ALLOW_SIGNUP_DESCRIPTION as TEXT_GLOBAL_SETTINGS_ALLOW_SIGNUP_DESCRIPTION,
  GLOBAL_SETTINGS_MAINTENANCE_MODE_LABEL as TEXT_GLOBAL_SETTINGS_MAINTENANCE_MODE_LABEL,
  GLOBAL_SETTINGS_MAINTENANCE_MODE_DESCRIPTION as TEXT_GLOBAL_SETTINGS_MAINTENANCE_MODE_DESCRIPTION,
  SIGN_OUT_ALL_USERS as TEXT_SIGN_OUT_ALL_USERS,
  SIGN_OUT_ALL_USERS_DESCRIPTION as TEXT_SIGN_OUT_ALL_USERS_DESCRIPTION,
  SIGN_OUT_EVERYBODY as TEXT_SIGN_OUT_EVERYBODY,
  DIALOG_SIGNOUT_USERS_CONFIRMATION as TEXT_DIALOG_SIGNOUT_USERS_CONFIRMATION,
  DIALOG_SUBTITLE_SIGNOUT_USERS_CONFIRMATION as TEXT_DIALOG_SUBTITLE_SIGNOUT_USERS_CONFIRMATION,
  DIALOG_TEXT_SIGNOUT_USERS_CONFIRMATION as TEXT_DIALOG_TEXT_SIGNOUT_USERS_CONFIRMATION,
  USERS_ARE_LOGGED_OUT as TEXT_USERS_ARE_LOGGED_OUT,
} from "../../../constants/text";

import {GlobalSettingsDomain} from "../../Database/Repository/GlobalSettingsRepository";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {ButtonRow} from "../../Shared/buttonRow";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";

import {AlertMessage} from "../../Shared/AlertMessage";

import * as Sentry from "@sentry/react";

import {useAuthUser} from "../../Session/authUserContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {supabase} from "../../Database/supabaseClient";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useCustomStyles} from "../../../constants/styles";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  GLOBAL_SETTINGS_FETCH_INIT,
  GLOBAL_SETTINGS_FETCH_SUCCESS,
  GLOBAL_SETTINGS_SAVE_SUCCESS,
  GLOBAL_SETTINGS_ON_CHANGE,
  SIGN_OUT_ALL_USERS,
  CLOSE_SNACKBAR,
  GENERIC_ERROR,
}
/** Diskriminierte Union für typsichere Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.GLOBAL_SETTINGS_FETCH_INIT}
  | {type: ReducerActions.GLOBAL_SETTINGS_FETCH_SUCCESS; payload: GlobalSettingsDomain}
  | {type: ReducerActions.GLOBAL_SETTINGS_ON_CHANGE; payload: Partial<GlobalSettingsDomain>}
  | {type: ReducerActions.GLOBAL_SETTINGS_SAVE_SUCCESS}
  | {type: ReducerActions.SIGN_OUT_ALL_USERS; payload: {count: number}}
  | {type: ReducerActions.CLOSE_SNACKBAR}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  globalSettings: GlobalSettingsDomain;
  isError: boolean;
  error: Error | null;
  isLoading: boolean;
  snackbar: SnackbarState;
};

const inititialState: State = {
  globalSettings: {allowSignUp: false, maintenanceMode: false},
  error: null,
  isError: false,
  isLoading: false,
  snackbar: {open: false, severity: "success", message: ""},
};

/**
 * Reducer für die globale Einstellungsseite.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const globalSettingsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.GLOBAL_SETTINGS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        isError: false,
      };
    case ReducerActions.GLOBAL_SETTINGS_FETCH_SUCCESS:
      return {
        ...state,
        globalSettings: action.payload,
        isLoading: false,
        isError: false,
      };
    case ReducerActions.GLOBAL_SETTINGS_ON_CHANGE:
      return {
        ...state,
        globalSettings: {
          ...state.globalSettings,
          ...action.payload,
        },
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        error: action.payload,
      };
    case ReducerActions.GLOBAL_SETTINGS_SAVE_SUCCESS:
      return {
        ...state,
        isError: false,
        error: null,
        snackbar: {
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
          open: true,
        },
      };
    case ReducerActions.SIGN_OUT_ALL_USERS:
      return {
        ...state,
        isError: false,
        error: null,
        snackbar: {
          severity: "success",
          message: `${action.payload.count} ${TEXT_USERS_ARE_LOGGED_OUT}`,
          open: true,
        },
      };
    case ReducerActions.CLOSE_SNACKBAR:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const GlobalSettingsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [editMode, setEditMode] = React.useState(false);

  const [state, dispatch] = React.useReducer(
    globalSettingsReducer,
    inititialState,
  );

  /* ------------------------------------------
  // Globale Einstellungen holen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.GLOBAL_SETTINGS_FETCH_INIT});
    database.globalSettings
      .getSettings()
      .then((result) => {
        dispatch({
          type: ReducerActions.GLOBAL_SETTINGS_FETCH_SUCCESS,
          payload: result ?? {allowSignUp: false, maintenanceMode: false},
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, []);
  /* ------------------------------------------
  // Edit Mode wechsel
  // ------------------------------------------ */
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };
  /* ------------------------------------------
  // Feldwert ändern
  // ------------------------------------------ */
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // let newValue;

    // if (event.target.name === "allowSignUp") {
    //   newValue = event.target.checked;
    // } else {
    //   newValue = event.target.value;
    // }

    dispatch({
      type: ReducerActions.GLOBAL_SETTINGS_ON_CHANGE,
      payload: {[event.target.name]: event.target.checked},
    });
  };
  /* ------------------------------------------
  // Alle abmelden
  // ------------------------------------------ */
  const onSignOutAllUsers = async () => {
    // Löschung wurde bestätigt. Löschen kann losgehen
    const isConfirmed = await customDialog({
      dialogType: DialogType.ConfirmSecure,
      deletionDialogProperties: {confirmationString: "logoff"},
      title: TEXT_DIALOG_SIGNOUT_USERS_CONFIRMATION,
      subtitle: TEXT_DIALOG_SUBTITLE_SIGNOUT_USERS_CONFIRMATION,
      text: TEXT_DIALOG_TEXT_SIGNOUT_USERS_CONFIRMATION,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_SIGN_OUT,
    });
    if (!isConfirmed) {
      return;
    }
    supabase.functions
      .invoke("sign-out-all-users")
      .then(({data, error}) => {
        if (error) throw error;
        dispatch({
          type: ReducerActions.SIGN_OUT_ALL_USERS,
          payload: {count: data?.count ?? 0},
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  };
  /* ------------------------------------------
  // Einstellungen speichern
  // ------------------------------------------ */
  const onSaveClick = () => {
    database.globalSettings
      .saveSettings(state.globalSettings, authUser!)
      .then(() => {
        dispatch({type: ReducerActions.GLOBAL_SETTINGS_SAVE_SUCCESS});
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  };
  /* ------------------------------------------
  // Snackback schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = (
    event: Event | SyntheticEvent<any, Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.CLOSE_SNACKBAR});
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_GLOBAL_SETTINGS} breadcrumbs={[SYSTEM_BREADCRUMB]} />

      <ButtonRow
        key="buttons_edit"
        buttons={[
          {
            id: "edit",
            hero: true,
            visible: true,

            label: TEXT_EDIT,
            variant: "contained",
            color: "primary",
            onClick: toggleEditMode,
          },
          {
            id: "save",
            hero: true,
            visible: true,
            label: TEXT_SAVE,
            variant: "outlined",
            color: "primary",
            disabled: !editMode,
            onClick: onSaveClick,
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
              error={state.error!}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          <PanelGlobalSettings
            editMode={editMode}
            globalSettings={state.globalSettings}
            onChange={onChange}
            onSignOutAllUsers={onSignOutAllUsers}
          />
        </Stack>
      </Container>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};
// /* ===================================================================
// // ======================== Feed Einträge löschen ====================
// // =================================================================== */
interface PanelGlobalSettingsProps {
  editMode: boolean;
  globalSettings: GlobalSettingsDomain;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSignOutAllUsers: () => void;
}
const PanelGlobalSettings = ({
  editMode,
  globalSettings,
  onChange,
  onSignOutAllUsers,
}: PanelGlobalSettingsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <List>
          <ListItem
            secondaryAction={
              <Switch
                checked={globalSettings.allowSignUp}
                onChange={onChange}
                name={"allowSignUp"}
                id={"allowSignUp"}
                disabled={!editMode}
              />
            }
          >
            <ListItemText
              primary={TEXT_GLOBAL_SETTINGS_ALLOW_SIGNUP_LABEL}
              secondary={TEXT_GLOBAL_SETTINGS_ALLOW_SIGNUP_DESCRIPTION}
            />
          </ListItem>
          <ListItem
            secondaryAction={
              <Switch
                checked={globalSettings.maintenanceMode}
                onChange={onChange}
                name={"maintenanceMode"}
                id={"maintenanceMode"}
                disabled={!editMode}
              />
            }
          >
            <ListItemText
              primary={TEXT_GLOBAL_SETTINGS_MAINTENANCE_MODE_LABEL}
              secondary={TEXT_GLOBAL_SETTINGS_MAINTENANCE_MODE_DESCRIPTION}
            />
          </ListItem>
          <ListItem
            secondaryAction={
              <Button
                variant="outlined"
                sx={{color: theme.palette.error.main, whiteSpace: "nowrap"}}
                onClick={onSignOutAllUsers}
              >
                {TEXT_SIGN_OUT_EVERYBODY}
              </Button>
            }
          >
            <ListItemText
              primary={TEXT_SIGN_OUT_ALL_USERS}
              secondary={TEXT_SIGN_OUT_ALL_USERS_DESCRIPTION}
              slotProps={{secondary: {sx: {whiteSpace: "pre-line"}}}}
              sx={{mr: 2}}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

export default GlobalSettingsPage;
