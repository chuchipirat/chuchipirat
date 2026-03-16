/**
 * RequestService — Verarbeitet Post-Actions nach Statusübergängen.
 *
 * Enthält die Logik, die nach einem Statuswechsel ausgeführt werden muss:
 * - Rezept veröffentlichen (recipe_type = 'public', is_in_review = false)
 * - Rezept-Prüfung zurücksetzen (is_in_review = false)
 * - E-Mail-Benachrichtigungen via Edge Function
 *
 * @example
 * await RequestService.executePostAction(request, 'done', database);
 */
import * as Sentry from "@sentry/browser";
import {RequestDomain} from "../Database/Repository/RequestRepository";
import {RequestStatus, RequestType} from "./request.class";
import DatabaseService from "../Database/DatabaseService";
import {supabase} from "../Database/supabaseClient";

/**
 * Service für Post-Actions nach Statusübergängen von Anträgen.
 */
export class RequestService {
  /**
   * Führt die notwendigen Aktionen nach einem Statuswechsel aus.
   *
   * Je nach Antragstyp und neuem Status werden verschiedene Aktionen
   * ausgelöst (Rezeptveröffentlichung, E-Mail-Benachrichtigungen).
   *
   * @param request - Der aktualisierte Antrag
   * @param newStatus - Der neue Status nach dem Übergang
   * @param database - DatabaseService für Datenbankzugriff
   */
  static async executePostAction(
    request: RequestDomain,
    newStatus: string,
    database: DatabaseService,
  ): Promise<void> {
    try {
      switch (request.requestType) {
        case RequestType.recipePublish:
          await RequestService.handlePublishRecipeTransition(
            request,
            newStatus,
            database,
          );
          break;
        case RequestType.reportError:
          await RequestService.handleReportErrorTransition(
            request,
            newStatus,
          );
          break;
      }
    } catch (error) {
      // Post-Actions dürfen den Hauptfluss nicht blockieren
      console.error("RequestService.executePostAction Fehler:", error);
      Sentry.captureException(error);
    }
  }

  /**
   * Verarbeitet Statusübergänge für Rezept-Veröffentlichungsanträge.
   *
   * @param request - Der Antrag
   * @param newStatus - Neuer Status
   * @param database - DatabaseService
   */
  private static async handlePublishRecipeTransition(
    request: RequestDomain,
    newStatus: string,
    database: DatabaseService,
  ): Promise<void> {
    switch (newStatus) {
      case RequestStatus.done:
        // Rezept veröffentlichen: recipe_type → 'public', is_in_review → false
        await database.recipes.patch({
          id: request.recipeUid,
          fields: {recipe_type: "public", is_in_review: false},
          authUser: {} as any, // Audit-Felder werden vom Trigger gesetzt
        });

        // E-Mail an Autor*in: «Dein Rezept wurde veröffentlicht»
        RequestService.triggerNotification(
          "requestRecipePublished",
          request.uid,
        );

        // TODO: Feed-Eintrag erstellen (wird in Feed-Migration ergänzt)
        break;

      case RequestStatus.inReview:
        // Autor*in hat den Antrag erneut eingereicht → Assignee benachrichtigen
        RequestService.triggerNotification(
          "requestBackToReview",
          request.uid,
        );
        break;

      case RequestStatus.declined:
        // Prüfungs-Flag zurücksetzen
        await database.recipes.patch({
          id: request.recipeUid,
          fields: {is_in_review: false},
          authUser: {} as any,
        });
        // E-Mail an Autor*in mit Begründung (letzter Kommentar)
        RequestService.triggerNotification("requestDeclined", request.uid);
        break;
    }
  }

  /**
   * Verarbeitet Statusübergänge für Fehlermeldungen.
   *
   * @param request - Der Antrag
   * @param newStatus - Neuer Status
   */
  private static async handleReportErrorTransition(
    request: RequestDomain,
    newStatus: string,
  ): Promise<void> {
    switch (newStatus) {
      case RequestStatus.done:
        // E-Mail an Autor*in: «Die Fehlermeldung wurde bearbeitet»
        RequestService.triggerNotification(
          "requestReportErrorFixed",
          request.uid,
        );
        break;

      case RequestStatus.inReview:
        // Autor*in hat den Antrag erneut eingereicht → Assignee benachrichtigen
        RequestService.triggerNotification(
          "requestBackToReview",
          request.uid,
        );
        break;

      case RequestStatus.declined:
        // E-Mail an Autor*in mit Begründung (letzter Kommentar)
        RequestService.triggerNotification("requestDeclined", request.uid);
        break;
    }
  }

  /**
   * Löst eine E-Mail-Benachrichtigung via Edge Function aus (fire-and-forget).
   *
   * @param scenario - Das Benachrichtigungs-Szenario
   * @param requestId - Die Antrags-ID
   * @param commentId - Optionale Kommentar-ID (für Kommentar-Benachrichtigungen)
   */
  static triggerNotification(
    scenario: string,
    requestId: string,
    commentId?: string,
  ): void {
    supabase.functions
      .invoke("notify-request", {
        body: {scenario, requestId, commentId},
      })
      .catch((err: unknown) => {
        console.error(
          `notify-request (${scenario}) konnte nicht aufgerufen werden:`,
          err,
        );
        Sentry.captureException(err);
      });
  }

  /**
   * Löst die Benachrichtigung für einen neuen Antrag aus.
   * Sendet E-Mails an alle Community Leaders.
   *
   * @param requestType - Typ des Antrags
   * @param requestId - Die Antrags-ID
   */
  static triggerNewRequestNotification(
    requestType: string,
    requestId: string,
  ): void {
    const scenario =
      requestType === RequestType.recipePublish
        ? "newRecipePublishRequest"
        : "newReportErrorRequest";
    RequestService.triggerNotification(scenario, requestId);
  }
}
