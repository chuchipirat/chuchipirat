import {FeedType, getFeedTitle, getFeedText} from "../feed.class";
import {
  FEED_TITLE as TEXT_FEED_TITLE,
  FEED_TEXT as TEXT_FEED_TEXT,
} from "../../../constants/text";

/* =====================================================================
// getFeedTitle()
// ===================================================================== */
describe("getFeedTitle()", () => {
  test("userCreated gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.userCreated)).toBe(TEXT_FEED_TITLE.USER_CREATED);
  });

  test("recipePublished gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.recipePublished)).toBe(TEXT_FEED_TITLE.RECIPE_PUBLISHED);
  });

  test("recipeRated enthält den Rezeptnamen", () => {
    const result = getFeedTitle(FeedType.recipeRated, ["Älplermagronen"]);
    expect(result).toContain(TEXT_FEED_TITLE.RECIPE_RATED);
    expect(result).toContain("Älplermagronen");
  });

  test("recipeCommented gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.recipeCommented)).toBe(TEXT_FEED_TITLE.RECIPE_COMMENTED);
  });

  test("eventCreated gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.eventCreated)).toBe(TEXT_FEED_TITLE.EVENT_CREATED);
  });

  test("eventCookAdded gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.eventCookAdded)).toBe(TEXT_FEED_TITLE.EVENT_COOK_ADDED);
  });

  test("shoppingListCreated gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.shoppingListCreated)).toBe(
      TEXT_FEED_TITLE.SHOPPINGLIST_CREATED,
    );
  });

  test("profilePictureChanged gibt den passenden Titel zurück", () => {
    expect(getFeedTitle(FeedType.profilePictureChanged)).toBe(
      TEXT_FEED_TITLE.PROFILE_PICTURE_CHANGED,
    );
  });

  test("productCreated gibt den Produktnamen zurück", () => {
    expect(getFeedTitle(FeedType.productCreated, ["Mehl"])).toBe("Mehl");
  });

  test("materialCreated gibt den Materialnamen zurück", () => {
    expect(getFeedTitle(FeedType.materialCreated, ["Pfanne"])).toBe("Pfanne");
  });

  test("unbekannter FeedType gibt '?' zurück", () => {
    expect(getFeedTitle("unknownType" as FeedType)).toBe("?");
  });

  test("leere textElements: productCreated gibt leeren String zurück", () => {
    expect(getFeedTitle(FeedType.productCreated, [])).toBe("");
  });

  test("fehlende textElements: recipeRated nutzt leeren Fallback", () => {
    const result = getFeedTitle(FeedType.recipeRated);
    expect(result).toContain(TEXT_FEED_TITLE.RECIPE_RATED);
  });
});

/* =====================================================================
// getFeedText()
// ===================================================================== */
describe("getFeedText()", () => {
  test("userCreated gibt statischen Text zurück", () => {
    expect(getFeedText(FeedType.userCreated)).toBe(TEXT_FEED_TEXT.USER_CREATED);
  });

  test("recipePublished enthält den Rezeptnamen", () => {
    const result = getFeedText(FeedType.recipePublished, ["Rösti"]);
    expect(result).toContain("Rösti");
  });

  test("recipeRated: 5 Sterne — superlecker", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "5"]);
    expect(result).toContain("superlecker");
    expect(result).toContain("5");
  });

  test("recipeRated: 4 Sterne — mag es", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "4"]);
    expect(result).toContain("mag es");
  });

  test("recipeRated: 3 Sterne — mässig überzeugt", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "3"]);
    expect(result).toContain("mässig");
  });

  test("recipeRated: 2 Sterne — mag lieber was anderes", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "2"]);
    expect(result).toContain("lieber was anderes");
  });

  test("recipeRated: 1 Stern — mag das nicht", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "1"]);
    expect(result).toContain("nicht");
  });

  test("recipeRated: 0 Sterne — Rating entfernt", () => {
    const result = getFeedText(FeedType.recipeRated, ["Rösti", "0"]);
    expect(result).toContain("entfernt");
  });

  test("recipeCommented enthält den Rezeptnamen", () => {
    const result = getFeedText(FeedType.recipeCommented, ["Gulasch"]);
    expect(result).toContain("Gulasch");
    expect(result).toContain("kommentiert");
  });

  test("eventCreated enthält den Anlassnamen", () => {
    const result = getFeedText(FeedType.eventCreated, ["Sommerlager"]);
    expect(result).toContain("Sommerlager");
  });

  test("eventCookAdded enthält den Teamnamen", () => {
    const result = getFeedText(FeedType.eventCookAdded, ["Pfadi"]);
    expect(result).toContain("Pfadi");
  });

  test("shoppingListCreated mit zufälligem Item und weiteren Artikeln", () => {
    const result = getFeedText(FeedType.shoppingListCreated, ["2.5 kg Zwiebeln", "42"]);
    expect(result).toContain("2.5 kg Zwiebeln");
    expect(result).toContain("42 weitere Schätze");
  });

  test("shoppingListCreated mit nur einem Artikel (keine weiteren)", () => {
    const result = getFeedText(FeedType.shoppingListCreated, ["500 g Mehl", "0"]);
    expect(result).toContain("500 g Mehl");
    expect(result).not.toContain("weitere");
  });

  test("profilePictureChanged gibt statischen Text zurück", () => {
    const result = getFeedText(FeedType.profilePictureChanged);
    expect(result).toContain("Profilbild");
  });

  test("unbekannter FeedType gibt '?' zurück", () => {
    expect(getFeedText("unknownType" as FeedType)).toBe("?");
  });
});

/* =====================================================================
// FeedType Enum
// ===================================================================== */
describe("FeedType Enum", () => {
  test("hat genau 11 Werte", () => {
    const values = Object.values(FeedType);
    expect(values).toHaveLength(11);
  });

  test("enthält alle erwarteten Typen", () => {
    expect(FeedType.userCreated).toBe("userCreated");
    expect(FeedType.recipePublished).toBe("recipePublished");
    expect(FeedType.recipeRated).toBe("recipeRated");
    expect(FeedType.recipeCommented).toBe("recipeCommented");
    expect(FeedType.eventCreated).toBe("eventCreated");
    expect(FeedType.eventCookAdded).toBe("eventCookAdded");
    expect(FeedType.shoppingListCreated).toBe("shoppingListCreated");
    expect(FeedType.productCreated).toBe("productCreated");
    expect(FeedType.materialCreated).toBe("materialCreated");
    expect(FeedType.profilePictureChanged).toBe("profilePictureChanged");
    expect(FeedType.donationConfirmed).toBe("donationConfirmed");
  });
});
