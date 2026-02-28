import React from "react";

import {useNavigate} from "react-router";

import {
  Container,
  Typography,
  Alert,
  AlertTitle,
  Link,
  TextField,
  Button,
  IconButton,
  InputAdornment,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import * as ROUTES from "../../constants/routes";
import {
  PASSWORD_RESET_SUCCESS_TITLE as TEXT_PASSWORD_RESET_SUCCESS_TITLE,
  PASSWORD_RESET_SUCCESS_TEXT as TEXT_PASSWORD_RESET_SUCCESS_TEXT,
  PASSWORD_RESET_SUCCESS_REDIRECT as TEXT_PASSWORD_RESET_SUCCESS_REDIRECT,
  PASSWORD_RESET_GO_TO_HOME as TEXT_PASSWORD_RESET_GO_TO_HOME,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  CHANGE_PASSWORD as TEXT_CHANGE_PASSWORD,
  PASSWORD_RESET as TEXT_PASSWORD_RESET,
} from "../../constants/text";
import useCustomStyles from "../../constants/styles";
import {useDatabase} from "../Database/DatabaseContext";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import PasswordStrengthMeter from "../Shared/passwordStrengthMeter";
import PageTitle from "../Shared/pageTitle";

/* ===================================================================
// ======================== Typen & Konstanten ========================
// =================================================================== */

/** Zustände der Passwort-Reset-Seite. */
type ResetState = "waitingForSession" | "ready" | "success";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/**
 * Passwort-Reset-Seite nach Klick auf den Recovery-Link (Supabase).
 *
 * Der Supabase-Client verarbeitet den Hash-Fragment aus der URL
 * asynchron und etabliert eine Session. Diese Komponente wartet
 * via `onAuthStateChange` auf ein `SIGNED_IN`- oder `INITIAL_SESSION`-Event,
 * zeigt dann ein Passwortformular und leitet nach erfolgreichem Reset
 * mit Countdown zur Startseite weiter (der User ist bereits eingeloggt).
 */
const ResetPasswordPage = () => {
  const [resetState, setResetState] = React.useState<ResetState>(
    "waitingForSession",
  );
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [timer, setTimer] = React.useState(10);

  const navigate = useNavigate();
  const classes = useCustomStyles();
  const database = useDatabase();

  // Auf Session warten, die durch den Recovery-Link etabliert wird.
  React.useEffect(() => {
    let cancelled = false;

    const unsubscribe = database.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (!session) return;
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;

      setResetState("ready");
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [database]);

  // Nach Erfolg: 10-Sekunden-Countdown, dann Weiterleitung zur Anmeldung.
  React.useEffect(() => {
    if (resetState !== "success") return;

    if (timer === 0) {
      setTimeout(() => navigate(ROUTES.HOME), 500);
    } else {
      const timeout = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(timeout);
    }
  }, [timer, navigate, resetState]);

  /* ------------------------------------------
  // Passwort ändern
  // ------------------------------------------ */
  const onSubmit = async () => {
    try {
      await database.auth.updatePassword(password);
      setResetState("success");
    } catch (err) {
      console.error("Password reset failed:", err);
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(SupabaseMessageHandler.translateMessage({message}));
    }
  };

  const handleClickShowPassword = () => setShowPassword(!showPassword);
  const handleMouseDownPassword = (event: React.MouseEvent) =>
    event.preventDefault();

  return (
    <React.Fragment>
      <PageTitle title={TEXT_PASSWORD_RESET} />
      <Container sx={classes.container} component="main" maxWidth="sm">
        {resetState === "success" && (
          <Alert severity="success">
            <AlertTitle>{TEXT_PASSWORD_RESET_SUCCESS_TITLE}</AlertTitle>
            <Typography>{TEXT_PASSWORD_RESET_SUCCESS_TEXT}</Typography>
            <Typography>
              {TEXT_PASSWORD_RESET_SUCCESS_REDIRECT(timer)}
            </Typography>
            <Typography sx={{mt: 1}}>
              <Link component="button" onClick={() => navigate(ROUTES.HOME)}>
                {TEXT_PASSWORD_RESET_GO_TO_HOME}
              </Link>
            </Typography>
          </Alert>
        )}

        {resetState === "waitingForSession" && (
          <Alert severity="info">
            <AlertTitle>{TEXT_PASSWORD_RESET}</AlertTitle>
            <Typography>Einen Moment...</Typography>
          </Alert>
        )}

        {resetState === "ready" && (
          <React.Fragment>
            <Typography variant="h5" align="center" gutterBottom>
              {TEXT_PASSWORD_RESET}
            </Typography>
            {error && (
              <Alert severity="error" sx={{mb: 2}}>
                <AlertTitle>{TEXT_ALERT_TITLE_UUPS}</AlertTitle>
                <Typography>{error}</Typography>
              </Alert>
            )}
            <TextField
              type={showPassword ? "text" : "password"}
              margin="normal"
              required
              fullWidth
              id="password"
              name="password"
              label={TEXT_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={TEXT_SHOW_PASSWORD}
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                      size="large"
                    >
                      {showPassword ? <Visibility /> : <VisibilityOff />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <PasswordStrengthMeter password={password} />
            <Button
              disabled={password === "" || password.length < 6}
              fullWidth
              variant="contained"
              color="primary"
              sx={classes.submit}
              onClick={onSubmit}
            >
              {TEXT_CHANGE_PASSWORD}
            </Button>
          </React.Fragment>
        )}
      </Container>
    </React.Fragment>
  );
};

export default ResetPasswordPage;
