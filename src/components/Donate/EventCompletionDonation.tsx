/**
 * EventCompletionDonation — Spendenabschnitt im Event-Erstellungsassistenten.
 *
 * Dreiteiliges Layout:
 * 1. Erfolgsmeldung (Event erstellt)
 * 2. Spendenappell mit gestapeltem Fortschrittsbalken und Kostenaufschlüsselung
 * 3. Spendenformular mit «Jetzt spenden» und «Weiter zum Anlass»
 *
 * @param props.eventName - Name des erstellten Events (für die Überschrift).
 * @param props.returnPath - Rückweg nach der Zahlung (z.B. /event/{uid}).
 * @param props.onSkip - Callback für «Weiter zum Anlass».
 */
import {useState, useCallback} from "react";

import {
  Stack,
  Typography,
  Box,
  Button,
  IconButton,
  Collapse,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Backdrop,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Info as InfoIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";

import {supabase} from "../Database/supabaseClient";
import {useAuthUser} from "../Session/authUserContext";
import {useDonationGoalData} from "./useDonationGoalData";

import {
  DONATION_EVENT_READY as TEXT_DONATION_EVENT_READY,
  DONATION_EVENT_READY_SUBTEXT as TEXT_DONATION_EVENT_READY_SUBTEXT,
  DONATION_APPEAL_TEXT as TEXT_DONATION_APPEAL_TEXT,
  DONATION_COST_SERVER_LABEL as TEXT_DONATION_COST_SERVER_LABEL,
  DONATION_COST_SERVER_AMOUNT as TEXT_DONATION_COST_SERVER_AMOUNT,
  DONATION_COST_SERVER_DETAILS as TEXT_DONATION_COST_SERVER_DETAILS,
  DONATION_COST_ASSOCIATION_LABEL as TEXT_DONATION_COST_ASSOCIATION_LABEL,
  DONATION_COST_ASSOCIATION_AMOUNT as TEXT_DONATION_COST_ASSOCIATION_AMOUNT,
  DONATION_COST_ASSOCIATION_DETAILS as TEXT_DONATION_COST_ASSOCIATION_DETAILS,
  DONATION_GOAL_REACHED_EXTENDED as TEXT_DONATION_GOAL_REACHED_EXTENDED,
  DONATION_GOAL_PROGRESS as TEXT_DONATION_GOAL_PROGRESS,
  DONATION_SKIP_TO_EVENT as TEXT_DONATION_SKIP_TO_EVENT,
  DONATION_ERROR_CREATE as TEXT_DONATION_ERROR_CREATE,
  DONATION_ERROR_NO_URL as TEXT_DONATION_ERROR_NO_URL,
  DONATION_ERROR_GENERIC as TEXT_DONATION_ERROR_GENERIC,
  DONATION_CUSTOM_PLACEHOLDER as TEXT_DONATION_CUSTOM_PLACEHOLDER,
  DONATION_SUBMIT as TEXT_DONATION_SUBMIT,
  DONATION_MIN_AMOUNT as TEXT_DONATION_MIN_AMOUNT,
  DONATION_MESSAGE_LABEL as TEXT_DONATION_MESSAGE_LABEL,
  DONATION_MESSAGE_PLACEHOLDER as TEXT_DONATION_MESSAGE_PLACEHOLDER,
  DONATION_CUSTOM_AMOUNT as TEXT_DONATION_CUSTOM_AMOUNT,
} from "../../constants/text";

/* ===================================================================
// Konstanten
// =================================================================== */

const PRESET_AMOUNTS = [5, 10, 20, 50];

/** Farben für die Segmente im Fortschrittsbalken. */
const SEGMENT_COLORS = ["#006064", "#26a69a"];

/** Kostenaufschlüsselung mit Tooltip-Details. */
const COST_BREAKDOWN = [
  {
    icon: "🖥",
    label: TEXT_DONATION_COST_SERVER_LABEL,
    amount: TEXT_DONATION_COST_SERVER_AMOUNT,
    details: TEXT_DONATION_COST_SERVER_DETAILS,
  },
  {
    icon: "📋",
    label: TEXT_DONATION_COST_ASSOCIATION_LABEL,
    amount: TEXT_DONATION_COST_ASSOCIATION_AMOUNT,
    details: TEXT_DONATION_COST_ASSOCIATION_DETAILS,
  },
];

/* ===================================================================
// Hilfsfunktion
// =================================================================== */

/**
 * Formatiert Rappen als CHF-String (ohne Dezimalstellen bei ganzen Beträgen).
 */
function formatChf(cents: number): string {
  const chf = cents / 100;
  return chf % 1 === 0 ? `CHF ${chf}` : `CHF ${chf.toFixed(2)}`;
}

/* ===================================================================
// Props
// =================================================================== */

type EventCompletionDonationProps = {
  /** Name des erstellten Events (für die Überschrift). */
  eventName: string;
  /** Rückweg nach der Zahlung (z.B. /event/{uid}). */
  returnPath: string;
  /** Callback für «Weiter zum Anlass». */
  onSkip: () => void;
  /** Optionale Event-ID, die mit der Spende verknüpft wird. */
  eventId?: string;
};

/* ===================================================================
// Komponente
// =================================================================== */

const EventCompletionDonation = ({
  eventName,
  returnPath,
  onSkip,
  eventId,
}: EventCompletionDonationProps) => {
  const authUser = useAuthUser();
  const {sections, stats, isLoading: isLoadingGoal} = useDonationGoalData();

  // Kostenaufschlüsselung: welcher Index ist aufgeklappt (-1 = keiner)
  const [expandedBreakdown, setExpandedBreakdown] = useState(-1);

  // Spendenformular
  const [selectedPreset, setSelectedPreset] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Berechnete Werte
  const currentAmountChf = isCustom
    ? parseFloat(customAmount) || 0
    : (selectedPreset ?? 0);
  const amountInCents = Math.round(currentAmountChf * 100);
  const isValid = amountInCents >= 500 && !!authUser;

  const totalTargetCents = sections.reduce(
    (sum, section) => sum + section.targetCents,
    0,
  );
  const totalCollected = stats?.totalCents ?? 0;
  const isGoalReached =
    totalTargetCents > 0 && totalCollected >= totalTargetCents;

  // Segmente für den gestapelten Balken
  const segmentWidths = sections.map((section) => {
    if (totalTargetCents === 0) return 0;
    const sectionShare = section.targetCents / totalTargetCents;
    const sectionFilled = Math.min(totalCollected / section.targetCents, 1);
    return sectionShare * sectionFilled * 100;
  });

  const currentYear = new Date().getFullYear();

  /** Custom-Betrag ändern. */
  const handleCustomChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (/^[\d.,]*$/.test(value)) {
        setCustomAmount(value.replace(",", "."));
        setCustomError(null);
      }
    },
    [],
  );

  /** Custom-Betrag validieren bei Blur. */
  const handleCustomBlur = useCallback(() => {
    const parsed = parseFloat(customAmount);
    if (customAmount && (isNaN(parsed) || parsed < 5)) {
      setCustomError(TEXT_DONATION_MIN_AMOUNT);
    }
  }, [customAmount]);

  /** Spende auslösen. */
  const handleDonate = useCallback(async () => {
    if (!isValid) return;
    setIsLoading(true);
    setSubmitError(null);

    try {
      const {data, error: invokeError} = await supabase.functions.invoke(
        "create-donation",
        {
          body: {
            amountInCents,
            message: message.trim() || undefined,
            returnPath,
            ...(eventId ? {eventId} : {}),
          },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message ?? TEXT_DONATION_ERROR_CREATE);
      }

      const paymentUrl = data?.paymentUrl;
      if (!paymentUrl) throw new Error(TEXT_DONATION_ERROR_NO_URL);

      window.location.href = paymentUrl;
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : TEXT_DONATION_ERROR_GENERIC,
      );
      setIsLoading(false);
    }
  }, [isValid, amountInCents, message, returnPath, eventId]);

  if (!authUser) return null;

  return (
    <>
      <Stack spacing={3} sx={{marginTop: 2}}>
        {/* ── 1. Erfolgsmeldung ── */}
        <Stack spacing={0.5}>
          <Typography variant="h5">
            {TEXT_DONATION_EVENT_READY(eventName)}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {TEXT_DONATION_EVENT_READY_SUBTEXT}
          </Typography>
        </Stack>

        {/* ── 2. Spendenappell + Fortschritt ── */}
        <DonationAppealCard
          sections={sections}
          segmentWidths={segmentWidths}
          totalCollected={totalCollected}
          totalTargetCents={totalTargetCents}
          isGoalReached={isGoalReached}
          isLoading={isLoadingGoal}
          currentYear={currentYear}
          expandedBreakdown={expandedBreakdown}
          onToggleBreakdown={(index) =>
            setExpandedBreakdown(expandedBreakdown === index ? -1 : index)
          }
        />

        {/* ── 3. Spendenformular + Skip ── */}
        <Stack spacing={2}>
          {/* Betragsauswahl */}
          <ToggleButtonGroup
            value={isCustom ? "custom" : selectedPreset}
            color="primary"
            exclusive
            onChange={(_event, newValue) => {
              if (newValue === null) return;
              if (newValue === "custom") {
                setIsCustom(true);
                setSelectedPreset(null);
              } else {
                setSelectedPreset(newValue as number);
                setIsCustom(false);
                setCustomAmount("");
                setCustomError(null);
              }
              setSubmitError(null);
            }}
            size="large"
            sx={{
              display: "flex",
              flexWrap: "wrap",
              "& .MuiToggleButtonGroup-grouped": {
                flex: {xs: "1 1 calc(50% - 1px)", sm: "1 1 0"},
                "&:not(:first-of-type)": {
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  marginLeft: 0,
                },
              },
            }}
          >
            {PRESET_AMOUNTS.map((amount) => (
              <ToggleButton key={amount} value={amount}>
                CHF {amount}
              </ToggleButton>
            ))}
            <ToggleButton value="custom">
              {TEXT_DONATION_CUSTOM_AMOUNT}
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Custom-Input */}
          {isCustom && (
            <TextField
              placeholder={TEXT_DONATION_CUSTOM_PLACEHOLDER}
              value={customAmount}
              onChange={handleCustomChange}
              onBlur={handleCustomBlur}
              autoFocus
              type="text"
              inputMode="decimal"
              error={!!customError}
              helperText={customError ?? TEXT_DONATION_MIN_AMOUNT}
              slotProps={{
                input: {
                  startAdornment: <Typography sx={{mr: 1}}>CHF</Typography>,
                },
              }}
              size="small"
              fullWidth
            />
          )}

          {/* Nachricht (optional) */}
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

          {/* Fehler */}
          {submitError && <Alert severity="error">{submitError}</Alert>}

          {/* Aktions-Buttons */}
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={handleDonate}
              disabled={!isValid || isLoading}
              fullWidth
            >
              {TEXT_DONATION_SUBMIT}
              {isValid ? ` — CHF ${currentAmountChf.toFixed(2)}` : ""}
            </Button>

            <Button
              variant="text"
              size="large"
              onClick={onSkip}
              endIcon={<ArrowForwardIcon />}
              fullWidth
              sx={{
                color: "text.secondary",
                fontWeight: 500,
                "&:hover": {color: "text.primary"},
              }}
            >
              {TEXT_DONATION_SKIP_TO_EVENT}
            </Button>
          </Stack>
        </Stack>
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

/* ===================================================================
// DonationAppealCard — Wiederverwendbare Spendenappell-Karte
// =================================================================== */

/**
 * Karte mit Spendenappell, Fortschrittsbalken und Kostenaufschlüsselung.
 * Wird sowohl im Event-Wizard als auch auf der eigenständigen Spendenseite verwendet.
 */
type DonationAppealCardProps = {
  sections: {id: string; targetCents: number}[];
  segmentWidths: number[];
  totalCollected: number;
  totalTargetCents: number;
  isGoalReached: boolean;
  isLoading: boolean;
  currentYear: number;
  expandedBreakdown: number;
  onToggleBreakdown: (index: number) => void;
};

const DonationAppealCard = ({
  sections,
  segmentWidths,
  totalCollected,
  totalTargetCents,
  isGoalReached,
  isLoading,
  currentYear,
  expandedBreakdown,
  onToggleBreakdown,
}: DonationAppealCardProps) => (
  <Box
    sx={{
      border: 1,
      borderColor: "divider",
      borderRadius: 2,
      p: {xs: 2, sm: 3},
      backgroundColor: "action.hover",
    }}
  >
    <Stack spacing={2}>
      {/* Appell-Text */}
      <Typography variant="body2">{TEXT_DONATION_APPEAL_TEXT}</Typography>

      {/* Fortschrittsbalken */}
      {isLoading ? (
        <Skeleton variant="rectangular" height={12} sx={{borderRadius: 6}} />
      ) : (
        <Box>
          <Box
            sx={{
              height: 12,
              borderRadius: 6,
              backgroundColor: "grey.200",
              overflow: "hidden",
              display: "flex",
            }}
          >
            {segmentWidths.map((width, index) => (
              <Box
                key={sections[index]?.id ?? index}
                sx={{
                  width: `${width}%`,
                  backgroundColor:
                    SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                  transition: "width 0.6s ease",
                }}
              />
            ))}
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{mt: 0.5, display: "block"}}
          >
            {isGoalReached
              ? TEXT_DONATION_GOAL_REACHED_EXTENDED
              : TEXT_DONATION_GOAL_PROGRESS(
                  formatChf(totalCollected),
                  formatChf(totalTargetCents),
                  currentYear,
                )}
          </Typography>
        </Box>
      )}

      {/* Kostenaufschlüsselung */}
      <Stack spacing={0.5}>
        {COST_BREAKDOWN.map((item, index) => (
          <Box key={item.label}>
            <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
              <Typography variant="caption" color="text.secondary">
                {item.icon} {item.label}: {item.amount}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onToggleBreakdown(index)}
                sx={{p: 0, ml: 0.5}}
              >
                <InfoIcon sx={{fontSize: 14, color: "text.disabled"}} />
              </IconButton>
            </Box>
            <Collapse in={expandedBreakdown === index}>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{pl: 3, display: "block"}}
              >
                {item.details}
              </Typography>
            </Collapse>
          </Box>
        ))}
      </Stack>
    </Stack>
  </Box>
);

export {
  EventCompletionDonation,
  DonationAppealCard,
  SEGMENT_COLORS,
  COST_BREAKDOWN,
  formatChf,
};
