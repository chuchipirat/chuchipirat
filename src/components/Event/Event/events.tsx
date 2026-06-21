import * as Sentry from "@sentry/react";
import React from "react";

import {useNavigate} from "react-router";
import {
  Backdrop,
  Card,
  CardActionArea,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";
import {Add as AddIcon} from "@mui/icons-material";
import Grid from "@mui/material/Grid";

import {PageTitle} from "../../Shared/pageTitle";

import {
  EVENTS as TEXT_EVENTS,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  EVENT_FUTURE_EVENTS as TEXT_EVENT_FUTURE_EVENTS,
  EVENT_PAST_EVENTS as TEXT_EVENT_PAST_EVENTS,
  EVENT_NO_FUTURE_EVENTS as TEXT_EVENT_NO_FUTURE_EVENTS,
  EVENT_NO_PAST_EVENTS as TEXT_EVENT_NO_PAST_EVENTS,
  CREATE_EVENT as TEXT_CREATE_EVENT,
} from "../../../constants/text";
import {useCustomStyles} from "../../../constants/styles";
import {AlertMessage} from "../../Shared/AlertMessage";
import {useDatabase} from "../../Database/DatabaseContext";
import {EventDomain, getMaxDate} from "../../Database/Repository/EventRepository";
import {EventCard,EventCardLoading, EventCardData} from "./eventCard";
import {CopyEventDialog} from "./CopyEventDialog";
import {EventCompletionDonation} from "../../Donate/EventCompletionDonation";
import {Action} from "../../../constants/actions";
import {
  EVENT as ROUTES_EVENT,
  CREATE_NEW_EVENT as ROUTES_CREATE_NEW_EVENT,
} from "../../../constants/routes";
import {useAuthUser} from "../../Session/authUserContext";

enum ReducerActions {
  EVENTS_FETCH_INIT,
  EVENTS_FETCH_SUCCESS,
  GENERIC_ERROR,
}

type DispatchAction =
  | {type: ReducerActions.EVENTS_FETCH_INIT}
  | {type: ReducerActions.EVENTS_FETCH_SUCCESS; payload: EventDomain[]}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

interface State {
  events: EventDomain[];
  isLoading: boolean;
  error: Error | null;
}

const initialState: State = {
  events: [],
  isLoading: false,
  error: null,
};

const eventsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.EVENTS_FETCH_INIT:
      return {...state, isLoading: true};
    case ReducerActions.EVENTS_FETCH_SUCCESS:
      return {...state, isLoading: false, events: action.payload};
    case ReducerActions.GENERIC_ERROR:
      return {...state, isLoading: false, error: action.payload};
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustive}`);
    }
  }
};

const EventsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const [state, dispatch] = React.useReducer(eventsReducer, initialState);
  const today = new Date(new Date().setHours(23, 59, 59, 999));

  // Copy-Dialog Zustand
  const [copyDialogOpen, setCopyDialogOpen] = React.useState(false);
  const [eventToCopy, setEventToCopy] = React.useState<EventDomain | null>(null);
  // Nach erfolgreichem Kopieren: Spendenansicht
  const [copiedEvent, setCopiedEvent] = React.useState<{id: string; name: string} | null>(null);

  /* ------------------------------------------
  // Daten holen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (authUser !== null && state.events.length === 0) {
      dispatch({type: ReducerActions.EVENTS_FETCH_INIT});

      database.events
        .getAllEventsForUser()
        .then((result) => {
          dispatch({type: ReducerActions.EVENTS_FETCH_SUCCESS, payload: result});
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "Events laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error instanceof Error ? error : new Error(String(error)),
          });
        });
    }
  }, [authUser]);

  /* ------------------------------------------
  // Event öffnen
  // ------------------------------------------ */
  const onEventOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const uid = event.currentTarget.dataset.eventUid;
    if (!uid) return;

    navigate(`${ROUTES_EVENT}/${uid}`, {
      state: {
        action: Action.VIEW,
        event: {uid},
      },
    });
  };

  const onEventCreate = () => {
    navigate(`${ROUTES_CREATE_NEW_EVENT}`);
  };

  /* ------------------------------------------
  // Event kopieren
  // ------------------------------------------ */
  const onCopyClick = (eventCard: EventCardData) => {
    // Das vollständige EventDomain aus dem State holen (enthält dates)
    const fullEvent = state.events.find(
      (eventDomain) => eventDomain.uid === eventCard.uid,
    );
    if (!fullEvent) return;
    setEventToCopy(fullEvent);
    setCopyDialogOpen(true);
  };

  const onCopyDialogClose = () => {
    setCopyDialogOpen(false);
    setEventToCopy(null);
  };

  const onCopySuccess = (newEventId: string, eventName: string) => {
    setCopyDialogOpen(false);
    setEventToCopy(null);
    setCopiedEvent({id: newEventId, name: eventName});
  };

  const onNavigateToCopiedEvent = () => {
    if (!copiedEvent) return;
    navigate(`${ROUTES_EVENT}/${copiedEvent.id}`);
  };

  // Events aufteilen und sortieren
  const futureEvents = state.events
    .filter((event) => getMaxDate(event) > today)
    .sort((a, b) => getMaxDate(a).getTime() - getMaxDate(b).getTime());

  const pastEvents = state.events
    .filter((event) => getMaxDate(event) <= today)
    .sort((a, b) => getMaxDate(b).getTime() - getMaxDate(a).getTime());

  // Nach erfolgreichem Kopieren: Spendenansicht statt Event-Liste anzeigen
  if (copiedEvent) {
    return (
      <React.Fragment>
        <PageTitle title={TEXT_EVENTS} />
        <Container sx={classes.container} component="main" maxWidth="sm">
          <EventCompletionDonation
            eventName={copiedEvent.name}
            returnPath={`/event/${copiedEvent.id}`}
            onSkip={onNavigateToCopiedEvent}
            eventId={copiedEvent.id}
          />
        </Container>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_EVENTS} />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="lg">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        {state.error && (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}
        <Typography
          variant="h5"
          variantMapping={{h5: "h2"}}
          align="center"
          gutterBottom
        >
          {TEXT_EVENT_FUTURE_EVENTS}
        </Typography>
        <EventsGrid
          events={futureEvents}
          isLoading={state.isLoading}
          onCardClick={onEventOpen}
          onCopyClick={onCopyClick}
          onCreateNewEvent={onEventCreate}
          showCreateNewCard={true}
          emptyMessage={TEXT_EVENT_NO_FUTURE_EVENTS}
        />

        <Typography
          variant="h5"
          variantMapping={{h5: "h2"}}
          align="center"
          gutterBottom
        >
          {TEXT_EVENT_PAST_EVENTS}
        </Typography>
        <EventsGrid
          events={pastEvents}
          isLoading={state.isLoading}
          onCardClick={onEventOpen}
          onCopyClick={onCopyClick}
          onCreateNewEvent={onEventCreate}
          showCreateNewCard={false}
          emptyMessage={TEXT_EVENT_NO_PAST_EVENTS}
        />
      </Container>

      {/* Copy-Event Dialog */}
      {eventToCopy && (
        <CopyEventDialog
          open={copyDialogOpen}
          onClose={onCopyDialogClose}
          onSuccess={onCopySuccess}
          sourceEvent={{
            uid: eventToCopy.uid,
            name: eventToCopy.name,
            motto: eventToCopy.motto,
            location: eventToCopy.location,
            dates: eventToCopy.dates.map((dateDomain) => ({
              dateFrom: dateDomain.dateFrom,
              dateTo: dateDomain.dateTo,
              sortOrder: dateDomain.sortOrder,
            })),
          }}
        />
      )}
    </React.Fragment>
  );
};

interface EventGridProps {
  events: EventCardData[];
  isLoading: boolean;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCopyClick?: (event: EventCardData) => void;
  onCreateNewEvent: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showCreateNewCard: boolean;
  emptyMessage?: string;
}

const EventsGrid = ({
  events,
  isLoading,
  onCardClick,
  onCopyClick,
  onCreateNewEvent,
  showCreateNewCard = false,
  emptyMessage,
}: EventGridProps) => {
  const classes = useCustomStyles();

  return (
    <Grid
      container
      spacing={2}
      justifyContent="center"
      style={{marginBottom: "3rem"}}
    >
      {isLoading && (
        <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
          <EventCardLoading key={"loadingEventCard"} />
        </Grid>
      )}
      {!isLoading && events.length === 0 && emptyMessage && (
        <Grid size={{xs: 12}}>
          <Typography
            variant="body1"
            color="textSecondary"
            align="center"
            sx={{py: 2}}
          >
            {emptyMessage}
          </Typography>
        </Grid>
      )}
      {events.map((event) => (
        <Grid
          size={{xs: 12, sm: 6, md: 4, lg: 3}}
          key={"eventGrid_" + event.uid}
        >
          <EventCard
            event={event}
            onCardClick={onCardClick}
            onCopyClick={onCopyClick}
            key={"eventCard_" + event.uid}
          />
        </Grid>
      ))}

      {showCreateNewCard && (
        <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
          <Card
            sx={{
              ...classes.card,
              border: "2px dashed",
              borderColor: "divider",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
            }}
            key={"eventCardNew"}
          >
            <CardActionArea
              onClick={onCreateNewEvent}
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <AddIcon sx={{fontSize: 48, color: "text.secondary", mb: 1}} />
              <Typography color="text.secondary">{TEXT_CREATE_EVENT}</Typography>
            </CardActionArea>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export {EventsPage};
