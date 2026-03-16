/**
 * Context für die Hervorhebung von Materiallisten-Items, die durch einen
 * anderen Benutzer geändert wurden (via Supabase Realtime).
 *
 * Enthält ein Set von Item-IDs, die kurzzeitig mit einer Glow-Animation
 * hervorgehoben werden sollen. Das Set wird nach 2000ms automatisch geleert.
 */
import React from "react";

/**
 * React Context mit den IDs der aktuell hervorgehobenen Items.
 *
 * @example
 * const highlightedIds = useContext(HighlightedMaterialListItemContext);
 * const isHighlighted = highlightedIds.has(item.id);
 */
export const HighlightedMaterialListItemContext = React.createContext<Set<string>>(
  new Set(),
);
