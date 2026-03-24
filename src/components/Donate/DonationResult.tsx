/**
 * DonationResult — Ergebnisseite nach einer Payrexx-Zahlung.
 *
 * Liest die URL-Parameter `status`, `donationId` und `return` und zeigt
 * den entsprechenden Status (Erfolg, Fehler, Abbruch) an.
 *
 * @example
 * // URL: /donate/result?status=success&donationId=abc&return=%2Fdonate
 * <DonationResult />
 */
import React, {useEffect} from "react";
import {useSearchParams, useNavigate} from "react-router";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";

import {
  Container,
  Stack,
  Card,
  CardContent,
  Typography,
  Button,
} from "@mui/material";
import {
  CheckCircleOutline as CheckCircleIcon,
  ErrorOutline as ErrorIcon,
  WarningAmber as WarningIcon,
} from "@mui/icons-material";

import {PageTitle} from "../Shared/pageTitle";

import {
  DONATE as TEXT_DONATE,
  THANK_YOU_1000 as TEXT_THANK_YOU_1000,
  DONATION_RESULT_SUCCESS_TITLE as TEXT_SUCCESS_TITLE,
  DONATION_RESULT_SUCCESS_TEXT as TEXT_SUCCESS_TEXT,
  DONATION_RESULT_FAILED_TITLE as TEXT_FAILED_TITLE,
  DONATION_RESULT_FAILED_TEXT as TEXT_FAILED_TEXT,
  DONATION_RESULT_CANCEL_TITLE as TEXT_CANCEL_TITLE,
  DONATION_RESULT_CANCEL_TEXT as TEXT_CANCEL_TEXT,
  DONATION_RESULT_CONTINUE as TEXT_CONTINUE,
  DONATION_RESULT_UNKNOWN_TITLE as TEXT_UNKNOWN_TITLE,
  DONATION_RESULT_UNKNOWN_TEXT as TEXT_UNKNOWN_TEXT,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";

/* ===================================================================
// Komponente
// =================================================================== */

/**
 * Zeigt das Ergebnis einer Payrexx-Zahlung an.
 * Liest `status`, `donationId` und `return` aus den URL-Parametern.
 */
const DonationResultPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const classes = useCustomStyles();

  const status = searchParams.get("status") ?? "unknown";
  const returnPath = searchParams.get("return") ?? "/home";

  useEffect(() => {
    if (status === "success") {
      trackEvent(AnalyticsEvent.DONATION_COMPLETED);
    }
  }, [status]);

  /** Icon, Titel und Text je nach Status. */
  const getStatusContent = () => {
    switch (status) {
      case "success":
        return {
          icon: <CheckCircleIcon sx={{fontSize: 64, color: "success.main"}} />,
          title: TEXT_SUCCESS_TITLE,
          text: TEXT_SUCCESS_TEXT,
        };
      case "failed":
        return {
          icon: <ErrorIcon sx={{fontSize: 64, color: "error.main"}} />,
          title: TEXT_FAILED_TITLE,
          text: TEXT_FAILED_TEXT,
        };
      case "cancel":
        return {
          icon: <WarningIcon sx={{fontSize: 64, color: "warning.main"}} />,
          title: TEXT_CANCEL_TITLE,
          text: TEXT_CANCEL_TEXT,
        };
      default:
        return {
          icon: <ErrorIcon sx={{fontSize: 64, color: "text.secondary"}} />,
          title: TEXT_UNKNOWN_TITLE,
          text: TEXT_UNKNOWN_TEXT,
        };
    }
  };

  const {icon, title, text} = getStatusContent();

  return (
    <React.Fragment>
      <PageTitle title={TEXT_DONATE} subTitle={TEXT_THANK_YOU_1000} />
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Card sx={classes.card}>
          <CardContent sx={classes.cardContent}>
            <Stack
              spacing={3}
              sx={{justifyContent: "center", alignItems: "center", py: 2}}
            >
              {icon}
              <Typography variant="h5" align="center">
                {title}
              </Typography>
              <Typography variant="body1" align="center" color="text.secondary">
                {text}
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate(returnPath)}
                size="large"
              >
                {TEXT_CONTINUE}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </React.Fragment>
  );
};

export {DonationResultPage};
