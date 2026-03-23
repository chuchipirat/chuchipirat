/**
 * DonationForm — Spendenformular mit Betragsauswahl und optionaler Nachricht.
 *
 * Ruft die Edge Function `create-donation` auf und leitet den Benutzer
 * zur Payrexx-Zahlungsseite weiter.
 *
 * @param props.eventId - Optionale Event-ID für Event-gebundene Spenden.
 * @param props.returnPath - Optionaler Rückweg-Pfad nach der Zahlung.
 *
 * @example
 * <DonationForm eventId="abc123" returnPath="/event/abc123" />
 */
import React, {useState, useCallback} from "react";

import {
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Typography,
  Backdrop,
  CircularProgress,
  Alert,
} from "@mui/material";

import {supabase} from "../Database/supabaseClient";
import {useAuthUser} from "../Session/authUserContext";

import {
  DONATION_SUBMIT as TEXT_DONATION_SUBMIT,
  DONATION_MESSAGE_LABEL as TEXT_DONATION_MESSAGE_LABEL,
  DONATION_MESSAGE_PLACEHOLDER as TEXT_DONATION_MESSAGE_PLACEHOLDER,
  DONATION_MIN_AMOUNT as TEXT_DONATION_MIN_AMOUNT,
  DONATION_CUSTOM_AMOUNT as TEXT_DONATION_CUSTOM_AMOUNT,
  DONATION_AMOUNT_LABEL as TEXT_DONATION_AMOUNT_LABEL,
  DONATION_ERROR_CREATE as TEXT_DONATION_ERROR_CREATE,
  DONATION_ERROR_NO_URL as TEXT_DONATION_ERROR_NO_URL,
  DONATION_ERROR_GENERIC as TEXT_DONATION_ERROR_GENERIC,
  DONATION_CUSTOM_PLACEHOLDER as TEXT_DONATION_CUSTOM_PLACEHOLDER,
} from "../../constants/text";

/* ===================================================================
// Vordefinierte Beträge (in CHF)
// =================================================================== */
const PRESET_AMOUNTS = [5, 10, 20, 50];

/** Sentinel-Wert für den «Anderer Betrag»-Toggle. */
const CUSTOM_VALUE = -1;

/* ===================================================================
// Props
// =================================================================== */

/**
 * Props für die DonationForm-Komponente.
 *
 * @param eventId - Optionale Event-ID für Event-gebundene Spenden.
 * @param returnPath - Optionaler Rückweg-Pfad nach Zahlung.
 */
type DonationFormProps = {
  eventId?: string;
  returnPath?: string;
};

/* ===================================================================
// Komponente
// =================================================================== */

/**
 * Spendenformular mit Betragsauswahl, optionaler Nachricht und
 * Weiterleitung zu Payrexx.
 */
const DonationForm = ({eventId, returnPath}: DonationFormProps) => {
  const authUser = useAuthUser();

  const [selectedPreset, setSelectedPreset] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Aktueller Betrag in CHF (aus Preset oder custom). */
  const currentAmountChf = isCustom
    ? parseFloat(customAmount) || 0
    : (selectedPreset ?? 0);

  /** Betrag in Rappen. */
  const amountInCents = Math.round(currentAmountChf * 100);

  /** Formular gültig: min. CHF 5.00 und authentifiziert. */
  const isValid = amountInCents >= 500 && !!authUser;

  /**
   * Toggle-Betrag auswählen (Preset oder «Anderer Betrag»).
   */
  const handleToggleChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newValue: number | null) => {
      if (newValue === null) return;

      if (newValue === CUSTOM_VALUE) {
        setIsCustom(true);
        setSelectedPreset(null);
      } else {
        setSelectedPreset(newValue);
        setIsCustom(false);
        setCustomAmount("");
      }
      setError(null);
    },
    [],
  );

  /**
   * Custom-Betrag ändern.
   */
  const handleCustomChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      // Nur Zahlen und Punkt/Komma zulassen
      if (/^[\d.,]*$/.test(value)) {
        setCustomAmount(value.replace(",", "."));
      }
    },
    [],
  );

  /**
   * Spende erstellen und zu Payrexx weiterleiten.
   */
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const {data, error: invokeError} = await supabase.functions.invoke(
        "create-donation",
        {
          body: {
            amountInCents,
            eventId: eventId ?? undefined,
            message: message.trim() || undefined,
            returnPath,
          },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message ?? TEXT_DONATION_ERROR_CREATE);
      }

      const paymentUrl = data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error(TEXT_DONATION_ERROR_NO_URL);
      }

      // Zur Payrexx-Zahlungsseite weiterleiten
      window.location.href = paymentUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : TEXT_DONATION_ERROR_GENERIC,
      );
      setIsLoading(false);
    }
  }, [isValid, amountInCents, eventId, message, returnPath]);

  if (!authUser) return null;

  return (
    <>
      <Stack spacing={3}>
        {/* Betragsauswahl */}
        <Typography variant="subtitle2">
          {TEXT_DONATION_AMOUNT_LABEL}
        </Typography>
        <ToggleButtonGroup
          value={isCustom ? CUSTOM_VALUE : selectedPreset}
          exclusive
          onChange={handleToggleChange}
          fullWidth
          size="large"
          color="primary"
        >
          {PRESET_AMOUNTS.map((amount) => (
            <ToggleButton key={amount} value={amount}>
              CHF {amount}
            </ToggleButton>
          ))}
          <ToggleButton value={CUSTOM_VALUE}>
            {TEXT_DONATION_CUSTOM_AMOUNT}
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Custom-Betrag (nur sichtbar wenn «Anderer Betrag» ausgewählt) */}
        {isCustom && (
          <TextField
            label={TEXT_DONATION_CUSTOM_AMOUNT}
            placeholder={TEXT_DONATION_CUSTOM_PLACEHOLDER}
            value={customAmount}
            onChange={handleCustomChange}
            autoFocus
            type="text"
            inputMode="decimal"
            slotProps={{
              input: {
                startAdornment: <Typography sx={{mr: 1}}>CHF</Typography>,
              },
            }}
            helperText={TEXT_DONATION_MIN_AMOUNT}
            fullWidth
          />
        )}

        {/* Nachricht */}
        <TextField
          label={TEXT_DONATION_MESSAGE_LABEL}
          placeholder={TEXT_DONATION_MESSAGE_PLACEHOLDER}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          multiline
          rows={2}
          slotProps={{htmlInput: {maxLength: 200}}}
          helperText={`${message.length}/200`}
          size="small"
          fullWidth
        />

        {/* Spender-Info (read-only) */}
        <Typography variant="body2" color="text.secondary">
          Spender*in: {authUser.publicProfile.displayName} ({authUser.email})
        </Typography>

        {/* Fehler */}
        {error && <Alert severity="error">{error}</Alert>}

        {/* Submit */}
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          fullWidth
        >
          {TEXT_DONATION_SUBMIT}
          {isValid && ` — CHF ${currentAmountChf.toFixed(2)}`}
        </Button>
      </Stack>

      {/* Loading-Overlay */}
      <Backdrop
        open={isLoading}
        sx={{color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1}}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </>
  );
};

export {DonationForm};
