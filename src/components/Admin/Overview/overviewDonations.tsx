/**
 * OverviewDonationsPage — Admin-Übersichtsseite für alle Spenden.
 *
 * Zeigt alle Spenden in einem DataGrid mit Status, Betrag, Zahlungsmethode,
 * Spender, Event und Quittungsnummer. Enthält zusammenfassende Statistiken
 * und Filtermöglichkeiten.
 */
import React, {useEffect, useState, useCallback, useMemo} from "react";

import {
  Container,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Box,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {DataGrid, GridColDef, GridToolbar} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import * as Sentry from "@sentry/react";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {useCustomStyles} from "../../../constants/styles";
import {useDatabase} from "../../Database/DatabaseContext";
import {useAuthUser} from "../../Session/authUserContext";

import {DonationDomain, DonationStatus} from "../../Donate/donation.types";

import {
  DONATIONS_OVERVIEW as TEXT_DONATIONS_OVERVIEW,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  DONATION_TOTAL_THIS_YEAR as TEXT_TOTAL_THIS_YEAR,
  DONATION_UNIQUE_DONORS as TEXT_UNIQUE_DONORS,
  DONATION_AVERAGE as TEXT_AVERAGE,
  DATE as TEXT_DATE,
  AMOUNT as TEXT_AMOUNT,
  DONATION_STATUS_LABEL as TEXT_STATUS,
  DONATION_PAYMENT_METHOD as TEXT_PAYMENT_METHOD,
  DONATION_DONOR as TEXT_DONOR,
  EVENT as TEXT_EVENT,
  DONATION_RECEIPT_NUMBER as TEXT_RECEIPT_NUMBER,
} from "../../../constants/text";

/* ===================================================================
// Status-Farben
// =================================================================== */

/** Gibt die MUI-Chip-Farbe für einen Spenden-Status zurück. */
function getStatusColor(
  status: DonationStatus,
): "success" | "error" | "warning" | "default" | "info" {
  switch (status) {
    case DonationStatus.confirmed:
      return "success";
    case DonationStatus.failed:
      return "error";
    case DonationStatus.cancelled:
      return "warning";
    case DonationStatus.migrated:
      return "info";
    default:
      return "default";
  }
}

/* ===================================================================
// Seite
// =================================================================== */

/**
 * Admin-Übersichtsseite für Spenden.
 */
const OverviewDonationsPage = () => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const classes = useCustomStyles();

  const [donations, setDonations] = useState<DonationDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /** Daten laden. */
  const loadDonations = useCallback(async () => {
    try {
      setIsLoading(true);
      const allDonations = await database.donations.getAllDonations();
      setDonations(allDonations);
    } catch (err) {
      const loadError = err instanceof Error ? err : new Error(String(err));
      Sentry.captureException(loadError);
      setError(loadError);
    } finally {
      setIsLoading(false);
    }
  }, [database]);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  /** Zusammenfassende Statistiken. */
  const stats = useMemo(() => {
    const confirmed = donations.filter(
      (donation) => donation.status === DonationStatus.confirmed,
    );
    const totalCents = confirmed.reduce(
      (sum, donation) => sum + donation.amountInCents,
      0,
    );
    const uniqueDonors = new Set(confirmed.map((donation) => donation.donorUid)).size;
    const averageCents = confirmed.length > 0
      ? Math.round(totalCents / confirmed.length)
      : 0;

    return {
      totalFormatted: `CHF ${(totalCents / 100).toFixed(2)}`,
      uniqueDonors,
      averageFormatted: `CHF ${(averageCents / 100).toFixed(2)}`,
      count: confirmed.length,
    };
  }, [donations]);

  /** DataGrid-Spalten. */
  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "createdAt",
        headerName: TEXT_DATE,
        width: 130,
        valueFormatter: (value: Date) =>
          value.toLocaleDateString("de-CH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }),
      },
      {
        field: "amountInCents",
        headerName: TEXT_AMOUNT,
        width: 110,
        valueFormatter: (value: number) =>
          `CHF ${(value / 100).toFixed(2)}`,
      },
      {
        field: "status",
        headerName: TEXT_STATUS,
        width: 120,
        renderCell: (params) => (
          <Chip
            label={params.value}
            color={getStatusColor(params.value as DonationStatus)}
            size="small"
          />
        ),
      },
      {
        field: "paymentMethod",
        headerName: TEXT_PAYMENT_METHOD,
        width: 130,
        valueFormatter: (value: string | null) => value ?? "—",
      },
      {
        field: "donorDisplayName",
        headerName: TEXT_DONOR,
        width: 180,
      },
      {
        field: "eventName",
        headerName: TEXT_EVENT,
        width: 180,
        valueFormatter: (value: string) => value || "—",
      },
      {
        field: "receiptNumber",
        headerName: TEXT_RECEIPT_NUMBER,
        width: 150,
        valueFormatter: (value: string | null) => value ?? "—",
      },
      {
        field: "donorMessage",
        headerName: "Nachricht",
        width: 250,
        valueFormatter: (value: string | null) => value ?? "—",
      },
    ],
    [],
  );

  if (!authUser) return null;

  return (
    <>
      <PageTitle
        title={TEXT_DONATIONS_OVERVIEW}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      <Container sx={classes.container} component="main" maxWidth="lg">
        {isLoading && (
          <Backdrop sx={classes.backdrop} open>
            <CircularProgress color="inherit" />
          </Backdrop>
        )}

        {error && (
          <AlertMessage error={error} messageTitle={TEXT_ALERT_TITLE_UUPS} />
        )}

        {!isLoading && !error && (
          <Stack spacing={3}>
            {/* Statistik-Karten */}
            <Grid container spacing={2}>
              <Grid size={{xs: 12, sm: 4}}>
                <StatCard label={TEXT_TOTAL_THIS_YEAR} value={stats.totalFormatted} />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <StatCard
                  label={TEXT_UNIQUE_DONORS}
                  value={String(stats.uniqueDonors)}
                />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}>
                <StatCard label={TEXT_AVERAGE} value={stats.averageFormatted} />
              </Grid>
            </Grid>

            {/* DataGrid */}
            <Box sx={{width: "100%"}}>
              <DataGrid
                rows={donations}
                columns={columns}
                getRowId={(row) => row.id}
                initialState={{
                  sorting: {sortModel: [{field: "createdAt", sort: "desc"}]},
                  pagination: {paginationModel: {pageSize: 25}},
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                disableRowSelectionOnClick
                slots={{toolbar: GridToolbar}}
                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                autoHeight
              />
            </Box>
          </Stack>
        )}
      </Container>
    </>
  );
};

/* ===================================================================
// Statistik-Karte
// =================================================================== */

/**
 * Einfache Statistik-Karte mit Label und Wert.
 *
 * @param props.label - Beschriftung.
 * @param props.value - Wert als String.
 */
type StatCardProps = {
  label: string;
  value: string;
};

const StatCard = ({label, value}: StatCardProps) => (
  <Card>
    <CardContent>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={600}>
        {value}
      </Typography>
    </CardContent>
  </Card>
);

export {OverviewDonationsPage};
export default OverviewDonationsPage;
