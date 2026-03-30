/**
 * CronJobsPage — Admin-Seite für das Monitoring von Cron Jobs.
 *
 * Zeigt die Ausführungshistorie geplanter Jobs aus der `cron_job_log`-Tabelle
 * in einem DataGrid. Unterstützt Filtern nach Job-Name, manuelles Auslösen
 * von Jobs und Anzeigen von JSONB-Details in einem Dialog.
 */
import React, {useEffect, useReducer, useCallback, useState} from "react";
import * as Sentry from "@sentry/react";

import {
  Container,
  Stack,
  Chip,
  Alert,
  Backdrop,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import {
  CRON_JOBS as TEXT_CRON_JOBS,
  CRON_JOBS_DESCRIPTION as TEXT_CRON_JOBS_DESCRIPTION,
  CRON_JOBS_FILTER_ALL as TEXT_CRON_JOBS_FILTER_ALL,
  CRON_JOBS_TRIGGER_NOW as TEXT_CRON_JOBS_TRIGGER_NOW,
  CRON_JOBS_TRIGGER_SUCCESS as TEXT_CRON_JOBS_TRIGGER_SUCCESS,
  CRON_JOBS_TRIGGER_ERROR as TEXT_CRON_JOBS_TRIGGER_ERROR,
  CRON_JOBS_DETAILS_TITLE as TEXT_CRON_JOBS_DETAILS_TITLE,
  CRON_JOBS_NO_DETAILS as TEXT_CRON_JOBS_NO_DETAILS,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  BUTTON_OK as TEXT_BUTTON_OK,
} from "../../../constants/text";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {useCustomStyles} from "../../../constants/styles";
import {useDatabase} from "../../Database/DatabaseContext";
import {supabase} from "../../Database/supabaseClient";
import {CronJobLogDomain} from "../../Database/Repository/CronJobLogRepository";
import {CustomSnackbar} from "../../Shared/customSnackbar";

/* ===================================================================
// ======================== Konstanten ================================
// =================================================================== */

/** Bekannte Cron-Job-Namen für Filter und Trigger. */
const CRON_JOB_NAMES = [
  "cron-daily-digest",
  "cron-support-user-cleanup",
  "cron-event-review-email",
] as const;

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
    <Chip label={status} color={colorMap[status] ?? "default"} size="small" />
  );
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für das Monitoring von Cron Jobs.
 * Zeigt die Ausführungshistorie in einem DataGrid mit Filtern,
 * manuellem Trigger und Detail-Dialog.
 */
const CronJobsPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const [state, dispatch] = useReducer(cronJobsReducer, initialState);
  const [filterJobName, setFilterJobName] = useState<string>("");
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean;
    details: Record<string, unknown> | null;
    jobName: string;
  }>({open: false, details: null, jobName: ""});
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({open: false, message: "", severity: "success"});
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);

  /** Logs laden (mit optionalem Job-Name-Filter). */
  const fetchLogs = useCallback(async () => {
    dispatch({type: ReducerActions.FETCH_INIT});
    try {
      const logs = filterJobName
        ? await database.cronJobLog.getByJobName(filterJobName, 200)
        : await database.cronJobLog.getAll(200);
      dispatch({type: ReducerActions.FETCH_SUCCESS, payload: logs});
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [database, filterJobName]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  /** Job manuell auslösen via supabase.functions.invoke(). */
  const handleTriggerJob = async (jobName: string) => {
    setTriggerLoading(jobName);
    try {
      const {error} = await supabase.functions.invoke(jobName, {
        body: {},
      });
      if (error) throw error;
      setSnackbar({
        open: true,
        message: `${TEXT_CRON_JOBS_TRIGGER_SUCCESS}: ${jobName}`,
        severity: "success",
      });
      // Logs nach kurzem Delay neu laden, damit der neue Eintrag sichtbar ist
      setTimeout(() => fetchLogs(), 2000);
    } catch (error) {
      Sentry.captureException(error);
      setSnackbar({
        open: true,
        message: `${TEXT_CRON_JOBS_TRIGGER_ERROR}: ${String(error)}`,
        severity: "error",
      });
    } finally {
      setTriggerLoading(null);
    }
  };

  /** Details-Spalte klickbar machen. */
  const handleOpenDetails = (
    details: Record<string, unknown> | null,
    jobName: string,
  ) => {
    setDetailsDialog({open: true, details, jobName});
  };

  /** DataGrid-Spalten (mit Details-Klick). */
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
    {
      field: "details",
      headerName: "Details",
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Button
            size="small"
            onClick={() => handleOpenDetails(params.value, params.row.jobName)}
          >
            JSON
          </Button>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <>
      <PageTitle
        title={TEXT_CRON_JOBS}
        subTitle={TEXT_CRON_JOBS_DESCRIPTION}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          {/* Filter und Trigger-Buttons */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
            }}
          >
            <FormControl size="small" sx={{minWidth: 220}}>
              <InputLabel>Job-Filter</InputLabel>
              <Select
                value={filterJobName}
                label="Job-Filter"
                onChange={(event) => setFilterJobName(event.target.value)}
              >
                <MenuItem value="">{TEXT_CRON_JOBS_FILTER_ALL}</MenuItem>
                {CRON_JOB_NAMES.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{display: "flex", gap: 1, flexWrap: "wrap"}}>
              {CRON_JOB_NAMES.map((name) => (
                <Button
                  key={name}
                  variant="outlined"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  disabled={triggerLoading !== null}
                  onClick={() => handleTriggerJob(name)}
                  loading={triggerLoading === name}
                >
                  {name}
                </Button>
              ))}
            </Box>
          </Box>

          {!state.isLoading && state.logs.length === 0 && !state.error && (
            <Alert severity="info">
              Noch keine Cron-Job-Einträge vorhanden.
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

        {/* Details-Dialog */}
        <Dialog
          open={detailsDialog.open}
          onClose={() =>
            setDetailsDialog({open: false, details: null, jobName: ""})
          }
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {TEXT_CRON_JOBS_DETAILS_TITLE}: {detailsDialog.jobName}
          </DialogTitle>
          <DialogContent>
            {detailsDialog.details ? (
              <Typography
                component="pre"
                sx={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  backgroundColor: "#f5f5f5",
                  padding: 2,
                  borderRadius: 1,
                  maxHeight: "60vh",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(detailsDialog.details, null, 2)}
              </Typography>
            ) : (
              <Typography color="text.secondary">
                {TEXT_CRON_JOBS_NO_DETAILS}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setDetailsDialog({open: false, details: null, jobName: ""})
              }
            >
              {TEXT_BUTTON_OK}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar für Trigger-Feedback */}
        <CustomSnackbar
          message={snackbar.message}
          severity={snackbar.severity}
          snackbarOpen={snackbar.open}
          handleClose={() => setSnackbar((prev) => ({...prev, open: false}))}
        />
      </Container>
    </>
  );
};

export default CronJobsPage;
