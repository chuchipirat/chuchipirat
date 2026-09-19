import {
  UNSUBSCRIBE_BLOCK,
  buildTitleBlock,
  resolveUnsubscribePolicy,
} from "../mailConsoleOptions";

describe("buildTitleBlock", () => {
  test("baut die Überschrift aus dem Titel", () => {
    expect(buildTitleBlock("Hallo Lager")).toContain(">Hallo Lager</h1>");
  });

  test.each([undefined, "", "   ", "\n\t"])(
    "liefert bei leerem Titel (%p) keine Überschrift",
    (title) => {
      expect(buildTitleBlock(title)).toBe("");
    },
  );

  test("maskiert HTML im Titel", () => {
    const block = buildTitleBlock('<script>alert("x")</script>');
    expect(block).not.toContain("<script>");
    expect(block).toContain("&lt;script&gt;");
  });

  test("schneidet Leerraum am Rand ab", () => {
    expect(buildTitleBlock("  Hallo  ")).toContain(">Hallo</h1>");
  });
});

describe("UNSUBSCRIBE_BLOCK", () => {
  test("enthält den Platzhalter für den personalisierten Abmelde-Link", () => {
    expect(UNSUBSCRIBE_BLOCK).toContain("{{unsubscribeLink}}");
    expect(UNSUBSCRIBE_BLOCK).toContain("Hier abmelden");
  });
});

describe("resolveUnsubscribePolicy", () => {
  test.each(["role", "uid", "email"])(
    "ohne Angabe (ältere Clients) bleibt alles wie bisher — %s",
    (recipientType) => {
      expect(resolveUnsubscribePolicy(undefined, recipientType)).toEqual({
        ok: true,
        includeUnsubscribe: true,
        respectOptOut: true,
      });
    },
  );

  test("true: Footer an und Abmeldungen werden berücksichtigt", () => {
    expect(resolveUnsubscribePolicy(true, "uid")).toEqual({
      ok: true,
      includeUnsubscribe: true,
      respectOptOut: true,
    });
  });

  test.each(["uid", "email"])(
    "false bei %s: kein Footer und Abmeldungen werden übersprungen",
    (recipientType) => {
      expect(resolveUnsubscribePolicy(false, recipientType)).toEqual({
        ok: true,
        includeUnsubscribe: false,
        respectOptOut: false,
      });
    },
  );

  test("false bei einer Rolle wird abgelehnt", () => {
    const result = resolveUnsubscribePolicy(false, "role");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Rolle");
    }
  });

  test("nur ein striktes false schaltet ab (kein Falsy-Trick)", () => {
    expect(
      resolveUnsubscribePolicy(0 as unknown as boolean, "uid"),
    ).toMatchObject({includeUnsubscribe: true, respectOptOut: true});
    expect(
      resolveUnsubscribePolicy(null as unknown as boolean, "uid"),
    ).toMatchObject({includeUnsubscribe: true, respectOptOut: true});
  });
});
