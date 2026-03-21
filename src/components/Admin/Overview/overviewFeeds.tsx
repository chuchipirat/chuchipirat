import React from "react";

import {
  MONITOR as TEXT_MONITOR,
  OVERVIEW as TEXT_OVERVIEW,
  DELETE as TEXT_DELETE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
  DATE as TEXT_DATE,
  FEEDS as TEXT_FEEDS,
  DELETE_FEEDS as TEXT_DELETE_FEEDS,
  DELETE_FEEDS_OLDER_THAN as TEXT_DELETE_FEEDS_OLDER_THAN,
  FEED_ENTRIES as TEXT_FEED_ENTRIES,
  FROM as TEXT_FROM,
  OPEN as TEXT_OPEN,
  X_FEEDS_DELETED as TEXT_X_FEEDS_DELETED,
  TITLE as TEXT_TITLE,
  TYPE as TEXT_TYPE,
  VISIBILITY as TEXT_VISIBILITY,
  ATTENTION as TEXT_ATTENTION,
  SHOULD_FEED_ENTRY_BE_DELETED as TEXT_SHOULD_FEED_ENTRY_BE_DELETED,
  CLOSE as TEXT_CLOSE,
} from "../../../constants/text";

import {OpenInNew as OpenInNewIcon} from "@mui/icons-material";

import PageTitle from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";

import useCustomStyles from "../../../constants/styles";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
} from "../../Shared/customSnackbar";
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
  DialogActions,
  Box,
  Stack,
} from "@mui/material";

import AlertMessage from "../../Shared/AlertMessage";
import SearchPanel from "../../Shared/searchPanel";

import {FormListItem} from "../../Shared/formListItem";
import {useAuthUser} from "../../Session/authUserContext";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import {FeedDomain} from "../../Database/Repository/FeedRepository";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useDatabase} from "../../Database/DatabaseContext";
import * as Sentry from "@sentry/browser";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/** Aktionen für den feedsOverviewReducer. */
enum ReducerActions {
  FEEDS_FETCH_INIT,
  FEEDS_FETCH_SUCCESS,
  FEED_DELETING_INIT,
  FEED_DELETING_SUCCESS,
  SNACKBAR_SET,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

/** Tab-Auswahl für die Feed-Übersichtsseite. */
enum TabValue {
  overview,
  delete,
}

/**
 * Abgeleitete Struktur für die DataGrid-Darstellung eines Feed-Eintrags.
 */
interface FeedOverviewStructure {
  uid: string;
  title: string;
  text: string;
  type: string;
  visibility: string;
  createdDate: Date;
  userDisplayName: string;
}

/**
 * Discriminated Union für alle Reducer-Aktionen.
 * Sorgt für typsichere Payloads ohne `as`-Casts.
 */
type DispatchAction =
  | {type: ReducerActions.FEEDS_FETCH_INIT}
  | {type: ReducerActions.FEEDS_FETCH_SUCCESS; payload: FeedDomain[]}
  | {type: ReducerActions.FEED_DELETING_INIT}
  | {
      type: ReducerActions.FEED_DELETING_SUCCESS;
      payload: {feeds: FeedDomain[]; counter: number};
    }
  | {type: ReducerActions.SNACKBAR_SET; payload: Snackbar}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/** Zustand der Feed-Übersichtsseite. */
type State = {
  feeds: FeedDomain[];
  error: Error | null;
  isLoading: boolean;
  isDeleting: boolean;
  snackbar: Snackbar;
};

const initialState: State = {
  feeds: [],
  error: null,
  isLoading: false,
  isDeleting: false,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

/** Datumsformat-Optionen für die Darstellung im DataGrid und in Suchfiltern. */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * Reducer für die Feed-Übersichtsseite.
 * Verwaltet Lade-, Lösch- und Fehlerzustände.
 *
 * @param state Aktueller Zustand.
 * @param action Discriminated-Union-Aktion.
 * @returns Neuer Zustand.
 */
const feedsOverviewReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FEEDS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.FEEDS_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        feeds: action.payload,
      };
    case ReducerActions.FEED_DELETING_INIT:
      return {...state, isDeleting: true};
    case ReducerActions.FEED_DELETING_SUCCESS:
      return {
        ...state,
        feeds: action.payload.feeds,
        isDeleting: false,
        snackbar: {
          severity: "success",
          message: TEXT_X_FEEDS_DELETED(String(action.payload.counter)),
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_SET:
      return {
        ...state,
        snackbar: action.payload,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: SNACKBAR_INITIAL_STATE_VALUES,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isDeleting: false,
      };
    default: {
      // Exhaustive Check – stellt sicher, dass alle Aktionen behandelt werden
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */

/**
 * Admin-Seite zur Übersicht und Verwaltung von Feed-Einträgen.
 * Bietet eine tabellarische Ansicht aller Feeds und eine Löschfunktion
 * für veraltete Einträge.
 */
const OverviewFeedsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(
    feedsOverviewReducer,
    initialState,
  );
  const [tabValue, setTabValue] = React.useState(TabValue.overview);
  const [dialogFeed, setDialogFeed] = React.useState<FeedDomain | null>(null);
  /* ------------------------------------------
	// Daten aus DB holen
	// ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.FEEDS_FETCH_INIT});

    database.feeds
      .getAllFeeds()
      .then((result) => {
        dispatch({
          type: ReducerActions.FEEDS_FETCH_SUCCESS,
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
  /**
   * Wechselt den aktiven Tab (Übersicht / Löschen).
   *
   * @param _event Synthetisches React-Event (nicht verwendet).
   * @param newValue Index des neuen Tabs.
   */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  /* ------------------------------------------
  // Dialog öffnen / schliessen
  // ------------------------------------------ */
  /**
   * Öffnet den Detail-Dialog für einen bestimmten Feed-Eintrag.
   *
   * @param feedUid UID des Feed-Eintrags.
   */
  const onOpenDialog = (feedUid: string) => {
    const feed = state.feeds.find((feed) => feed.uid === feedUid);
    if (feed) {
      setDialogFeed(feed);
    }
  };

  /** Schliesst den Feed-Detail-Dialog. */
  const onDialogClose = () => {
    setDialogFeed(null);
  };

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Handling Dokumente löschen
  // ------------------------------------------ */
  /**
   * Löscht einen einzelnen Feed-Eintrag nach Bestätigung durch den User.
   * Schliesst den Dialog nur bei Erfolg.
   */
  const onDeleteFeedEntry = async () => {
    if (!dialogFeed) {
      return;
    }

    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      text: TEXT_SHOULD_FEED_ENTRY_BE_DELETED,
      title: `⚠️  ${TEXT_ATTENTION}`,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) {
      return;
    }

    try {
      await database.feeds.deleteFeed(dialogFeed.uid);
      dispatch({
        type: ReducerActions.FEED_DELETING_SUCCESS,
        payload: {
          feeds: state.feeds.filter((feed) => feed.uid !== dialogFeed.uid),
          counter: 1,
        },
      });
      // Dialog nur bei Erfolg schliessen
      setDialogFeed(null);
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /**
   * Löscht alle Feed-Einträge, die älter als die angegebene Anzahl Tage sind.
   *
   * @param days Anzahl Tage (Feeds älter als dieses Alter werden gelöscht).
   */
  const onDeleteFeedDocuments = (days: number) => {
    dispatch({type: ReducerActions.FEED_DELETING_INIT});

    database.feeds
      .deleteFeedsByAge(days)
      .then((deletedCount) => {
        // Lokale Liste filtern
        const offsetDate = new Date();
        offsetDate.setDate(offsetDate.getDate() - days);
        dispatch({
          type: ReducerActions.FEED_DELETING_SUCCESS,
          payload: {
            counter: deletedCount,
            feeds: state.feeds.filter((feed) => feed.createdAt >= offsetDate),
          },
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  };
  /* ------------------------------------------
  // Snackbar
  // ------------------------------------------ */
  /**
   * Schliesst die Snackbar, ausser bei Klick ausserhalb (clickaway).
   *
   * @param _event Auslösendes Event.
   * @param reason Grund des Schliessens (z. B. "clickaway").
   */
  const handleSnackbarClose = (
    _event: Event | React.SyntheticEvent,
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
      <PageTitle title={`${TEXT_FEEDS} ${TEXT_MONITOR}`} breadcrumbs={[SYSTEM_BREADCRUMB]} />

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
          <Tab
            label={`${TEXT_DELETE} (${state.feeds.length})`}
          />
        </Tabs>
        {tabValue === TabValue.overview && (
          <FeedTable feeds={state.feeds} onFeedSelect={onOpenDialog} />
        )}
        {tabValue === TabValue.delete && (
          <Container sx={classes.container} component="main" maxWidth="sm">
            <DeleteFeedsPanel
              onDelete={onDeleteFeedDocuments}
              isDeleting={state.isDeleting}
              feedCount={state.feeds.length}
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
      {dialogFeed !== null && (
        <DialogFeedEntry
          handleClose={onDialogClose}
          onDeleteFeedEntry={onDeleteFeedEntry}
          feed={dialogFeed}
        />
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ========================= Feed-Tabelle ============================
// =================================================================== */

/** Props für die Feed-Übersichtstabelle. */
interface FeedTableProps {
  feeds: FeedDomain[];
  onFeedSelect: (feedUid: string) => void;
}

/**
 * Tabellarische Darstellung aller Feed-Einträge mit Such- und Filterfunktion.
 *
 * @param props.feeds Liste aller Feed-Einträge.
 * @param props.onFeedSelect Callback beim Auswählen eines Feed-Eintrags.
 */
const FeedTable = ({feeds, onFeedSelect}: FeedTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const classes = useCustomStyles();
  const theme = useTheme();

  // Feeds in DataGrid-Struktur umwandeln
  const feedRows = React.useMemo<FeedOverviewStructure[]>(
    () =>
      feeds.map((feed) => ({
        uid: feed.uid,
        title: feed.title,
        text: feed.text,
        type: feed.feedType,
        visibility: feed.visibility,
        createdDate: feed.createdAt,
        userDisplayName: feed.user.displayName,
      })),
    [feeds],
  );

  // Gefilterte Zeilen basierend auf dem Suchtext
  const filteredRows = React.useMemo<FeedOverviewStructure[]>(() => {
    if (!searchString) return feedRows;
    const lower = searchString.toLowerCase();
    return feedRows.filter(
      (row) =>
        row.uid.toLowerCase().includes(lower) ||
        row.title.toLowerCase().includes(lower) ||
        row.type.toLowerCase().includes(lower) ||
        row.userDisplayName.toLowerCase().includes(lower) ||
        row.createdDate
          .toLocaleString("de-CH", DATE_FORMAT_OPTIONS)
          .includes(lower),
    );
  }, [feedRows, searchString]);

  /** Spaltendefinitionen für das DataGrid. */
  const DATA_GRID_COLUMNS = React.useMemo<GridColDef[]>(
    () => [
      {
        field: "open",
        headerName: TEXT_OPEN,
        sortable: false,
        renderCell: (params) => {
          const onClick = () => {
            onFeedSelect(params.id as string);
          };

          return (
            <IconButton
              aria-label="open feed"
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
        field: "type",
        headerName: TEXT_TYPE,
        editable: false,
        width: 150,
      },
      {
        field: "createdDate",
        headerName: TEXT_DATE,
        editable: false,
        width: 200,
        valueFormatter: (value: Date | null | undefined) => {
          if (value instanceof Date) {
            return value.toLocaleString("de-CH", DATE_FORMAT_OPTIONS);
          }
          return "";
        },
      },
      {
        field: "title",
        headerName: TEXT_TITLE,
        editable: false,
        width: 150,
      },
      {
        field: "visibility",
        headerName: TEXT_VISIBILITY,
        editable: false,
        width: 150,
      },
      {
        field: "userDisplayName",
        headerName: "User",
        editable: false,
        width: 150,
      },
    ],
    [onFeedSelect, theme, classes.typographyCode],
  );

  /** Setzt den Suchtext zurück. */
  const clearSearchString = () => {
    setSearchString("");
  };

  /**
   * Aktualisiert den Suchtext bei Eingabe.
   *
   * @param event Änderungs-Event des Textfeldes.
   */
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value);
  };

  return (
    <Card
      sx={classes.card}
      key={"feedTablePanel"}
      style={{marginBottom: "4em"}}
    >
      <CardContent sx={classes.cardContent} key={"feedTableContent"}>
        <Stack spacing={1}>
          <SearchPanel
            searchString={searchString}
            onUpdateSearchString={updateSearchString}
            onClearSearchString={clearSearchString}
          />
          <Typography
            variant="body2"
            style={{marginTop: "0.5em", marginBottom: "2em"}}
          >
            {filteredRows.length === feedRows.length
              ? `${feedRows.length} ${TEXT_FEEDS}`
              : `${filteredRows.length} ${TEXT_FROM.toLowerCase()} ${
                  feedRows.length
                } ${TEXT_FEEDS}`}
          </Typography>
          <Box component="div" style={{display: "flex", height: "100%"}}>
            <Box component="div" style={{flexGrow: 1}}>
              <DataGrid
                autoHeight
                rows={filteredRows}
                columns={DATA_GRID_COLUMNS}
                getRowId={(row) => row.uid}
                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                initialState={{
                  sorting: {
                    sortModel: [{field: "createdDate", sort: "desc"}],
                  },
                }}
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
// ========================= Dialog-Feed =============================
// =================================================================== */

/** Props für den Feed-Detail-Dialog. */
interface DialogFeedEntryProps {
  feed: FeedDomain;
  handleClose: () => void;
  onDeleteFeedEntry: () => void;
}

/**
 * Dialog zur Anzeige der Details eines einzelnen Feed-Eintrags.
 * Zeigt Metadaten, User-Infos und Source-Object-Daten an.
 *
 * @param props.feed Der anzuzeigende Feed-Eintrag.
 * @param props.handleClose Callback zum Schliessen des Dialogs.
 * @param props.onDeleteFeedEntry Callback zum Löschen des Feed-Eintrags.
 */
const DialogFeedEntry = ({
  feed,
  handleClose,
  onDeleteFeedEntry,
}: DialogFeedEntryProps) => {
  const theme = useTheme();
  const classes = useCustomStyles();
  return (
    <Dialog
      open={true}
      onClose={handleClose}
      aria-labelledby="dialog feed"
      fullWidth={true}
      maxWidth="sm"
    >
      {feed.sourceObject.pictureSrc ? (
        <DialogTitle
          sx={classes.dialogHeaderWithPicture}
          style={{
            backgroundImage: `url(${feed.sourceObject.pictureSrc})`,
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
            {feed.feedType}
          </Typography>
        </DialogTitle>
      ) : (
        <DialogTitle>{feed.feedType}</DialogTitle>
      )}
      <DialogContent style={{overflow: "unset"}}>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          <FormListItem id="uid" value={feed.uid} label="UID" displayAsCode />
          <FormListItem id="feedType" value={feed.feedType} label="Typ" />
          <FormListItem
            id="visibility"
            value={feed.visibility}
            label="Sichtbarkeit"
          />
          <FormListItem id="title" value={feed.title} label="Titel" />
          <FormListItem id="text" value={feed.text} label="Text" />
          <FormListItem
            id="createdAt"
            value={feed.createdAt.toLocaleString("de-CH")}
            label="Erstellt am"
          />
        </List>
        <Typography>User</Typography>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          <FormListItem
            id="userUid"
            value={feed.user.uid}
            label="UID"
            displayAsCode
          />
          <FormListItem
            id="userDisplayName"
            value={feed.user.displayName}
            label="Name"
          />
        </List>
        <Typography>Source Object</Typography>
        <List dense style={{marginBottom: theme.spacing(2)}}>
          <FormListItem
            id="soType"
            value={feed.sourceObject.type}
            label="Typ"
          />
          <FormListItem
            id="soUid"
            value={feed.sourceObject.uid}
            label="UID"
            displayAsCode
          />
          <FormListItem
            id="soName"
            value={feed.sourceObject.name}
            label="Name"
          />
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          sx={classes.deleteButton}
          variant="outlined"
          onClick={onDeleteFeedEntry}
        >
          {TEXT_DELETE}
        </Button>
        <Button variant="outlined" color="primary" onClick={handleClose}>
          {TEXT_CLOSE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ===================================================================
// ================= Feed-Dokumente löschen ==========================
// =================================================================== */

/** Props für das Panel zum Massenlöschen von Feed-Einträgen. */
interface DeleteFeedsPanelProps {
  isDeleting: boolean;
  feedCount: number;
  onDelete: (days: number) => void;
}

/**
 * Panel zum Löschen von Feed-Einträgen, die älter als ein bestimmtes Alter sind.
 * Zeigt ein Eingabefeld für das Alter in Tagen und einen Lösch-Button.
 *
 * @param props.isDeleting Gibt an, ob gerade ein Löschvorgang läuft.
 * @param props.feedCount Gesamtanzahl der Feed-Einträge.
 * @param props.onDelete Callback mit der Anzahl Tage als Parameter.
 */
const DeleteFeedsPanel = ({
  isDeleting,
  feedCount,
  onDelete,
}: DeleteFeedsPanelProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const [daysOffset, setDaysOffset] = React.useState(180);

  /**
   * Aktualisiert den Tages-Offset. Ignoriert ungültige (NaN) Eingaben.
   *
   * @param event Änderungs-Event des Eingabefeldes.
   */
  const onChangeDayOffset = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(event.target.value, 10);
    if (!isNaN(parsed)) {
      setDaysOffset(parsed);
    }
  };

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_DELETE_FEEDS}
        </Typography>

        <Typography variant="body2" style={{marginBottom: theme.spacing(2)}}>
          {`${feedCount} ${TEXT_FEED_ENTRIES}`}
        </Typography>

        <TextField
          id={"daysOffset"}
          key={"daysOffset"}
          type="number"
          InputProps={{inputProps: {min: 100}}}
          label={TEXT_DELETE_FEEDS_OLDER_THAN}
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
          disabled={!daysOffset || isDeleting}
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={() => onDelete(daysOffset)}
        >
          {`${TEXT_FEED_ENTRIES} ${TEXT_DELETE}`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OverviewFeedsPage;
