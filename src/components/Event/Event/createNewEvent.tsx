import React from "react";
import {useNavigate} from "react-router";

import {
  Container,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Button,
  Backdrop,
  CircularProgress,
  Typography,
  Card,
  CardHeader,
  CardContent,
  useMediaQuery,
  Box,
  useTheme,
} from "@mui/material";

import {
  CREATE_YOUR_EVENT as TEXT_CREATE_YOUR_EVENT,
  WHAT_ARE_YOU_UP_TO as TEXT_WHAT_ARE_YOU_UP_TO,
  EVENT_INFO as TEXT_EVENT_INFO,
  QUANTITY_CALCULATION_INFO as TEXT_QUANTITY_CALCULATION_INFO,
  COMPLETION as TEXT_COMPLETION,
  CONTINUE as TEXT_CONTIUNE,
  BACK_TO_OVERVIEW as TEXT_BACK_TO_OVERVIEW,
  BACK_TO_EVENT_INFO as TEXT_BACK_TO_EVENT_INFO,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  EVENT_IS_BEEING_CREATED as TEXT_EVENT_IS_BEEING_CREATED,
  IMAGE_IS_BEEING_UPLOADED as TEXT_IMAGE_IS_BEEING_UPLOADED,
  BACK_TO_GROUPCONFIG as TEXT_BACK_TO_GROUPCONFIG,
  RESUME_INTRODUCTION as TEXT_RESUME_INTRODUCTION,
  PLEASE_DONATE as TEXT_PLEASE_DONATE,
  WHY_DONATE as TEXT_WHY_DONATE,
  NEED_A_RECEIPT as TEXT_NEED_A_RECEIPT,
  THANK_YOU_1000 as TEXT_THANK_YOU_1000,
} from "../../../constants/text";

import useCustomStyles from "../../../constants/styles";

import PageTitle from "../../Shared/pageTitle";
import EventInfoPage from "./eventInfo";
import EventGroupConfigurationPage from "../GroupConfiguration/groupConfiguration";
import Event from "./event.class";

import {
  HOME as ROUTE_HOME,
  EVENT as ROUTE_EVENT,
} from "../../../constants/routes";

import {useFirebase} from "../../Firebase/firebaseContext";
import {useDatabase} from "../../Database/DatabaseContext";

import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import Action from "../../../constants/actions";
import AlertMessage from "../../Shared/AlertMessage";
import Menuplan from "../Menuplan/menuplan.class";
import FieldValidationError, {
  FormValidationFieldError,
} from "../../Shared/fieldValidation.error.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {useAuthUser} from "../../Session/authUserContext";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ImageRepository} from "../../../constants/imageRepository";
import {TWINT_PAYLINK} from "../../../constants/defaultValues";
/* ===================================================================
// ============================== Global =============================
// =================================================================== */
/** Schritte des Event-Erstellungsassistenten. */
enum WizardSteps {
  info,
  groupConfig,
  completion,
}
/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
/** Alle verfügbaren Aktionstypen für den Event-Reducer. */
enum ReducerActions {
  SET_EVENT,
  SET_GROUP_CONFIG,
  FIELD_UPDATE,
  SET_PICTURE,
  UPLOAD_PICTURE_INIT,
  UPLOAD_PICTURE_SUCCESS,
  SHOW_LOADING,
  SAVE_EVENT_INIT,
  SAVE_EVENT_SUCCESS,
  FORM_FIELD_ERROR,
  UPDATE_DATE_VALIDATION,
  GENERIC_ERROR,
}
/**
 * Typisierte Reducer-Aktionen als Discriminated Union.
 * Jede Aktion hat einen eigenen Payload-Typ, payload-lose Aktionen
 * haben kein `payload`-Feld.
 */
type DispatchAction =
  | {type: ReducerActions.SET_EVENT; payload: Event}
  | {type: ReducerActions.SET_GROUP_CONFIG; payload: EventGroupConfiguration}
  | {
      type: ReducerActions.FIELD_UPDATE;
      payload: {field: string; value: Event[keyof Event]};
    }
  | {type: ReducerActions.SET_PICTURE; payload: File | null}
  | {type: ReducerActions.UPLOAD_PICTURE_INIT}
  | {
      type: ReducerActions.UPLOAD_PICTURE_SUCCESS;
      payload: {pictureSrc: string};
    }
  | {type: ReducerActions.SHOW_LOADING}
  | {type: ReducerActions.SAVE_EVENT_INIT}
  | {type: ReducerActions.SAVE_EVENT_SUCCESS; payload: Event}
  | {type: ReducerActions.FORM_FIELD_ERROR; payload: FieldValidationError}
  | {
      type: ReducerActions.UPDATE_DATE_VALIDATION;
      payload: FormValidationFieldError[];
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};
/** Zustand des Event-Erstellungsassistenten. */
type State = {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Konfiguration der Gruppen (Portionen, Intoleranzen, Diäten). */
  groupConfig: EventGroupConfiguration;
  /** Lokal ausgewähltes Bild (noch nicht hochgeladen). */
  localPicture: File | null;
  /** Allgemeiner Ladeindikator. */
  isLoading: boolean;
  /** Indikator für laufenden Bild-Upload. */
  isUpLoadingPicture: boolean;
  /** Indikator für laufenden Speichervorgang. */
  isSaving: boolean;
  /** Ob ein Fehler aufgetreten ist. */
  isError: boolean;
  /** Liste der Formular-Validierungsfehler. */
  eventFormValidation: FormValidationFieldError[];
  /** Aktuelles Fehler-Objekt (falls vorhanden). */
  error: Error | null;
};
const initialState: State = {
  event: new Event(),
  groupConfig: new EventGroupConfiguration(),
  localPicture: null,
  isLoading: false,
  isUpLoadingPicture: false,
  isSaving: false,
  isError: false,
  eventFormValidation: [],
  error: null,
};

/**
 * Reducer für den Event-Erstellungsassistenten.
 * Verwaltet den Zustand über alle Wizard-Schritte hinweg.
 *
 * @param state Aktueller State.
 * @param action Typisierte Aktion (Discriminated Union).
 * @returns Neuer State.
 * @throws {Error} Bei unbekanntem Aktionstyp.
 */
const eventReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SET_EVENT:
      return {...state, event: action.payload};
    case ReducerActions.SET_GROUP_CONFIG:
      return {...state, groupConfig: action.payload};
    case ReducerActions.FIELD_UPDATE:
      return {
        ...state,
        event: {...state.event, [action.payload.field]: action.payload.value},
      };
    case ReducerActions.SET_PICTURE:
      return {...state, localPicture: action.payload};
    case ReducerActions.UPLOAD_PICTURE_INIT:
      return {
        ...state,
        isUpLoadingPicture: true,
      };
    case ReducerActions.UPLOAD_PICTURE_SUCCESS:
      return {
        ...state,
        event: {
          ...state.event,
          pictureSrc: action.payload.pictureSrc,
        },
        isUpLoadingPicture: false,
      };
    case ReducerActions.SAVE_EVENT_INIT:
      return {...state, isSaving: true};
    case ReducerActions.SAVE_EVENT_SUCCESS:
      return {
        ...state,
        isSaving: false,
        isError: false,
        error: null,
        eventFormValidation: [],
        event: action.payload,
      };
    case ReducerActions.FORM_FIELD_ERROR:
      return {
        ...state,
        isSaving: false,
        isError: true,
        error: action.payload,
        eventFormValidation: action.payload.formValidation,
      };
    case ReducerActions.UPDATE_DATE_VALIDATION:
      return {
        ...state,
        eventFormValidation: action.payload,
      };
    case ReducerActions.SHOW_LOADING:
      return {
        ...state,
        isSaving: true,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isSaving: false,
        isError: true,
        error: action.payload,
      };
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptkomponente für den 3-Schritt-Event-Erstellungsassistenten.
 * Führt den Benutzer durch: Event-Info → Gruppenkonfiguration → Abschluss.
 */
const CreateEventPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(eventReducer, initialState);
  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const [activeStep, setActiveStep] = React.useState(WizardSteps.info);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    if (authUser !== null) {
      navigationValuesContext?.setNavigationValues({
        action: Action.NEW,
        object: NavigationObject.none,
      });
      // Initialier Event erstellen
      dispatch({
        type: ReducerActions.SET_EVENT,
        payload: Event.factory(authUser),
      });
    }
  }, [authUser]);

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Step-Steuerung
  // ------------------------------------------ */
  const goToStepGroup = () => {
    setActiveStep(WizardSteps.groupConfig);
  };
  const goToOverview = () => {
    if (state.event.uid) {
      // Event wieder löschen
      Event.delete({
        event: state.event,
        firebase: firebase,
        authUser: authUser,
      });
    }

    navigate(`${ROUTE_HOME}`);
  };
  const goToStepInfo = () => {
    setActiveStep(WizardSteps.info);
  };
  const goToResume = (
    _event: React.MouseEvent<HTMLButtonElement>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value?: {[key: string]: any},
  ) => {
    const groupConfig = value as EventGroupConfiguration;
    dispatch({type: ReducerActions.SET_GROUP_CONFIG, payload: groupConfig});
    setActiveStep(WizardSteps.completion);
  };
  const goToMenuplan = async () => {
    dispatch({type: ReducerActions.SHOW_LOADING});

    // Kurz warten, dass auch alles ready ist
    await new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    });

    navigate(`${ROUTE_EVENT}/${state.event.uid}`, {
      state: {event: state.event, groupConfig: state.groupConfig},
    });
  };
  /* ------------------------------------------
  // Änderungen übernehmen
  // ------------------------------------------ */
  const onUpdateEvent = (event: Event) => {
    dispatch({type: ReducerActions.SET_EVENT, payload: event});
  };
  const onUpdatePicture = (picture: File | null) => {
    dispatch({type: ReducerActions.SET_PICTURE, payload: picture});
  };
  const onFormValidationUpdate = (errors: FormValidationFieldError[]) => {
    dispatch({type: ReducerActions.UPDATE_DATE_VALIDATION, payload: errors});
  };
  const onEventError = (error: Error) => {
    dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
  };
  /* ------------------------------------------
  // Event Speicherung
  // ------------------------------------------ */
  const onCreateEvent = async () => {
    dispatch({type: ReducerActions.SAVE_EVENT_INIT});

    try {
      const result = await Event.save({
        firebase: firebase,
        event: state.event,
        authUser: authUser,
        localPicture: state.localPicture ? state.localPicture : ({} as File),
      });

      dispatch({type: ReducerActions.SAVE_EVENT_SUCCESS, payload: result});

      // Menüplan erstellen und speichern
      try {
        await Menuplan.save({
          menuplan: Menuplan.factory({
            event: {...state.event, uid: result.uid},
            authUser: authUser,
          }),
          firebase: firebase,
          authUser: authUser,
        });
      } catch (error) {
        console.error(error);
        throw error;
      } finally {
        // Einen Schritt weiter
        goToStepGroup();
      }
    } catch (error) {
      const fieldError = error as FieldValidationError;
      console.error(fieldError);

      if (fieldError.formValidation) {
        dispatch({type: ReducerActions.FORM_FIELD_ERROR, payload: fieldError});
        // Zum 1. Fehler-Feld scrollen
        const element = document.getElementById(
          fieldError.formValidation[0].fieldName,
        );
        element?.scrollIntoView({behavior: "smooth"});
        return;
      }
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: fieldError});
    }
  };

  return (
    <React.Fragment>
      <PageTitle
        title={TEXT_CREATE_YOUR_EVENT}
        subTitle={TEXT_WHAT_ARE_YOU_UP_TO}
      />
      <Backdrop sx={classes.backdrop} open={state.isSaving}>
        <Stack spacing={2} sx={classes.centerCenter}>
          <CircularProgress color="inherit" />
          <Typography>
            {TEXT_EVENT_IS_BEEING_CREATED(state.event.name)}
          </Typography>
          {state.localPicture && (
            <Typography>{TEXT_IMAGE_IS_BEEING_UPLOADED}</Typography>
          )}
        </Stack>
      </Backdrop>

      <Container sx={classes.container} component="main" maxWidth="md">
        <CreateEventStepper activeStep={activeStep} />

        <Stack spacing={2} sx={classes.centerCenter}>
          {state.isError && (
            <AlertMessage
              error={state.error as Error}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          )}

          {activeStep === WizardSteps.info ? (
            <Stack spacing={2}>
              <EventInfoPage
                event={state.event}
                localPicture={state.localPicture}
                formValidation={state.eventFormValidation}
                firebase={firebase}
                database={database}
                authUser={authUser}
                onUpdateEvent={onUpdateEvent}
                onUpdatePicture={onUpdatePicture}
                onFormValidationUpdate={onFormValidationUpdate}
                onError={onEventError}
              />
              <Box
                component="div"
                sx={{display: "flex", justifyContent: "flex-end"}}
              >
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={goToOverview}
                >
                  {TEXT_BACK_TO_OVERVIEW}
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  style={{marginLeft: "1rem"}}
                  onClick={onCreateEvent}
                >
                  {TEXT_CONTIUNE}
                </Button>
              </Box>
            </Stack>
          ) : activeStep === WizardSteps.groupConfig ? (
            <EventGroupConfigurationPage
              firebase={firebase}
              authUser={authUser}
              event={state.event}
              onConfirm={{buttonText: TEXT_CONTIUNE, onClick: goToResume}}
              onCancel={{
                buttonText: TEXT_BACK_TO_EVENT_INFO,
                onClick: goToStepInfo,
              }}
            />
          ) : (
            <CreateEventCompletion
              event={state.event}
              onReturn={goToStepGroup}
              onProceed={goToMenuplan}
            />
          )}
        </Stack>
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// =============================== Resume ============================
// =================================================================== */
/**
 * Props für die Abschluss-Seite des Event-Erstellungsassistenten.
 */
interface CreateEventCompletionProps {
  /** Das erstellte Event. */
  event: Event;
  /** Callback zum Zurückkehren zur Gruppenkonfiguration. */
  onReturn: () => void;
  /** Callback zum Fortfahren zum Menüplan. */
  onProceed: () => void;
}
/**
 * Abschluss-Seite des Event-Erstellungsassistenten.
 * Zeigt eine Zusammenfassung und Spendenoptionen (TWINT QR-Code).
 */
const CreateEventCompletion = ({
  event,
  onProceed,
  onReturn,
}: CreateEventCompletionProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  return (
    <Container component="main" maxWidth="md">
      <Stack spacing={2}>
        <Card>
          <CardHeader title={TEXT_COMPLETION} />
          <CardContent>
            <Stack
              spacing={2}
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography>{TEXT_RESUME_INTRODUCTION(event.name)}</Typography>
              <br />
              <Typography>
                <strong>{TEXT_PLEASE_DONATE}</strong>
                <br />
                {TEXT_WHY_DONATE}
                <br />
                {TEXT_NEED_A_RECEIPT}
                <br />
                <br />
                {TEXT_THANK_YOU_1000}
              </Typography>
              <Box sx={classes.centerCenter}>
                <Box
                  component="img"
                  src={
                    ImageRepository.getEnvironmentRelatedPicture().TWINT_QR_CODE
                  }
                  sx={classes.cardMediaQrCode}
                  style={{maxWidth: "100%", height: "auto"}}
                />
              </Box>

              <TwintButton />
            </Stack>
          </CardContent>
        </Card>

        <Box
          component="div"
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: theme.spacing(1),
          }}
        >
          <Button variant="outlined" onClick={onReturn}>
            {TEXT_BACK_TO_GROUPCONFIG}
          </Button>
          <Button variant="contained" onClick={onProceed}>
            {TEXT_CONTIUNE}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
};
// ===================================================================
// ============================ Twint Button =========================
// =================================================================== */
/**
 * TWINT-Zahlungsbutton mit Dark-Mode-Unterstützung.
 * Öffnet den TWINT-Paylink in einem neuen Tab.
 */
export const TwintButton = () => {
  const classes = useCustomStyles();
  const darkMode = useMediaQuery("(prefers-color-scheme: dark)");

  return (
    <Button
      fullWidth
      startIcon={
        <Box
          component="img"
          src={
            darkMode
              ? "https://assets.raisenow.io/twint-logo-light.svg"
              : "https://assets.raisenow.io/twint-logo-dark.svg"
          }
          alt="Twint-Icon"
        />
      }
      onClick={() => {
        window.open(TWINT_PAYLINK, "_blank");
      }}
      sx={[
        classes.twintButton,
        darkMode ? classes.twintButtonDarkMode : classes.twintButtonLightMode,
      ]}
    >
      Mit TWINT bezahlen
    </Button>
  );
};
/* ===================================================================
// ============================== Stepper ============================
// =================================================================== */
/** Props für die Stepper-Komponente. */
interface CreateEventStepperProps {
  /** Aktuell aktiver Wizard-Schritt. */
  activeStep: WizardSteps;
}
/**
 * Fortschrittsanzeige (Stepper) für den Event-Erstellungsassistenten.
 */
const CreateEventStepper = ({activeStep}: CreateEventStepperProps) => {
  return (
    <Stepper activeStep={activeStep} alternativeLabel sx={{mb: 2}}>
      <Step key={WizardSteps.info}>
        <StepLabel>{TEXT_EVENT_INFO}</StepLabel>
      </Step>
      <Step key={WizardSteps.groupConfig}>
        <StepLabel>{TEXT_QUANTITY_CALCULATION_INFO}</StepLabel>
      </Step>
      <Step key={WizardSteps.completion}>
        <StepLabel>{TEXT_COMPLETION}</StepLabel>
      </Step>
    </Stepper>
  );
};

export default CreateEventPage;
