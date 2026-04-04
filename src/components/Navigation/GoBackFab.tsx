import {useCallback} from "react";
import Fab from "@mui/material/Fab";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import {useNavigate} from "react-router";
import {useCustomStyles} from "../../constants/styles";

/**
 * Schwebender Zurück-Button (FAB) für die mobile Navigation.
 *
 * Navigiert beim Klick einen Schritt zurück in der Browser-History.
 * Wird nur auf kleinen Viewports und auf Routen mit `showGoBackFab`
 * angezeigt (gesteuert durch {@link ConditionalGoBackFab}).
 *
 * @returns FAB-Button mit Zurück-Pfeil.
 */
export const GoBackFab = () => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <Fab
      component="span"
      size="small"
      color="primary"
      aria-label="Zurück"
      sx={classes.goBackFabButton}
      onClick={handleBack}
    >
      <ArrowBackIosIcon fontSize="small" sx={classes.goBackButtonIcon} />
    </Fab>
  );
};
