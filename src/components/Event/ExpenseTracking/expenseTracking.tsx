import * as Sentry from "@sentry/react";
import React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Skeleton,
  Container,
  Typography,
  Link,
} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {
  EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING,
  EXPENSE_TRACKING_NOT_ACTIVE as TEXT_EXPENSE_TRACKING_NOT_ACTIVE,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK,
} from "../../../constants/text/expenseTracking";
import {isTransientNetworkError} from "../../../utils/errorUtils";
import {DonationForm} from "../../Donate/DonationForm";
import {useCustomStyles} from "../../../constants/styles";
import {getHelpPageUrl} from "../../Navigation/helpCenter";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import {Action} from "../../../constants/actions";

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
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);
  const classes = useCustomStyles();

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
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.expenseTracking,
    });
  }, []);

  return (
    <Card sx={classes.card}>
      <CardHeader
        title={
          hasDonation || hasDonation === null
            ? TEXT_EXPENSE_TRACKING
            : TEXT_EXPENSE_TRACKING_NOT_ACTIVE
        }
      />
      <CardContent>
        {hasDonation == null ? (
          <Box data-testid="expense-tracking-loading">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </Box>
        ) : hasDonation === false ? (
          <React.Fragment>
            <Typography variant="body1" sx={{marginBottom: 2}}>
              {TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION}{" "}
              <Link
                href={getHelpPageUrl("event", "expensetracking")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK}
              </Link>
              .
            </Typography>

            <Container
              data-testid="expense-tracking-locked"
              maxWidth="sm"
              sx={classes.container}
            >
              <DonationForm
                eventId={event.uid}
                returnPath={`/event/${event.uid}?tab=expensetracking`}
                source="expense-tracking"
              />
            </Container>
          </React.Fragment>
        ) : (
          <Box data-testid="expense-tracking-unlocked">
            <p>Budgets & Ausgaben folgen in Kürze</p>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export {EventExpenseTrackingPage};
