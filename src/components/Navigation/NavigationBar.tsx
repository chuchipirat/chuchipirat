import {useCallback, useContext, useState} from "react";
import {useLocation, useNavigate} from "react-router";

import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Link from "@mui/material/Link";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircle from "@mui/icons-material/AccountCircle";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

import * as ROUTES from "../../constants/routes";
import * as TEXT from "../../constants/text";
import {Action} from "../../constants/actions";
import {useCustomStyles} from "../../constants/styles";
import {getMatchingHelpPage} from "./helpCenter";
import {TestTenantRibbon} from "./TestTenantRibbon";
import {NavigationDrawer} from "./NavigationDrawer";
import {useSignOut} from "./useSignOut";
import {NavigationValuesContext} from "./navigationContext";
import {Utils} from "../Shared/utils.class";
import AuthUser from "../Firebase/Authentication/authUser.class";

/**
 * Props für die NavigationBar-Komponente.
 *
 * @param authUser - Der aktuell angemeldete Benutzer.
 */
type NavigationBarProps = {
  authUser: AuthUser;
};

/**
 * Hauptnavigationsleiste für authentifizierte Benutzer.
 *
 * Enthält App-Titel, Hilfe-Button, Benutzermenü (Profil/Abmelden)
 * und den seitlichen Navigations-Drawer. Der Hilfe-Button öffnet
 * die kontextbezogene Helpcenter-Seite basierend auf dem aktuellen Pfad.
 *
 * @param props - Siehe {@link NavigationBarProps}.
 * @returns AppBar mit Toolbar und Drawer.
 */
export const NavigationBar = ({authUser}: NavigationBarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const classes = useCustomStyles();
  const signOut = useSignOut();
  const navigationValuesContext = useContext(NavigationValuesContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen((previous) => !previous);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleMenuOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      setMenuAnchor(event.currentTarget);
    },
    []
  );

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleHelp = useCallback(() => {
    const helpPage = getMatchingHelpPage({
      actualPath: location.pathname,
      navigationObject: navigationValuesContext?.navigationValues.object,
      action: navigationValuesContext?.navigationValues.action,
    });
    window.open(helpPage, "_blank");
  }, [location.pathname, navigationValuesContext]);

  const handleNavigateToProfile = useCallback(() => {
    navigate(`${ROUTES.USER_PROFILE}/${authUser.uid}`, {
      state: {action: Action.VIEW},
    });
    setMenuAnchor(null);
  }, [navigate, authUser.uid]);

  const handleSignOut = useCallback(async () => {
    setMenuAnchor(null);
    await signOut();
  }, [signOut]);

  return (
    <>
      <AppBar color="primary">
        <Toolbar>
          <IconButton
            edge="start"
            sx={classes.navigationMenuButton}
            color="inherit"
            aria-label="Menü"
            onClick={handleToggleDrawer}
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
              aria-label="Hilfe-Seite aufrufen"
              aria-controls="menu-appbar"
              aria-haspopup="false"
              color="inherit"
              onClick={handleHelp}
              size="large"
            >
              <HelpOutlineIcon />
            </IconButton>
            <IconButton
              aria-label="Benutzerkonto"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenuOpen}
              color="inherit"
              size="large"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={menuAnchor}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={menuOpen}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleNavigateToProfile}>
                {TEXT.NAVIGATION_USER_PROFILE}
              </MenuItem>
              <MenuItem onClick={handleSignOut}>{TEXT.SIGN_OUT}</MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
      <Toolbar sx={classes.toolbar} id="back-to-top-anchor" disableGutters />
      <NavigationDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        authUser={authUser}
      />
    </>
  );
};
