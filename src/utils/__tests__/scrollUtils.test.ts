/**
 * Unit-Tests für das Scrollen zu einem Element mit anschliessendem Fokus.
 *
 * Schwerpunkt: Ist im System «Bewegung reduzieren» eingeschaltet, springt die
 * Seite ohne Animation. Der Fokus folgt in jedem Fall, damit auch Tastatur-
 * und Screenreader-Nutzer:innen dort landen.
 */
import {prefersReducedMotion, scrollToElementAndFocus} from "../scrollUtils";

/**
 * Ersetzt `window.matchMedia` so, dass «Bewegung reduzieren» den gewünschten
 * Wert hat. jsdom kennt `matchMedia` nicht.
 *
 * @param reduce `true` = «Bewegung reduzieren» ist eingeschaltet.
 */
const mockReducedMotion = (reduce: boolean) => {
  window.matchMedia = jest.fn((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

/**
 * Baut ein Element im Dokument, dessen `scrollIntoView` aufgezeichnet wird.
 *
 * @returns Das Element und die Mock-Funktion für `scrollIntoView`.
 */
const buildTarget = () => {
  const element = document.createElement("div");
  element.tabIndex = -1;
  document.body.appendChild(element);
  const scrollIntoView = jest.fn();
  element.scrollIntoView = scrollIntoView;
  return {element, scrollIntoView};
};

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.body.innerHTML = "";
});

describe("prefersReducedMotion()", () => {
  it("ist true, wenn «Bewegung reduzieren» eingeschaltet ist", () => {
    mockReducedMotion(true);

    expect(prefersReducedMotion()).toBe(true);
  });

  it("ist false, wenn «Bewegung reduzieren» ausgeschaltet ist", () => {
    mockReducedMotion(false);

    expect(prefersReducedMotion()).toBe(false);
  });

  it("ist false, wenn der Browser `matchMedia` nicht kennt", () => {
    // @ts-expect-error -- Browser ohne matchMedia nachstellen
    delete window.matchMedia;

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("scrollToElementAndFocus()", () => {
  it("scrollt weich und mittig, wenn Bewegung erlaubt ist", () => {
    mockReducedMotion(false);
    const {element, scrollIntoView} = buildTarget();

    scrollToElementAndFocus(element);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("springt ohne Animation, wenn «Bewegung reduzieren» eingeschaltet ist", () => {
    mockReducedMotion(true);
    const {element, scrollIntoView} = buildTarget();

    scrollToElementAndFocus(element);

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
  });

  it("setzt den Fokus auf das Element, ohne ein zweites Mal zu scrollen", () => {
    mockReducedMotion(false);
    const {element} = buildTarget();
    const focus = jest.spyOn(element, "focus");

    scrollToElementAndFocus(element);

    expect(focus).toHaveBeenCalledWith({preventScroll: true});
    expect(document.activeElement).toBe(element);
  });

  it("tut nichts, wenn kein Element da ist", () => {
    expect(() => scrollToElementAndFocus(null)).not.toThrow();
  });
});
