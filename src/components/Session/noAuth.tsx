import React from "react";
import {PageTitle} from "../Shared/pageTitle";
import {Container, Link, Typography, Alert, AlertTitle} from "@mui/material";
import {
  HOME as ROUTE_HOME,
  SIGN_IN as ROUTE_SIGN_IN,
} from "../../constants/routes";
import {useNavigate} from "react-router";
import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  ALERT_TITLE_MUTINY_ON_THE_HIGH_SEAS as TEXT_ALERT_TITLE_MUTINY_ON_THE_HIGH_SEAS,
  REDIRECTION_IN as TEXT_REDIRECTION_IN,
  NO_AUTH_REDIRECT_TO_HOME as TEXT_NO_AUTH_REDIRECT_TO_HOME,
  OR_CLICK as TEXT_OR_CLICK,
  IF_YOU_ARE_IMPATIENT as TEXT_IF_YOU_ARE_IMPATIENT,
  HERE as TEXT_HERE,
} from "../../constants/text";
import {useCustomStyles} from "../../constants/styles";
import {useAuthUser} from "./authUserContext";

/** Countdown-Dauer in Sekunden bis zur automatischen Weiterleitung. */
const REDIRECT_COUNTDOWN_SECONDS = 10;

/**
 * Seite für fehlende Berechtigungen — zeigt einen Countdown und leitet
 * danach automatisch zur Startseite (eingeloggt) oder zur Anmeldeseite
 * (nicht eingeloggt) um.
 */
export const NoAuthPage = () => {
  const authUser = useAuthUser();
  const [timer, setTimer] = React.useState(REDIRECT_COUNTDOWN_SECONDS);
  const navigate = useNavigate();
  const classes = useCustomStyles();

  const redirectTarget = authUser !== null ? ROUTE_HOME : ROUTE_SIGN_IN;

  React.useEffect(() => {
    if (timer === 0) {
      const timeoutId = setTimeout(() => navigate(redirectTarget), 500);
      return () => clearTimeout(timeoutId);
    }
    const timeoutId = setTimeout(
      () => setTimer((previous) => previous - 1),
      1000,
    );
    return () => clearTimeout(timeoutId);
  }, [timer]);

  return (
    <React.Fragment>
      <PageTitle title={TEXT_ALERT_TITLE_WAIT_A_MINUTE} />
      <Container sx={classes.container} component="main" maxWidth="xs">
        <Alert severity="warning">
          <AlertTitle>
            {TEXT_ALERT_TITLE_MUTINY_ON_THE_HIGH_SEAS} - {TEXT_REDIRECTION_IN}{" "}
            {timer}
          </AlertTitle>
          <Typography>
            {TEXT_NO_AUTH_REDIRECT_TO_HOME}
            <br />
            {TEXT_OR_CLICK}
            <Link
              component="button"
              onClick={() => navigate(redirectTarget)}
            >
              {TEXT_HERE}
            </Link>
            {", "}
            {TEXT_IF_YOU_ARE_IMPATIENT}.
          </Typography>
        </Alert>
      </Container>
    </React.Fragment>
  );
};
