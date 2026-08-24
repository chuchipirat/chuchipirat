import {personalize} from "../personalize";

const VARIABLES = {
  firstName: "Gio",
  lastName: "Cettuzzi",
  displayName: "Gio C.",
  unsubscribeLink: "https://api.chuchipirat.ch/functions/v1/unsubscribe-newsletter?uid=abc-123",
};

describe("personalize", () => {
  test("ersetzt {{firstName}}, {{lastName}} und {{displayName}}", () => {
    expect(
      personalize(
        "Hallo {{firstName}} {{lastName}} ({{displayName}}),",
        VARIABLES,
      ),
    ).toBe("Hallo Gio Cettuzzi (Gio C.),");
  });

  test("ersetzt {{unsubscribeLink}} mit dem personalisierten Abmelde-Link", () => {
    expect(
      personalize('<a href="{{unsubscribeLink}}">Abmelden</a>', VARIABLES),
    ).toBe(
      '<a href="https://api.chuchipirat.ch/functions/v1/unsubscribe-newsletter?uid=abc-123">Abmelden</a>',
    );
  });

  test("ersetzt mehrfach vorkommende Tokens", () => {
    expect(
      personalize("{{displayName}}, willkommen {{displayName}}!", VARIABLES),
    ).toBe("Gio C., willkommen Gio C.!");
  });

  test("lässt Text ohne Tokens unverändert", () => {
    const text = "<p>Ganz normaler Text ohne Platzhalter.</p>";
    expect(personalize(text, VARIABLES)).toBe(text);
  });

  test("ersetzt Tokens mit fehlenden Werten durch leeren String", () => {
    expect(
      personalize("Hallo {{displayName}},", {
        firstName: "",
        lastName: "",
        displayName: "",
        unsubscribeLink: "",
      }),
    ).toBe("Hallo ,");
  });

  test("toleriert Whitespace innerhalb der Token-Klammern", () => {
    expect(personalize("Hallo {{ displayName }},", VARIABLES)).toBe("Hallo Gio C.,");
  });

  test("lässt unbekannte {{...}}-Platzhalter unverändert", () => {
    expect(personalize("{{unknownToken}} bleibt stehen", VARIABLES)).toBe(
      "{{unknownToken}} bleibt stehen",
    );
  });

  test("escaped HTML-Sonderzeichen in den eingesetzten Werten (XSS-Schutz)", () => {
    expect(
      personalize("Hallo {{displayName}},", {
        firstName: "",
        lastName: "",
        displayName: '<script>alert("x")</script>',
        unsubscribeLink: "",
      }),
    ).toBe("Hallo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;,");
  });
});
