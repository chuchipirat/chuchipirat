import React from "react";

/** Standard-Optionen für den IntersectionObserver. */
const SCROLL_REVEAL_OPTIONS: IntersectionObserverInit = {threshold: 0.15};

/**
 * Wiederverwendbarer Hook, der erkennt, ob ein Element in den sichtbaren
 * Bereich gescrollt wurde. Einmalig: sobald sichtbar, bleibt `isVisible`
 * auf `true` (kein Flackern beim Zurückscrollen). Der Observer wird beim
 * Unmount automatisch getrennt.
 *
 * @param options - Optionale IntersectionObserver-Konfiguration.
 * @returns Objekt mit `elementRef` (an das Element binden) und `isVisible`.
 * @example
 * const {elementRef, isVisible} = useScrollReveal();
 * <div ref={elementRef}>{isVisible && <Content />}</div>
 */
export const useScrollReveal = (
  options: IntersectionObserverInit = SCROLL_REVEAL_OPTIONS,
) => {
  const elementRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
    // Optionen ändern sich in der Regel nicht, daher stabiler Effekt
  }, []);

  return {elementRef, isVisible};
};
