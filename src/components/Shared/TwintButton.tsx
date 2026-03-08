import React from "react";

import {Button, Box, useMediaQuery} from "@mui/material";

import useCustomStyles from "../../constants/styles";
import {TWINT_PAYLINK} from "../../constants/defaultValues";

/**
 * TWINT-Zahlungsbutton mit Dark-Mode-Unterstützung.
 * Öffnet den TWINT-Paylink in einem neuen Tab.
 */
const TwintButton = () => {
  const classes = useCustomStyles();
  const darkMode = useMediaQuery("(prefers-color-scheme: dark)");

  return (
    <Button
      fullWidth
      startIcon={
        <Box
          component="img"
          src={
            darkMode
              ? "https://assets.raisenow.io/twint-logo-light.svg"
              : "https://assets.raisenow.io/twint-logo-dark.svg"
          }
          alt="Twint-Icon"
        />
      }
      onClick={() => {
        window.open(TWINT_PAYLINK, "_blank");
      }}
      sx={[
        classes.twintButton,
        darkMode ? classes.twintButtonDarkMode : classes.twintButtonLightMode,
      ]}
    >
      Mit TWINT bezahlen
    </Button>
  );
};

export default TwintButton;
