import Fab from "@mui/material/Fab";

import {FeedbackIcon} from "../Shared/icons";
import {useCustomStyles} from "../../constants/styles";

/**
 * Schwebender Feedback-Button — wird von Sentry als Ankerpunkt für
 * das Feedback-Formular verwendet (`id="custom-feedback-button"`).
 *
 * @returns Ein kleiner sekundärer FAB mit Feedback-Icon.
 */
const FeedbackFab = () => {
  const classes = useCustomStyles();

  return (
    <Fab
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
