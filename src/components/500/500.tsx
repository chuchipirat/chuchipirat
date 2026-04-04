/**
 * 500-Fehlerseite – wird als Fallback im Sentry-ErrorBoundary angezeigt,
 * wenn ein unerwarteter Laufzeitfehler auftritt.
 *
 * Zeigt das App-Logo, eine beruhigende Fehlermeldung und einen Button
 * zum Neuladen der Seite.
 */
import {useEffect} from "react";
import Typography from "@mui/material/Typography";
import {Box, Button, Container, Stack, useTheme} from "@mui/material";

import {
  PAGE_TITLE_500 as TEXT_PAGE_TITLE_500,
  PAGE_TEXT_1_500 as TEXT_PAGE_TEXT_1_500,
  PAGE_TEXT_2_500 as TEXT_PAGE_TEXT_2_500,
  BUTTON_RELOAD_PAGE as TEXT_BUTTON_RELOAD_PAGE,
} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";

/**
 * Allgemeine Fehlerseite (500) für unerwartete Laufzeitfehler.
 *
 * @returns JSX-Element mit Logo, Fehlermeldung und Neuladen-Button.
 */
export const ErrorPage = () => {
  const theme = useTheme();

  useEffect(() => {
    document.title = "Fehler – Chuchipirat";
  }, []);

  return (
    <Container component="main" maxWidth="sm">
      <Stack
        spacing={4}
        alignItems="center"
        justifyContent="center"
        sx={{minHeight: "60vh", py: theme.spacing(4)}}
      >
        <Box
          component="img"
          src={ImageRepository.getEnvironmentRelatedPicture().LANDING_LOGO}
          width="35em"
          alt="Logo"
        />

        <Typography variant="h2" color="textSecondary" align="center">
          {TEXT_PAGE_TITLE_500}
        </Typography>
        <Typography align="center">{TEXT_PAGE_TEXT_1_500}</Typography>
        <Typography align="center">{TEXT_PAGE_TEXT_2_500}</Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={() => window.location.reload()}
        >
          {TEXT_BUTTON_RELOAD_PAGE}
        </Button>
      </Stack>
    </Container>
  );
};
