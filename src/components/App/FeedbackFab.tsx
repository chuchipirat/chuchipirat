import {useEffect, useRef} from "react";
import Fab from "@mui/material/Fab";
import {useTheme} from "@mui/material/styles";
import * as Sentry from "@sentry/react";

import {FeedbackIcon} from "../Shared/icons";
import {useCustomStyles} from "../../constants/styles";
import {FEEDBACK as TEXT_FEEDBACK} from "../../constants/text";

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
  const theme = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Feedback-Formular an den Button hängen, sobald er im DOM ist. Abhängig von
  // `theme`, damit die Formularfarben dem Light-/Dark-Wechsel folgen.
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const feedback = Sentry.feedbackIntegration({autoInject: false});
    const detach = feedback.attachTo(button, {
      formTitle: TEXT_FEEDBACK.title,
      colorScheme: "system",
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
      themeLight: {
        foreground: theme.palette.text.primary,
        background: theme.palette.background.default,
        accentBackground: theme.palette.primary.main,
        successColor: theme.palette.success.main,
        errorColor: theme.palette.error.main,
      },
      themeDark: {
        foreground: "#fff",
        background: "#121212",
        accentBackground: "#00bcd4",
        accentForeground: "#000",
        successColor: "#4caf50",
        errorColor: "#f44336",
      },
    });

    return detach;
  }, [theme]);

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
