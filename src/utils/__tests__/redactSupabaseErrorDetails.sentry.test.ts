import * as Sentry from "@sentry/react";
import type {ErrorEvent} from "@sentry/react";

import {redactSupabaseErrorDetails} from "../errorUtils";

/**
 * Prüft den ganzen Weg mit dem echten Sentry-SDK (ohne Mock): Ein als
 * einfaches Objekt geworfener PostgREST-Fehler darf mit eingehängtem
 * `beforeSend` keine Zeileninhalte mehr enthalten. Abgefangen wird das Event
 * im `beforeSend` selbst, es wird nie verschickt.
 */
describe("redactSupabaseErrorDetails mit dem echten Sentry-SDK", () => {
  const sentEvents: ErrorEvent[] = [];

  beforeAll(() => {
    Sentry.init({
      dsn: "https://public@example.invalid/1",
      defaultIntegrations: false,
      beforeSend: (event) => {
        sentEvents.push(redactSupabaseErrorDetails(event));
        return null; // nie verschicken
      },
    });
  });

  afterAll(() => Sentry.close());

  test("ein CHECK-Fehler mit IBAN in details kommt ohne Zeileninhalt an", async () => {
    // Form wie von @supabase/postgrest-js geliefert (einfaches Objekt, kein Error)
    const postgrestError = {
      code: "23514",
      message:
        'new row for relation "user_payment_details" violates check constraint "user_payment_details_iban_check"',
      details:
        "Failing row contains (uid, Teststrasse 1, 8000, Zürich, CH9300762011623852957).",
      hint: null,
    };

    Sentry.captureException(postgrestError);
    await Sentry.flush(1000);

    expect(sentEvents).toHaveLength(1);
    const serializedEvent = JSON.stringify(sentEvents[0]);
    expect(serializedEvent).not.toContain("CH9300762011623852957");
    expect(serializedEvent).not.toContain("Teststrasse");
    expect(sentEvents[0].extra?.__serialized__).toMatchObject({
      code: "23514",
      details: "[entfernt]",
    });
  });
});
