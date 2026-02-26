import React from "react";

import {
  Container,
  Button,
  TextField,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Link,
  CircularProgress,
} from "@mui/material";

import PageTitle from "../Shared/pageTitle";
import useCustomStyles from "../../constants/styles";
import AlertMessage from "../Shared/AlertMessage";
import {PASSWORD_RESET as ROUTES_PASSWORD_RESET} from "../../constants/routes";
import {
  PASSWORD_RESET as TEXT_PASSWORD_RESET,
  EVERYBODY_FORGETS_SOMETHING as TEXT_EVERYBODY_FORGETS_SOMETHING,
  PASSWORD_MAGIC_LINK_IN_INBOX as TEXT_PASSWORD_WHERE_SEND_MAGIC_LINK,
  EMAIL as TEXT_EMAIL,
  RESET as TEXT_RESET,
  ALERT_TATSCH_BANG_DONE as TEXT_ALERT_TATSCH_BANG_DONE,
  PASSWORD_LINK_SENT as TEXT_PASSWORD_LINK_SENT,
  HAVE_YOU_FORGOTEN_YOUR_PASSWORD as TEXT_HAVE_YOU_FORGOTEN_YOUR_PASSWORD,
} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";
import {useNavigate} from "react-router";
import Utils from "../Shared/utils.class";
import {useDatabase} from "../Database/DatabaseContext";

/* ===================================================================
// ======================== State Management ==========================
// =================================================================== */

enum ReducerActions {
  UPDATE_FIELD,
  RESET_STARTED,
  PASSWORD_LINK_SENT_SUCCESS,
  GENERIC_ERROR,
}

/**
 * State für die Passwort-Zurücksetzen-Seite.
 *
 * @param email - Eingegebene E-Mail-Adresse
 * @param mailSent - Ob der Reset-Link erfolgreich versendet wurde
 * @param isLoading - Ob gerade ein Request läuft
 * @param error - Fehlerobjekt bei gescheitertem Request
 */
interface State {
  email: string;
  mailSent: boolean;
  isLoading: boolean;
  error: Error | null;
}

/** Diskriminierte Union für typsichere Reducer-Actions */
type DispatchAction =
  | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: string}}
  | {type: ReducerActions.RESET_STARTED}
  | {type: ReducerActions.PASSWORD_LINK_SENT_SUCCESS}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

const initialState: State = {
  email: "",
  mailSent: false,
  isLoading: false,
  error: null,
};

/**
 * Reducer für die Passwort-Zurücksetzen-Seite.
 * Verwaltet E-Mail-Eingabe, Ladezustand, Erfolg und Fehler.
 *
 * @param state - Aktueller State
 * @param action - Auszuführende Aktion
 * @returns Neuer State
 */
const passwordResetReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        [action.payload.field]: action.payload.value,
      };
    case ReducerActions.RESET_STARTED:
      return {...state, isLoading: true, error: null};
    case ReducerActions.PASSWORD_LINK_SENT_SUCCESS:
      return {...state, mailSent: true, isLoading: false};
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload, isLoading: false};
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Seite zum Zurücksetzen des Passworts.
 *
 * Der Benutzer gibt seine E-Mail-Adresse ein und erhält einen
 * Reset-Link per E-Mail via Supabase Auth.
 *
 * @example
 * <PasswordResetPage />
 */
const PasswordResetPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();

  const [state, dispatch] = React.useReducer(
    passwordResetReducer,
    initialState,
  );

  /* ------------------------------------------
  // Feld-Handler
  // ------------------------------------------ */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };

  /* ------------------------------------------
  // Passwort-Reset auslösen
  // ------------------------------------------ */
  const onResetPassword = async () => {
    dispatch({type: ReducerActions.RESET_STARTED});

    try {
      await database.auth.resetPassword(state.email);
      dispatch({type: ReducerActions.PASSWORD_LINK_SENT_SUCCESS});
    } catch (error) {
      console.error(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  return (
    <React.Fragment>
      <PageTitle
        title={TEXT_PASSWORD_RESET}
        subTitle={TEXT_EVERYBODY_FORGETS_SOMETHING}
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
        <PasswordResetForm
          email={state.email}
          onFieldChange={onFieldChange}
          onResetPassword={onResetPassword}
          error={state.error}
          mailSent={state.mailSent}
          isLoading={state.isLoading}
        />
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ============================= Formular ============================
// =================================================================== */

/**
 * Props für das Passwort-Zurücksetzen-Formular.
 *
 * @param email - Aktuelle E-Mail-Eingabe
 * @param onFieldChange - Handler für Feldänderungen
 * @param onResetPassword - Handler für den Reset-Button
 * @param error - Fehlerobjekt (null wenn kein Fehler)
 * @param mailSent - Ob der Reset-Link versendet wurde
 * @param isLoading - Ob gerade ein Request läuft
 */
interface PasswordResetFormProps {
  email: string;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetPassword: () => void;
  error: Error | null;
  mailSent: boolean;
  isLoading: boolean;
}

/**
 * Formular zum Eingeben der E-Mail-Adresse für den Passwort-Reset.
 * Zeigt nach erfolgreichem Versand eine Erfolgsmeldung an.
 */
const PasswordResetForm = ({
  email,
  onFieldChange,
  onResetPassword,
  error,
  mailSent,
  isLoading,
}: PasswordResetFormProps) => {
  const classes = useCustomStyles();
  const isValidEmail = Utils.isEmail(email);

  return (
    <Card sx={classes.card}>
      <CardMedia
        sx={{...classes.cardMedia, marginTop: "2rem"}}
        image={ImageRepository.getEnvironmentRelatedPicture().SIGN_IN_HEADER}
        title={"Logo"}
      />
      <CardContent sx={classes.cardContent}>
        {mailSent && (
          <Typography
            gutterBottom={true}
            variant="h5"
            align="center"
            component="h2"
          >
            {TEXT_PASSWORD_WHERE_SEND_MAGIC_LINK}
          </Typography>
        )}
        {/* Mailadresse */}
        <TextField
          type="email"
          margin="normal"
          required
          fullWidth
          id="email"
          label={TEXT_EMAIL}
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={onFieldChange}
          disabled={isLoading}
          sx={{marginBottom: "1rem"}}
        />
        <Button
          disabled={!isValidEmail || isLoading}
          fullWidth
          variant="contained"
          color="primary"
          onClick={onResetPassword}
          startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
        >
          {TEXT_RESET}
        </Button>
        {error && <AlertMessage error={error} />}
        {mailSent && (
          <AlertMessage
            severity="success"
            messageTitle={TEXT_ALERT_TATSCH_BANG_DONE}
            body={TEXT_PASSWORD_LINK_SENT}
          />
        )}
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// =============================== Link ==============================
// =================================================================== */

/**
 * Link-Komponente zum Navigieren zur Passwort-Zurücksetzen-Seite.
 * Wird in SignIn- und SignUp-Fehleranzeigen eingebettet.
 *
 * @example
 * <ForgotPasswordLink />
 */
export const ForgotPasswordLink = () => {
  const navigate = useNavigate();

  const goToPasswordReset = () => {
    navigate(ROUTES_PASSWORD_RESET);
  };

  return (
    <Typography variant="body2">
      {TEXT_HAVE_YOU_FORGOTEN_YOUR_PASSWORD}
      <Link component="button" onClick={goToPasswordReset}>
        {TEXT_PASSWORD_RESET}
      </Link>
    </Typography>
  );
};

export default PasswordResetPage;
