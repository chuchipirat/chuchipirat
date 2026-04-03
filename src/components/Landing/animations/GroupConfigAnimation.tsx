import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";

/** Diät-Spalte mit Emoji und Name. */
type DietColumn = {
  emoji: string;
  name: string;
};

/** Unverträglichkeits-Zeile mit Emoji und Name. */
type IntoleranceRow = {
  emoji: string;
  name: string;
};

/** Spalten (Diäten). Die dritte Spalte wird animiert eingeblendet. */
const DIETS: DietColumn[] = [
  {emoji: "🥩", name: "Fleisch"},
  {emoji: "🥕", name: "Vegetarisch"},
  {emoji: "🌱", name: "Vegan"},
];

/** Zeilen (Unverträglichkeiten). */
const INTOLERANCES: IntoleranceRow[] = [
  {emoji: "✅", name: "Ohne Unvertr."},
  {emoji: "🥛", name: "Laktoseintol."},
  {emoji: "🌾", name: "Glutenunvert."},
];

/**
 * Portionen-Matrix: [intolerance][diet] — Werte für die ersten 2 Diäten,
 * dann die dritte Spalte (Vegan) separat.
 */
const BASE_PORTIONS: number[][] = [
  [12, 6],
  [2, 4],
  [0, 2],
];

/** Portionen für die Vegan-Spalte (wird später eingeblendet). */
const VEGAN_PORTIONS: number[] = [3, 1, 0];

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 10000;

/** Reihenfolge, in der die Basiszellen gefüllt werden (Zeile, Spalte). */
const FILL_ORDER: [number, number][] = [
  [0, 0], [0, 1],
  [1, 0], [1, 1],
  [2, 0], [2, 1],
];

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  FILL_START: 1000,
  FILL_INTERVAL: 400,
  HOLD_AFTER_FILL: 3800,
  VEGAN_SLIDE_IN: 4200,
  VEGAN_FILL_START: 5000,
  VEGAN_FILL_INTERVAL: 400,
  HOLD_FINAL: 7500,
};

/** Ergebnis der Zustandsberechnung für einen Zeitpunkt. */
type AnimationState = {
  /** Wie viele Basiszellen (von 6) sind bereits gefüllt. */
  filledBaseCount: number;
  /** Ob die Vegan-Spalte sichtbar ist. */
  veganVisible: boolean;
  /** Wie viele Vegan-Zellen (von 3) sind gefüllt. */
  filledVeganCount: number;
  /** Aktueller Zeitpunkt (für Highlight-Effekte). */
  elapsed: number;
};

/**
 * Berechnet den Animations-Zustand für einen bestimmten Zeitpunkt.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Zustandsobjekt für die Darstellung.
 */
const getAnimationState = (elapsed: number): AnimationState => {
  // Basiszellen füllen
  let filledBaseCount = 0;
  if (elapsed >= PHASE.FILL_START) {
    filledBaseCount = Math.min(
      Math.floor((elapsed - PHASE.FILL_START) / PHASE.FILL_INTERVAL) + 1,
      FILL_ORDER.length,
    );
  }

  // Vegan-Spalte einblenden
  const veganVisible = elapsed >= PHASE.VEGAN_SLIDE_IN;

  // Vegan-Zellen füllen
  let filledVeganCount = 0;
  if (elapsed >= PHASE.VEGAN_FILL_START) {
    filledVeganCount = Math.min(
      Math.floor(
        (elapsed - PHASE.VEGAN_FILL_START) / PHASE.VEGAN_FILL_INTERVAL,
      ) + 1,
      VEGAN_PORTIONS.length,
    );
  }

  return {filledBaseCount, veganVisible, filledVeganCount, elapsed};
};

/**
 * Prüft, ob eine Basiszelle zum aktuellen Zeitpunkt gefüllt ist.
 *
 * @param row - Zeilenindex.
 * @param col - Spaltenindex.
 * @param state - Aktueller Animations-Zustand.
 * @returns `true` wenn die Zelle einen Wert anzeigt.
 */
const isBaseCellFilled = (
  row: number,
  col: number,
  state: AnimationState,
): boolean => {
  const orderIndex = FILL_ORDER.findIndex(
    ([fillRow, fillCol]) => fillRow === row && fillCol === col,
  );
  return orderIndex !== -1 && orderIndex < state.filledBaseCount;
};

/**
 * Prüft, ob eine Zelle gerade frisch befüllt wurde (für Highlight).
 *
 * @param fillIndex - Index in der Füllreihenfolge.
 * @param phaseStart - Startzeit der Phase.
 * @param interval - Intervall zwischen Zellen.
 * @param elapsed - Aktuelle Zykluszeit.
 * @returns `true` wenn die Zelle in den letzten 300ms befüllt wurde.
 */
const isRecentlyFilled = (
  fillIndex: number,
  phaseStart: number,
  interval: number,
  elapsed: number,
): boolean => {
  const fillTime = phaseStart + fillIndex * interval;
  return elapsed >= fillTime && elapsed < fillTime + 300;
};

/**
 * Berechnet die Zeilensumme (über alle sichtbaren Diäten).
 *
 * @param row - Zeilenindex.
 * @param state - Aktueller Animations-Zustand.
 * @returns Summe der Portionen in dieser Zeile.
 */
const getRowTotal = (row: number, state: AnimationState): number => {
  let total = 0;
  for (let col = 0; col < BASE_PORTIONS[row].length; col++) {
    if (isBaseCellFilled(row, col, state)) {
      total += BASE_PORTIONS[row][col];
    }
  }
  if (state.veganVisible && row < state.filledVeganCount) {
    total += VEGAN_PORTIONS[row];
  }
  return total;
};

/**
 * Berechnet die Spaltensumme (über alle Unverträglichkeiten).
 *
 * @param col - Spaltenindex (0/1 = Basis, 2 = Vegan).
 * @param state - Aktueller Animations-Zustand.
 * @returns Summe der Portionen in dieser Spalte.
 */
const getColTotal = (col: number, state: AnimationState): number => {
  let total = 0;
  if (col < 2) {
    for (let row = 0; row < INTOLERANCES.length; row++) {
      if (isBaseCellFilled(row, col, state)) {
        total += BASE_PORTIONS[row][col];
      }
    }
  } else {
    // Vegan-Spalte
    for (let row = 0; row < state.filledVeganCount; row++) {
      total += VEGAN_PORTIONS[row];
    }
  }
  return total;
};

/**
 * Berechnet die Gesamtsumme aller sichtbaren Portionen.
 *
 * @param state - Aktueller Animations-Zustand.
 * @returns Gesamtanzahl Portionen.
 */
const getGrandTotal = (state: AnimationState): number => {
  let total = 0;
  for (let row = 0; row < INTOLERANCES.length; row++) {
    total += getRowTotal(row, state);
  }
  return total;
};

/**
 * Animierte Gruppen-Konfiguration für die Landing-Page.
 * Zeigt eine Matrix mit Diäten (Spalten) und Unverträglichkeiten (Zeilen),
 * die sich schrittweise mit Portionen füllt. Eine dritte Diät-Spalte
 * (Vegan) wird dynamisch eingeblendet.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const GroupConfigAnimationBase = ({isActive}: {isActive: boolean}) => {
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

  // Sichtbare Diäten (2 oder 3)
  const visibleDiets = state.veganVisible ? DIETS : DIETS.slice(0, 2);
  const grandTotal = getGrandTotal(state);

  return (
    <Box
      role="img"
      aria-label="Animation: Gruppen-Konfiguration mit Diäten und Unverträglichkeiten"
      sx={(theme) => ({
        bgcolor: "background.paper",
        borderRadius: 3,
        boxShadow: 1,
        border: `1px solid ${theme.palette.divider}`,
        p: {xs: 1.5, md: 2},
        maxWidth: 420,
        mx: "auto",
      })}
    >
      {/* Titel */}
      <Typography variant="subtitle2" sx={{fontWeight: 700, mb: 1.5}}>
        ⚙️ Gruppen-Konfiguration
      </Typography>

      {/* Tabelle */}
      <Box
        sx={(theme) => ({
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        })}
      >
        {/* Header-Zeile: Diät-Spalten */}
        <Box
          sx={(theme) => ({
            display: "flex",
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          })}
        >
          {/* Leere Ecke */}
          <Box sx={{minWidth: {xs: 80, md: 100}, flexShrink: 0}} />

          {/* Diät-Header */}
          {visibleDiets.map((diet, index) => (
            <Box
              key={diet.name}
              sx={{
                flex: 1,
                textAlign: "center",
                py: 0.75,
                px: 0.5,
                // Vegan-Spalte gleitet ein
                opacity:
                  index === 2
                    ? state.elapsed >= PHASE.VEGAN_SLIDE_IN
                      ? 1
                      : 0
                    : 1,
                transform:
                  index === 2
                    ? state.elapsed >= PHASE.VEGAN_SLIDE_IN
                      ? "translateX(0)"
                      : "translateX(20px)"
                    : "none",
                transition: "opacity 0.4s ease, transform 0.4s ease",
              }}
            >
              <Typography
                sx={{fontSize: "0.85rem", lineHeight: 1, mb: 0.25}}
              >
                {diet.emoji}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  fontSize: {xs: "0.55rem", md: "0.65rem"},
                  lineHeight: 1.2,
                }}
              >
                {diet.name}
              </Typography>
            </Box>
          ))}

          {/* Total-Header */}
          <Box
            sx={{
              minWidth: {xs: 36, md: 44},
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography
              variant="caption"
              sx={{fontWeight: 700, fontSize: "0.6rem", color: "text.secondary"}}
            >
              Total
            </Typography>
          </Box>
        </Box>

        {/* Datenzeilen: eine pro Unverträglichkeit */}
        {INTOLERANCES.map((intolerance, rowIndex) => {
          const rowTotal = getRowTotal(rowIndex, state);

          return (
            <Box
              key={intolerance.name}
              sx={(theme) => ({
                display: "flex",
                borderBottom:
                  rowIndex < INTOLERANCES.length - 1
                    ? `1px solid ${theme.palette.divider}`
                    : "none",
              })}
            >
              {/* Zeilen-Label */}
              <Box
                sx={{
                  minWidth: {xs: 80, md: 100},
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography sx={{fontSize: "0.75rem", lineHeight: 1}}>
                  {intolerance.emoji}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: {xs: "0.55rem", md: "0.6rem"},
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {intolerance.name}
                </Typography>
              </Box>

              {/* Portionen-Zellen */}
              {visibleDiets.map((_, colIndex) => {
                const isVegan = colIndex === 2;
                let cellValue = 0;
                let isFilled = false;
                let isNew = false;

                if (isVegan) {
                  isFilled = rowIndex < state.filledVeganCount;
                  cellValue = isFilled ? VEGAN_PORTIONS[rowIndex] : 0;
                  isNew = isRecentlyFilled(
                    rowIndex,
                    PHASE.VEGAN_FILL_START,
                    PHASE.VEGAN_FILL_INTERVAL,
                    state.elapsed,
                  );
                } else {
                  isFilled = isBaseCellFilled(rowIndex, colIndex, state);
                  cellValue = isFilled
                    ? BASE_PORTIONS[rowIndex][colIndex]
                    : 0;
                  const orderIdx = FILL_ORDER.findIndex(
                    ([fillRow, fillCol]) =>
                      fillRow === rowIndex && fillCol === colIndex,
                  );
                  isNew =
                    orderIdx !== -1 &&
                    isRecentlyFilled(
                      orderIdx,
                      PHASE.FILL_START,
                      PHASE.FILL_INTERVAL,
                      state.elapsed,
                    );
                }

                return (
                  <Box
                    key={colIndex}
                    sx={(_theme) => ({
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      py: 0.5,
                      px: 0.25,
                      // Einblend-Animation für Vegan-Spalte
                      opacity: isVegan
                        ? state.elapsed >= PHASE.VEGAN_SLIDE_IN
                          ? 1
                          : 0
                        : 1,
                      transition: "opacity 0.4s ease",
                    })}
                  >
                    <Box
                      sx={(theme) => ({
                        width: {xs: 32, md: 40},
                        height: {xs: 24, md: 28},
                        borderRadius: 0.75,
                        border: `1px solid ${
                          isFilled
                            ? alpha(theme.palette.primary.main, 0.3)
                            : theme.palette.divider
                        }`,
                        bgcolor: isNew
                          ? alpha(theme.palette.primary.main, 0.15)
                          : isFilled
                            ? alpha(theme.palette.primary.main, 0.04)
                            : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition:
                          "background-color 0.3s ease, border-color 0.3s ease",
                        transform: isNew ? "scale(1.1)" : "scale(1)",
                      })}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: {xs: "0.65rem", md: "0.75rem"},
                          color: isFilled
                            ? "text.primary"
                            : "text.disabled",
                        }}
                      >
                        {cellValue}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}

              {/* Zeilen-Total */}
              <Box
                sx={{
                  minWidth: {xs: 36, md: 44},
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: {xs: "0.65rem", md: "0.75rem"},
                    color: rowTotal > 0 ? "primary.main" : "text.disabled",
                    transition: "color 0.3s ease",
                  }}
                >
                  {rowTotal}
                </Typography>
              </Box>
            </Box>
          );
        })}

        {/* Total-Zeile */}
        <Box
          sx={(theme) => ({
            display: "flex",
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          })}
        >
          {/* "Total" Label */}
          <Box
            sx={{
              minWidth: {xs: 80, md: 100},
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{fontWeight: 700, fontSize: "0.6rem"}}
            >
              Total
            </Typography>
          </Box>

          {/* Spalten-Totals */}
          {visibleDiets.map((_, colIndex) => {
            const colTotal = getColTotal(colIndex, state);
            return (
              <Box
                key={colIndex}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 0.5,
                  opacity:
                    colIndex === 2
                      ? state.elapsed >= PHASE.VEGAN_SLIDE_IN
                        ? 1
                        : 0
                      : 1,
                  transition: "opacity 0.4s ease",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    fontSize: {xs: "0.65rem", md: "0.75rem"},
                    color: colTotal > 0 ? "primary.main" : "text.disabled",
                    transition: "color 0.3s ease",
                  }}
                >
                  {colTotal}
                </Typography>
              </Box>
            );
          })}

          {/* Grand Total */}
          <Box
            sx={(_theme) => ({
              minWidth: {xs: 36, md: 44},
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 0.5,
            })}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                fontSize: {xs: "0.7rem", md: "0.8rem"},
                color: grandTotal > 0 ? "primary.main" : "text.disabled",
                transition: "color 0.3s ease",
              }}
            >
              {grandTotal}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export const GroupConfigAnimation = React.memo(GroupConfigAnimationBase);
GroupConfigAnimation.displayName = "GroupConfigAnimation";
