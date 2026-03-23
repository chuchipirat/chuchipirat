import React from "react";
import {
  Box,
  Card,
  CardMedia,
  Fade,
  Grid,
  Slide,
  Typography,
} from "@mui/material";

import {useScrollReveal} from "../../hooks/useScrollReveal";
import type {LandingFeature} from "./landingFeatures";

/** Props für die ImageCard-Komponente. */
type ImageCardProps = {
  /** URL des anzuzeigenden Bildes. */
  url: string;
  /** Alternativer Text für Barrierefreiheit. */
  alt: string;
};

/**
 * Karte mit einem einzelnen Bild im 4:3-Format mit abgerundeten Ecken,
 * Schatten und Hover-Zoom-Effekt.
 *
 * @param props.url - Bild-URL.
 * @param props.alt - Alternativtext für das Bild.
 */
const ImageCard = ({url, alt}: ImageCardProps) => {
  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        borderRadius: 2,
        boxShadow: 3,
        overflow: "hidden",
        transition: "transform 0.3s ease",
        "&:hover": {transform: "scale(1.02)"},
      }}
    >
      <CardMedia
        component="img"
        image={url}
        alt={alt}
        loading="lazy"
        sx={{
          width: "100%",
          aspectRatio: "4/3",
          objectFit: "cover",
          objectPosition: "top",
        }}
      />
    </Card>
  );
};

/** Props für die FeatureSection-Komponente. */
type FeatureSectionProps = {
  /** Das darzustellende Feature. */
  feature: LandingFeature;
  /** Index des Features in der Liste (bestimmt Layout-Richtung). */
  index: number;
};

/**
 * Einzelner Feature-Abschnitt mit Scroll-Reveal-Animation.
 * Wechselt zwischen Bild-links/Text-rechts und umgekehrt
 * basierend auf dem Index. Auf Mobile: Text über Bild.
 *
 * @param props.feature - Das Feature-Datenobjekt.
 * @param props.index - Laufende Nummer für alternierendes Layout.
 */
const FeatureSectionBase = ({feature, index}: FeatureSectionProps) => {
  const {elementRef, isVisible} = useScrollReveal();
  const isEven = index % 2 === 0;
  const FeatureIcon = feature.icon;

  // Prüfe ob eine visuelle Spalte (Bild, Animation oder Icon) vorhanden ist
  const hasVisualColumn = !!(feature.animationComponent || feature.imagePath);

  // Text-Spalte
  const textColumn = (
    <Grid size={{xs: 12, md: hasVisualColumn ? 6 : 12}}>
      <Box sx={{display: "flex", alignItems: "flex-start", gap: 2, mb: 2}}>
        <FeatureIcon
          sx={{
            fontSize: 40,
            color: "primary.main",
            mt: 0.5,
            flexShrink: 0,
            "@keyframes float": {
              "0%, 100%": {transform: "translateY(0)"},
              "50%": {transform: "translateY(-6px)"},
            },
            animation: "float 3s ease-in-out infinite",
          }}
        />
        <Box>
          <Typography variant="h5" component="h3" sx={{fontWeight: 600, mb: 1}}>
            {feature.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {feature.description}
          </Typography>
        </Box>
      </Box>
    </Grid>
  );

  // Visuelle Spalte: Animation > Bild (Fallback)
  const AnimationComponent = feature.animationComponent;
  const visualColumn = AnimationComponent ? (
    <Grid size={{xs: 12, md: 6}}>
      <AnimationComponent isActive={isVisible} />
    </Grid>
  ) : feature.imagePath ? (
    <Grid size={{xs: 12, md: 6}}>
      <ImageCard url={feature.imagePath} alt={feature.title} />
    </Grid>
  ) : null;

  return (
    <Box ref={elementRef} sx={{mb: 8}}>
      <Fade in={isVisible} timeout={800}>
        <div>
          <Slide
            in={isVisible}
            direction={feature.slideDirection === "left" ? "right" : "left"}
            timeout={600}
          >
            <Grid
              container
              spacing={4}
              alignItems="center"
              direction={isEven ? "row" : "row-reverse"}
            >
              {isEven ? (
                <>
                  {visualColumn}
                  {textColumn}
                </>
              ) : (
                <>
                  {textColumn}
                  {visualColumn}
                </>
              )}
            </Grid>
          </Slide>
        </div>
      </Fade>
    </Box>
  );
};

export const FeatureSection = React.memo(FeatureSectionBase);
FeatureSection.displayName = "FeatureSection";
