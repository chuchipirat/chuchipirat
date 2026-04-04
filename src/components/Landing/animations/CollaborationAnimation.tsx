import React from "react";
import {Box, Typography} from "@mui/material";
import {alpha} from "@mui/system";
import CircleIcon from "@mui/icons-material/Circle";

/** Ein Benutzer mit Name und Akzentfarbe. */
type CollabUser = {
  name: string;
  color: string;
};

/** Die drei Benutzer, die nacheinander beitreten. */
const USERS: CollabUser[] = [
  {name: "Sarah", color: "#1976d2"},
  {name: "Marco", color: "#e65100"},
  {name: "Lisa", color: "#2e7d32"},
];

/** Ein Aktivitäts-Eintrag im Event. */
type ActivityRow = {
  emoji: string;
  label: string;
};

/** Bereiche des Events, die bearbeitet werden. */
const ACTIVITIES: ActivityRow[] = [
  {emoji: "📅", label: "Menüplan"},
  {emoji: "🛒", label: "Einkaufsliste"},
  {emoji: "📝", label: "Notizen"},
];

/** Der Text, der in der Notizen-Zeile getippt wird. */
const NOTE_TEXT = "Apéro nicht vergessen!";

/** Gesamtdauer eines Animationszyklus in ms. */
const CYCLE_DURATION = 10000;

/** Zeitpunkte der Animationsphasen in ms. */
const PHASE = {
  MARCO_JOIN: 1000,
  TOAST_MARCO_END: 2000,
  SARAH_EDIT: 2200,
  SARAH_DONE: 3000,
  MARCO_EDIT: 3500,
  MARCO_DONE: 4300,
  NOTE_TYPE_START: 5000,
  NOTE_TYPE_END: 6500,
  LISA_JOIN: 7000,
  TOAST_LISA_END: 8000,
};

/** Animations-Zustand für einen Zeitpunkt. */
type AnimationState = {
  /** Anzahl sichtbarer Benutzer (1–3). */
  onlineCount: number;
  /** Aktiver Toast-Text oder leer. */
  toastText: string;
  /** Ob Sarah gerade den Menüplan bearbeitet. */
  sarahEditing: boolean;
  /** Ob Sarahs Bearbeitung abgeschlossen ist. */
  sarahDone: boolean;
  /** Ob Marco gerade die Einkaufsliste bearbeitet. */
  marcoEditing: boolean;
  /** Ob Marcos Bearbeitung abgeschlossen ist. */
  marcoDone: boolean;
  /** Anzahl sichtbarer Zeichen im Notizen-Text. */
  noteChars: number;
};

/**
 * Berechnet den Animations-Zustand für einen bestimmten Zeitpunkt.
 *
 * @param elapsed - Vergangene Zeit seit Zyklusbeginn in ms.
 * @returns Zustandsobjekt für die Darstellung.
 */
const getAnimationState = (elapsed: number): AnimationState => {
  // Benutzer treten bei
  let onlineCount = 1; // Sarah ist immer da
  if (elapsed >= PHASE.MARCO_JOIN) onlineCount = 2;
  if (elapsed >= PHASE.LISA_JOIN) onlineCount = 3;

  // Toast-Benachrichtigungen
  let toastText = "";
  if (elapsed >= PHASE.MARCO_JOIN && elapsed < PHASE.TOAST_MARCO_END) {
    toastText = "Marco ist beigetreten";
  }
  if (elapsed >= PHASE.LISA_JOIN && elapsed < PHASE.TOAST_LISA_END) {
    toastText = "Lisa ist beigetreten";
  }

  // Sarah bearbeitet Menüplan
  const sarahEditing =
    elapsed >= PHASE.SARAH_EDIT && elapsed < PHASE.MARCO_EDIT;
  const sarahDone = elapsed >= PHASE.SARAH_DONE;

  // Marco bearbeitet Einkaufsliste
  const marcoEditing =
    elapsed >= PHASE.MARCO_EDIT && elapsed < PHASE.NOTE_TYPE_START;
  const marcoDone = elapsed >= PHASE.MARCO_DONE;

  // Notizen-Text tippen
  let noteChars = 0;
  if (elapsed >= PHASE.NOTE_TYPE_START && elapsed < PHASE.NOTE_TYPE_END) {
    const progress =
      (elapsed - PHASE.NOTE_TYPE_START) /
      (PHASE.NOTE_TYPE_END - PHASE.NOTE_TYPE_START);
    noteChars = Math.floor(progress * NOTE_TEXT.length);
  } else if (elapsed >= PHASE.NOTE_TYPE_END) {
    noteChars = NOTE_TEXT.length;
  }

  return {
    onlineCount,
    toastText,
    sarahEditing,
    sarahDone,
    marcoEditing,
    marcoDone,
    noteChars,
  };
};

/**
 * Animierte Kollaborations-Illustration für die Landing-Page.
 * Zeigt ein Event, in dem mehrere Benutzer gleichzeitig arbeiten —
 * Präsenz-Indikatoren, Live-Bearbeitungen und Beitritts-Benachrichtigungen.
 *
 * @param props.isActive - Ob die Animation laufen soll.
 */
const CollaborationAnimationBase = ({isActive}: {isActive: boolean}) => {
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

  const visibleUsers = USERS.slice(0, state.onlineCount);

  return (
    <Box
      role="img"
      aria-label="Animation: Gemeinsames Planen in Echtzeit"
      sx={(theme) => ({
        bgcolor: "background.paper",
        borderRadius: 3,
        boxShadow: 1,
        border: `1px solid ${theme.palette.divider}`,
        p: {xs: 1.5, md: 2},
        maxWidth: 400,
        mx: "auto",
        position: "relative",
        overflow: "hidden",
      })}
    >
      {/* Event-Titel */}
      <Typography variant="subtitle2" sx={{fontWeight: 700, mb: 1}}>
        🏕️ Sommerlager {new Date().getFullYear()}
      </Typography>

      {/* Präsenz-Indikatoren */}
      <Box sx={{display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap"}}>
        {visibleUsers.map((user, index) => (
          <Box
            key={user.name}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              // Neue Benutzer poppen ein
              opacity: index < state.onlineCount ? 1 : 0,
              transform:
                index < state.onlineCount ? "scale(1)" : "scale(0.7)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
            }}
          >
            <CircleIcon sx={{fontSize: 8, color: user.color}} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                fontSize: {xs: "0.65rem", md: "0.7rem"},
                color: user.color,
              }}
            >
              {user.name}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Aktivitäts-Zeilen */}
      <Box
        sx={(theme) => ({
          borderRadius: 1.5,
          border: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        })}
      >
        {ACTIVITIES.map((activity, index) => {
          // Bestimme, ob ein Benutzer diese Zeile bearbeitet
          const isMenuplan = index === 0;
          const isShoppingList = index === 1;
          const isNotes = index === 2;

          const editingUser = isMenuplan && state.sarahEditing
            ? USERS[0]
            : isShoppingList && state.marcoEditing
              ? USERS[1]
              : null;

          const isDone =
            (isMenuplan && state.sarahDone) ||
            (isShoppingList && state.marcoDone);

          const isGlowing = !!editingUser;

          return (
            <Box
              key={activity.label}
              sx={(theme) => ({
                px: 1.5,
                py: 1,
                borderBottom:
                  index < ACTIVITIES.length - 1
                    ? `1px solid ${theme.palette.divider}`
                    : "none",
                bgcolor: isGlowing
                  ? alpha(editingUser!.color, 0.06)
                  : "transparent",
                transition: "background-color 0.4s ease",
                // Glow-Effekt bei aktiver Bearbeitung
                boxShadow: isGlowing
                  ? `inset 3px 0 0 ${editingUser!.color}`
                  : "inset 3px 0 0 transparent",
              })}
            >
              {/* Zeilen-Header mit optionalem Benutzer-Tag */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.25,
                }}
              >
                <Box sx={{display: "flex", alignItems: "center", gap: 0.75}}>
                  <Typography sx={{fontSize: "0.85rem", lineHeight: 1}}>
                    {activity.emoji}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{fontWeight: 600, fontSize: {xs: "0.7rem", md: "0.8rem"}}}
                  >
                    {activity.label}
                  </Typography>
                </Box>

                {/* Benutzer-Tag */}
                {editingUser && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: editingUser.color,
                      fontWeight: 600,
                      fontSize: "0.6rem",
                      opacity: 1,
                      transition: "opacity 0.3s ease",
                    }}
                  >
                    {editingUser.name}
                  </Typography>
                )}
              </Box>

              {/* Status / Inhalt */}
              {isNotes ? (
                <Box sx={{display: "flex", alignItems: "center", minHeight: 20}}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontStyle: "italic",
                      fontSize: {xs: "0.6rem", md: "0.7rem"},
                    }}
                  >
                    {state.noteChars > 0
                      ? `"${NOTE_TEXT.slice(0, state.noteChars)}"`
                      : ""}
                  </Typography>
                  {state.noteChars > 0 && state.noteChars < NOTE_TEXT.length && (
                    <Box
                      sx={{
                        width: 2,
                        height: 12,
                        bgcolor: USERS[2].color,
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
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: {xs: "0.6rem", md: "0.65rem"},
                    color: isDone ? "success.main" : "text.disabled",
                    fontWeight: isDone ? 600 : 400,
                    opacity: isDone ? 1 : 0,
                    transition: "opacity 0.3s ease",
                  }}
                >
                  ✓ aktualisiert
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Toast-Benachrichtigung */}
      <Box
        sx={(theme) => ({
          position: "absolute",
          bottom: theme.spacing(1),
          left: "50%",
          transform: state.toastText
            ? "translate(-50%, 0)"
            : "translate(-50%, 20px)",
          opacity: state.toastText ? 1 : 0,
          transition: "transform 0.3s ease, opacity 0.3s ease",
          bgcolor: alpha(theme.palette.common.black, 0.8),
          color: "common.white",
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          whiteSpace: "nowrap",
        })}
      >
        <Typography
          variant="caption"
          sx={{fontSize: "0.6rem", fontWeight: 600}}
        >
          🟢 {state.toastText}
        </Typography>
      </Box>
    </Box>
  );
};

export const CollaborationAnimation = React.memo(CollaborationAnimationBase);
CollaborationAnimation.displayName = "CollaborationAnimation";
