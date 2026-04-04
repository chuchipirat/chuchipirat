import {
  PaletteOptions,
  SimplePaletteColorOptions,
} from "@mui/material/styles";
import {Utils, Environment} from "../Shared/utils.class";
import {red} from "@mui/material/colors";

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
  primary: SimplePaletteColorOptions
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
    light: {main: "#006064", light: "#428e92", dark: "#00363a", contrastText: "#fff"},
    dark: {main: "#00bcd4", light: "#fff", dark: "#fff", contrastText: "#000"},
  },
  test: {
    light: {main: "#6a1b9a", light: "#8748ae", dark: "#4a126b", contrastText: "#fff"},
    dark: {main: "#AB47BC", light: "#E1BEE7", dark: "#9C27B0", contrastText: "#fff"},
  },
};

/**
 * Gibt die MUI-Palette passend zur aktuellen Umgebung und zum
 * bevorzugten Farbschema des Benutzers zurück.
 *
 * In der Test-Umgebung wird ein lilafarbenes Theme verwendet, damit
 * Test und Produktion visuell sofort unterscheidbar sind.
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
  const env = Utils.getEnvironment() === Environment.test ? "test" : "prod";
  return buildPalette(mode, PRIMARY_COLORS[env][mode]);
};

export {getTheme};
