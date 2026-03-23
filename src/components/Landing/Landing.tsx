import React from "react";
import {Container} from "@mui/material";
import {useNavigate} from "react-router";

import {
  HOME as ROUTE_HOME,
  SIGN_IN as ROUTE_SIGN_IN,
  SIGN_UP as ROUTE_SIGN_UP,
} from "../../constants/routes";
import {useAuthUser} from "../Session/authUserContext";
import {HeroSection} from "./HeroSection";
import {FeatureSection} from "./FeatureSection";
import {CtaSection} from "./CtaSection";
import {LandingDivider} from "./LandingDivider";
import {LANDING_FEATURES} from "./landingFeatures";

/**
 * Startseite der Applikation für nicht angemeldete Benutzer.
 * Zeigt einen Hero-Bereich, Feature-Highlights mit Scroll-Reveal-Animationen
 * und einen abschliessenden Call-to-Action. Leitet angemeldete Benutzer
 * automatisch zur Home-Seite weiter.
 */
export const LandingPage = () => {
  const authUser = useAuthUser();
  const navigate = useNavigate();

  React.useEffect(() => {
    // Wenn angemeldet direkt weiterleiten
    if (authUser) {
      navigate(ROUTE_HOME);
    }
  }, [authUser, navigate]);

  const handleSignIn = React.useCallback(
    () => navigate(ROUTE_SIGN_IN),
    [navigate],
  );
  const handleSignUp = React.useCallback(
    () => navigate(ROUTE_SIGN_UP),
    [navigate],
  );

  return (
    <>
      <HeroSection onSignIn={handleSignIn} onSignUp={handleSignUp} />
      <Container component="main" maxWidth="lg" sx={{py: 8}}>
        {LANDING_FEATURES.map((feature, index) => (
          <FeatureSection key={feature.id} feature={feature} index={index} />
        ))}
      </Container>
      <LandingDivider />
      <CtaSection onSignIn={handleSignIn} onSignUp={handleSignUp} />
    </>
  );
};
