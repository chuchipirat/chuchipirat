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
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import PageTitle from "../../Shared/pageTitle";

import {
  EVENTS as TEXT_EVENTS,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  EVENT_FUTURE_EVENTS as TEXT_EVENT_FUTURE_EVENTS,
  EVENT_PAST_EVENTS as TEXT_EVENT_PAST_EVENTS,
  CREATE_EVENT as TEXT_CREATE_EVENT,
} from "../../../constants/text";
import Event from "./event.class";
import useCustomStyles from "../../../constants/styles";
import AlertMessage from "../../Shared/AlertMessage";
import {useFirebase} from "../../Firebase/firebaseContext";
import EventCard, {EventCardLoading} from "./eventCard";
import Action from "../../../constants/actions";
import {
  EVENT as ROUTES_EVENT,
  CREATE_NEW_EVENT as ROUTES_CREATE_NEW_EVENT,
} from "../../../constants/routes";
import {useAuthUser} from "../../Session/authUserContext";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ImageRepository} from "../../../constants/imageRepository";
/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
enum ReducerActions {
  EVENTS_FETCH_INIT,
  EVENTS_FETCH_SUCCESS,
  GENERIC_ERROR,
}

type DispatchAction = {
  type: ReducerActions;
  payload: any;
};

type State = {
  events: Event[];
  isLoading: boolean;
  error: Error | null;
};

const inititialState: State = {
  events: [],
  isLoading: false,
  error: null,
};

const eventsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.EVENTS_FETCH_INIT: {
      return {...state, isLoading: true};
    }
    case ReducerActions.EVENTS_FETCH_SUCCESS:
      return {...state, isLoading: false, events: action.payload};
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload};
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const EventsPage = () => {
  const firebase = useFirebase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const [state, dispatch] = React.useReducer(eventsReducer, inititialState);
  const actualDate = new Date(new Date().setHours(23, 59, 59, 999));
  /* ------------------------------------------
  // Daten holen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (authUser !== null && state.events.length == 0) {
      dispatch({type: ReducerActions.EVENTS_FETCH_INIT, payload: {}});

      Event.getAllEventsOfUser({
        firebase: firebase,
        userUid: authUser.uid,
      }).then((result) => {
        dispatch({type: ReducerActions.EVENTS_FETCH_SUCCESS, payload: result});
      });
    }
  }, [authUser]);
  /* ------------------------------------------
  // Daten holen
  // ------------------------------------------ */
  const onEventOpen = (raisedEvent: React.MouseEvent<HTMLButtonElement>) => {
    const event = state.events.find(
      (event) => event.uid === raisedEvent.currentTarget.name.split("_")[1],
    );

    if (!event) {
      return;
    }
    navigate(`${ROUTES_EVENT}/${event.uid}`, {
      state: {
        action: Action.VIEW,
        event: event,
      },
    });
  };
  const onEventCreate = () => {
    navigate(`${ROUTES_CREATE_NEW_EVENT}`);
  };
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
          events={state.events.filter((event) => event.maxDate > actualDate)}
          isLoading={state.isLoading}
          onCardClick={onEventOpen}
          onCreateNewEvent={onEventCreate}
          showCreateNewCard={true}
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
          events={state.events.filter((event) => event.maxDate < actualDate)}
          isLoading={state.isLoading}
          onCardClick={onEventOpen}
          onCreateNewEvent={onEventCreate}
          showCreateNewCard={false}
        />
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Event-Cards ===========================
// =================================================================== */
interface EventGridProps {
  events: Event[];
  isLoading: boolean;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateNewEvent: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showCreateNewCard: boolean;
}
const EventsGrid = ({
  events,
  isLoading,
  onCardClick,
  onCreateNewEvent,
  showCreateNewCard = false,
}: EventGridProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  let rowSize = 12;

  if (useMediaQuery(theme.breakpoints.down("xs"))) {
    rowSize = 12;
  } else if (useMediaQuery(theme.breakpoints.down("sm"))) {
    rowSize = 6;
  } else if (useMediaQuery(theme.breakpoints.down("md"))) {
    rowSize = 4;
  } else {
    rowSize = 3;
  }

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
      {/* Leere Grids erzeugen, damit die Karten in einem Tabellenlayout angezeigt werden */}
      {Array.from({length: events.length % rowSize}).map((index) => (
        <Grid
          size={{xs: 12, sm: 6, md: 4, lg: 3}}
          key={"eventGridEmpty_" + index}
        />
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
