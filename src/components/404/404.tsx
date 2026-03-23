/**
 * 404-Fehlerseite – wird angezeigt, wenn eine Route nicht gefunden wurde.
 *
 * Zeigt das App-Logo, eine freundliche Fehlermeldung und einen Button
 * zur Startseite, damit Benutzer sich leicht zurückfinden können.
 */
import {useEffect} from "react";
import {useNavigate} from "react-router";
import Typography from "@mui/material/Typography";
import {Box, Button, Container, Stack, useTheme} from "@mui/material";

import {
  PAGE_TITLE_404 as TEXT_PAGE_TITLE_404,
  PAGE_SUBTITLE_404 as TEXT_PAGE_SUBTITLE_404,
  BUTTON_BACK_TO_HOME as TEXT_BUTTON_BACK_TO_HOME,
} from "../../constants/text";
import {ImageRepository} from "../../constants/imageRepository";
import * as ROUTES from "../../constants/routes";

/**
 * Seite für nicht gefundene Routen (404).
 *
 * @returns JSX-Element mit Logo, Fehlermeldung und Navigation zur Startseite.
 */
export const NotFoundPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "404 – Seite nicht gefunden";
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
          {TEXT_PAGE_TITLE_404}
        </Typography>
        <Typography variant="h6" color="textSecondary" align="center">
          {TEXT_PAGE_SUBTITLE_404}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(ROUTES.LANDING)}
        >
          {TEXT_BUTTON_BACK_TO_HOME}
        </Button>
      </Stack>
    </Container>
  );
};
