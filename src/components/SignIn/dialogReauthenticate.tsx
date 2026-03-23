import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import * as Sentry from "@sentry/react";
import {
  REAUTHENTICATE_DIALOG_TITLE as TEXT_REAUTHENTICATE_DIALOG_TITLE,
  SIGN_IN_WHY_REAUTHENTICATE as TEXT_SIGN_IN_WHY_REAUTHENTICATE,
  EMAIL as TEXT_EMAIL,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  CANCEL as TEXT_CANCEL,
  SIGN_IN as TEXT_SIGN_IN,
} from "../../constants/text";
import {User} from "../User/user.class";

import {AlertMessage} from "../Shared/AlertMessage";
import DatabaseService from "../Database/DatabaseService";
import AuthUser from "../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  UPDATE_FIELD,
  SET_INITIAL_VALUES,
  GENERIC_ERROR,
}

type ReAuthData = {
  email: string;
  password: string;
};
type State = {
  reAuthData: ReAuthData;
  error: Error | null;
};

type DispatchAction =
  | {
      type: ReducerActions.UPDATE_FIELD;
      payload: {field: string; value: string};
    }
  | {type: ReducerActions.SET_INITIAL_VALUES; payload: Record<string, never>}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

const initialState: State = {
  reAuthData: {
    email: "",
    password: "",
  },
  error: null,
};

/**
 * Erstellt den initialen State basierend auf dem angemeldeten Benutzer.
 * Wird als Lazy-Initializer für useReducer verwendet, um
 * Dispatch-Aufrufe im Render-Body zu vermeiden.
 *
 * @param authUser - Aktuell angemeldeter Benutzer (oder null).
 * @returns Initialer State mit vorausgefüllter E-Mail.
 */
const getInitialState = (authUser: AuthUser | null): State => ({
  reAuthData: {email: authUser?.email ?? "", password: ""},
  error: null,
});

/**
 * Reducer für den Reauthentifizierungs-Dialog.
 * Verwaltet Formulardaten und Fehlerzustand.
 *
 * @param state - Aktueller State
 * @param action - Auszuführende Aktion
 * @returns Neuer State
 */
const reAuthenticateReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        reAuthData: {
          ...state.reAuthData,
          [action.payload.field]: action.payload.value,
        },
      };
    case ReducerActions.SET_INITIAL_VALUES:
      return initialState;
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload};
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

/* ===================================================================
// ==================== Reauthentifizierungs-Dialog ==================
// =================================================================== */
/**
 * Props für den Reauthentifizierungs-Dialog.
 *
 * @param database - DatabaseService-Instanz für Auth-Aufrufe.
 * @param dialogOpen - Ob der Dialog geöffnet ist.
 * @param handleOk - Callback bei erfolgreicher Anmeldung.
 * @param handleClose - Callback beim Abbrechen.
 * @param authUser - Aktuell angemeldeter Benutzer (für E-Mail-Vorausfüllung).
 */
interface DialogReauthenticateProps {
  database: DatabaseService;
  dialogOpen: boolean;
  handleOk: () => void;
  handleClose: () => void;
  authUser: AuthUser | null;
}

/**
 * Dialog zur erneuten Authentifizierung.
 * Wird vor sicherheitsrelevanten Aktionen (E-Mail-/Passwortänderung)
 * angezeigt, damit der Benutzer seine Identität bestätigt.
 *
 * @param props - DialogReauthenticateProps
 */
const DialogReauthenticate = ({
  database,
  dialogOpen,
  handleOk,
  handleClose: handleCloseSuper,
  authUser = null,
}: DialogReauthenticateProps) => {
  const [state, dispatch] = React.useReducer(
    reAuthenticateReducer,
    authUser,
    (authUserArg) => getInitialState(authUserArg),
  );
  const [showPassword, setShowPassword] = React.useState(false);

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  /**
   * Aktualisiert ein Formularfeld im State. Entfernt den "reauth-"-Prefix
   * von der Element-ID, um den Feldnamen zu ermitteln.
   *
   * @param event - Change-Event des Eingabefelds
   */
  const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => {
    // ID-Prefix "reauth-" entfernen, um den Feldnamen zu erhalten
    const field = event.target.id.replace("reauth-", "");
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field, value: event.target.value},
    });
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  /**
   * Führt die Reauthentifizierung über Supabase Auth durch.
   * Bei Erfolg wird der Login registriert und der Dialog geschlossen.
   */
  const onSignIn = async () => {
    try {
      await database.auth.signInWithPassword(
        state.reAuthData.email,
        state.reAuthData.password
      );
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "Reauthentifizierung"}});
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
      return;
    }

    // Login in eigener Sammlung registrieren
    if (authUser) {
      User.registerSignIn({
        database: database,
        authUser: authUser,
      });
    }

    handleOk();
    dispatch({type: ReducerActions.SET_INITIAL_VALUES, payload: {}});
  };
  /* ------------------------------------------
  // PopUp Schliessen
  // ------------------------------------------ */
  /**
   * Schliesst den Dialog. Ignoriert versehentliche Klicks
   * ausserhalb des Dialogs (clickaway).
   *
   * @param event - Das auslösende Event
   * @param reason - Grund für das Schliessen (z.B. "clickaway", "escapeKeyDown")
   */
  const handleClose = (
    event: React.SyntheticEvent | React.MouseEvent,
    reason?: string,
  ) => {
    if (reason === "clickaway") {
      // Versehntliches Klicken ausserhalb des Dialog
      // schliesst diesen nicht
      return;
    }
    handleCloseSuper();
  };
  /* ------------------------------------------
  // Password-Button-Handler
  // ------------------------------------------ */
  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };
  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };
  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialogReauthenticate"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="dialogTitleReauthenticate">
        {TEXT_REAUTHENTICATE_DIALOG_TITLE}
      </DialogTitle>
      <DialogContent>
        {!state.error && (
          <AlertMessage
            severity={"info"}
            body={TEXT_SIGN_IN_WHY_REAUTHENTICATE}
          />
        )}
        {state.error && (
          <AlertMessage error={state.error} />
        )}
        {/* Mailadresse */}
        <TextField
          disabled={!!authUser}
          type="email"
          margin="normal"
          required
          fullWidth
          id="reauth-email"
          label={TEXT_EMAIL}
          name="reAuth_email"
          autoFocus
          value={state.reAuthData.email}
          onChange={onChangeField}
        />
        {/* Passwort */}
        <TextField
          type={showPassword ? "text" : "password"}
          margin="normal"
          required
          fullWidth
          id="reauth-password"
          name="password"
          label={TEXT_PASSWORD}
          autoComplete="current-password"
          value={state.reAuthData.password}
          onChange={onChangeField}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={TEXT_SHOW_PASSWORD}
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                    size="large"
                  >
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onSignIn} color="primary" variant="contained">
          {TEXT_SIGN_IN}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export {DialogReauthenticate};
