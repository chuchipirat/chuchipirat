import React from "react";
import * as Sentry from "@sentry/react";

import {
  Stack,
  Card,
  CardHeader,
  CardActions,
  CardContent,
  Typography,
  Skeleton,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

import {UserPaymentDetailsDomain} from "./userPaymentDetails.types";
import {UserPaymentDetailsDialog} from "./userPaymentDetailsDialog";
import {formatIban} from "../../utils/ibanUtils";

import {AnalyticsEvent} from "../Analytics/analyticsEvents";
import {trackEvent} from "../Analytics/analyticsService";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";
import {useCustomStyles} from "../../constants/styles";
import {
  isMissingSessionError,
  isTransientNetworkError,
  toError,
} from "../../utils/errorUtils";

import {
  DELETE as TEXT_DELETE,
  EDIT as TEXT_EDIT,
  PAYMENT_DETAILS as TEXT_PAYMENT_DETAILS,
  PAYMENT_DETAILS_HINT as TEXT_PAYMENT_DETAILS_HINT,
  MISSING_NAME_HINT as TEXT_MISSING_NAME_HINT,
  PAYMENT_DETAILS_ADD as TEXT_PAYMENT_DETAILS_ADD,
  ADDRESS as TEXT_ADDRESS,
  IBAN as TEXT_IBAN,
  PAYMENT_DETAILS_SAVED as TEXT_PAYMENT_DETAILS_SAVED,
  PAYMENT_DETAILS_DELETE as TEXT_PAYMENT_DETAILS_DELETE,
  PAYMENT_DETAILS_DELETE_HINT as TEXT_PAYMENT_DETAILS_DELETE_HINT,
  PAYMENT_DETAILS_DELETED as TEXT_PAYMENT_DETAILS_DELETED,
} from "../../constants/text";
import {AlertMessage} from "../Shared/AlertMessage";

/**
 * Props der {@link UserPaymentDetailsCard}.
 *
 * @property firstName - Vorname aus dem Profil (Kontoinhaber:in).
 * @property lastName - Nachname aus dem Profil.
 * @property onSuccess - Meldet eine Erfolgsmeldung an die Seite (Snackbar).
 * @property onError - Meldet einen Fehler beim Laden/Löschen an die Seite (AlertMessage oben).
 */
interface UserPaymentDetailsCardProps {
  firstName: string;
  lastName: string;
  onSuccess: (message: string) => void;
  onError: (error: Error) => void;
}
/**
 * Card "Zahlungsangaben" auf der Profilseite: zeigt Adresse und IBAN der
 * angemeldeten Person an, öffnet zum Hinterlegen/Bearbeiten den
 * {@link UserPaymentDetailsDialog} und löscht nach Bestätigung.
 *
 * Unabhängig vom Bearbeiten-Modus der Profilseite: Speichern ist hier
 * gleichzeitig die Einwilligung und soll eine eigene, bewusste Handlung sein.
 * Die Card lädt und hält ihre Daten selbst; nur Erfolgsmeldungen und Fehler
 * beim Laden/Löschen gehen an die Seite (Fehler beim Speichern bleiben im
 * Dialog, der dann offen bleibt).
 *
 * @param props - Siehe {@link UserPaymentDetailsCardProps}.
 * @example
 * <UserPaymentDetailsCard
 *   firstName={state.userProfile.firstName}
 *   lastName={state.userProfile.lastName}
 *   onSuccess={handlePaymentDetailsSuccess}
 *   onError={handlePaymentDetailsError}
 * />
 */
export const UserPaymentDetailsCard: React.FC<UserPaymentDetailsCardProps> = ({
  firstName,
  lastName,
  onSuccess,
  onError,
}) => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const {customDialog} = useCustomDialog();
  const classes = useCustomStyles();

  // Daten
  const [details, setDetails] = React.useState<UserPaymentDetailsDomain | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(true);
  // Vorgänge
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  // Dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState<Error | null>(null);

  const isNameMissing = !firstName.trim() || !lastName.trim();
  /* ------------------------------------------
  // Loading der Zahlungsangaben
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!authUser) return;
    setIsLoading(true);
    database.userPaymentDetails
      .getPaymentDetails(authUser.uid)
      .then((paymentDetails) => setDetails(paymentDetails))
      .catch((error) => {
        if (!isTransientNetworkError(error) && !isMissingSessionError(error)) {
          Sentry.captureException(toError(error));
        }
        onError(toError(error));
      })
      .finally(() => setIsLoading(false));
  }, [authUser?.uid]);
  /* ------------------------------------------
  // Datenbank-Operationen
  // ------------------------------------------ */
  /**
   * Speichert die (bereits geprüften und normalisierten) Angaben. Bei Erfolg
   * schliesst der Dialog; bei einem Fehler bleibt er mit den Eingaben offen.
   *
   * @param normalized - Angaben aus dem Dialog.
   */
  const handleSave = async (normalized: UserPaymentDetailsDomain) => {
    if (!authUser) return;
    setSaveError(null);
    setIsSaving(true);
    const isNewRecord = details === null;
    try {
      setDetails(
        await database.userPaymentDetails.savePaymentDetails(
          normalized,
          authUser,
        ),
      );
      setDialogOpen(false);
      trackEvent(
        isNewRecord
          ? AnalyticsEvent.PAYMENT_DETAILS_CREATED
          : AnalyticsEvent.PAYMENT_DETAILS_UPDATED,
      );
      onSuccess(TEXT_PAYMENT_DETAILS_SAVED);
    } catch (error) {
      if (!isTransientNetworkError(error)) Sentry.captureException(error);
      setSaveError(toError(error)); // Dialog bleibt offen, Eingaben bleiben
    } finally {
      setIsSaving(false);
    }
  };
  /**
   * Löscht die Zahlungsangaben nach Bestätigung (= Widerruf der
   * Einwilligung). Schlägt das Löschen fehl, bleiben die Angaben sichtbar —
   * die Zeile existiert ja noch.
   */
  const handleDelete = async () => {
    if (!authUser) return;
    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      destructive: true,
      title: TEXT_PAYMENT_DETAILS_DELETE,
      text: TEXT_PAYMENT_DETAILS_DELETE_HINT,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      await database.userPaymentDetails.deletePaymentDetails(authUser.uid);
      trackEvent(AnalyticsEvent.PAYMENT_DETAILS_DELETED);
      setDetails(null);
      onSuccess(TEXT_PAYMENT_DETAILS_DELETED);
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        Sentry.captureException(error, {
          extra: {context: "Zahlungsangaben löschen"},
        });
      }
      onError(toError(error));
    } finally {
      setIsDeleting(false);
    }
  };
  /* ------------------------------------------
  // Dialog Handling
  // ------------------------------------------ */
  const handleOpenDialog = () => {
    setDialogOpen(true);
  };
  /** Schliesst den Dialog und verwirft einen alten Speicher-Fehler. */
  const onCloseDialog = () => {
    setSaveError(null);
    setDialogOpen(false);
  };
  return (
    <>
      <Card>
        <CardHeader title={TEXT_PAYMENT_DETAILS} />
        <CardContent>
          {isLoading ? (
            <>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                {TEXT_PAYMENT_DETAILS_HINT}
              </Typography>
              {isNameMissing && (
                <AlertMessage
                  severity="warning"
                  body={TEXT_MISSING_NAME_HINT}
                />
              )}
              {details && (
                // data-sentry-block: Adresse und IBAN nicht im Sentry-Replay aufzeichnen
                <Stack spacing={2} sx={{mt: 2}} data-sentry-block>
                  <div>
                    <Typography variant="caption" color="text.secondary">
                      {TEXT_ADDRESS}
                    </Typography>
                    <Typography
                      component="address"
                      sx={classes.paymentDetailsAddress}
                    >
                      {firstName} {lastName}
                      <br />
                      {details.street}
                      <br />
                      {details.postalCode} {details.city}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="caption" color="text.secondary">
                      {TEXT_IBAN}
                    </Typography>
                    <Typography sx={classes.paymentDetailsIban}>
                      {formatIban(details.iban)}
                    </Typography>
                  </div>
                </Stack>
              )}
            </>
          )}
        </CardContent>
        {!isLoading && (
          <CardActions>
            {details && (
              <Button
                color="error"
                disabled={isDeleting}
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                {TEXT_DELETE}
              </Button>
            )}
            {/* Bewusst EIN Button für "hinterlegen" und "anpassen": Nach dem
                ersten Speichern bleibt so dasselbe DOM-Element bestehen, und der
                Dialog gibt den Fokus beim Schliessen an "anpassen" zurück — statt
                an ein entferntes Element (Fokus landete sonst auf "Löschen"). */}
            <Button
              variant={details ? "outlined" : "text"}
              disabled={isDeleting}
              onClick={handleOpenDialog}
            >
              {details ? TEXT_EDIT : TEXT_PAYMENT_DETAILS_ADD}
            </Button>
          </CardActions>
        )}
      </Card>
      {dialogOpen && (
        <UserPaymentDetailsDialog
          open={dialogOpen}
          initialValues={details}
          isSaving={isSaving}
          saveError={saveError}
          onSave={handleSave}
          onClose={onCloseDialog}
        />
      )}
    </>
  );
};
