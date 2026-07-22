import React, {SyntheticEvent} from "react";
import {useTheme} from "@mui/material/styles";
import {useNavigate, useLocation} from "react-router";
import * as Sentry from "@sentry/react";

import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardHeader,
  CardActionArea,
  CardMedia,
  CardContent,
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
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

import {PageTitle} from "../Shared/pageTitle";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  PAGE_TITLE_HOME as TEXT_PAGE_TITLE_HOME,
  PAGE_SUBTITLE_HOME as TEXT_PAGE_SUBTITLE_HOME,
  CREATE_EVENT as TEXT_CREATE_EVENT,
  EVENT_SHOW_PAST_EVENTS as TEXT_EVENT_SHOW_PAST_EVENTS,
  EVENT_PAST_EVENTS as TEXT_EVENT_PAST_EVENTS,
  EVENT_COUNTDOWN_TODAY as TEXT_EVENT_COUNTDOWN_TODAY,
  EVENT_COUNTDOWN_TOMORROW as TEXT_EVENT_COUNTDOWN_TOMORROW,
  EVENT_COUNTDOWN_IN_DAYS as TEXT_EVENT_COUNTDOWN_IN_DAYS,
  EVENT_DAY_OF_TOTAL as TEXT_EVENT_DAY_OF_TOTAL,
  EVENT_ONGOING_TITLE as TEXT_EVENT_ONGOING_TITLE,
  NEWEST_RECIPES as TEXT_NEWEST_RECIPES,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  FEED as TEXT_FEED,
  FEED_SHOW_MORE as TEXT_FEED_SHOW_MORE,
  STATS as TEXT_STATS,
  APP_NAME as TEXT_APP_NAME,
  HOME_EMPTY_EVENTS as TEXT_HOME_EMPTY_EVENTS,
  HOME_EMPTY_RECIPES as TEXT_HOME_EMPTY_RECIPES,
  HOME_EMPTY_FEED as TEXT_HOME_EMPTY_FEED,
  PLANED_RECIPES as TEXT_PLANED_RECIPES,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
} from "../../constants/text";
import {
  EVENT,
  CREATE_NEW_EVENT,
  RECIPE,
  USER_PUBLIC_PROFILE,
} from "../../constants/routes";

import {ImageRepository} from "../../constants/imageRepository";
import {
  EventDomain,
  getMaxDate,
  getNearestUpcomingStartDate,
  getNearestUpcomingDateSlice,
  getEventLifecycleStatus,
  getActiveDateSlice,
} from "../Database/Repository/EventRepository";
import {
  EventCard,
  EventCardLoading,
  EventCardReadinessItem,
} from "../Event/Event/eventCard";
import {getEventWeatherRange, WeatherForecastDay} from "./openMeteo";
import {MealTypeCutoffDomain} from "../Database/Repository/MenuplanRepository";
import {RecipeDomain} from "../Database/Repository/RecipeRepository";
import {MenuplanData, PortionPlan} from "../Event/Menuplan/menuplan.types";
import {createEmptyMenuplan} from "../Event/Menuplan/menuplanService";
import {generatePlanedPortionsText} from "../Event/Menuplan/menuplan.constants";
import {EventGroupConfiguration} from "../Event/GroupConfiguration/groupConfiguration.class";
import {formatLocalDate} from "../../utils/dateUtils";

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
  FEEDS_DISPLAY_COLLAPSED as DEFAULT_VALUES_FEEDS_DISPLAY_COLLAPSED,
  RECIPE_DISPLAY as DEFAULT_RECIPE_DISPLAY,
} from "../../constants/defaultValues";
import {
  Kpi,
  KpiGroup,
  StatsRepository,
} from "../Database/Repository/StatsRepository";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/navigationContext";
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
    // Nur beim Mount setzen; navigationValuesContext im Dep-Array löst eine Endlosschleife aus
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
        today.setHours(0, 0, 0, 0);
        const actual = result
          .filter((event) => getMaxDate(event) >= today)
          .sort(
            (a, b) =>
              (getNearestUpcomingStartDate(a, today)?.getTime() ??
                Infinity) -
              (getNearestUpcomingStartDate(b, today)?.getTime() ?? Infinity),
          );
        const passed = result.filter((event) => getMaxDate(event) < today);
        dispatch({
          type: ReducerActions.EVENTS_FETCH_SUCCESS,
          payload: {actual, passed},
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.EVENTS_FETCH_ERROR,
          payload: error as Error,
        });
      });
  }, [authUser]);

  // Neueste publizierte Rezepte
  React.useEffect(() => {
    if (!authUser) return;
    dispatch({type: ReducerActions.NEWEST_RECIPES_FETCH_INIT});

    database.feeds
      .getNewestFeeds(
        DEFAULT_RECIPE_DISPLAY,
        Role.basic,
        FeedType.recipePublished,
      )
      .then((result) => {
        dispatch({
          type: ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.NEWEST_RECIPES_FETCH_ERROR,
          payload: error as Error,
        });
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
        dispatch({
          type: ReducerActions.FEED_FETCH_ERROR,
          payload: error as Error,
        });
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
        dispatch({
          type: ReducerActions.STATS_FETCH_ERROR,
          payload: error as Error,
        });
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
  // Feed-Einträge ein-/ausklappen
  // ------------------------------------------ */
  const onToggleFeedExpanded = React.useCallback(() => {
    if (!state.showFeedExpanded) {
      trackEvent(AnalyticsEvent.HOME_FEED_SHOW_MORE);
    }
    dispatch({type: ReducerActions.TOGGLE_FEED_EXPANDED});
  }, [state.showFeedExpanded]);

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
          navigate(`${USER_PUBLIC_PROFILE}/${feedEntry.user.uid}`, {
            state: {
              action: Action.VIEW,
              displayName: feedEntry.user.displayName,
              pictureSrc: feedEntry.user.pictureSrc,
            },
          });
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
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Grid container spacing={2} justifyContent="center">
          {state.systemMessages.map((msg) => (
            <Grid size={12} key={`systemMessage_${msg.uid}`}>
              <AlertSystemMessage systemMessage={msg} />
            </Grid>
          ))}
          <HomeOngoingEvent events={state.events} />
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
            <Grid container spacing={2}>
              <Grid size={{xs: 12, lg: 6}}>
                <HomeNewestRecipes
                  recipes={state.recipes}
                  isLoadingRecipes={state.isLoadingNewestRecipes}
                  error={state.recipesError}
                  onCardClick={onRecipeClick}
                />
              </Grid>
              <Grid size={{xs: 12, lg: 6}}>
                <HomeFeed
                  feed={state.feed}
                  isLoadingFeed={state.isLoadingFeed}
                  onListEntryClick={onFeedEntryClick}
                  showFeedExpanded={state.showFeedExpanded}
                  onToggleFeedExpanded={onToggleFeedExpanded}
                />
              </Grid>
            </Grid>
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

/**
 * Formatiert die Anzahl Tage bis zu einem Anlass als lesbaren Countdown-Text.
 *
 * @param daysUntil - Anzahl Tage bis zum Anlass (0 = heute, negativ = bereits laufend).
 * @returns Formatierter Countdown-Text ("Heute", "Morgen" oder "In X Tagen").
 */
function getCountdownLabel(daysUntil: number): string {
  if (daysUntil <= 0) return TEXT_EVENT_COUNTDOWN_TODAY;
  if (daysUntil === 1) return TEXT_EVENT_COUNTDOWN_TOMORROW;
  return TEXT_EVENT_COUNTDOWN_IN_DAYS(daysUntil);
}

/**
 * Berechnet die Anzahl ganzer Tage zwischen zwei Daten (auf Tagesgrenzen normiert).
 *
 * @param from - Startdatum (z.B. heute).
 * @param to - Zieldatum.
 * @returns Anzahl Tage zwischen den beiden Daten.
 */
function daysBetween(from: Date, to: Date): number {
  const fromMidnight = new Date(from);
  fromMidnight.setHours(0, 0, 0, 0);
  const toMidnight = new Date(to);
  toMidnight.setHours(0, 0, 0, 0);
  return Math.round(
    (toMidnight.getTime() - fromMidnight.getTime()) / 86_400_000,
  );
}

/**
 * Prüft, ob ein Mahlzeit-Typ anhand seines Namens noch relevant ist (Cutoff-
 * Zeit aus der Admin-Konfiguration noch nicht erreicht). Mahlzeit-Typ-Namen
 * sind komplett freier Text pro Event — Namen ohne Konfigurationstreffer
 * gelten daher immer als relevant (sicherer Fallback statt versehentlichem
 * Ausblenden einer nicht erkannten Mahlzeit).
 *
 * @param mealTypeName - Name des Mahlzeit-Typs (Freitext, z.B. "Zmorge").
 * @param cutoffTimes - Admin-konfigurierte Cutoff-Zeiten.
 * @param now - Referenzzeitpunkt (Default: jetzt).
 * @returns true, wenn die Mahlzeit noch relevant ist.
 */
function isMealTypeStillRelevant(
  mealTypeName: string,
  cutoffTimes: MealTypeCutoffDomain[],
  now: Date = new Date(),
): boolean {
  const normalizedName = mealTypeName.trim().toLowerCase();
  const match = cutoffTimes.find((cutoff) =>
    cutoff.names.some((name) => name.trim().toLowerCase() === normalizedName),
  );
  if (!match) return true;

  const [hours, minutes] = match.cutoffTime.split(":").map(Number);
  const cutoffDate = new Date(now);
  cutoffDate.setHours(hours, minutes, 0, 0);

  return now < cutoffDate;
}

/** Ein heute noch anstehendes Rezept mit allen für die kleine Karte nötigen Anzeigedaten. */
interface OngoingMealRecipeDisplay {
  mealPlanRecipeUid: string;
  recipeUid: string;
  recipeName: string;
  variantName?: string;
  recipeType: RecipeType;
  pictureSrc: string;
  plan: PortionPlan[];
}

/** Ein Mahlzeit-Typ mit den heute noch anstehenden Rezepten. */
interface OngoingMealTypeGroup {
  mealTypeName: string;
  recipes: OngoingMealRecipeDisplay[];
}

/**
 * Baut die heute noch anstehenden Mahlzeiten eines Menuplans, gruppiert nach
 * Mahlzeit-Typ (in dessen Sortierreihenfolge) und gefiltert nach den
 * admin-konfigurierten Cutoff-Zeiten.
 *
 * @param menuplan - Der vollständige Menuplan des Events.
 * @param recipePictures - Bild-URL und Typ je Rezept-UID (separat geladen, da MenuplanData keine Bilder führt).
 * @param cutoffTimes - Admin-konfigurierte Cutoff-Zeiten.
 * @returns Nach Mahlzeit-Typ gruppierte, sortierte, noch relevante Rezeptlisten.
 */
function buildTodaysMealGroups(
  menuplan: MenuplanData,
  recipePictures: Map<string, {pictureSrc: string; type: RecipeType}>,
  cutoffTimes: MealTypeCutoffDomain[],
): OngoingMealTypeGroup[] {
  const todayStr = formatLocalDate(new Date());
  const mealTypeUidsSeen: string[] = [];
  const grouped = new Map<string, OngoingMealRecipeDisplay[]>();

  Object.values(menuplan.meals)
    .filter((meal) => meal.date === todayStr)
    .forEach((meal) => {
      meal.menuOrder.forEach((menueUid) => {
        menuplan.menues[menueUid]?.mealRecipeOrder.forEach((mealRecipeUid) => {
          const mealRecipe = menuplan.mealRecipes[mealRecipeUid];
          if (!mealRecipe?.recipe.recipeUid) return; // gelöschtes Rezept überspringen

          if (!grouped.has(meal.mealType)) {
            grouped.set(meal.mealType, []);
            mealTypeUidsSeen.push(meal.mealType);
          }
          const picture = recipePictures.get(mealRecipe.recipe.recipeUid);
          grouped.get(meal.mealType)!.push({
            mealPlanRecipeUid: mealRecipe.uid,
            recipeUid: mealRecipe.recipe.recipeUid,
            recipeName: mealRecipe.recipe.name,
            variantName: mealRecipe.recipe.variantName,
            recipeType: picture?.type ?? mealRecipe.recipe.type,
            pictureSrc: picture?.pictureSrc ?? "",
            plan: mealRecipe.plan,
          });
        });
      });
    });

  return mealTypeUidsSeen
    .map((mealTypeUid) => ({
      mealTypeName: menuplan.mealTypes.entries[mealTypeUid]?.name ?? "",
      sortIndex: menuplan.mealTypes.order.indexOf(mealTypeUid),
      recipes: grouped.get(mealTypeUid) ?? [],
    }))
    .filter((group) => isMealTypeStillRelevant(group.mealTypeName, cutoffTimes))
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map(({mealTypeName, recipes}) => ({mealTypeName, recipes}));
}

/**
 * Anzahl Tage vor Anlassbeginn, ab denen die Bereitschafts-Checkliste
 * (Rezeptliste/Einkaufsliste/Materialliste) auf der Event-Card angezeigt wird.
 */
const HOME_READINESS_THRESHOLD_DAYS = 14;

/** Bereitschafts-Status der drei generierten Listen für die nächste Zeitscheibe. */
interface EventReadinessState {
  usedRecipes: boolean;
  shoppingList: boolean;
  materialList: boolean;
}

/** Geladene Daten für den "Läuft gerade"-Abschnitt eines einzelnen Anlasses. */
interface OngoingEventData {
  menuplan: MenuplanData;
  groupConfiguration: EventGroupConfiguration;
  mealGroups: OngoingMealTypeGroup[];
}

interface HomeOngoingEventProps {
  events: EventDomain[];
}

/**
 * Abschnitt «Läuft gerade» — rendert für jeden aktuell laufenden Anlass eine
 * eigene Sektion mit den heute noch anstehenden Mahlzeiten. Rendert nichts,
 * wenn kein Anlass gerade läuft.
 *
 * @param events - Alle aktuellen (nicht-vergangenen) Anlässe des Benutzers.
 */
const HomeOngoingEvent = ({events}: HomeOngoingEventProps) => {
  const ongoingEvents = events.filter(
    (event) => getEventLifecycleStatus(event) === "ongoing",
  );
  // Verfolgt, welche Sektionen tatsächlich Inhalt anzeigen (jede Sektion
  // entscheidet das selbst, abhängig von ihren asynchron geladenen Daten),
  // um den abschliessenden Trenner nur bei sichtbarem Abschnitt zu zeigen.
  const [visibleEventUids, setVisibleEventUids] = React.useState<Set<string>>(
    new Set(),
  );

  const handleVisibilityChange = React.useCallback(
    (eventUid: string, visible: boolean) => {
      setVisibleEventUids((previous) => {
        if (previous.has(eventUid) === visible) return previous;
        const next = new Set(previous);
        if (visible) {
          next.add(eventUid);
        } else {
          next.delete(eventUid);
        }
        return next;
      });
    },
    [],
  );

  return (
    <React.Fragment>
      {ongoingEvents.map((event) => (
        <HomeOngoingEventSection
          key={event.uid}
          event={event}
          onVisibilityChange={handleVisibilityChange}
        />
      ))}
      {visibleEventUids.size > 0 && (
        <Grid size={12}>
          <Divider sx={{mb: "2rem"}} />
        </Grid>
      )}
    </React.Fragment>
  );
};

interface HomeOngoingEventSectionProps {
  event: EventDomain;
  onVisibilityChange: (eventUid: string, visible: boolean) => void;
}

/**
 * Läuft-gerade-Sektion für einen einzelnen laufenden Anlass — lädt dessen
 * Menuplan, Gruppenkonfiguration und Rezeptbilder unabhängig von anderen
 * laufenden Anlässen. Rendert nichts, solange geladen wird, bei Ladefehler
 * oder wenn keine noch relevanten Mahlzeiten mehr anstehen.
 *
 * @param event - Der laufende Anlass.
 */
const HomeOngoingEventSection = React.memo(
  ({event, onVisibilityChange}: HomeOngoingEventSectionProps) => {
    const classes = useCustomStyles();
    const database = useDatabase();
    const navigate = useNavigate();
    const [data, setData] = React.useState<OngoingEventData | null>(null);

    const activeSlice = getActiveDateSlice(event);

    React.useEffect(() => {
      let cancelled = false;
      setData(null);

      Promise.all([
        database.menuplan.getMenuplanForUi(event.uid),
        database.eventGroupConfig.getGroupConfig(event.uid),
        database.menuplan.getCutoffTimes(),
      ])
        .then(async ([menuplan, groupConfigDomain, cutoffTimes]) => {
          if (cancelled) return;
          const groupConfiguration =
            database.eventGroupConfig.groupConfigDomainToUi(
              groupConfigDomain,
              event.uid,
            );

          const todayStr = formatLocalDate(new Date());
          const recipeUidsToday = new Set<string>();
          Object.values(menuplan.meals)
            .filter((meal) => meal.date === todayStr)
            .forEach((meal) => {
              meal.menuOrder.forEach((menueUid) => {
                menuplan.menues[menueUid]?.mealRecipeOrder.forEach(
                  (mealRecipeUid) => {
                    const recipeUid =
                      menuplan.mealRecipes[mealRecipeUid]?.recipe.recipeUid;
                    if (recipeUid) recipeUidsToday.add(recipeUid);
                  },
                );
              });
            });

          const recipeEntries = await Promise.all(
            Array.from(recipeUidsToday).map(async (recipeUid) => {
              const recipe = await database.recipes.getRecipe(recipeUid);
              return [recipeUid, recipe] as const;
            }),
          );
          const recipePictures = new Map(
            recipeEntries
              .filter(
                (entry): entry is [string, RecipeDomain] => entry[1] !== null,
              )
              .map(([uid, recipe]) => [
                uid,
                {
                  pictureSrc: recipe.pictureSrc,
                  type: recipe.recipeType as RecipeType,
                },
              ]),
          );

          if (!cancelled) {
            setData({
              menuplan,
              groupConfiguration,
              mealGroups: buildTodaysMealGroups(
                menuplan,
                recipePictures,
                cutoffTimes,
              ),
            });
          }
        })
        .catch((fetchError) => {
          Sentry.captureException(fetchError);
          if (!cancelled) {
            setData({
              menuplan: createEmptyMenuplan(),
              groupConfiguration: new EventGroupConfiguration(),
              mealGroups: [],
            });
          }
        });

      return () => {
        cancelled = true;
      };
    }, [event.uid, database]);

    const isVisible = Boolean(
      data && activeSlice && data.mealGroups.length > 0,
    );

    React.useEffect(() => {
      onVisibilityChange(event.uid, isVisible);
      return () => onVisibilityChange(event.uid, false);
    }, [event.uid, isVisible, onVisibilityChange]);

    if (!data || !activeSlice || data.mealGroups.length === 0) return null;

    const totalDays = daysBetween(activeSlice.dateFrom, activeSlice.dateTo) + 1;
    const dayNumber = daysBetween(activeSlice.dateFrom, new Date()) + 1;

    /**
     * Öffnet die Menuplan-Seite mit automatisch geöffnetem Rezept-Drawer für
     * diese Mahlzeit-Einplanung — statt einer eigenen (halbfertig verdrahteten)
     * Rezept-Ansicht wird so exakt derselbe Drawer/Portionen-Bearbeiten-Pfad
     * wiederverwendet wie beim Klick direkt aus dem Menuplan.
     */
    const onRecipeClick = (recipe: OngoingMealRecipeDisplay) => {
      navigate(
        `${EVENT}/${event.uid}?tab=menuplan&openRecipe=${recipe.mealPlanRecipeUid}`,
      );
    };

    return (
      <Grid size={12}>
        <Typography variant="h6" component="h2" align="center">
          {TEXT_EVENT_ONGOING_TITLE}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{mb: 1.5}}
        >
          {`${event.name} · ${TEXT_EVENT_DAY_OF_TOTAL(dayNumber, totalDays)}`}
        </Typography>
        {data.mealGroups.map((group) => (
          <Box key={"ongoingMealType_" + group.mealTypeName} sx={{mb: 2}}>
            <Typography variant="subtitle2" align="center" sx={{mb: 1}}>
              {group.mealTypeName}
            </Typography>
            <Grid container spacing={1} justifyContent="center">
              {group.recipes.map((recipe) => (
                <Grid
                  key={"ongoingRecipe_" + recipe.mealPlanRecipeUid}
                  size={{xs: 6, sm: 4, md: 3, lg: 2}}
                >
                  <Card sx={classes.card}>
                    <CardActionArea onClick={() => onRecipeClick(recipe)}>
                      <CardMedia
                        component="img"
                        loading="lazy"
                        sx={{aspectRatio: "16 / 9", objectFit: "cover"}}
                        image={
                          recipe.pictureSrc ||
                          ImageRepository.getEnvironmentRelatedPicture()
                            .CARD_PLACEHOLDER_MEDIA
                        }
                        alt={recipe.recipeName}
                      />
                      <CardContent sx={{p: 1, "&:last-child": {pb: 1}}}>
                        <Typography variant="caption" display="block">
                          {recipe.recipeName}
                          {recipe.variantName
                            ? ` [Variante: ${recipe.variantName}]`
                            : ""}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {generatePlanedPortionsText({
                            uid: recipe.mealPlanRecipeUid,
                            portionPlan: recipe.plan,
                            groupConfiguration: data.groupConfiguration,
                          })}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Grid>
    );
  },
);
HomeOngoingEventSection.displayName = "HomeOngoingEventSection";

interface EventCardWithLifecycleProps {
  event: EventDomain;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Rendert eine einzelne Event-Karte inklusive ihres eigenen Countdown-/
 * Tag-Zählers, ihrer eigenen Mehrtages-Wettervorhersage und — falls
 * bevorstehend und innerhalb der Bereitschafts-Schwelle — ihrer eigenen
 * Checkliste. Jede Karte lädt ihre Daten unabhängig von den anderen Events.
 *
 * @param event - Das Event, für das die Karte gerendert wird.
 * @param onCardClick - Callback beim Klick auf die Karte.
 */
const EventCardWithLifecycle = React.memo(
  ({event, onCardClick}: EventCardWithLifecycleProps) => {
    const database = useDatabase();
    const navigate = useNavigate();
    const [weatherDays, setWeatherDays] = React.useState<WeatherForecastDay[]>(
      [],
    );
    const [readiness, setReadiness] = React.useState<EventReadinessState | null>(
      null,
    );

    const lifecycleStatus = getEventLifecycleStatus(event);
    const activeSlice = getActiveDateSlice(event);
    const nearestSlice = getNearestUpcomingDateSlice(event);
    const nearestStartDate = nearestSlice?.dateFrom ?? null;

    const daysUntilEvent = nearestStartDate
      ? daysBetween(new Date(), nearestStartDate)
      : null;
    const showReadinessChecklist =
      lifecycleStatus === "upcoming" &&
      daysUntilEvent !== null &&
      daysUntilEvent <= HOME_READINESS_THRESHOLD_DAYS;

    const countdownLabel = (() => {
      if (lifecycleStatus === "ongoing" && activeSlice) {
        const totalDays = daysBetween(activeSlice.dateFrom, activeSlice.dateTo) + 1;
        const dayNumber = daysBetween(activeSlice.dateFrom, new Date()) + 1;
        return TEXT_EVENT_DAY_OF_TOTAL(dayNumber, totalDays);
      }
      if (nearestStartDate) {
        return getCountdownLabel(daysBetween(new Date(), nearestStartDate));
      }
      return null;
    })();

    /* ------------------------------------------
    // Wettervorhersage für dieses Event — nach dem ersten Render, schlägt
    // still fehl (siehe openMeteo.ts)
    // ------------------------------------------ */
    React.useEffect(() => {
      let cancelled = false;
      setWeatherDays([]);

      const slice = lifecycleStatus === "ongoing" ? activeSlice : nearestSlice;
      if (event.location && slice) {
        getEventWeatherRange(event.location, slice.dateFrom, slice.dateTo).then(
          (result) => {
            if (!cancelled) setWeatherDays(result);
          },
        );
      }

      return () => {
        cancelled = true;
      };
      // Nur bei Wechsel der relevanten Zeitscheibe neu laden
    }, [event.uid, event.location, lifecycleStatus, activeSlice?.uid, nearestSlice?.uid]);

    /* ------------------------------------------
    // Bereitschafts-Checkliste — Rezeptliste/Einkaufsliste/Materialliste,
    // jeweils geprüft ob mind. eine Liste eine Mahlzeit der Ziel-Zeitscheibe
    // abdeckt (Listen sind nur pro Event gespeichert, nicht pro Zeitscheibe)
    // ------------------------------------------ */
    React.useEffect(() => {
      let cancelled = false;
      setReadiness(null);

      if (!showReadinessChecklist || !nearestSlice) return;

      Promise.all([
        database.menuplan.getMealIdsForEventInRange(
          event.uid,
          nearestSlice.dateFrom,
          nearestSlice.dateTo,
        ),
        database.usedRecipeLists.getListsForEvent(event.uid),
        database.shoppingLists.getListsForEvent(event.uid),
        database.materialLists.getListsForEvent(event.uid),
      ])
        .then(([mealIdsInRange, usedRecipeLists, shoppingLists, materialLists]) => {
          if (cancelled) return;

          const touchesRange = (lists: {selectedMeals: string[]}[]) =>
            lists.some((list) =>
              list.selectedMeals.some((mealId) => mealIdsInRange.has(mealId)),
            );

          setReadiness({
            usedRecipes: touchesRange(usedRecipeLists),
            shoppingList: touchesRange(shoppingLists),
            materialList: touchesRange(materialLists),
          });
        })
        .catch((fetchError) => {
          Sentry.captureException(fetchError);
          if (!cancelled) {
            setReadiness({
              usedRecipes: false,
              shoppingList: false,
              materialList: false,
            });
          }
        });

      return () => {
        cancelled = true;
      };
    }, [event.uid, nearestSlice?.uid, showReadinessChecklist, database]);

    const readinessItems: EventCardReadinessItem[] | undefined =
      showReadinessChecklist && readiness
        ? [
            {
              label: TEXT_PLANED_RECIPES,
              ready: readiness.usedRecipes,
              onNavigate: () =>
                navigate(`${EVENT}/${event.uid}?tab=usedrecipes`),
            },
            {
              label: TEXT_SHOPPING_LIST,
              ready: readiness.shoppingList,
              onNavigate: () =>
                navigate(`${EVENT}/${event.uid}?tab=shoppinglist`),
            },
            {
              label: TEXT_MATERIAL_LIST,
              ready: readiness.materialList,
              onNavigate: () =>
                navigate(`${EVENT}/${event.uid}?tab=materiallist`),
            },
          ]
        : undefined;

    return (
      <EventCard
        event={event}
        onCardClick={onCardClick}
        countdown={countdownLabel ? {label: countdownLabel} : undefined}
        weatherDays={weatherDays}
        readiness={readinessItems}
      />
    );
  },
);
EventCardWithLifecycle.displayName = "EventCardWithLifecycle";

const HomeNextEvents = React.memo(
  ({
    events,
    isLoadingEvents,
    error,
    onCardClick,
    onCreateNewEvent,
  }: HomeNextEventsProps) => {
    const classes = useCustomStyles();

    const createEventCardSize =
      events.length === 0
        ? {xs: 12, sm: 8, md: 6, lg: 4}
        : {xs: 12, sm: 6, md: 4, lg: 3};

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
              <EventCardWithLifecycle
                event={event}
                onCardClick={onCardClick}
                key={"eventCard_" + event.uid}
              />
            </Grid>
          ))}
          <Grid size={createEventCardSize}>
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
                <Typography color="text.secondary">
                  {TEXT_CREATE_EVENT}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </React.Fragment>
    );
  },
);
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
const HomePassedEvents = React.memo(
  ({
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
  },
);
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
const HomeNewestRecipes = React.memo(
  ({recipes, isLoadingRecipes, error, onCardClick}: HomeNewestRecipesProps) => {
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
            <Grid
              size={{xs: 6, lg: 12}}
              key={"emptyRecipeGrid_" + index}
            >
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
          <Grid size={{xs: 6, lg: 12}} key={"recipeGrid_" + recipe.uid}>
            <Card sx={classes.card} key={"recipeCard_" + recipe.uid}>
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
  },
);
HomeNewestRecipes.displayName = "HomeNewestRecipes";

/* ===================================================================
// ========================== Feed-Einträge ==========================
// =================================================================== */

/**
 * Abschnitt «Feed» — zeigt die neuesten Aktivitäten der Community.
 * Zeigt standardmässig nur die ersten `FEEDS_DISPLAY_COLLAPSED` Einträge,
 * mit einem "Zeige weitere Einträge"-Toggle für die restlichen.
 *
 * @param feed - Feed-Einträge
 * @param isLoadingFeed - Ladeindikator
 * @param onListEntryClick - Callback beim Klick auf einen Feed-Eintrag
 * @param showFeedExpanded - Ob alle Feed-Einträge angezeigt werden sollen
 * @param onToggleFeedExpanded - Callback zum Ein-/Ausklappen weiterer Einträge
 */
interface HomeFeedProps {
  feed: FeedDomain[];
  isLoadingFeed: boolean;
  onListEntryClick: (event: React.MouseEvent<HTMLElement>) => void;
  showFeedExpanded: boolean;
  onToggleFeedExpanded: () => void;
}
const HomeFeed = React.memo(
  ({
    feed,
    isLoadingFeed,
    onListEntryClick,
    showFeedExpanded,
    onToggleFeedExpanded,
  }: HomeFeedProps) => {
    const classes = useCustomStyles();
    const visibleFeed = showFeedExpanded
      ? feed
      : feed.slice(0, DEFAULT_VALUES_FEEDS_DISPLAY_COLLAPSED);

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
                [...Array(DEFAULT_VALUES_FEEDS_DISPLAY).keys()].map((index) => (
                  <ListItem key={"feedListItem_skeleton_" + index}>
                    <ListItemText
                      primary={<Skeleton />}
                      secondary={<Skeleton />}
                    />
                  </ListItem>
                ))}
              {!isLoadingFeed && feed.length === 0 && (
                <ListItem>
                  <ListItemText
                    primary={TEXT_HOME_EMPTY_FEED}
                    sx={{textAlign: "center"}}
                  />
                </ListItem>
              )}
              {visibleFeed.map((feedEntry, counter) => (
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
                  {counter !== visibleFeed.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </React.Fragment>
              ))}
            </List>
          </Card>
        </Grid>
        {!isLoadingFeed &&
          !showFeedExpanded &&
          feed.length > DEFAULT_VALUES_FEEDS_DISPLAY_COLLAPSED && (
            <Grid size={12} sx={classes.centerCenter}>
              <Button
                color="primary"
                sx={classes.button}
                onClick={onToggleFeedExpanded}
              >
                {TEXT_FEED_SHOW_MORE(
                  feed.length - DEFAULT_VALUES_FEEDS_DISPLAY_COLLAPSED,
                )}
              </Button>
            </Grid>
          )}
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
            {groupIndex > 0 && <Divider sx={{mx: "1rem"}} component="li" />}
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
            <AccordionDetails sx={{p: 0}}>{statsContent}</AccordionDetails>
          </Accordion>
        ) : (
          <Card sx={classes.card}>{statsContent}</Card>
        )}
      </Grid>
    </Grid>
  );
});
HomeStats.displayName = "HomeStats";
