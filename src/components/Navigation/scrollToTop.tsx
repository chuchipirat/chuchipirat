import {useEffect} from "react";
import {useLocation} from "react-router";

/**
 * Hook-Komponente für automatisches Scrollen nach oben bei Routenwechsel.
 *
 * Wird in der App-Wurzel eingebunden und sorgt dafür, dass bei jedem
 * Pfadwechsel die Seite sanft nach oben scrollt.
 *
 * @returns `null` — rendert kein JSX.
 */
export const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({top: 0, behavior: "smooth"});
  }, [location.pathname]);

  return null;
};
