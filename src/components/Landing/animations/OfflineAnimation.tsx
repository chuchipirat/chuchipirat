import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 9000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  BUTTON_APPEAR: 1500,
  BUTTON_PULSE: 1800,
  PROGRESS_START: 2000,
  PROGRESS_END: 3000,
  PDF_SLIDE: 3500,
  CHECK_1: 4000,
  CHECK_2: 4500,
  CHECK_3: 5000,
  BADGE_SHOW: 5500,
};

/** Inhalte des PDF-Dokuments (Zeilen mit Checkmarks). */
const PDF_LINES = ["Rezept", "Einkaufsliste", "Mengenberechnung"];

/** Animations-Zustand für einen Zeitpunkt. */
type AnimationState = {
  /** Ob der "PDF erstellen"-Button sichtbar ist. */
  buttonVisible: boolean;
  /** Ob der Button gerade pulsiert (Klick-Simulation). */
  buttonPulsing: boolean;
  /** Fortschritt der Progress-Bar (0–1). */
  progress: number;
  /** Ob das PDF-Papier sichtbar ist. */
  pdfVisible: boolean;
  /** Anzahl abgehakter PDF-Zeilen (0–3). */
  checkedLines: number;
  /** Ob der Erfolgs-Badge sichtbar ist. */
  showBadge: boolean;
};

/**
 * Berechnet den Animations-Zustand für einen bestimmten Zeitpunkt.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Zustandsobjekt für die Darstellung.
 */
const getAnimationState = (elapsed: number): AnimationState => {
  const buttonVisible = elapsed >= PHASE.BUTTON_APPEAR;
  const buttonPulsing =
    elapsed >= PHASE.BUTTON_PULSE && elapsed < PHASE.PROGRESS_START;

  let progress = 0;
  if (elapsed >= PHASE.PROGRESS_START && elapsed < PHASE.PROGRESS_END) {
    progress =
      (elapsed - PHASE.PROGRESS_START) /
      (PHASE.PROGRESS_END - PHASE.PROGRESS_START);
  } else if (elapsed >= PHASE.PROGRESS_END) {
    progress = 1;
  }

  const pdfVisible = elapsed >= PHASE.PDF_SLIDE;

  let checkedLines = 0;
  if (elapsed >= PHASE.CHECK_1) checkedLines = 1;
  if (elapsed >= PHASE.CHECK_2) checkedLines = 2;
  if (elapsed >= PHASE.CHECK_3) checkedLines = 3;

  const showBadge = elapsed >= PHASE.BADGE_SHOW;

  return {
    buttonVisible,
    buttonPulsing,
    progress,
    pdfVisible,
    checkedLines,
    showBadge,
  };
};

/**
 * Animierte Offline-/PDF-Export-Illustration für die Landing-Page.
 * Zeigt eine vereinfachte Rezeptkarte, die in ein PDF-Dokument
 * exportiert wird — mit Fortschrittsbalken und Checkmarks.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const OfflineAnimationBase = ({isActive}: {isActive: boolean}) => {
  const [state, setState] = React.useState<AnimationState>(() =>
    getAnimationState(0),
  );
  const animationRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isActive) return;

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) % CYCLE_DURATION;
      setState(getAnimationState(elapsed));
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive]);

  return (
    <Box
      role="img"
      aria-label="Animation: Rezept als PDF exportieren für offline Nutzung"
      sx={(theme) => ({
        bgcolor: "background.paper",
        borderRadius: 3,
        boxShadow: 1,
        border: `1px solid ${theme.palette.divider}`,
        p: {xs: 1.5, md: 2},
        maxWidth: 400,
        mx: "auto",
      })}
    >
      {/* Titel */}
      <Typography variant="subtitle2" sx={{fontWeight: 700, mb: 1.5}}>
        📄 PDF Export
      </Typography>

      {/* Rezeptkarte */}
      <Box
        sx={(theme) => ({
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          p: 1.5,
          mb: 1.5,
        })}
      >
        <Typography
          variant="body2"
          sx={{fontWeight: 700, mb: 0.5}}
        >
          🍝 Hörnli und Ghackets
        </Typography>
        <Typography
          variant="caption"
          sx={{color: "text.secondary", display: "block", mb: 1}}
        >
          42 Portionen
        </Typography>
        <Box
          sx={(theme) => ({
            height: 1,
            bgcolor: theme.palette.divider,
            mb: 1,
          })}
        />
        {/* Vereinfachte Zutatenliste */}
        {[
          {quantity: "5.25", unit: "kg", name: "Hörnli"},
          {quantity: "4.2", unit: "kg", name: "Hackfleisch"},
          {quantity: "21", unit: "", name: "Zwiebeln"},
        ].map((ingredient) => (
          <Box
            key={ingredient.name}
            sx={{display: "flex", gap: 0.5, mb: 0.25}}
          >
            <Typography
              variant="caption"
              sx={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                minWidth: 32,
                textAlign: "right",
              }}
            >
              {ingredient.quantity}
            </Typography>
            <Typography
              variant="caption"
              sx={{minWidth: 18, color: "text.secondary"}}
            >
              {ingredient.unit}
            </Typography>
            <Typography variant="caption">{ingredient.name}</Typography>
          </Box>
        ))}
      </Box>

      {/* "PDF erstellen"-Button */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          mb: 1.5,
          opacity: state.buttonVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        <Box
          sx={(_theme) => ({
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            px: 2,
            py: 0.5,
            borderRadius: 1,
            fontSize: "0.75rem",
            fontWeight: 600,
            transform: state.buttonPulsing ? "scale(0.95)" : "scale(1)",
            transition: "transform 0.15s ease",
            boxShadow: state.progress > 0 ? 0 : 2,
          })}
        >
          <PictureAsPdfIcon sx={{fontSize: 16}} />
          PDF erstellen
        </Box>
      </Box>

      {/* Progress-Bar */}
      {state.progress > 0 && state.progress < 1 && (
        <Box
          sx={(theme) => ({
            height: 4,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.15),
            mb: 1.5,
            overflow: "hidden",
          })}
        >
          <Box
            sx={{
              height: "100%",
              width: `${state.progress * 100}%`,
              borderRadius: 2,
              bgcolor: "primary.main",
            }}
          />
        </Box>
      )}

      {/* PDF-Dokument */}
      <Box
        sx={(theme) => ({
          borderRadius: 1.5,
          border: `1px dashed ${theme.palette.divider}`,
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.background.paper, 0.6)
              : alpha(theme.palette.grey[50], 0.8),
          p: 1.5,
          mb: 1,
          opacity: state.pdfVisible ? 1 : 0,
          transform: state.pdfVisible
            ? "translateY(0) rotate(0deg)"
            : "translateY(-16px) rotate(-1deg)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
          boxShadow: state.pdfVisible ? 3 : 0,
        })}
      >
        {/* PDF-Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            mb: 1,
          }}
        >
          <PictureAsPdfIcon
            sx={{fontSize: 16, color: "error.main"}}
          />
          <Typography
            variant="caption"
            sx={{fontWeight: 700, fontSize: "0.7rem"}}
          >
            Hörnli und Ghackets.pdf
          </Typography>
        </Box>

        {/* PDF-Inhalt mit Checkmarks */}
        {PDF_LINES.map((line, index) => {
          const isChecked = index < state.checkedLines;
          const isNew =
            index === state.checkedLines - 1 &&
            state.checkedLines > 0;

          return (
            <Box
              key={line}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                py: 0.25,
                opacity: state.pdfVisible ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            >
              <Box
                sx={{
                  color: isChecked ? "success.main" : "action.disabled",
                  display: "flex",
                  alignItems: "center",
                  "@keyframes checkPop": {
                    "0%": {transform: "scale(1)"},
                    "50%": {transform: "scale(1.3)"},
                    "100%": {transform: "scale(1)"},
                  },
                  animation: isNew ? "checkPop 0.3s ease" : "none",
                }}
              >
                {isChecked ? (
                  <CheckBoxIcon sx={{fontSize: 16}} />
                ) : (
                  <CheckBoxOutlineBlankIcon sx={{fontSize: 16}} />
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: "0.65rem",
                  color: isChecked ? "text.primary" : "text.disabled",
                  fontWeight: isChecked ? 600 : 400,
                  transition: "color 0.3s ease",
                }}
              >
                {line}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Erfolgs-Badge */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          opacity: state.showBadge ? 1 : 0,
          transform: state.showBadge ? "scale(1)" : "scale(0.9)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}
      >
        <Typography
          variant="caption"
          sx={(theme) => ({
            bgcolor: alpha(theme.palette.success.main, 0.12),
            color: "success.main",
            fontWeight: 700,
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
          })}
        >
          ✅ Bereit für offline!
        </Typography>
      </Box>
    </Box>
  );
};

export const OfflineAnimation = React.memo(OfflineAnimationBase);
OfflineAnimation.displayName = "OfflineAnimation";
