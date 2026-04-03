import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

/** Einzelner Einkaufsartikel. */
type ShoppingItem = {
  quantity: string;
  unit: string;
  name: string;
};

/** Abteilung mit zugehörigen Artikeln. */
type Department = {
  name: string;
  items: ShoppingItem[];
};

/** Einkaufsliste gruppiert nach Abteilungen. */
const DEPARTMENTS: Department[] = [
  {
    name: "Backwaren",
    items: [
      {quantity: "500", unit: "g", name: "Mehl"},
      {quantity: "200", unit: "g", name: "Zucker"},
    ],
  },
  {
    name: "Molkerei",
    items: [
      {quantity: "4", unit: "", name: "Eier"},
      {quantity: "180", unit: "g", name: "Butter"},
    ],
  },
  {
    name: "Süsswaren",
    items: [
      {quantity: "200", unit: "g", name: "Schokolade"},
      {quantity: "1", unit: "dl", name: "Rahm"},
    ],
  },
];

/** Gesamtzahl aller Artikel (für Indexberechnung). */
const TOTAL_ITEMS = DEPARTMENTS.reduce(
  (sum, department) => sum + department.items.length,
  0,
);

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 10000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  /** Artikel erscheinen gestaffelt. */
  APPEAR_START: 0,
  APPEAR_DURATION: 1500,
  /** Checkboxen werden nacheinander abgehakt. */
  CHECK_START: 2000,
  CHECK_INTERVAL: 500,
  /** "Alles eingekauft"-Badge einblenden. */
  BADGE_SHOW: 6500,
  /** Interner Reset (Inhalt zurücksetzen, Karte bleibt sichtbar). */
  RESET: 9000,
};

/**
 * Berechnet den Animations-Zustand für einen bestimmten Zeitpunkt.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Objekt mit Sichtbarkeits- und Check-Informationen.
 */
const getAnimationState = (elapsed: number) => {
  // Wie viele Artikel sind bereits sichtbar (gestaffeltes Einblenden)
  let visibleCount = 0;
  if (elapsed >= PHASE.APPEAR_START) {
    const appearProgress = Math.min(
      (elapsed - PHASE.APPEAR_START) / PHASE.APPEAR_DURATION,
      1,
    );
    visibleCount = Math.ceil(appearProgress * TOTAL_ITEMS);
  }

  // Wie viele Artikel sind abgehakt
  let checkedCount = 0;
  if (elapsed >= PHASE.CHECK_START) {
    checkedCount = Math.min(
      Math.floor(
        (elapsed - PHASE.CHECK_START) / PHASE.CHECK_INTERVAL,
      ) + 1,
      TOTAL_ITEMS,
    );
  }

  // Badge sichtbar
  const showBadge = elapsed >= PHASE.BADGE_SHOW && elapsed < PHASE.RESET;

  return {visibleCount, checkedCount, showBadge};
};

/**
 * Animierte Einkaufslisten-Illustration für die Landing-Page.
 * Zeigt eine nach Abteilungen gruppierte Liste, deren Artikel
 * nacheinander erscheinen und abgehakt werden.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const ShoppingListAnimationBase = ({isActive}: {isActive: boolean}) => {
  const [state, setState] = React.useState(() => getAnimationState(0));
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

  // Globaler Index über alle Artikel (für gestaffeltes Einblenden / Abhaken)
  let globalIndex = 0;

  return (
    <Box
      role="img"
      aria-label="Animation: Einkaufsliste mit Abhak-Funktion"
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
        🛒 Einkaufsliste
      </Typography>

      {/* Abteilungen und Artikel */}
      {DEPARTMENTS.map((department) => (
        <Box key={department.name} sx={{mb: 1.5}}>
          {/* Abteilungs-Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.5,
            }}
          >
            <Box
              sx={(theme) => ({
                flex: 1,
                height: 1,
                bgcolor: theme.palette.divider,
              })}
            />
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
                fontSize: "0.65rem",
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              {department.name}
            </Typography>
            <Box
              sx={(theme) => ({
                flex: 1,
                height: 1,
                bgcolor: theme.palette.divider,
              })}
            />
          </Box>

          {/* Artikel */}
          {department.items.map((item) => {
            const itemIndex = globalIndex++;
            const isVisible = itemIndex < state.visibleCount;
            const isChecked = itemIndex < state.checkedCount;

            return (
              <Box
                key={item.name}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.75,
                  py: 0.5,
                  px: 0.5,
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible
                    ? "translateX(0)"
                    : "translateX(-12px)",
                  transition:
                    "opacity 0.3s ease, transform 0.3s ease",
                }}
              >
                {/* Checkbox */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    color: isChecked ? "primary.main" : "action.disabled",
                    transform: isChecked ? "scale(1)" : "scale(1)",
                    transition: "color 0.2s ease, transform 0.2s ease",
                    // Kurzer Puls-Effekt beim Abhaken
                    "@keyframes checkPulse": {
                      "0%": {transform: "scale(1)"},
                      "50%": {transform: "scale(1.3)"},
                      "100%": {transform: "scale(1)"},
                    },
                    animation: isChecked ? "checkPulse 0.3s ease" : "none",
                  }}
                >
                  {isChecked ? (
                    <CheckBoxIcon sx={{fontSize: 18}} />
                  ) : (
                    <CheckBoxOutlineBlankIcon sx={{fontSize: 18}} />
                  )}
                </Box>

                {/* Menge + Einheit */}
                <Typography
                  variant="body2"
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    minWidth: 32,
                    textAlign: "right",
                    color: isChecked ? "text.disabled" : "text.primary",
                    textDecoration: isChecked ? "line-through" : "none",
                    transition: "color 0.3s ease",
                  }}
                >
                  {item.quantity}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    minWidth: 20,
                    color: isChecked ? "text.disabled" : "text.secondary",
                    textDecoration: isChecked ? "line-through" : "none",
                    transition: "color 0.3s ease",
                  }}
                >
                  {item.unit}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: isChecked ? "text.disabled" : "text.primary",
                    textDecoration: isChecked ? "line-through" : "none",
                    transition: "color 0.3s ease",
                  }}
                >
                  {item.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
      ))}

      {/* "Alles eingekauft"-Badge */}
      <Box
        sx={(_theme) => ({
          display: "flex",
          justifyContent: "center",
          mt: 1,
          opacity: state.showBadge ? 1 : 0,
          transform: state.showBadge ? "scale(1)" : "scale(0.9)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        })}
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
          ✓ Alles eingekauft!
        </Typography>
      </Box>
    </Box>
  );
};

export const ShoppingListAnimation = React.memo(ShoppingListAnimationBase);
ShoppingListAnimation.displayName = "ShoppingListAnimation";
