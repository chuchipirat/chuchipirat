/**
 * DonatePage — Hauptseite für Spenden an den chuchipirat.
 *
 * Zeigt das Spendenziel-Widget, einen Transparenztext und das
 * Spendenformular mit Payrexx-Integration.
 */
import React from "react";

import {
  Container,
  Card,
  CardContent,
  Typography,
  Stack,
} from "@mui/material";

import {
  DONATE as TEXT_DONATE,
  THANK_YOU_1000 as TEXT_THANK_YOU_1000,
  DONATION_TRANSPARENCY_TEXT as TEXT_TRANSPARENCY,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";
import {useAuthUser} from "../Session/authUserContext";

import {PageTitle} from "../Shared/pageTitle";
import {DonationGoalWidget} from "./DonationGoalWidget";
import {DonationForm} from "./DonationForm";

/* ===================================================================
// Komponente
// =================================================================== */

/**
 * Hauptseite für Spenden — zeigt Spendenziel, Transparenztext
 * und das Spendenformular an.
 */
const DonatePage = () => {
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  if (!authUser) return null;

  return (
    <React.Fragment>
      <PageTitle title={TEXT_DONATE} subTitle={TEXT_THANK_YOU_1000} />
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Stack spacing={3}>
          {/* Spendenziel-Widget */}
          <DonationGoalWidget />

          {/* Spendenformular */}
          <Card sx={classes.card}>
            <CardContent sx={classes.cardContent}>
              <Stack spacing={2}>
                <Typography>{TEXT_TRANSPARENCY}</Typography>
                <DonationForm returnPath="/donate" />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </React.Fragment>
  );
};

export {DonatePage};
