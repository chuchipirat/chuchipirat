/**
 * ActivateSupportUserPage — Admin-Seite zum Aktivieren des Support-Modus.
 *
 * Der Support-User (konfiguriert via `VITE_SUPPORT_USER_ID`) wird als Koch
 * zum angegebenen Event hinzugefügt. Die Admin-Person muss nur die Event-UID
 * eingeben.
 */
import React from "react";
import * as Sentry from "@sentry/react";

import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardHeader,
  CardContent,
  useTheme,
  LinearProgress,
  Stack,
  Alert,
} from "@mui/material";

import {
  ACTIVATE_SUPPORT_USER as TEXT_ACTIVATE_SUPPORT_USER,
  EVENT_UID as TEXT_EVENT_UID,
  ACTIVATE_SUPPORT_MODE as TEXT_ACTIVATE_SUPPORT_MODE,
  ACTIVATE_SUPPORT_MODE_DESCRIPTION as TEXT_ACTIVATE_SUPPORT_MODE_DESCRIPTION,
  SUPPORT_USER_REGISTERED as TEXT_SUPPORT_USER_REGISTERED,
} from "../../constants/text";

import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {PageTitle} from "../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "./system";
import {useCustomStyles} from "../../constants/styles";

/* ===================================================================
// ======================== Konfiguration ============================
// =================================================================== */

/** Support-User-ID aus Umgebungsvariable. */
const SUPPORT_USER_ID = import.meta.env.VITE_SUPPORT_USER_ID as string | undefined;

/* ===================================================================
// ======================== Reducer ==================================
// =================================================================== */

enum ReducerActions {
  EVENT_UID_UPDATE,
  ACTIVATE_SUPPORT_USER_START,
  ACTIVATE_SUPPORT_USER_FINISHED,
  GENERIC_ERROR,
}

/** Diskriminierte Union für typsichere Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.EVENT_UID_UPDATE; payload: string}
  | {type: ReducerActions.ACTIVATE_SUPPORT_USER_START}
  | {type: ReducerActions.ACTIVATE_SUPPORT_USER_FINISHED}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  eventUid: string;
  isActivating: boolean;
  activationComplete: boolean;
  error: Error | null;
};

const initialState: State = {
  eventUid: "",
  isActivating: false,
  activationComplete: false,
  error: null,
};

/**
 * Reducer für die Support-User-Aktivierung.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const activateSupportUserReducer = (
  state: State,
  action: DispatchAction
): State => {
  switch (action.type) {
    case ReducerActions.EVENT_UID_UPDATE:
      return {...state, eventUid: action.payload, activationComplete: false, error: null};
    case ReducerActions.ACTIVATE_SUPPORT_USER_START:
      return {...state, isActivating: true, activationComplete: false, error: null};
    case ReducerActions.ACTIVATE_SUPPORT_USER_FINISHED:
      return {...state, isActivating: false, activationComplete: true};
    case ReducerActions.GENERIC_ERROR:
      return {...state, isActivating: false, activationComplete: true, error: action.payload};
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Seite zum Aktivieren des Support-Modus für einen Anlass.
 * Der Support-User wird als Koch zum Event hinzugefügt.
 */
const ActivateSupportUserPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [state, dispatch] = React.useReducer(
    activateSupportUserReducer,
    initialState
  );

  /** Event-UID Eingabefeld aktualisieren. */
  const onChangeEventUidField = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    dispatch({
      type: ReducerActions.EVENT_UID_UPDATE,
      payload: event.target.value,
    });
  };

  /** Support-User für den angegebenen Anlass registrieren. */
  const onRegisterSupportUser = async () => {
    if (!SUPPORT_USER_ID) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error("VITE_SUPPORT_USER_ID ist nicht konfiguriert."),
      });
      return;
    }
    if (!authUser) return;

    dispatch({type: ReducerActions.ACTIVATE_SUPPORT_USER_START});

    try {
      await database.events.addCook(state.eventUid, SUPPORT_USER_ID, authUser);
      dispatch({type: ReducerActions.ACTIVATE_SUPPORT_USER_FINISHED});
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_ACTIVATE_SUPPORT_USER} subTitle="" breadcrumbs={[SYSTEM_BREADCRUMB]} />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Stack spacing={2}>
          <PanelActivateSupportUser
            eventUid={state.eventUid}
            activationComplete={state.activationComplete}
            error={state.error}
            isActivating={state.isActivating}
            onChangeField={onChangeEventUidField}
            onRegisterSupportUser={onRegisterSupportUser}
          />
        </Stack>
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Aktivierungs-Panel =========================
// =================================================================== */

/** Eigenschaften für das Aktivierungs-Panel. */
type PanelActivateSupportUserProps = {
  eventUid: string;
  isActivating: boolean;
  activationComplete: boolean;
  error: Error | null;
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRegisterSupportUser: () => void;
};

/**
 * Panel mit Eingabefeld für Event-UID und Aktivierungs-Button.
 *
 * @param props Panel-Eigenschaften.
 */
const PanelActivateSupportUser = ({
  eventUid,
  isActivating,
  activationComplete,
  error,
  onChangeField,
  onRegisterSupportUser,
}: PanelActivateSupportUserProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardHeader title={TEXT_ACTIVATE_SUPPORT_MODE} />
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography style={{marginBottom: theme.spacing(2)}}>
          {TEXT_ACTIVATE_SUPPORT_MODE_DESCRIPTION}
        </Typography>

        <TextField
          id={"eventUid"}
          key={"eventUid"}
          label={TEXT_EVENT_UID}
          name={"eventUid"}
          required
          value={eventUid}
          onChange={onChangeField}
          fullWidth
          InputLabelProps={{
            shrink: true,
          }}
        />
        <Button
          fullWidth
          disabled={eventUid.length < 10 || isActivating}
          variant="contained"
          color="primary"
          onClick={onRegisterSupportUser}
          style={{marginTop: theme.spacing(2), marginBottom: theme.spacing(2)}}
        >
          {TEXT_ACTIVATE_SUPPORT_MODE}
        </Button>
        {isActivating && <LinearProgress />}
        {activationComplete &&
          (error ? (
            <Alert severity="error">{error.message}</Alert>
          ) : (
            <Alert severity="success">{TEXT_SUPPORT_USER_REGISTERED}</Alert>
          ))}
      </CardContent>
    </Card>
  );
};

export default ActivateSupportUserPage;
