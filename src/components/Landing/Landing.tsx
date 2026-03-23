import React from "react";

import {
  Container,
  Card,
  Typography,
  CardMedia,
  Box,
  Stack,
} from "@mui/material";

import {
  HOME as ROUTE_HOME,
  SIGN_IN as ROUTE_SIGN_IN,
  SIGN_UP as ROUTE_SIGN_UP,
} from "../../constants/routes";
import {
  APP_NAME as TEXT_APP_NAME,
  APP_CLAIM as TEXT_APP_CLAIM,
  SIGN_IN as TEXT_SIGN_IN,
  SIGN_UP as TEXT_SIGN_UP,
  LANDING_LEAD_TEXT as TEXT_LANDING_LEAD_TEXT,
  LANDING_RECIPES_BLOCK_TITLE as TEXT_LANDING_RECIPES_BLOCK_TITLE,
  LANDING_RECIPES_BLOCK_TEXT as TEXT_LANDING_RECIPES_BLOCK_TEXT,
  LANDING_GROUP_CONFIG_TITLE as TEXT_LANDING_GROUP_CONFIG_TITLE,
  LANDING_GROUP_CONFIG_TEXT as TEXT_LANDING_GROUP_CONFIG_TEXT,
  LANDING_GROUP_SIZE_TITLE as TEXT_LANDING_GROUP_SIZE_TITLE,
  LANDING_GROUP_SIZE_TEXT as TEXT_LANDING_GROUP_SIZE_TEXT,
  LANDING_MENUPLAN_TITLE as TEXT_LANDING_MENUPLAN_TITLE,
  LANDING_MENUPLAN_TEXT as TEXT_LANDING_MENUPLAN_TEXT,
  LANDING_SCALING_TITLE as TEXT_LANDING_SCALING_TITLE,
  LANDING_SCALING_TEXT as TEXT_LANDING_SCALING_TEXT,
  LANDING_SHOPPINGLIST_TITLE as TEXT_LANDING_SHOPPINGLIST_TITLE,
  LANDING_SHOPPINGLIST_TEXT as TEXT_LANDING_SHOPPINGLIST_TEXT,
  LANDING_SOCIAL_TITLE as TEXT_LANDING_SOCIAL_TITLE,
  LANDING_SOCIAL_TEXT as TEXT_LANDING_SOCIAL_TEXT,
  LANDING_OFFLINE_TITLE as TEXT_LANDING_OFFLINE_TITLE,
  LANDING_OFFLINE_TEXT as TEXT_LANDING_OFFLINE_TEXT,
  LOVE_TO_COOK as TEXT_LOVE_TO_COOK,
} from "../../constants/text";

import {ImageRepository} from "../../constants/imageRepository";

import {useNavigate} from "react-router";

import PageTitle from "../Shared/pageTitle";
import ButtonRow from "../Shared/buttonRow";
import {useAuthUser} from "../Session/authUserContext";
import useCustomStyles from "../../constants/styles";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/**
 * Startseite der Applikation für nicht angemeldete Benutzer.
 * Zeigt App-Informationen, Feature-Highlights und Anmelde-/Registrierungsbuttons.
 * Leitet angemeldete Benutzer automatisch zur Home-Seite weiter.
 */
const LandingPage = () => {
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const classes = useCustomStyles();

  React.useEffect(() => {
    // Wenn angemeldet direkt weiterleiten
    if (authUser) {
      navigate(ROUTE_HOME);
    }
  }, [authUser, navigate]);

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_APP_NAME} subTitle={TEXT_APP_CLAIM} />
      <ButtonRow
        key="buttons_head"
        buttons={[
          {
            id: "SIGN_IN",
            hero: true,
            visible: true,
            label: TEXT_SIGN_IN,
            variant: "contained",
            color: "primary",
            onClick: () => {
              navigate(ROUTE_SIGN_IN);
            },
          },
          {
            id: "SIGN_UP",
            hero: true,
            visible: true,
            label: TEXT_SIGN_UP,
            variant: "outlined",
            color: "primary",
            onClick: () => {
              navigate(ROUTE_SIGN_UP);
            },
          },
        ]}
      />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Stack spacing={4} alignItems="center" justifyContent="center">
          <Box
            component="img"
            src={ImageRepository.getEnvironmentRelatedPicture().LANDING_LOGO}
            // width="350em"
            alt="Logo"
          />
          <Typography variant="h6" component="h2">
            {TEXT_LANDING_LEAD_TEXT}
          </Typography>
          <br />
          <Typography variant="subtitle1">{TEXT_LOVE_TO_COOK}</Typography>
          {/* Rezepte */}
          <Typography>
            <strong>{TEXT_LANDING_RECIPES_BLOCK_TITLE}</strong>
            <br />
            {TEXT_LANDING_RECIPES_BLOCK_TEXT}
          </Typography>
          <ImageCard
            url={
              ImageRepository.getLandingPageEnvironmentRelatedPicture().recipes
            }
          />
          {/* Gruppen-Config */}
          <Typography>
            <strong>{TEXT_LANDING_GROUP_CONFIG_TITLE}</strong>
            <br />
            {TEXT_LANDING_GROUP_CONFIG_TEXT}
          </Typography>
          {/* Gruppengrösse */}
          <Typography>
            <strong>{TEXT_LANDING_GROUP_SIZE_TITLE}</strong>
            <br />
            {TEXT_LANDING_GROUP_SIZE_TEXT}
          </Typography>
          <ImageCard
            url={
              ImageRepository.getLandingPageEnvironmentRelatedPicture()
                .groupconfig
            }
          />
          {/* Menüplan */}
          <Typography>
            <strong>{TEXT_LANDING_MENUPLAN_TITLE}</strong>
            <br />
            {TEXT_LANDING_MENUPLAN_TEXT}
          </Typography>
          <ImageCard
            url={
              ImageRepository.getLandingPageEnvironmentRelatedPicture().menuplan
            }
          />
          {/* Skalierung */}
          <Typography>
            <strong>{TEXT_LANDING_SCALING_TITLE}</strong>
            <br />
            {TEXT_LANDING_SCALING_TEXT}
          </Typography>
          <ImageCard
            url={
              ImageRepository.getLandingPageEnvironmentRelatedPicture().scaling
            }
          />
          {/* Einkaufen */}
          <Typography>
            <strong>{TEXT_LANDING_SHOPPINGLIST_TITLE}</strong>
            <br />
            {TEXT_LANDING_SHOPPINGLIST_TEXT}
          </Typography>
          <ImageCard
            url={
              ImageRepository.getLandingPageEnvironmentRelatedPicture()
                .shoppinglist
            }
          />
          {/* Social */}
          <Typography>
            <strong>{TEXT_LANDING_SOCIAL_TITLE}</strong>
            <br />
            {TEXT_LANDING_SOCIAL_TEXT}
          </Typography>
          {/* Offline */}
          <Typography>
            <strong>{TEXT_LANDING_OFFLINE_TITLE}</strong>
            <br />
            {TEXT_LANDING_OFFLINE_TEXT}
          </Typography>
        </Stack>
      </Container>
    </React.Fragment>
  );
};
/** Props für die ImageCard-Komponente. */
interface ImageCardProps {
  /** URL des anzuzeigenden Bildes. */
  url: string;
}
/**
 * Karte mit einem einzelnen Bild im 4:3-Format.
 *
 * @param props.url - Bild-URL.
 */
const ImageCard = ({url}: ImageCardProps) => {
  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <CardMedia
        sx={{
          width: "100%",
          height: "100%",
          paddingTop: "75%",
          backgroundPosition: "top",
          flexGrow: 1,
          objectFit: "cover",
        }}
        image={url}
      />
    </Card>
  );
};

export default LandingPage;
