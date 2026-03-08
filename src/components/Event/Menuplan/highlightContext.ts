/**
 * Context für die Hervorhebung von Menüs, die durch einen anderen Benutzer
 * geändert wurden (via Supabase Realtime).
 *
 * Enthält ein Set von Menü-UIDs, die kurzzeitig mit einer Glow-Animation
 * hervorgehoben werden sollen. Das Set wird nach der Animationsdauer
 * automatisch geleert.
 */
import React from "react";

/**
 * React Context mit den UIDs der aktuell hervorgehobenen Menüs.
 *
 * @example
 * const highlightedUids = useContext(HighlightedMenueContext);
 * const isHighlighted = highlightedUids.has(menue.uid);
 */
export const HighlightedMenueContext = React.createContext<Set<string>>(
  new Set(),
);
