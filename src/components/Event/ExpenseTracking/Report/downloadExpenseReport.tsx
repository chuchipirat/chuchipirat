import React from "react";

import AuthUser from "../../../Session/authUser.class";
import {generateAndDownloadPdf} from "../../../Shared/pdfUtils";
import {Event} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseReport} from "./expenseReport.class";
import {ReportOptions} from "./expenseReport.types";
import {ExpenseReportPdf} from "./expenseReportPdf";
import {getReportFileName} from "./expenseReportLabels";

/**
 * Eingaben für {@link downloadExpenseReport}.
 *
 * @param expenses - Alle Ausgaben des Anlasses.
 * @param budgets - Alle Budgets des Anlasses, in Anzeigereihenfolge.
 * @param event - Der Anlass (Name, Köch:innen, UID für Sentry).
 * @param authUser - Angemeldete Person (Fusszeile).
 * @param options - Im Dialog gewählte Optionen.
 * @param onError - Wird bei einem Fehler aufgerufen; Sentry ist dann
 *   bereits informiert (`generateAndDownloadPdf`).
 */
export type DownloadExpenseReportParams = {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  event: Event;
  authUser: AuthUser;
  options: ReportOptions;
  onError: (error: Error) => void;
};

/**
 * Erstellt die Abrechnung als PDF und startet den Download. Wirft nicht:
 * Fehler gehen an Sentry und an `onError`.
 *
 * @param params - Siehe {@link DownloadExpenseReportParams}.
 * @returns Promise, das nach dem Download (oder Fehler) erfüllt ist.
 * @example
 * const {downloadExpenseReport} = await import("./Report/downloadExpenseReport");
 * await downloadExpenseReport({expenses, budgets, event, authUser, options, onError});
 */
export const downloadExpenseReport = async ({
  expenses,
  budgets,
  event,
  authUser,
  options,
  onError,
}: DownloadExpenseReportParams): Promise<void> => {
  const report = ExpenseReport.build({
    expenses,
    budgets,
    cooks: event.cooks,
    options,
  });

  await generateAndDownloadPdf(
    <ExpenseReportPdf
      report={report}
      eventName={event.name}
      authUser={authUser}
      generatedAt={new Date()}
    />,
    getReportFileName(event.name, report.payeeDisplayName),
    onError,
    {eventUid: event.uid, mode: options.mode},
  );
};
