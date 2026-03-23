import {useNavigate} from "react-router";

import AppBar from "@mui/material/AppBar";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";

import * as ROUTES from "../../constants/routes";
import * as TEXT from "../../constants/text";
import {useCustomStyles} from "../../constants/styles";
import {TestTenantRibbon} from "./TestTenantRibbon";
import {Utils} from "../Shared/utils.class";

/**
 * Navigationsleiste für nicht authentifizierte Benutzer.
 *
 * Zeigt den App-Titel und einen «Anmelden»-Button.
 * In der Testumgebung wird zusätzlich das Test-Ribbon angezeigt.
 *
 * @returns AppBar mit Titel und Anmelde-Button.
 */
export const NavigationNoAuth = () => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  return (
    <>
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
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate(ROUTES.SIGN_IN)}
            >
              {TEXT.SIGN_IN}
            </Button>
          </div>
        </Toolbar>
      </AppBar>
      <Toolbar id="back-to-top-anchor" />
    </>
  );
};
