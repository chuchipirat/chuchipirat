/**
 * Unit-Tests für die Hilfsfunktionen der Mail-Konsole.
 */
import type {MailObject} from "../mailConsole";
import {
  buildSendMailBody,
  getMailFormErrors,
  normalizeIncludeUnsubscribe,
} from "../mailConsoleUtils";

const createMailObject = (overrides: Partial<MailObject> = {}): MailObject => ({
  subject: "Betreff",
  mailtext: "<p>Text</p>",
  title: "",
  subtitle: "",
  preheader: "",
  buttonText: "",
  buttonLink: "",
  ...overrides,
});

describe("getMailFormErrors", () => {
  test("Titel ist kein Pflichtfeld mehr", () => {
    expect(getMailFormErrors(createMailObject({title: ""}))).toEqual({
      subject: false,
      mailtext: false,
    });
  });

  test("Betreff bleibt Pflicht", () => {
    expect(getMailFormErrors(createMailObject({subject: ""}))).toEqual({
      subject: true,
      mailtext: false,
    });
  });

  test("Mailtext bleibt Pflicht", () => {
    expect(getMailFormErrors(createMailObject({mailtext: ""}))).toEqual({
      subject: false,
      mailtext: true,
    });
  });

  test("das Ergebnis hat keinen Schlüssel für den Titel", () => {
    expect(Object.keys(getMailFormErrors(createMailObject()))).not.toContain(
      "title",
    );
  });
});

describe("normalizeIncludeUnsubscribe", () => {
  test("Rolle: Footer wird immer erzwungen", () => {
    expect(normalizeIncludeUnsubscribe("role", false)).toBe(true);
    expect(normalizeIncludeUnsubscribe("role", true)).toBe(true);
  });

  test.each(["uid", "email", "none"])(
    "%s: Einstellung bleibt wie gewählt",
    (recipientType) => {
      expect(normalizeIncludeUnsubscribe(recipientType, false)).toBe(false);
      expect(normalizeIncludeUnsubscribe(recipientType, true)).toBe(true);
    },
  );
});

describe("buildSendMailBody", () => {
  const baseParams = {
    recipients: ["a@b.ch"],
    recipientType: "email",
    mailObject: createMailObject({title: "Titel"}),
    includeUnsubscribe: true,
    transport: "auto" as const,
  };

  test("übernimmt die Mail-Inhalte", () => {
    expect(buildSendMailBody(baseParams)).toMatchObject({
      recipients: ["a@b.ch"],
      recipientType: "email",
      subject: "Betreff",
      body: "<p>Text</p>",
      title: "Titel",
    });
  });

  test("sendet includeUnsubscribe=false bei Direktnachrichten", () => {
    expect(
      buildSendMailBody({...baseParams, includeUnsubscribe: false}),
    ).toHaveProperty("includeUnsubscribe", false);
  });

  test("erzwingt includeUnsubscribe=true bei einer Rolle", () => {
    expect(
      buildSendMailBody({
        ...baseParams,
        recipientType: "role",
        includeUnsubscribe: false,
      }),
    ).toHaveProperty("includeUnsubscribe", true);
  });

  test("sendet einen leeren Titel unverändert mit (Server lässt die Überschrift weg)", () => {
    expect(
      buildSendMailBody({
        ...baseParams,
        mailObject: createMailObject({title: ""}),
      }),
    ).toHaveProperty("title", "");
  });

  test("Vorschautext und Transport nur bei Bedarf", () => {
    const withoutOptions = buildSendMailBody(baseParams);
    expect(withoutOptions).not.toHaveProperty("preheaderText");
    expect(withoutOptions).not.toHaveProperty("forceTransport");

    const withOptions = buildSendMailBody({
      ...baseParams,
      mailObject: createMailObject({preheader: "Vorschau"}),
      transport: "smtp",
    });
    expect(withOptions).toHaveProperty("preheaderText", "Vorschau");
    expect(withOptions).toHaveProperty("forceTransport", "smtp");
  });
});
