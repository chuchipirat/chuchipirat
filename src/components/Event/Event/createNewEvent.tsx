import * as Sentry from "@sentry/react";
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
  Box,
  useTheme,
} from "@mui/material";

import {
  CREATE_YOUR_EVENT as TEXT_CREATE_YOUR_EVENT,
  WHAT_ARE_YOU_UP_TO as TEXT_WHAT_ARE_YOU_UP_TO,
  EVENT_INFO as TEXT_EVENT_INFO,
  QUANTITY_CALCULATION_INFO as TEXT_QUANTITY_CALCULATION_INFO,
  COMPLETION as TEXT_COMPLETION,
  CONTINUE as TEXT_CONTINUE,
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

import {useCustomStyles} from "../../../constants/styles";

import {PageTitle} from "../../Shared/pageTitle";
import {EventInfoPage} from "./eventInfo";
import {EventGroupConfigurationPage} from "../GroupConfiguration/groupConfiguration";
import {Event} from "./event.class";

import {
  HOME as ROUTE_HOME,
  EVENT as ROUTE_EVENT,
} from "../../../constants/routes";

import {useFirebase} from "../../Firebase/firebaseContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {FeedType} from "../../Shared/feed.class";

import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/NavigationContext";
import {Action} from "../../../constants/actions";
import {AlertMessage} from "../../Shared/AlertMessage";
import {
  FieldValidationError,
  FormValidationFieldError,
} from "../../Shared/fieldValidation.error.class";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {useAuthUser} from "../../Session/authUserContext";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ImageRepository} from "../../../constants/imageRepository";
import {TwintButton} from "../../Shared/TwintButton";
import {resizeImage} from "../../Shared/imageResize";
import {
  GroupConfigDomain,
  PortionEntryDomain,
} from "../../Database/Repository/EventGroupConfigRepository";
/** Schritte des Event-Erstellungsassistenten. */
enum WizardSteps {
  info,
  groupConfig,
  completion,
}
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
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustive}`);
    }
  }
};


/**
 * Konvertiert die lokale EventGroupConfiguration (verschachtelte Map-Struktur)
 * in das flache GroupConfigDomain-Format für das Supabase-Repository.
 *
 * @param gc Lokale Gruppenkonfiguration (diets.entries, intolerances.entries, portions[diet][int]).
 * @param eventId ID des zugehörigen Events.
 * @returns Flaches GroupConfigDomain für saveGroupConfig().
 */
function mapGroupConfigToGroupConfigDomain(
  gc: EventGroupConfiguration,
  eventId: string,
): GroupConfigDomain {
  // Lokale UIDs (z.B. "aB3xY" aus Utils.generateUid(5)) werden als
  // Referenz für die Portionen-Zuordnung beibehalten. Das Repository
  // erkennt anhand der Länge, dass sie keine gültigen DB-UUIDs sind,
  // und lässt die DB eine korrekte UUID generieren.
  const diets = gc.diets.order.map((dietUid, index) => ({
    uid: dietUid,
    name: gc.diets.entries[dietUid].name,
    sortOrder: index * 10,
  }));

  const intolerances = gc.intolerances.order.map((intUid, index) => ({
    uid: intUid,
    name: gc.intolerances.entries[intUid].name,
    sortOrder: index * 10,
  }));

  const portions: PortionEntryDomain[] = [];
  gc.diets.order.forEach((dietUid) => {
    gc.intolerances.order.forEach((intUid) => {
      portions.push({
        uid: "",
        dietId: dietUid,
        intoleranceId: intUid,
        servings: gc.portions[dietUid]?.[intUid] ?? 0,
      });
    });
  });

  return {eventId, diets, intolerances, portions};
}


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
  const goToGroupConfigStep = () => {
    setActiveStep(WizardSteps.groupConfig);
  };
  const goToOverview = () => {
    navigate(`${ROUTE_HOME}`);
  };
  const goToInfoStep = () => {
    // Leere Datumszeile anhängen, falls die letzte Zeile bereits
    // befüllt ist (deleteEmptyDates entfernt sie vor dem Weitergehen).
    const dates = [...state.event.dates];
    const last = dates[dates.length - 1];
    const epoch = new Date(0).getTime();
    if (
      !last ||
      last.from.getTime() !== epoch ||
      last.to.getTime() !== epoch
    ) {
      const newDate = Event.createDateEntry();
      newDate.pos = dates.length + 1;
      dates.push(newDate);
      dispatch({
        type: ReducerActions.SET_EVENT,
        payload: {...state.event, dates} as Event,
      });
    }
    setActiveStep(WizardSteps.info);
  };
  /** Typassertion nötig, da ButtonAction generisch ist und der Wert als unknown ankommt. */
  const goToCompletionStep = (
    _event: React.MouseEvent<HTMLButtonElement>,
    value?: EventGroupConfiguration,
  ) => {
    if (!value) return;
    dispatch({type: ReducerActions.SET_GROUP_CONFIG, payload: value});
    setActiveStep(WizardSteps.completion);
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
  // Validierung (kein Speichern — deferred save)
  // ------------------------------------------ */
  const onValidateAndContinue = () => {
    try {
      const preparedEvent = {...state.event};
      preparedEvent.dates = Event.deleteEmptyDates(preparedEvent.dates);
      Event.checkEventData(preparedEvent);
      dispatch({type: ReducerActions.SET_EVENT, payload: preparedEvent});
      goToGroupConfigStep();
    } catch (error) {
      const fieldError = error as FieldValidationError;

      if (fieldError.formValidation) {
        dispatch({type: ReducerActions.FORM_FIELD_ERROR, payload: fieldError});
        const element = document.getElementById(
          fieldError.formValidation[0].fieldName,
        );
        element?.scrollIntoView({behavior: "smooth"});
        return;
      }
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: fieldError});
      window.scrollTo({top: 0, behavior: "smooth"});
    }
  };

  /* ------------------------------------------
  // Alles speichern (Supabase) — beim Abschluss-Schritt
  // ------------------------------------------ */
  const onSaveAll = async () => {
    dispatch({type: ReducerActions.SAVE_EVENT_INIT});

    try {
      // 1. Event erstellen (Supabase)
      const eventDomain = await database.events.createEvent(
        {
          name: state.event.name,
          motto: state.event.motto,
          location: state.event.location,
          pictureSrc: "",
        },
        authUser,
      );

      // 2. Ersteller als Koch hinzufügen (vor Bild-Upload, damit
      //    is_event_cook() für die Storage-Policy true ergibt).
      //    authUser.uid ist die Supabase Auth UUID (event_cooks.user_id
      //    erwartet UUID).
      await database.events.addCook(
        eventDomain.uid,
        authUser.uid,
        authUser,
      );

      // 3. Weitere Köche hinzufügen — cook.uid ist die Firebase UID,
      //    muss zu Supabase Auth UUID aufgelöst werden.
      const usersRepo = database.admin?.users ?? database.users;
      for (const cook of state.event.cooks) {
        if (cook.uid !== authUser.uid) {
          const userDomain = await usersRepo.findById(cook.uid);
          if (userDomain?.uid) {
            await database.events.addCook(
              eventDomain.uid,
              userDomain.uid,
              authUser,
            );
          }
        }
      }

      // 4. Zeitscheiben speichern
      const dateDomains = state.event.dates
        .filter((dateEntry) => dateEntry.from && dateEntry.to)
        .map((dateEntry, index) => ({
          dateFrom: dateEntry.from,
          dateTo: dateEntry.to,
          sortOrder: index * 10,
        }));
      await database.events.saveDates(eventDomain.uid, dateDomains, authUser);

      // 5. Bild hochladen (falls vorhanden)
      let pictureSrc = "";
      if (state.localPicture) {
        const resizedBlob = await resizeImage(state.localPicture);
        const result = await database.storage.events.upload(
          `${eventDomain.uid}.jpg`,
          resizedBlob,
          "image/jpeg",
        );
        pictureSrc = result.publicUrl;
        await database.events.updateEvent(
          {...eventDomain, pictureSrc},
          authUser,
        );
      }

      // 6. Gruppenkonfiguration speichern
      const groupConfigDomain = mapGroupConfigToGroupConfigDomain(
        state.groupConfig,
        eventDomain.uid,
      );
      await database.eventGroupConfig.saveGroupConfig(
        groupConfigDomain,
        authUser,
      );

      // 7. Menüplan initialisieren (Mahlzeittypen + Mahlzeiten + Menüs für jedes Datum)
      await database.menuplan.initializeMenuplan(eventDomain.uid, dateDomains, authUser);

      // 8. Feed-Einträge erstellen (nicht blockierend)
      database.feeds
        .insertFeed(
          {
            feedType: FeedType.eventCreated,
            sourceObjectType: "event",
            sourceObjectUid: eventDomain.uid,
          },
          authUser,
        )
        .catch((error) => Sentry.captureException(error, {extra: {context: "Feed-Eintrag erstellen"}}));

      // Feed für jeden weiteren Koch (nicht den Ersteller selbst)
      // cook.uid ist die Firebase-UID → auth UUID über users-Tabelle auflösen
      const usersForFeed = database.admin?.users ?? database.users;
      for (const cook of state.event.cooks) {
        if (cook.uid !== authUser.uid) {
          usersForFeed
            .findById(cook.uid)
            .then((userDomain) => {
              if (!userDomain?.uid) return;
              return database.feeds.insertFeed(
                {
                  feedType: FeedType.eventCookAdded,
                  sourceObjectType: "event",
                  sourceObjectUid: eventDomain.uid,
                  userUid: userDomain.uid,
                },
                authUser,
              );
            })
            .catch((error) => Sentry.captureException(error, {extra: {context: "Feed-Eintrag erstellen"}}));
        }
      }

      // 9. Zum Event navigieren
      const savedEvent = {...state.event, uid: eventDomain.uid, pictureSrc};
      dispatch({type: ReducerActions.SAVE_EVENT_SUCCESS, payload: savedEvent});
      navigate(`${ROUTE_EVENT}/${eventDomain.uid}`);
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      window.scrollTo({top: 0, behavior: "smooth"});
    }
  };

  /**
   * Rendert den Inhalt des aktuell aktiven Wizard-Schritts.
   */
  const renderActiveStep = () => {
    switch (activeStep) {
      case WizardSteps.info:
        return (
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
                onClick={onValidateAndContinue}
              >
                {TEXT_CONTINUE}
              </Button>
            </Box>
          </Stack>
        );
      case WizardSteps.groupConfig:
        return (
          <EventGroupConfigurationPage
            firebase={firebase}
            authUser={authUser}
            event={state.event}
            deferSave={true}
            onConfirm={{
              buttonText: TEXT_CONTINUE,
              onClick: goToCompletionStep,
            }}
            onCancel={{
              buttonText: TEXT_BACK_TO_EVENT_INFO,
              onClick: goToInfoStep,
            }}
          />
        );
      case WizardSteps.completion:
        return (
          <CreateEventCompletion
            event={state.event}
            isSaving={state.isSaving}
            onReturn={goToGroupConfigStep}
            onProceed={onSaveAll}
          />
        );
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

          {renderActiveStep()}
        </Stack>
      </Container>
    </React.Fragment>
  );
};
/**
 * Props für die Abschluss-Seite des Event-Erstellungsassistenten.
 */
interface CreateEventCompletionProps {
  /** Das erstellte Event. */
  event: Event;
  /** Ob gerade gespeichert wird. */
  isSaving: boolean;
  /** Callback zum Zurückkehren zur Gruppenkonfiguration. */
  onReturn: () => void;
  /** Callback zum Speichern und Abschliessen. */
  onProceed: () => void;
}
/**
 * Abschluss-Seite des Event-Erstellungsassistenten.
 * Zeigt eine Zusammenfassung und Spendenoptionen (TWINT QR-Code).
 */
const CreateEventCompletion = ({
  event,
  isSaving,
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
          <Button variant="outlined" onClick={onReturn} disabled={isSaving}>
            {TEXT_BACK_TO_GROUPCONFIG}
          </Button>
          <Button variant="contained" onClick={onProceed} disabled={isSaving}>
            {TEXT_CONTINUE}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
};
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

export {CreateEventPage};
