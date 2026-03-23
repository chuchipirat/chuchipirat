import React from "react";

import {
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  LinearProgress,
  Stack,
  Paper,
  Chip,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Box,
  TextField,
} from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
} from "@mui/icons-material";

import {
  EMAIL as TEXT_EMAIL,
  PASSWORD as TEXT_PASSWORD,
  MIGRATION as TEXT_MIGRATION,
  MIGRATION_DESCRIPTION as TEXT_MIGRATION_DESCRIPTION,
  MIGRATION_SELECT_OBJECT as TEXT_MIGRATION_SELECT_OBJECT,
  MIGRATION_DRY_RUN as TEXT_MIGRATION_DRY_RUN,
  MIGRATION_START as TEXT_MIGRATION_START,
  MIGRATION_CANCEL as TEXT_MIGRATION_CANCEL,
  MIGRATION_STATS_TOTAL as TEXT_MIGRATION_STATS_TOTAL,
  MIGRATION_STATS_ALREADY_MIGRATED as TEXT_MIGRATION_STATS_ALREADY_MIGRATED,
  MIGRATION_STATS_SUCCESS as TEXT_MIGRATION_STATS_SUCCESS,
  MIGRATION_STATS_FAILED as TEXT_MIGRATION_STATS_FAILED,
  MIGRATION_STATS_CURRENT as TEXT_MIGRATION_STATS_CURRENT,
  MIGRATION_PHASE_FETCHING as TEXT_MIGRATION_PHASE_FETCHING,
  MIGRATION_PHASE_RUNNING as TEXT_MIGRATION_PHASE_RUNNING,
  MIGRATION_PHASE_COMPLETED as TEXT_MIGRATION_PHASE_COMPLETED,
  MIGRATION_PHASE_CANCELLED as TEXT_MIGRATION_PHASE_CANCELLED,
  MIGRATION_LOG_TITLE as TEXT_MIGRATION_LOG_TITLE,
  MIGRATION_FIREBASE_SIGN_IN_TITLE as TEXT_MIGRATION_FIREBASE_SIGN_IN_TITLE,
  MIGRATION_FIREBASE_SIGN_IN_DESCRIPTION as TEXT_MIGRATION_FIREBASE_SIGN_IN_DESCRIPTION,
  MIGRATION_FIREBASE_SIGN_IN_BUTTON as TEXT_MIGRATION_FIREBASE_SIGN_IN_BUTTON,
  MIGRATION_FIREBASE_CONNECTED as TEXT_MIGRATION_FIREBASE_CONNECTED,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";
import {PageTitle} from "../Shared/pageTitle";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {useMigration} from "./MigrationJobs/useMigration";
import {
  migrationJobRegistry,
  getMigrationJobKeys,
} from "./MigrationJobs/migrationJobRegistry";
import {MigrationRecordResult} from "./MigrationJobs/MigrationJob.interface";
import {AlertMessage} from "../Shared/AlertMessage";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für die Migration von Firebase-Daten nach Postgres.
 *
 * Bietet eine Job-Auswahl, Dry-Run-Modus, Start/Cancel-Buttons,
 * Fortschrittsanzeige und ein farbcodiertes Protokoll.
 */
const MigrationPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [selectedJobKey, setSelectedJobKey] = React.useState<string>("");
  const migration = useMigration();

  // Firebase-Anmeldung (lokal auf der Migrationsseite)
  const [firebaseSignedIn, setFirebaseSignedIn] = React.useState(false);
  const [firebaseEmail, setFirebaseEmail] = React.useState("");
  const [firebasePassword, setFirebasePassword] = React.useState("");
  const [firebaseError, setFirebaseError] = React.useState<Error | null>(null);
  const [firebaseLoading, setFirebaseLoading] = React.useState(false);

  const jobKeys = getMigrationJobKeys();
  const selectedJob = selectedJobKey
    ? migrationJobRegistry[selectedJobKey]
    : null;

  const isRunning =
    migration.phase === "fetching" || migration.phase === "running";

  /* ------------------------------------------
  // Firebase-Anmeldung
  // ------------------------------------------ */
  /**
   * Meldet den Admin bei Firebase an, damit Migrationsjobs
   * auf Firestore-Daten zugreifen können.
   */
  const handleFirebaseSignIn = async () => {
    setFirebaseLoading(true);
    setFirebaseError(null);
    try {
      await firebase.signInWithEmailAndPassword({
        email: firebaseEmail,
        password: firebasePassword,
      });
      setFirebaseSignedIn(true);
      // Passwort nach Login leeren
      setFirebasePassword("");
    } catch (error) {
      setFirebaseError(error as Error);
    } finally {
      setFirebaseLoading(false);
    }
  };

  /* ------------------------------------------
  // Migration starten
  // ------------------------------------------ */
  const handleStart = async () => {
    if (!selectedJob || !authUser) return;
    await migration.start(selectedJob, firebase, database, authUser);
  };

  /* ------------------------------------------
  // Fortschritt berechnen
  // ------------------------------------------ */
  const processed =
    migration.stats.successCount +
    migration.stats.failedCount +
    migration.stats.skippedCount;
  const progressPercent =
    migration.stats.totalSource > 0
      ? (processed / migration.stats.totalSource) * 100
      : 0;

  return (
    <>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_MIGRATION} subTitle={TEXT_MIGRATION_DESCRIPTION} />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="md">
        <Stack spacing={3}>
          {/* ----- Firebase-Anmeldung ----- */}
          {!firebaseSignedIn ? (
            <Card sx={classes.card}>
              <CardHeader
                title={TEXT_MIGRATION_FIREBASE_SIGN_IN_TITLE}
                subheader={TEXT_MIGRATION_FIREBASE_SIGN_IN_DESCRIPTION}
              />
              <CardContent>
                <Stack spacing={2}>
                  {firebaseError && (
                    <AlertMessage error={firebaseError} severity="error" />
                  )}
                  <TextField
                    label={TEXT_EMAIL}
                    type="email"
                    value={firebaseEmail}
                    onChange={(event) => setFirebaseEmail(event.target.value)}
                    disabled={firebaseLoading}
                    fullWidth
                  />
                  <TextField
                    label={TEXT_PASSWORD}
                    type="password"
                    value={firebasePassword}
                    onChange={(event) => setFirebasePassword(event.target.value)}
                    disabled={firebaseLoading}
                    fullWidth
                  />
                  <Button
                    variant="contained"
                    onClick={handleFirebaseSignIn}
                    disabled={
                      firebaseLoading || !firebaseEmail || !firebasePassword
                    }
                  >
                    {TEXT_MIGRATION_FIREBASE_SIGN_IN_BUTTON}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Chip
              label={TEXT_MIGRATION_FIREBASE_CONNECTED}
              color="success"
              sx={{alignSelf: "flex-start"}}
            />
          )}

          {/* ----- Job-Auswahl ----- */}
          <Card sx={classes.card}>
            <CardHeader title={TEXT_MIGRATION_SELECT_OBJECT} />
            <CardContent>
              <FormControl fullWidth>
                <InputLabel id="migration-job-label">
                  {TEXT_MIGRATION_SELECT_OBJECT}
                </InputLabel>
                <Select
                  labelId="migration-job-label"
                  value={selectedJobKey}
                  label={TEXT_MIGRATION_SELECT_OBJECT}
                  onChange={(e) => setSelectedJobKey(e.target.value)}
                  disabled={isRunning}
                >
                  {jobKeys.map((key) => (
                    <MenuItem key={key} value={key}>
                      {migrationJobRegistry[key].name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedJob && (
                <Typography variant="body2" sx={{mt: 1}}>
                  {selectedJob.description}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* ----- Steuerung ----- */}
          <Card sx={classes.card}>
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={migration.dryRun}
                      onChange={(e) => migration.setDryRun(e.target.checked)}
                      disabled={isRunning}
                    />
                  }
                  label={TEXT_MIGRATION_DRY_RUN}
                />
                <Box sx={{flexGrow: 1}} />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStart}
                  disabled={!selectedJob || isRunning || !firebaseSignedIn}
                >
                  {TEXT_MIGRATION_START}
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<StopIcon />}
                  onClick={migration.cancel}
                  disabled={!isRunning}
                >
                  {TEXT_MIGRATION_CANCEL}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* ----- Dashboard ----- */}
          <Card sx={classes.card}>
            <CardContent>
              <Stack spacing={2}>
                {/* Phasen-Anzeige */}
                <Typography variant="subtitle1" color="textSecondary">
                  {migration.phase === "fetching" &&
                    TEXT_MIGRATION_PHASE_FETCHING}
                  {migration.phase === "running" &&
                    TEXT_MIGRATION_PHASE_RUNNING}
                  {migration.phase === "completed" &&
                    TEXT_MIGRATION_PHASE_COMPLETED}
                  {migration.phase === "cancelled" &&
                    TEXT_MIGRATION_PHASE_CANCELLED}
                </Typography>

                {/* Fortschrittsbalken */}
                {(migration.phase === "running" ||
                  migration.phase === "completed" ||
                  migration.phase === "cancelled") && (
                  <LinearProgress
                    variant="determinate"
                    value={progressPercent}
                  />
                )}
                {migration.phase === "fetching" && (
                  <LinearProgress variant="indeterminate" />
                )}

                {/* Statistiken */}
                <Stack
                  direction="row"
                  spacing={3}
                  flexWrap="wrap"
                  useFlexGap
                >
                  <StatItem
                    label={TEXT_MIGRATION_STATS_TOTAL}
                    value={migration.stats.totalSource}
                  />
                  <StatItem
                    label={TEXT_MIGRATION_STATS_ALREADY_MIGRATED}
                    value={migration.stats.alreadyMigrated}
                  />
                  <StatItem
                    label={TEXT_MIGRATION_STATS_SUCCESS}
                    value={migration.stats.successCount}
                    color="success.main"
                  />
                  <StatItem
                    label={TEXT_MIGRATION_STATS_FAILED}
                    value={migration.stats.failedCount}
                    color="error.main"
                  />
                </Stack>

                {/* Aktueller Datensatz */}
                {migration.currentRecord && (
                  <Typography variant="body2" color="textSecondary">
                    {TEXT_MIGRATION_STATS_CURRENT}: {migration.currentRecord}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* ----- Protokoll ----- */}
          {migration.results.length > 0 && (
            <Card sx={classes.card}>
              <CardHeader title={TEXT_MIGRATION_LOG_TITLE} />
              <CardContent>
                <Paper
                  variant="outlined"
                  sx={{
                    maxHeight: 400,
                    overflow: "auto",
                    p: 1,
                  }}
                >
                  <Stack spacing={0.5}>
                    {migration.results.map((result) => (
                      <LogEntry key={result.id} result={result} />
                    ))}
                  </Stack>
                </Paper>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </>
  );
};

/* ===================================================================
// ========================= Statistik-Element =======================
// =================================================================== */

/**
 * Einzelnes Statistik-Element im Dashboard.
 */
interface StatItemProps {
  label: string;
  value: number;
  color?: string;
}

const StatItem = ({label, value, color}: StatItemProps) => (
  <Box>
    <Typography
      variant="h5"
      component="span"
      sx={{color: color || "text.primary", fontWeight: "bold"}}
    >
      {value}
    </Typography>
    <Typography variant="body2" color="textSecondary">
      {label}
    </Typography>
  </Box>
);

/* ===================================================================
// ========================= Protokoll-Eintrag =======================
// =================================================================== */

/**
 * Einzelner farbcodierter Eintrag im Migrations-Protokoll.
 */
interface LogEntryProps {
  result: MigrationRecordResult;
}

const LogEntry = ({result}: LogEntryProps) => {
  const chipColor =
    result.status === "success"
      ? "success"
      : result.status === "failed"
        ? "error"
        : "default";

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Chip
        label={result.status}
        color={chipColor}
        size="small"
        sx={{minWidth: 80}}
      />
      <Typography variant="body2" noWrap sx={{flexGrow: 1}}>
        {result.label}
      </Typography>
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{fontFamily: "monospace"}}
      >
        {result.id}
      </Typography>
      {result.error && (
        <Typography variant="caption" color="error">
          {result.error}
        </Typography>
      )}
    </Stack>
  );
};

export default MigrationPage;
