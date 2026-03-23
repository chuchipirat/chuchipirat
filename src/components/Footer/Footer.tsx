import React from "react";

import {Box, Container, IconButton} from "@mui/material";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import {Instagram as IconInstagram} from "@mui/icons-material";

import {Link as RouterLink} from "react-router";

import {
  HELPCENTER_URL,
  INSTAGRAM_URL,
  MAILADDRESS,
} from "../../constants/defaultValues";
import {ImageRepository} from "../../constants/imageRepository";
import {
  TERM_OF_USE as ROUTE_TERM_OF_USE,
  PRIVACY_POLICY as ROUTE_PRIVACY_POLICY,
} from "../../constants/routes";
import {useCustomStyles} from "../../constants/styles";
import {
  TERM_OF_USE as TEXT_TERM_OF_USE,
  APP_NAME as TEXT_APP_NAME,
  FOOTER_CREATED_WITH_JOY_OF_LIFE as TEXT_FOOTER_CREATED_WITH_JOY_OF_LIFE,
  VERSION as TEXT_VERSION,
  FOOTER_QUESTIONS_SUGGESTIONS as TEXT_FOOTER_QUESTIONS_SUGGESTIONS,
  PRIVACY_POLICY as TEXT_PRIVACY_POLICY,
} from "../../constants/text";
import packageJson from "../../../package.json";

/**
 * Copyright-Hinweis mit aktuellem Jahr und Link zur Webseite.
 */
const CopyrightComponent = () => {
  return (
    <Typography variant="body2" color="textSecondary" align="center">
      {"Copyright © "}
      <Link
        color="inherit"
        href="https://chuchipirat.ch/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {TEXT_APP_NAME}
      </Link>{" "}
      {new Date().getFullYear()}
      {"."}
    </Typography>
  );
};

export const Copyright = React.memo(CopyrightComponent);

/**
 * Fusszeile der Applikation.
 * Enthält Links zu Jubla, GitHub, E-Mail, Helpcenter, Nutzungsbedingungen,
 * Datenschutzerklärung und Instagram sowie das Copyright.
 */
const FooterComponent = () => {
  const classes = useCustomStyles();

  return (
    <footer>
      <Container sx={classes.container}>
        <Grid container justifyContent="center" alignItems="center" spacing={4}>
          <Grid size={2} />
          <Grid size={3}>
            <Divider sx={classes.mediumDivider} />
          </Grid>
          <Grid size={2} container justifyContent="center">
            <Box
              component="img"
              src={
                ImageRepository.getEnvironmentRelatedPicture().VECTOR_LOGO_GREY
              }
              alt=""
              width="50px"
            />
          </Grid>
          <Grid size={3}>
            <Divider sx={classes.mediumDivider} />
          </Grid>
          <Grid size={2} />

          <Grid size={12}>
            <Typography variant="h6" align="center" gutterBottom>
              {TEXT_APP_NAME}
            </Typography>

            <Typography
              variant="subtitle1"
              color="textSecondary"
              align="center"
              gutterBottom
            >
              {TEXT_FOOTER_CREATED_WITH_JOY_OF_LIFE.part1}
              <Link
                href="https://jubla.ch"
                target="_blank"
                rel="noopener noreferrer"
              >
                {TEXT_FOOTER_CREATED_WITH_JOY_OF_LIFE.linkText}
              </Link>
              {TEXT_FOOTER_CREATED_WITH_JOY_OF_LIFE.part2}
            </Typography>

            <Typography
              variant="body2"
              align="center"
              color="textSecondary"
              gutterBottom
            >
              {TEXT_VERSION}{" "}
              <Link
                href="https://github.com/gcettuzz/chuchipirat"
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  textDecoration: "none",
                  "&:hover": {textDecoration: "underline"},
                }}
              >
                {packageJson.version}
              </Link>
            </Typography>

            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              gutterBottom
            >
              <strong>{TEXT_FOOTER_QUESTIONS_SUGGESTIONS.TITLE}</strong>
            </Typography>

            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              gutterBottom
            >
              {TEXT_FOOTER_QUESTIONS_SUGGESTIONS.CONTACTHERE}{" "}
              <Link
                href={`mailto:${MAILADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {MAILADDRESS}
              </Link>
            </Typography>

            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              gutterBottom
            >
              {TEXT_FOOTER_QUESTIONS_SUGGESTIONS.OR_LOOK_HERE}{" "}
              <Link
                href={HELPCENTER_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {TEXT_FOOTER_QUESTIONS_SUGGESTIONS.HELPCENTER}
              </Link>{" "}
              {TEXT_FOOTER_QUESTIONS_SUGGESTIONS.OVER}
            </Typography>

            <Typography
              variant="body2"
              color="textSecondary"
              align="center"
              sx={{mt: 2}}
            >
              <Link component={RouterLink} to={ROUTE_TERM_OF_USE}>
                {TEXT_TERM_OF_USE}
              </Link>
              {" | "}
              <Link component={RouterLink} to={ROUTE_PRIVACY_POLICY}>
                {TEXT_PRIVACY_POLICY}
              </Link>
            </Typography>
          </Grid>

          <Grid>
            <IconButton
              component="a"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              size="medium"
              aria-label="Instagram"
            >
              <IconInstagram />
            </IconButton>
          </Grid>

          <Grid size={12}>
            <Copyright />
            <Box sx={{mb: 2}} />
          </Grid>
        </Grid>
      </Container>
    </footer>
  );
};

/**
 * Fusszeile der Applikation.
 * Enthält Links zu Jubla, GitHub, E-Mail, Helpcenter, Nutzungsbedingungen,
 * Datenschutzerklärung und Instagram sowie das Copyright.
 */
export const Footer = React.memo(FooterComponent);
