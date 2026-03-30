/**
 * MailConsolePage — Admin-Seite zum Versenden von Mails an Benutzer.
 *
 * Ermöglicht das Erstellen und Versenden von E-Mails über die
 * Supabase Edge Function `send-mail`. Die Empfänger können per
 * E-Mail-Adresse, UID oder Rolle selektiert werden.
 * Nach dem Versand wird der Vorgang im Mail-Log protokolliert.
 */
import React from "react";

import * as Sentry from "@sentry/react";
import DOMPurify from "dompurify";

import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {supabase} from "../Database/supabaseClient";
import {
  Alert,
  AlertTitle,
  Backdrop,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Card,
  CardHeader,
  Typography,
  TextField,
  Button,
  CardActions,
  Divider,
  useTheme,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Tooltip,
  IconButton,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import Grid from "@mui/material/Grid";

import {AlertMessage} from "../Shared/AlertMessage";
import {PageTitle} from "../Shared/pageTitle";
import {Utils} from "../Shared/utils.class";
import {SYSTEM_BREADCRUMB} from "./system";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  MAIL_CONSOLE as TEXT_MAIL_CONSOLE,
  BECAUSE_NEWSLETTER_ARE_ALWAYS_LOVED as TEXT_BECAUSE_NEWSLETTER_ARE_ALWAYS_LOVED,
  EDITOR as TEXT_EDITOR,
  SUBJECT as TEXT_SUBJECT,
  TITLE as TEXT_TITLE,
  SUB_TITLE as TEXT_SUB_TITLE,
  MAILTEXT as TEXT_MAILTEXT,
  DIVIDE_MULTIPLE_VALUES_BY_SEMICOLON as TEXT_DIVIDE_MULTIPLE_VALUES_BY_SEMICOLON,
  ROLE_TYPES as TEXT_ROLE_TYPES,
  PREVIEW as TEXT_PREVIEW,
  SEND_TEST_MAIL as TEXT_SEND_TEST_MAIL,
  BUTTON_TEXT as TEXT_BUTTON_TEXT,
  BUTTON_LINK as TEXT_BUTTON_LINK,
  MAIL_SEND_CONFIRMATION_TITLE as TEXT_MAIL_SEND_CONFIRMATION_TITLE,
  MAIL_SEND_CONFIRMATION_TEXT as TEXT_MAIL_SEND_CONFIRMATION_TEXT,
  MAIL_RECIPIENTS_DETECTED as TEXT_MAIL_RECIPIENTS_DETECTED,
  MAIL_SEND_TO_N_RECIPIENTS as TEXT_MAIL_SEND_TO_N_RECIPIENTS,
  MAIL_SEND_RESULT_TITLE as TEXT_MAIL_SEND_RESULT_TITLE,
  MAIL_SEND_RESULT_SUCCESS as TEXT_MAIL_SEND_RESULT_SUCCESS,
  MAIL_SEND_RESULT_ERRORS as TEXT_MAIL_SEND_RESULT_ERRORS,
  MAIL_TEMPLATE as TEXT_MAIL_TEMPLATE,
  MAIL_TEMPLATE_EMPTY as TEXT_MAIL_TEMPLATE_EMPTY,
  MAIL_TEMPLATE_MAINTENANCE as TEXT_MAIL_TEMPLATE_MAINTENANCE,
  MAIL_TEMPLATE_FEATURE as TEXT_MAIL_TEMPLATE_FEATURE,
  MAIL_TEMPLATE_EVENT as TEXT_MAIL_TEMPLATE_EVENT,
  MAIL_DRAFT_RESTORED as TEXT_MAIL_DRAFT_RESTORED,
  MAIL_DRAFT_CLEAR as TEXT_MAIL_DRAFT_CLEAR,
  MAIL_TRANSPORT_HELP as TEXT_MAIL_TRANSPORT_HELP,
  SEND as TEXT_SEND,
  MAIL_SEND_REQUIRES_TEST as TEXT_MAIL_SEND_REQUIRES_TEST,
} from "../../constants/text";
import {Role} from "../../constants/roles";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {CustomSnackbar,
  SNACKBAR_INITIAL_STATE_VALUES,
  SnackbarState,
} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";

/* ===================================================================
// ======================== Typen & Reducer ==========================
// =================================================================== */

/** Gewählter Mail-Transport (nur in DEV/TEST sichtbar). */
export type TransportOverride = "auto" | "brevo" | "smtp";

/** Anzeigetexte für die Transport-Optionen. */
const TRANSPORT_LABELS: Record<TransportOverride, string> = {
  auto: "Auto (Brevo > SMTP)",
  brevo: "Brevo",
  smtp: "SMTP / MailPit",
};

/** Empfängertyp für den Mail-Versand. */
export enum RecipientType {
  none = "none",
  email = "email",
  uid = "uid",
  role = "role",
}

/** Anzeigetexte für die Empfängertypen. */
const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  [RecipientType.none]: "keine",
  [RecipientType.email]: "E-Mail-Adresse",
  [RecipientType.uid]: "User-UID",
  [RecipientType.role]: "Rolle",
};

/** Datenstruktur für den Mail-Inhalt. */
export type MailObject = {
  subject: string;
  mailtext: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
};

/** Standardwerte für ein neues Mail-Objekt. */
const createInitialMailObject = (): MailObject => ({
  subject: "",
  mailtext: "",
  title: "",
  subtitle: "",
  buttonLink: "",
  buttonText: "",
});

/** Ergebnis eines Mail-Versands (von der Edge Function). */
type SendResult = {
  sent: number;
  failed: string[];
};

enum ReducerActions {
  RECIPIENT_UPDATE_TYPE = "RECIPIENT_UPDATE_TYPE",
  RECIPIENT_UPDATE_RECIPIENTS = "RECIPIENT_UPDATE_RECIPIENTS",
  MAIL_FIELD_UPDATE = "MAIL_FIELD_UPDATE",
  SEND_RESULT = "SEND_RESULT",
  SENDING = "SENDING",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
  GENERIC_ERROR = "GENERIC_ERROR",
  RESTORE_DRAFT = "RESTORE_DRAFT",
  CLEAR_DRAFT = "CLEAR_DRAFT",
}

/** Diskriminierte Union für Reducer-Actions. */
type DispatchAction =
  | {
      type: ReducerActions.MAIL_FIELD_UPDATE;
      payload: {field: keyof MailObject; value: string};
    }
  | {
      type: ReducerActions.RECIPIENT_UPDATE_TYPE;
      payload: {value: RecipientType};
    }
  | {
      type: ReducerActions.RECIPIENT_UPDATE_RECIPIENTS;
      payload: {value: string};
    }
  | {
      type: ReducerActions.SEND_RESULT;
      payload: {result: SendResult; isTest: boolean};
    }
  | {type: ReducerActions.SENDING}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: {error: Error}}
  | {
      type: ReducerActions.RESTORE_DRAFT;
      payload: {
        mailObject: MailObject;
        recipientType: RecipientType;
        recipients: string;
      };
    }
  | {type: ReducerActions.CLEAR_DRAFT};

type State = {
  mailObject: MailObject;
  recipientType: RecipientType;
  recipients: string;
  testMailSent: boolean;
  isLoading: boolean;
  error: Error | null;
  snackbar: SnackbarState;
  sendResult: SendResult | null;
};

const initialState: State = {
  mailObject: createInitialMailObject(),
  recipientType: RecipientType.none,
  recipients: "",
  testMailSent: false,
  isLoading: false,
  error: null,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
  sendResult: null,
};

const mailConsoleReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.MAIL_FIELD_UPDATE:
      return {
        ...state,
        mailObject: {
          ...state.mailObject,
          [action.payload.field]: action.payload.value,
        },
        testMailSent: false,
        sendResult: null,
      };
    case ReducerActions.RECIPIENT_UPDATE_TYPE:
      return {
        ...state,
        recipientType: action.payload.value,
        // Empfänger löschen, falls sich die Auswahl geändert hat
        recipients:
          state.recipientType !== action.payload.value ? "" : state.recipients,
        sendResult: null,
      };
    case ReducerActions.RECIPIENT_UPDATE_RECIPIENTS:
      return {
        ...state,
        recipients: action.payload.value,
        sendResult: null,
      };
    case ReducerActions.SENDING:
      return {
        ...state,
        isLoading: true,
        error: null,
        sendResult: null,
      };
    case ReducerActions.SEND_RESULT: {
      const {result, isTest} = action.payload;
      const allSucceeded = result.failed.length === 0;
      return {
        ...state,
        isLoading: false,
        testMailSent: isTest ? allSucceeded : state.testMailSent,
        sendResult: result,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    }
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload.error,
      };
    case ReducerActions.RESTORE_DRAFT:
      return {
        ...state,
        mailObject: action.payload.mailObject,
        recipientType: action.payload.recipientType,
        recipients: action.payload.recipients,
        snackbar: {
          open: true,
          message: TEXT_MAIL_DRAFT_RESTORED,
          severity: "info",
        },
      };
    case ReducerActions.CLEAR_DRAFT:
      return {
        ...initialState,
      };
    default:
      throw new Error("Unbekannter ActionType im mailConsoleReducer");
  }
};

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Parst die Empfänger-Eingabe in ein Array, getrennt durch Semikolon.
 *
 * @param recipients Rohtext mit Semikolon-getrennten Empfängern.
 * @returns Array bereinigter Empfänger-Strings.
 */
const parseRecipients = (recipients: string): string[] => {
  return recipients
    .split(";")
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0);
};

/** localStorage-Schlüssel für den Mail-Entwurf. */
const DRAFT_STORAGE_KEY = "chuchipirat_mail_draft";

/**
 * Speichert den aktuellen Entwurf in localStorage (debounced aufgerufen).
 *
 * @param mailObject Mail-Inhalte.
 * @param recipientType Gewählter Empfängertyp.
 * @param recipients Empfänger-String.
 */
const saveDraftToStorage = (
  mailObject: MailObject,
  recipientType: RecipientType,
  recipients: string,
) => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({mailObject, recipientType, recipients}),
    );
  } catch {
    // localStorage voll oder deaktiviert — ignorieren
  }
};

/**
 * Lädt einen gespeicherten Entwurf aus localStorage.
 *
 * @returns Entwurfsdaten oder null, falls kein Entwurf vorhanden.
 */
const loadDraftFromStorage = (): {
  mailObject: MailObject;
  recipientType: RecipientType;
  recipients: string;
} | null => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Löscht den gespeicherten Entwurf aus localStorage. */
const clearDraftFromStorage = () => {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignorieren
  }
};

/* ===================================================================
// ======================== Mail-Templates ===========================
// =================================================================== */

/** Vordefinierte Mail-Vorlagen für häufige Anwendungsfälle. */
type MailTemplate = {
  label: string;
  subject: string;
  title: string;
  subtitle: string;
};

const MAIL_TEMPLATES: MailTemplate[] = [
  {label: TEXT_MAIL_TEMPLATE_EMPTY, subject: "", title: "", subtitle: ""},
  {
    label: TEXT_MAIL_TEMPLATE_MAINTENANCE,
    subject: "Wartungsarbeiten am chuchipirat",
    title: "Geplante Wartungsarbeiten",
    subtitle: "Der chuchipirat ist vorübergehend nicht erreichbar.",
  },
  {
    label: TEXT_MAIL_TEMPLATE_FEATURE,
    subject: "Neues Feature im chuchipirat",
    title: "Neues Feature verfügbar",
    subtitle: "",
  },
  {
    label: TEXT_MAIL_TEMPLATE_EVENT,
    subject: "Erinnerung: Dein Event steht bevor",
    title: "Event-Erinnerung",
    subtitle: "",
  },
];

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für die Mail-Konsole.
 *
 * Versendet E-Mails über die Supabase Edge Function `send-mail`
 * und protokolliert den Versand im Mail-Log.
 */
const MailConsolePage = () => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(mailConsoleReducer, initialState);
  const [transportOverride, setTransportOverride] =
    React.useState<TransportOverride>("auto");
  const [roleCount, setRoleCount] = React.useState<number | null>(null);

  // Entwurf aus localStorage wiederherstellen (nur beim ersten Mount)
  React.useEffect(() => {
    const draft = loadDraftFromStorage();
    if (draft) {
      dispatch({type: ReducerActions.RESTORE_DRAFT, payload: draft});
    }
  }, []);

  // Rollenbasierte Empfängeranzahl laden, wenn eine Rolle gewählt wird
  React.useEffect(() => {
    if (
      state.recipientType !== RecipientType.role ||
      !state.recipients
    ) {
      setRoleCount(null);
      return;
    }

    let cancelled = false;
    database.users
      .countByRole(state.recipients as Role)
      .then((count) => {
        if (!cancelled) setRoleCount(count);
      })
      .catch((error) => {
        Sentry.captureException(error);
        if (!cancelled) setRoleCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [state.recipientType, state.recipients, database.users]);

  // Entwurf in localStorage speichern (debounced, 1 Sekunde)
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      // Nur speichern, wenn mindestens ein Feld befüllt ist
      const hasContent =
        state.mailObject.subject ||
        state.mailObject.title ||
        state.mailObject.mailtext ||
        state.recipients;
      if (hasContent) {
        saveDraftToStorage(
          state.mailObject,
          state.recipientType,
          state.recipients,
        );
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [state.mailObject, state.recipientType, state.recipients]);

  if (!authUser) {
    return null;
  }

  /** Anzahl der aktuellen Empfänger berechnen. */
  const getRecipientCount = (): number => {
    if (state.recipientType === RecipientType.role) {
      return roleCount ?? 0;
    }
    return parseRecipients(state.recipients).length;
  };

  /* ------------------------------------------
  // Mail über Edge Function versenden
  // ------------------------------------------ */
  const sendMail = async (
    recipients: string,
    recipientType: RecipientType,
    isTest: boolean,
  ) => {
    dispatch({type: ReducerActions.SENDING});

    const parsedRecipients = parseRecipients(recipients);

    try {
      const {data, error} = await supabase.functions.invoke("send-mail", {
        body: {
          recipients: parsedRecipients,
          recipientType: recipientType,
          subject: state.mailObject.subject,
          body: state.mailObject.mailtext,
          title: state.mailObject.title,
          subtitle: state.mailObject.subtitle,
          buttonText: state.mailObject.buttonText,
          buttonLink: state.mailObject.buttonLink,
          // Transport-Override nur senden, wenn nicht «Auto»
          ...(transportOverride !== "auto" && {
            forceTransport: transportOverride,
          }),
        },
      });

      if (error) {
        throw error;
      }

      // Ergebnis aus der Edge Function auswerten
      const sendResult: SendResult = {
        sent: data?.sent ?? parsedRecipients.length,
        failed: data?.failed ?? [],
      };

      // Mail-Log-Eintrag erstellen
      const allSucceeded = sendResult.failed.length === 0;
      await database.mailLog.create({
        recipients: parsedRecipients,
        recipientType: recipientType,
        subject: state.mailObject.subject,
        body: state.mailObject.mailtext,
        templateName: "newsletter",
        deliveryStatus: allSucceeded ? "success" : "error",
        errorMessage: allSucceeded ? null : sendResult.failed.join("; "),
        details: null,
      });

      dispatch({
        type: ReducerActions.SEND_RESULT,
        payload: {result: sendResult, isTest},
      });
    } catch (caughtError) {
      const sendError =
        caughtError instanceof Error
          ? caughtError
          : new Error(String(caughtError));

      Sentry.captureException(sendError);

      // Mail-Log-Eintrag mit Fehlerstatus erstellen
      try {
        await database.mailLog.create({
          recipients: parsedRecipients,
          recipientType: recipientType,
          subject: state.mailObject.subject,
          body: state.mailObject.mailtext,
          templateName: "newsletter",
          deliveryStatus: "error",
          errorMessage: sendError.message,
          details: null,
        });
      } catch (logError) {
        // Fehler beim Loggen nur an Sentry melden, nicht den Benutzer stören
        Sentry.captureException(logError);
      }

      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: {error: sendError},
      });
    }
  };

  /* ------------------------------------------
  // Field-Handler
  // ------------------------------------------ */
  const onEditorFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ReducerActions.MAIL_FIELD_UPDATE,
      payload: {
        field: event.target.id as keyof MailObject,
        value: event.target.value,
      },
    });
  };

  const onMailTextChange = (value: string) => {
    dispatch({
      type: ReducerActions.MAIL_FIELD_UPDATE,
      payload: {field: "mailtext", value: value},
    });
  };

  const onSendTestMail = () => {
    sendMail(authUser.uid, RecipientType.uid, true);
  };

  const onSendMail = async () => {
    const recipientCount = getRecipientCount();

    // Bestätigungsdialog vor dem Massenversand
    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      title: TEXT_MAIL_SEND_CONFIRMATION_TITLE,
      text: TEXT_MAIL_SEND_CONFIRMATION_TEXT(recipientCount),
      buttonTextConfirm: TEXT_SEND,
    });

    if (!isConfirmed) return;

    sendMail(state.recipients, state.recipientType, false);
  };

  const onClearDraft = () => {
    clearDraftFromStorage();
    dispatch({type: ReducerActions.CLEAR_DRAFT});
  };

  const onTemplateSelect = (template: MailTemplate) => {
    dispatch({
      type: ReducerActions.MAIL_FIELD_UPDATE,
      payload: {field: "subject", value: template.subject},
    });
    dispatch({
      type: ReducerActions.MAIL_FIELD_UPDATE,
      payload: {field: "title", value: template.title},
    });
    dispatch({
      type: ReducerActions.MAIL_FIELD_UPDATE,
      payload: {field: "subtitle", value: template.subtitle},
    });
  };

  /* ------------------------------------------
  // Snackbar-Handler
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  const recipientCount = getRecipientCount();

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_MAIL_CONSOLE}
        subTitle={TEXT_BECAUSE_NEWSLETTER_ARE_ALWAYS_LOVED}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {state.error && (
          <Grid size={12} key={"error"}>
            <AlertMessage
              error={state.error!}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          </Grid>
        )}

        <Grid container spacing={2}>
          {/* Empfänger — volle Breite */}
          <Grid size={12}>
            <MailRecipients
              selectedRecipientType={state.recipientType}
              recipients={state.recipients}
              recipientCount={recipientCount}
              onChangeRecipientType={(event) =>
                dispatch({
                  type: ReducerActions.RECIPIENT_UPDATE_TYPE,
                  payload: {value: event.target.value as RecipientType},
                })
              }
              onChangeRecipients={(event) => {
                dispatch({
                  type: ReducerActions.RECIPIENT_UPDATE_RECIPIENTS,
                  payload: {value: event.target.value},
                });
              }}
              onChangeRole={(event) => {
                dispatch({
                  type: ReducerActions.RECIPIENT_UPDATE_RECIPIENTS,
                  payload: {value: event.target.value},
                });
              }}
            />
          </Grid>

          {/* Versand-Ergebnis */}
          {state.sendResult && (
            <Grid size={12}>
              <SendResultCard sendResult={state.sendResult} />
            </Grid>
          )}

          {/* Editor + Preview — nebeneinander auf grossen Bildschirmen */}
          <Grid size={{xs: 12, lg: 6}}>
            <MailEditor
              mailObject={state.mailObject}
              onFieldChange={onEditorFieldChange}
              onMailTextChange={onMailTextChange}
              onSendTestMail={onSendTestMail}
              onSendMail={onSendMail}
              onClearDraft={onClearDraft}
              onTemplateSelect={onTemplateSelect}
              testMailSent={state.testMailSent}
              recipientCount={recipientCount}
            />
          </Grid>
          <Grid size={{xs: 12, lg: 6}}>
            <Preview mailObject={state.mailObject} />
          </Grid>

          {/* Transport-Toggle nur in DEV/TEST anzeigen */}
          {!Utils.isProductionEnvironment() && (
            <Grid size={12}>
              <TransportToggle
                value={transportOverride}
                onChange={setTransportOverride}
              />
            </Grid>
          )}
        </Grid>
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={handleSnackbarClose}
        />
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ======================== Versand-Ergebnis =========================
// =================================================================== */

/** Props für die Versand-Ergebnis-Komponente. */
type SendResultCardProps = {
  sendResult: SendResult;
};

/**
 * Inline-Karte mit dem Ergebnis des Mail-Versands.
 *
 * Zeigt Erfolgs-/Fehlermeldungen differenziert an:
 * Grün bei vollem Erfolg, Orange bei Teilerfolg, Rot bei totalem Fehlschlag.
 */
const SendResultCard = ({sendResult}: SendResultCardProps) => {
  const hasFailed = sendResult.failed.length > 0;
  const allFailed = sendResult.sent === 0 && hasFailed;
  const severity = allFailed ? "error" : hasFailed ? "warning" : "success";

  return (
    <Alert severity={severity}>
      <AlertTitle>{TEXT_MAIL_SEND_RESULT_TITLE}</AlertTitle>
      {sendResult.sent > 0 && (
        <Typography variant="body2">
          {TEXT_MAIL_SEND_RESULT_SUCCESS(sendResult.sent)}
        </Typography>
      )}
      {hasFailed && (
        <>
          <Typography variant="body2">
            {TEXT_MAIL_SEND_RESULT_ERRORS(sendResult.failed.length)}
          </Typography>
          {sendResult.failed.map((failureDetail, index) => (
            <Typography
              key={index}
              variant="caption"
              display="block"
              sx={{ml: 1}}
            >
              • {failureDetail}
            </Typography>
          ))}
        </>
      )}
    </Alert>
  );
};

/* ===================================================================
// ============================ Empfänger ============================
// =================================================================== */

/** Props für die Empfänger-Auswahl-Komponente. */
type MailRecipientsProps = {
  selectedRecipientType: RecipientType;
  recipients: State["recipients"];
  /** Berechnete Empfängeranzahl (für Rollen: aus DB, sonst: geparst). */
  recipientCount: number;
  onChangeRecipientType: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeRecipients: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeRole: (event: SelectChangeEvent) => void;
};

/**
 * Empfänger-Auswahl-Komponente.
 *
 * Ermöglicht die Auswahl zwischen E-Mail, UID oder Rolle als Empfängertyp.
 * Zeigt geparste Empfänger als Chips an und zählt die Empfänger.
 */
const MailRecipients = ({
  selectedRecipientType,
  recipients,
  recipientCount,
  onChangeRecipientType,
  onChangeRecipients,
  onChangeRole,
}: MailRecipientsProps) => {
  const classes = useCustomStyles();

  const ITEM_HEIGHT = 48;
  const ITEM_PADDING_TOP = 8;

  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };

  // Geparste Empfänger für die Chip-Anzeige
  const parsedChips =
    selectedRecipientType === RecipientType.role
      ? recipients
        ? [
            TEXT_ROLE_TYPES[recipients as keyof typeof TEXT_ROLE_TYPES] ||
              recipients,
          ]
        : []
      : selectedRecipientType !== RecipientType.none
        ? parseRecipients(recipients)
        : [];

  return (
    <Card>
      <CardHeader title={"Empfänger"} />
      <CardContent>
        <Grid container spacing={2}>
          <Grid size={12}>
            <FormControl component="fieldset">
              <RadioGroup
                aria-label="recipient_type"
                name="radios"
                value={selectedRecipientType}
                onChange={onChangeRecipientType}
              >
                <Grid container spacing={2}>
                  <Grid size={{xs: 5, sm: 3, md: 2}}>
                    <FormControlLabel
                      value={RecipientType.email}
                      control={<Radio />}
                      label={RECIPIENT_TYPE_LABELS[RecipientType.email]}
                    />
                  </Grid>
                  <Grid size={{xs: 7, sm: 9, md: 10}}>
                    <TextField
                      label={RECIPIENT_TYPE_LABELS[RecipientType.email]}
                      variant="outlined"
                      fullWidth
                      value={
                        selectedRecipientType === RecipientType.email
                          ? recipients
                          : ""
                      }
                      onChange={onChangeRecipients}
                      disabled={selectedRecipientType !== RecipientType.email}
                    />
                  </Grid>
                  <Grid size={{xs: 5, sm: 3, md: 2}}>
                    <FormControlLabel
                      value={RecipientType.uid}
                      control={<Radio />}
                      label={RECIPIENT_TYPE_LABELS[RecipientType.uid]}
                    />
                  </Grid>
                  <Grid size={{xs: 7, sm: 9, md: 10}}>
                    <TextField
                      label="recipient_uids"
                      variant="outlined"
                      fullWidth
                      value={
                        selectedRecipientType === RecipientType.uid
                          ? recipients
                          : ""
                      }
                      onChange={onChangeRecipients}
                      disabled={selectedRecipientType !== RecipientType.uid}
                    />
                  </Grid>
                  <Grid size={{xs: 5, sm: 3, md: 2}}>
                    <FormControlLabel
                      value={RecipientType.role}
                      control={<Radio />}
                      label={RECIPIENT_TYPE_LABELS[RecipientType.role]}
                    />
                  </Grid>
                  <Grid size={{xs: 7, sm: 9, md: 10}}>
                    <FormControl
                      variant="outlined"
                      sx={classes.formControl}
                      fullWidth
                    >
                      <InputLabel id="select-label-role">
                        {RECIPIENT_TYPE_LABELS[RecipientType.role]}
                      </InputLabel>
                      <Select
                        labelId="select-label-role"
                        id="select-role"
                        value={
                          selectedRecipientType === RecipientType.role
                            ? recipients
                            : ""
                        }
                        onChange={onChangeRole}
                        variant="outlined"
                        MenuProps={MenuProps}
                        fullWidth
                        disabled={selectedRecipientType !== RecipientType.role}
                      >
                        {Object.keys(Role).map((key) => (
                          <MenuItem key={key} value={key}>
                            {
                              TEXT_ROLE_TYPES[
                                key as keyof typeof TEXT_ROLE_TYPES
                              ]
                            }
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </RadioGroup>
            </FormControl>
          </Grid>
          <Grid size={12}>
            <Typography color="textSecondary">
              {TEXT_DIVIDE_MULTIPLE_VALUES_BY_SEMICOLON}
            </Typography>
          </Grid>

          {/* Chip-Vorschau der geparsten Empfänger */}
          {parsedChips.length > 0 && (
            <Grid size={12}>
              <Box sx={{display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1}}>
                {parsedChips.map((chip, index) => (
                  <Chip key={index} label={chip} size="small" />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {TEXT_MAIL_RECIPIENTS_DETECTED(recipientCount)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// =========================== Mail Editor ===========================
// =================================================================== */

/** Props für die Mail-Editor-Komponente. */
type MailEditorProps = {
  mailObject: MailObject;
  testMailSent: State["testMailSent"];
  recipientCount: number;
  onFieldChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMailTextChange: (value: string) => void;
  onSendTestMail: () => void;
  onSendMail: () => void;
  onClearDraft: () => void;
  onTemplateSelect: (template: MailTemplate) => void;
};

/**
 * Mail-Editor-Komponente.
 *
 * Enthält Felder für Betreff, Titel, Untertitel, Mailtext
 * (Rich-Text via ReactQuill), Button-Text und Button-Link.
 * Bietet Vorlagenauswahl und Entwurf-Verwaltung.
 */
const MailEditor = ({
  mailObject,
  testMailSent,
  recipientCount,
  onFieldChange,
  onMailTextChange,
  onSendMail,
  onSendTestMail: onSendTestMailSuper,
  onClearDraft,
  onTemplateSelect,
}: MailEditorProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const [formValidation, setFormValidation] = React.useState({
    subject: false,
    mailtext: false,
    title: false,
  });

  const onSendTestMail = () => {
    const tempFormValidation = {...formValidation};
    // Überprüfen der Eingabe
    tempFormValidation.subject = !mailObject.subject;
    tempFormValidation.mailtext = !mailObject.mailtext;
    tempFormValidation.title = !mailObject.title;

    if (Object.values(tempFormValidation).some((value) => value === true)) {
      setFormValidation(tempFormValidation);
    } else {
      onSendTestMailSuper();
    }
  };

  return (
    <Card sx={classes.card}>
      <CardHeader title={TEXT_EDITOR} />
      <CardContent>
        <Grid container spacing={2}>
          {/* Vorlagen-Auswahl */}
          <Grid size={12}>
            <TemplateSelector onSelect={onTemplateSelect} />
          </Grid>
          <Grid size={12}>
            <TextField
              id="subject"
              key="subject"
              variant="outlined"
              fullWidth
              onChange={onFieldChange}
              value={mailObject.subject}
              label={TEXT_SUBJECT}
              required
              error={formValidation.subject}
            />
          </Grid>
          <Grid size={12}>
            <Divider style={{margin: theme.spacing(2)}} />
          </Grid>
          <Grid size={12}>
            <TextField
              id="title"
              key="title"
              variant="outlined"
              fullWidth
              onChange={onFieldChange}
              value={mailObject.title}
              label={TEXT_TITLE}
              required
              error={formValidation.title}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              id="subtitle"
              key="subtitle"
              variant="outlined"
              fullWidth
              value={mailObject.subtitle}
              onChange={onFieldChange}
              label={TEXT_SUB_TITLE}
            />
          </Grid>
          <Grid size={12}>
            <Typography
              color={formValidation.mailtext ? "error" : "textSecondary"}
            >
              {TEXT_MAILTEXT}
            </Typography>
            <ReactQuill theme="snow" onChange={onMailTextChange} />
          </Grid>
          <Grid size={12}>
            <TextField
              id="buttonText"
              key="buttonText"
              variant="outlined"
              fullWidth
              value={mailObject.buttonText}
              onChange={onFieldChange}
              label={TEXT_BUTTON_TEXT}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              id="buttonLink"
              key="buttonLink"
              variant="outlined"
              fullWidth
              value={mailObject.buttonLink}
              onChange={onFieldChange}
              label={TEXT_BUTTON_LINK}
            />
          </Grid>
        </Grid>
      </CardContent>
      <CardActions sx={classes.cardActionRight}>
        <Button
          color="inherit"
          variant="text"
          onClick={onClearDraft}
          startIcon={<DeleteOutlineIcon />}
          size="small"
        >
          {TEXT_MAIL_DRAFT_CLEAR}
        </Button>
        <Button color="primary" variant="outlined" onClick={onSendTestMail}>
          {TEXT_SEND_TEST_MAIL}
        </Button>
        <Tooltip
          title={!testMailSent ? TEXT_MAIL_SEND_REQUIRES_TEST : ""}
          arrow
        >
          {/* span nötig, weil MUI Tooltip auf disabled Buttons nicht funktioniert */}
          <span>
            <Button
              color="primary"
              variant="contained"
              disabled={!testMailSent}
              onClick={onSendMail}
            >
              {TEXT_MAIL_SEND_TO_N_RECIPIENTS(recipientCount)}
            </Button>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
};

/* ===================================================================
// ======================== Vorlagen-Auswahl =========================
// =================================================================== */

/** Props für die Vorlagen-Auswahl. */
type TemplateSelectorProps = {
  onSelect: (template: MailTemplate) => void;
};

/**
 * Dropdown-Auswahl für vordefinierte Mail-Vorlagen.
 *
 * Beim Wechsel werden Betreff, Titel und Untertitel vorausgefüllt.
 */
const TemplateSelector = ({onSelect}: TemplateSelectorProps) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const handleChange = (event: SelectChangeEvent<number>) => {
    const index = Number(event.target.value);
    setSelectedIndex(index);
    onSelect(MAIL_TEMPLATES[index]);
  };

  return (
    <FormControl fullWidth>
      <InputLabel id="template-select-label">{TEXT_MAIL_TEMPLATE}</InputLabel>
      <Select
        labelId="template-select-label"
        id="template-select"
        value={selectedIndex}
        label={TEXT_MAIL_TEMPLATE}
        onChange={handleChange}
      >
        {MAIL_TEMPLATES.map((template, index) => (
          <MenuItem key={index} value={index}>
            {template.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

/* ===================================================================
// ======================== Transport-Toggle =========================
// =================================================================== */

/** Props für die Transport-Toggle-Komponente. */
type TransportToggleProps = {
  value: TransportOverride;
  onChange: (value: TransportOverride) => void;
};

/**
 * Transport-Auswahl für den Mail-Versand (nur DEV/TEST).
 *
 * Ermöglicht die manuelle Auswahl zwischen Auto, Brevo und SMTP,
 * um den Mail-Transport im Entwicklungsmodus zu testen.
 */
const TransportToggle = ({value, onChange}: TransportToggleProps) => {
  return (
    <Card>
      <CardHeader
        title="Mail-Transport"
        subheader="Nur in DEV/TEST sichtbar"
        action={
          <Tooltip title={TEXT_MAIL_TRANSPORT_HELP}>
            <IconButton size="small">
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <FormControl component="fieldset">
          <RadioGroup
            row
            aria-label="mail_transport"
            value={value}
            onChange={(event) =>
              onChange(event.target.value as TransportOverride)
            }
          >
            {(Object.keys(TRANSPORT_LABELS) as TransportOverride[]).map(
              (key) => (
                <FormControlLabel
                  key={key}
                  value={key}
                  control={<Radio />}
                  label={TRANSPORT_LABELS[key]}
                />
              ),
            )}
          </RadioGroup>
        </FormControl>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ============================ Vorschau =============================
// =================================================================== */

/** Props für die Vorschau-Komponente. */
type PreviewProps = {
  mailObject: MailObject;
};

/**
 * Vorschau-Komponente für die E-Mail.
 *
 * Zeigt eine Vorschau mit Titel, Untertitel,
 * bereinigtem HTML-Inhalt und optionalem Button.
 * Das Header-Bild (Logo) ist im Template fix hinterlegt.
 */
const Preview = ({mailObject}: PreviewProps) => {
  return (
    <Card>
      <CardHeader title={TEXT_PREVIEW} />
      {/* Teal-Banner analog zum E-Mail-Template */}
      <Box
        sx={{
          backgroundColor: "#006064",
          textAlign: "center",
          py: 3,
          px: 5,
        }}
      >
        <Typography variant="h5" sx={{color: "#fff", fontWeight: 600}}>
          chuchipirat
        </Typography>
      </Box>
      <CardContent>
        <Grid container spacing={2}>
          {mailObject.title && (
            <Grid size={12}>
              <Typography variant="h5" fontWeight="bold">
                {mailObject.title}
              </Typography>
            </Grid>
          )}
          {mailObject.subtitle && (
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary">
                {mailObject.subtitle}
              </Typography>
            </Grid>
          )}
          <Grid size={12}>
            <Typography
              variant="body1"
              component="div"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(mailObject.mailtext),
              }}
            />
          </Grid>
          {mailObject.buttonLink && mailObject.buttonText && (
            <Grid
              size={12}
              alignContent="center"
              justifyContent="center"
              style={{display: "flex"}}
            >
              <Button
                color="primary"
                variant="contained"
                target="_blank"
                href={mailObject.buttonLink}
                sx={{
                  backgroundColor: "#006064",
                  "&:hover": {backgroundColor: "#00838f"},
                }}
              >
                {mailObject.buttonText}
              </Button>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default MailConsolePage;
