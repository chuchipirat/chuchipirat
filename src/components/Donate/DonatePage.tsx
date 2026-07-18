/**
 * DonatePage — Hauptseite für Spenden an den chuchipirat.
 *
 * Zeigt das Spendenziel-Widget, einen Transparenztext und das
 * Spendenformular mit Payrexx-Integration.
 */
import React, {useEffect, useState} from "react";
import {useSearchParams} from "react-router";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";

import {
  Container,
  Card,
  CardContent,
  Typography,
  Stack,
  Alert,
} from "@mui/material";

import {
  DONATE as TEXT_DONATE,
  THANK_YOU_1000 as TEXT_THANK_YOU_1000,
  DONATION_TRANSPARENCY_TEXT as TEXT_TRANSPARENCY,
  DONATION_LINKED_TO_EVENT as TEXT_DONATION_LINKED_TO_EVENT,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";

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
  const database = useDatabase();
  const classes = useCustomStyles();
  const [searchParams] = useSearchParams();

  const eventId = searchParams.get("eventId") ?? undefined;
  const source = searchParams.get("source") ?? "donate_page";

  const [linkedEventName, setLinkedEventName] = useState<string | null>(null);

  useEffect(() => {
    // Nur beim ersten Rendern tracken, unabhängig von späteren Query-Param-Änderungen.
    trackEvent(AnalyticsEvent.DONATION_PAGE_VIEWED, {
      source,
      ...(eventId ? {eventId} : {}),
    });
  }, []);

  useEffect(() => {
    if (!eventId) {
      setLinkedEventName(null);
      return;
    }
    database.events
      .getEvent(eventId)
      .then((event) => setLinkedEventName(event?.name ?? null))
      .catch(() => setLinkedEventName(null));
  }, [eventId, database.events]);

  if (!authUser) return null;

  return (
    <React.Fragment>
      <PageTitle title={TEXT_DONATE} subTitle={TEXT_THANK_YOU_1000} />
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Stack spacing={3}>
          {/* Spendenziel-Widget */}
          <DonationGoalWidget />

          {linkedEventName && (
            <Alert severity="info">
              {TEXT_DONATION_LINKED_TO_EVENT(linkedEventName)}
            </Alert>
          )}

          {/* Spendenformular */}
          <Card sx={classes.card}>
            <CardContent sx={classes.cardContent}>
              <Stack spacing={2}>
                <Typography>{TEXT_TRANSPARENCY}</Typography>
                <DonationForm
                  eventId={eventId}
                  source={source}
                  returnPath="/donate"
                />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </React.Fragment>
  );
};

export {DonatePage};
