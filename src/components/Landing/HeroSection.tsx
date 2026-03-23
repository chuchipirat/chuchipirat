import React from "react";
import {Box, Button, Container, Fade, Grow, Typography} from "@mui/material";
import {alpha, darken, lighten} from "@mui/system";

import {
  APP_NAME as TEXT_APP_NAME,
  APP_CLAIM as TEXT_APP_CLAIM,
  SIGN_IN as TEXT_SIGN_IN,
  SIGN_UP as TEXT_SIGN_UP,
} from "../../constants/text";
/** Pfad zum weissen Logo (statisch in /public). */
const LOGO_WHITE_PATH = "/images/logo/logo_white.svg";

/** Props für die HeroSection-Komponente. */
type HeroSectionProps = {
  /** Callback beim Klick auf "Anmelden". */
  onSignIn: () => void;
  /** Callback beim Klick auf "Registrieren". */
  onSignUp: () => void;
};

/**
 * Hero-Bereich der Landing-Page mit Gradient-Hintergrund,
 * animiertem App-Namen, Claim und CTA-Buttons.
 *
 * @param props.onSignIn - Navigiert zur Anmeldeseite.
 * @param props.onSignUp - Navigiert zur Registrierungsseite.
 */
const HeroSectionBase = ({onSignIn, onSignUp}: HeroSectionProps) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Box
      sx={(theme) => ({
        background: `linear-gradient(135deg, ${darken(theme.palette.primary.main, 0.3)} 0%, ${theme.palette.primary.main} 50%, ${lighten(theme.palette.primary.main, 0.2)} 100%)`,
        color: theme.palette.primary.contrastText,
        py: {xs: 6, md: 10},
        textAlign: "center",
      })}
    >
      <Container maxWidth="md">
        <Fade in={mounted} timeout={600}>
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              mb: 2,
              "@keyframes shimmer": {
                "0%": {backgroundPosition: "-200% center"},
                "100%": {backgroundPosition: "200% center"},
              },
              backgroundImage:
                "linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.8) 100%)",
              backgroundSize: "200% auto",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              animation: "shimmer 4s linear infinite",
            }}
          >
            {TEXT_APP_NAME}
          </Typography>
        </Fade>

        <Fade in={mounted} timeout={800} style={{transitionDelay: "300ms"}}>
          <Typography variant="h5" component="h2" sx={{mb: 4, opacity: 0.9}}>
            {TEXT_APP_CLAIM}
          </Typography>
        </Fade>

        <Grow in={mounted} timeout={600} style={{transitionDelay: "600ms"}}>
          <Box sx={{display: "flex", justifyContent: "center", gap: 2}}>
            <Button
              variant="contained"
              size="large"
              onClick={onSignIn}
              sx={{
                bgcolor: "common.white",
                color: "primary.main",
                "&:hover": {bgcolor: "grey.100"},
              }}
            >
              {TEXT_SIGN_IN}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={onSignUp}
              sx={{
                borderColor: "common.white",
                color: "common.white",
                "&:hover": {
                  borderColor: "common.white",
                  bgcolor: "rgba(255,255,255,0.1)",
                },
              }}
            >
              {TEXT_SIGN_UP}
            </Button>
          </Box>
        </Grow>

        <Fade in={mounted} timeout={600} style={{transitionDelay: "800ms"}}>
          <Box
            component="img"
            src={LOGO_WHITE_PATH}
            alt={`${TEXT_APP_NAME} Logo`}
            sx={{mt: 6, maxWidth: {xs: "80%", md: "350px"}, height: "auto"}}
          />
        </Fade>
      </Container>
    </Box>
  );
};

export const HeroSection = React.memo(HeroSectionBase);
HeroSection.displayName = "HeroSection";
