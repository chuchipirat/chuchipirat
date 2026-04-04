import React from "react";
import {useNavigate} from "react-router";

import {
  Alert,
  AlertTitle,
  Backdrop,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
  Container,
  Card,
  CardContent,
  CardMedia,
  InputAdornment,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import * as Sentry from "@sentry/react";

import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";

import {PageTitle} from "../Shared/pageTitle";
import {PasswordStrengthMeter} from "../Shared/passwordStrengthMeter";
import {AlertMessage} from "../Shared/AlertMessage";

import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {
  HOME as ROUTE_HOME,
  SIGN_IN as ROUTE_SIGN_IN,
  SIGN_UP as ROUTE_SIGN_UP,
} from "../../constants/routes";
import {NOT_REGISTERED_YET_SIGN_UP as TEXT_NOT_REGISTERED_YET_SIGN_UP} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";
import {
  WE_NEED_SOME_DETAILS_ABOUT_YOU as TEXT_WE_NEED_SOME_DETAILS_ABOUT_YOU,
  SIGN_IN as TEXT_SIGN_IN,
  SIGN_UP_NOT_ALLOWED_TITLE as TEXT_SIGN_UP_NOT_ALLOWED_TITLE,
  SIGN_UP_NOT_ALLOWED_TEXT as TEXT_SIGN_UP_NOT_ALLOWED_TEXT,
  FIRSTNAME as TEXT_FIRSTNAME,
  LASTNAME as TEXT_LASTNAME,
  EMAIL as TEXT_EMAIL,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  CREATE_ACCOUNT as TEXT_CREATE_ACCOUNT,
  CLOSE as TEXT_CLOSE,
  SIGN_UP_SUCCESS_TITLE as TEXT_SIGN_UP_SUCCESS_TITLE,
  SIGN_UP_SUCCESS_TEXT as TEXT_SIGN_UP_SUCCESS_TEXT,
  GIVE_VALID_EMAIL as TEXT_GIVE_VALID_EMAIL,
  TERM_OF_USE as TEXT_TERM_OF_USE,
  PRIVACY_POLICY as TEXT_PRIVACY_POLICY,
  SIGN_UP_ACCEPT_TERMS_INTRO as TEXT_SIGN_UP_ACCEPT_TERMS_INTRO,
  SIGN_UP_TERM_OF_USE_PREFIX as TEXT_SIGN_UP_TERM_OF_USE_PREFIX,
  SIGN_UP_TERM_OF_USE_SUFFIX as TEXT_SIGN_UP_TERM_OF_USE_SUFFIX,
  SIGN_UP_PRIVACY_POLICY_SUFFIX as TEXT_SIGN_UP_PRIVACY_POLICY_SUFFIX,
  PRIVACY_POLICY_DIALOG_TITLE as TEXT_PRIVACY_POLICY_DIALOG_TITLE,
} from "../../constants/text";
import {User} from "../User/user.class";
import {PrivacyPolicyText} from "../App/privacyPolicy";
import {TermOfUseText} from "../App/termOfUse";
import {AlertMaintenanceMode} from "../SignIn/signIn";
import {useCustomStyles} from "../../constants/styles";
import {Utils} from "../Shared/utils.class";

/** Supabase-Fehlercode bei bereits existierendem Benutzer */
const SUPABASE_ERROR_USER_ALREADY_EXISTS = "user_already_exists";

/* ===================================================================
// ======================== State Management ==========================
// =================================================================== */

enum ReducerActions {
  UPDATE_FIELD,
  SET_SIGN_UP_ALLOWED,
  GENERIC_ERROR,
  SIGN_UP_START,
  SIGN_UP_SUCCESS,
  EMAIL_TOUCHED,
}

/**
 * Eingabedaten fuer das Sign-Up-Formular.
 *
 * @param firstName - Vorname des Benutzers
 * @param lastName - Nachname des Benutzers
 * @param email - E-Mail-Adresse des Benutzers
 * @param password - Passwort des Benutzers
 */
type SignUpData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

/** Fehlertyp, der Supabase-Fehler mit optionalem Code abdeckt */
type AuthErrorLike = Error & {code?: string};

/**
 * State fuer die Sign-Up-Seite.
 *
 * @param signUpData - Eingegebene Registrierungsdaten
 * @param error - Fehlerobjekt bei gescheiterter Registrierung
 * @param signUpAllowed - Ob Registrierungen erlaubt sind
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param signUpSuccess - Ob die Registrierung erfolgreich war (Bestaetigungs-E-Mail gesendet)
 * @param isSigningUp - Ob die Registrierung gerade laeuft (Loading-Indikator)
 * @param emailTouched - Ob das E-Mail-Feld den Fokus verloren hat (fuer verzoegerte Validierung)
 */
type State = {
  signUpData: SignUpData;
  error: AuthErrorLike | null;
  signUpAllowed: boolean;
  maintenanceMode: boolean;
  signUpSuccess: boolean;
  isSigningUp: boolean;
  emailTouched: boolean;
};

const initialState: State = {
  signUpData: {firstName: "", lastName: "", email: "", password: ""},
  error: null,
  signUpAllowed: true,
  maintenanceMode: false,
  signUpSuccess: false,
  isSigningUp: false,
  emailTouched: false,
};

/** Diskriminierte Union fuer typsichere Reducer-Actions */
type DispatchAction =
  | {
      type: ReducerActions.UPDATE_FIELD;
      payload: {field: string; value: string};
    }
  | {
      type: ReducerActions.SET_SIGN_UP_ALLOWED;
      payload: {allowSignUp: boolean; maintenanceMode: boolean};
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: AuthErrorLike}
  | {type: ReducerActions.SIGN_UP_START}
  | {type: ReducerActions.SIGN_UP_SUCCESS}
  | {type: ReducerActions.EMAIL_TOUCHED};

/**
 * Reducer fuer die Sign-Up-Seite.
 * Verwaltet Registrierungsdaten, Berechtigungen und Fehler.
 *
 * @param state - Aktueller State
 * @param action - Auszufuehrende Aktion
 * @returns Neuer State
 */
const signUpReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.UPDATE_FIELD:
      return {
        ...state,
        signUpData: {
          ...state.signUpData,
          [action.payload.field]: action.payload.value,
        },
      };
    case ReducerActions.SET_SIGN_UP_ALLOWED:
      return {
        ...state,
        signUpAllowed: action.payload.allowSignUp,
        maintenanceMode: action.payload.maintenanceMode,
      };
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload, isSigningUp: false};
    case ReducerActions.SIGN_UP_START:
      return {...state, isSigningUp: true, error: null};
    case ReducerActions.SIGN_UP_SUCCESS:
      return {...state, signUpSuccess: true, error: null, isSigningUp: false};
    case ReducerActions.EMAIL_TOUCHED:
      return {...state, emailTouched: true};
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${exhaustiveCheck}`);
    }
  }
};
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Seite zur Registrierung neuer Benutzer.
 *
 * Erstellt einen Supabase Auth Account und legt den Benutzer in der
 * users-Tabelle an. In der Testumgebung wird ein Codewort abgefragt.
 *
 * @example
 * <SignUpPage />
 */
const SignUpPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const navigate = useNavigate();

  const classes = useCustomStyles();
  const [state, dispatch] = React.useReducer(signUpReducer, initialState);

  // Eingeloggte Benutzer zur Startseite weiterleiten
  React.useEffect(() => {
    if (authUser) {
      navigate(ROUTE_HOME);
    }
  }, [authUser, navigate]);

  const [smallPrintDialogs, setSmallPrintDialogs] = React.useState({
    termOfUse: false,
    privacyPolicy: false,
  });
  /* ------------------------------------------
  // Einstellungen holen
  // ------------------------------------------ */
  React.useEffect(() => {
    database.globalSettings.getSettings().then((result) => {
      if (result) {
        dispatch({
          type: ReducerActions.SET_SIGN_UP_ALLOWED,
          payload: result,
        });
      }
    });
  }, []);
  /* ------------------------------------------
  // Feld-Aenderungen
  // ------------------------------------------ */
  /**
   * Aktualisiert ein Formularfeld im State anhand des Feldnamens.
   *
   * @param event - Change-Event des Eingabefeldes
   */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };
  /* ------------------------------------------
  // E-Mail-Feld hat Fokus verloren
  // ------------------------------------------ */
  /**
   * Markiert das E-Mail-Feld als "beruehrt", sodass die Validierung
   * erst nach dem Verlassen des Feldes angezeigt wird.
   */
  const onEmailBlur = () => {
    dispatch({type: ReducerActions.EMAIL_TOUCHED});
  };
  /* ------------------------------------------
  // Registrierung ausfuehren
  // ------------------------------------------ */
  /**
   * Fuehrt die Registrierung durch: Supabase Auth Account erstellen
   * und Benutzer in der users-Tabelle anlegen.
   */
  const onSignUp = async () => {
    dispatch({type: ReducerActions.SIGN_UP_START});
    try {
      // Supabase Auth Account erstellen (E-Mail-Bestätigung nötig, keine Session)
      const user = await database.auth.signUp(
        state.signUpData.email,
        state.signUpData.password,
      );

      // Benutzer in der users-Tabelle anlegen (Admin-Client, da User noch keine Session hat)
      await User.createUser({
        database: database,
        uid: user.id,
        firstName: state.signUpData.firstName,
        lastName: state.signUpData.lastName,
        email: state.signUpData.email,
      });

      // Bestätigungsmeldung anzeigen statt Home-Redirect
      dispatch({type: ReducerActions.SIGN_UP_SUCCESS});
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "SignUp - Registrierung fehlgeschlagen"},
      });
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as AuthErrorLike,
      });
    }
  };
  /* ------------------------------------------
  // Dialog-Handling
  // ------------------------------------------ */
  /**
   * Oeffnet den Dialog fuer Nutzungsbedingungen oder Datenschutz
   * anhand der ID des geklickten Elements.
   *
   * @param event - Click-Event des Link-Elements
   */
  const onSmallPrintDialogOpen = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    setSmallPrintDialogs({
      ...smallPrintDialogs,
      [event.currentTarget.id]: true,
    });
  };
  /**
   * Schliesst alle Kleingedrucktes-Dialoge.
   */
  const onSmallPrintDialogClose = () => {
    setSmallPrintDialogs({termOfUse: false, privacyPolicy: false});
  };
  return (
    <React.Fragment>
      <PageTitle subTitle={TEXT_WE_NEED_SOME_DETAILS_ABOUT_YOU} />
      <Backdrop sx={classes.backdrop} open={state.isSigningUp}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <Container sx={classes.container} component="main" maxWidth="xs">
        <Stack spacing={2}>
          {state.maintenanceMode && <AlertMaintenanceMode />}
          {state.signUpSuccess ? (
            <React.Fragment>
              <Alert severity="success">
                <AlertTitle>{TEXT_SIGN_UP_SUCCESS_TITLE}</AlertTitle>
                {TEXT_SIGN_UP_SUCCESS_TEXT}
              </Alert>
              <Button
                onClick={() => navigate(ROUTE_SIGN_IN)}
                fullWidth
                variant="outlined"
                sx={{mt: 2}}
              >
                {TEXT_SIGN_IN}
              </Button>
            </React.Fragment>
          ) : (
            <SignUpForm
              signUpData={state.signUpData}
              signUpAllowed={state.signUpAllowed}
              maintenanceMode={state.maintenanceMode}
              isSigningUp={state.isSigningUp}
              emailTouched={state.emailTouched}
              error={state.error}
              onFieldChange={onFieldChange}
              onEmailBlur={onEmailBlur}
              onSignUp={onSignUp}
              openDialog={onSmallPrintDialogOpen}
            />
          )}
        </Stack>
      </Container>
      <DialogTermOfUse
        open={smallPrintDialogs.termOfUse}
        onClose={onSmallPrintDialogClose}
      />
      <DialogPrivacyPolicy
        open={smallPrintDialogs.privacyPolicy}
        onClose={onSmallPrintDialogClose}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ============================= Formular ============================
// =================================================================== */

/**
 * Props fuer das Sign-Up-Formular.
 *
 * @param signUpData - Aktuelle Registrierungsdaten
 * @param signUpAllowed - Ob Registrierungen erlaubt sind
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param isSigningUp - Ob die Registrierung gerade laeuft
 * @param emailTouched - Ob das E-Mail-Feld den Fokus verloren hat
 * @param onFieldChange - Handler fuer Feldaenderungen
 * @param onEmailBlur - Handler wenn E-Mail-Feld Fokus verliert
 * @param onSignUp - Handler fuer den Registrieren-Button
 * @param openDialog - Handler zum Oeffnen der AGB-/Datenschutz-Dialoge
 * @param error - Fehlerobjekt (null wenn kein Fehler)
 */
interface SignUpFormProps {
  signUpData: SignUpData;
  signUpAllowed: boolean;
  maintenanceMode: boolean;
  isSigningUp: boolean;
  emailTouched: boolean;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailBlur: () => void;
  onSignUp: () => void;
  openDialog: (event: React.MouseEvent<HTMLElement>) => void;
  error: AuthErrorLike | null;
}

/**
 * Formular zur Registrierung mit Vorname, Nachname, E-Mail und Passwort.
 * Zeigt Passwort-Staerkeanzeige und Links zu AGB/Datenschutz.
 */
const SignUpForm = ({
  signUpData,
  signUpAllowed,
  maintenanceMode,
  isSigningUp,
  emailTouched,
  onFieldChange,
  onEmailBlur,
  onSignUp,
  openDialog,
  error,
}: SignUpFormProps) => {
  const classes = useCustomStyles();
  const [showPassword, setShowPassword] = React.useState(false);

  /* ------------------------------------------
  // Password-Feld Handler
  // ------------------------------------------ */
  /**
   * Schaltet die Sichtbarkeit des Passwort-Feldes um.
   */
  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };
  /**
   * Verhindert den Standard-Mousedown auf dem Passwort-Toggle,
   * damit der Fokus im Passwort-Feld bleibt.
   *
   * @param event - MouseDown-Event des Toggle-Buttons
   */
  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  /** Ob alle Formularfelder deaktiviert sein sollen */
  const fieldsDisabled = !signUpAllowed || maintenanceMode || isSigningUp;

  return (
    <Card sx={classes.card}>
      <CardMedia
        sx={classes.cardMedia}
        image={ImageRepository.getEnvironmentRelatedPicture().SIGN_IN_HEADER}
        title={"Logo"}
      />
      <CardContent sx={classes.cardContent}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSignUp();
          }}
          noValidate
        >
          <Typography
            gutterBottom={true}
            variant="h5"
            align="center"
            component="h2"
          >
            {TEXT_CREATE_ACCOUNT}
          </Typography>
          {/* Meldung wenn SignUp nicht moeglich ist */}
          {!signUpAllowed && (
            <AlertMessage
              error={null}
              severity={"info"}
              messageTitle={TEXT_SIGN_UP_NOT_ALLOWED_TITLE}
              body={TEXT_SIGN_UP_NOT_ALLOWED_TEXT}
            />
          )}

          {/* Vorname */}
          <TextField
            type="text"
            margin="normal"
            required
            fullWidth
            id="firstName"
            label={TEXT_FIRSTNAME}
            name="firstName"
            autoComplete="given-name"
            autoFocus
            value={signUpData.firstName}
            onChange={onFieldChange}
            disabled={fieldsDisabled}
            slotProps={{htmlInput: {maxLength: 100}}}
          />
          {/* Nachname */}
          <TextField
            type="text"
            margin="normal"
            fullWidth
            id="lastName"
            label={TEXT_LASTNAME}
            name="lastName"
            autoComplete="family-name"
            value={signUpData.lastName}
            onChange={onFieldChange}
            disabled={fieldsDisabled}
            slotProps={{htmlInput: {maxLength: 100}}}
          />
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
            value={signUpData.email}
            onChange={onFieldChange}
            onBlur={onEmailBlur}
            disabled={fieldsDisabled}
          />
          {emailTouched &&
            signUpData.email &&
            !Utils.isEmail(signUpData.email) && (
              <Typography color="error" variant="body2">
                {TEXT_GIVE_VALID_EMAIL}
              </Typography>
            )}
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
            value={signUpData.password}
            onChange={onFieldChange}
            disabled={fieldsDisabled}
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
                      {showPassword ? (
                        <VisibilityIcon />
                      ) : (
                        <VisibilityOffIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {/* Staerke Passwort */}
          <PasswordStrengthMeter password={signUpData.password} />
          <Typography sx={{marginTop: "1rem"}}>
            {TEXT_SIGN_UP_ACCEPT_TERMS_INTRO}
          </Typography>

          <ul>
            <li>
              <Typography>
                {TEXT_SIGN_UP_TERM_OF_USE_PREFIX}{" "}
                <Link component="button" id="termOfUse" onClick={openDialog}>
                  {TEXT_TERM_OF_USE}
                </Link>{" "}
                {TEXT_SIGN_UP_TERM_OF_USE_SUFFIX}
              </Typography>
            </li>
            <li>
              <Typography>
                {TEXT_SIGN_UP_TERM_OF_USE_PREFIX}{" "}
                <Link
                  component="button"
                  id="privacyPolicy"
                  onClick={openDialog}
                >
                  {TEXT_PRIVACY_POLICY}
                </Link>{" "}
                {TEXT_SIGN_UP_PRIVACY_POLICY_SUFFIX}
              </Typography>
            </li>
          </ul>
          <Button
            type="submit"
            disabled={
              fieldsDisabled ||
              signUpData.firstName === "" ||
              !Utils.isEmail(signUpData.email) ||
              signUpData.password.length < 6
            }
            fullWidth
            variant="contained"
            color="primary"
            sx={classes.submit}
          >
            {TEXT_CREATE_ACCOUNT}
          </Button>
          {error && (
            <AlertMessage
              error={error}
              severity={"error"}
              body={
                error.code === SUPABASE_ERROR_USER_ALREADY_EXISTS ? (
                  <ForgotPasswordLink />
                ) : (
                  ""
                )
              }
            />
          )}
        </form>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// =============================== Link ==============================
// =================================================================== */

/**
 * Button-Komponente zum Navigieren zur Registrierungsseite.
 * Wird auf der Sign-In-Seite unterhalb des Login-Formulars angezeigt.
 *
 * @example
 * <SignUpLink />
 */
export const SignUpLink = () => {
  const navigate = useNavigate();

  const onSignUpClick = () => {
    navigate(ROUTE_SIGN_UP);
  };

  return (
    <Button fullWidth color="primary" onClick={onSignUpClick}>
      {TEXT_NOT_REGISTERED_YET_SIGN_UP}
    </Button>
  );
};
/* ===================================================================
// ===================== Dialog Nutzungsbedingungen ==================
// =================================================================== */

/**
 * Dialog zum Anzeigen der Nutzungsbedingungen.
 *
 * @param open - Ob der Dialog geoeffnet ist
 * @param onClose - Handler zum Schliessen des Dialogs
 */
interface DialogTermOfUseProps {
  open: boolean;
  onClose: () => void;
}
export const DialogTermOfUse = ({open, onClose}: DialogTermOfUseProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TEXT_TERM_OF_USE}</DialogTitle>
      <DialogContent>
        <TermOfUseText />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT_CLOSE}</Button>
      </DialogActions>
    </Dialog>
  );
};
/* ===================================================================
// =================== Dialog Datenschutzerklaerung ===================
// =================================================================== */

/**
 * Dialog zum Anzeigen der Datenschutzerklaerung.
 *
 * @param open - Ob der Dialog geoeffnet ist
 * @param onClose - Handler zum Schliessen des Dialogs
 */
interface DialogPrivacyPolicyProps {
  open: boolean;
  onClose: () => void;
}
export const DialogPrivacyPolicy = ({
  open,
  onClose,
}: DialogPrivacyPolicyProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TEXT_PRIVACY_POLICY_DIALOG_TITLE}</DialogTitle>
      <DialogContent>
        <PrivacyPolicyText />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT_CLOSE}</Button>
      </DialogActions>
    </Dialog>
  );
};
export {SignUpPage};
