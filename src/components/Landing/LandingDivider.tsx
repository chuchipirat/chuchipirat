import React from "react";
import {Box} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import StarIcon from "@mui/icons-material/Star";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";

/**
 * Dekorativer Übergangsbereich zwischen Feature-Liste und CTA-Sektion.
 * Zeigt ein pulsierendes Herz-Icon in einem Kreis, umgeben von
 * schwebenden Koch-bezogenen MUI-Icons.
 */
const LandingDividerBase = () => {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        py: {xs: 4, md: 6},
      }}
    >
      <Box
        sx={(theme) => ({
          position: "relative",
          width: {xs: 140, md: 180},
          height: {xs: 140, md: 180},
          borderRadius: "50%",
          bgcolor: `${theme.palette.primary.light}1A`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          "@keyframes float": {
            "0%, 100%": {transform: "translateY(0)"},
            "50%": {transform: "translateY(-10px)"},
          },
          "@keyframes pulse": {
            "0%, 100%": {transform: "scale(1)"},
            "50%": {transform: "scale(1.08)"},
          },
        })}
      >
        {/* Zentrales Herz-Icon */}
        <FavoriteIcon
          sx={{
            fontSize: {xs: 48, md: 56},
            color: "primary.main",
            animation: "pulse 3s ease-in-out infinite",
          }}
        />

        {/* Dekorative schwebende Icons */}
        <StarIcon
          sx={{
            position: "absolute",
            top: 8,
            right: 16,
            fontSize: 20,
            color: "primary.light",
            animation: "float 3s ease-in-out infinite",
          }}
        />
        <RestaurantIcon
          sx={{
            position: "absolute",
            bottom: 12,
            left: 12,
            fontSize: 18,
            color: "primary.light",
            animation: "float 3s ease-in-out infinite 0.5s",
          }}
        />
        <AutoAwesomeIcon
          sx={{
            position: "absolute",
            top: 20,
            left: 8,
            fontSize: 16,
            color: "primary.light",
            animation: "float 3s ease-in-out infinite 1s",
          }}
        />
        <LocalFireDepartmentIcon
          sx={{
            position: "absolute",
            bottom: 8,
            right: 12,
            fontSize: 17,
            color: "primary.light",
            animation: "float 3s ease-in-out infinite 1.5s",
          }}
        />
      </Box>
    </Box>
  );
};

export const LandingDivider = React.memo(LandingDividerBase);
LandingDivider.displayName = "LandingDivider";
