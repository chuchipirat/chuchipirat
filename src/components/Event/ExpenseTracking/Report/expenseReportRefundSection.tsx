import React from "react";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormHelperText,
  Stack,
  Typography,
} from "@mui/material";

import {
  REPORT_ACCOUNT_HOLDER as TEXT_REPORT_ACCOUNT_HOLDER,
  REPORT_PAYMENT_DETAILS_LOADING as TEXT_REPORT_PAYMENT_DETAILS_LOADING,
  REPORT_REFUND_ALL_PAYEES_HINT as TEXT_REPORT_REFUND_ALL_PAYEES_HINT,
  REPORT_REFUND_OPTIONAL_HINT as TEXT_REPORT_REFUND_OPTIONAL_HINT,
  REPORT_REFUND_TO as TEXT_REPORT_REFUND_TO,
  REPORT_SAVE_PAYMENT_DETAILS as TEXT_REPORT_SAVE_PAYMENT_DETAILS,
  REPORT_SAVE_PAYMENT_DETAILS_HINT as TEXT_REPORT_SAVE_PAYMENT_DETAILS_HINT,
} from "../../../../constants/text";
import {FormValidationFieldError} from "../../../Shared/fieldValidation.error.class";
import {
  PaymentDetailsFieldName,
  PaymentDetailsForm,
} from "../../../User/paymentDetailsForm";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {RefundSaveOption} from "./useReportRefund";

/**
 * Props für {@link RefundDetailsSection}.
 *
 * @param accountHolderName - Name der Kontoinhaber*in, nur zur Anzeige (F9).
 * @param isAllPayees - «Alle Personen»: Formular gilt nur für die eigene
 *   Person, ein Hinweis sagt das.
 * @param details - Eingaben der gewählten Person.
 * @param isLoading - Eigene Angaben werden noch geladen: Ladehinweis statt
 *   Formular, sonst blitzte ein leeres Formular kurz auf.
 * @param formValidation - Feldfehler vom letzten «Erstellen».
 * @param onFieldChange - Meldet jede Eingabe.
 * @param saveOption - Checkbox «Angaben in meinem Profil speichern».
 */
type RefundDetailsSectionProps = {
  accountHolderName: string;
  isAllPayees: boolean;
  details: PaymentDetailsFormValues;
  isLoading: boolean;
  formValidation: FormValidationFieldError[];
  onFieldChange: (fieldName: PaymentDetailsFieldName, value: string) => void;
  saveOption: RefundSaveOption;
};

/**
 * Abschnitt «Rückerstattung an» im Abrechnungsdialog (Story 7.4, F1):
 * Name der Kontoinhaber*in, Adresse und IBAN. Nichts ist Pflicht; leere
 * Felder erscheinen im PDF als Linien (F4). Bei «Alle Personen» für die
 * eigene Person.
 *
 * @param props - Siehe {@link RefundDetailsSectionProps}.
 * @returns Der Abschnitt.
 * @example
 * <RefundDetailsSection
 *   accountHolderName="Gio Botta"
 *   isAllPayees={false}
 *   details={reportRefund.details}
 *   isLoading={reportRefund.isLoading}
 *   formValidation={reportRefund.formValidation}
 *   onFieldChange={reportRefund.changeField}
 *   saveOption={reportRefund.saveOption}
 * />
 */
export const RefundDetailsSection = ({
  accountHolderName,
  isAllPayees,
  details,
  isLoading,
  formValidation,
  onFieldChange,
  saveOption,
}: RefundDetailsSectionProps) => (
  // data-sentry-block: Name, Adresse und IBAN nie im Sentry-Replay
  <Box data-sentry-block>
    <Typography variant="subtitle1">{TEXT_REPORT_REFUND_TO}</Typography>
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
      }}
    >
      {TEXT_REPORT_ACCOUNT_HOLDER}: {accountHolderName}
    </Typography>
    {isAllPayees ? (
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
        }}
      >
        {TEXT_REPORT_REFUND_ALL_PAYEES_HINT}
      </Typography>
    ) : null}
    {isLoading ? (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          mt: 2,
        }}
      >
        <CircularProgress size={16} />
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
          }}
        >
          {TEXT_REPORT_PAYMENT_DETAILS_LOADING}
        </Typography>
      </Stack>
    ) : (
      <React.Fragment>
        <PaymentDetailsForm
          values={details}
          formValidation={formValidation}
          autoFocus={false}
          onFieldChange={onFieldChange}
        />
        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
          }}
        >
          {TEXT_REPORT_REFUND_OPTIONAL_HINT}
        </Typography>
        {saveOption.isVisible ? <SaveOption saveOption={saveOption} /> : null}
      </React.Fragment>
    )}
  </Box>
);

/**
 * Checkbox «Angaben in meinem Profil speichern» (F5); ausgegraut mit
 * Hinweis, solange die Angaben unvollständig sind.
 *
 * @param props.saveOption - Siehe {@link RefundSaveOption}.
 */
const SaveOption = ({saveOption}: {saveOption: RefundSaveOption}) => (
  <Box sx={{mt: 1}}>
    <FormControlLabel
      control={
        <Checkbox
          checked={saveOption.isChecked}
          disabled={!saveOption.isEnabled}
          onChange={(event) => saveOption.setChecked(event.target.checked)}
        />
      }
      label={TEXT_REPORT_SAVE_PAYMENT_DETAILS}
    />
    {!saveOption.isEnabled ? (
      <FormHelperText>{TEXT_REPORT_SAVE_PAYMENT_DETAILS_HINT}</FormHelperText>
    ) : null}
  </Box>
);
