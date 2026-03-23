import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";

/** Ein Rezept, das in den Menüplan eingefügt wird. */
type MenuRecipe = {
  emoji: string;
  name: string;
};

/** Ein Einfüge-Schritt: welches Rezept wann in welche Zelle fällt. */
type DropStep = {
  recipe: MenuRecipe;
  day: number;
  meal: number;
  /** Zeitpunkt in ms, ab dem die Karte erscheint. */
  dropAt: number;
};

/** Spaltenüberschriften (Tage). */
const DAYS = ["Mo", "Di", "Mi"];

/** Zeilenüberschriften (Mahlzeiten, Schweizerdeutsch). */
const MEALS = ["Zmorge", "Zmittag", "Znacht"];

/** Reihenfolge, in der die Rezepte eingesetzt werden. */
const DROP_STEPS: DropStep[] = [
  {recipe: {emoji: "🥣", name: "Birchermüesli"}, day: 1, meal: 0, dropAt: 1000},
  {recipe: {emoji: "🍚", name: "Risotto"}, day: 0, meal: 1, dropAt: 1800},
  {recipe: {emoji: "🥗", name: "Salat"}, day: 1, meal: 2, dropAt: 2600},
  {recipe: {emoji: "🍝", name: "Pasta"}, day: 2, meal: 1, dropAt: 3400},
  {recipe: {emoji: "🧀", name: "Älplermagronen"}, day: 0, meal: 2, dropAt: 4200},
];

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 10000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  HOLD_END: 8500,
};

/**
 * Ermittelt das Rezept für eine bestimmte Zelle zum aktuellen Zeitpunkt.
 *
 * @param day - Spaltenindex (0-basiert).
 * @param meal - Zeilenindex (0-basiert).
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Das Rezept und ob es gerade erst erscheint, oder `null`.
 */
const getRecipeForCell = (
  day: number,
  meal: number,
  elapsed: number,
): {recipe: MenuRecipe; isNew: boolean} | null => {
  const step = DROP_STEPS.find(
    (dropStep) => dropStep.day === day && dropStep.meal === meal,
  );
  if (!step || elapsed < step.dropAt) return null;

  // "Neu" während der ersten 500ms nach dem Drop
  const isNew = elapsed - step.dropAt < 500;
  return {recipe: step.recipe, isNew};
};

/** Props für eine einzelne Menüplan-Zelle. */
type MenuCellProps = {
  day: number;
  meal: number;
  elapsed: number;
};

/**
 * Einzelne Zelle im Menüplan-Raster. Zeigt entweder einen leeren
 * Platzhalter oder ein Rezept mit Drop-Animation.
 *
 * @param props.day - Spaltenindex.
 * @param props.meal - Zeilenindex.
 * @param props.elapsed - Aktuelle Zykluszeit.
 */
const MenuCell = ({day, meal, elapsed}: MenuCellProps) => {
  const cellData = getRecipeForCell(day, meal, elapsed);

  return (
    <Box
      sx={(theme) => ({
        border: cellData
          ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
          : `1px dashed ${theme.palette.divider}`,
        borderRadius: 1,
        p: 0.75,
        minHeight: {xs: 48, md: 56},
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: cellData
          ? alpha(theme.palette.primary.main, 0.06)
          : "transparent",
        transition:
          "background-color 0.3s ease, border-color 0.3s ease",
      })}
    >
      {cellData ? (
        <Box
          sx={{
            textAlign: "center",
            transform: cellData.isNew
              ? "translateY(-12px)"
              : "translateY(0)",
            opacity: cellData.isNew ? 0.6 : 1,
            transition: "transform 0.4s ease-out, opacity 0.3s ease",
          }}
        >
          <Typography
            sx={{fontSize: {xs: "0.85rem", md: "1rem"}, lineHeight: 1}}
          >
            {cellData.recipe.emoji}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              lineHeight: 1.2,
              fontSize: {xs: "0.55rem", md: "0.65rem"},
              display: "block",
              mt: 0.25,
            }}
          >
            {cellData.recipe.name}
          </Typography>
        </Box>
      ) : (
        <Typography
          variant="caption"
          sx={{color: "text.disabled", fontSize: "0.6rem", letterSpacing: 2}}
        >
          · · ·
        </Typography>
      )}
    </Box>
  );
};

/**
 * Animierte Menüplan-Illustration für die Landing-Page.
 * Zeigt ein 3×3-Raster (Mo/Di/Mi × Zmorge/Zmittag/Znacht),
 * in das Rezeptkarten nacheinander hineinfallen.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const MenuplanAnimationBase = ({isActive}: {isActive: boolean}) => {
  const [elapsed, setElapsed] = React.useState(0);
  const animationRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isActive) return;

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const currentElapsed = (now - startTimeRef.current) % CYCLE_DURATION;
      setElapsed(currentElapsed);
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive]);

  return (
    <Box
      role="img"
      aria-label="Animation: Menüplan mit Rezepten befüllen"
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
        📅 Menüplan
      </Typography>

      {/* Tage-Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `56px repeat(${DAYS.length}, 1fr)`,
          gap: 0.5,
          mb: 0.5,
        }}
      >
        {/* Leere Ecke oben links */}
        <Box />
        {DAYS.map((day) => (
          <Typography
            key={day}
            variant="caption"
            sx={{
              fontWeight: 700,
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            {day}
          </Typography>
        ))}
      </Box>

      {/* Raster: Mahlzeiten × Tage */}
      {MEALS.map((mealName, mealIndex) => (
        <Box
          key={mealName}
          sx={{
            display: "grid",
            gridTemplateColumns: `56px repeat(${DAYS.length}, 1fr)`,
            gap: 0.5,
            mb: 0.5,
          }}
        >
          {/* Mahlzeit-Label */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: "text.secondary",
                fontSize: {xs: "0.6rem", md: "0.65rem"},
                lineHeight: 1.2,
              }}
            >
              {mealName}
            </Typography>
          </Box>

          {/* Zellen für jeden Tag */}
          {DAYS.map((_day, dayIndex) => (
            <MenuCell
              key={`${dayIndex}-${mealIndex}`}
              day={dayIndex}
              meal={mealIndex}
              elapsed={elapsed}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export const MenuplanAnimation = React.memo(MenuplanAnimationBase);
MenuplanAnimation.displayName = "MenuplanAnimation";
