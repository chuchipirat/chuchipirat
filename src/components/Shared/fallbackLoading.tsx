import React from "react";

import {Backdrop, CircularProgress} from "@mui/material";

import {useCustomStyles} from "../../constants/styles";

/* ===================================================================
// ======================= Ladeanzeige für Seite =====================
// =================================================================== */
const FallbackLoading = () => {
  const classes = useCustomStyles();

  return (
    <Backdrop sx={classes.backdrop} open={true}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
};

export {FallbackLoading};
