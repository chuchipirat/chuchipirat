import React from "react";
import {useLocation, useNavigate} from "react-router";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircle from "@mui/icons-material/AccountCircle";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Link from "@mui/material/Link";

import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";

import {Box, List, ListItemButton} from "@mui/material";

import ListItemIcon from "@mui/material/ListItemIcon";
import EventIcon from "@mui/icons-material/Event";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import ListItemText from "@mui/material/ListItemText";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import StraightenIcon from "@mui/icons-material/Straighten";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import SettingsIcon from "@mui/icons-material/Settings";
import GroupIcon from "@mui/icons-material/Group";
import NewReleasesIcon from "@mui/icons-material/NewReleases";
import DescriptionIcon from "@mui/icons-material/Description";
import BuildIcon from "@mui/icons-material/Build";
import HomeIcon from "@mui/icons-material/Home";

import Action from "../../constants/actions";
import * as ROUTES from "../../constants/routes";
import * as TEXT from "../../constants/text";
import * as BUTTONTEXT from "../../constants/buttonText";
import LocalStorageKey from "../../constants/localStorage";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";

import HelpCenter from "./helpCenter.class";

import DialogRefreshApp from "./dialogRefreshApp";

import Role from "../../constants/roles";

import {NavigationValuesContext} from "../Navigation/navigationContext";
import {useAuthUser} from "../Session/authUserContext";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";

import Utils from "../Shared/utils.class";
import {DonateIcon} from "../Shared/icons";
import {logEvent} from "firebase/analytics";
import useCustomStyles from "../../constants/styles";
import AuthUser from "../Firebase/Authentication/authUser.class";
import Firebase from "../Firebase/firebase.class";

// ===================================================================
// ============================= Global =============================
// ===================================================================
type Anchor = "top" | "left" | "bottom" | "right";

// ===================================================================
// ========================== Scroll to Top  =========================
// ===================================================================
// interface ScrollTopProps {
//   children: React.ReactElement;
//   window?: () => Window;
// }

// function ScrollTop(props: ScrollTopProps) {
//   const {children, window} = props;
//   const classes = useStyles();

//   const trigger = useScrollTrigger({
//     target: window ? window() : undefined,
//     disableHysteresis: true,
//     threshold: 100,
//   });

//   const handleTopClick = (event) => {
//     const anchor = (event.target.ownerDocument || document).querySelector(
//       "#back-to-top-anchor"
//     );
//     if (anchor) {
//       anchor.scrollIntoView({behavior: "smooth", block: "center"});
//     }
//   };

//   return (
//     <Zoom in={trigger}>
//       <div
//         key={"backToTop"}
//         onClick={handleTopClick}
//         role="presentation"
//         className={classes.fabBottom}
//       >
//         {children}
//       </div>
//     </Zoom>
//   );
// }

// ===================================================================
// ======================= Navigation Komponente =====================
// ===================================================================
const NavigationComponent: React.FC = () => {
  const authUser = useAuthUser();
  return <div>{authUser ? <NavigationAuth /> : <NavigationNoAuth />}</div>;
};

// ===================================================================
// ==================== Navigation mit Berechtigung ==================
// ===================================================================
const NavigationAuth: React.FC = () => {
  const location = useLocation();
  const classes = useCustomStyles();
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();

  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const [showDialogRefreshApp, setShowDialogRefreshApp] = React.useState(false);
  const [state, setDrawerState] = React.useState({
    left: false,
  });
  const open = Boolean(anchorEl);

  // const [loadedVersionIsUpToDate, setLoadedVersionIsUpToDate] =
  // React.useState(false);
  /* ------------------------------------------
  // Prüfen ob sich die Version geändert hat
  // ------------------------------------------ */
  //FIXME:
  // type LocalStorageVersion = {
  //   lastFetchedVersion: string;
  //   lastCheck: string;
  // };

  // const isVersionUpToDate = async () => {
  //   console.warn("hier");
  //   let actualVersion = "";
  //   let localStorageVersion: LocalStorageVersion | null = null;
  //   const localStorageVersionString = localStorage.getItem(
  //     LocalStorageKey.VERSION
  //   );

  //   if (localStorageVersionString) {
  //     localStorageVersion = JSON.parse(
  //       localStorageVersionString
  //     ) as LocalStorageVersion;
  //   }

  //   // aktuelles Datum als String - für bessere Vergleichbarkeit
  //   const today = new Date();
  //   const todayString = `${String(today.getFullYear())}-${String(
  //     today.getMonth() + 1
  //   ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  //   if (
  //     !localStorageVersion ||
  //     localStorageVersion?.lastCheck !== todayString
  //   ) {
  //     console.warn("=== READ VERSION===");
  //     // Kein Wert oder veraltet
  //     await Environment.getActualVersion({firebase: firebase})
  //       .then((result) => {
  //         actualVersion = result;

  //         // speichern
  //         localStorage.setItem(
  //           LocalStorageKey.VERSION,
  //           JSON.stringify({
  //             lastCheck: todayString,
  //             lastFetchedVersion: actualVersion,
  //           })
  //         );
  //       })
  //       .catch((error) => {
  //         console.error(error);
  //       });
  //   } else {
  //     actualVersion = localStorageVersion.lastFetchedVersion;
  //   }

  //   if (actualVersion !== packageJson.version) {
  //     return false;
  //   } else {
  //     return true;
  //   }
  // };
  /* ------------------------------------------
  Aktuelle Version holen
  ------------------------------------------ */
  // React.useEffect(() => {
  //   // Einmal ausführen
  //   getActualVersion();

  //   // Timer stellen, dass es in 12 Stunden erneut ausgeführt wird (falls kein Refresh stattfindet)
  //   const intervalId = setInterval(getActualVersion, 60 * 60 * 12 * 1000); // alle 12 Stunden

  //   return () => {
  //     clearInterval(intervalId);
  //   };
  // }, []);

  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Kontextmenü-Handler
  // ------------------------------------------ */
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  /* ------------------------------------------
  // Hilfe-Button
  // ------------------------------------------ */
  const handleHelp = () => {
    const helpPage = HelpCenter.getMatchingHelpPage({
      actualPath: location.pathname,
      navigationObject: navigationValuesContext?.navigationValues.object,
      action: navigationValuesContext?.navigationValues.action,
    });

    window.open(helpPage, "_blank");
  };

  const navigate = useNavigate();

  /* ------------------------------------------
  // Navigation-Panel
  // ------------------------------------------ */

  const toggleDrawer =
    (anchor: Anchor, open: boolean) =>
    (event: React.KeyboardEvent | React.MouseEvent) => {
      if (
        event.type === "keydown" &&
        ((event as React.KeyboardEvent).key === "Tab" ||
          (event as React.KeyboardEvent).key === "Shift")
      ) {
        return;
      }

      setDrawerState({...state, [anchor]: open});
    };

  const handleMenuClick = async (event: React.MouseEvent<HTMLElement>) => {
    const pressedButton = event.currentTarget.id.split("_");

    switch (pressedButton[0]) {
      case BUTTONTEXT.ACCOUNT:
        navigate(`${ROUTES.USER_PROFILE}/${authUser.authUid}`, {
          state: {action: Action.VIEW},
        });
        break;
      case BUTTONTEXT.SIGNOUT:
        // Beide Auth-Provider abmelden (Supabase + Firebase)
        database.auth.signOut().catch(() => {});
        firebase.signOut();
        localStorage.removeItem(LocalStorageKey.AUTH_USER);

        // Kurz warten, damit der Auth-Context nach mag
        await new Promise(function (resolve) {
          setTimeout(resolve, 1000);
        });

        navigate(ROUTES.LANDING);
        break;
      default:
    }
    setAnchorEl(null);
  };
  /* ------------------------------------------
  // Fragen ob Seite refresht werden darf
  // ------------------------------------------ */
  // const onClickUpdateRibon = () => {
  //   setShowDialogRefreshApp(true);
  // };
  /* ------------------------------------------
  // App auffrischen
  // ------------------------------------------ */
  const onUpdateAppOk = () => {
    // Event auslösen
    logEvent(firebase.analytics, FirebaseAnalyticEvent.appForceRefresh);
    window.localStorage.clear();
    window.location.reload();
    setShowDialogRefreshApp(false);
  };
  /* ------------------------------------------
  // Refresh abbrechen
  // ------------------------------------------ */
  const onUpdateAppCancel = () => {
    setShowDialogRefreshApp(false);
  };
  const list = (anchor: Anchor) => (
    <Box
      role="presentation"
      onClick={toggleDrawer(anchor, false)}
      onKeyDown={toggleDrawer(anchor, false)}
    >
      <List>
        <ListItemButton key="Home" onClick={() => navigate(ROUTES.HOME)}>
          <ListItemIcon>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.HOME_DASHBOARD} />
        </ListItemButton>
      </List>
      <Divider />
      <List>
        <ListItemButton key="Recipes" onClick={() => navigate(ROUTES.RECIPES)}>
          <ListItemIcon>
            <FastfoodIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.RECIPES} />
        </ListItemButton>
        <ListItemButton key="Events" onClick={() => navigate(ROUTES.EVENTS)}>
          <ListItemIcon>
            <EventIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.EVENTS} />
        </ListItemButton>
      </List>
      <Divider />
      <List>
        <ListItemButton
          key="UnitConversion"
          onClick={() => navigate(ROUTES.UNITCONVERSION)}
        >
          <ListItemIcon>
            <SwapHorizIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.NAVIGATION_UNIT_CONVERSION} />
        </ListItemButton>
      </List>
      <Divider />
      <List>
        <ListItemButton
          key="requestOverview"
          onClick={() => navigate(ROUTES.REQUEST_OVERVIEW)}
        >
          <ListItemIcon>
            <DescriptionIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.NAVIGATION_REQUEST_OVERVIEW} />
        </ListItemButton>
      </List>
      <Divider />
      <List>
        <ListItemButton key="donate" onClick={() => navigate(ROUTES.DONATE)}>
          <ListItemIcon>
            <DonateIcon />
          </ListItemIcon>
          <ListItemText primary={TEXT.DONATE} />
        </ListItemButton>
      </List>
      {authUser.roles?.includes(Role.communityLeader) && (
        <React.Fragment>
          <Divider />
          <List>
            <ListItemButton
              key="Products"
              onClick={() => navigate(ROUTES.PRODUCTS)}
            >
              <ListItemIcon>
                <LoyaltyIcon />
              </ListItemIcon>
              <ListItemText primary={TEXT.NAVIGATION_PRODUCTS} />
            </ListItemButton>
            <ListItemButton
              key="Materials"
              onClick={() => navigate(ROUTES.MATERIALS)}
            >
              <ListItemIcon>
                <BuildIcon />
              </ListItemIcon>
              <ListItemText primary={TEXT.MATERIALS} />
            </ListItemButton>
            <ListItemButton key="departments">
              <ListItemIcon>
                <ShoppingCartIcon />
              </ListItemIcon>
              <ListItemText
                primary={TEXT.NAVIGATION_DEPARTMENTS}
                onClick={() => navigate(ROUTES.DEPARTMENTS)}
              />
            </ListItemButton>
          </List>
        </React.Fragment>
      )}
      {authUser.roles?.includes(Role.communityLeader) && (
        <React.Fragment>
          <ListItemButton key="Units" onClick={() => navigate(ROUTES.UNITS)}>
            <ListItemIcon>
              <StraightenIcon />
            </ListItemIcon>
            <ListItemText primary={TEXT.NAVIGATION_UNITS} />
          </ListItemButton>
          <Divider />
          <List>
            <ListItemButton key="Admin" onClick={() => navigate(ROUTES.SYSTEM)}>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary={TEXT.NAVIGATION_SYSTEM} />
            </ListItemButton>
            {authUser.roles?.includes(Role.admin) && (
              <ListItemButton
                key="Users"
                onClick={() => navigate(ROUTES.SYSTEM_OVERVIEW_USERS)}
              >
                <ListItemIcon>
                  <GroupIcon />
                </ListItemIcon>
                <ListItemText primary={TEXT.NAVIGATION_USERS} />
              </ListItemButton>
            )}
          </List>
          <Divider />
        </React.Fragment>
      )}
    </Box>
  );

  return (
    <React.Fragment>
      <AppBar color="primary">
        <Toolbar>
          <IconButton
            edge="start"
            sx={classes.navigationMenuButton}
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer("left", true)}
            disabled={!authUser.emailVerified}
            size="large"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={classes.navigationTitle}>
            <Link
              component="button"
              sx={classes.navigationTitle}
              variant="h6"
              color="inherit"
              underline="none"
              onClick={() => navigate(ROUTES.HOME)}
            >
              {TEXT.APP_NAME}
            </Link>
          </Typography>
          {Utils.isTestEnvironment() ? <TestTenantRibbon /> : null}
          <div>
            <IconButton
              aria-label="go to Helppage"
              aria-controls="menu-appbar"
              aria-haspopup="false"
              color="inherit"
              onClick={handleHelp}
              size="large"
            >
              <HelpOutlineIcon />
            </IconButton>
            <IconButton
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
              size="large"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={open}
              onClose={handleClose}
            >
              <MenuItem id={BUTTONTEXT.ACCOUNT} onClick={handleMenuClick}>
                {TEXT.NAVIGATION_USER_PROFILE}
              </MenuItem>
              <MenuItem id={BUTTONTEXT.SIGNOUT} onClick={handleMenuClick}>
                {TEXT.SIGN_OUT}
              </MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <Toolbar sx={classes.toolbar} id="back-to-top-anchor" disableGutters />
      <div>
        <React.Fragment key={"left"}>
          <Drawer
            anchor={"left"}
            open={state["left"]}
            onClose={toggleDrawer("left", false)}
          >
            {list("left")}
          </Drawer>
        </React.Fragment>
        {/* ))} */}
      </div>
      <DialogRefreshApp
        dialogOpen={showDialogRefreshApp}
        handleOk={onUpdateAppOk}
        handleClose={onUpdateAppCancel}
      />
    </React.Fragment>
  );
};
// ===================================================================
// ================== Navigation ohne Berechtigung ===================
// ===================================================================
// Komponente für Navigation ohne Login//Ohne Berechtigungen
const NavigationNoAuth: React.FC = () => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  return (
    <React.Fragment>
      <AppBar color="primary">
        <Toolbar>
          <Typography variant="h6" sx={classes.navigationTitle}>
            <Link
              variant="h6"
              component="button"
              color="inherit"
              underline="none"
              onClick={() => navigate(ROUTES.LANDING)}
            >
              {TEXT.APP_NAME}
            </Link>
          </Typography>
          {Utils.isTestEnvironment() ? <TestTenantRibbon /> : null}
          <div>
            <Typography variant="h6" sx={classes.navigationTitle}>
              <Link
                variant="body1"
                component="button"
                color="inherit"
                underline="none"
                onClick={() => navigate(ROUTES.SIGN_IN)}
              >
                {TEXT.SIGN_IN}
              </Link>
            </Typography>
          </div>
        </Toolbar>
      </AppBar>
      <Toolbar id="back-to-top-anchor" />
    </React.Fragment>
  );
};
/* ===================================================================
// =============================== Ribbon ============================
// =================================================================== */
interface RibbonProps {
  text?: string;
  icon?: JSX.Element;
}
export const Ribbon = ({text, icon}: RibbonProps) => {
  return (
    <div className="ribbon  ribbon--red">{text ? text : icon ? icon : ""}</div>
  );
};

export const TestTenantRibbon = () => {
  return <div className="ribbon  ribbon--yellow">TEST</div>;
};
interface UpdateRibbonProps {
  onClick: (event: React.SyntheticEvent) => void;
}
export const UpdateRibbon = ({onClick}: UpdateRibbonProps) => {
  return (
    <div className="ribbon  ribbon--purple">
      <Link component="button" color="inherit" onClick={onClick}>
        {<NewReleasesIcon fontSize="large" />}
      </Link>
    </div>
  );
};

export default NavigationComponent;
