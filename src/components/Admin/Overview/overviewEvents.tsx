/**
 * OverviewEventsPage — Admin-Übersichtsseite für alle Anlässe.
 *
 * Zeigt alle Anlässe als Karten (Standard) oder in einem DataGrid (Listenansicht).
 * Beim Klick auf eine Karte öffnet sich ein Detail-Dialog mit Metadaten und
 * Aktionsbuttons (Quittung erstellen, Anlass öffnen).
 *
 * Daten werden beim Seitenaufruf via Supabase (EventRepository.getAllEventsShort)
 * geladen. Ersteller-Namen werden über das UserRepository aufgelöst.
 * Die Client-seitige Suche filtert über 6 Felder (UID, Name, Motto, Ort,
 * Ersteller-UID, Ersteller-Name).
 *
 * @example
 * // In App.jsx (lazy-loaded)
 * const OverviewEvents = lazy(() => import("../Admin/Overview/overviewEvents"));
 */
import React from "react";
import {generateAndDownloadPdf} from "../../Shared/pdfUtils";
import {useNavigate} from "react-router";

import {
  Container,
  Backdrop,
  CircularProgress,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Grid,
  Chip,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  List,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  LocationOn as LocationOnIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
} from "@mui/icons-material";
import {DataGrid, GridColDef, GridToolbar} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import * as Sentry from "@sentry/browser";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {SearchPanel} from "../../Shared/searchPanel";
import {FormListItem} from "../../Shared/formListItem";
import {ImageRepository} from "../../../constants/imageRepository";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";
import {useCustomStyles} from "../../../constants/styles";

import {useFirebase} from "../../Firebase/firebaseContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {useAuthUser} from "../../Session/authUserContext";

import type {EventDomain} from "../../Database/Repository/EventRepository";
import {getMaxDate} from "../../Database/Repository/EventRepository";
import {EventReceiptPdf} from "../../Event/Event/eventRecipePdf";
import {Receipt} from "../../Event/Event/receipt.class";
import {User} from "../../User/user.class";
import {Action} from "../../../constants/actions";
import {EVENT as ROUTE_EVENT} from "../../../constants/routes";

import DialogCreateReceipt, {
  DialogCreateReceiptState,
  DIALOG_CREATE_RECEIPT_INITIAL_STATE,
} from "./dialogCreateReceipt";

import {
  EVENTS as TEXT_EVENTS,
  OVERVIEW_EVENTS_DESCRIPTION as TEXT_OVERVIEW_EVENTS_DESCRIPTION,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  CLOSE as TEXT_CLOSE,
  UID as TEXT_UID,
  NAME as TEXT_NAME,
  MOTTO as TEXT_MOTTO,
  LOCATION as TEXT_LOCATION,
  NO_OF_DAYS as TEXT_NO_OF_DAYS,
  NO_OF_COOKS as TEXT_NO_OF_COOKS,
  START_DATE as TEXT_START_DATE,
  END_DATE as TEXT_END_DATE,
  CREATED_AT as TEXT_CREATED_AT,
  CREATED_FROM as TEXT_CREATED_FROM,
  CREATE_RECEIPT as TEXT_CREATE_RECEIPT,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  FROM as TEXT_FROM,
  EVENT as TEXT_EVENT,
  OPEN as TEXT_OPEN,
} from "../../../constants/text";

/* =====================================================================
// Flache UI-Struktur für Events
// ===================================================================== */

/**
 * Flache Darstellung eines Events für die Admin-Übersicht.
 * Berechnet aus EventDomain (Köche-Anzahl, Start/End-Datum, Tage).
 *
 * @property uid - Supabase UUID des Events
 * @property name - Name des Events
 * @property motto - Motto des Events
 * @property location - Veranstaltungsort
 * @property pictureSrc - URL des Event-Bilds
 * @property noOfCooks - Anzahl Köche
 * @property startDate - Frühestes Startdatum
 * @property endDate - Spätestes Enddatum
 * @property numberOfDays - Anzahl Tage
 * @property createdAt - Erstellungszeitpunkt
 * @property createdByUid - Auth-UUID des Erstellers
 * @property createdByName - Anzeigename des Erstellers
 */
interface EventOverviewItem {
  uid: string;
  name: string;
  motto: string;
  location: string;
  pictureSrc: string;
  noOfCooks: number;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  createdAt: Date;
  createdByUid: string;
  createdByName: string;
}

/**
 * Konvertiert ein EventDomain in ein flaches EventOverviewItem.
 *
 * @param domain - Das Domain-Objekt aus dem Repository
 * @param creatorName - Aufgelöster Anzeigename des Erstellers
 * @returns Flaches UI-Objekt
 */
const domainToOverviewItem = (
  domain: EventDomain,
  creatorName: string,
): EventOverviewItem => {
  // Frühestes und spätestes Datum aus den Zeitscheiben berechnen
  const sortedDates = [...domain.dates].sort(
    (a, b) => a.dateFrom.getTime() - b.dateFrom.getTime(),
  );
  const startDate = sortedDates.length > 0 ? sortedDates[0].dateFrom : new Date(0);
  const endDate = getMaxDate(domain);

  // Anzahl Tage: Differenz in Tagen + 1 (inklusiv)
  let numberOfDays = 0;
  if (sortedDates.length > 0) {
    const msPerDay = 1000 * 60 * 60 * 24;
    numberOfDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  }

  return {
    uid: domain.uid,
    name: domain.name,
    motto: domain.motto,
    location: domain.location,
    pictureSrc: domain.pictureSrc,
    noOfCooks: domain.cooks.length,
    startDate,
    endDate,
    numberOfDays,
    createdAt: domain.createdAt,
    createdByUid: domain.createdBy ?? "",
    createdByName: creatorName,
  };
};

/* =====================================================================
// Enums, Typen & Reducer
// ===================================================================== */

/** Aktionen für den Seitenreducer. */
enum ReducerActions {
  FETCH_INIT = "FETCH_INIT",
  FETCH_SUCCESS = "FETCH_SUCCESS",
  FILTER_LIST = "FILTER_LIST",
  GENERIC_ERROR = "GENERIC_ERROR",
}

/** Interner Zustand der Seite. */
type State = {
  events: EventOverviewItem[];
  filteredEvents: EventOverviewItem[];
  isLoading: boolean;
  error: Error | null;
};

type DispatchAction =
  | {type: ReducerActions.FETCH_INIT}
  | {type: ReducerActions.FETCH_SUCCESS; payload: EventOverviewItem[]}
  | {type: ReducerActions.FILTER_LIST; payload: {searchString: string}}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

const initialState: State = {
  events: [],
  filteredEvents: [],
  isLoading: false,
  error: null,
};

/**
 * Filtert Events anhand eines Suchstrings über 6 Felder.
 *
 * @param events - Alle geladenen Events.
 * @param searchString - Suchbegriff (wird lowercase verglichen).
 * @returns Gefilterte Events.
 */
const filterEvents = (
  events: EventOverviewItem[],
  searchString: string,
): EventOverviewItem[] => {
  if (!searchString) return events;
  const lower = searchString.toLowerCase();
  return events.filter(
    (event) =>
      event.uid.toLowerCase().includes(lower) ||
      event.name.toLowerCase().includes(lower) ||
      event.motto.toLowerCase().includes(lower) ||
      event.location.toLowerCase().includes(lower) ||
      event.createdByName.toLowerCase().includes(lower) ||
      event.createdByUid.toLowerCase().includes(lower),
  );
};

/**
 * Reducer für den Seitenzustand.
 *
 * @param state - Aktueller Zustand.
 * @param action - Dispatched Action.
 * @returns Neuer Zustand.
 */
const eventsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ReducerActions.FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        events: action.payload,
        filteredEvents: action.payload,
      };
    case ReducerActions.FILTER_LIST:
      return {
        ...state,
        filteredEvents: filterEvents(state.events, action.payload.searchString),
      };
    case ReducerActions.GENERIC_ERROR:
      return {...state, isLoading: false, error: action.payload};
    default:
      return state;
  }
};

/* =====================================================================
// EventCardAdmin — Kartenansicht für einen Anlass
// ===================================================================== */

/**
 * Props für die Admin-Anlasskarte.
 *
 * @param event - Flaches Event-Objekt.
 * @param onClick - Callback beim Klick auf die Karte.
 */
interface EventCardAdminProps {
  event: EventOverviewItem;
  onClick: (event: EventOverviewItem) => void;
}

/**
 * Kompakte Admin-Karte für einen Anlass.
 *
 * Zeigt: Event-Bild (16:9), Event-Name, UID als Chip (monospace),
 * Ort mit Icon, Datumsbereich, Anzahl Köche und Ersteller-Name.
 */
const EventCardAdmin = ({event, onClick}: EventCardAdminProps) => {
  const classes = useCustomStyles();

  const imageSrc = event.pictureSrc
    ? getImageUrl(event.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  const dateRange =
    event.startDate instanceof Date && event.startDate.getTime() > 0
      ? `${event.startDate.toLocaleString("de-CH", {dateStyle: "medium"})} – ${event.endDate.toLocaleString("de-CH", {dateStyle: "medium"})}`
      : "";

  return (
    <Card sx={{height: "100%", display: "flex", flexDirection: "column"}}>
      <CardActionArea
        onClick={() => onClick(event)}
        sx={{flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "stretch"}}
      >
        <CardMedia sx={classes.cardMedia} image={imageSrc} title={event.name} />
        <CardContent sx={{pb: "8px !important", flexGrow: 1}}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {event.name}
          </Typography>
          <Chip
            label={event.uid}
            size="small"
            sx={{fontFamily: "monospace", fontSize: "0.65rem", mb: 0.5, maxWidth: "100%"}}
          />
          {event.location && (
            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
              <LocationOnIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary" noWrap>
                {event.location}
              </Typography>
            </Stack>
          )}
          {dateRange && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {dateRange}
            </Typography>
          )}
          <Stack direction="row" spacing={1} mt={0.5}>
            <Typography variant="caption" color="text.secondary">
              {event.noOfCooks} {TEXT_NO_OF_COOKS}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" noWrap>
            {event.createdByName}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

/* =====================================================================
// DialogEventAdminDetail — Detail-Dialog
// ===================================================================== */

/**
 * Props für den Admin-Detail-Dialog eines Anlasses.
 *
 * @param open - Ob der Dialog geöffnet ist.
 * @param event - Flaches Event-Objekt (null wenn kein Anlass ausgewählt).
 * @param onClose - Callback zum Schliessen.
 * @param onOpenEvent - Callback: Anlass auf der Event-Seite öffnen.
 * @param onCreateReceipt - Callback: Quittung erstellen.
 */
interface DialogEventAdminDetailProps {
  open: boolean;
  event: EventOverviewItem | null;
  onClose: () => void;
  onOpenEvent: (event: EventOverviewItem) => void;
  onCreateReceipt: (eventUid: string) => void;
}

/**
 * Detail-Dialog mit Admin-Metadatenfeldern eines Anlasses.
 *
 * Zeigt ein Bild-Header mit dem Anlassnamen als Überlagerung sowie
 * alle Metadaten (UID, Name, Ort, Motto, Start, Ende, Tage, Köche,
 * Erstellt am, Ersteller-UID, Ersteller-Name) via FormListItem.
 */
const DialogEventAdminDetail = ({
  open,
  event,
  onClose,
  onOpenEvent,
  onCreateReceipt,
}: DialogEventAdminDetailProps) => {
  const classes = useCustomStyles();

  if (!event) return null;

  const imageSrc = event.pictureSrc
    ? getImageUrl(event.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={classes.dialogHeaderWithPicture}
        style={{
          backgroundImage: `url(${imageSrc})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Typography
          variant="h4"
          component="span"
          sx={classes.dialogHeaderWithPictureTitle}
          style={{paddingLeft: "2ex"}}
        >
          {event.name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{p: 0}}>
        <List>
          <FormListItem
            key="uid"
            id="uid"
            value={event.uid}
            label={TEXT_UID}
            displayAsCode
          />
          <FormListItem
            key="name"
            id="name"
            value={event.name}
            label={TEXT_NAME}
          />
          <FormListItem
            key="location"
            id="location"
            value={event.location || "–"}
            label={TEXT_LOCATION}
          />
          <FormListItem
            key="motto"
            id="motto"
            value={event.motto || "–"}
            label={TEXT_MOTTO}
          />
          <FormListItem
            key="startDate"
            id="startDate"
            value={event.startDate}
            label={TEXT_START_DATE}
          />
          <FormListItem
            key="endDate"
            id="endDate"
            value={event.endDate}
            label={TEXT_END_DATE}
          />
          <FormListItem
            key="numberOfDays"
            id="numberOfDays"
            value={event.numberOfDays}
            label={TEXT_NO_OF_DAYS}
          />
          <FormListItem
            key="noOfCooks"
            id="noOfCooks"
            value={event.noOfCooks}
            label={TEXT_NO_OF_COOKS}
          />
          <FormListItem
            key="createdAt"
            id="createdAt"
            value={event.createdAt}
            label={TEXT_CREATED_AT}
          />
          <FormListItem
            key="createdByUid"
            id="createdByUid"
            value={event.createdByUid || "–"}
            label={`${TEXT_CREATED_FROM} ${TEXT_UID}`}
            displayAsCode
          />
          <FormListItem
            key="createdByName"
            id="createdByName"
            value={event.createdByName || "–"}
            label={TEXT_CREATED_FROM}
            withDivider={false}
          />
        </List>
      </DialogContent>

      <DialogActions>
        <Button color="primary" onClick={() => onCreateReceipt(event.uid)}>
          {TEXT_CREATE_RECEIPT}
        </Button>
        <Button onClick={onClose} color="inherit">
          {TEXT_CLOSE}
        </Button>
        <Button
          onClick={() => onOpenEvent(event)}
          variant="outlined"
          color="primary"
        >
          {`${TEXT_EVENT} ${TEXT_OPEN}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* =====================================================================
// DataGrid-Spalten für die Listenansicht
// ===================================================================== */

/**
 * Erzeugt die Spaltendefinition für das DataGrid.
 *
 * @param classes - Custom-Styles (für Code-Darstellung).
 * @returns DataGrid-Spaltendefinition.
 */
const buildDataGridColumns = (
  classes: ReturnType<typeof useCustomStyles>,
): GridColDef[] => [
  {
    field: "uid",
    headerName: TEXT_UID,
    editable: false,
    cellClassName: () => `super-app ${classes.typographyCode}`,
    width: 200,
  },
  {
    field: "name",
    headerName: TEXT_NAME,
    editable: false,
    width: 200,
  },
  {
    field: "location",
    headerName: TEXT_LOCATION,
    editable: false,
    width: 200,
  },
  {
    field: "motto",
    headerName: TEXT_MOTTO,
    editable: false,
    width: 200,
  },
  {
    field: "noOfCooks",
    headerName: TEXT_NO_OF_COOKS,
    editable: false,
    type: "number",
    width: 100,
  },
  {
    field: "startDate",
    headerName: TEXT_START_DATE,
    editable: false,
    width: 150,
    valueGetter: (value: unknown) =>
      value instanceof Date
        ? value.toLocaleString("de-CH", {dateStyle: "medium"})
        : "",
  },
  {
    field: "endDate",
    headerName: TEXT_END_DATE,
    editable: false,
    width: 150,
    valueGetter: (value: unknown) =>
      value instanceof Date
        ? value.toLocaleString("de-CH", {dateStyle: "medium"})
        : "",
  },
  {
    field: "numberOfDays",
    headerName: TEXT_NO_OF_DAYS,
    editable: false,
    type: "number",
    width: 100,
  },
  {
    field: "createdByName",
    headerName: TEXT_CREATED_FROM,
    editable: false,
    width: 200,
  },
];

/* =====================================================================
// Hauptseite
// ===================================================================== */

/**
 * Admin-Übersichtsseite für alle Anlässe.
 *
 * Lädt alle Events beim Seitenaufruf via Supabase (EventRepository.getAllEventsShort).
 * Ersteller-Namen werden über UserRepository.findDisplayNamesByIds aufgelöst.
 * Zeigt Ergebnisse wahlweise als Karten oder im DataGrid an.
 * Beim Klick öffnet sich ein Detail-Dialog; von dort aus kann eine Quittung
 * erstellt oder der Anlass geöffnet werden.
 */
const OverviewEventsPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(eventsReducer, initialState);

  // UI-State
  const [selectedEvent, setSelectedEvent] =
    React.useState<EventOverviewItem | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogCreateReceipt, setDialogCreateReceipt] = React.useState(
    DIALOG_CREATE_RECEIPT_INITIAL_STATE,
  );
  const [viewMode, setViewMode] = React.useState<"card" | "list">("card");
  const [searchString, setSearchString] = React.useState("");

  /* ------------------------------------------
  // Daten laden (Supabase)
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.FETCH_INIT});

    // RLS-geschützt: Admin-User sehen alle Events via is_admin() Policy
    database.events
      .getAllEventsShort()
      .then(async (domains) => {
        // Ersteller-Namen auflösen
        const creatorUids = [
          ...new Set(
            domains.map((d) => d.createdBy).filter((uid): uid is string => !!uid),
          ),
        ];
        const nameMap =
          creatorUids.length > 0
            ? await database.users.findDisplayNamesByIds(creatorUids)
            : new Map<string, string>();

        // Domain → flache UI-Struktur (absteigend nach createdAt)
        const items = domains
          .map((d) => domainToOverviewItem(d, nameMap.get(d.createdBy ?? "") ?? ""))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        dispatch({type: ReducerActions.FETCH_SUCCESS, payload: items});
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      });
  }, []);

  if (!authUser) return null;

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const onUpdateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value);
    dispatch({
      type: ReducerActions.FILTER_LIST,
      payload: {searchString: event.target.value},
    });
  };

  const onClearSearchString = () => {
    setSearchString("");
    dispatch({
      type: ReducerActions.FILTER_LIST,
      payload: {searchString: ""},
    });
  };

  /* ------------------------------------------
  // Karte/Zeile angeklickt → Detail-Dialog öffnen
  // ------------------------------------------ */
  const onCardClick = (event: EventOverviewItem) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const onCloseDialog = () => {
    setDialogOpen(false);
    setSelectedEvent(null);
  };

  /** Anlass auf der Event-Seite öffnen (Supabase UUID). */
  const onOpenEvent = (event: EventOverviewItem) => {
    navigate(`${ROUTE_EVENT}/${event.uid}`, {
      state: {action: Action.VIEW},
    });
  };

  /* ------------------------------------------
  // Quittung erstellen
  // ------------------------------------------ */
  const onCreateReceipt = async (eventUid: string) => {
    const event = state.events.find((e) => e.uid === eventUid);
    if (!event) return;

    // Detail-Dialog schliessen, damit der Quittungs-Dialog sichtbar wird
    setDialogOpen(false);

    try {
      const profile = await User.getFullProfile({
        firebase,
        database,
        uid: event.createdByUid,
      });

      setDialogCreateReceipt({
        dialogOpen: true,
        amount: 0,
        eventUid,
        eventName: event.name,
        payDate: event.createdAt,
        donorEmail: profile.email,
        donorName: profile.firstName
          ? `${profile.firstName} ${profile.lastName}`
          : profile.displayName,
      });
    } catch (error) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  const onCreateReceiptClose = () => {
    setDialogCreateReceipt(DIALOG_CREATE_RECEIPT_INITIAL_STATE);
  };

  /** PDF generieren, herunterladen und Quittung in Firebase speichern. */
  const generateReceipt = async (dialogValues: DialogCreateReceiptState) => {
    setDialogCreateReceipt(DIALOG_CREATE_RECEIPT_INITIAL_STATE);

    const receiptData = new Receipt();
    receiptData.eventUid = dialogValues.eventUid;
    receiptData.eventName = dialogValues.eventName;
    receiptData.payDate = dialogValues.payDate;
    receiptData.amount = dialogValues.amount;
    receiptData.donorName = dialogValues.donorName;
    receiptData.donorEmail = dialogValues.donorEmail;

    receiptData.created = {
      fromDisplayName: authUser.publicProfile.displayName,
      date: new Date(),
      fromUid: authUser.uid,
    };

    generateAndDownloadPdf(
      <EventReceiptPdf receiptData={receiptData} authUser={authUser} />,
      dialogValues.eventName + TEXT_CREATE_RECEIPT + TEXT_SUFFIX_PDF,
      (error) =>
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
    );

    Receipt.save({firebase, receipt: receiptData, authUser}).catch((error) => {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    });
  };

  /* ------------------------------------------
  // Zählertext
  // ------------------------------------------ */
  const counterText =
    state.events.length === state.filteredEvents.length
      ? `${state.events.length} ${TEXT_EVENTS}`
      : `${state.filteredEvents.length} ${TEXT_FROM.toLowerCase()} ${state.events.length} ${TEXT_EVENTS}`;

  return (
    <React.Fragment>
      {/* ===== HEADER ===== */}
      <PageTitle
        title={TEXT_EVENTS}
        subTitle={TEXT_OVERVIEW_EVENTS_DESCRIPTION}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          )}

          {/* Suchleiste + Ansichts-Toggle */}
          <Card sx={classes.card}>
            <CardContent sx={classes.cardContent}>
              <Stack spacing={1}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Box sx={{flexGrow: 1}}>
                    <SearchPanel
                      searchString={searchString}
                      onUpdateSearchString={onUpdateSearchString}
                      onClearSearchString={onClearSearchString}
                    />
                  </Box>
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(_e, value) => {
                      if (value !== null) setViewMode(value);
                    }}
                    size="small"
                    sx={{ml: 2}}
                  >
                    <ToggleButton value="card" aria-label="Kartenansicht">
                      <ViewModuleIcon />
                    </ToggleButton>
                    <ToggleButton value="list" aria-label="Listenansicht">
                      <ViewListIcon />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
                <Typography variant="body2">{counterText}</Typography>
              </Stack>
            </CardContent>
          </Card>

          {/* Kartenansicht */}
          {viewMode === "card" && (
            <Grid container spacing={2}>
              {state.filteredEvents.map((event) => (
                <Grid key={event.uid} size={{xs: 12, sm: 6, md: 4, lg: 3}}>
                  <EventCardAdmin event={event} onClick={onCardClick} />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Listenansicht (DataGrid) */}
          {viewMode === "list" && (
            <Box sx={{display: "flex", height: "100%"}}>
              <Box sx={{flexGrow: 1}}>
                <DataGrid
                  rows={state.filteredEvents}
                  columns={buildDataGridColumns(classes)}
                  getRowId={(row) => row.uid}
                  localeText={
                    deDE.components.MuiDataGrid.defaultProps.localeText
                  }
                  onRowClick={(params) =>
                    onCardClick(params.row as EventOverviewItem)
                  }
                  slots={{toolbar: GridToolbar}}
                />
              </Box>
            </Box>
          )}
        </Stack>
      </Container>

      {/* Detail-Dialog */}
      <DialogEventAdminDetail
        open={dialogOpen}
        event={selectedEvent}
        onClose={onCloseDialog}
        onOpenEvent={onOpenEvent}
        onCreateReceipt={onCreateReceipt}
      />

      {/* Quittungs-Dialog */}
      <DialogCreateReceipt
        dialogData={dialogCreateReceipt}
        handleClose={onCreateReceiptClose}
        handleOk={generateReceipt}
      />
    </React.Fragment>
  );
};

export default OverviewEventsPage;
