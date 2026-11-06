import {useEffect, useRef} from "react";
import Fab from "@mui/material/Fab";
import {createTheme} from "@mui/material/styles";
import * as Sentry from "@sentry/react";

import {FeedbackIcon} from "../Shared/icons";
import {useCustomStyles} from "../../constants/styles";
import {FEEDBACK as TEXT_FEEDBACK} from "../../constants/text";
import {getTheme} from "./customTheme";

/**
 * Farben des Sentry-Feedback-Formulars für einen Modus (hell oder dunkel).
 *
 * Eigener Typ, weil Sentry die Optionen von `feedbackIntegration` als `any`
 * typisiert und den eigentlichen Typ nur im nicht direkt installierten
 * `@sentry/core` exportiert. Die übrigen Felder (`boxShadow`, `outline`)
 * bleiben beim Sentry-Standard.
 *
 * @property foreground Textfarbe.
 * @property background Hintergrund des Formulars.
 * @property accentBackground Hintergrund von Knöpfen und Hervorhebungen.
 * @property accentForeground Textfarbe auf `accentBackground`.
 * @property successColor Farbe der Erfolgsmeldung.
 * @property errorColor Farbe von Fehlermeldungen.
 */
type FeedbackColors = {
  foreground: string;
  background: string;
  accentBackground: string;
  accentForeground: string;
  successColor: string;
  errorColor: string;
};

/**
 * Leitet die Formularfarben aus der App-Palette des gewünschten Modus ab.
 *
 * Nutzt `getTheme()`, damit die Umgebungsfarben (lila auf TEST) und der
 * Admin-Schalter «Originalfarben» auch im Feedback-Formular gelten.
 *
 * @param prefersDarkMode `true` für die Farben des Dunkelmodus.
 * @returns Farben für `themeLight` bzw. `themeDark` der Feedback-Integration.
 * @example
 * buildFeedbackTheme(false).accentBackground // "#006064" (PROD, hell)
 */
const buildFeedbackTheme = (prefersDarkMode: boolean): FeedbackColors => {
  const palette = createTheme({palette: getTheme(prefersDarkMode)}).palette;

  return {
    foreground: palette.text.primary,
    background: palette.background.default,
    accentBackground: palette.primary.main,
    accentForeground: palette.primary.contrastText,
    successColor: palette.success.main,
    errorColor: palette.error.main,
  };
};

/**
 * Schwebender Feedback-Button — öffnet beim Klick das Sentry-Feedback-Formular.
 *
 * Die Sentry-Feedback-Integration wird beim Mounten dieses Buttons per
 * `attachTo` direkt an das DOM-Element gehängt und beim Unmounten wieder
 * gelöst. Dadurch ist der Klick-Handler garantiert vorhanden, sobald der
 * Button sichtbar ist — unabhängig davon, auf welcher Route und nach welchem
 * Lazy-Load er erscheint. (Vorher hing das Attach an einem Effect in `App`,
 * der lief, bevor der Button im DOM war, und danach nie wieder → Klick ohne
 * Wirkung.)
 *
 * @returns Ein kleiner sekundärer FAB mit Feedback-Icon.
 */
const FeedbackFab = () => {
  const classes = useCustomStyles();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Einmal pro Mount; den Hell/Dunkel-Wechsel übernimmt Sentry
  // über colorScheme: "system"
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const feedback = Sentry.feedbackIntegration({
      autoInject: false,
      colorScheme: "system",
      themeLight: buildFeedbackTheme(false),
      themeDark: buildFeedbackTheme(true),
    });
    const detach = feedback.attachTo(button, {
      formTitle: TEXT_FEEDBACK.title,
      submitButtonLabel: TEXT_FEEDBACK.submitButton,
      cancelButtonLabel: TEXT_FEEDBACK.cancelButton,
      addScreenshotButtonLabel: TEXT_FEEDBACK.addScreenshotButton,
      removeScreenshotButtonLabel: TEXT_FEEDBACK.removeScreenshotButton,
      namePlaceholder: TEXT_FEEDBACK.namePlaceholder,
      emailPlaceholder: TEXT_FEEDBACK.emailPlaceholder,
      messageLabel: TEXT_FEEDBACK.messageLabel,
      messagePlaceholder: TEXT_FEEDBACK.messagePlaceholder,
      successMessageText: TEXT_FEEDBACK.successMessage,
      isRequiredLabel: TEXT_FEEDBACK.isRequired,
    });

    return detach;
  }, []);

  return (
    <Fab
      ref={buttonRef}
      id="custom-feedback-button"
      color="secondary"
      size="small"
      aria-label="Feedback geben"
      sx={classes.fabBottom}
    >
      <FeedbackIcon />
    </Fab>
  );
};

export {FeedbackFab};
