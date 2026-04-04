import React from "react";

import {useNavigate} from "react-router";
import * as Sentry from "@sentry/react";

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
  CircularProgress,
} from "@mui/material";

import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import * as ROUTES from "../../constants/routes";
import {
  PASSWORD_RESET_SUCCESS_TITLE as TEXT_PASSWORD_RESET_SUCCESS_TITLE,
  PASSWORD_RESET_SUCCESS_TEXT as TEXT_PASSWORD_RESET_SUCCESS_TEXT,
  PASSWORD_RESET_SUCCESS_REDIRECT as TEXT_PASSWORD_RESET_SUCCESS_REDIRECT,
  PASSWORD_RESET_GO_TO_SIGN_IN as TEXT_PASSWORD_RESET_GO_TO_SIGN_IN,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  PASSWORD as TEXT_PASSWORD,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  CHANGE_PASSWORD as TEXT_CHANGE_PASSWORD,
  PASSWORD_RESET as TEXT_PASSWORD_RESET,
  PLEASE_WAIT as TEXT_PLEASE_WAIT,
} from "../../constants/text";
import {useCustomStyles} from "../../constants/styles";
import {useDatabase} from "../Database/DatabaseContext";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import {PasswordStrengthMeter} from "../Shared/passwordStrengthMeter";
import {PageTitle} from "../Shared/pageTitle";

/** Zustände der Passwort-Reset-Seite. */
type ResetState = "waitingForSession" | "ready" | "success";

/**
 * Passwort-Reset-Seite nach Klick auf den Recovery-Link (Supabase).
 *
 * Der Supabase-Client verarbeitet den Hash-Fragment aus der URL
 * asynchron und etabliert eine Session. Diese Komponente wartet
 * via `onAuthStateChange` auf ein `SIGNED_IN`- oder `INITIAL_SESSION`-Event,
 * zeigt dann ein Passwortformular und leitet nach erfolgreichem Reset
 * mit Countdown zur Anmeldeseite weiter (der User ist bereits eingeloggt).
 */
export const ResetPasswordPage = () => {
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
      setTimeout(() => navigate(ROUTES.SIGN_IN), 500);
    } else {
      const timeout = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(timeout);
    }
  }, [timer, navigate, resetState]);

  const onSubmit = async () => {
    try {
      await database.auth.updatePassword(password);
      setResetState("success");
    } catch (err) {
      Sentry.captureException(err);
      const message =
        err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(SupabaseMessageHandler.translateMessage({message}));
    }
  };

  const handleClickShowPassword = () => setShowPassword(!showPassword);
  const handleMouseDownPassword = (event: React.MouseEvent) =>
    event.preventDefault();

  return (
    <>
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
              <Link
                component="button"
                onClick={() => navigate(ROUTES.SIGN_IN)}
              >
                {TEXT_PASSWORD_RESET_GO_TO_SIGN_IN}
              </Link>
            </Typography>
          </Alert>
        )}

        {resetState === "waitingForSession" && (
          <Alert severity="info">
            <AlertTitle>{TEXT_PASSWORD_RESET}</AlertTitle>
            <Typography sx={{display: "flex", alignItems: "center", gap: 1}}>
              <CircularProgress size={16} />
              {TEXT_PLEASE_WAIT}
            </Typography>
          </Alert>
        )}

        {resetState === "ready" && (
          <>
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
          </>
        )}
      </Container>
    </>
  );
};
