import {useEffect} from "react";
import {useLocation} from "react-router";

/** SessionStorage-Schlüssel zum einmaligen Unterdrücken des Scroll-to-Top. */
const SKIP_SCROLL_TO_TOP_KEY = "skipScrollToTop";

/**
 * Hook-Komponente für automatisches Scrollen nach oben bei Routenwechsel.
 *
 * Wird in der App-Wurzel eingebunden und sorgt dafür, dass bei jedem
 * Pfadwechsel die Seite sanft nach oben scrollt.
 *
 * Wenn im sessionStorage der Schlüssel `skipScrollToTop` auf `"true"` steht,
 * wird das Scrollen einmalig übersprungen (z.B. bei Rückkehr zur Rezeptliste
 * mit gespeicherter Scroll-Position).
 *
 * @returns `null` — rendert kein JSX.
 */
export const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // Prüfen ob das Scroll-to-Top übersprungen werden soll
    if (sessionStorage.getItem(SKIP_SCROLL_TO_TOP_KEY) === "true") {
      sessionStorage.removeItem(SKIP_SCROLL_TO_TOP_KEY);
      return;
    }
    window.scrollTo({top: 0, behavior: "smooth"});
  }, [location.pathname]);

  return null;
};
