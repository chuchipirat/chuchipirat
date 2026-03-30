import React, {SyntheticEvent} from "react";
import {useTheme} from "@mui/material/styles";
import {useNavigate, useLocation} from "react-router";
import * as Sentry from "@sentry/react";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardHeader,
  CardActionArea,
  Container,
  Typography,
  Button,
  Divider,
  useMediaQuery,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Skeleton,
  SnackbarCloseReason,
} from "@mui/material";

import Grid from "@mui/material/Grid";
import {Add as AddIcon, ExpandMore as ExpandMoreIcon} from "@mui/icons-material";

import {PageTitle} from "../Shared/pageTitle";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  PAGE_TITLE_HOME as TEXT_PAGE_TITLE_HOME,
  PAGE_SUBTITLE_HOME as TEXT_PAGE_SUBTITLE_HOME,
  CREATE_EVENT as TEXT_CREATE_EVENT,
  EVENT_SHOW_PAST_EVENTS as TEXT_EVENT_SHOW_PAST_EVENTS,
  EVENT_PAST_EVENTS as TEXT_EVENT_PAST_EVENTS,
  NEWEST_RECIPES as TEXT_NEWEST_RECIPES,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  FEED as TEXT_FEED,
  STATS as TEXT_STATS,
  APP_NAME as TEXT_APP_NAME,
  HOME_EMPTY_EVENTS as TEXT_HOME_EMPTY_EVENTS,
  HOME_EMPTY_RECIPES as TEXT_HOME_EMPTY_RECIPES,
  HOME_EMPTY_FEED as TEXT_HOME_EMPTY_FEED,
} from "../../constants/text";
import {EVENT, CREATE_NEW_EVENT, RECIPE, USER_PUBLIC_PROFILE} from "../../constants/routes";

import {ImageRepository} from "../../constants/imageRepository";
import {EventDomain, getMaxDate} from "../Database/Repository/EventRepository";
import {EventCard, EventCardLoading} from "../Event/Event/eventCard";

import {useAuthUser} from "../Session/authUserContext";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {FeedType} from "../Shared/feed.class";
import {FeedDomain} from "../Database/Repository/FeedRepository";
import {RecipeCardLoading} from "../Recipe/recipeCard";
import {Action} from "../../constants/actions";
import {RecipeType} from "../Recipe/recipe.class";
import {Role} from "../../constants/roles";
import {
  FEEDS_DISPLAY as DEFAULT_VALUES_FEEDS_DISPLAY,
  RECIPE_DISPLAY as DEFAULT_RECIPE_DISPLAY,
} from "../../constants/defaultValues";
import {Kpi, KpiGroup, StatsRepository} from "../Database/Repository/StatsRepository";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/NavigationContext";
import {CustomSnackbar} from "../Shared/customSnackbar";
import {useDatabase} from "../Database/DatabaseContext";
import {AlertSystemMessage} from "../Admin/SystemMessage/systemMessage";
import {useCustomStyles} from "../../constants/styles";
import {ReducerActions, homeReducer, initialState} from "./homeReducer";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Startseite nach dem Login. Lädt Events, Rezepte, Feed, Statistik
 * und Systemmeldungen parallel und zeigt sie in einem 2-Spalten-Layout an.
 */
export const HomePage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const location = useLocation();

  const classes = useCustomStyles();
  const navigate = useNavigate();

  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const [state, dispatch] = React.useReducer(homeReducer, initialState);

  /* ------------------------------------------
  // Snackbar aus location.state (z.B. nach Anlass löschen)
  // ------------------------------------------ */
  React.useEffect(() => {
    if (location.state?.["snackbar"] && !state.snackbar.open) {
      dispatch({
        type: ReducerActions.SNACKBAR_SET,
        payload: location.state["snackbar"],
      });
    }
  }, [location.state]);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.home,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Nur beim Mount setzen; navigationValuesContext im Dep-Array löst eine Endlosschleife aus
  }, []);

  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */

  // Events: einmal laden, clientseitig in aktuell/vergangen aufteilen
  React.useEffect(() => {
    if (!authUser) return;
    dispatch({type: ReducerActions.EVENTS_FETCH_INIT});

    database.events
      .getAllEventsForUser()
      .then((result) => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const actual = result.filter((event) => getMaxDate(event) >= today);
        const passed = result.filter((event) => getMaxDate(event) < today);
        dispatch({
          type: ReducerActions.EVENTS_FETCH_SUCCESS,
          payload: {actual, passed},
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.EVENTS_FETCH_ERROR, payload: error as Error});
      });
  }, [authUser]);

  // Neueste publizierte Rezepte
  React.useEffect(() => {
    if (!authUser) return;
    dispatch({type: ReducerActions.NEWEST_RECIPES_FETCH_INIT});

    database.feeds
      .getNewestFeeds(DEFAULT_RECIPE_DISPLAY, Role.basic, FeedType.recipePublished)
      .then((result) => {
        dispatch({
          type: ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.NEWEST_RECIPES_FETCH_ERROR, payload: error as Error});
      });
  }, [authUser]);

  // Feed-Einträge
  React.useEffect(() => {
    if (!authUser) return;
    dispatch({type: ReducerActions.FEED_FETCH_INIT});

    database.feeds
      .getNewestFeeds(DEFAULT_VALUES_FEEDS_DISPLAY, Role.basic)
      .then((result) => {
        dispatch({
          type: ReducerActions.FEED_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.FEED_FETCH_ERROR, payload: error as Error});
      });
  }, [authUser]);

  // Statistik
  React.useEffect(() => {
    if (!authUser) return;
    dispatch({type: ReducerActions.STATS_FETCH_INIT});

    database.stats
      .getStats()
      .then((result) => {
        dispatch({
          type: ReducerActions.STATS_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.STATS_FETCH_ERROR, payload: error as Error});
      });
  }, [authUser]);

  // Systemmeldungen
  React.useEffect(() => {
    if (!authUser) return;

    database.systemMessages
      .getValidMessages()
      .then((result) => {
        const withText = result.filter((msg) => msg.text);
        if (withText.length > 0) {
          dispatch({
            type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS,
            payload: withText,
          });
        }
      })
      .catch((error) => {
        Sentry.captureException(error);
      });
  }, [authUser]);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Vergangene Anlässe anzeigen/ausblenden
  // ------------------------------------------ */
  const onShowPassedEvents = React.useCallback(() => {
    dispatch({type: ReducerActions.TOGGLE_PASSED_EVENTS});
  }, []);

  /* ------------------------------------------
  // Objekte öffnen
  // ------------------------------------------ */
  const onEventClick = React.useCallback(
    (raisedEvent: React.MouseEvent<HTMLButtonElement>) => {
      const uid = raisedEvent.currentTarget.dataset.eventUid;
      const event =
        state.events.find((event) => event.uid === uid) ??
        state.passedEvents.find((event) => event.uid === uid);

      if (!event) return;

      navigate(`${EVENT}/${event.uid}`, {
        state: {
          action: Action.VIEW,
          event: event,
        },
      });
    },
    [state.events, state.passedEvents, navigate],
  );

  const onCreateNewEvent = React.useCallback(() => {
    navigate(`${CREATE_NEW_EVENT}`);
  }, [navigate]);

  const onRecipeClick = React.useCallback(
    (clickEvent: React.MouseEvent<HTMLButtonElement>) => {
      const recipeUid = clickEvent.currentTarget.dataset.recipeUid;
      const recipe = state.recipes.find(
        (recipe) => recipe.sourceObject.uid === recipeUid,
      );

      if (!recipe) return;

      navigate(`${RECIPE}/${recipeUid}`, {
        state: {
          action: Action.VIEW,
          recipeShort: {
            uid: recipe.sourceObject.uid,
            name: recipe.sourceObject.name,
            pictureSrc: recipe.sourceObject.pictureSrc,
          },
          recipeType: RecipeType.public,
        },
      });
    },
    [state.recipes, navigate],
  );

  const onFeedEntryClick = React.useCallback(
    (clickEvent: React.MouseEvent<HTMLElement>) => {
      const feedUid = clickEvent.currentTarget.dataset.feedUid;
      const feedEntry = state.feed.find(
        (feedEntry) => feedEntry.uid === feedUid,
      );
      if (!feedEntry) return;

      switch (feedEntry.feedType) {
        case FeedType.recipePublished:
        case FeedType.recipeRated:
        case FeedType.recipeCommented:
          navigate(`${RECIPE}/${feedEntry.sourceObject.uid}`, {
            state: {action: Action.VIEW},
          });
          break;
        default:
          navigate(
            `${USER_PUBLIC_PROFILE}/${feedEntry.user.uid}`,
            {
              state: {
                action: Action.VIEW,
                displayName: feedEntry.user.displayName,
                pictureSrc: feedEntry.user.pictureSrc,
              },
            },
          );
      }
    },
    [state.feed, navigate],
  );

  /* ------------------------------------------
  // Snackbar schliessen
  // ------------------------------------------ */
  const handleSnackbarClose = React.useCallback(
    (
      _event: globalThis.Event | SyntheticEvent<Element, globalThis.Event>,
      reason: SnackbarCloseReason,
    ) => {
      if (reason === "clickaway") return;
      dispatch({type: ReducerActions.SNACKBAR_CLOSE});
    },
    [],
  );

  return (
    <React.Fragment>
      <HomeHeader authUser={authUser} />
      <Container sx={classes.container} component="main" maxWidth="md">
        <Grid container spacing={2} justifyContent="center">
          {state.systemMessages.map((msg) => (
            <Grid size={12} key={`systemMessage_${msg.uid}`}>
              <AlertSystemMessage systemMessage={msg} />
            </Grid>
          ))}
          <Grid size={12}>
            <HomeNextEvents
              events={state.events}
              isLoadingEvents={state.isLoadingEvents}
              error={state.eventsError}
              onCardClick={onEventClick}
              onCreateNewEvent={onCreateNewEvent}
            />
          </Grid>
          <Grid size={12}>
            <HomePassedEvents
              events={state.passedEvents}
              showPassedEvents={state.showPassedEvents}
              onCardClick={onEventClick}
              onShowPassedEvents={onShowPassedEvents}
            />
          </Grid>
          <Grid size={12}>
            <Divider sx={{mb: "2rem"}} />
          </Grid>
          <Grid size={{xs: 12, md: 8}}>
            <HomeNewestRecipes
              recipes={state.recipes}
              isLoadingRecipes={state.isLoadingNewestRecipes}
              error={state.recipesError}
              onCardClick={onRecipeClick}
            />
            <Box sx={{marginTop: 2}}>
              <HomeFeed
                feed={state.feed}
                isLoadingFeed={state.isLoadingFeed}
                onListEntryClick={onFeedEntryClick}
              />
            </Box>
          </Grid>
          <Grid size={{xs: 12, md: 4}}>
            <HomeStats
              stats={state.stats}
              isLoadingStats={state.isLoadingStats}
            />
          </Grid>
        </Grid>
      </Container>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ============================= Header ==============================
// =================================================================== */

/**
 * Kopfbereich der Startseite mit Begrüssung und Untertitel.
 *
 * @param authUser - Der angemeldete Benutzer
 */
interface HomeHeaderProps {
  authUser: AuthUser;
}
const HomeHeader = ({authUser}: HomeHeaderProps) => {
  return (
    <PageTitle
      title={TEXT_PAGE_TITLE_HOME(authUser.publicProfile.displayName)}
      subTitle={TEXT_PAGE_SUBTITLE_HOME}
      windowTitle={`${TEXT_APP_NAME} | Home`}
    />
  );
};

/* ===================================================================
// ============================= Events ==============================
// =================================================================== */

/**
 * Abschnitt «Nächste Anlässe» mit Event-Cards und «Neuen Anlass erstellen»-Karte.
 *
 * @param events - Aktuelle (zukünftige) Events
 * @param isLoadingEvents - Ladeindikator
 * @param error - Fehler beim Laden (wird als AlertMessage angezeigt)
 * @param onCardClick - Callback beim Klick auf eine Event-Card
 * @param onCreateNewEvent - Callback beim Klick auf «Neuen Anlass erstellen»
 */
interface HomeNextEventsProps {
  events: EventDomain[];
  isLoadingEvents: boolean;
  error: Error | null;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCreateNewEvent: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
const HomeNextEvents = React.memo(({
  events,
  isLoadingEvents,
  error,
  onCardClick,
  onCreateNewEvent,
}: HomeNextEventsProps) => {
  const classes = useCustomStyles();
  return (
    <React.Fragment>
      {error && (
        <AlertMessage
          error={error}
          messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
        />
      )}
      <Grid container spacing={2} justifyContent="center">
        {isLoadingEvents && (
          <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}>
            <EventCardLoading key={"loadingEventCard"} />
          </Grid>
        )}
        {!isLoadingEvents && events.length === 0 && !error && (
          <Grid size={12}>
            <Typography
              align="center"
              color="textSecondary"
              sx={{mb: "1rem"}}
            >
              {TEXT_HOME_EMPTY_EVENTS}
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
      </Grid>
    </React.Fragment>
  );
});
HomeNextEvents.displayName = "HomeNextEvents";

/* ===================================================================
// ======================== Vergangene Anlässe =======================
// =================================================================== */

/**
 * Abschnitt «Vergangene Anlässe» — zeigt einen Toggle-Button und
 * die Event-Cards vergangener Anlässe.
 *
 * @param events - Vergangene Events
 * @param showPassedEvents - Ob der Bereich sichtbar ist
 * @param onCardClick - Callback beim Klick auf eine Event-Card
 * @param onShowPassedEvents - Callback zum Umschalten der Sichtbarkeit
 */
interface HomePassedEventsProps {
  events: EventDomain[];
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  showPassedEvents: boolean;
  onShowPassedEvents: () => void;
}
const HomePassedEvents = React.memo(({
  events,
  onCardClick,
  showPassedEvents,
  onShowPassedEvents,
}: HomePassedEventsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const breakpointIsXs = useMediaQuery(theme.breakpoints.down("sm"));
  const breakpointIsSm = useMediaQuery(theme.breakpoints.down("md"));

  // Korrekte Berechnung: fehlende Plätze = columns - remainder
  const rowFiller = React.useMemo(() => {
    if (breakpointIsXs) return [];
    const columns = breakpointIsSm ? 2 : 3;
    const remainder = events.length % columns;
    if (remainder === 0) return [];
    return [...Array(columns - remainder).keys()];
  }, [breakpointIsXs, breakpointIsSm, events.length]);

  return (
    <React.Fragment>
      <Grid container spacing={2} justifyContent="center">
        {!showPassedEvents ? (
          <Grid size={12} sx={classes.centerCenter}>
            <Button
              color="primary"
              sx={classes.button}
              onClick={onShowPassedEvents}
            >
              {TEXT_EVENT_SHOW_PAST_EVENTS(events.length)}
            </Button>
          </Grid>
        ) : (
          <Grid size={12} sx={classes.centerCenter}>
            <Typography
              variant="h5"
              align="center"
              color="textSecondary"
              sx={{mt: "1rem"}}
            >
              {TEXT_EVENT_PAST_EVENTS}
            </Typography>
          </Grid>
        )}
        {showPassedEvents &&
          events.map((event) => (
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
        {showPassedEvents &&
          rowFiller.map((number) => (
            <Grid
              size={{xs: 12, sm: 6, md: 4, lg: 3}}
              key={"gridRowFiller_" + number}
            />
          ))}
      </Grid>
    </React.Fragment>
  );
});
HomePassedEvents.displayName = "HomePassedEvents";

/* ===================================================================
// ========================== Neuste Rezepte ==========================
// =================================================================== */

/**
 * Abschnitt «Neueste Rezepte» mit Rezept-Cards.
 * Hover-Effekt auf dem Bild ist per CSS gelöst (kein React-State nötig).
 *
 * @param recipes - Feed-Einträge der neuesten publizierten Rezepte
 * @param isLoadingRecipes - Ladeindikator
 * @param error - Fehler beim Laden (wird als AlertMessage angezeigt)
 * @param onCardClick - Callback beim Klick auf eine Rezept-Card
 */
interface HomeNewestRecipesProps {
  recipes: FeedDomain[];
  isLoadingRecipes: boolean;
  error: Error | null;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
const HomeNewestRecipes = React.memo(({
  recipes,
  isLoadingRecipes,
  error,
  onCardClick,
}: HomeNewestRecipesProps) => {
  const classes = useCustomStyles();

  return (
    <Grid container spacing={2} justifyContent="center">
      <Grid size={12} key={"recipeTitle"}>
        <Typography
          align="center"
          gutterBottom={true}
          variant="h5"
          component="h2"
        >
          {TEXT_NEWEST_RECIPES}
        </Typography>
      </Grid>
      {error && (
        <Grid size={12}>
          <AlertMessage
            error={error}
            messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
          />
        </Grid>
      )}
      {isLoadingRecipes &&
        [...Array(DEFAULT_RECIPE_DISPLAY).keys()].map((index) => (
          <Grid size={6} key={"emptyRecipeGrid_" + index}>
            <RecipeCardLoading key={"emptyRecipeCard_" + index} />
          </Grid>
        ))}
      {!isLoadingRecipes && recipes.length === 0 && !error && (
        <Grid size={12}>
          <Typography align="center" color="textSecondary">
            {TEXT_HOME_EMPTY_RECIPES}
          </Typography>
        </Grid>
      )}
      {recipes.map((recipe) => (
        <Grid size={6} key={"recipeGrid_" + recipe.uid}>
          <Card
            sx={classes.card}
            key={"recipeCard_" + recipe.uid}
          >
            <CardActionArea
              data-recipe-uid={recipe.sourceObject.uid}
              onClick={onCardClick}
              sx={{
                height: "100%",
                "&:hover .MuiCardMedia-root": {
                  transform: "scale(1.05)",
                },
              }}
            >
              <Box component={"div"} sx={classes.card}>
                <Box sx={{overflow: "hidden"}}>
                  <Box
                    className="MuiCardMedia-root"
                    sx={{
                      ...classes.cardMedia,
                      backgroundImage: `url(${
                        recipe.sourceObject.pictureSrc
                          ? recipe.sourceObject.pictureSrc
                          : ImageRepository.getEnvironmentRelatedPicture()
                              .CARD_PLACEHOLDER_MEDIA
                      })`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      transition: "transform 0.5s ease",
                    }}
                    title={recipe.sourceObject.name}
                  />
                </Box>
                <CardHeader title={recipe.sourceObject.name} />
              </Box>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
});
HomeNewestRecipes.displayName = "HomeNewestRecipes";

/* ===================================================================
// ========================== Feed-Einträge ==========================
// =================================================================== */

/**
 * Abschnitt «Feed» — zeigt die neuesten Aktivitäten der Community.
 *
 * @param feed - Feed-Einträge
 * @param isLoadingFeed - Ladeindikator
 * @param onListEntryClick - Callback beim Klick auf einen Feed-Eintrag
 */
interface HomeFeedProps {
  feed: FeedDomain[];
  isLoadingFeed: boolean;
  onListEntryClick: (event: React.MouseEvent<HTMLElement>) => void;
}
const HomeFeed = React.memo(
  ({feed, isLoadingFeed, onListEntryClick}: HomeFeedProps) => {
    const classes = useCustomStyles();
    return (
      <Grid container spacing={2} justifyContent="center">
        <Grid size={12}>
          <Typography
            align="center"
            gutterBottom={true}
            variant="h5"
            component="h2"
          >
            {TEXT_FEED}
          </Typography>
        </Grid>
        <Grid size={12}>
          <Card sx={classes.card}>
            <List>
              {isLoadingFeed &&
                [...Array(DEFAULT_VALUES_FEEDS_DISPLAY).keys()].map(
                  (index) => (
                    <ListItem key={"feedListItem_skeleton_" + index}>
                      <ListItemText
                        primary={<Skeleton />}
                        secondary={<Skeleton />}
                      />
                    </ListItem>
                  ),
                )}
              {!isLoadingFeed && feed.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={TEXT_HOME_EMPTY_FEED}
                    sx={{textAlign: "center"}}
                  />
                </ListItem>
              )}
              {feed.map((feedEntry, counter) => (
                <React.Fragment key={"feed_" + feedEntry.uid}>
                  <ListItemButton
                    alignItems="flex-start"
                    key={"feedListItem_" + feedEntry.uid}
                    data-feed-uid={feedEntry.uid}
                    onClick={onListEntryClick}
                  >
                    <ListItemAvatar>
                      {feedEntry.user.pictureSrc ? (
                        <Avatar
                          alt={feedEntry.user.displayName}
                          src={String(feedEntry.user.pictureSrc)}
                        />
                      ) : (
                        <Avatar alt={feedEntry.user.displayName}>
                          {feedEntry.user.displayName.charAt(0).toUpperCase()}
                        </Avatar>
                      )}
                    </ListItemAvatar>
                    <ListItemText
                      primary={feedEntry.title}
                      secondary={
                        <React.Fragment>
                          <Typography
                            component="span"
                            variant="body2"
                            color="textPrimary"
                          >
                            {feedEntry.user.displayName}
                          </Typography>
                          {" - " + feedEntry.text}
                        </React.Fragment>
                      }
                    />
                  </ListItemButton>
                  {counter !== feed.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </React.Fragment>
              ))}
            </List>
          </Card>
        </Grid>
      </Grid>
    );
  },
);
HomeFeed.displayName = "HomeFeed";

/* ===================================================================
// ======================= Statistik-Sidebar =========================
// =================================================================== */

/** Anzahl KPIs für die Skeleton-Anzeige (18 KPIs in 4 Gruppen). */
const STATS_SKELETON_COUNT = 18;

/**
 * Statistik-Sidebar — zeigt die Plattform-KPIs gruppiert an.
 * Auf mobilen Geräten wird der Inhalt als klappbares Accordion angezeigt.
 *
 * @param stats - Flaches KPI-Array
 * @param isLoadingStats - Ladeindikator
 */
interface HomeStatsProps {
  stats: Kpi[];
  isLoadingStats: boolean;
}
const HomeStats = React.memo(({stats, isLoadingStats}: HomeStatsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const kpiGroups: KpiGroup[] = React.useMemo(
    () => StatsRepository.groupKpis(stats),
    [stats],
  );

  const statsContent = (
    <List>
      {isLoadingStats &&
        [...Array(STATS_SKELETON_COUNT).keys()].map((index) => (
          <ListItem key={"statsListItem_skeleton_" + index}>
            <ListItemText primary={<Skeleton />} />
          </ListItem>
        ))}
      {!isLoadingStats &&
        kpiGroups.map((group, groupIndex) => (
          <React.Fragment key={"statsGroup_" + group.title}>
            {groupIndex > 0 && (
              <Divider
                sx={{mx: "1rem"}}
                component="li"
              />
            )}
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" color="textSecondary">
                    {group.title}
                  </Typography>
                }
              />
            </ListItem>
            {group.kpis.map((stat) => (
              <ListItem
                key={"statListItem_" + stat.id}
                sx={{paddingTop: 0, paddingBottom: 0}}
              >
                <ListItemText primary={stat.caption} />
                <ListItemText
                  primary={stat.value.toLocaleString("de-CH")}
                  sx={{textAlign: "right"}}
                />
              </ListItem>
            ))}
          </React.Fragment>
        ))}
    </List>
  );

  return (
    <Grid container spacing={2} justifyContent="center">
      {!isMobile && (
        <Grid size={12}>
          <Typography
            align="center"
            gutterBottom={true}
            variant="h5"
            component="h2"
          >
            {TEXT_STATS}
          </Typography>
        </Grid>
      )}
      <Grid size={12}>
        {isMobile ? (
          <Accordion defaultExpanded={false} sx={classes.card}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>{TEXT_STATS}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{p: 0}}>
              {statsContent}
            </AccordionDetails>
          </Accordion>
        ) : (
          <Card sx={classes.card}>
            {statsContent}
          </Card>
        )}
      </Grid>
    </Grid>
  );
});
HomeStats.displayName = "HomeStats";
