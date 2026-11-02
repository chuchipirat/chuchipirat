import React from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import {
  ManualDonationInput,
  ManualPaymentMethod,
} from "../../Donate/donation.types";
import {parseAmountToCents} from "../../Shared/utils/currencyUtils";
import {DatePicker} from "@mui/x-date-pickers";
import dayjs, {Dayjs} from "dayjs";
import {
  CANCEL as TEXT_CANCEL,
  MANUAL_DONATION_AMOUNT as TEXT_MANUAL_DONATION_AMOUNT,
  MANUAL_DONATION_AMOUNT_HINT as TEXT_MANUAL_DONATION_AMOUNT_HINT,
  MANUAL_DONATION_AMOUNT_RANGE as TEXT_MANUAL_DONATION_AMOUNT_RANGE,
  MANUAL_DONATION_PAID_AT_RANGE as TEXT_MANUAL_DONATION_PAID_AT_RANGE,
  MANUAL_DONATION_SEARCH_FIRST as TEXT_MANUAL_DONATION_SEARCH_FIRST,
  MANUAL_DONATION_CREATE as TEXT_MANUAL_DONATION_CREATE,
  MANUAL_DONATION_CREATE_FAILED as TEXT_MANUAL_DONATION_CREATE_FAILED,
  MANUAL_DONATION_DIALOG_HINT as TEXT_MANUAL_DONATION_DIALOG_HINT,
  MANUAL_DONATION_DONOR_EMAIL as TEXT_MANUAL_DONATION_DONOR_EMAIL,
  MANUAL_DONATION_DONOR_NOT_FOUND as TEXT_MANUAL_DONATION_DONOR_NOT_FOUND,
  MANUAL_DONATION_EVENT as TEXT_MANUAL_DONATION_EVENT,
  MANUAL_DONATION_MESSAGE as TEXT_MANUAL_DONATION_MESSAGE,
  MANUAL_DONATION_NO_EVENT as TEXT_MANUAL_DONATION_NO_EVENT,
  MANUAL_DONATION_PAID_AT as TEXT_MANUAL_DONATION_PAID_AT,
  MANUAL_DONATION_PAYMENT_METHOD as TEXT_MANUAL_DONATION_PAYMENT_METHOD,
  MANUAL_DONATION_SEARCH as TEXT_MANUAL_DONATION_SEARCH,
  MANUAL_DONATION_SUBMIT as TEXT_MANUAL_DONATION_SUBMIT,
  MANUAL_PAYMENT_METHOD_LABELS as TEXT_MANUAL_PAYMENT_METHOD_LABELS,
} from "../../../constants/text";

/** Mindestbetrag einer Spende, wie der CHECK auf `donations`. */
const MIN_AMOUNT_IN_CENTS = 500;
/** Höchstbetrag: fängt Tippfehler ab, die sonst zum Spendenziel zählten. */
const MAX_AMOUNT_IN_CENTS = 1_000_000;
/** Längste Nachricht, wie der CHECK auf `donations`. */
const MAX_MESSAGE_LENGTH = 200;
/** Datenbankfehler mit eigener, für Admins verständlicher Meldung. */
const USER_FACING_ERROR_CODES = ["22023", "42501"];

/**
 * Ob das Zahlungsdatum erlaubt ist: nicht in der Zukunft und höchstens ein
 * Jahr zurück, wie in `create_manual_donation`.
 *
 * @param paidAt - Gewähltes Datum, `null` ohne Auswahl.
 * @returns `true`, wenn das Datum im erlaubten Bereich liegt.
 */
const isAllowedPaidAt = (paidAt: Dayjs | null): boolean =>
  !!paidAt &&
  paidAt.isValid() &&
  !paidAt.isAfter(dayjs(), "day") &&
  !paidAt.isBefore(dayjs().subtract(1, "year"), "day");

/**
 * Gefundene Person.
 *
 * @param uid - User-ID.
 * @param displayName - Anzeigename zur Kontrolle.
 */
export type ManualDonationDonor = {uid: string; displayName: string};

/**
 * Anlass zur Auswahl.
 *
 * @param uid - ID des Anlasses.
 * @param name - Name des Anlasses.
 */
export type ManualDonationEvent = {uid: string; name: string};

/**
 * Props für {@link ManualDonationDialog}.
 *
 * @param open - Dialog sichtbar.
 * @param findDonor - Sucht die Person über ihre E-Mail, `null` wenn keine.
 * @param loadDonorEvents - Lädt die Anlässe, in denen die Person kocht.
 * @param createDonation - Speichert die Spende; wirft bei einem Fehler.
 * @param onClose - Schliesst den Dialog.
 * @param onCreated - Nach dem Speichern, z.B. um die Liste neu zu laden.
 */
type ManualDonationDialogProps = {
  open: boolean;
  findDonor: (email: string) => Promise<ManualDonationDonor | null>;
  loadDonorEvents: (donorUid: string) => Promise<ManualDonationEvent[]>;
  createDonation: (input: ManualDonationInput) => Promise<void>;
  onClose: () => void;
  onCreated: () => void;
};

/**
 * Dialog für Admins: erfasst eine Spende von Hand und verknüpft sie mit einer
 * Person und optional mit einem ihrer Anlässe. Für Banküberweisungen oder
 * Testspenden auf TEST. Die Seite gibt ihm einen neuen `key` pro Öffnen,
 * damit er leer startet.
 *
 * @param props - Siehe {@link ManualDonationDialogProps}.
 */
export const ManualDonationDialog = ({
  open,
  findDonor,
  loadDonorEvents,
  createDonation,
  onClose,
  onCreated,
}: ManualDonationDialogProps) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [email, setEmail] = React.useState("");
  // undefined = noch nicht gesucht, null = keine Person gefunden
  const [donor, setDonor] = React.useState<
    ManualDonationDonor | null | undefined
  >(undefined);
  const [events, setEvents] = React.useState<ManualDonationEvent[]>([]);
  const [eventId, setEventId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState<Dayjs | null>(() =>
    dayjs().startOf("day"),
  );
  const [paymentMethod, setPaymentMethod] = React.useState(
    ManualPaymentMethod.bankTransfer,
  );
  const [donorMessage, setDonorMessage] = React.useState("");
  const [isBusy, setIsBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const amountInCents = parseAmountToCents(amount);
  const isAmountValid =
    amountInCents !== null &&
    amountInCents >= MIN_AMOUNT_IN_CENTS &&
    amountInCents <= MAX_AMOUNT_IN_CENTS;
  // Fehler erst zeigen, wenn etwas eingegeben wurde
  const showAmountError = amount.trim() !== "" && !isAmountValid;
  const isPaidAtValid = isAllowedPaidAt(paidAt);
  const canSubmit = !!donor && isAmountValid && isPaidAtValid;

  /** Sucht die Person und lädt ihre Anlässe. */
  const handleSearch = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    setEventId("");
    try {
      const foundDonor = await findDonor(email.trim());
      setDonor(foundDonor);
      setEvents(foundDonor ? await loadDonorEvents(foundDonor.uid) : []);
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  /** Speichert die Spende; ein Fehler bleibt im Dialog sichtbar. */
  const handleSubmit = async () => {
    if (!canSubmit || !donor) return;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await createDonation({
        donorUid: donor.uid,
        eventId: eventId || null,
        amountInCents,
        paidAt: (paidAt as Dayjs).toDate(),
        paymentMethod,
        donorMessage,
      });
      onCreated();
    } catch (error) {
      setErrorMessage(toMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isBusy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle>{TEXT_MANUAL_DONATION_CREATE}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{paddingTop: 1}}>
          <Typography variant="body2" color="text.secondary">
            {TEXT_MANUAL_DONATION_DIALOG_HINT}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              label={TEXT_MANUAL_DONATION_DONOR_EMAIL}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              fullWidth
              size="small"
              helperText={
                donor === undefined
                  ? TEXT_MANUAL_DONATION_SEARCH_FIRST
                  : undefined
              }
            />
            <Button
              variant="outlined"
              onClick={handleSearch}
              disabled={!email.trim() || isBusy}
            >
              {TEXT_MANUAL_DONATION_SEARCH}
            </Button>
          </Stack>
          {donor === null && (
            <Typography variant="body2" color="error">
              {TEXT_MANUAL_DONATION_DONOR_NOT_FOUND}
            </Typography>
          )}
          {donor && (
            <Typography variant="body2">{donor.displayName}</Typography>
          )}
          <TextField
            select
            label={TEXT_MANUAL_DONATION_EVENT}
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            disabled={!donor}
            size="small"
          >
            <MenuItem value="">{TEXT_MANUAL_DONATION_NO_EVENT}</MenuItem>
            {events.map((event) => (
              <MenuItem key={event.uid} value={event.uid}>
                {event.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={TEXT_MANUAL_DONATION_AMOUNT}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            size="small"
            error={showAmountError}
            helperText={
              showAmountError
                ? TEXT_MANUAL_DONATION_AMOUNT_RANGE
                : TEXT_MANUAL_DONATION_AMOUNT_HINT
            }
          />
          <DatePicker
            label={TEXT_MANUAL_DONATION_PAID_AT}
            format="DD.MM.YYYY"
            value={paidAt}
            onChange={setPaidAt}
            disableFuture
            minDate={dayjs().subtract(1, "year")}
            slotProps={{
              textField: {
                size: "small",
                error: !isPaidAtValid,
                helperText: isPaidAtValid
                  ? undefined
                  : TEXT_MANUAL_DONATION_PAID_AT_RANGE,
              },
            }}
          />
          <TextField
            select
            label={TEXT_MANUAL_DONATION_PAYMENT_METHOD}
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as ManualPaymentMethod)
            }
            size="small"
          >
            {Object.values(ManualPaymentMethod).map((method) => (
              <MenuItem key={method} value={method}>
                {TEXT_MANUAL_PAYMENT_METHOD_LABELS[method]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={TEXT_MANUAL_DONATION_MESSAGE}
            value={donorMessage}
            onChange={(event) => setDonorMessage(event.target.value)}
            multiline
            minRows={2}
            size="small"
            slotProps={{htmlInput: {maxLength: MAX_MESSAGE_LENGTH}}}
          />
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isBusy}>
          {TEXT_CANCEL}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || isBusy}
        >
          {TEXT_MANUAL_DONATION_SUBMIT}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Meldung für den Dialog. Prüfungen von `create_manual_donation` liefern
 * deutsche Texte, z.B. «Die Person kocht nicht in diesem Anlass.». Alle
 * anderen Fehler zeigen nur einen allgemeinen Text, ohne Datenbankdetails.
 *
 * @param error - Gefangener Fehler.
 * @returns Text der Meldung.
 */
const toMessage = (error: unknown): string =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  USER_FACING_ERROR_CODES.includes(String(error.code)) &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : TEXT_MANUAL_DONATION_CREATE_FAILED;
