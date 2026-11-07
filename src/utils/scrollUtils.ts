/**
 * Prüft, ob im System «Bewegung reduzieren» eingeschaltet ist.
 *
 * @returns `true`, wenn Animationen vermieden werden sollen; `false` auch
 *   dann, wenn der Browser `matchMedia` nicht kennt.
 * @example
 * prefersReducedMotion() // false bei Standard-Einstellungen
 */
export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Scrollt ein Element in die Mitte des Fensters und setzt danach den Fokus
 * darauf. Mittig statt oben, weil sonst die fixe AppBar den Anfang verdeckt.
 * Der Fokus folgt, damit auch Tastatur- und Screenreader-Nutzer:innen dort
 * weitermachen; das Element braucht dafür `tabIndex={-1}`.
 *
 * @param element Ziel-Element; bei `null` passiert nichts.
 * @example
 * scrollToElementAndFocus(donationFormRef.current);
 */
export const scrollToElementAndFocus = (element: HTMLElement | null): void => {
  if (!element) return;

  element.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  // sonst springt der Browser beim Fokussieren ohne Animation hin
  element.focus({preventScroll: true});
};
