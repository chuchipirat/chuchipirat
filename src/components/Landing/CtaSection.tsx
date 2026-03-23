import React from "react";
import {Box, Button, Container, Fade, Typography} from "@mui/material";
import {darken, lighten} from "@mui/system";

import {
  SIGN_IN as TEXT_SIGN_IN,
  SIGN_UP as TEXT_SIGN_UP,
  LANDING_CTA_TITLE as TEXT_CTA_TITLE,
  LANDING_CTA_TEXT as TEXT_CTA_TEXT,
} from "../../constants/text";
import {useScrollReveal} from "../../hooks/useScrollReveal";

/** Props für die CtaSection-Komponente. */
type CtaSectionProps = {
  /** Callback beim Klick auf "Anmelden". */
  onSignIn: () => void;
  /** Callback beim Klick auf "Registrieren". */
  onSignUp: () => void;
};

/**
 * Abschliessender Call-to-Action-Bereich am Ende der Landing-Page.
 * Wird per Scroll-Reveal eingeblendet und verwendet den gleichen
 * Gradient-Hintergrund wie der Hero-Bereich.
 *
 * @param props.onSignIn - Navigiert zur Anmeldeseite.
 * @param props.onSignUp - Navigiert zur Registrierungsseite.
 */
const CtaSectionBase = ({onSignIn, onSignUp}: CtaSectionProps) => {
  const {elementRef, isVisible} = useScrollReveal();

  return (
    <Box
      ref={elementRef}
      sx={(theme) => ({
        background: `linear-gradient(135deg, ${darken(theme.palette.primary.main, 0.3)} 0%, ${theme.palette.primary.main} 50%, ${lighten(theme.palette.primary.main, 0.2)} 100%)`,
        color: theme.palette.primary.contrastText,
        py: 8,
        px: 2,
        textAlign: "center",
      })}
    >
      <Container maxWidth="sm">
        <Fade in={isVisible} timeout={800}>
          <Box>
            <Typography variant="h4" component="h2" sx={{fontWeight: 700, mb: 2}}>
              {TEXT_CTA_TITLE}
            </Typography>
            <Typography variant="h6" sx={{mb: 4, opacity: 0.9}}>
              {TEXT_CTA_TEXT}
            </Typography>
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
          </Box>
        </Fade>
      </Container>
    </Box>
  );
};

export const CtaSection = React.memo(CtaSectionBase);
CtaSection.displayName = "CtaSection";
