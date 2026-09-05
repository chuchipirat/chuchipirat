import * as Sentry from "@sentry/react";
import React from "react";

import {Card, CardContent, CardHeader, Box, Skeleton} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING} from "../../../constants/text";
import {isTransientNetworkError} from "../../../utils/errorUtils";

/** Props für die Event-Abrechnungsseite. */
interface EventExpenseTrackingPageProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Datenbank-Service für Supabase-Zugriffe. */
  database: DatabaseService;
}

const EventExpenseTrackingPage = ({
  event,
  database,
}: EventExpenseTrackingPageProps) => {
  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);

  /* ------------------------------------------
  // Spende für dieses Event laden
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!event.uid) return;

    database.donations
      .getEventDonations(event.uid)
      .then((donations) => {
        setHasDonation(donations.length > 0);
      })
      .catch((error) => {
        setHasDonation(false);
        if (!isTransientNetworkError(error)) {
          Sentry.captureException(error, {
            extra: {context: "Event-Spende laden"},
          });
        }
      });
  }, [event.uid]);

  return (
    <Card>
      <CardHeader title={TEXT_EXPENSE_TRACKING} />
      <CardContent>
        {hasDonation == null ? (
          <Box data-testid="expense-tracking-loading">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </Box>
        ) : hasDonation === false ? (
          <Box data-testid="expense-tracking-locked">
            <p>Keine Spende - Upsell screen</p>
          </Box>
        ) : (
          <Box data-testid="expense-tracking-unlocked">
            <p>Hier wäre die Abrechnung</p>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export {EventExpenseTrackingPage};
