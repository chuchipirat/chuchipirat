/**
 * Unit-Tests für die Enums des Anlegen-Protokolls.
 *
 * Die Werte landen unverändert in PostgreSQL-ENUMs bzw. in der jsonb-Liste
 * `hints`. Weicht ein Wert vom DB-Label ab, scheitert das Einfügen erst zur
 * Laufzeit (oder, bei `hints`, gar nicht und verfälscht still die Auswertung).
 */
import {
  CreationItemType,
  CreationOrigin,
  CreationDecision,
  LEGACY_RULES_VERSION,
} from "../creationLog.types";
import {NameHintKind} from "../../Matching/nameHint.types";

const SNAKE_CASE = /^[a-z]+(_[a-z]+)*$/;

describe("Enums des Anlegen-Protokolls", () => {
  test("CreationItemType entspricht dem ENUM item_creation_type", () => {
    expect(Object.values(CreationItemType).sort()).toEqual([
      "material",
      "product",
    ]);
  });

  test("CreationOrigin entspricht dem ENUM item_creation_origin", () => {
    expect(Object.values(CreationOrigin).sort()).toEqual([
      "material_list",
      "materials_admin",
      "menuplan",
      "products_admin",
      "recipe",
      "shopping_list",
    ]);
  });

  test("CreationDecision entspricht dem ENUM item_creation_decision", () => {
    expect(Object.values(CreationDecision).sort()).toEqual([
      "cancelled",
      "created",
      "suggestion_taken",
    ]);
  });

  test("NameHintKind enthält alle Hinweis-Arten der Abgleich-Logik", () => {
    expect(Object.values(NameHintKind).sort()).toEqual([
      "brand",
      "combination",
      "contains_product",
      "deactivated_product",
      "detail_word",
      "exact_product",
      "not_a_product",
      "other_list",
      "property",
      "similar_product",
    ]);
  });

  test("alle Werte sind snake_case (Auswertung per SQL auf den Labels)", () => {
    const allValues = [
      ...Object.values(CreationItemType),
      ...Object.values(CreationOrigin),
      ...Object.values(CreationDecision),
      ...Object.values(NameHintKind),
    ];
    allValues.forEach((value) => expect(value).toMatch(SNAKE_CASE));
  });

  test("die heutige Prüfung läuft als Regelversion 0", () => {
    expect(LEGACY_RULES_VERSION).toBe(0);
  });
});
