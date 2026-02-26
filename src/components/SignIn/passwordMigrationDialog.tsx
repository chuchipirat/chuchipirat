import React from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import PasswordStrengthMeter from "../Shared/passwordStrengthMeter";
import DatabaseService from "../Database/DatabaseService";

import {
  PASSWORD_MIGRATION_TITLE as TEXT_PASSWORD_MIGRATION_TITLE,
  PASSWORD_MIGRATION_DESCRIPTION as TEXT_PASSWORD_MIGRATION_DESCRIPTION,
  PASSWORD_MIGRATION_NEW_PASSWORD as TEXT_PASSWORD_MIGRATION_NEW_PASSWORD,
  PASSWORD_MIGRATION_CONFIRM as TEXT_PASSWORD_MIGRATION_CONFIRM,
  PASSWORD_MIGRATION_SUCCESS as TEXT_PASSWORD_MIGRATION_SUCCESS,
  PASSWORDS_DONT_MATCH as TEXT_PASSWORDS_DONT_MATCH,
  SHOW_PASSWORD as TEXT_SHOW_PASSWORD,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
} from "../../constants/text";

/* =====================================================================
// Props
// ===================================================================== */
/**
 * Props für den Passwort-Migrations-Dialog.
 *
 * @param open - Ob der Dialog sichtbar ist
 * @param email - E-Mail-Adresse des Benutzers (für Supabase Sign-Up)
 * @param firebaseUid - Die bestehende Firebase-UID des Benutzers
 * @param database - DatabaseService-Instanz
 * @param onSuccess - Callback nach erfolgreicher Migration
 * @param onClose - Callback zum Schliessen des Dialogs
 */
interface PasswordMigrationDialogProps {
  open: boolean;
  email: string;
  firebaseUid: string;
  /** Anzeigename des Benutzers (wird in Supabase Auth user_metadata gespeichert) */
  displayName: string;
  database: DatabaseService;
  onSuccess: () => void;
  onClose: () => void;
}

/* =====================================================================
// PasswordMigrationDialog — Dialog für die Passwort-Migration
// bestehender Firebase-User zu Supabase Auth.
// ===================================================================== */
/**
 * Dialog für bestehende Firebase-Benutzer, die sich erstmals über
 * Supabase Auth anmelden.
 *
 * Wird nach erfolgreichem Firebase-Login angezeigt, wenn kein
 * Supabase Auth Account existiert. Der Benutzer setzt ein neues
 * Passwort, das für den Supabase Auth Account verwendet wird.
 *
 * Ablauf:
 * 1. Benutzer gibt neues Passwort + Bestätigung ein
 * 2. authService.signUp(email, password) erstellt Supabase Auth Account
 * 3. auth_uid wird in der users-Tabelle verknüpft
 * 4. onSuccess-Callback wird aufgerufen (Firebase Sign-Out + Weiterleitung)
 */
const PasswordMigrationDialog: React.FC<PasswordMigrationDialogProps> = ({
  open,
  email,
  firebaseUid,
  displayName,
  database,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const passwordsMatch = password === confirmPassword;
  const isValid =
    password.length >= 6 && confirmPassword.length > 0 && passwordsMatch;

  /* ------------------------------------------
  // Passwort-Migration durchführen
  // ------------------------------------------ */
  const onMigrate = async () => {
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      // Supabase Auth Account erstellen (mit Anzeigename in user_metadata)
      const session = await database.auth.signUp(email, password, {
        displayName: displayName || undefined,
      });

      // auth_uid in der users-Tabelle verknüpfen (Admin-Client umgeht RLS)
      const usersRepo = database.admin?.users ?? database.users;
      await usersRepo.linkAuthUid(firebaseUid, session.user.id);

      setSuccess(true);

      // Supabase-Session abmelden, damit der User sich mit dem neuen Passwort
      // frisch einloggen kann (vermeidet Race-Conditions mit Auth-Contexts)
      await database.auth.signOut();
    } catch (err) {
      console.error("Passwort-Migration fehlgeschlagen:", err);
      setError(
        err instanceof Error ? err.message : "Ein unbekannter Fehler ist aufgetreten."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TEXT_PASSWORD_MIGRATION_TITLE}</DialogTitle>
      <DialogContent>
        {success ? (
          <Alert severity="success" sx={{mt: 1}}>
            <AlertTitle>{TEXT_PASSWORD_MIGRATION_SUCCESS}</AlertTitle>
          </Alert>
        ) : (
          <>
            <Typography sx={{mb: 2, mt: 1}}>
              {TEXT_PASSWORD_MIGRATION_DESCRIPTION}
            </Typography>

            {error && (
              <Alert severity="error" sx={{mb: 2}}>
                <AlertTitle>{TEXT_ALERT_TITLE_UUPS}</AlertTitle>
                {error}
              </Alert>
            )}

            {/* Neues Passwort */}
            <TextField
              type={showPassword ? "text" : "password"}
              margin="normal"
              required
              fullWidth
              id="migration-password"
              label={TEXT_PASSWORD_MIGRATION_NEW_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={TEXT_SHOW_PASSWORD}
                        onClick={() => setShowPassword(!showPassword)}
                        onMouseDown={handleMouseDownPassword}
                        size="large"
                      >
                        {showPassword ? (
                          <VisibilityIcon />
                        ) : (
                          <VisibilityOffIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <PasswordStrengthMeter password={password} />

            {/* Passwort bestätigen */}
            <TextField
              type={showPassword ? "text" : "password"}
              margin="normal"
              required
              fullWidth
              id="migration-password-confirm"
              label={TEXT_PASSWORD_MIGRATION_CONFIRM}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              error={confirmPassword.length > 0 && !passwordsMatch}
              helperText={
                confirmPassword.length > 0 && !passwordsMatch
                  ? TEXT_PASSWORDS_DONT_MATCH
                  : ""
              }
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {success ? (
          <Button onClick={onClose} variant="contained">
            OK
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={isLoading}>
              Abbrechen
            </Button>
            <Button
              onClick={onMigrate}
              variant="contained"
              disabled={!isValid || isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
            >
              {TEXT_PASSWORD_MIGRATION_TITLE}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PasswordMigrationDialog;
