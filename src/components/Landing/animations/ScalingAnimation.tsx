import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";
import GroupsIcon from "@mui/icons-material/Groups";

/** Zutat mit Basiswert für 4 Personen. */
type Ingredient = {
  baseQuantity: number;
  unit: string;
  name: string;
};

/** Zutaten für Hörnli und Ghackets (Basis: 4 Personen). */
const INGREDIENTS: Ingredient[] = [
  {baseQuantity: 500, unit: "g", name: "Hörnli"},
  {baseQuantity: 400, unit: "g", name: "Hackfleisch"},
  {baseQuantity: 2, unit: "", name: "Zwiebeln"},
  {baseQuantity: 200, unit: "ml", name: "Bouillon"},
  {baseQuantity: 300, unit: "g", name: "Apfelmus"},
];

/** Personenzahl am Start und Ende der Animation. */
const MIN_PERSONS = 4;
const MAX_PERSONS = 80;

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 8000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  REST_START: 0,
  SCALE_UP_START: 1000,
  SCALE_UP_END: 3500,
  HOLD: 5500,
  SCALE_DOWN_END: 7000,
};

/**
 * Berechnet den Skalierungsfaktor basierend auf der verstrichenen Zeit.
 * Interpoliert linear zwischen 1 (Basis) und MAX/MIN.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Skalierungsfaktor (1.0 = Basiswert).
 */
const getScaleFactor = (elapsed: number): number => {
  const maxFactor = MAX_PERSONS / MIN_PERSONS;

  // Ruhephase
  if (elapsed < PHASE.SCALE_UP_START) return 1;

  // Hochskalieren
  if (elapsed < PHASE.SCALE_UP_END) {
    const progress =
      (elapsed - PHASE.SCALE_UP_START) /
      (PHASE.SCALE_UP_END - PHASE.SCALE_UP_START);
    // Ease-out für natürliches Gefühl
    const eased = 1 - Math.pow(1 - progress, 2);
    return 1 + (maxFactor - 1) * eased;
  }

  // Halten
  if (elapsed < PHASE.HOLD) return maxFactor;

  // Herunterskalieren
  if (elapsed < PHASE.SCALE_DOWN_END) {
    const progress =
      (elapsed - PHASE.HOLD) / (PHASE.SCALE_DOWN_END - PHASE.HOLD);
    const eased = Math.pow(progress, 2);
    return maxFactor - (maxFactor - 1) * eased;
  }

  return 1;
};

/** Ergebnis der Einheitenumrechnung. */
type ConvertedQuantity = {
  value: string;
  unit: string;
  /** `true` wenn die Einheit gerade umgerechnet wurde (für visuellen Effekt). */
  converted: boolean;
};

/**
 * Rechnet Mengen in grössere Einheiten um, wenn sinnvoll:
 * g → kg ab 1000 g, ml → l ab 1000 ml.
 *
 * @param quantity - Der numerische Mengenwert.
 * @param unit - Die Basiseinheit ("g", "ml", etc.).
 * @returns Objekt mit formatiertem Wert, Einheit und Umrechnungs-Flag.
 */
const convertQuantity = (quantity: number, unit: string): ConvertedQuantity => {
  if (unit === "g" && quantity >= 1000) {
    const kg = quantity / 1000;
    return {
      value: kg >= 10 ? Math.round(kg).toString() : kg.toFixed(1),
      unit: "kg",
      converted: true,
    };
  }
  if (unit === "ml" && quantity >= 1000) {
    const liter = quantity / 1000;
    return {
      value: liter >= 10 ? Math.round(liter).toString() : liter.toFixed(1),
      unit: "l",
      converted: true,
    };
  }

  // Keine Umrechnung
  const formatted =
    quantity >= 10
      ? Math.round(quantity).toString()
      : quantity % 1 === 0
        ? quantity.toString()
        : quantity.toFixed(1);

  return {value: formatted, unit, converted: false};
};

/**
 * Animierte Skalierungs-Illustration für die Landing-Page.
 * Zeigt eine vereinfachte Zutatenliste mit einem Personen-Slider,
 * der von 4 auf 80 Personen animiert. Die Mengen passen sich
 * proportional an.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const ScalingAnimationBase = ({isActive}: {isActive: boolean}) => {
  const [scaleFactor, setScaleFactor] = React.useState(1);
  const animationRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isActive) return;

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) % CYCLE_DURATION;
      setScaleFactor(getScaleFactor(elapsed));
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive]);

  const currentPersons = Math.round(MIN_PERSONS * scaleFactor);
  // Slider-Position: 5% Minimum damit der Thumb immer sichtbar ist
  const rawPercent =
    ((scaleFactor - 1) / (MAX_PERSONS / MIN_PERSONS - 1)) * 100;
  const sliderPercent = 5 + rawPercent * 0.95;

  return (
    <Box
      role="img"
      aria-label="Animation: Rezept-Skalierung von 4 auf 80 Personen"
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
      {/* Rezepttitel */}
      <Typography
        variant="subtitle2"
        sx={{fontWeight: 700, mb: 1.5}}
      >
        🍝 Hörnli und Ghackets
      </Typography>

      {/* Personen-Slider */}
      <Box sx={{mb: 2}}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 0.75,
          }}
        >
          <GroupsIcon sx={{fontSize: 20, color: "primary.main"}} />
          <Typography
            variant="body2"
            sx={{fontWeight: 600, fontVariantNumeric: "tabular-nums"}}
          >
            {currentPersons} Personen
          </Typography>
        </Box>

        {/* Dekorativer Slider-Track */}
        <Box
          sx={(theme) => ({
            position: "relative",
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.15),
          })}
        >
          {/* Gefüllter Bereich */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${sliderPercent}%`,
              borderRadius: 3,
              bgcolor: "primary.main",
            }}
          />
          {/* Thumb */}
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: `${sliderPercent}%`,
              width: 16,
              height: 16,
              borderRadius: "50%",
              bgcolor: "primary.main",
              transform: "translate(-50%, -50%)",
              boxShadow: 2,
            }}
          />
        </Box>
      </Box>

      {/* Zutatenliste */}
      <Box
        sx={(theme) => ({
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        })}
      >
        {INGREDIENTS.map((ingredient, index) => {
          const scaledQuantity = ingredient.baseQuantity * scaleFactor;
          const {value, unit, converted} = convertQuantity(
            scaledQuantity,
            ingredient.unit,
          );
          const isScaling = scaleFactor > 1.05;

          return (
            <Box
              key={ingredient.name}
              sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                px: 1.5,
                py: 0.75,
                bgcolor: isScaling
                  ? alpha(theme.palette.primary.main, 0.04)
                  : "transparent",
                transition: "background-color 0.3s ease",
                borderBottom:
                  index < INGREDIENTS.length - 1
                    ? `1px solid ${theme.palette.divider}`
                    : "none",
              })}
            >
              {/* Menge */}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 52,
                  textAlign: "right",
                  mr: 0.5,
                  color: isScaling ? "primary.main" : "text.primary",
                  transition: "color 0.3s ease",
                }}
              >
                {value}
              </Typography>
              {/* Einheit — mit Highlight-Effekt bei Umrechnung */}
              <Typography
                variant="body2"
                sx={{
                  minWidth: 24,
                  mr: 1.5,
                  fontWeight: converted ? 700 : 400,
                  color: converted ? "primary.main" : "text.secondary",
                  bgcolor: converted
                    ? (theme) => alpha(theme.palette.primary.main, 0.12)
                    : "transparent",
                  borderRadius: 0.5,
                  px: converted ? 0.5 : 0,
                  transition:
                    "color 0.3s ease, background-color 0.3s ease, font-weight 0.3s ease",
                }}
              >
                {unit}
              </Typography>
              {/* Zutat */}
              <Typography variant="body2">{ingredient.name}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export const ScalingAnimation = React.memo(ScalingAnimationBase);
ScalingAnimation.displayName = "ScalingAnimation";
