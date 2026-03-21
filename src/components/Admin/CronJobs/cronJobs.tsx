/**
 * CronJobsPage — Admin-Seite für das Monitoring von Cron Jobs.
 *
 * Zeigt die Ausführungshistorie geplanter Jobs aus der `cron_job_log`-Tabelle
 * in einem DataGrid. Filter nach Job-Name und Datumsbereich sind möglich.
 *
 * Die Tabelle wird in Phase 14 befüllt, wenn die Firebase-Cron-Jobs
 * zu Supabase migriert werden.
 */
import React, {useEffect, useReducer, useCallback} from "react";
import * as Sentry from "@sentry/browser";

import {
  Container,
  Stack,
  Chip,
  Alert,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import {
  CRON_JOBS as TEXT_CRON_JOBS,
  CRON_JOBS_DESCRIPTION as TEXT_CRON_JOBS_DESCRIPTION,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
} from "../../../constants/text";

import PageTitle from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import AlertMessage from "../../Shared/AlertMessage";
import useCustomStyles from "../../../constants/styles";
import {useDatabase} from "../../Database/DatabaseContext";
import {CronJobLogDomain} from "../../Database/Repository/CronJobLogRepository";

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
  | {type: ReducerActions.FETCH_SUCCESS; payload: CronJobLogDomain[]}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  logs: CronJobLogDomain[];
  isLoading: boolean;
  error: Error | null;
};

const initialState: State = {
  logs: [],
  isLoading: false,
  error: null,
};

/**
 * Reducer für die Cron-Job-Monitoring-Seite.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const cronJobsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ReducerActions.FETCH_SUCCESS:
      return {...state, isLoading: false, logs: action.payload};
    case ReducerActions.GENERIC_ERROR:
      return {...state, isLoading: false, error: action.payload};
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// ======================== DataGrid-Spalten =========================
// =================================================================== */

/** Formatiert einen Status als farbigen Chip. */
const StatusChip = ({status}: {status: string}) => {
  const colorMap: Record<string, "success" | "warning" | "error"> = {
    success: "success",
    running: "warning",
    error: "error",
  };
  return (
    <Chip
      label={status}
      color={colorMap[status] ?? "default"}
      size="small"
    />
  );
};

const columns: GridColDef[] = [
  {field: "jobName", headerName: "Job", flex: 1, minWidth: 150},
  {
    field: "startedAt",
    headerName: "Gestartet",
    flex: 1,
    minWidth: 180,
    valueFormatter: (value: Date) => value?.toLocaleString("de-CH") ?? "",
  },
  {
    field: "durationMs",
    headerName: "Dauer (ms)",
    width: 120,
    type: "number",
  },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => <StatusChip status={params.value} />,
  },
  {
    field: "recordsProcessed",
    headerName: "Verarbeitet",
    width: 120,
    type: "number",
  },
  {
    field: "errorMessage",
    headerName: "Fehler",
    flex: 1,
    minWidth: 200,
  },
];

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für das Monitoring von Cron Jobs.
 * Zeigt die Ausführungshistorie in einem DataGrid.
 */
const CronJobsPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const [state, dispatch] = useReducer(cronJobsReducer, initialState);

  /** Logs laden. */
  const fetchLogs = useCallback(async () => {
    dispatch({type: ReducerActions.FETCH_INIT});
    try {
      const logs = await database.cronJobLog.getAll(200);
      dispatch({type: ReducerActions.FETCH_SUCCESS, payload: logs});
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [database]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <>
      <PageTitle title={TEXT_CRON_JOBS} subTitle={TEXT_CRON_JOBS_DESCRIPTION} breadcrumbs={[SYSTEM_BREADCRUMB]} />
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={2}>
          {state.error && (
            <AlertMessage error={state.error} messageTitle={TEXT_ALERT_TITLE_UUPS} />
          )}

          {!state.isLoading && state.logs.length === 0 && !state.error && (
            <Alert severity="info">
              Noch keine Cron-Job-Einträge vorhanden. Die Tabelle wird befüllt,
              sobald die Cron Jobs migriert sind (Phase 14).
            </Alert>
          )}

          {state.logs.length > 0 && (
            <DataGrid
              rows={state.logs}
              columns={columns}
              initialState={{
                sorting: {sortModel: [{field: "startedAt", sort: "desc"}]},
                pagination: {paginationModel: {pageSize: 25}},
              }}
              pageSizeOptions={[25, 50, 100]}
              localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
              autoHeight
              disableRowSelectionOnClick
            />
          )}
        </Stack>
      </Container>
    </>
  );
};

export default CronJobsPage;
