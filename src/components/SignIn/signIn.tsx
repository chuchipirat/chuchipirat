import React from "react";

import {
  Alert,
  Backdrop,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import * as Sentry from "@sentry/react";

import {PageTitle} from "../Shared/pageTitle";
import {SignUpLink} from "../SignUp/signUp";
import {AlertMessage} from "../Shared/AlertMessage";
import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";

import {
  COME_IN as TEXT_COME_IN,
  SIGN_IN as TEXT_SIGN_IN,
  EMAIL as TEXT_EMAIL,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED as TEXT_MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED,
  MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED_TEXT as TEXT_MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED_TEXT,
  SIGN_IN_EMAIL_NOT_CONFIRMED_TITLE as TEXT_SIGN_IN_EMAIL_NOT_CONFIRMED_TITLE,
  SIGN_IN_EMAIL_NOT_CONFIRMED_TEXT as TEXT_SIGN_IN_EMAIL_NOT_CONFIRMED_TEXT,
  RESEND_CONFIRMATION_EMAIL as TEXT_RESEND_CONFIRMATION_EMAIL,
  RESEND_CONFIRMATION_EMAIL_SUCCESS as TEXT_RESEND_CONFIRMATION_EMAIL_SUCCESS,
} from "../../constants/text";
import {HOME as ROUTE_HOME} from "../../constants/routes";
import {ImageRepository} from "../../constants/imageRepository";

import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {LocalStorageKey} from "../../constants/localStorage";
import {useNavigate} from "react-router";
import {Utils} from "../Shared/utils.class";
import {useCustomStyles} from "../../constants/styles";

/** Supabase-Fehlercodes für Auth-Operationen */
const SUPABASE_ERROR_EMAIL_NOT_CONFIRMED = "email_not_confirmed";
const SUPABASE_ERROR_INVALID_CREDENTIALS = "invalid_credentials";

/* ===================================================================
// ======================== State Management ==========================
// =================================================================== */

enum ReducerActions {
  SET_MAINTENANCE_MODE,
  OVERWRITE_MAINTENANCE_MODE,
  UPDATE_FIELD,
  SIGN_IN,
  GENERIC_ERROR,
  RESEND_EMAIL_SENT,
  RESEND_EMAIL_ERROR,
}

/**
 * Eingabedaten für das Sign-In-Formular.
 *
 * @param email - E-Mail-Adresse des Benutzers
 * @param password - Passwort des Benutzers
 */
type SignInData = {
  email: string;
  password: string;
};

/** Fehlertyp für Supabase-Auth-Fehler (enthält optionalen Fehlercode) */
type AuthErrorLike = Error & {code?: string};

/**
 * State für die Sign-In-Seite.
 *
 * @param signInData - Eingegebene Login-Daten
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param error - Fehlerobjekt bei gescheitertem Login
 * @param isSigningIn - Ob gerade ein Login-Request läuft
 * @param resendEmailSent - Ob die Bestätigungs-E-Mail erneut gesendet wurde
 */
type State = {
  signInData: SignInData;
  maintenanceMode: boolean;
  error: AuthErrorLike | null;
  isSigningIn: boolean;
  resendEmailSent: boolean;
};

/** Diskriminierte Union für typsichere Reducer-Actions */
type DispatchAction =
  | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: string}}
  | {type: ReducerActions.SET_MAINTENANCE_MODE; payload: {value: boolean}}
  | {type: ReducerActions.OVERWRITE_MAINTENANCE_MODE}
  | {type: ReducerActions.SIGN_IN}
  | {type: ReducerActions.GENERIC_ERROR; payload: AuthErrorLike}
  | {type: ReducerActions.RESEND_EMAIL_SENT}
  | {type: ReducerActions.RESEND_EMAIL_ERROR; payload: Error};

const initialState: State = {
  signInData: {
    email: "",
    password: "",
  },
  maintenanceMode: false,
  isSigningIn: false,
  error: null,
  resendEmailSent: false,
};

/**
 * Reducer für die Sign-In-Seite.
 * Verwaltet Login-Daten, Wartungsmodus, Ladezustand und Fehler.
 *
 * @param state - Aktueller State
 * @param action - Auszuführende Aktion
 * @returns Neuer State
 */
const signInReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        signInData: {
          ...state.signInData,
          [action.payload.field]: action.payload.value,
        },
      };
    case ReducerActions.SET_MAINTENANCE_MODE:
      return {
        ...state,
        maintenanceMode: action.payload.value,
      };
    case ReducerActions.SIGN_IN:
      return {...state, isSigningIn: true};
    case ReducerActions.OVERWRITE_MAINTENANCE_MODE:
      return {...state, maintenanceMode: false};
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
        isSigningIn: false,
        resendEmailSent: false,
      };
    case ReducerActions.RESEND_EMAIL_SENT:
      return {...state, resendEmailSent: true};
    case ReducerActions.RESEND_EMAIL_ERROR:
      return {...state, error: action.payload, resendEmailSent: false};
  }
};

/* ===================================================================
// ================================ Page =============================
// =================================================================== */

/**
 * Seite zum Anmelden (Sign-In).
 *
 * Authentifiziert den Benutzer über Supabase Auth. Nach erfolgreichem
 * Login wird das Benutzerprofil geladen, der Login registriert und
 * zur Home-Seite navigiert.
 *
 * @example
 * <SignInPage />
 */
const SignInPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(signInReducer, initialState);

  // Navigation erst wenn Login erfolgreich UND authUser im Context gesetzt ist.
  // Verhindert "Hoi undefined" auf der Home-Seite.
  const [signInSucceeded, setSignInSucceeded] = React.useState(false);
  React.useEffect(() => {
    if (signInSucceeded && authUser) {
      navigate(ROUTE_HOME);
    }
  }, [signInSucceeded, authUser, navigate]);

  /* ------------------------------------------
  // Einstellungen holen
  // ------------------------------------------ */
  React.useEffect(() => {
    database.globalSettings.getSettings().then((result) => {
      dispatch({
        type: ReducerActions.SET_MAINTENANCE_MODE,
        payload: {value: result?.maintenanceMode ?? false},
      });
    });
  }, []);

  // Geheime Tastenkombination zum Deaktivieren des Wartungsmodus (Ctrl+Alt+Shift+C)
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      const isCtrlPressed = event.ctrlKey || event.metaKey;
      const isAltPressed = event.altKey;
      const isShiftPressed = event.shiftKey;
      const isCPressed = event.key === "c" || event.key === "C";

      if (isCtrlPressed && isAltPressed && isShiftPressed && isCPressed) {
        dispatch({type: ReducerActions.OVERWRITE_MAINTENANCE_MODE});
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  /* ------------------------------------------
  // Feld-Änderungen
  // ------------------------------------------ */
  /**
   * Aktualisiert ein Formularfeld im State.
   *
   * @param event - Change-Event des Eingabefelds
   */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };

  /* ------------------------------------------
  // Anmelden (Supabase Auth)
  // ------------------------------------------ */
  /**
   * Führt den Login über Supabase Auth durch.
   * Bei Erfolg wird der Login registriert und zur Home-Seite navigiert.
   * Das Benutzerprofil wird automatisch vom AuthUserProvider via
   * `get_own_profile()` RPC geladen (kein manuelles Laden nötig).
   */
  const onSignIn = async () => {
    dispatch({type: ReducerActions.SIGN_IN});

    try {
      // Alten Cache leeren, damit onAuthStateChange frische Daten lädt
      localStorage.removeItem(LocalStorageKey.AUTH_USER);

      const session = await database.auth.signInWithPassword(
        state.signInData.email,
        state.signInData.password,
      );

      // Profil laden und Login registrieren — beides SECURITY DEFINER RPCs,
      // daher kein RLS-Timing-Problem.
      try {
        const [userDomain] = await Promise.all([
          database.users.findOwnProfile(),
          database.users.registerSignIn(session.user.id),
        ]);

        // Profil im Cache speichern, damit authUserContext es sofort findet
        if (userDomain) {
          const authUserData = {
            uid: session.user.id,
            email: userDomain.email,
            emailVerified: !!session.user.email_confirmed_at,
            firstName: userDomain.firstName,
            lastName: userDomain.lastName,
            roles: userDomain.roles,
            publicProfile: {
              displayName: userDomain.displayName,
              motto: userDomain.motto,
              pictureSrc: userDomain.pictureSrc,
            },
          };
          localStorage.setItem(
            LocalStorageKey.AUTH_USER,
            JSON.stringify(authUserData),
          );
        }
      } catch (profileError) {
        Sentry.captureException(profileError, {
          extra: {context: "SignIn - Profil laden / Login registrieren"},
        });
      }

      // State setzen — der useEffect oben navigiert, sobald authUser
      // vom AuthUserProvider im Context gesetzt wird.
      setSignInSucceeded(true);
    } catch (error) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as AuthErrorLike,
      });
    }
  };

  /* ------------------------------------------
  // Bestätigungs-E-Mail erneut senden
  // ------------------------------------------ */
  /**
   * Sendet die Bestätigungs-E-Mail erneut an die eingegebene Adresse.
   */
  const onResendConfirmationEmail = async () => {
    try {
      await database.auth.resendConfirmationEmail(state.signInData.email);
      dispatch({type: ReducerActions.RESEND_EMAIL_SENT});
    } catch (error) {
      dispatch({
        type: ReducerActions.RESEND_EMAIL_ERROR,
        payload: error as Error,
      });
    }
  };

  return (
    <React.Fragment>
      <PageTitle smallTitle={TEXT_COME_IN} />
      <Backdrop sx={classes.backdrop} open={state.isSigningIn}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Container sx={classes.container} component="main" maxWidth="xs">
        <Stack spacing={2}>
          {state.maintenanceMode && <AlertMaintenanceMode />}

          <Card sx={classes.card}>
            <CardMedia
              sx={classes.cardMedia}
              image={
                ImageRepository.getEnvironmentRelatedPicture().SIGN_IN_HEADER
              }
              title={"Logo"}
            />
            <CardContent sx={classes.cardContent}>
              <SignInForm
                signInData={state.signInData}
                onFieldChange={onFieldChange}
                onSignIn={onSignIn}
                maintenanceMode={state.maintenanceMode}
              />
              {state.error &&
                (state.error.code === SUPABASE_ERROR_EMAIL_NOT_CONFIRMED ? (
                  <EmailNotConfirmedAlert
                    resendEmailSent={state.resendEmailSent}
                    onResend={onResendConfirmationEmail}
                  />
                ) : (
                  <AlertMessage
                    error={state.error}
                    severity={"error"}
                    messageTitle={TEXT_ALERT_TITLE_UUPS}
                    body={
                      state.error.code === SUPABASE_ERROR_INVALID_CREDENTIALS ? (
                        <ForgotPasswordLink email={state.signInData.email} />
                      ) : (
                        ""
                      )
                    }
                  />
                ))}
              {!state.maintenanceMode && <SignUpLink />}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Formular Email/Passwort ====================
// =================================================================== */

/**
 * Props für das Sign-In-Formular.
 *
 * @param signInData - Aktuelle Login-Daten
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param onFieldChange - Handler für Feldänderungen
 * @param onSignIn - Handler für den Login-Button
 */
interface SignInFormProps {
  signInData: SignInData;
  maintenanceMode: boolean;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSignIn: () => void;
}

/**
 * Formular zur Eingabe von E-Mail und Passwort für den Login.
 * Zeigt Passwort-Toggle und deaktiviert Felder im Wartungsmodus.
 */
const SignInForm = ({
  signInData,
  maintenanceMode,
  onFieldChange,
  onSignIn,
}: SignInFormProps) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const classes = useCustomStyles();

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSignIn();
      }}
      noValidate
    >
      <Typography
        gutterBottom={true}
        variant="h5"
        align="center"
        component="h2"
      >
        {TEXT_SIGN_IN}
      </Typography>
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
        value={signInData.email}
        onChange={onFieldChange}
        disabled={maintenanceMode}
      />
      {/* Passwort */}
      <TextField
        type={showPassword ? "text" : "password"}
        margin="normal"
        required
        fullWidth
        id="password"
        name="password"
        label={TEXT_PASSWORD}
        autoComplete="current-password"
        value={signInData.password}
        onChange={onFieldChange}
        disabled={maintenanceMode}
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
                  {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Button
        disabled={
          maintenanceMode ||
          !signInData.password ||
          !Utils.isEmail(signInData.email)
        }
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        sx={classes.submit}
      >
        {TEXT_SIGN_IN}
      </Button>
    </form>
  );
};
/* ===================================================================
// ========================== Wartungswarnung =========================
// =================================================================== */

/**
 * Warnmeldung, die im Wartungsmodus angezeigt wird.
 * Informiert den Benutzer, dass Anmeldungen vorübergehend nicht möglich sind.
 *
 * @example
 * <AlertMaintenanceMode />
 */
export const AlertMaintenanceMode = () => {
  return (
    <AlertMessage
      error={null}
      severity={"warning"}
      messageTitle={TEXT_MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED}
      body={TEXT_MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED_TEXT}
    />
  );
};

/* ===================================================================
// =============== Warnung: E-Mail nicht bestätigt ====================
// =================================================================== */

/**
 * Props für die EmailNotConfirmedAlert-Komponente.
 *
 * @param resendEmailSent - Ob die E-Mail bereits erneut gesendet wurde
 * @param onResend - Handler zum erneuten Senden der Bestätigungs-E-Mail
 */
interface EmailNotConfirmedAlertProps {
  resendEmailSent: boolean;
  onResend: () => void;
}

/**
 * Warnmeldung bei nicht bestätigter E-Mail-Adresse.
 * Zeigt eine Erklärung mit Hinweis auf Spam-Ordner und einen Button
 * zum erneuten Senden der Bestätigungs-E-Mail.
 */
export const EmailNotConfirmedAlert = ({
  resendEmailSent,
  onResend,
}: EmailNotConfirmedAlertProps) => {
  return (
    <Stack spacing={1}>
      <AlertMessage
        error={null}
        severity={"warning"}
        messageTitle={TEXT_SIGN_IN_EMAIL_NOT_CONFIRMED_TITLE}
        body={TEXT_SIGN_IN_EMAIL_NOT_CONFIRMED_TEXT}
      />
      {resendEmailSent ? (
        <Alert severity="success">
          {TEXT_RESEND_CONFIRMATION_EMAIL_SUCCESS}
        </Alert>
      ) : (
        <Button
          variant="outlined"
          color="warning"
          fullWidth
          onClick={onResend}
        >
          {TEXT_RESEND_CONFIRMATION_EMAIL}
        </Button>
      )}
    </Stack>
  );
};

export {SignInPage};
