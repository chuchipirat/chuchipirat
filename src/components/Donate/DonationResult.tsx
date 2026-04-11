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
import React, {useCallback, useEffect, useState} from "react";
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
  Backdrop,
  CircularProgress,
  Alert,
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
  DONATION_RESULT_SUCCESS_TEXT_EVENT as TEXT_SUCCESS_TEXT_EVENT,
  DONATION_RESULT_SUCCESS_TEXT_STANDALONE as TEXT_SUCCESS_TEXT_STANDALONE,
  DONATION_RESULT_FAILED_TITLE as TEXT_FAILED_TITLE,
  DONATION_RESULT_FAILED_TEXT as TEXT_FAILED_TEXT,
  DONATION_RESULT_CANCEL_TITLE as TEXT_CANCEL_TITLE,
  DONATION_RESULT_CANCEL_TEXT as TEXT_CANCEL_TEXT,
  DONATION_RESULT_CONTINUE as TEXT_CONTINUE,
  DONATION_RESULT_RETRY as TEXT_RETRY,
  DONATION_RESULT_UNKNOWN_TITLE as TEXT_UNKNOWN_TITLE,
  DONATION_RESULT_UNKNOWN_TEXT as TEXT_UNKNOWN_TEXT,
  DONATION_ERROR_CREATE as TEXT_ERROR_CREATE,
  DONATION_ERROR_NO_URL as TEXT_ERROR_NO_URL,
  DONATION_ERROR_GENERIC as TEXT_ERROR_GENERIC,
} from "../../constants/text";

import {supabase} from "../Database/supabaseClient";

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
  const _donationId = searchParams.get("donationId");
  const returnPath = searchParams.get("return") ?? "/home";
  const amountInCents = parseInt(searchParams.get("amount") ?? "0", 10);
  const eventId = searchParams.get("eventId") ?? undefined;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Umsatz-Tracking bei erfolgreicher Spende (Umami Revenue)
  useEffect(() => {
    if (status === "success") {
      trackEvent(AnalyticsEvent.DONATION_COMPLETED, {
        ...(amountInCents > 0
          ? {revenue: amountInCents / 100, currency: "CHF"}
          : {}),
      });
    }
  }, [status, amountInCents]);

  /**
   * Erstellt eine neue Spende mit denselben Parametern (Betrag, Event)
   * und leitet erneut zur Payrexx-Zahlungsseite weiter.
   * Die fehlgeschlagene Spende bleibt als Audit-Trail in der DB.
   */
  const handleRetry = useCallback(async () => {
    if (!amountInCents) return;

    setIsRetrying(true);
    setRetryError(null);

    try {
      const {data, error: invokeError} = await supabase.functions.invoke(
        "create-donation",
        {
          body: {
            amountInCents,
            eventId,
            returnPath,
          },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message ?? TEXT_ERROR_CREATE);
      }

      const paymentUrl = data?.paymentUrl;
      if (!paymentUrl) {
        throw new Error(TEXT_ERROR_NO_URL);
      }

      window.location.href = paymentUrl;
    } catch (err) {
      setRetryError(
        err instanceof Error ? err.message : TEXT_ERROR_GENERIC,
      );
      setIsRetrying(false);
    }
  }, [amountInCents, eventId, returnPath]);

  /** Retry-Button nur anzeigen, wenn Betrag bekannt ist. */
  const showRetry =
    (status === "failed" || status === "cancel") && amountInCents > 0;

  /** Icon, Titel und Text je nach Status. */
  const getStatusContent = () => {
    switch (status) {
      case "success":
        return {
          icon: <CheckCircleIcon sx={{fontSize: 64, color: "success.main"}} />,
          title: TEXT_SUCCESS_TITLE,
          text: eventId ? TEXT_SUCCESS_TEXT_EVENT : TEXT_SUCCESS_TEXT_STANDALONE,
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

              {retryError && (
                <Alert severity="error" sx={{width: "100%"}}>
                  {retryError}
                </Alert>
              )}

              <Stack spacing={1.5} sx={{width: "100%"}}>
                {showRetry && (
                  <Button
                    variant="contained"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    size="large"
                    fullWidth
                  >
                    {TEXT_RETRY}
                  </Button>
                )}
                <Button
                  variant={showRetry ? "outlined" : "contained"}
                  onClick={() => navigate(returnPath)}
                  size="large"
                  fullWidth
                >
                  {TEXT_CONTINUE}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>

      <Backdrop
        open={isRetrying}
        sx={{color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1}}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </React.Fragment>
  );
};

export {DonationResultPage};
