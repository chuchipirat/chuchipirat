import React from "react";

import {
  MAILBOX as TEXT_MAILBOX,
  MONITOR as TEXT_MONITOR,
  OVERVIEW as TEXT_OVERVIEW,
  DELETE as TEXT_DELETE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
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
} from "../../constants/text";

import {OpenInNew as OpenInNewIcon} from "@mui/icons-material";

import PageTitle from "../Shared/pageTitle";

import Role from "../../constants/roles";
import useCustomStyles from "../../constants/styles";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
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

import AlertMessage from "../Shared/AlertMessage";
import SearchPanel from "../Shared/searchPanel";

import {FormListItem} from "../Shared/formListItem";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {useAuthUser} from "../Session/authUserContext";
import {useFirebase} from "../Firebase/firebaseContext";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import MailConsole, {
  MailLogEntry,
  MailLogOverviewStructure,
  MailProtocol,
} from "./mailConsole.class";
import {ImageRepository} from "../../constants/imageRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  MAILS_FETCH_INIT,
  MAILS_FETCH_SUCCESS,
  MAIL_FETCH_INIT,
  MAIL_FETCH_SUCCESS,
  MAIL_DELETING_INIT,
  MAIL_DELETING_SUCCESS,
  SNACKBAR_SET,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

enum TabValue {
  overview,
  delete,
}

type DispatchAction = {
  type: ReducerActions;
  payload: {[key: string]: any};
};

type State = {
  mailLog: MailLogEntry[];
  mailProtocols: {[key: MailProtocol["uid"]]: MailProtocol};
  error: Error | null;
  isLoading: boolean;
  isDeleting: boolean;
  snackbar: Snackbar;
};

const inititialState: State = {
  mailLog: [],
  mailProtocols: {},
  error: null,
  isLoading: false,
  isDeleting: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

const mailboxReducer = (state: State, action: DispatchAction): State => {
  // let tempUsers: State["users"] = [];
  // let index: number;
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
        mailLog: action.payload.value as MailLogEntry[],
      };
    case ReducerActions.MAIL_FETCH_INIT:
      return {...state, isLoading: true};
    case ReducerActions.MAIL_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        mailProtocols: {
          ...state.mailProtocols,
          [action.payload.uid]: action.payload,
        },
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
        snackbar: action.payload as Snackbar,
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
        error: action.payload as Error,
        isLoading: false,
      };
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
  }
};
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
interface MailProtocolDialogValues {
  selectedMailProtocoll: null | MailProtocol;
  open: boolean;
}
const OverviewMailboxPage = () => {
  const firebase = useFirebase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const theme = useTheme();

  const [state, dispatch] = React.useReducer(mailboxReducer, inititialState);
  const [tabValue, setTabValue] = React.useState(TabValue.overview);
  const [dialogValues, setDialogValues] =
    React.useState<MailProtocolDialogValues>({
      selectedMailProtocoll: null,
      open: false,
    });
  /* ------------------------------------------
	// Daten aus DB holen
	// ------------------------------------------ */
  React.useEffect(() => {
    dispatch({
      type: ReducerActions.MAILS_FETCH_INIT,
      payload: {},
    });

    MailConsole.getMailboxOverview({firebase: firebase})
      .then((result) => {
        dispatch({
          type: ReducerActions.MAILS_FETCH_SUCCESS,
          payload: {value: result},
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error,
        });
      });
  }, []);
  /* ------------------------------------------
	// Tab-Handler
	// ------------------------------------------ */
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  /* ------------------------------------------
  // User-Profil-PopUp-Handling
  // ------------------------------------------ */
  const onOpenDialog = async (maillogUid: MailLogEntry["uid"]) => {
    if (!maillogUid) {
      return;
    }

    // Prüfen ob wir dieses Mail bereits gelesen haben.
    if (
      !Object.prototype.hasOwnProperty.call(state.mailProtocols, maillogUid)
    ) {
      dispatch({
        type: ReducerActions.MAIL_FETCH_INIT,
        payload: {},
      });
      await MailConsole.getSendProtocol({
        firebase: firebase,
        mailUid: maillogUid,
      }).then((result) => {
        dispatch({
          type: ReducerActions.MAIL_FETCH_SUCCESS,
          payload: result,
        });
        setDialogValues({selectedMailProtocoll: result, open: true});
      });
    } else {
      setDialogValues({
        selectedMailProtocoll: state.mailProtocols[maillogUid],
        open: true,
      });
    }
  };
  const onDialogClose = () => {
    setDialogValues({open: false, selectedMailProtocoll: null});
  };

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Handling Mails löschen
  // ------------------------------------------ */
  const onDeleteMails = (days: number) => {
    dispatch({type: ReducerActions.MAIL_DELETING_INIT, payload: {}});

    MailConsole.deleteMailProtocols({
      firebase: firebase,
      authUser: authUser,
      dayOffset: days,
      mailLog: state.mailLog,
    }).then((result) => {
      dispatch({
        type: ReducerActions.MAIL_DELETING_SUCCESS,
        payload: {counter: result.counter, mailLog: result.mailLog},
      });
    });
  };
  /* ------------------------------------------
  // Snackbar
  // ------------------------------------------ */
  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({
      type: ReducerActions.SNACKBAR_CLOSE,
      payload: {},
    });
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={`${TEXT_MAILBOX} ${TEXT_MONITOR}`} />

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
            dbMaillog={state.mailLog}
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
      {dialogValues.selectedMailProtocoll !== null && (
        <DialogMailProtocol
          dialogOpen={dialogValues.open}
          handleClose={onDialogClose}
          mailProtocol={dialogValues.selectedMailProtocoll}
        />
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ========================== Mail-Log Panel =========================
// =================================================================== */
interface MaillogTableProps {
  dbMaillog: MailLogEntry[];
  onMailLogSelect: (mailUid: MailLogEntry["uid"]) => void;
}

const MaillogTable = ({dbMaillog, onMailLogSelect}: MaillogTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [maillog, setMaillog] = React.useState<MailLogOverviewStructure[]>([]);

  const [filteredMaillogUi, setFilteredMaillogUi] = React.useState<
    MailLogOverviewStructure[]
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
            aria-label="open User"
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
      field: "uid",
      headerName: TEXT_UID,
      editable: false,
      width: 200,
      cellClassName: () => `super-app ${classes.typographyCode}`,
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
      width: 250,
    },
    {
      field: "timestamp",
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
    setFilteredMaillogUi(filterMaillog(maillog, ""));
  };
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value);
    setFilteredMaillogUi(filterMaillog(maillog, event.target.value as string));
  };
  /* ------------------------------------------
  // Filter-Logik
  // ------------------------------------------ */
  const filterMaillog = (
    maillog: MailLogOverviewStructure[],
    searchString: string,
  ) => {
    let filteredMaillog: MailLogOverviewStructure[] = [];
    if (searchString) {
      searchString = searchString.toLowerCase();
      filteredMaillog = maillog.filter(
        (mail) =>
          mail.uid!.toLocaleLowerCase().includes(searchString) ||
          mail.recipients.toLowerCase().includes(searchString) ||
          mail.templateName.toLowerCase().includes(searchString),
      );
    } else {
      filteredMaillog = maillog;
    }
    return filteredMaillog;
  };
  /* ------------------------------------------
  // Initiale Werte
  // ------------------------------------------ */
  if (dbMaillog.length > 0 && maillog.length === 0) {
    // Deep-Copy, damit der Cancel-Befehl wieder die DB-Daten zeigt,
    // werden die Daten hier für die Tabelle geklont.
    const maillogUiStructure: MailLogOverviewStructure[] = [];

    dbMaillog.forEach((mail) =>
      maillogUiStructure.push({
        uid: mail.uid,
        recipients: mail.recipients.join("; "),
        noRecipients: mail.noRecipients,
        templateName: mail.template.name,
        timestamp: mail.timestamp,
      }),
    );

    setMaillog(maillogUiStructure);
  }

  if (!searchString && maillog.length > 0 && filteredMaillogUi.length === 0) {
    // Initialer Aufbau
    setFilteredMaillogUi(filterMaillog(maillog, ""));
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
            {filteredMaillogUi.length == maillog.length
              ? `${maillog.length} ${TEXT_MAILS}`
              : `${filteredMaillogUi.length} ${TEXT_FROM.toLowerCase()} ${
                  maillog.length
                } ${TEXT_MAILS}`}
          </Typography>
          <Box component="div" style={{display: "flex", height: "100%"}}>
            <Box component="div" style={{flexGrow: 1}}>
              <DataGrid
                autoHeight
                rows={filteredMaillogUi}
                columns={DATA_GRID_COLUMNS}
                getRowId={(row) => row.uid}
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
  mailProtocol: MailProtocol;
  handleClose: () => void;
}
const DialogMailProtocol = ({
  dialogOpen,
  mailProtocol,
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
      <DialogTitle
        sx={classes.dialogHeaderWithPicture}
        style={{
          backgroundImage: `url(${
            mailProtocol.template.data?.headerPictureSrc
              ? mailProtocol.template.data?.headerPictureSrc
              : ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
          })`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={classes.dialogHeaderWithPictureTitle}
          style={{paddingLeft: "2ex"}}
        >
          {mailProtocol.template.name}
        </Typography>
      </DialogTitle>
      <DialogContent style={{overflow: "unset"}}>
        <Typography>{TEXT_RECIPIENTS}</Typography>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          {typeof mailProtocol.to === "string" ? (
            <FormListItem
              key={`recipient_to}`}
              id={"recipient_to"}
              value={mailProtocol.to}
              label={TEXT_RECIPIENT_TO}
            />
          ) : Array.isArray(mailProtocol.to) ? (
            mailProtocol.to.map((recipient) => (
              <FormListItem
                key={`recipient_to_${recipient}`}
                id={`recipient_to_${recipient}`}
                value={recipient}
                label={TEXT_RECIPIENT_TO}
              />
            ))
          ) : null}
          {typeof mailProtocol.bcc === "string" ? (
            <FormListItem
              key={`recipient_bbc}`}
              id={"recipient_bbc"}
              value={mailProtocol.bcc}
              label={TEXT_RECIPIENT_BBC}
            />
          ) : Array.isArray(mailProtocol.bcc) ? (
            mailProtocol.bcc.map((recipient) => (
              <FormListItem
                key={`recipient_to_${recipient}`}
                id={`recipient_to_${recipient}`}
                value={recipient}
                label={TEXT_RECIPIENT_BBC}
              />
            ))
          ) : null}
        </List>
        <Typography>{TEXT_MAIL_DATA}</Typography>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          {Object.entries(mailProtocol.template.data).map(([key, value]) => (
            <FormListItem key={key} id={key} value={value} label={key} />
          ))}
        </List>
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
