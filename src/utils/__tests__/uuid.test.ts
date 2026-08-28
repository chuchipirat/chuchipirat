import {isUuid} from "../uuid";

describe("isUuid", () => {
  test("akzeptiert eine kanonische v4-UUID", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  test("akzeptiert eine v1-UUID", () => {
    expect(isUuid("a8098c1a-f86e-11da-bd1a-00112444be1e")).toBe(true);
  });

  test("akzeptiert UUIDs mit Grossbuchstaben (case-insensitive)", () => {
    expect(isUuid("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  test("lehnt eine Firebase-UID ab", () => {
    expect(isUuid("e8WxnzFaEnMeo908kVxx1Qgv3hb2")).toBe(false);
    expect(isUuid("x2tJZZBSBgg1D0mrr0Rxc6EBV0v1")).toBe(false);
  });

  test("lehnt einen leeren String ab", () => {
    expect(isUuid("")).toBe(false);
  });

  test("lehnt eine UUID ohne Bindestriche ab", () => {
    expect(isUuid("3f2504e04f8941d39a0c0305e82c3301")).toBe(false);
  });

  test("lehnt eine zu kurze / zu lange Zeichenkette ab", () => {
    expect(isUuid("1234")).toBe(false);
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301-extra")).toBe(false);
  });

  test("lehnt Nicht-Hex-Zeichen im UUID-Muster ab", () => {
    expect(isUuid("g3f2504e-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
  });

  test("lehnt Nicht-String-Werte ab", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(12345)).toBe(false);
    expect(isUuid({})).toBe(false);
  });
});
