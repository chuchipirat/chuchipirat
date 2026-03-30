/**
 * Übersicht der versendeten E-Mails (Admin-Bereich).
 *
 * Zeigt eine tabellarische Auflistung aller Mail-Log-Einträge aus der
 * Supabase-Tabelle `mail_log`. Bietet eine Detail-Ansicht (Dialog) und
 * eine Lösch-Funktion für ältere Protokolle.
 */
import React from "react";
import * as Sentry from "@sentry/react";

import {
  MAILBOX as TEXT_MAILBOX,
  MONITOR as TEXT_MONITOR,
  OVERVIEW as TEXT_OVERVIEW,
  DELETE as TEXT_DELETE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  RECIPIENTS as TEXT_RECIPIENTS,
  NO_RECIPIENTS as TEXT_NO_RECIPIENTS,
  MAIL_TEMPLATE as TEXT_MAIL_TEMPLATE,
  TIMESTAMP as TEXT_TIMESTAMP,
  MAILS as TEXT_MAILS,
  RECIPIENT_TO as TEXT_RECIPIENT_TO,
  RECIPIENT_BCC as TEXT_RECIPIENT_BBC,
  MAIL_DATA as TEXT_MAIL_DATA,
  DELETE_MAIL_PROTOCOLS as TEXT_DELETE_MAIL_PROTOCOLS,
  DELETE_MAIL_PROTOCOLS_OLDER_THAN as TEXT_DELETE_MAIL_PROTOCOLS_OLDER_THAN,
  MAIL_PROTOCOLS as TEXT_MAIL_PROTOCOLS,
  FROM as TEXT_FROM,
  OPEN as TEXT_OPEN,
  MAIL_PROTOCOLS_DELETED as TEXT_MAIL_PROTOCOLS_DELETED,
  SUBJECT as TEXT_SUBJECT,
} from "../../constants/text";

import {OpenInNew as OpenInNewIcon} from "@mui/icons-material";

import {PageTitle} from "../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "./system";

import {useCustomStyles} from "../../constants/styles";
import {CustomSnackbar,
  SNACKBAR_INITIAL_STATE_VALUES,
  SnackbarState,
} from "../Shared/customSnackbar";
import {
  Backdrop,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Tab,
  Tabs,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  Typography,
  useTheme,
  LinearProgress,
  Button,
  TextField,
  Box,
  Stack,
} from "@mui/material";

import {AlertMessage} from "../Shared/AlertMessage";
import {SearchPanel} from "../Shared/searchPanel";

import {FormListItem} from "../Shared/formListItem";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import {useDatabase} from "../Database/DatabaseContext";
import {MailLogDomain} from "../Database/Repository/MailLogRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  MAILS_FETCH_INIT = "MAILS_FETCH_INIT",
  MAILS_FETCH_SUCCESS = "MAILS_FETCH_SUCCESS",
  MAIL_DELETING_INIT = "MAIL_DELETING_INIT",
  MAIL_DELETING_SUCCESS = "MAIL_DELETING_SUCCESS",
  SNACKBAR_SET = "SNACKBAR_SET",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
  GENERIC_ERROR = "GENERIC_ERROR",
}

enum TabValue {
  overview,
  delete,
}

/** Diskriminierte Union für Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.MAILS_FETCH_INIT}
  | {type: ReducerActions.MAILS_FETCH_SUCCESS; payload: MailLogDomain[]}
  | {type: ReducerActions.MAIL_DELETING_INIT}
  | {
      type: ReducerActions.MAIL_DELETING_SUCCESS;
      payload: {counter: number; mailLog: MailLogDomain[]};
    }
  | {type: ReducerActions.SNACKBAR_SET; payload: SnackbarState}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  mailLog: MailLogDomain[];
  error: Error | null;
  isLoading: boolean;
  isDeleting: boolean;
  snackbar: SnackbarState;
};

const initialState: State = {
  mailLog: [],
  error: null,
  isLoading: false,
  isDeleting: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

const mailboxReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.MAILS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.MAILS_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        mailLog: action.payload,
      };
    case ReducerActions.MAIL_DELETING_INIT:
      return {...state, isDeleting: true};
    case ReducerActions.MAIL_DELETING_SUCCESS:
      return {
        ...state,
        mailLog: action.payload.mailLog,
        isDeleting: false,
        snackbar: {
          severity: "success",
          message: `${action.payload.counter} ${TEXT_MAIL_PROTOCOLS_DELETED}`,
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_SET:
      return {
        ...state,
        snackbar: action.payload,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      // Snackbar schliessen
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    case ReducerActions.GENERIC_ERROR:
      // allgemeiner Fehler
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    default:
      throw new Error("Unbekannter ActionType");
  }
};
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
interface MailProtocolDialogValues {
  selectedMailLogEntry: null | MailLogDomain;
  open: boolean;
}

/**
 * Admin-Seite zur Anzeige und Verwaltung der versendeten E-Mails.
 *
 * Stellt eine Tabelle aller Mail-Log-Einträge dar, erlaubt die Detail-Ansicht
 * einzelner Einträge und das Löschen älterer Protokolle.
 */
const OverviewMailboxPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const theme = useTheme();

  const [state, dispatch] = React.useReducer(mailboxReducer, initialState);
  const [tabValue, setTabValue] = React.useState(TabValue.overview);
  const [dialogValues, setDialogValues] =
    React.useState<MailProtocolDialogValues>({
      selectedMailLogEntry: null,
      open: false,
    });
  /* ------------------------------------------
	// Daten aus DB holen
	// ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.MAILS_FETCH_INIT});

    database.mailLog
      .getAll()
      .then((result) => {
        dispatch({
          type: ReducerActions.MAILS_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error,
        });
      });
  }, []);
  /* ------------------------------------------
	// Tab-Handler
	// ------------------------------------------ */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  /* ------------------------------------------
  // Detail-Dialog-Handling
  // ------------------------------------------ */
  const onOpenDialog = (mailLogId: MailLogDomain["id"]) => {
    if (!mailLogId) {
      return;
    }

    // Eintrag aus dem bereits geladenen State suchen
    const entry = state.mailLog.find((mail) => mail.id === mailLogId);
    if (entry) {
      setDialogValues({selectedMailLogEntry: entry, open: true});
    }
  };
  const onDialogClose = () => {
    setDialogValues({open: false, selectedMailLogEntry: null});
  };

  /* ------------------------------------------
  // Handling Mails löschen
  // ------------------------------------------ */
  const onDeleteMails = async (days: number) => {
    dispatch({type: ReducerActions.MAIL_DELETING_INIT});

    // Datum berechnen, das «days» Tage in der Vergangenheit liegt
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const deletedCount = await database.mailLog.deleteOlderThan(cutoffDate);

      // Lokale Liste filtern – Einträge behalten, die neuer als cutoffDate sind
      const remainingMailLog = state.mailLog.filter(
        (mail) => mail.sentAt >= cutoffDate,
      );

      dispatch({
        type: ReducerActions.MAIL_DELETING_SUCCESS,
        payload: {counter: deletedCount, mailLog: remainingMailLog},
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };
  /* ------------------------------------------
  // Snackbar
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
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={`${TEXT_MAILBOX} ${TEXT_MONITOR}`} breadcrumbs={[SYSTEM_BREADCRUMB]} />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        {state.error && (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          centered
          style={{marginBottom: theme.spacing(2)}}
        >
          <Tab label={TEXT_OVERVIEW} />
          <Tab label={TEXT_DELETE} />
        </Tabs>
        {tabValue === TabValue.overview && (
          <MaillogTable
            mailLog={state.mailLog}
            onMailLogSelect={onOpenDialog}
          />
        )}
        {tabValue === TabValue.delete && (
          <Container sx={classes.container} component="main" maxWidth="sm">
            <DeleteMailsPanel
              onDelete={onDeleteMails}
              isDeleting={state.isDeleting}
            />
          </Container>
        )}
      </Container>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
      {dialogValues.selectedMailLogEntry !== null && (
        <DialogMailProtocol
          dialogOpen={dialogValues.open}
          handleClose={onDialogClose}
          mailLogEntry={dialogValues.selectedMailLogEntry}
        />
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ========================== Mail-Log Panel =========================
// =================================================================== */

/** Darstellungstyp für eine Zeile in der DataGrid-Tabelle. */
type MailLogTableRow = {
  id: string;
  subject: string;
  recipients: string;
  noRecipients: number;
  templateName: string;
  sentAt: Date;
  deliveryStatus: string;
};

interface MaillogTableProps {
  mailLog: MailLogDomain[];
  onMailLogSelect: (mailId: MailLogDomain["id"]) => void;
}

/**
 * Tabelle mit allen Mail-Log-Einträgen.
 *
 * Zeigt eine durchsuchbare DataGrid-Ansicht der Mail-Log-Einträge.
 *
 * @param mailLog Array der Mail-Log-Domain-Objekte.
 * @param onMailLogSelect Callback, wenn ein Eintrag geöffnet wird.
 */
const MaillogTable = ({mailLog, onMailLogSelect}: MaillogTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [tableRows, setTableRows] = React.useState<MailLogTableRow[]>([]);
  const [filteredTableRows, setFilteredTableRows] = React.useState<
    MailLogTableRow[]
  >([]);
  const classes = useCustomStyles();
  const theme = useTheme();

  const DATA_GRID_COLUMNS: GridColDef[] = [
    {
      field: "open",
      headerName: TEXT_OPEN,
      sortable: false,
      renderCell: (params) => {
        const onClick = () => {
          onMailLogSelect(params.id as string);
        };

        return (
          <IconButton
            aria-label="open Mail"
            style={{margin: theme.spacing(1)}}
            size="small"
            onClick={onClick}
          >
            <OpenInNewIcon fontSize="inherit" />
          </IconButton>
        );
      },
    },
    {
      field: "subject",
      headerName: TEXT_SUBJECT,
      editable: false,
      width: 250,
    },
    {
      field: "recipients",
      headerName: TEXT_RECIPIENTS,
      editable: false,
      width: 250,
    },
    {
      field: "noRecipients",
      headerName: TEXT_NO_RECIPIENTS,
      editable: false,
      width: 150,
    },
    {
      field: "templateName",
      headerName: TEXT_MAIL_TEMPLATE,
      editable: false,
      width: 200,
    },
    {
      field: "deliveryStatus",
      headerName: "Status",
      editable: false,
      width: 100,
    },
    {
      field: "sentAt",
      headerName: TEXT_TIMESTAMP,
      editable: false,
      width: 200,
      valueFormatter: (value) => {
        if (value && value instanceof Date) {
          return value.toLocaleString("de-CH", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } else {
          return "";
        }
      },
    },
  ];

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const clearSearchString = () => {
    setSearchString("");
    setFilteredTableRows(filterMaillog(tableRows, ""));
  };
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value);
    setFilteredTableRows(
      filterMaillog(tableRows, event.target.value as string),
    );
  };
  /* ------------------------------------------
  // Filter-Logik
  // ------------------------------------------ */
  const filterMaillog = (
    rows: MailLogTableRow[],
    search: string,
  ): MailLogTableRow[] => {
    if (!search) {
      return rows;
    }
    const lowerSearch = search.toLowerCase();
    return rows.filter(
      (row) =>
        row.subject.toLowerCase().includes(lowerSearch) ||
        row.recipients.toLowerCase().includes(lowerSearch) ||
        row.templateName.toLowerCase().includes(lowerSearch),
    );
  };
  /* ------------------------------------------
  // Initiale Werte
  // ------------------------------------------ */
  if (mailLog.length > 0 && tableRows.length === 0) {
    // Domain-Objekte in Tabellenzeilen umwandeln
    const rows: MailLogTableRow[] = mailLog.map((mail) => ({
      id: mail.id,
      subject: mail.subject,
      recipients: mail.recipients.join("; "),
      noRecipients: mail.recipients.length,
      templateName: mail.templateName ?? "",
      sentAt: mail.sentAt,
      deliveryStatus: mail.deliveryStatus,
    }));

    setTableRows(rows);
  }

  if (!searchString && tableRows.length > 0 && filteredTableRows.length === 0) {
    // Initialer Aufbau
    setFilteredTableRows(filterMaillog(tableRows, ""));
  }

  return (
    <Card
      sx={classes.card}
      key={"requestTablePanel"}
      style={{marginBottom: "4em"}}
    >
      <CardContent sx={classes.cardContent} key={"requestTableContent"}>
        <Stack spacing={2}>
          <SearchPanel
            searchString={searchString}
            onUpdateSearchString={updateSearchString}
            onClearSearchString={clearSearchString}
          />
          <Typography
            variant="body2"
            style={{marginTop: "0.5em", marginBottom: "2em"}}
          >
            {filteredTableRows.length == tableRows.length
              ? `${tableRows.length} ${TEXT_MAILS}`
              : `${filteredTableRows.length} ${TEXT_FROM.toLowerCase()} ${
                  tableRows.length
                } ${TEXT_MAILS}`}
          </Typography>
          <Box component="div" style={{display: "flex", height: "100%"}}>
            <Box component="div" style={{flexGrow: 1}}>
              <DataGrid
                autoHeight
                rows={filteredTableRows}
                columns={DATA_GRID_COLUMNS}
                getRowId={(row) => row.id}
                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                getRowClassName={(params) => {
                  if (params.row?.disabled) {
                    return `super-app ${classes.dataGridDisabled}`;
                  } else {
                    return `super-app-theme`;
                  }
                }}
              />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ========================= Dialog-Protokoll ========================
// =================================================================== */
interface DialogMailProtocolProps {
  dialogOpen: boolean;
  mailLogEntry: MailLogDomain;
  handleClose: () => void;
}

/**
 * Dialog zur Detailansicht eines einzelnen Mail-Log-Eintrags.
 *
 * @param dialogOpen Ob der Dialog geöffnet ist.
 * @param mailLogEntry Der anzuzeigende Mail-Log-Eintrag.
 * @param handleClose Callback zum Schliessen des Dialogs.
 */
const DialogMailProtocol = ({
  dialogOpen,
  mailLogEntry,
  handleClose,
}: DialogMailProtocolProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialog mailprotocol"
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle sx={classes.dialogHeaderWithPicture}>
        <Typography
          variant="h4"
          component="h1"
          sx={classes.dialogHeaderWithPictureTitle}
          style={{paddingLeft: "2ex"}}
        >
          {mailLogEntry.templateName ?? mailLogEntry.subject}
        </Typography>
      </DialogTitle>
      <DialogContent style={{overflow: "unset"}}>
        <Typography>{TEXT_SUBJECT}</Typography>
        <Typography variant="body2" style={{marginBottom: theme.spacing(2)}}>
          {mailLogEntry.subject}
        </Typography>

        <Typography>{TEXT_RECIPIENTS}</Typography>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          {mailLogEntry.recipients.map((recipient) => (
            <FormListItem
              key={`recipient_${recipient}`}
              id={`recipient_${recipient}`}
              value={recipient}
              label={TEXT_RECIPIENT_TO}
            />
          ))}
        </List>

        {mailLogEntry.details &&
          Object.keys(mailLogEntry.details).length > 0 && (
            <React.Fragment>
              <Typography>{TEXT_MAIL_DATA}</Typography>
              <List dense style={{marginBottom: theme.spacing(2)}}>
                {Object.entries(mailLogEntry.details).map(([key, value]) => (
                  <FormListItem
                    key={key}
                    id={key}
                    value={String(value)}
                    label={key}
                  />
                ))}
              </List>
            </React.Fragment>
          )}

        {mailLogEntry.errorMessage && (
          <React.Fragment>
            <Typography color="error">Fehler</Typography>
            <Typography variant="body2" color="error">
              {mailLogEntry.errorMessage}
            </Typography>
          </React.Fragment>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ===================================================================
// =========================== Mails löschen =========================
// =================================================================== */
interface DeleteMailsPanelProps {
  isDeleting: boolean;
  onDelete: (days: number) => void;
}

/**
 * Panel zum Löschen älterer Mail-Protokolle.
 *
 * @param isDeleting Ob gerade ein Löschvorgang läuft.
 * @param onDelete Callback mit der Anzahl Tage als Offset.
 */
const DeleteMailsPanel = ({isDeleting, onDelete}: DeleteMailsPanelProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const [daysOffset, setDaysOffset] = React.useState(180);

  const onChangeDayOffset = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDaysOffset(parseInt(event.target.value));
  };

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_DELETE_MAIL_PROTOCOLS}
        </Typography>

        <TextField
          id={"daysOffset"}
          key={"daysOffset"}
          type="number"
          InputProps={{inputProps: {min: 100}}}
          label={TEXT_DELETE_MAIL_PROTOCOLS_OLDER_THAN}
          name={"daysOffset"}
          required
          value={daysOffset}
          onChange={onChangeDayOffset}
          fullWidth
          InputLabelProps={{
            shrink: true,
          }}
        />
        {isDeleting && (
          <React.Fragment>
            <br />
            <LinearProgress style={{marginTop: theme.spacing(1)}} />
          </React.Fragment>
        )}
        <Button
          fullWidth
          disabled={!daysOffset}
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={() => onDelete(daysOffset)}
        >
          {`${TEXT_MAIL_PROTOCOLS} ${TEXT_DELETE}`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OverviewMailboxPage;
