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

import PageTitle from "../Shared/pageTitle";
import {SignUpLink} from "../SignUp/signUp";
import AlertMessage from "../Shared/AlertMessage";
import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";
import PasswordMigrationDialog from "./passwordMigrationDialog";

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
import {AuthMessages} from "../../constants/firebaseMessages";
import {HOME as ROUTE_HOME} from "../../constants/routes";
import {ImageRepository} from "../../constants/imageRepository";

import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import User from "../User/user.class";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {useNavigate} from "react-router";
import Utils from "../Shared/utils.class";
import useCustomStyles from "../../constants/styles";

/* ===================================================================
// ======================== State Management ==========================
// =================================================================== */

enum ReducerActions {
  SET_MAINTENANCE_MODE,
  OVERWRITE_MAINTENANCE_MODE,
  UPDATE_FIELD,
  SIGN_IN,
  GENERIC_ERROR,
  SHOW_MIGRATION_DIALOG,
  HIDE_MIGRATION_DIALOG,
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

/** Fehlertyp, der sowohl Firebase- als auch Supabase-Fehler abdeckt */
type AuthErrorLike = Error & {code?: string};

/**
 * State für die Passwort-Migration bei Firebase-Fallback.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param firebaseUid - Firebase UID des zu migrierenden Users
 */
type MigrationDialogState = {
  open: boolean;
  firebaseUid: string;
  displayName: string;
};

/**
 * State für die Sign-In-Seite.
 *
 * @param signInData - Eingegebene Login-Daten
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param error - Fehlerobjekt bei gescheitertem Login
 * @param isSigningIn - Ob gerade ein Login-Request läuft
 * @param migrationDialog - State des Passwort-Migrations-Dialogs
 * @param resendEmailSent - Ob die Bestätigungs-E-Mail erneut gesendet wurde
 */
type State = {
  signInData: SignInData;
  maintenanceMode: boolean;
  error: AuthErrorLike | null;
  isSigningIn: boolean;
  migrationDialog: MigrationDialogState;
  resendEmailSent: boolean;
};

/** Diskriminierte Union für typsichere Reducer-Actions */
type DispatchAction =
  | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: string}}
  | {type: ReducerActions.SET_MAINTENANCE_MODE; payload: {value: boolean}}
  | {type: ReducerActions.OVERWRITE_MAINTENANCE_MODE}
  | {type: ReducerActions.SIGN_IN}
  | {type: ReducerActions.GENERIC_ERROR; payload: AuthErrorLike}
  | {
      type: ReducerActions.SHOW_MIGRATION_DIALOG;
      payload: {firebaseUid: string; displayName: string};
    }
  | {type: ReducerActions.HIDE_MIGRATION_DIALOG}
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
  migrationDialog: {open: false, firebaseUid: "", displayName: ""},
  resendEmailSent: false,
};

/**
 * Reducer für die Sign-In-Seite.
 * Verwaltet Login-Daten, Wartungsmodus, Ladezustand, Fehler und Migration.
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
    case ReducerActions.SHOW_MIGRATION_DIALOG:
      return {
        ...state,
        isSigningIn: false,
        migrationDialog: {
          open: true,
          firebaseUid: action.payload.firebaseUid,
          displayName: action.payload.displayName,
        },
      };
    case ReducerActions.HIDE_MIGRATION_DIALOG:
      return {
        ...state,
        migrationDialog: {open: false, firebaseUid: "", displayName: ""},
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
 * Implementiert einen Hybrid-Login-Flow:
 * 1. Supabase Auth versuchen
 * 2. Bei Fehler: Firebase-Fallback → Passwort-Migration-Dialog
 * 3. Beide fehlgeschlagen: Fehlermeldung anzeigen
 *
 * @example
 * <SignInPage />
 */
const SignInPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(signInReducer, initialState);

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
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };
  /* ------------------------------------------
  // Anmelden (Hybrid: Supabase zuerst, Firebase-Fallback)
  // ------------------------------------------ */
  const onSignIn = async () => {
    dispatch({type: ReducerActions.SIGN_IN});

    try {
      // 1. Supabase Auth versuchen
      const session = await database.auth.signInWithPassword(
        state.signInData.email,
        state.signInData.password,
      );

      // Supabase-Login erfolgreich → User-Daten laden und Login registrieren
      // Admin-Client verwenden, da RLS beim ersten Login Timing-Probleme hat
      const usersRepo = database.admin?.users ?? database.users;
      try {
        const user = await usersRepo.findById(session.user.id);
        if (user) {
          await usersRepo.registerSignIn(session.user.id);
        }
      } catch (profileError) {
        console.warn("Profil konnte nicht geladen werden:", profileError);
      }

      // Parallel Firebase-Session aufbauen, damit Firestore-Reads
      // funktionieren, solange die Daten noch nicht nach Supabase
      // migriert sind. Fehler werden bewusst ignoriert (z.B. wenn
      // der User kein Firebase-Konto hat oder das Passwort abweicht).
      try {
        await firebase.signInWithEmailAndPassword({
          email: state.signInData.email,
          password: state.signInData.password,
        });
      } catch {
        // Nicht kritisch — Firestore-Zugriff ist nur Übergangsphase
      }

      // Kurz warten, damit der Auth-Context nachmag
      await new Promise((resolve) => setTimeout(resolve, 2000));
      navigate(ROUTE_HOME);
    } catch (supabaseError) {
      // 2. Supabase fehlgeschlagen → Firebase-Fallback versuchen
      try {
        const firebaseUser = await firebase.signInWithEmailAndPassword({
          email: state.signInData.email,
          password: state.signInData.password,
        });

        if (firebaseUser.user) {
          const usersRepo = database.admin?.users ?? database.users;
          let displayName = "";

          try {
            const profile = await usersRepo.findById(firebaseUser.user.uid);
            if (profile) {
              displayName = profile.displayName;
            }
          } catch {
            // Nicht kritisch — displayName bleibt leer
          }

          // Stille Migration: Bestätigten Supabase-Account erstellen
          // (kein Verifizierungsmail, da bereits über Firebase verifiziert)
          try {
            const supabaseUser = await database.auth.createConfirmedUser(
              state.signInData.email,
              state.signInData.password,
              {displayName: displayName || undefined},
            );

            // Supabase-Session abmelden (Race-Condition mit Auth-Context vermeiden)
            await database.auth.signOut();

            // Firebase Auth deaktivieren (fire-and-forget)
            firebase.disableAuthAccount().catch((err) =>
              console.warn("Firebase Auth deaktivieren fehlgeschlagen:", err),
            );

            // Firebase abmelden
            await firebase.signOut();

            // Über Supabase einloggen
            await database.auth.signInWithPassword(
              state.signInData.email,
              state.signInData.password,
            );

            // Login registrieren
            try {
              const user = await usersRepo.findById(supabaseUser.id);
              if (user) await usersRepo.registerSignIn(supabaseUser.id);
            } catch {
              // Nicht kritisch
            }

            // Kurz warten, damit der Auth-Context nachmag
            await new Promise((resolve) => setTimeout(resolve, 2000));
            navigate(ROUTE_HOME);
          } catch (migrationError) {
            // signUp fehlgeschlagen (z.B. Passwort-Policy) → Fallback auf Dialog
            console.warn(
              "Stille Migration fehlgeschlagen, zeige Dialog:",
              migrationError,
            );
            dispatch({
              type: ReducerActions.SHOW_MIGRATION_DIALOG,
              payload: {firebaseUid: firebaseUser.user.uid, displayName},
            });
          }
        }
      } catch (firebaseError) {
        // Beide Login-Versuche fehlgeschlagen
        // Supabase ist der primäre Auth-Provider — dessen Fehler bevorzugen
        console.error(firebaseError);
        const primaryError = supabaseError as AuthErrorLike;
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: primaryError,
        });
      }
    }
  };

  /* ------------------------------------------
  // Callback nach erfolgreicher Passwort-Migration
  // ------------------------------------------ */
  const onMigrationSuccess = async () => {
    // Firebase abmelden (Supabase ist jetzt aktiv)
    await firebase.signOut();
    dispatch({type: ReducerActions.HIDE_MIGRATION_DIALOG});

    // Kurz warten, damit der Auth-Context nachmag
    await new Promise((resolve) => setTimeout(resolve, 1000));
    navigate(ROUTE_HOME);
  };

  /* ------------------------------------------
  // Bestätigungs-E-Mail erneut senden
  // ------------------------------------------ */
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

  const onMigrationClose = () => {
    // Dialog schliessen, Firebase abmelden und Passwort-Feld leeren
    firebase.signOut();
    dispatch({type: ReducerActions.HIDE_MIGRATION_DIALOG});
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: "password", value: ""},
    });
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
                (state.error.code === AuthMessages.EMAIL_NOT_CONFIRMED ? (
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
                      state.error.code === AuthMessages.WRONG_PASSWORD ||
                      state.error.code === AuthMessages.INVALID_CREDENTIALS ? (
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
      {/* Passwort-Migrations-Dialog für bestehende Firebase-User */}
      <PasswordMigrationDialog
        open={state.migrationDialog.open}
        email={state.signInData.email}
        firebaseUid={state.migrationDialog.firebaseUid}
        displayName={state.migrationDialog.displayName}
        database={database}
        onSuccess={onMigrationSuccess}
        onClose={onMigrationClose}
      />
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
    <React.Fragment>
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
        autoComplete="new-password"
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
        onClick={onSignIn}
      >
        {TEXT_SIGN_IN}
      </Button>
    </React.Fragment>
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

export default SignInPage;
