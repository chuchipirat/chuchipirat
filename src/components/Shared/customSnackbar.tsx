import React, {SyntheticEvent} from "react";

import {
  Alert,
  AlertColor,
  AlertProps,
  Fade,
  Snackbar,
  SnackbarCloseReason,
} from "@mui/material";

import {useCustomStyles} from "../../constants/styles";

/**
 * Zustand eines Snackbar-Elements (offen/geschlossen, Schweregrad, Nachricht).
 *
 * @param open Ob die Snackbar sichtbar ist.
 * @param severity Schweregrad (success, error, warning, info).
 * @param message Anzuzeigende Nachricht.
 */
export interface SnackbarState {
  open: boolean;
  severity: AlertColor;
  message: string;
}

export const SNACKBAR_INITIAL_STATE_VALUES: SnackbarState = {
  open: false,
  severity: "success",
  message: "",
};

interface CustomSnackbarProps {
  message: string;
  severity: AlertColor;
  snackbarOpen: boolean;
  handleClose: (
    event: Event | SyntheticEvent<Element, Event>,
    reason: SnackbarCloseReason
  ) => void;
}

/**
 * Alert-Wrapper für Snackbar-Inhalte — als Modul-Level-Komponente,
 * damit React sie nicht bei jedem Render neu erstellt.
 */
const CustomAlert = React.forwardRef<HTMLDivElement, AlertProps>(
  function CustomAlert(props, ref) {
    return <Alert elevation={6} ref={ref} {...props} />;
  }
);

/* ===================================================================
// ============================== Snackbar ===========================
// =================================================================== */
/**
 * Snackbar-Komponente für Erfolgsmeldungen, Fehlermeldungen und Hinweise.
 *
 * @param message Anzuzeigende Nachricht.
 * @param severity Schweregrad (success, error, warning, info).
 * @param snackbarOpen Ob die Snackbar sichtbar ist.
 * @param handleClose Callback beim Schliessen.
 */
function CustomSnackbar({
  message,
  severity,
  snackbarOpen,
  handleClose,
}: CustomSnackbarProps) {
  const classes = useCustomStyles();

  return (
    <Snackbar
      sx={classes.snackbar}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
      open={snackbarOpen}
      onClose={handleClose}
      autoHideDuration={6000}
      TransitionComponent={Fade}
    >
      <div>
        <CustomAlert
          onClose={(event) => handleClose(event, "escapeKeyDown")}
          severity={severity}
        >
          {message}
        </CustomAlert>
      </div>
    </Snackbar>
  );
}

export {CustomSnackbar};
