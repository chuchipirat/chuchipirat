/**
 * System-Hub-Seite — zentrale Navigationsseite für alle Admin- und
 * Community-Leader-Funktionen.
 *
 * Die Kacheln sind in vier Sektionen gruppiert:
 * - Einstellungen (nur Admin)
 * - Datenoperationen
 * - Übersichten
 * - Extern (Links zu Sentry / Supabase Dashboard)
 */
import React, {useCallback} from "react";
import {useNavigate} from "react-router";

import {
  Container,
  Card,
  CardHeader,
  CardContent,
  CardActionArea,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  Forward as ForwardIcon,
  ZoomOutMap as ZoomOutMapIcon,
  CallMerge as CallMergeIcon,
  Tune as TuneIcon,
  Event as EventIcon,
  Fastfood as FastfoodIcon,
  Cached as CachedIcon,
  HeadsetMic as HeadsetMicIcon,
  Mail as MailIcon,
  Send as SendIcon,
  RssFeed as RssFeedIcon,
  Feedback as FeedbackIcon,
  SwapHoriz as SwapHorizIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  OpenInNew as OpenInNewIcon,
  BugReport as BugReportIcon,
  Storage as StorageIcon,
} from "@mui/icons-material";

import {
  ADMIN as TEXT_ADMIN,
  WELCOME_ON_THE_BRIDGE_CAPTAIN as TEXT_WELCOME_ON_THE_BRIDGE_CAPTAIN,
  GLOBAL_SETTINGS as TEXT_GLOBAL_SETTINGS,
  WHERE_USED as TEXT_WHERE_USED,
  WHERE_USED_DESCRIPTION as TEXT_WHERE_USED_DESCRIPTION,
  MERGE_ITEMS as TEXT_MERGE_ITEMS,
  MERGE_ITEMS_DESCRIPTION as TEXT_MERGE_ITEMS_DESCRIPTION,
  CONVERT_ITEM as TEXT_CONVERT_ITEM,
  CONVERT_PRODUCT_ITEM_DESCRIPTION as TEXT_CONVERT_PRODUCT_ITEM_DESCRIPTION,
  RECIPES as TEXT_RECIPES,
  EVENTS as TEXT_EVENTS,
  ACTIVATE_SUPPORT_USER as TEXT_ACTIVATE_SUPPORT_USER,
  ACTIVATE_SUPPORT_USER_DESCRIPTION as TEXT_ACTIVATE_SUPPORT_USER_DESCRIPTION,
  MAIL_CONSOLE as TEXT_MAIL_CONSOLE,
  MAIL_CONSOLE_DESCRIPTION as TEXT_MAIL_CONSOLE_DESCRIPTION,
  MIGRATION as TEXT_MIGRATION,
  MIGRATION_DESCRIPTION as TEXT_MIGRATION_DESCRIPTION,
  MAILBOX as TEXT_MAILBOX,
  FEEDS as TEXT_FEEDS,
  SYSTEM_MESSAGE as TEXT_SYSTEM_MESSAGE,
  SECTION_SETTINGS as TEXT_SECTION_SETTINGS,
  SECTION_DATA_OPERATIONS as TEXT_SECTION_DATA_OPERATIONS,
  SECTION_OVERVIEWS as TEXT_SECTION_OVERVIEWS,
  SECTION_EXTERNAL as TEXT_SECTION_EXTERNAL,
  OVERVIEW_RECIPES_DESCRIPTION as TEXT_OVERVIEW_RECIPES_DESCRIPTION,
  OVERVIEW_EVENTS_DESCRIPTION as TEXT_OVERVIEW_EVENTS_DESCRIPTION,
  OVERVIEW_USERS_DESCRIPTION as TEXT_OVERVIEW_USERS_DESCRIPTION,
  OVERVIEW_FEEDS_DESCRIPTION as TEXT_OVERVIEW_FEEDS_DESCRIPTION,
  OVERVIEW_MAILBOX_DESCRIPTION as TEXT_OVERVIEW_MAILBOX_DESCRIPTION,
  CRON_JOBS as TEXT_CRON_JOBS,
  CRON_JOBS_DESCRIPTION as TEXT_CRON_JOBS_DESCRIPTION,
  DATA_INTEGRITY as TEXT_DATA_INTEGRITY,
  DATA_INTEGRITY_DESCRIPTION as TEXT_DATA_INTEGRITY_DESCRIPTION,
  SENTRY_DASHBOARD as TEXT_SENTRY_DASHBOARD,
  SUPABASE_DASHBOARD as TEXT_SUPABASE_DASHBOARD,
  USERS as TEXT_USERS,
} from "../../constants/text";
import Role from "../../constants/roles";
import {
  SYSTEM as ROUTE_SYSTEM,
  SYSTEM_GLOBAL_SETTINGS as ROUTE_SYSTEM_GLOBAL_SETTINGS,
  SYSTEM_WHERE_USED as ROUTE_SYSTEM_WHERE_USED,
  SYSTEM_MERGE_ITEM as ROUTE_SYSTEM_MERGE_PRODUCT,
  SYSTEM_CONVERT_ITEM as ROUTE_SYSTEM_CONVERT_ITEM,
  SYSTEM_OVERVIEW_RECIPES as ROUTE_SYSTEM_OVERVIEW_RECIPES,
  SYSTEM_OVERVIEW_EVENTS as ROUTE_SYSTEM_OVERVIEW_EVENTS,
  SYSTEM_ACTIVATE_SUPPORT_USER as ROUTE_SYSTEM_ACTIVATE_SUPPORT_USER,
  SYSTEM_MAIL_CONSOLE as ROUTE_SYSTEM_MAIL_CONSOLE,
  SYSTEM_MIGRATION as ROUTE_SYSTEM_MIGRATION,
  SYSTEM_OVERVIEW_MAILBOX as ROUTE_SYSTEM_OVERVIEW_MAILBOX,
  SYSTEM_OVERVIEW_FEEDS as ROUTE_OVERVIEW_FEEDS,
  SYSTEM_SYSTEM_MESSAGES as ROUTE_SYSTEM_SYSTEM_MESSAGES,
  SYSTEM_OVERVIEW_USERS as ROUTE_SYSTEM_OVERVIEW_USERS,
  SYSTEM_CRON_JOBS as ROUTE_SYSTEM_CRON_JOBS,
  SYSTEM_DATA_INTEGRITY as ROUTE_SYSTEM_DATA_INTEGRITY,
} from "../../constants/routes";

import useCustomStyles from "../../constants/styles";

import PageTitle from "../Shared/pageTitle";
import {useAuthUser} from "../Session/authUserContext";

/* ===================================================================
// ====================== Breadcrumb-Konstante =======================
// =================================================================== */

/**
 * Breadcrumb-Konfiguration für die System-Hub-Seite.
 * Unter-Seiten können diese Konstante importieren, um eine einheitliche
 * „System > Seitenname"-Navigation anzuzeigen.
 */
export const SYSTEM_BREADCRUMB = {
  label: TEXT_ADMIN,
  route: ROUTE_SYSTEM,
} as const;

/* ===================================================================
// ========================= Externe Links ===========================
// =================================================================== */

const SENTRY_DASHBOARD_URL = "https://chuchipirat.sentry.io";
const SUPABASE_DASHBOARD_URL = "https://supabase.com/dashboard";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * System-Hub-Seite — zeigt gruppierte Kacheln für Admin- und
 * Community-Leader-Funktionen an.
 */
const SystemPage = () => {
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  if (!authUser) {
    return null;
  }

  const isAdmin = authUser.roles.includes(Role.admin);

  /** Navigation zu einer internen Seite. */
  const goToDestination = useCallback(
    (routeDestination: string) => {
      navigate(routeDestination);
    },
    [navigate]
  );

  return (
    <>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_ADMIN}
        subTitle={TEXT_WELCOME_ON_THE_BRIDGE_CAPTAIN}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="md">
        {/* ── Einstellungen (nur Admin) ── */}
        {isAdmin && (
          <>
            <SectionHeader title={TEXT_SECTION_SETTINGS} />
            <Grid container spacing={2} sx={{mb: 3}}>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="globalSettings"
                  text={TEXT_GLOBAL_SETTINGS}
                  description=""
                  icon={<TuneIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_GLOBAL_SETTINGS}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="systemMessages"
                  text={TEXT_SYSTEM_MESSAGE}
                  description=""
                  icon={<FeedbackIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_SYSTEM_MESSAGES}
                />
              </Grid>
            </Grid>
          </>
        )}

        {/* ── Datenoperationen ── */}
        <SectionHeader title={TEXT_SECTION_DATA_OPERATIONS} />
        <Grid container spacing={2} sx={{mb: 3}}>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="whereUsed"
              text={TEXT_WHERE_USED}
              description={TEXT_WHERE_USED_DESCRIPTION}
              icon={<ZoomOutMapIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_WHERE_USED}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="merge"
              text={TEXT_MERGE_ITEMS}
              description={TEXT_MERGE_ITEMS_DESCRIPTION}
              icon={<CallMergeIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_MERGE_PRODUCT}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="convert"
              text={TEXT_CONVERT_ITEM}
              description={TEXT_CONVERT_PRODUCT_ITEM_DESCRIPTION}
              icon={<CachedIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_CONVERT_ITEM}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="support"
              text={TEXT_ACTIVATE_SUPPORT_USER}
              description={TEXT_ACTIVATE_SUPPORT_USER_DESCRIPTION}
              icon={<HeadsetMicIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_ACTIVATE_SUPPORT_USER}
            />
          </Grid>
          {isAdmin && (
            <>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="dataIntegrity"
                  text={TEXT_DATA_INTEGRITY}
                  description={TEXT_DATA_INTEGRITY_DESCRIPTION}
                  icon={<HealthAndSafetyIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_DATA_INTEGRITY}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="mailConsole"
                  text={TEXT_MAIL_CONSOLE}
                  description={TEXT_MAIL_CONSOLE_DESCRIPTION}
                  icon={<MailIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_MAIL_CONSOLE}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="migration"
                  text={TEXT_MIGRATION}
                  description={TEXT_MIGRATION_DESCRIPTION}
                  icon={<SwapHorizIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_MIGRATION}
                />
              </Grid>
            </>
          )}
        </Grid>

        {/* ── Übersichten ── */}
        <SectionHeader title={TEXT_SECTION_OVERVIEWS} />
        <Grid container spacing={2} sx={{mb: 3}}>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="overviewRecipes"
              text={TEXT_RECIPES}
              description={TEXT_OVERVIEW_RECIPES_DESCRIPTION}
              icon={<FastfoodIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_OVERVIEW_RECIPES}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="overviewEvents"
              text={TEXT_EVENTS}
              description={TEXT_OVERVIEW_EVENTS_DESCRIPTION}
              icon={<EventIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_OVERVIEW_EVENTS}
            />
          </Grid>
          <Grid size={{xs: 12, sm: 6, md: 4}}>
            <AdminTile
              id="overviewFeeds"
              text={TEXT_FEEDS}
              description={TEXT_OVERVIEW_FEEDS_DESCRIPTION}
              icon={<RssFeedIcon />}
              action={goToDestination}
              routeDestination={ROUTE_OVERVIEW_FEEDS}
            />
          </Grid>
          {isAdmin && (
            <>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="overviewUsers"
                  text={TEXT_USERS}
                  description={TEXT_OVERVIEW_USERS_DESCRIPTION}
                  icon={<PeopleIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_OVERVIEW_USERS}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="overviewMailbox"
                  text={TEXT_MAILBOX}
                  description={TEXT_OVERVIEW_MAILBOX_DESCRIPTION}
                  icon={<SendIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_OVERVIEW_MAILBOX}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <AdminTile
                  id="cronJobs"
                  text={TEXT_CRON_JOBS}
                  description={TEXT_CRON_JOBS_DESCRIPTION}
                  icon={<ScheduleIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_CRON_JOBS}
                />
              </Grid>
            </>
          )}
        </Grid>

        {/* ── Extern (Links) ── */}
        {isAdmin && (
          <>
            <SectionHeader title={TEXT_SECTION_EXTERNAL} />
            <Grid container spacing={2} sx={{mb: 3}}>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <ExternalLinkTile
                  id="sentry"
                  text={TEXT_SENTRY_DASHBOARD}
                  icon={<BugReportIcon />}
                  url={SENTRY_DASHBOARD_URL}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 6, md: 4}}>
                <ExternalLinkTile
                  id="supabase"
                  text={TEXT_SUPABASE_DASHBOARD}
                  icon={<StorageIcon />}
                  url={SUPABASE_DASHBOARD_URL}
                />
              </Grid>
            </Grid>
          </>
        )}
      </Container>
    </>
  );
};

/* ===================================================================
// ======================== Sektions-Header ==========================
// =================================================================== */

/**
 * Abschnittsüberschrift für die System-Hub-Seite.
 *
 * @param title Titel der Sektion.
 */
const SectionHeader = React.memo(({title}: {title: string}) => (
  <Typography variant="h6" sx={{mt: 2, mb: 1}}>
    {title}
  </Typography>
));
SectionHeader.displayName = "SectionHeader";

/* ===================================================================
// ============================ Admin Tile  ==========================
// =================================================================== */

/** Eigenschaften für eine Admin-Kachel. */
type AdminTileProps = {
  /** Eindeutige ID der Kachel. */
  id: string;
  /** Angezeigter Titel. */
  text: string;
  /** Beschreibungstext unterhalb des Titels. */
  description: string;
  /** Icon-Element links im Header. */
  icon: JSX.Element;
  /** Callback für Navigation. */
  action: (routeDestination: string) => void;
  /** Ziel-Route. */
  routeDestination: string;
};

/**
 * Kachel-Komponente für eine interne Admin-Seite.
 *
 * @param props Kachel-Eigenschaften.
 */
const AdminTile = React.memo(
  ({id, text, description, icon, action, routeDestination}: AdminTileProps) => {
    const classes = useCustomStyles();

    return (
      <Card sx={classes.card} key={"card_" + id}>
        <CardActionArea onClick={() => action(routeDestination)}>
          <CardHeader
            title={text}
            action={icon ? icon : <ForwardIcon />}
          />
          {description && (
            <CardContent>
              <Typography>{description}</Typography>
            </CardContent>
          )}
        </CardActionArea>
      </Card>
    );
  }
);
AdminTile.displayName = "AdminTile";

/* ===================================================================
// ===================== Externe-Link-Kachel =========================
// =================================================================== */

/** Eigenschaften für eine externe Link-Kachel. */
type ExternalLinkTileProps = {
  /** Eindeutige ID der Kachel. */
  id: string;
  /** Angezeigter Titel. */
  text: string;
  /** Icon-Element links im Header. */
  icon: JSX.Element;
  /** Externe URL. */
  url: string;
};

/**
 * Kachel-Komponente für einen externen Link (öffnet in neuem Tab).
 *
 * @param props Kachel-Eigenschaften.
 */
const ExternalLinkTile = React.memo(
  ({id, text, icon, url}: ExternalLinkTileProps) => {
    const classes = useCustomStyles();

    return (
      <Card sx={classes.card} key={"card_" + id}>
        <CardActionArea
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <CardHeader
            title={text}
            action={<OpenInNewIcon />}
            avatar={icon}
          />
        </CardActionArea>
      </Card>
    );
  }
);
ExternalLinkTile.displayName = "ExternalLinkTile";

export default SystemPage;
