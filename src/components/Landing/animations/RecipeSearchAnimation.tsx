import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

/** Daten für eine einzelne Rezept-Miniaturkarte. */
type MiniRecipe = {
  emoji: string;
  name: string;
  rating: number;
};

/** Alle Rezepte, die in der Animation angezeigt werden. */
const ALL_RECIPES: MiniRecipe[] = [
  {emoji: "🍝", name: "Pasta", rating: 4},
  {emoji: "🍚", name: "Risotto", rating: 3},
  {emoji: "🥗", name: "Salat", rating: 4},
  {emoji: "🍫", name: "Schoggi-Cake", rating: 5},
  {emoji: "🥣", name: "Birchermüesli", rating: 4},
  {emoji: "🍮", name: "Schoggi-Mousse", rating: 5},
];

/** Der Suchbegriff, der animiert eingetippt wird. */
const SEARCH_TERM = "Schoggi";

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 8000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  TYPE_START: 1000,
  TYPE_END: 3000,
  FILTER_HOLD: 5500,
  ERASE_END: 7000,
};

/**
 * Berechnet den aktuell sichtbaren Suchtext basierend auf der
 * verstrichenen Zeit im Animationszyklus.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Der aktuell angezeigte Suchtext.
 */
const getDisplayedText = (elapsed: number): string => {
  if (elapsed < PHASE.TYPE_START) return "";

  // Eintippen
  if (elapsed < PHASE.TYPE_END) {
    const typingProgress =
      (elapsed - PHASE.TYPE_START) / (PHASE.TYPE_END - PHASE.TYPE_START);
    const charCount = Math.floor(typingProgress * SEARCH_TERM.length);
    return SEARCH_TERM.slice(0, charCount);
  }

  // Halten
  if (elapsed < PHASE.FILTER_HOLD) return SEARCH_TERM;

  // Löschen
  if (elapsed < PHASE.ERASE_END) {
    const eraseProgress =
      (elapsed - PHASE.FILTER_HOLD) / (PHASE.ERASE_END - PHASE.FILTER_HOLD);
    const charCount = Math.floor(
      (1 - eraseProgress) * SEARCH_TERM.length,
    );
    return SEARCH_TERM.slice(0, charCount);
  }

  return "";
};

/**
 * Prüft, ob ein Rezept zum aktuellen Suchtext passt.
 *
 * @param recipe - Das Rezept.
 * @param searchText - Der aktuelle Suchtext.
 * @returns `true` wenn das Rezept sichtbar sein soll.
 */
const matchesSearch = (recipe: MiniRecipe, searchText: string): boolean => {
  if (searchText === "") return true;
  return recipe.name.toLowerCase().includes(searchText.toLowerCase());
};

/** Props für die Sternbewertungs-Komponente. */
type StarRatingProps = {
  /** Anzahl gefüllter Sterne (1–5). */
  rating: number;
};

/**
 * Zeigt eine kompakte Sternbewertung (5 Sterne) an.
 *
 * @param props.rating - Anzahl ausgefüllter Sterne.
 */
const StarRating = ({rating}: StarRatingProps) => (
  <Box sx={{display: "flex", gap: 0.25}}>
    {Array.from({length: 5}, (_, index) =>
      index < rating ? (
        <StarIcon
          key={index}
          sx={{fontSize: 12, color: "warning.main"}}
        />
      ) : (
        <StarBorderIcon
          key={index}
          sx={{fontSize: 12, color: "action.disabled"}}
        />
      ),
    )}
  </Box>
);

/** Anzahl Spalten im Karten-Raster. */
const GRID_COLUMNS = 3;

/**
 * Berechnet die Raster-Position (Spalte/Zeile) für eine Karte
 * basierend auf ihrem Index unter den sichtbaren Karten.
 *
 * @param visibleIndex - Laufender Index unter den sichtbaren Karten.
 * @returns Objekt mit `column` (0-basiert) und `row` (0-basiert).
 */
const getGridPosition = (visibleIndex: number) => ({
  column: visibleIndex % GRID_COLUMNS,
  row: Math.floor(visibleIndex / GRID_COLUMNS),
});

/** Props für eine einzelne Rezeptkarte. */
type RecipeCardProps = {
  /** Das darzustellende Rezept. */
  recipe: MiniRecipe;
  /** Ob die Karte aktuell sichtbar ist (passt zum Suchtext). */
  visible: boolean;
  /** Spaltenposition im Raster (0-basiert). */
  column: number;
  /** Zeilenposition im Raster (0-basiert). */
  row: number;
};

/**
 * Einzelne Mini-Rezeptkarte mit Emoji, Name und Sternbewertung.
 * Wird absolut positioniert und gleitet per CSS-Transition an die
 * berechnete Rasterposition. Nicht-sichtbare Karten werden ausgeblendet.
 *
 * @param props.recipe - Rezeptdaten.
 * @param props.visible - Steuert Sichtbarkeit mit Transition.
 * @param props.column - Zielspalte im Raster.
 * @param props.row - Zielzeile im Raster.
 */
const RecipeCard = ({recipe, visible, column, row}: RecipeCardProps) => {
  const widthPercent = 100 / GRID_COLUMNS;

  return (
    <Box
      sx={(theme) => {
        // Beide Achsen über transform steuern → diagonale Bewegung
        const gap = theme.spacing(1);
        const xOffset = `calc(${column} * (100% + ${gap}))`;
        const yOffset = `calc(${row} * (100% + ${gap}))`;
        const scale = visible ? "scale(1)" : "scale(0.85)";

        return {
          position: "absolute",
          top: 0,
          left: 0,
          width: `calc(${widthPercent}% - ${theme.spacing(0.67)})`,
          transform: `translate(${xOffset}, ${yOffset}) ${scale}`,
          opacity: visible ? 1 : 0,
          transition: "transform 0.4s ease, opacity 0.4s ease",
          // Unsichtbare Karten nicht klickbar
          pointerEvents: visible ? "auto" : "none",
          // Karten-Styling
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: "background.paper",
          p: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
        };
      }}
    >
      <Box
        sx={(theme) => ({
          width: "100%",
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 0.75,
          fontSize: {xs: "1.25rem", md: "1.5rem"},
        })}
      >
        {recipe.emoji}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.2,
          fontSize: {xs: "0.65rem", md: "0.75rem"},
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
        }}
      >
        {recipe.name}
      </Typography>
      <StarRating rating={recipe.rating} />
    </Box>
  );
};

/** Props für das Rezeptkarten-Raster. */
type RecipeGridProps = {
  /** Aktueller Suchtext zum Filtern der Karten. */
  searchText: string;
};

/**
 * Raster aller Rezeptkarten mit animierter Neupositionierung.
 * Sichtbare Karten gleiten lückenlos an ihre berechnete Position,
 * unsichtbare Karten werden ausgeblendet.
 *
 * @param props.searchText - Der aktuelle Suchtext.
 */
const RecipeGrid = ({searchText}: RecipeGridProps) => {
  // Sichtbare Karten ermitteln und Index zuweisen
  let visibleIndex = 0;
  const cardsWithPosition = ALL_RECIPES.map((recipe) => {
    const visible = matchesSearch(recipe, searchText);
    const position = visible
      ? getGridPosition(visibleIndex++)
      : getGridPosition(ALL_RECIPES.indexOf(recipe));
    return {recipe, visible, position};
  });

  // Feste Höhe: immer 2 Zeilen, damit die Seite nicht springt
  const totalRows = Math.ceil(ALL_RECIPES.length / GRID_COLUMNS);

  return (
    <Box
      sx={{
        position: "relative",
        height: totalRows * 108,
      }}
    >
      {cardsWithPosition.map(({recipe, visible, position}) => (
        <RecipeCard
          key={recipe.name}
          recipe={recipe}
          visible={visible}
          column={position.column}
          row={position.row}
        />
      ))}
    </Box>
  );
};

/**
 * Animierte Rezeptsuche-Illustration für die Landing-Page.
 * Zeigt eine vereinfachte Suchleiste und ein Raster von Rezeptkarten.
 * Der Suchbegriff wird automatisch eingetippt, filtert die Karten,
 * und wird wieder gelöscht — in einer Endlosschleife.
 *
 * Die Animation startet erst, wenn `isActive` auf `true` gesetzt wird
 * (gesteuert durch den Scroll-Reveal der übergeordneten Komponente).
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const RecipeSearchAnimationBase = ({isActive}: {isActive: boolean}) => {
  const [searchText, setSearchText] = React.useState("");
  const animationRef = React.useRef<number>(0);
  const startTimeRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!isActive) return;

    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTimeRef.current) % CYCLE_DURATION;
      setSearchText(getDisplayedText(elapsed));
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationRef.current);
  }, [isActive]);

  // Cursor blinkt nur wenn gerade getippt oder gehalten wird
  const showCursor = isActive;

  return (
    <Box
      role="img"
      aria-label="Animation: Rezeptsuche mit Filter"
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
      {/* Suchleiste */}
      <Box
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 1,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          px: 1.5,
          py: 0.75,
          mb: 2,
        })}
      >
        <SearchIcon sx={{color: "action.active", fontSize: 20}} />
        <Box sx={{flex: 1, display: "flex", alignItems: "center", minHeight: 24}}>
          <Typography
            variant="body2"
            sx={{
              color: searchText ? "text.primary" : "text.disabled",
              fontFamily: "inherit",
            }}
          >
            {searchText || "Rezept suchen..."}
          </Typography>
          {showCursor && (
            <Box
              sx={{
                width: 2,
                height: 16,
                bgcolor: "primary.main",
                ml: 0.25,
                "@keyframes blink": {
                  "0%, 100%": {opacity: 1},
                  "50%": {opacity: 0},
                },
                animation: "blink 1s step-end infinite",
              }}
            />
          )}
        </Box>
      </Box>

      {/* Rezeptkarten-Raster (relativ positioniert, Karten absolut) */}
      <RecipeGrid searchText={searchText} />
    </Box>
  );
};

export const RecipeSearchAnimation = React.memo(RecipeSearchAnimationBase);
RecipeSearchAnimation.displayName = "RecipeSearchAnimation";
