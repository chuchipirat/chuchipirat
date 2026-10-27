import React from "react";
import * as Sentry from "@sentry/react";

import {AnalyticsEvent} from "../../../Analytics/analyticsEvents";
import {trackEvent} from "../../../Analytics/analyticsService";
import DatabaseService from "../../../Database/DatabaseService";
import AuthUser from "../../../Session/authUser.class";
import {UserPaymentDetails} from "../../../User/userPaymentDetails.class";
import {
  PaymentDetailsFormValues,
  UserPaymentDetailsDomain,
} from "../../../User/userPaymentDetails.types";
import {
  isMissingSessionError,
  isTransientNetworkError,
  toError,
} from "../../../../utils/errorUtils";

/**
 * Eigene Zahlungsangaben für den Abrechnungsdialog (Story 7.4, F2, F6):
 * erst beim Öffnen laden statt auf Vorrat, auf Wunsch ins Profil
 * speichern. Fehler blockieren die Abrechnung nie: Ein Ladefehler ergibt
 * ein leeres Formular, ein Speicherfehler meldet `false`.
 *
 * @param database - Datenbank (Repository `userPaymentDetails`).
 * @param authUser - Angemeldete Person; ohne sie passiert nichts.
 * @returns `ownPaymentDetails` (`undefined` = noch nicht geladen, `null` =
 *   keine hinterlegt), `loadOwnPaymentDetails` und `saveOwnPaymentDetails`.
 * @example
 * const {ownPaymentDetails, loadOwnPaymentDetails, saveOwnPaymentDetails} =
 *   useOwnPaymentDetails(database, authUser);
 */
export const useOwnPaymentDetails = (
  database: DatabaseService,
  authUser: AuthUser | null,
) => {
  const [ownPaymentDetails, setOwnPaymentDetails] = React.useState<
    UserPaymentDetailsDomain | null | undefined
  >(undefined);

  /**
   * Lädt die eigenen Angaben (RLS: nur die eigenen). Bei jedem Öffnen neu,
   * damit eine Änderung im Profil ankommt; bis dahin gilt der alte Wert.
   */
  const loadOwnPaymentDetails = () => {
    if (!authUser) return;
    database.userPaymentDetails
      .getPaymentDetails(authUser.uid)
      .then(setOwnPaymentDetails)
      .catch((error) => {
        // F2: leeres Formular statt Alarm, die Abrechnung geht trotzdem
        setOwnPaymentDetails((previous) => previous ?? null);
        if (!isTransientNetworkError(error) && !isMissingSessionError(error)) {
          // nur die Meldung, wie beim Speichern: `toError` hängt den
          // Rohfehler (mit `details`) als `cause` an
          Sentry.captureException(new Error(toError(error).message), {
            extra: {context: "Abrechnung: Zahlungsangaben laden"},
          });
        }
      });
  };

  /**
   * Speichert die eigenen Angaben ins Profil (F6). Wirft nie: Die
   * Abrechnung soll auch entstehen, wenn das Speichern scheitert.
   *
   * @param details - Vollständige Angaben aus dem Dialog.
   * @returns `true`, wenn gespeichert.
   */
  const saveOwnPaymentDetails = async (
    details: PaymentDetailsFormValues,
  ): Promise<boolean> => {
    if (!authUser) return false;
    const isNewRecord = !ownPaymentDetails;
    try {
      const saved = await database.userPaymentDetails.savePaymentDetails(
        UserPaymentDetails.normalize({...details, userId: authUser.uid}),
        authUser,
      );
      setOwnPaymentDetails(saved);
      // ohne Daten, wie in der Profil-Card
      trackEvent(
        isNewRecord
          ? AnalyticsEvent.PAYMENT_DETAILS_CREATED
          : AnalyticsEvent.PAYMENT_DETAILS_UPDATED,
      );
      return true;
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        // nur die Meldung: ein Supabase-Fehler kann die abgelehnte Zeile
        // (mit IBAN) in `details` tragen
        Sentry.captureException(new Error(toError(error).message), {
          extra: {context: "Abrechnung: Zahlungsangaben speichern"},
        });
      }
      return false;
    }
  };

  return {ownPaymentDetails, loadOwnPaymentDetails, saveOwnPaymentDetails};
};
