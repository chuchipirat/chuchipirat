/**
 * Unit-Tests für die Auswertung eines Realtime-Echos der Einkaufsliste.
 *
 * Fokus: Das Echo eines eigenen Saves wird nicht angezeigt, der DB-Stand aber
 * trotzdem übernommen. Sonst vergleicht das nächste Echo gegen einen alten
 * Stand, und eigene frühere Änderungen leuchten als fremde auf.
 */
import {ItemType, ShoppingList, ShoppingListItem} from "../shoppingList.class";
import {classifyShoppingListEcho} from "../shoppingListEcho";

/**
 * Baut eine Position mit der angegebenen ID und Abhak-Status.
 */
const buildItem = (id: string, checked = false, quantity = 1): ShoppingListItem => ({
  id,
  checked,
  quantity,
  unit: "kg",
  item: {uid: `product-${id}`, name: `Artikel ${id}`},
  type: ItemType.food,
});

/**
 * Baut eine Einkaufsliste mit einer Abteilung und den angegebenen Positionen.
 */
const buildList = (items: ShoppingListItem[]): ShoppingList => ({
  uid: "list-1",
  list: {
    0: {departmentUid: "dep-0", departmentName: "Gemüse", items},
  },
});

describe("classifyShoppingListEcho()", () => {
  it("zeigt das Echo eines eigenen Saves nicht an, übernimmt aber den DB-Stand", () => {
    const previous = buildList([buildItem("a"), buildItem("b")]);
    const incoming = buildList([buildItem("a", true), buildItem("b")]);

    const decision = classifyShoppingListEcho({
      previous,
      incoming,
      ownSaveInProgress: true,
    });

    expect(decision.apply).toBe(false);
    expect(decision.changedKeys.size).toBe(0);
    expect(decision.nextReference).toBe(incoming);
  });

  it("verwirft ein Echo ohne inhaltliche Änderung", () => {
    const previous = buildList([buildItem("a", true)]);
    const incoming = buildList([buildItem("a", true)]);

    const decision = classifyShoppingListEcho({
      previous,
      incoming,
      ownSaveInProgress: false,
    });

    expect(decision.apply).toBe(false);
    expect(decision.changedKeys.size).toBe(0);
  });

  it("übernimmt eine fremde Änderung und markiert nur die geänderte Position", () => {
    const previous = buildList([buildItem("a"), buildItem("b")]);
    const incoming = buildList([buildItem("a"), buildItem("b", true)]);

    const decision = classifyShoppingListEcho({
      previous,
      incoming,
      ownSaveInProgress: false,
    });

    expect(decision.apply).toBe(true);
    expect([...decision.changedKeys]).toEqual(["b"]);
    expect(decision.nextReference).toBe(incoming);
  });

  it("markiert eine neue Position und eine geänderte Menge", () => {
    const previous = buildList([buildItem("a")]);
    const incoming = buildList([buildItem("a", false, 3), buildItem("c")]);

    const decision = classifyShoppingListEcho({
      previous,
      incoming,
      ownSaveInProgress: false,
    });

    expect([...decision.changedKeys].sort()).toEqual(["a", "c"]);
  });

  it("markiert nichts, wenn die Liste leer geworden ist", () => {
    const previous = buildList([buildItem("a")]);
    const incoming = buildList([]);

    const decision = classifyShoppingListEcho({
      previous,
      incoming,
      ownSaveInProgress: false,
    });

    expect(decision.apply).toBe(true);
    expect(decision.changedKeys.size).toBe(0);
  });

  it("lässt eine frühere eigene Änderung beim nächsten fremden Echo nicht aufleuchten", () => {
    // Ablauf wie in der Ansicht: der Aufrufer merkt sich nach jedem Echo
    // `nextReference` als neue Vergleichsbasis.
    let reference = buildList([buildItem("a"), buildItem("b")]);

    // 1. Eigenes Abhaken von «a»: Echo während des Saves
    const ownEcho = classifyShoppingListEcho({
      previous: reference,
      incoming: buildList([buildItem("a", true), buildItem("b")]),
      ownSaveInProgress: true,
    });
    reference = ownEcho.nextReference;

    // 2. Eine andere Köch:in hakt «b» ab
    const foreignEcho = classifyShoppingListEcho({
      previous: reference,
      incoming: buildList([buildItem("a", true), buildItem("b", true)]),
      ownSaveInProgress: false,
    });

    expect([...foreignEcho.changedKeys]).toEqual(["b"]);
  });

  it("markiert beim ersten Echo ohne Vergleichsbasis nichts als geändert", () => {
    const incoming = buildList([buildItem("a")]);

    const decision = classifyShoppingListEcho({
      previous: null,
      incoming,
      ownSaveInProgress: false,
    });

    expect(decision.apply).toBe(true);
    expect(decision.nextReference).toBe(incoming);
  });
});
