import React from "react";
import {useNavigate} from "react-router";

import {
  Alert,
  AlertTitle,
  Button,
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

import {ForgotPasswordLink} from "../AuthServiceHandler/passwordReset";

import PageTitle from "../Shared/pageTitle";
import PasswordStrengthMeter from "../Shared/passwordStrengthMeter";
import AlertMessage from "../Shared/AlertMessage";

import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import {SIGN_UP as ROUTE_SIGN_UP} from "../../constants/routes";
import {AuthMessages} from "../../constants/firebaseMessages";
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
} from "../../constants/text";
import User from "../User/user.class";
import {PrivacyPolicyText} from "../App/privacyPolicy";
import {TermOfUseText} from "../App/termOfUse";
import {AlertMaintenanceMode} from "../SignIn/signIn";
import useCustomStyles from "../../constants/styles";
import Utils from "../Shared/utils.class";

/* ===================================================================
// ======================== State Management ==========================
// =================================================================== */

enum ReducerActions {
  UPDATE_FIELD,
  SET_SIGN_UP_ALLOWED,
  GENERIC_ERROR,
  SIGN_UP_SUCCESS,
}

/**
 * Eingabedaten für das Sign-Up-Formular.
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

/** Fehlertyp, der sowohl Firebase- als auch Supabase-Fehler abdeckt */
type AuthErrorLike = Error & {code?: string};

/**
 * State für die Sign-Up-Seite.
 *
 * @param signUpData - Eingegebene Registrierungsdaten
 * @param error - Fehlerobjekt bei gescheiterter Registrierung
 * @param signUpAllowed - Ob Registrierungen erlaubt sind
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param signUpSuccess - Ob die Registrierung erfolgreich war (Bestätigungs-E-Mail gesendet)
 */
type State = {
  signUpData: SignUpData;
  error: AuthErrorLike | null;
  signUpAllowed: boolean;
  maintenanceMode: boolean;
  signUpSuccess: boolean;
};

const initialState: State = {
  signUpData: {firstName: "", lastName: "", email: "", password: ""},
  error: null,
  signUpAllowed: true,
  maintenanceMode: false,
  signUpSuccess: false,
};

/** Diskriminierte Union für typsichere Reducer-Actions */
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
  | {type: ReducerActions.SIGN_UP_SUCCESS};

/**
 * Reducer für die Sign-Up-Seite.
 * Verwaltet Registrierungsdaten, Berechtigungen und Fehler.
 *
 * @param state - Aktueller State
 * @param action - Auszuführende Aktion
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
      return {...state, error: action.payload};
    case ReducerActions.SIGN_UP_SUCCESS:
      return {...state, signUpSuccess: true, error: null};
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
  const firebase = useFirebase();
  const database = useDatabase();

  const classes = useCustomStyles();
  const [state, dispatch] = React.useReducer(signUpReducer, initialState);

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
  // Feld-Änderungen
  // ------------------------------------------ */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.UPDATE_FIELD,
      payload: {field: event.target.name, value: event.target.value},
    });
  };
  /* ------------------------------------------
  // Anmelden
  // ------------------------------------------ */
  const onSignUp = async () => {
    try {
      // Supabase Auth Account erstellen (E-Mail-Bestätigung nötig, keine Session)
      const user = await database.auth.signUp(
        state.signUpData.email,
        state.signUpData.password,
      );

      // Benutzer in der users-Tabelle anlegen (Admin-Client, da User noch keine Session hat)
      await User.createUser({
        firebase: firebase,
        database: database,
        uid: user.id,
        authUid: user.id,
        firstName: state.signUpData.firstName,
        lastName: state.signUpData.lastName,
        email: state.signUpData.email,
      });

      // Bestätigungsmeldung anzeigen statt Home-Redirect
      dispatch({type: ReducerActions.SIGN_UP_SUCCESS});
    } catch (error) {
      console.error(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as AuthErrorLike,
      });
    }
  };
  /* ------------------------------------------
  // Dialog-Handling
  // ------------------------------------------ */
  const onSmallPrintDialogOpen = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    setSmallPrintDialogs({
      ...smallPrintDialogs,
      [event.currentTarget.id]: true,
    });
  };
  const onSmallPrintDialogClose = () => {
    setSmallPrintDialogs({termOfUse: false, privacyPolicy: false});
  };
  return (
    <React.Fragment>
      <PageTitle subTitle={TEXT_WE_NEED_SOME_DETAILS_ABOUT_YOU} />

      <Container sx={classes.container} component="main" maxWidth="xs">
        <Stack spacing={2}>
          {state.maintenanceMode && <AlertMaintenanceMode />}
          {state.signUpSuccess ? (
            <Alert severity="success">
              <AlertTitle>{TEXT_SIGN_UP_SUCCESS_TITLE}</AlertTitle>
              {TEXT_SIGN_UP_SUCCESS_TEXT}
            </Alert>
          ) : (
            <SignUpForm
              signUpData={state.signUpData}
              signUpAllowed={state.signUpAllowed}
              maintenanceMode={state.maintenanceMode}
              error={state.error}
              onFieldChange={onFieldChange}
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
 * Props für das Sign-Up-Formular.
 *
 * @param signUpData - Aktuelle Registrierungsdaten
 * @param signUpAllowed - Ob Registrierungen erlaubt sind
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 * @param onFieldChange - Handler für Feldänderungen
 * @param onSignUp - Handler für den Registrieren-Button
 * @param openDialog - Handler zum Öffnen der AGB-/Datenschutz-Dialoge
 * @param error - Fehlerobjekt (null wenn kein Fehler)
 */
interface SignUpFormProps {
  signUpData: SignUpData;
  signUpAllowed: boolean;
  maintenanceMode: boolean;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSignUp: () => void;
  openDialog: (event: React.MouseEvent<HTMLElement>) => void;
  error: AuthErrorLike | null;
}

/**
 * Formular zur Registrierung mit Vorname, Nachname, E-Mail und Passwort.
 * Zeigt Passwort-Stärkeanzeige und Links zu AGB/Datenschutz.
 */
const SignUpForm = ({
  signUpData,
  signUpAllowed,
  maintenanceMode,
  onFieldChange,
  onSignUp,
  openDialog,
  error,
}: SignUpFormProps) => {
  const classes = useCustomStyles();
  const [showPassword, setShowPassword] = React.useState(false);

  /* ------------------------------------------
  // Password-Feld Handler
  // ------------------------------------------ */
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
      <Card sx={classes.card}>
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
            {TEXT_SIGN_IN}
          </Typography>
          {/* Meldung wenn SignUp nicht möglich ist */}
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
            autoComplete="firstname"
            autoFocus
            value={signUpData.firstName}
            onChange={onFieldChange}
            disabled={!signUpAllowed || maintenanceMode}
          />
          {/* Nachname */}
          <TextField
            type="text"
            margin="normal"
            fullWidth
            id="lastName"
            label={TEXT_LASTNAME}
            name="lastName"
            autoComplete="lastname"
            value={signUpData.lastName}
            onChange={onFieldChange}
            disabled={!signUpAllowed || maintenanceMode}
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
            disabled={!signUpAllowed || maintenanceMode}
          />
          {signUpData.email && !Utils.isEmail(signUpData.email) && (
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
            disabled={!signUpAllowed || maintenanceMode}
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
          {/* Stärke Passwort */}
          <PasswordStrengthMeter password={signUpData.password} />
          <Typography sx={{marginTop: "1rem"}}>
            Indem du fortfährst, akzeptierst du:
          </Typography>

          <ul>
            <li>
              <Typography>
                die{" "}
                <Link component="button" id="termOfUse" onClick={openDialog}>
                  Nutzungsbedingungen
                </Link>{" "}
                für den chuchipirat.
              </Typography>
            </li>
            <li>
              <Typography>
                die{" "}
                <Link
                  component="button"
                  id="privacyPolicy"
                  onClick={openDialog}
                >
                  Datenschutzbestimmungen
                </Link>{" "}
                des chuchipirats.
              </Typography>
            </li>
          </ul>
          <Button
            disabled={
              maintenanceMode ||
              !signUpAllowed ||
              signUpData.firstName === "" ||
              !Utils.isEmail(signUpData.email) ||
              signUpData.password.length < 6
            }
            fullWidth
            variant="contained"
            color="primary"
            sx={classes.submit}
            onClick={onSignUp}
          >
            {TEXT_CREATE_ACCOUNT}
          </Button>
          {error && (
            <AlertMessage
              error={error}
              severity={"error"}
              body={
                error.code === AuthMessages.EMAIL_ALREADY_IN_USE ||
                error.code === AuthMessages.USER_ALREADY_EXISTS ? (
                  <ForgotPasswordLink />
                ) : (
                  ""
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </React.Fragment>
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
 * @param open - Ob der Dialog geöffnet ist
 * @param onClose - Handler zum Schliessen des Dialogs
 */
interface DialogTermOfUseProps {
  open: boolean;
  onClose: () => void;
}
export const DialogTermOfUse = ({open, onClose}: DialogTermOfUseProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nutzungsbedingungen</DialogTitle>
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
// =================== Dialog Datenschutzerklärung ===================
// =================================================================== */

/**
 * Dialog zum Anzeigen der Datenschutzerklärung.
 *
 * @param open - Ob der Dialog geöffnet ist
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
      <DialogTitle>Datenschutzerklärung für die Webapp chuchipirat</DialogTitle>
      <DialogContent>
        <PrivacyPolicyText />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT_CLOSE}</Button>
      </DialogActions>
    </Dialog>
  );
};
export default SignUpPage;
