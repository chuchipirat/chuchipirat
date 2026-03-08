import React from "react";

import {useNavigate} from "react-router";
import {
  Backdrop,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import PageTitle from "../../Shared/pageTitle";

import {
  EVENTS as TEXT_EVENTS,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  EVENT_FUTURE_EVENTS as TEXT_EVENT_FUTURE_EVENTS,
  EVENT_PAST_EVENTS as TEXT_EVENT_PAST_EVENTS,
  EVENT_NO_FUTURE_EVENTS as TEXT_EVENT_NO_FUTURE_EVENTS,
  EVENT_NO_PAST_EVENTS as TEXT_EVENT_NO_PAST_EVENTS,
  CREATE_EVENT as TEXT_CREATE_EVENT,
} from "../../../constants/text";
import useCustomStyles from "../../../constants/styles";
import AlertMessage from "../../Shared/AlertMessage";
import {useDatabase} from "../../Database/DatabaseContext";
import {EventDomain, getMaxDate} from "../../Database/Repository/EventRepository";
import EventCard, {EventCardLoading, EventCardData} from "./eventCard";
import Action from "../../../constants/actions";
import {
  EVENT as ROUTES_EVENT,
  CREATE_NEW_EVENT as ROUTES_CREATE_NEW_EVENT,
} from "../../../constants/routes";
import {useAuthUser} from "../../Session/authUserContext";
import {ImageRepository} from "../../../constants/imageRepository";

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
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

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
const EventsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const [state, dispatch] = React.useReducer(eventsReducer, initialState);
  const today = new Date(new Date().setHours(23, 59, 59, 999));

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
          console.error("Fehler beim Laden der Events:", error);
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

  // Events aufteilen und sortieren
  const futureEvents = state.events
    .filter((event) => getMaxDate(event) > today)
    .sort((a, b) => getMaxDate(a).getTime() - getMaxDate(b).getTime());

  const pastEvents = state.events
    .filter((event) => getMaxDate(event) <= today)
    .sort((a, b) => getMaxDate(b).getTime() - getMaxDate(a).getTime());

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
          onCreateNewEvent={onEventCreate}
          showCreateNewCard={false}
          emptyMessage={TEXT_EVENT_NO_PAST_EVENTS}
        />
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// =========================== Event-Cards ===========================
// =================================================================== */
interface EventGridProps {
  events: EventCardData[];
  isLoading: boolean;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateNewEvent: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showCreateNewCard: boolean;
  emptyMessage?: string;
}

const EventsGrid = ({
  events,
  isLoading,
  onCardClick,
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
            key={"eventCard_" + event.uid}
          />
        </Grid>
      ))}

      {showCreateNewCard && (
        <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
          <Card sx={classes.card} key={"eventCardNew"}>
            <CardMedia
              sx={classes.cardMedia}
              image={
                ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
              }
              title={TEXT_CREATE_EVENT}
            />
            <CardContent>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={onCreateNewEvent}
              >
                {TEXT_CREATE_EVENT}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );
};

export default EventsPage;
