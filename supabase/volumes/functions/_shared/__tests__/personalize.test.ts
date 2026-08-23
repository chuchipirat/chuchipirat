import {personalize} from "../personalize";

const VARIABLES = {firstName: "Gio", lastName: "Cettuzzi", displayName: "Gio C."};

describe("personalize", () => {
  test("ersetzt {{firstName}}, {{lastName}} und {{displayName}}", () => {
    expect(
      personalize(
        "Hallo {{firstName}} {{lastName}} ({{displayName}}),",
        VARIABLES,
      ),
    ).toBe("Hallo Gio Cettuzzi (Gio C.),");
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
    expect(personalize("Hallo {{displayName}},", {firstName: "", lastName: "", displayName: ""})).toBe(
      "Hallo ,",
    );
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
      }),
    ).toBe("Hallo &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;,");
  });
});
