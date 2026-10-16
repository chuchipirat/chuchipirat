import {PaletteOptions, SimplePaletteColorOptions} from "@mui/material/styles";
import {Utils, Environment} from "../Shared/utils.class";
import {
  amber,
  blueGrey,
  indigo,
  lightGreen,
  orange,
  pink,
  red,
  teal,
} from "@mui/material/colors";
import {LocalStorageKey} from "../../constants/localStorage";

/** Gemeinsame Secondary- und Error-Farben für alle Themes. */
const SECONDARY: SimplePaletteColorOptions = {
  main: "#c6ff00",
  light: "#fdff58",
  dark: "#90cc00",
  contrastText: "#000",
};

/**
 * Erzeugt eine MUI-Palette aus Mode und Primary-Farben.
 *
 * @param mode Light- oder Dark-Modus.
 * @param primary Primary-Farbwerte.
 * @returns Fertige `PaletteOptions`.
 */
const buildPalette = (
  mode: "light" | "dark",
  primary: SimplePaletteColorOptions,
): PaletteOptions => ({
  mode,
  primary,
  secondary: SECONDARY,
  error: red,
});

/** Primary-Farben je Umgebung und Modus. */
const PRIMARY_COLORS: Record<
  "prod" | "test",
  {light: SimplePaletteColorOptions; dark: SimplePaletteColorOptions}
> = {
  prod: {
    light: {
      main: "#006064",
      light: "#428e92",
      dark: "#00363a",
      contrastText: "#fff",
    },
    dark: {main: "#00bcd4", light: "#fff", dark: "#fff", contrastText: "#000"},
  },
  test: {
    light: {
      main: "#6a1b9a",
      light: "#8748ae",
      dark: "#4a126b",
      contrastText: "#fff",
    },
    dark: {
      main: "#AB47BC",
      light: "#E1BEE7",
      dark: "#9C27B0",
      contrastText: "#fff",
    },
  },
};

/**
 * Gibt die MUI-Palette passend zur aktuellen Umgebung und zum
 * bevorzugten Farbschema des Benutzers zurück.
 *
 * In der Test-Umgebung wird ein lilafarbenes Theme verwendet, damit
 * Test und Produktion visuell sofort unterscheidbar sind. Community
 * Leader und Admins können dies über einen Menüpunkt in der
 * Navigationsleiste lokal überschreiben (z.B. für Screenshots), siehe
 * `LocalStorageKey.USE_ORIGINAL_COLOR_SCHEME`.
 *
 * @param prefersDarkMode `true` wenn der Benutzer Dark-Mode bevorzugt.
 * @returns `PaletteOptions` für `createTheme`.
 *
 * @example
 * const palette = getTheme(true);  // Dark-Mode-Palette
 * const theme = createTheme({ palette });
 */
const getTheme = (prefersDarkMode: boolean): PaletteOptions => {
  const mode = prefersDarkMode ? "dark" : "light";
  const useOriginalColorScheme =
    localStorage.getItem(LocalStorageKey.USE_ORIGINAL_COLOR_SCHEME) === "true";
  const env =
    !useOriginalColorScheme && Utils.getEnvironment() === Environment.test
      ? "test"
      : "prod";
  return buildPalette(mode, PRIMARY_COLORS[env][mode]);
};

/**
 * Kategorienfarben für Diagramme, z.B. die Verteilung nach Budget.
 *
 * @param categories - Farben für die einzelnen Kategorien, in fester Reihenfolge.
 * @param others - Neutrale Farbe für zusammengefasste Kategorien («Übrige»).
 */
type ChartCategoryColors = {
  categories: string[];
  others: string;
};

/**
 * Kategorienfarben je Modus. Bewusst getrennt von primary/secondary (Marke)
 * und warning/error/success (Bedeutung). Alle Kategorien haben mindestens
 * 3:1 Kontrast zum Hintergrund und bleiben auch bei Rot-Grün-Schwäche
 * unterscheidbar (geprüft 2026-10-16, Story 6.4).
 */
const CHART_CATEGORY_COLORS: Record<"light" | "dark", ChartCategoryColors> = {
  light: {
    categories: [
      teal[700],
      orange[900],
      indigo[400],
      pink[400],
      lightGreen[800],
    ],
    others: blueGrey[300],
  },
  dark: {
    categories: [
      teal[300],
      amber[300],
      indigo[200],
      pink[200],
      lightGreen[400],
    ],
    others: blueGrey[500],
  },
};

/**
 * Gibt die Kategorienfarben für Diagramme im gewünschten Modus zurück.
 * Mehr als fünf Kategorien lassen sich nicht sicher unterscheiden; weitere
 * werden in Diagrammen als «Übrige» zusammengefasst.
 *
 * @param mode - Light- oder Dark-Modus (`theme.palette.mode`).
 * @returns Fünf Kategorienfarben und die Farbe für «Übrige».
 * @example
 * const {categories, others} = getChartCategoryColors(theme.palette.mode);
 */
const getChartCategoryColors = (mode: "light" | "dark"): ChartCategoryColors =>
  CHART_CATEGORY_COLORS[mode];

export {getTheme, getChartCategoryColors};
export type {ChartCategoryColors};
