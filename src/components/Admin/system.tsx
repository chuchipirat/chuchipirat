import React from "react";
import {useNavigate} from "react-router";

import {
  Container,
  IconButton,
  Card,
  CardHeader,
  CardContent,
  CardActionArea,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  Forward as ForwardIcon,
  ZoomOutMap as ZoomOutMapIcon,
  CallMerge as CallMergeIcon,
  Tune as TuneIcon,
  Timelapse as TimelapseIcon,
  ViewList as ViewListIcon,
  Event as EventIcon,
  Fastfood as FastfoodIcon,
  FindInPage as FindInPageIcon,
  Cached as CachedIcon,
  HeadsetMic as HeadsetMicIcon,
  Mail as MailIcon,
  Send as SendIcon,
  Cloud as CloudIcon,
  RssFeed as RssFeedIcon,
  Build as BuildIcon,
  Feedback as FeedbackIcon,
  SwapHoriz as SwapHorizIcon,
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
  JOBS as TEXT_JOBS,
  JOBS_DESCRIPTION as TEXT_JOBS_DESCRIPTION,
  DB_INDICES as TEXT_DB_INDICES,
  DB_INDICES_DESCRIPTION as TEXT_DB_INDICES_DESCRIPTION,
  OVERVIEW_DIFFERENT_ELEMENTS as TEXT_OVERVIEW_DIFFERENT_ELEMENTS,
  RECIPES as TEXT_RECIPES,
  EVENTS as TEXT_EVENTS,
  ACTIVATE_SUPPORT_USER as TEXT_ACTIVATE_SUPPORT_USER,
  ACTIVATE_SUPPORT_USER_DESCRIPTION as TEXT_ACTIVATE_SUPPORT_USER_DESCRIPTION,
  MAIL_CONSOLE as TEXT_MAIL_CONSOLE,
  MAIL_CONSOLE_DESCRIPTION as TEXT_MAIL_CONSOLE_DESCRIPTION,
  MIGRATION as TEXT_MIGRATION,
  MIGRATION_DESCRIPTION as TEXT_MIGRATION_DESCRIPTION,
  MAILBOX as TEXT_MAILBOX,
  CLOUD_FX as TEXT_CLOUD_FX,
  FEEDS as TEXT_FEEDS,
  SYSTEM_MESSAGE as TEXT_SYSTEM_MESSAGE,
} from "../../constants/text";
import Role from "../../constants/roles";
import {
  SYSTEM_GLOBAL_SETTINGS as ROUTE_SYSTEM_GLOBAL_SETTINGS,
  SYSTEM_WHERE_USED as ROUTE_SYSTEM_WHERE_USED,
  TEMP as ROUTE_TEMP,
  SYSTEM_MERGE_ITEM as ROUTE_SYSTEM_MERGE_PRODUCT,
  SYSTEM_CONVERT_ITEM as ROUTE_SYSTEM_CONVERT_ITEM,
  SYSTEM_JOBS as ROUTES_SYSTEM_JOBS,
  SYSTEM_DB_INDICES as ROUTE_SYSTEM_DB_INDICES,
  SYSTEM_OVERVIEW_RECIPES as ROUTE_SYSTEM_OVERVIEW_RECIPES,
  SYSTEM_OVERVIEW_EVENTS as ROUTE_SYSTEM_OVERVIEW_EVENTS,
  SYSTEM_ACTIVATE_SUPPORT_USER as ROUTE_SYSTEM_ACTIVATE_SUPPORT_USER,
  SYSTEM_MAIL_CONSOLE as ROUTE_SYSTEM_MAIL_CONSOLE,
  SYSTEM_MIGRATION as ROUTE_SYSTEM_MIGRATION,
  SYSTEM_OVERVIEW_MAILBOX as ROUTE_SYSTEM_OVERVIEW_MAILBOX,
  SYSTEM_OVERVIEW_CLOUDFX as ROUTE_SYSTEM_OVERVIEW_CLOUDFX,
  SYSTEM_OVERVIEW_FEEDS as ROUTE_OVERVIEW_FEEDS,
  SYSTEM_SYSTEM_MESSAGES as ROUTE_SYSTEM_SYSTEM_MESSAGES,
} from "../../constants/routes";

import useCustomStyles from "../../constants/styles";

import PageTitle from "../Shared/pageTitle";
import {useAuthUser} from "../Session/authUserContext";
import {useFirebase} from "../Firebase/firebaseContext";
import AuthUser from "../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const SystemPage = () => {
  const firebase = useFirebase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Ziel ansteuern
  // ------------------------------------------ */
  const goToDestination = (routeDestination: string) => {
    navigate(routeDestination);
  };

  return (
    <>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_ADMIN}
        subTitle={TEXT_WELCOME_ON_THE_BRIDGE_CAPTAIN}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="md">
        <Grid container spacing={2}>
          {authUser.roles.includes(Role.admin) && (
 <Grid size={{ xs: 12, md: 6 }} >
              <SettingsTile goToDestination={goToDestination} />
            </Grid>
          )}
 <Grid size={{ xs: 12, md: 6 }} >
            <OverviewTile
              id={"overview"}
              onShowRecipes={goToDestination}
              onShowEvents={goToDestination}
              onShowMailbox={goToDestination}
              onShowCloudFx={goToDestination}
              onShowFeeds={goToDestination}
              icon={<ViewListIcon />}
              authUser={authUser}
            />
          </Grid>
 <Grid size={{ xs: 12, md: 6 }} >
            <AdminTile
              id={"support"}
              text={TEXT_ACTIVATE_SUPPORT_USER}
              description={TEXT_ACTIVATE_SUPPORT_USER_DESCRIPTION}
              icon={<HeadsetMicIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_ACTIVATE_SUPPORT_USER}
            />
          </Grid>
 <Grid size={{ xs: 12, md: 6 }} >
            <AdminTile
              id={"whereUsed"}
              text={TEXT_WHERE_USED}
              description={TEXT_WHERE_USED_DESCRIPTION}
              icon={<ZoomOutMapIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_WHERE_USED}
            />
          </Grid>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
            <AdminTile
              id={"merge"}
              text={TEXT_MERGE_ITEMS}
              description={TEXT_MERGE_ITEMS_DESCRIPTION}
              icon={<CallMergeIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_MERGE_PRODUCT}
            />
          </Grid>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
            <AdminTile
              id={"convert"}
              text={TEXT_CONVERT_ITEM}
              description={TEXT_CONVERT_PRODUCT_ITEM_DESCRIPTION}
              icon={<CachedIcon />}
              action={goToDestination}
              routeDestination={ROUTE_SYSTEM_CONVERT_ITEM}
            />
          </Grid>
          {authUser.roles.includes(Role.admin) && (
            <React.Fragment>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
                <AdminTile
                  id={"jobs"}
                  text={TEXT_JOBS}
                  description={TEXT_JOBS_DESCRIPTION}
                  icon={<TimelapseIcon />}
                  action={goToDestination}
                  routeDestination={ROUTES_SYSTEM_JOBS}
                />
              </Grid>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
                <AdminTile
                  id={"migration"}
                  text={TEXT_MIGRATION}
                  description={TEXT_MIGRATION_DESCRIPTION}
                  icon={<SwapHorizIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_MIGRATION}
                />
              </Grid>

 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
                <AdminTile
                  id={"dbIndices"}
                  text={TEXT_DB_INDICES}
                  description={TEXT_DB_INDICES_DESCRIPTION}
                  icon={<FindInPageIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_DB_INDICES}
                />
              </Grid>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
                <AdminTile
                  id={"mailConsole"}
                  text={TEXT_MAIL_CONSOLE}
                  description={TEXT_MAIL_CONSOLE_DESCRIPTION}
                  icon={<MailIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_SYSTEM_MAIL_CONSOLE}
                />
              </Grid>
 <Grid size={{ xs: 12, md: 6, lg: 4 }} >
                <AdminTile
                  id={"temp"}
                  text={"Temp"}
                  description={""}
                  icon={<CallMergeIcon />}
                  action={goToDestination}
                  routeDestination={ROUTE_TEMP}
                />
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </Container>
    </>
  );
};
/* ===================================================================
// ============================ Admin Tile  ==========================
// =================================================================== */
interface AdminTileProps {
  id: string;
  text: string;
  description: string;
  icon: JSX.Element;
  action: (routeDestination: string) => void;
  routeDestination: string;
}
const AdminTile = ({
  id,
  text,
  description,
  icon,
  action,
  routeDestination,
}: AdminTileProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"card_" + id}>
      <CardActionArea onClick={() => action(routeDestination)}>
        <CardHeader
          title={text}
          action={
            <IconButton aria-label={"admin Card " + text} size="large">
              {icon ? icon : <ForwardIcon />}
            </IconButton>
          }
        />
        <CardContent>
          <Typography>{description}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
/* ===================================================================
// ======================= Einstellungen Kachel ======================
// =================================================================== */
interface SettingsTileProps {
  goToDestination: (route: string) => void;
}
const SettingsTile = ({goToDestination}: SettingsTileProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"card_settings"}>
      <CardHeader
        title={TEXT_GLOBAL_SETTINGS}
        action={
          <IconButton aria-label={"settings Card "} size="large">
            <BuildIcon />
          </IconButton>
        }
      />
      <CardContent>
        <List component="nav" aria-label="Mögliche Einstullen">
          <ListItemButton>
            <ListItemIcon>
              <TuneIcon />
            </ListItemIcon>
            <ListItemText
              primary={TEXT_GLOBAL_SETTINGS}
              onClick={() => goToDestination(ROUTE_SYSTEM_GLOBAL_SETTINGS)}
            />
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
              <FeedbackIcon />
            </ListItemIcon>
            <ListItemText
              primary={TEXT_SYSTEM_MESSAGE}
              onClick={() => goToDestination(ROUTE_SYSTEM_SYSTEM_MESSAGES)}
            />
          </ListItemButton>
        </List>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ====================== Überblick Kachel Tile  =====================
// =================================================================== */
interface OverviewTileProps {
  id: string;
  onShowRecipes: (routeDestination: string) => void;
  onShowEvents: (routeDestination: string) => void;
  onShowMailbox: (routeDestination: string) => void;
  onShowCloudFx: (routeDestination: string) => void;
  onShowFeeds: (routeDestination: string) => void;
  icon: JSX.Element;
  authUser: AuthUser;
}
const OverviewTile = ({
  id,
  onShowRecipes,
  onShowEvents,
  onShowMailbox,
  onShowCloudFx,
  onShowFeeds,
  icon,
  authUser,
}: OverviewTileProps) => {
  const classes = useCustomStyles();
  return (
    <Card sx={classes.card} key={"card_" + id}>
      <CardHeader
        title={TEXT_OVERVIEW_DIFFERENT_ELEMENTS}
        action={
          <IconButton aria-label={"admin Card "} size="large">
            {icon ? icon : <ForwardIcon />}
          </IconButton>
        }
      />
      <CardContent>
        <List component="nav" aria-label="Mögliche Übersichtslisten">
          <ListItemButton>
            <ListItemIcon>
              <FastfoodIcon />
            </ListItemIcon>
            <ListItemText
              primary={TEXT_RECIPES}
              onClick={() => onShowRecipes(ROUTE_SYSTEM_OVERVIEW_RECIPES)}
            />
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
              <EventIcon />
            </ListItemIcon>
            <ListItemText
              primary={TEXT_EVENTS}
              onClick={() => onShowEvents(ROUTE_SYSTEM_OVERVIEW_EVENTS)}
            />
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon>
              <RssFeedIcon />
            </ListItemIcon>
            <ListItemText
              primary={TEXT_FEEDS}
              onClick={() => onShowFeeds(ROUTE_OVERVIEW_FEEDS)}
            />
          </ListItemButton>
          {authUser.roles.includes(Role.admin) && (
            <React.Fragment>
              <ListItemButton>
                <ListItemIcon>
                  <SendIcon />
                </ListItemIcon>
                <ListItemText
                  primary={TEXT_MAILBOX}
                  onClick={() => onShowMailbox(ROUTE_SYSTEM_OVERVIEW_MAILBOX)}
                />
              </ListItemButton>
              <ListItemButton>
                <ListItemIcon>
                  <CloudIcon />
                </ListItemIcon>
                <ListItemText
                  primary={TEXT_CLOUD_FX}
                  onClick={() => onShowCloudFx(ROUTE_SYSTEM_OVERVIEW_CLOUDFX)}
                />
              </ListItemButton>
            </React.Fragment>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default SystemPage;
