import React from "react";
import {useNavigate, useParams} from "react-router";

import * as Sentry from "@sentry/browser";
import DOMPurify from "dompurify";

import {useDatabase} from "../../Database/DatabaseContext";
import {useAuthUser} from "../../Session/authUserContext";
import {SystemMessageDomain} from "../../Database/Repository/SystemMessageRepository";
import {
  Backdrop,
  CardContent,
  CircularProgress,
  Container,
  Card,
  CardHeader,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useTheme,
  CardActions,
  SelectChangeEvent,
  Alert,
  AlertTitle,
  Stack,
} from "@mui/material";

import {DatePicker} from "@mui/x-date-pickers/DatePicker";

import {AlertMessage} from "../../Shared/AlertMessage";
import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  EDITOR as TEXT_EDITOR,
  TITLE as TEXT_TITLE,
  PREVIEW as TEXT_PREVIEW,
  ATENTION_IMPORTANT_ANNOUNCEMENT as TEXT_ATENTION_IMPORTANT_ANNOUNCEMENT,
  TYPE as TEXT_TYPE,
  VALID_TO as TEXT_VALID_TO,
  SAVE as TEXT_SAVE,
  SYSTEM_MESSAGE_SAVED as TEXT_SYSTEM_MESSAGE_SAVED,
  NEW_SYSTEM_MESSAGE as TEXT_NEW_SYSTEM_MESSAGE,
  EDIT_SYSTEM_MESSAGE as TEXT_EDIT_SYSTEM_MESSAGE,
} from "../../../constants/text";
import * as ROUTES from "../../../constants/routes";
import {useCustomStyles} from "../../../constants/styles";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {CustomSnackbar,
  SNACKBAR_INITIAL_STATE_VALUES,
  SnackbarState,
} from "../../Shared/customSnackbar";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  SYSTEM_MESSAGE_FETCH_INIT,
  SYSTEM_MESSAGE_FETCH_SUCCESS,
  SYSTEM_MESSAGE_FIELD_UPDATE,
  SYSTEM_MESSAGE_SAVE,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}
/** Diskriminierte Union für typsichere Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.SYSTEM_MESSAGE_FETCH_INIT}
  | {type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS; payload: SystemMessageDomain}
  | {type: ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE; payload: {key: string; value: unknown}}
  | {type: ReducerActions.SYSTEM_MESSAGE_SAVE}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  systemMessage: SystemMessageDomain;
  isLoading: boolean;
  isNewMode: boolean;
  error: Error | null;
  snackbar: SnackbarState;
};

/**
 * Leere Systemmeldung für den Erstellmodus.
 */
const emptySystemMessage: SystemMessageDomain = {
  uid: "",
  title: "",
  text: "",
  type: "info",
  validTo: new Date(),
};

/**
 * Reducer für die Systemmeldungs-Seite.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const systemMessageReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SYSTEM_MESSAGE_FETCH_INIT:
      return {...state, isLoading: true};
    case ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE:
      return {
        ...state,
        systemMessage: {
          ...state.systemMessage,
          [action.payload.key]: action.payload.value,
        },
      };
    case ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS:
      return {
        ...state,
        systemMessage: action.payload,
        isLoading: false,
      };
    case ReducerActions.SYSTEM_MESSAGE_SAVE:
      return {
        ...state,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_SYSTEM_MESSAGE_SAVED,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload, isLoading: false};
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Seite zum Erstellen und Bearbeiten von Systemmeldungen.
 * Unterscheidet anhand des Route-Parameters :id zwischen Erstell- und Bearbeitmodus.
 */
const SystemMessagePage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const {id} = useParams<{id: string}>();

  const isNewMode = id === "new" || !id;

  const [state, dispatch] = React.useReducer(systemMessageReducer, {
    systemMessage: {...emptySystemMessage},
    isLoading: false,
    isNewMode,
    error: null,
    snackbar: SNACKBAR_INITIAL_STATE_VALUES,
  });

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Initialer DB-Read (nur im Bearbeitmodus)
  // ------------------------------------------ */
  React.useEffect(() => {
    if (isNewMode) return;

    dispatch({type: ReducerActions.SYSTEM_MESSAGE_FETCH_INIT});
    database.systemMessages
      .findById(id!)
      .then((result) => {
        if (result) {
          dispatch({
            type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS,
            payload: result,
          });
        } else {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: new Error(`Systemmeldung mit ID "${id}" nicht gefunden.`),
          });
        }
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, [id]);
  /* ------------------------------------------
  // Field-Handler
  // ------------------------------------------ */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE,
      payload: {key: event.target.id, value: event.target.value},
    });
  };
  const onChangeType = (event: SelectChangeEvent) => {
    dispatch({
      type: ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE,
      payload: {key: "type", value: event.target.value},
    });
  };
  const onValidToChange = (date: Date | null) => {
    dispatch({
      type: ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE,
      payload: {key: "validTo", value: date},
    });
  };
  const onSystemMessageTextChange = (value: string) => {
    dispatch({
      type: ReducerActions.SYSTEM_MESSAGE_FIELD_UPDATE,
      payload: {key: "text", value: value},
    });
  };
  /* ------------------------------------------
  // Speichern
  // ------------------------------------------ */
  const onSave = () => {
    const savePromise = isNewMode
      ? database.systemMessages.createMessage(
          state.systemMessage,
          authUser!
        )
      : database.systemMessages.updateMessage(
          state.systemMessage.uid,
          state.systemMessage,
          authUser!
        );

    savePromise
      .then(() => {
        navigate(ROUTES.SYSTEM_SYSTEM_MESSAGES, {
          state: {
            snackbar: {
              open: true,
              severity: "success",
              message: TEXT_SYSTEM_MESSAGE_SAVED,
            },
          },
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  };
  /* ------------------------------------------
  // Snackbar-Handler
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  const pageTitle = isNewMode ? TEXT_NEW_SYSTEM_MESSAGE : TEXT_EDIT_SYSTEM_MESSAGE;

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={pageTitle}
        subTitle={TEXT_ATENTION_IMPORTANT_ANNOUNCEMENT}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error!}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          )}

          <SystemMessageForm
            systemMessage={state.systemMessage}
            onFieldChange={onFieldChange}
            onChangeType={onChangeType}
            onDatePickerUpdate={onValidToChange}
            onSystemMessageTextChange={onSystemMessageTextChange}
            onSave={onSave}
          />
          <Typography variant="h5">{TEXT_PREVIEW}</Typography>
          <br />
          <AlertSystemMessage systemMessage={state.systemMessage} />
          <CustomSnackbar
            message={state.snackbar.message}
            severity={state.snackbar.severity}
            snackbarOpen={state.snackbar.open}
            handleClose={handleSnackbarClose}
          />
        </Stack>
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ========================== Meldungseditor =========================
// =================================================================== */

interface SystemMessageFormProps {
  systemMessage: SystemMessageDomain;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeType: (event: SelectChangeEvent) => void;
  onDatePickerUpdate: (date: Date | null) => void;
  onSystemMessageTextChange: (value: string) => void;
  onSave: () => void;
}
const SystemMessageForm = ({
  systemMessage,
  onFieldChange,
  onChangeType,
  onDatePickerUpdate,
  onSystemMessageTextChange,
  onSave,
}: SystemMessageFormProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  return (
    <Card sx={[classes.card, {marginBottom: theme.spacing(2)}]}>
      <CardHeader title={TEXT_EDITOR} />
      <CardContent>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel id="select-label-type">{TEXT_TYPE}</InputLabel>
            <Select
              labelId="select-label-type"
              id="select-role"
              value={systemMessage.type}
              label={TEXT_TYPE}
              onChange={onChangeType}
            >
              <MenuItem value={"success"}>success</MenuItem>
              <MenuItem value={"info"}>info</MenuItem>
              <MenuItem value={"warning"}>warning</MenuItem>
              <MenuItem value={"error"}>error</MenuItem>
            </Select>
          </FormControl>
          <TextField
            value={systemMessage.title}
            fullWidth
            id="title"
            label={TEXT_TITLE}
            onChange={onFieldChange}
            variant="outlined"
          />
          {/* validto */}
          <DatePicker
            key={"validto"}
            label={TEXT_VALID_TO}
            format="dd.MM.yyyy"
            value={systemMessage.validTo}
            onChange={onDatePickerUpdate}
          />

          <ReactQuill
            theme="snow"
            onChange={onSystemMessageTextChange}
            value={systemMessage.text}
            style={{marginTop: theme.spacing(2)}}
          />
        </Stack>{" "}
      </CardContent>
      <CardActions>
        <Button color="primary" variant="outlined" onClick={onSave}>
          {TEXT_SAVE}
        </Button>
      </CardActions>
    </Card>
  );
};

/* ===================================================================
// ============================ Vorschau =============================
// =================================================================== */
/**
 * Props für die Systemmeldungs-Vorschau.
 *
 * @param systemMessage - Meldungsobjekt mit title, text und type
 */
interface PreviewProps {
  systemMessage: {title: string; text: string; type: "success" | "info" | "warning" | "error"};
}

/**
 * Alert-Komponente zur Anzeige einer Systemmeldung.
 * Wird sowohl auf der Admin-Seite (Vorschau) als auch auf der Startseite verwendet.
 */
export const AlertSystemMessage = ({systemMessage}: PreviewProps) => {
  return (
    <Alert severity={systemMessage.type}>
      {systemMessage.title && <AlertTitle>{systemMessage.title}</AlertTitle>}
      {/* HTML wird bereinigt um XSS-Angriffe zu verhindern */}
      <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(systemMessage.text)}} />
    </Alert>
  );
};

export default SystemMessagePage;
