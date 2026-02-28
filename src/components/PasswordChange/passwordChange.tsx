import React from "react";

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
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import PasswordStrengthMeter from "../Shared/passwordStrengthMeter";
import PageTitle from "../Shared/pageTitle";
import useCustomStyles from "../../constants/styles";

import AlertMessage from "../Shared/AlertMessage";
import DialogReauthenticate from "../SignIn/dialogReauthenticate";
import CustomSnackbar, {Snackbar} from "../Shared/customSnackbar";

import {AuthMessages} from "../../constants/firebaseMessages";
import * as ROUTES from "../../constants/routes";
import {
  EMAIL as TEXT_EMAIL,
  PASSWORD_CHANGE as TEXT_PASSWORD_CHANGE,
  LOGIN_CHANGE as TEXT_LOGIN_CHANGE,
  PASSWORD_CHANGE_ARE_YOU_READY as TEXT_PASSWORD_CHANGE_ARE_YOU_READY,
  LOGIN_CHANGE_ARE_YOU_READY as TEXT_LOGIN_CHANGE_ARE_YOU_READY,
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
} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";
import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";
import Utils from "../Shared/utils.class";
import {FirebaseError} from "@firebase/util";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";

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
}

/** Daten für E-Mail- und Passwortänderung. */
type PasswordChangeData = {
  email: string;
  password: string;
};

/** State der PasswordChange-Seite mit getrennten Fehler-/Erfolgsfeldern. */
type State = {
  passwordChangeData: PasswordChangeData;
  emailError: FirebaseError | null;
  passwordError: FirebaseError | null;
  successPwChange: boolean;
  successEmailChange: boolean;
  snackbar: Snackbar;
};

type DispatchAction = {
  type: ReducerActions;
  payload: any;
};

const inititialState: State = {
  passwordChangeData: {
    email: "",
    password: "",
  },
  emailError: null,
  passwordError: null,
  successPwChange: false,
  successEmailChange: false,
  snackbar: {open: false, severity: "info", message: ""},
};

/**
 * Reducer für die PasswordChange-Seite.
 * Verwaltet Formularfelder, getrennte Fehler für E-Mail/Passwort
 * sowie Erfolgs- und Snackbar-Zustände.
 *
 * @param state Aktueller State.
 * @param action Dispatch-Aktion mit Typ und Payload.
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
      return {...state, successEmailChange: true, emailError: null};
    case ReducerActions.SUCCESS_PW_CHANGE:
      return {...state, successPwChange: true, passwordError: null};
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
      return {...state, emailError: action.payload as FirebaseError};
    case ReducerActions.PASSWORD_ERROR:
      return {...state, passwordError: action.payload as FirebaseError};
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
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
 * @param oobCode Optionaler Code aus einem Passwort-Reset-Link.
 */
const PasswordChangePage: React.FC<PasswordChangePageProps> = ({oobCode}) => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const classes = useCustomStyles();
  let resetCode = oobCode as string;

  const [state, dispatch] = React.useReducer(
    passwordChangeReducer,
    inititialState,
  );

  // kommt die Anfrage aus der Passwort-Zurücksetzen-Mail.
  // Dann ist in der URL der objektCode
  if (oobCode && !resetCode) {
    resetCode = oobCode;
  }
  /* ------------------------------------------
  // Email-setzen
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

  // Neu Authentifizieren, wenn nicht über resetCode eingestiegen
  const [reauthenticattion, setReauthenticattion] = React.useState({
    needed: resetCode !== undefined ? false : true,
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
        payload: {code: "", message: TEXT_NEW_EMAIL_IDENTICAL},
      });
      return;
    }

    // Supabase sendet automatisch eine Bestätigungs-E-Mail an die neue Adresse.
    // DB- und localStorage-Update erfolgen erst nach Bestätigung (confirmEmailChange).
    try {
      await database.auth.updateEmail(state.passwordChangeData.email);
      dispatch({type: ReducerActions.SUCCESS_MAIL_CHANGE, payload: {}});
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.EMAIL_ERROR, payload: error});
    }
  };
  /* ------------------------------------------
  // Passwort ändern
  // ------------------------------------------ */
  const onPwChange = async () => {
    // Supabase Auth: updatePassword funktioniert sowohl für eingeloggte User
    // als auch nach Token-Verifizierung (Recovery-Link)
    try {
      await database.auth.updatePassword(state.passwordChangeData.password);
      dispatch({type: ReducerActions.SUCCESS_PW_CHANGE, payload: {}});
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.PASSWORD_ERROR, payload: error});
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
// Authentifzierung abbrechen
// ------------------------------------------ */
  const onReauthenticattionCancel = () => {
    navigate(-1);
  };
  /* ------------------------------------------
  // Authentifzierung erledigt
  // ------------------------------------------ */
  const onReauthenticattionOk = () => {
    dispatch({type: ReducerActions.SUCCESS_REAUTHENTICATION, payload: {}});
    setReauthenticattion({...reauthenticattion, done: true});
  };
  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const onSnackbarClose = () => {
    dispatch({type: ReducerActions.SNACKBAR_CLOSE, payload: {}});
  };

  return (
    <React.Fragment>
      <PageTitle title={resetCode ? TEXT_PASSWORD_CHANGE : TEXT_LOGIN_CHANGE} />
      <Container sx={classes.container} component="main" maxWidth="xs">
        {!resetCode && (
          <EmailChangeCard
            email={state.passwordChangeData.email}
            successEmailChange={state.successEmailChange}
            error={state.emailError}
            onFieldChange={onFieldChange}
            onEmailChange={onEmailChange}
          />
        )}
        <Box sx={{mt: 3}} />
        <PasswordChangeCard
          resetCode={resetCode}
          password={state.passwordChangeData.password}
          successPwChange={state.successPwChange}
          error={state.passwordError}
          onFieldChange={onFieldChange}
          onPwChange={onPwChange}
        />

        {/* PopUp für Reauthentifizierung */}
        {(!authUser || reauthenticattion.needed) && (
          <DialogReauthenticate
            database={database}
            dialogOpen={reauthenticattion.needed && !reauthenticattion.done}
            handleOk={onReauthenticattionOk}
            handleClose={onReauthenticattionCancel}
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
 * Erfolgs-/Fehlermeldungen.
 *
 * @param email Aktuelle E-Mail-Adresse.
 * @param successEmailChange Ob die Änderung erfolgreich war.
 * @param error Fehler bei der Änderung.
 * @param onFieldChange Handler für Feldänderungen.
 * @param onEmailChange Handler zum Absenden.
 */
const EmailChangeCard = ({
  email,
  successEmailChange,
  error,
  onFieldChange,
  onEmailChange,
}: EmailChangeCardProps) => {
  const classes = useCustomStyles();
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
          onChange={onFieldChange}
        />
        {!isValidEmail && (
          <Typography color="error">{TEXT_GIVE_VALID_EMAIL}</Typography>
        )}
        <Button
          disabled={!isValidEmail}
          fullWidth
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onEmailChange}
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
  resetCode: string;
  /** Aktuelles Passwort im Formular. */
  password: string;
  /** Ob die Passwort-Änderung erfolgreich war. */
  successPwChange: boolean;
  /** Fehler bei der Passwort-Änderung (oder null). */
  error: FirebaseError | null;
  /** Handler für Feldänderungen. */
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handler zum Absenden der Passwort-Änderung. */
  onPwChange: () => void;
}

/**
 * Karte für die Passwort-Änderung.
 * Zeigt das Header-Bild nur an, wenn ein resetCode vorhanden ist
 * (Passwort-Reset-Flow). Enthält Passwortfeld, Stärkeanzeige
 * und eigene Erfolgs-/Fehlermeldungen.
 *
 * @param resetCode Code aus dem Reset-Link.
 * @param password Aktuelles Passwort.
 * @param successPwChange Ob die Änderung erfolgreich war.
 * @param error Fehler bei der Änderung.
 * @param onFieldChange Handler für Feldänderungen.
 * @param onPwChange Handler zum Absenden.
 */
const PasswordChangeCard = ({
  resetCode,
  password,
  onFieldChange,
  onPwChange,
  successPwChange,
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
          onChange={onFieldChange}
          InputProps={{
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
          }}
        />
        <PasswordStrengthMeter password={password} />
        <Button
          disabled={password === "" || password.length < 6}
          fullWidth
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onPwChange}
        >
          {TEXT_CHANGE_PASSWORD}
        </Button>
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

export default PasswordChangePage;
