/**
 * DeployReadinessPage — Admin-Seite «Deploy-Check».
 *
 * Beantwortet vor einem Deploy zwei getrennte Fragen:
 * 1. Läuft heute ein Lager? (heute liegt in einem Zeitfenster des Anlasses)
 * 2. Arbeitet gerade jemand in der App? (letzte Schreibzugriffe, wer/wo/wann)
 *
 * Die Seite zeigt nur Daten an, das Urteil «sicher zu deployen» trifft der Admin.
 */
import React, {useCallback, useEffect, useReducer} from "react";
import {useNavigate} from "react-router";
import * as Sentry from "@sentry/react";

import {
  Alert,
  Backdrop,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {useTheme} from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import {
  DEPLOY_READINESS as TEXT_DEPLOY_READINESS,
  DEPLOY_READINESS_DESCRIPTION as TEXT_DEPLOY_READINESS_DESCRIPTION,
  DEPLOY_READINESS_RUNNING_EVENTS as TEXT_RUNNING_EVENTS,
  DEPLOY_READINESS_RUNNING_EVENTS_TODAY as TEXT_RUNNING_EVENTS_TODAY,
  DEPLOY_READINESS_NO_RUNNING_EVENTS as TEXT_NO_RUNNING_EVENTS,
  DEPLOY_READINESS_RECENT_ACTIVITY as TEXT_RECENT_ACTIVITY,
  DEPLOY_READINESS_ACTIVE_NOW as TEXT_ACTIVE_NOW,
  DEPLOY_READINESS_NO_ACTIVITY as TEXT_NO_ACTIVITY,
  DEPLOY_READINESS_REFRESH as TEXT_REFRESH,
  DEPLOY_READINESS_LAST_REFRESH as TEXT_LAST_REFRESH,
  DEPLOY_READINESS_HINT as TEXT_HINT,
  DEPLOY_READINESS_COLUMN_PERSON as TEXT_COLUMN_PERSON,
  DEPLOY_READINESS_COLUMN_AREA as TEXT_COLUMN_AREA,
  DEPLOY_READINESS_COLUMN_OBJECT as TEXT_COLUMN_OBJECT,
  DEPLOY_READINESS_COLUMN_LAST_ACTIVITY as TEXT_COLUMN_LAST_ACTIVITY,
  DEPLOY_READINESS_AREA_EVENT as TEXT_AREA_EVENT,
  DEPLOY_READINESS_AREA_RECIPE as TEXT_AREA_RECIPE,
  DEPLOY_READINESS_AREA_MASTERDATA as TEXT_AREA_MASTERDATA,
  DEPLOY_READINESS_AREA_REQUEST as TEXT_AREA_REQUEST,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
} from "../../../constants/text";
import {EVENT as ROUTE_EVENT} from "../../../constants/routes";
import {Action} from "../../../constants/actions";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {useCustomStyles} from "../../../constants/styles";
import {useDatabase} from "../../Database/DatabaseContext";
import {
  ActivityArea,
  RecentActivityDomain,
  RunningEventDomain,
} from "../../Database/Repository/AdminOperationsRepository";
import {
  ACTIVE_NOW_MINUTES,
  AUTO_REFRESH_INTERVAL_MS,
  countActivePeople,
  formatMinutesAgo,
  getMinutesAgo,
  isActiveNow,
} from "./deployReadinessUtils";

/* ===================================================================
// ======================== Konstanten ================================
// =================================================================== */

/** Anzeigetexte je Aktivitätsbereich. */
const AREA_LABELS: Record<ActivityArea, string> = {
  event: TEXT_AREA_EVENT,
  recipe: TEXT_AREA_RECIPE,
  masterdata: TEXT_AREA_MASTERDATA,
  request: TEXT_AREA_REQUEST,
};

/** Zeitfenster der Aktivitätsliste in Minuten (24 Stunden). */
const ACTIVITY_WINDOW_MINUTES = 1440;

/* ===================================================================
// ======================== State / Reducer ===========================
// =================================================================== */

enum ReducerActions {
  FETCH_INIT,
  FETCH_SUCCESS,
  GENERIC_ERROR,
}

/** Diskriminierte Union für typsichere Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.FETCH_INIT}
  | {
      type: ReducerActions.FETCH_SUCCESS;
      payload: {
        runningEvents: RunningEventDomain[];
        activities: RecentActivityDomain[];
        fetchedAt: Date;
      };
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  runningEvents: RunningEventDomain[];
  activities: RecentActivityDomain[];
  /** Zeitpunkt der letzten Abfrage; dient auch als «jetzt» für relative Zeiten. */
  fetchedAt: Date | null;
  isLoading: boolean;
  error: Error | null;
};

const initialState: State = {
  runningEvents: [],
  activities: [],
  fetchedAt: null,
  isLoading: false,
  error: null,
};

/**
 * Reducer für die Deploy-Check-Seite.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const deployReadinessReducer = (
  state: State,
  action: DispatchAction,
): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ReducerActions.FETCH_SUCCESS:
      return {...state, ...action.payload, isLoading: false, error: null};
    case ReducerActions.GENERIC_ERROR:
      return {...state, isLoading: false, error: action.payload};
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// ======================== Teil-Komponenten ==========================
// =================================================================== */

type SummaryCardProps = {
  label: string;
  value: number;
};

/**
 * Kennzahl-Kachel: grün bei 0, sonst rot (= jetzt besser nicht deployen).
 *
 * @param label Beschriftung der Kennzahl.
 * @param value Anzahl.
 */
const SummaryCard = ({label, value}: SummaryCardProps) => {
  const color = value > 0 ? "error.main" : "success.main";
  return (
    <Card variant="outlined" sx={{flex: "1 1 220px", borderColor: color}}>
      <CardContent>
        <Typography variant="h3" component="p" sx={{color}}>
          {value}
        </Typography>
        <Typography color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
};

type RunningEventsProps = {
  events: RunningEventDomain[];
  onOpenEvent: (event: RunningEventDomain) => void;
};

/**
 * Liste der Lager, die heute laufen. Klick öffnet den Anlass.
 *
 * @param events Laufende Lager.
 * @param onOpenEvent Wird beim Klick auf ein Lager aufgerufen.
 */
const RunningEvents = ({events, onOpenEvent}: RunningEventsProps) => {
  if (events.length === 0) {
    return <Alert severity="success">{TEXT_NO_RUNNING_EVENTS}</Alert>;
  }
  return (
    <Stack spacing={1}>
      {events.map((event) => (
        <Card variant="outlined" key={event.eventId}>
          <CardActionArea onClick={() => onOpenEvent(event)}>
            <CardContent>
              <Typography variant="h6" component="p">
                {event.name}
              </Typography>
              <Typography color="text.secondary">
                {event.location} · {event.dateFrom.toLocaleDateString("de-CH")}{" "}
                – {event.dateTo.toLocaleDateString("de-CH")}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
};

type ActivityListProps = {
  activities: RecentActivityDomain[];
  now: Date;
  isMobile: boolean;
};

/**
 * Aktivitätsliste: DataGrid auf Desktop/Tablet, Karten auf dem Handy.
 * Zeilen innerhalb des «gerade aktiv»-Fensters sind hervorgehoben.
 *
 * @param activities Aktivitäten, neueste zuerst.
 * @param now Referenzzeitpunkt für relative Zeiten.
 * @param isMobile `true` für die Kartenansicht.
 */
const ActivityList = ({activities, now, isMobile}: ActivityListProps) => {
  const theme = useTheme();
  const highlightColor = theme.palette.error.light;

  if (activities.length === 0) {
    return <Alert severity="success">{TEXT_NO_ACTIVITY}</Alert>;
  }

  if (isMobile) {
    return (
      <Stack spacing={1}>
        {activities.map((activity) => (
          <Card
            variant="outlined"
            key={getActivityRowId(activity)}
            sx={
              isActiveNow(activity, now)
                ? {borderColor: "error.main", borderWidth: 2}
                : undefined
            }
          >
            <CardContent>
              <Typography variant="subtitle1">{activity.userName}</Typography>
              <Typography>
                {AREA_LABELS[activity.area]} · {activity.objectName}
              </Typography>
              <Typography color="text.secondary">
                {formatMinutesAgo(getMinutesAgo(activity.lastActivityAt, now))}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    );
  }

  const columns: GridColDef<RecentActivityDomain>[] = [
    {
      field: "userName",
      headerName: TEXT_COLUMN_PERSON,
      flex: 1,
      minWidth: 140,
    },
    {
      field: "area",
      headerName: TEXT_COLUMN_AREA,
      width: 130,
      valueFormatter: (value: ActivityArea) => AREA_LABELS[value] ?? value,
    },
    {
      field: "objectName",
      headerName: TEXT_COLUMN_OBJECT,
      flex: 2,
      minWidth: 200,
    },
    {
      field: "lastActivityAt",
      headerName: TEXT_COLUMN_LAST_ACTIVITY,
      width: 180,
      renderCell: (params) => (
        <Tooltip title={params.row.lastActivityAt.toLocaleString("de-CH")}>
          <span>
            {formatMinutesAgo(getMinutesAgo(params.row.lastActivityAt, now))}
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <DataGrid
      rows={activities}
      columns={columns}
      getRowId={getActivityRowId}
      getRowClassName={(params) =>
        isActiveNow(params.row, now) ? "activeNow" : ""
      }
      sx={{"& .activeNow": {backgroundColor: highlightColor}}}
      initialState={{
        pagination: {paginationModel: {pageSize: 25}},
      }}
      pageSizeOptions={[25, 50, 100]}
      localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
      autoHeight
      disableRowSelectionOnClick
    />
  );
};

/**
 * Eindeutige Zeilen-ID einer Aktivität (Person + Bereich + Objekt).
 *
 * @param activity Aktivität aus der Datenbank.
 * @returns Stabile ID für DataGrid und React-Keys.
 */
const getActivityRowId = (activity: RecentActivityDomain): string =>
  `${activity.userId ?? "system"}-${activity.area}-${activity.objectId}`;

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite «Deploy-Check»: laufende Lager und letzte Aktivität.
 * Aktualisiert sich automatisch alle 30 Sekunden.
 */
const DeployReadinessPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [state, dispatch] = useReducer(deployReadinessReducer, initialState);

  /**
   * Lädt beide Listen. Bei `silent` (Auto-Refresh) bleibt der Ladebalken aus,
   * damit die Seite nicht alle 30 Sekunden flackert.
   */
  const fetchData = useCallback(
    async (silent: boolean) => {
      if (!silent) dispatch({type: ReducerActions.FETCH_INIT});
      try {
        const [runningEvents, activities] = await Promise.all([
          database.adminOps.getRunningEvents(),
          database.adminOps.getRecentActivity(ACTIVITY_WINDOW_MINUTES),
        ]);
        dispatch({
          type: ReducerActions.FETCH_SUCCESS,
          payload: {runningEvents, activities, fetchedAt: new Date()},
        });
      } catch (error) {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error instanceof Error ? error : new Error(String(error)),
        });
      }
    },
    [database],
  );

  useEffect(() => {
    fetchData(false);
    const intervalId = setInterval(
      () => fetchData(true),
      AUTO_REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(intervalId);
  }, [fetchData]);

  /** Anlass auf der Event-Seite öffnen. */
  const handleOpenEvent = (event: RunningEventDomain) => {
    navigate(`${ROUTE_EVENT}/${event.eventId}`, {
      state: {action: Action.VIEW},
    });
  };

  const now = state.fetchedAt ?? new Date();

  return (
    <>
      <PageTitle
        title={TEXT_DEPLOY_READINESS}
        subTitle={TEXT_DEPLOY_READINESS_DESCRIPTION}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={3}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          <Box sx={{display: "flex", flexWrap: "wrap", gap: 2}}>
            <SummaryCard
              label={TEXT_RUNNING_EVENTS_TODAY}
              value={state.runningEvents.length}
            />
            <SummaryCard
              label={`${TEXT_ACTIVE_NOW} (${ACTIVE_NOW_MINUTES} Min.)`}
              value={countActivePeople(state.activities, now)}
            />
          </Box>

          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              disabled={state.isLoading}
              onClick={() => fetchData(false)}
            >
              {TEXT_REFRESH}
            </Button>
            {state.fetchedAt && (
              <Typography variant="body2" color="text.secondary">
                {TEXT_LAST_REFRESH}: {state.fetchedAt.toLocaleTimeString("de-CH")}
              </Typography>
            )}
          </Box>

          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              {TEXT_RUNNING_EVENTS}
            </Typography>
            <RunningEvents
              events={state.runningEvents}
              onOpenEvent={handleOpenEvent}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h5" component="h2">
              {TEXT_RECENT_ACTIVITY}
            </Typography>
            <ActivityList
              activities={state.activities}
              now={now}
              isMobile={isMobile}
            />
            <Typography variant="body2" color="text.secondary">
              {TEXT_HINT}
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};

export default DeployReadinessPage;
