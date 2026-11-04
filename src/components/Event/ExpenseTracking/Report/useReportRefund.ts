import React from "react";

import {FormValidationFieldError} from "../../../Shared/fieldValidation.error.class";
import {PaymentDetailsFieldName} from "../../../User/paymentDetailsForm";
import {UserPaymentDetails} from "../../../User/userPaymentDetails.class";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {ReportPayeeSelection, ReportRefund} from "./expenseReport.types";

/** Leere Zahlungsangaben: Startwert für andere Personen (im PDF Linien). */
export const EMPTY_PAYMENT_DETAILS: PaymentDetailsFormValues = {
  street: "",
  postalCode: "",
  city: "",
  iban: "",
};

/**
 * Nur die vier Formularfelder, ohne `userId` oder weitere Felder aus dem
 * Profil. So reist nichts Unnötiges mit ins PDF.
 *
 * @param paymentDetails - Zahlungsangaben, z.B. aus dem Profil.
 * @returns Neues Objekt mit Strasse, PLZ, Ort und IBAN.
 */
export const toPaymentDetailsFormValues = ({
  street,
  postalCode,
  city,
  iban,
}: PaymentDetailsFormValues): PaymentDetailsFormValues => ({
  street,
  postalCode,
  city,
  iban,
});

/**
 * Vergleicht zwei Zahlungsangaben nach dem Normalisieren: «ch93 0076 …»
 * und «CH930076…» gelten als gleich, ebenso Leerzeichen am Rand.
 *
 * @param first - Erste Angaben.
 * @param second - Zweite Angaben.
 * @returns `true`, wenn alle vier Felder gleich sind.
 */
export const isSamePaymentDetails = (
  first: PaymentDetailsFormValues,
  second: PaymentDetailsFormValues,
): boolean => {
  const normalizedFirst = UserPaymentDetails.normalize(first);
  const normalizedSecond = UserPaymentDetails.normalize(second);
  return (
    Object.keys(EMPTY_PAYMENT_DETAILS) as PaymentDetailsFieldName[]
  ).every(
    (fieldName) => normalizedFirst[fieldName] === normalizedSecond[fieldName],
  );
};

/**
 * Fehler am IBAN-Feld, aber nur für eine eingetippte IBAN (F4): Leer ist
 * erlaubt (Linie im PDF), falsch nicht.
 *
 * @param details - Eingaben im Dialog.
 * @returns Der IBAN-Fehler oder eine leere Liste.
 */
export const getIbanErrors = (
  details: PaymentDetailsFormValues,
): FormValidationFieldError[] =>
  details.iban.trim() === ""
    ? []
    : UserPaymentDetails.validatePaymentDetails(details).filter(
        (fieldError) => fieldError.fieldName === "iban",
      );

/**
 * Eingaben von {@link useReportRefund}.
 *
 * @param payeeSelection - Gewählte Person oder «Alle Personen».
 * @param authUserId - UID der angemeldeten Person.
 * @param ownPaymentDetails - Eigene Angaben aus dem Profil; `undefined` =
 *   werden noch geladen, `null` = keine hinterlegt.
 * @param hasOwnExpenses - Die angemeldete Person hat eigene Ausgaben, also
 *   bei «Alle Personen» eine eigene Section im PDF.
 */
type UseReportRefundParams = {
  payeeSelection: ReportPayeeSelection;
  authUserId: string;
  ownPaymentDetails: PaymentDetailsFormValues | null | undefined;
  hasOwnExpenses: boolean;
};

/**
 * Checkbox «Angaben in meinem Profil speichern» (F5).
 *
 * @param isVisible - Nur für die eigene Abrechnung und nur, wenn die
 *   Angaben vom Profil abweichen.
 * @param isEnabled - Nur bei vollständigen Angaben (die DB nimmt nur
 *   Vollständiges an).
 * @param isChecked - Angehakt und vollständig.
 * @param setChecked - Hakt an oder ab.
 */
export type RefundSaveOption = {
  isVisible: boolean;
  isEnabled: boolean;
  isChecked: boolean;
  setChecked: (isChecked: boolean) => void;
};

/**
 * Zustand des Abschnitts «Rückerstattung an» im Abrechnungsdialog
 * (Story 7.4). Das Formular gehört der gewählten Person; bei «Alle
 * Personen» der angemeldeten Person (die anderen bekommen im PDF Linien),
 * sofern sie eigene Ausgaben hat. Merkt sich die Eingaben pro Person,
 * solange der Dialog offen ist (F3): Startwert ist das Profil (eigene
 * Person) bzw. leer; alles Weitere ist abgeleitet, ohne `useEffect`.
 *
 * @param params - Siehe {@link UseReportRefundParams}.
 * @returns `details` (Formularwerte, `null` ohne Formular), `isOwnPayee`,
 *   `isLoading`, `formValidation`, `changeField`, `saveOption`, `refund`
 *   (für `onCreate`) und `validate` (setzt den IBAN-Fehler).
 * @example
 * const reportRefund = useReportRefund({
 *   payeeSelection,
 *   authUserId,
 *   ownPaymentDetails,
 *   hasOwnExpenses,
 * });
 * if (reportRefund.validate()) onCreate(options, reportRefund.refund, setProgress);
 */
export const useReportRefund = ({
  payeeSelection,
  authUserId,
  ownPaymentDetails,
  hasOwnExpenses,
}: UseReportRefundParams) => {
  const [refundDetailsByPayee, setRefundDetailsByPayee] = React.useState<
    Record<string, PaymentDetailsFormValues>
  >({});
  const [shouldSaveOwnDetails, setShouldSaveOwnDetails] = React.useState(false);
  const [formValidation, setFormValidation] = React.useState<
    FormValidationFieldError[]
  >([]);

  const payeeKey = getFormPayeeKey(payeeSelection, authUserId, hasOwnExpenses);
  // Köch*innen haben ihre UID als Schlüssel, neue Personen ihren Namen;
  // ein Name ist praktisch nie gleich einer UUID
  const isOwnPayee = payeeKey === authUserId;
  /** Startwert einer Person, solange nichts eingetippt ist. */
  const getStartDetails = (key: string): PaymentDetailsFormValues =>
    key === authUserId && ownPaymentDetails
      ? toPaymentDetailsFormValues(ownPaymentDetails)
      : EMPTY_PAYMENT_DETAILS;
  const details =
    payeeKey === null
      ? null
      : (refundDetailsByPayee[payeeKey] ?? getStartDetails(payeeKey));

  /** Übernimmt eine Eingabe für die Person des Formulars. */
  const changeField = (fieldName: PaymentDetailsFieldName, value: string) => {
    if (payeeKey === null) return;
    setRefundDetailsByPayee((previous) => ({
      ...previous,
      [payeeKey]: {
        ...(previous[payeeKey] ?? getStartDetails(payeeKey)),
        [fieldName]: value,
      },
    }));
    setFormValidation([]);
  };

  const saveOption = getSaveOption({
    details,
    isOwnPayee,
    ownPaymentDetails,
    shouldSaveOwnDetails,
    setShouldSaveOwnDetails,
  });

  /** Setzt den IBAN-Fehler; `false`, wenn nicht erstellt werden darf. */
  const validate = (): boolean => {
    const ibanErrors = details === null ? [] : getIbanErrors(details);
    setFormValidation(ibanErrors);
    return ibanErrors.length === 0;
  };

  return {
    details,
    isOwnPayee,
    isLoading: isOwnPayee && ownPaymentDetails === undefined,
    formValidation,
    changeField,
    saveOption,
    refund: toReportRefund(details, saveOption.isChecked),
    validate,
  };
};

/**
 * Person, der das Formular gehört: die gewählte; bei «Alle Personen» die
 * angemeldete, falls sie eigene Ausgaben hat, sonst niemand.
 *
 * @param payeeSelection - Auswahl im Dialog.
 * @param authUserId - UID der angemeldeten Person.
 * @param hasOwnExpenses - Die angemeldete Person hat eigene Ausgaben.
 * @returns `payeeKey` der Person oder `null` (kein Formular).
 */
const getFormPayeeKey = (
  payeeSelection: ReportPayeeSelection,
  authUserId: string,
  hasOwnExpenses: boolean,
): string | null => {
  if (payeeSelection.kind === "single") {
    return payeeSelection.payeeKey;
  }
  return hasOwnExpenses ? authUserId : null;
};

/**
 * Eingaben von {@link getSaveOption}.
 *
 * @param details - Aktuelle Eingaben (`null` ohne Formular).
 * @param isOwnPayee - Eigene Abrechnung.
 * @param ownPaymentDetails - Angaben aus dem Profil (siehe Hook).
 * @param shouldSaveOwnDetails - Zustand der Checkbox.
 * @param setShouldSaveOwnDetails - Setzt den Zustand der Checkbox.
 */
type GetSaveOptionParams = {
  details: PaymentDetailsFormValues | null;
  isOwnPayee: boolean;
  ownPaymentDetails: PaymentDetailsFormValues | null | undefined;
  shouldSaveOwnDetails: boolean;
  setShouldSaveOwnDetails: (isChecked: boolean) => void;
};

/**
 * Leitet die Checkbox «Angaben in meinem Profil speichern» ab (F5). Für
 * andere Personen nie sichtbar: fremde Bankdaten speichern wir nicht.
 *
 * @param params - Siehe {@link GetSaveOptionParams}.
 * @returns Siehe {@link RefundSaveOption}.
 */
const getSaveOption = ({
  details,
  isOwnPayee,
  ownPaymentDetails,
  shouldSaveOwnDetails,
  setShouldSaveOwnDetails,
}: GetSaveOptionParams): RefundSaveOption => {
  const isUnchanged =
    details !== null &&
    ownPaymentDetails !== null &&
    ownPaymentDetails !== undefined &&
    isSamePaymentDetails(details, ownPaymentDetails);
  const isVisible =
    isOwnPayee &&
    details !== null &&
    ownPaymentDetails !== undefined &&
    !isUnchanged;
  const isEnabled =
    isVisible &&
    UserPaymentDetails.validatePaymentDetails(details).length === 0;
  return {
    isVisible,
    isEnabled,
    // wird eine angehakte Angabe wieder unvollständig, gilt sie als nicht angehakt
    isChecked: isEnabled && shouldSaveOwnDetails,
    setChecked: setShouldSaveOwnDetails,
  };
};

/**
 * Angaben für `onCreate`: getrimmt und mit normalisierter IBAN, damit PDF
 * und Profil dieselben sauberen Werte bekommen.
 *
 * @param details - Eingaben im Formular; `null` ohne Formular.
 * @param shouldSave - Vor dem Erstellen ins Profil speichern.
 * @returns Die Angaben oder `null`.
 */
const toReportRefund = (
  details: PaymentDetailsFormValues | null,
  shouldSave: boolean,
): ReportRefund | null =>
  details === null
    ? null
    : {details: UserPaymentDetails.normalize(details), shouldSave};
