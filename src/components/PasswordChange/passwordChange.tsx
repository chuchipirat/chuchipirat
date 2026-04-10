/**
 * Seite zum Ändern von E-Mail-Adresse und/oder Passwort.
 *
 * Zwei Modi:
 * - **Reset-Flow** (oobCode vorhanden): Nur Passwort-Änderung, keine Reauthentifizierung.
 * - **Login-Change-Flow** (kein oobCode): E-Mail- und Passwort-Änderung nach Reauthentifizierung.
 */
import React from "react";
import * as Sentry from "@sentry/react";

import {Link, useNavigate} from "react-router";

import {
  Box,
  Container,
  Button,
  IconButton,
  TextField,
  Typography,
  Card,
  CardContent,
  CardMedia,
  InputAdornment,
  Alert,
  AlertTitle,
  FormHelperText,
  CircularProgress,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import {PasswordStrengthMeter} from "../Shared/passwordStrengthMeter";
import {PageTitle} from "../Shared/pageTitle";
import {useCustomStyles} from "../../constants/styles";

import {AlertMessage} from "../Shared/AlertMessage";
import {DialogReauthenticate} from "../SignIn/dialogReauthenticate";
import {CustomSnackbar, SnackbarState} from "../Shared/customSnackbar";

import {AuthMessages} from "../../constants/firebaseMessages";
import * as ROUTES from "../../constants/routes";
import {
  EMAIL as TEXT_EMAIL,
  PASSWORD_CHANGE as TEXT_PASSWORD_CHANGE,
  LOGIN_CHANGE as TEXT_LOGIN_CHANGE,
  PASSWORD_CHANGE_ARE_YOU_READY as TEXT_PASSWORD_CHANGE_ARE_YOU_READY,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  PASSWORD_RESET_EXPIRED as TEXT_PASSWORD_RESET_EXPIRED,
  ONE_TWO_TRHEE_DONE as TEXT_ONE_TWO_TRHEE_DONE,
  PASSWORD_HAS_BEEN_CHANGED as TEXT_PASSWORD_HAS_BEEN_CHANGED,
  EMAIL_HAS_BEEN_CHANGED as TEXT_EMAIL_HAS_BEEN_CHANGED,
  EMAIL_CHANGE_CONFIRMATION_SENT as TEXT_EMAIL_CHANGE_CONFIRMATION_SENT,
  GIVE_VALID_EMAIL as TEXT_GIVE_VALID_EMAIL,
  CHANGE_EMAIL as TEXT_CHANGE_EMAIL,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  CHANGE_PASSWORD as TEXT_CHANGE_PASSWORD,
  LOGIN_SUCCESSFULL as TEXT_LOGIN_SUCCESSFULL,
  NEW_EMAIL_IDENTICAL as TEXT_NEW_EMAIL_IDENTICAL,
  PASSWORDS_DONT_MATCH as TEXT_PASSWORDS_DONT_MATCH,
  PASSWORD_REQUIREMENTS_HINT as TEXT_PASSWORD_REQUIREMENTS_HINT,
  CONFIRM_PASSWORD as TEXT_CONFIRM_PASSWORD,
  PASSWORD_RESET_GO_TO_SIGN_IN as TEXT_GO_TO_SIGN_IN,
} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";
import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";
import {Utils} from "../Shared/utils.class";
import {FirebaseError} from "@firebase/util";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";

// ===================================================================
// ======================== globale Funktionen =======================
// ===================================================================
enum ReducerActions {
  UPDATE_FIELD,
  EMAIL_ERROR,
  PASSWORD_ERROR,
  SUCCESS_MAIL_CHANGE,
  SUCCESS_PW_CHANGE,
  SUCCESS_REAUTHENTICATION,
  SNACKBAR_CLOSE,
  SET_SUBMITTING,
}

/** Daten für E-Mail- und Passwortänderung. */
type PasswordChangeData = {
  email: string;
  password: string;
  passwordConfirm: string;
};

/** State der PasswordChange-Seite mit getrennten Fehler-/Erfolgsfeldern. */
type State = {
  passwordChangeData: PasswordChangeData;
  emailError: FirebaseError | null;
  passwordError: FirebaseError | null;
  successPwChange: boolean;
  successEmailChange: boolean;
  isSubmittingEmail: boolean;
  isSubmittingPassword: boolean;
  snackbar: SnackbarState;
};

/**
 * Diskriminierte Union für typsichere Reducer-Actions.
 */
type DispatchAction =
  | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: string}}
  | {type: ReducerActions.EMAIL_ERROR; payload: FirebaseError}
  | {type: ReducerActions.PASSWORD_ERROR; payload: FirebaseError}
  | {type: ReducerActions.SUCCESS_MAIL_CHANGE}
  | {type: ReducerActions.SUCCESS_PW_CHANGE}
  | {type: ReducerActions.SUCCESS_REAUTHENTICATION}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.SET_SUBMITTING; payload: {field: "email" | "password"; value: boolean}};

const initialState: State = {
  passwordChangeData: {
    email: "",
    password: "",
    passwordConfirm: "",
  },
  emailError: null,
  passwordError: null,
  successPwChange: false,
  successEmailChange: false,
  isSubmittingEmail: false,
  isSubmittingPassword: false,
  snackbar: {open: false, severity: "info", message: ""},
};

/**
 * Reducer für die PasswordChange-Seite.
 * Verwaltet Formularfelder, getrennte Fehler für E-Mail/Passwort
 * sowie Erfolgs-, Lade- und Snackbar-Zustände.
 *
 * @param state - Aktueller State.
 * @param action - Dispatch-Aktion (diskriminierte Union).
 * @returns Neuer State.
 */
const passwordChangeReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        passwordChangeData: {
          ...state.passwordChangeData,
          [action.payload.field]: action.payload.value,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {...state.snackbar, open: false},
      };
    case ReducerActions.SUCCESS_MAIL_CHANGE:
      return {
        ...state,
        successEmailChange: true,
        emailError: null,
        isSubmittingEmail: false,
      };
    case ReducerActions.SUCCESS_PW_CHANGE:
      return {
        ...state,
        successPwChange: true,
        passwordError: null,
        isSubmittingPassword: false,
      };
    case ReducerActions.SUCCESS_REAUTHENTICATION:
      return {
        ...state,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_LOGIN_SUCCESSFULL,
        },
      };
    case ReducerActions.EMAIL_ERROR:
      return {
        ...state,
        emailError: action.payload,
        successEmailChange: false,
        isSubmittingEmail: false,
      };
    case ReducerActions.PASSWORD_ERROR:
      return {
        ...state,
        passwordError: action.payload,
        successPwChange: false,
        isSubmittingPassword: false,
      };
    case ReducerActions.SET_SUBMITTING:
      return {
        ...state,
        ...(action.payload.field === "email"
          ? {isSubmittingEmail: action.payload.value}
          : {isSubmittingPassword: action.payload.value}),
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/** Props für die PasswordChangePage-Komponente. */
interface PasswordChangePageProps {
  /** Optionaler oobCode aus einem Passwort-Zurücksetzen-Link. */
  oobCode?: string;
}

/**
 * Seite zum Ändern von E-Mail-Adresse und/oder Passwort.
 * Zeigt zwei getrennte Karten: eine für E-Mail-Änderung (nur wenn
 * kein resetCode), eine für Passwort-Änderung (immer sichtbar).
 *
 * @param oobCode - Optionaler Code aus einem Passwort-Reset-Link.
 */
const PasswordChangePage: React.FC<PasswordChangePageProps> = ({oobCode}) => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const classes = useCustomStyles();
  const resetCode = oobCode;

  const [state, dispatch] = React.useReducer(
    passwordChangeReducer,
    initialState,
  );

  /* ------------------------------------------
  // E-Mail setzen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!state.passwordChangeData.email && resetCode && !state.passwordError) {
      // Bei Supabase Recovery wird die E-Mail aus der Session geladen
      database.auth
        .getUser()
        .then((user) => {
          if (user?.email) {
            dispatch({
              type: ReducerActions.UPDATE_FIELD,
              payload: {field: "email", value: user.email},
            });
          }
        })
        .catch((error) => {
          dispatch({type: ReducerActions.PASSWORD_ERROR, payload: error});
        });
    } else if (!state.passwordChangeData.email && authUser) {
      dispatch({
        type: ReducerActions.UPDATE_FIELD,
        payload: {field: "email", value: authUser.email},
      });
    }
  }, []);

  // Reauthentifizierung nur nötig, wenn kein resetCode vorhanden
  const [reauthentication, setReauthentication] = React.useState({
    needed: resetCode === undefined,
    done: false,
  });

  /* ------------------------------------------
  // E-Mail ändern
  // ------------------------------------------ */
  const onEmailChange = async () => {
    if (!authUser) return;

    if (authUser.email === state.passwordChangeData.email) {
      dispatch({
        type: ReducerActions.EMAIL_ERROR,
        payload: {code: "", message: TEXT_NEW_EMAIL_IDENTICAL} as FirebaseError,
      });
      return;
    }

    // Supabase sendet automatisch eine Bestätigungs-E-Mail an die neue Adresse.
    // DB- und localStorage-Update erfolgen erst nach Bestätigung (confirmEmailChange).
    dispatch({type: ReducerActions.SET_SUBMITTING, payload: {field: "email", value: true}});
    try {
      await database.auth.updateEmail(state.passwordChangeData.email);
      trackEvent(AnalyticsEvent.EMAIL_CHANGED);
      dispatch({type: ReducerActions.SUCCESS_MAIL_CHANGE});
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "E-Mail ändern"}});
      dispatch({type: ReducerActions.EMAIL_ERROR, payload: error as FirebaseError});
    }
  };
  /* ------------------------------------------
  // Passwort ändern
  // ------------------------------------------ */
  const onPwChange = async () => {
    // Supabase Auth: updatePassword funktioniert sowohl für eingeloggte User
    // als auch nach Token-Verifizierung (Recovery-Link)
    dispatch({type: ReducerActions.SET_SUBMITTING, payload: {field: "password", value: true}});
    try {
      await database.auth.updatePassword(state.passwordChangeData.password);
      trackEvent(AnalyticsEvent.PASSWORD_CHANGED);
      dispatch({type: ReducerActions.SUCCESS_PW_CHANGE});
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "Passwort ändern"}});
      dispatch({type: ReducerActions.PASSWORD_ERROR, payload: error as FirebaseError});
    }
  };
  /* ------------------------------------------
  // Feldwert ändern
  // ------------------------------------------ */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };
  /* ------------------------------------------
  // Reauthentifizierung abbrechen
  // ------------------------------------------ */
  const onReauthenticationCancel = () => {
    navigate(-1);
  };
  /* ------------------------------------------
  // Reauthentifizierung erledigt
  // ------------------------------------------ */
  const onReauthenticationOk = () => {
    dispatch({type: ReducerActions.SUCCESS_REAUTHENTICATION});
    setReauthentication({...reauthentication, done: true});
  };
  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const onSnackbarClose = () => {
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  return (
    <React.Fragment>
      <PageTitle title={resetCode ? TEXT_PASSWORD_CHANGE : TEXT_LOGIN_CHANGE} />
      <Container sx={classes.container} component="main" maxWidth="xs">
        {!resetCode && (
          <EmailChangeCard
            email={state.passwordChangeData.email}
            successEmailChange={state.successEmailChange}
            isSubmitting={state.isSubmittingEmail}
            error={state.emailError}
            onFieldChange={onFieldChange}
            onEmailChange={onEmailChange}
          />
        )}
        <Box sx={{mt: 3}} />
        <PasswordChangeCard
          resetCode={resetCode}
          password={state.passwordChangeData.password}
          passwordConfirm={state.passwordChangeData.passwordConfirm}
          successPwChange={state.successPwChange}
          isSubmitting={state.isSubmittingPassword}
          error={state.passwordError}
          onFieldChange={onFieldChange}
          onPwChange={onPwChange}
          onNavigateToSignIn={() => navigate(ROUTES.SIGN_IN)}
        />

        {/* PopUp für Reauthentifizierung */}
        {(!authUser || reauthentication.needed) && (
          <DialogReauthenticate
            database={database}
            dialogOpen={reauthentication.needed && !reauthentication.done}
            handleOk={onReauthenticationOk}
            handleClose={onReauthenticationCancel}
            authUser={authUser!}
          />
        )}
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={onSnackbarClose}
        />
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// =========================== EmailChangeCard ========================
// =================================================================== */
/** Props für die EmailChangeCard-Komponente. */
interface EmailChangeCardProps {
  /** Aktuelle E-Mail-Adresse im Formular. */
  email: string;
  /** Ob die E-Mail-Änderung erfolgreich war. */
  successEmailChange: boolean;
  /** Ob gerade eine API-Anfrage läuft. */
  isSubmitting: boolean;
  /** Fehler bei der E-Mail-Änderung (oder null). */
  error: FirebaseError | null;
  /** Handler für Feldänderungen. */
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handler zum Absenden der E-Mail-Änderung. */
  onEmailChange: () => void;
}

/**
 * Karte für die E-Mail-Änderung.
 * Enthält Header-Bild, E-Mail-Feld mit Validierung und eigene
 * Erfolgs-/Fehlermeldungen. Feld und Button werden nach Erfolg deaktiviert.
 *
 * @param props - EmailChangeCardProps
 */
const EmailChangeCard = ({
  email,
  successEmailChange,
  isSubmitting,
  error,
  onFieldChange,
  onEmailChange,
}: EmailChangeCardProps) => {
  const classes = useCustomStyles();
  const [emailTouched, setEmailTouched] = React.useState(false);
  const isValidEmail = Utils.isEmail(email);

  return (
    <Card>
      <CardMedia
        sx={classes.cardMedia}
        image={ImageRepository.getEnvironmentRelatedPicture().SIGN_IN_HEADER}
        title={"Logo"}
      />
      <CardContent sx={classes.cardContent}>
        <Typography
          gutterBottom={true}
          variant="h5"
          align="center"
          component="h2"
        >
          {TEXT_CHANGE_EMAIL}
        </Typography>
        {successEmailChange && (
          <Alert severity="success">
            <AlertTitle>{TEXT_EMAIL_HAS_BEEN_CHANGED}</AlertTitle>
            {TEXT_EMAIL_CHANGE_CONFIRMATION_SENT}
          </Alert>
        )}
        {error && <AlertMessage error={error} severity="error" />}
        <TextField
          type="email"
          margin="normal"
          fullWidth
          id="email"
          label={TEXT_EMAIL}
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          disabled={successEmailChange}
          onChange={onFieldChange}
          onBlur={() => setEmailTouched(true)}
        />
        {emailTouched && !isValidEmail && (
          <Typography color="error">{TEXT_GIVE_VALID_EMAIL}</Typography>
        )}
        <Button
          disabled={!isValidEmail || successEmailChange || isSubmitting}
          fullWidth
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onEmailChange}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : undefined}
        >
          {TEXT_CHANGE_EMAIL}
        </Button>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ========================= PasswordChangeCard =======================
// =================================================================== */
/** Props für die PasswordChangeCard-Komponente. */
interface PasswordChangeCardProps {
  /** Code aus dem Passwort-Zurücksetzen-Link (falls vorhanden). */
  resetCode: string | undefined;
  /** Aktuelles Passwort im Formular. */
  password: string;
  /** Passwort-Bestätigung im Formular. */
  passwordConfirm: string;
  /** Ob die Passwort-Änderung erfolgreich war. */
  successPwChange: boolean;
  /** Ob gerade eine API-Anfrage läuft. */
  isSubmitting: boolean;
  /** Fehler bei der Passwort-Änderung (oder null). */
  error: FirebaseError | null;
  /** Handler für Feldänderungen. */
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handler zum Absenden der Passwort-Änderung. */
  onPwChange: () => void;
  /** Navigation zur Anmeldeseite (nach erfolgreichem Reset). */
  onNavigateToSignIn: () => void;
}

/**
 * Karte für die Passwort-Änderung.
 * Zeigt das Header-Bild nur im Reset-Flow. Enthält Passwortfeld mit
 * Bestätigungsfeld, Stärkeanzeige und eigene Erfolgs-/Fehlermeldungen.
 * Felder werden nach Erfolg deaktiviert.
 *
 * @param props - PasswordChangeCardProps
 */
const PasswordChangeCard = ({
  resetCode,
  password,
  passwordConfirm,
  onFieldChange,
  onPwChange,
  onNavigateToSignIn,
  successPwChange,
  isSubmitting,
  error,
}: PasswordChangeCardProps) => {
  const classes = useCustomStyles();
  const [showPassword, setShowPassword] = React.useState(false);

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };
  const handleMouseDownPassword = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  // Passwörter stimmen nur überein, wenn beide ausgefüllt und identisch sind
  const passwordsMatch = password === passwordConfirm;
  // Mismatch-Hinweis nur anzeigen, wenn beide Felder ausgefüllt wurden
  const showMismatchError = passwordConfirm.length > 0 && !passwordsMatch;

  const isButtonDisabled =
    password.length < 6 ||
    !passwordsMatch ||
    successPwChange ||
    isSubmitting;

  /** Endornment für Passwort-Sichtbarkeit (gemeinsam für beide Felder). */
  const passwordVisibilityAdornment = (
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
  );

  return (
    <Card>
      {/* Header-Bild nur im Reset-Flow, sonst hat die EmailChangeCard es */}
      {resetCode && (
        <CardMedia
          sx={classes.cardMedia}
          image={ImageRepository.getEnvironmentRelatedPicture().SIGN_IN_HEADER}
          title={"Logo"}
        />
      )}
      <CardContent sx={classes.cardContent}>
        <Typography
          gutterBottom={true}
          variant="h5"
          align="center"
          component="h2"
        >
          {resetCode ? TEXT_PASSWORD_CHANGE_ARE_YOU_READY : TEXT_CHANGE_PASSWORD}
        </Typography>
        {error &&
        (error.code === AuthMessages.EXPIRED_ACTION_CODE ||
          error.code === AuthMessages.INVALID_ACTION_CODE) ? (
          <Alert severity="warning">
            <AlertTitle>{TEXT_ALERT_TITLE_UUPS}</AlertTitle>
            {TEXT_PASSWORD_RESET_EXPIRED}
            <ForgotPasswordLink />
          </Alert>
        ) : null}
        {successPwChange && (
          <Alert severity="success">
            <AlertTitle>{TEXT_ONE_TWO_TRHEE_DONE}</AlertTitle>
            {TEXT_PASSWORD_HAS_BEEN_CHANGED}
          </Alert>
        )}
        {error && <AlertMessage error={error} severity="error" />}
        <TextField
          type={showPassword ? "text" : "password"}
          margin="normal"
          required
          fullWidth
          id="password"
          name="password"
          label={TEXT_PASSWORD}
          value={password}
          disabled={successPwChange}
          onChange={onFieldChange}
          slotProps={{
            input: {endAdornment: passwordVisibilityAdornment},
          }}
        />
        <FormHelperText>{TEXT_PASSWORD_REQUIREMENTS_HINT}</FormHelperText>
        <PasswordStrengthMeter password={password} />
        <TextField
          type={showPassword ? "text" : "password"}
          margin="normal"
          required
          fullWidth
          id="passwordConfirm"
          name="passwordConfirm"
          label={TEXT_CONFIRM_PASSWORD}
          value={passwordConfirm}
          disabled={successPwChange}
          onChange={onFieldChange}
          error={showMismatchError}
          helperText={showMismatchError ? TEXT_PASSWORDS_DONT_MATCH : ""}
        />
        <Button
          disabled={isButtonDisabled}
          fullWidth
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onPwChange}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : undefined}
        >
          {TEXT_CHANGE_PASSWORD}
        </Button>
        {successPwChange && resetCode && (
          <Button
            fullWidth
            variant="outlined"
            color="primary"
            sx={{mt: 2}}
            onClick={onNavigateToSignIn}
          >
            {TEXT_GO_TO_SIGN_IN}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// ===================================================================
// =============================== Link ==============================
// ===================================================================
/**
 * Link zur Passwort-Zurücksetzen-Seite.
 */
export const PasswordChangeLink = () => (
  <Typography variant="body2">
    <Link to={ROUTES.PASSWORD_RESET}>{TEXT_PASSWORD_CHANGE}</Link>
  </Typography>
);

export {PasswordChangePage, passwordChangeReducer, ReducerActions, initialState};
export type {State, DispatchAction};
