import React from "react";

import {TextField, Box} from "@mui/material";

import {useCustomStyles} from "../../constants/styles";
import {UserPaymentDetailsDomain} from "./userPaymentDetails.types";
import {isValidIban, formatIban, normalizeIban} from "../../utils/ibanUtils";
import {
  STREET as TEXT_STREET,
  POSTAL_CODE as TEXT_POSTAL_CODE,
  CITY as TEXT_CITY,
  IBAN as TEXT_IBAN,
  IBAN_VALID as TEXT_IBAN_VALID,
  IBAN_INVALID as TEXT_IBAN_INVALID,
  IBAN_HINT as TEXT_IBAN_HINT,
} from "../../constants/text";
import {
  FormValidationFieldError,
  FormValidatorUtil,
} from "../Shared/fieldValidation.error.class";

/**
 * Namen der Formularfelder — entsprechen den `fieldName`-Werten aus
 * `UserPaymentDetails.validatePaymentDetails()`.
 */
export type PaymentDetailsFieldName = "street" | "postalCode" | "city" | "iban";

/**
 * Props des {@link PaymentDetailsForm}.
 *
 * @property values - Aktuelle Eingaben (nie `null` — der Aufrufer liefert leere Werte).
 * @property formValidation - Feldfehler vom letzten Speichern-Versuch; leer = keine Fehler.
 * @property onFieldChange - Meldet jede Änderung eines Feldes (auch die Formatierung beim Verlassen des IBAN-Feldes).
 */
interface PaymentDetailsFormProps {
  values: UserPaymentDetailsDomain;
  formValidation: FormValidationFieldError[];
  onFieldChange: (fieldName: PaymentDetailsFieldName, value: string) => void;
}

/**
 * Live-Status des IBAN-Feldes — wird beim Verlassen des Feldes gesetzt und
 * beim erneuten Tippen auf "unchecked" zurückgesetzt.
 */
type IbanStatus = "unchecked" | "valid" | "invalid";

/** Hilfetext unter dem IBAN-Feld je Live-Status. */
const IBAN_HELPER_TEXT: Record<IbanStatus, string> = {
  unchecked: TEXT_IBAN_HINT,
  valid: TEXT_IBAN_VALID,
  invalid: TEXT_IBAN_INVALID,
};

/**
 * Formular für Zahlungsangaben (Strasse, PLZ, Ort, IBAN).
 *
 * Bewusst "dumm": hält keine Eingaben selbst und weiss nichts vom Speichern —
 * Werte und Feldfehler kommen vom Aufrufer, Änderungen gehen per
 * `onFieldChange` zurück. Einziger eigener Zustand ist der Live-Status des
 * IBAN-Feldes (Prüfung beim Verlassen). Wird im Profil
 * (`UserPaymentDetailsDialog`) und später in der Abrechnung (Epic 7.3,
 * auch für Personen ohne Konto) verwendet.
 *
 * @param props - Siehe {@link PaymentDetailsFormProps}.
 * @example
 * <PaymentDetailsForm values={values} formValidation={[]} onFieldChange={handleFieldChange} />
 */
export const PaymentDetailsForm: React.FC<PaymentDetailsFormProps> = ({
  values,
  formValidation,
  onFieldChange,
}) => {
  const classes = useCustomStyles();
  const [ibanStatus, setIbanStatus] = React.useState<IbanStatus>("unchecked");
  /* ------------------------------------------
  // Form Fields 
  // ------------------------------------------ */
  /**
   * Formatiert die IBAN beim Verlassen des Feldes in Viererblöcke und prüft
   * sie sofort — so fällt ein Tippfehler auf, bevor gespeichert wird. Beim
   * Tippen selbst wird nicht formatiert (Cursor-Sprünge auf Mobile).
   */
  const handleIbanBlur = () => {
    if (!values.iban.trim()) return;
    const normalized = normalizeIban(values.iban);
    onFieldChange("iban", formatIban(normalized)); // immer formatieren, auch wenn ungültig
    setIbanStatus(isValidIban(normalized) ? "valid" : "invalid");
  };

  // Vorrang beim IBAN-Hilfetext: Fehler vom Speichern > Live-Hinweis > nichts
  const ibanSaveError = FormValidatorUtil.getHelperText(
    formValidation,
    "iban",
    "",
  );
  const ibanHelperText = ibanSaveError || IBAN_HELPER_TEXT[ibanStatus];
  const ibanHasError = Boolean(ibanSaveError) || ibanStatus === "invalid";
  return (
    // data-sentry-block: Adresse und IBAN erscheinen im Sentry-Replay nur als graue Fläche
    <Box data-sentry-block>
      <TextField
        autoFocus
        fullWidth
        label={TEXT_STREET}
        value={values.street}
        onChange={(event) => onFieldChange("street", event.target.value)}
        error={FormValidatorUtil.isFieldErroneous(formValidation, "street")}
        helperText={FormValidatorUtil.getHelperText(
          formValidation,
          "street",
          "",
        )}
        sx={classes.formControl}
        margin="normal"
        slotProps={{htmlInput: {autoComplete: "street-address"}}}
      />
      <Box sx={classes.paymentDetailsPostalCodeRow}>
        <TextField
          label={TEXT_POSTAL_CODE}
          value={values.postalCode}
          onChange={(event) => onFieldChange("postalCode", event.target.value)}
          error={FormValidatorUtil.isFieldErroneous(
            formValidation,
            "postalCode",
          )}
          helperText={FormValidatorUtil.getHelperText(
            formValidation,
            "postalCode",
            "",
          )}
          sx={classes.formControl}
          margin="normal"
          slotProps={{
            htmlInput: {
              autoComplete: "postal-code",
            },
          }}
        />
        <TextField
          fullWidth
          label={TEXT_CITY}
          value={values.city}
          onChange={(event) => onFieldChange("city", event.target.value)}
          error={FormValidatorUtil.isFieldErroneous(formValidation, "city")}
          helperText={FormValidatorUtil.getHelperText(
            formValidation,
            "city",
            "",
          )}
          sx={classes.formControl}
          margin="normal"
          slotProps={{htmlInput: {autoComplete: "address-level2"}}}
        />
      </Box>
      <TextField
        fullWidth
        label={TEXT_IBAN}
        value={values.iban}
        onChange={(event) => {
          setIbanStatus("unchecked"); // beim Korrigieren nicht rot bleiben
          onFieldChange("iban", event.target.value);
        }}
        onBlur={handleIbanBlur}
        error={ibanHasError}
        helperText={ibanHelperText}
        sx={classes.formControl}
        margin="normal"
        autoComplete="off"
        slotProps={{
          htmlInput: {autoCapitalize: "characters", spellCheck: false},
          formHelperText: {
            sx:
              ibanStatus === "valid" && !ibanSaveError
                ? {color: "success.main"}
                : undefined,
          },
        }}
      />
    </Box>
  );
};
