/**
 * Unit-Tests für die Persistenz-Pfade in useShoppingListHandlers.
 *
 * Regression Einkaufslisten-Save-Race:
 * - B1a: Der `saveInProgressRef`-Zähler wird synchron hoch- und nach dem Save
 *   sofort wieder heruntergezählt (kein `setTimeout(500)` mehr), damit das
 *   Realtime-Echo den optimistischen lokalen Stand nicht überschreibt.
 * - B3: Der Kontextmenü-Eintrag „Löschen" persistiert die Änderung jetzt
 *   (vorher nur lokale Mutation → Zeile kam beim nächsten Echo zurück).
 */
// Polyfill für jsdom (react-router wird transitiv über event.tsx geladen)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only — useShoppingListHandlers.tsx importiert
// transitiv davon.
jest.mock("@react-pdf/renderer", () => ({
  Document: () => null,
  Page: () => null,
  View: () => null,
  Text: () => null,
  Link: () => null,
  Svg: () => null,
  Path: () => null,
  Font: {register: jest.fn(), registerEmojiSource: jest.fn()},
  StyleSheet: {create: (styles: unknown) => styles},
  pdf: jest.fn(),
}));
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

const customDialogMock = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: customDialogMock}),
}));

import React from "react";
import {renderHook, act} from "@testing-library/react";
import * as Sentry from "@sentry/react";

import {useShoppingListHandlers} from "../useShoppingListHandlers";
import {ShoppingList, ItemType} from "../shoppingList.class";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {Action} from "../../../../constants/actions";
import Department from "../../../Department/department.class";

const LIST_ID = "list-1";

const makeDepartment = (pos: number, uid: string): Department => {
  const department = new Department();
  department.pos = pos;
  department.uid = uid;
  department.name = `Abteilung ${pos}`;
  return department;
};

/** Einkaufsliste mit zwei Freitext-Positionen in Abteilung 0. */
const makeShoppingList = (): ShoppingList => {
  const shoppingList = new ShoppingList();
  shoppingList.uid = LIST_ID;
  shoppingList.list[0] = {
    departmentUid: "dep-0",
    departmentName: "Abteilung 0",
    items: [
      {
        checked: false,
        quantity: 1,
        unit: "kg",
        item: {uid: "item-a", name: "Artikel A"},
        type: ItemType.custom,
      },
      {
        checked: false,
        quantity: 2,
        unit: "kg",
        item: {uid: "item-b", name: "Artikel B"},
        type: ItemType.custom,
      },
    ],
  };
  return shoppingList;
};

type Deferred = {promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void};
const defer = (): Deferred => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

const renderHandlers = (overrides: {saveListItems?: jest.Mock} = {}) => {
  const saveListItems =
    overrides.saveListItems ?? jest.fn().mockResolvedValue(undefined);
  const saveInProgressRef: React.MutableRefObject<number> = {current: 0};
  const shoppingList = makeShoppingList();
  const onShoppingListUpdate = jest.fn();

  const mockDatabase = {
    shoppingLists: {
      saveListItems,
      updateListHeader: jest.fn().mockResolvedValue(undefined),
      updateItemChecked: jest.fn().mockResolvedValue(undefined),
    },
  } as never;

  const shoppingListCollection = {
    lists: {
      [LIST_ID]: {
        properties: {selectedMenues: [], hasManuallyAddedItems: false},
        trace: {},
      },
    },
  } as never;

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <DatabaseContext.Provider value={mockDatabase}>
      {children}
    </DatabaseContext.Provider>
  );

  const {result} = renderHook(
    () =>
      useShoppingListHandlers({
        authUser: {} as never,
        event: {uid: "event-1", name: "Event"} as never,
        menuplan: {} as never,
        products: [],
        materials: [],
        departments: [makeDepartment(0, "dep-0")],
        units: [],
        unitConversionBasic: null,
        unitConversionProducts: null,
        shoppingListCollection,
        shoppingList,
        selectedListItem: LIST_ID,
        saveInProgressRef,
        getPersistedItemIds: () =>
          Object.values(shoppingList.list).flatMap((department) =>
            department.items.map((entry) => entry.id),
          ),
        fetchMissingData: jest.fn(),
        onShoppingListUpdate,
        onShoppingCollectionUpdate: jest.fn(),
        onDispatchLoading: jest.fn(),
        onDispatchSetSelectedListItem: jest.fn(),
        onDispatchError: jest.fn(),
        onDispatchSnackbar: jest.fn(),
      }),
    {wrapper},
  );

  return {result, saveListItems, saveInProgressRef, onShoppingListUpdate, shoppingList};
};

/** Öffnet das Kontextmenü für eine Position (Button-ID: `btn_<dept>_<uid>_<unit>`). */
const openContextMenu = (
  result: {current: ReturnType<typeof useShoppingListHandlers>},
  buttonId: string,
) => {
  act(() => {
    result.current.onOpenContextMenu({
      currentTarget: {id: buttonId},
    } as never);
  });
};

describe("useShoppingListHandlers — Kontextmenü-Delete (B3) + Save-Flag (B1a)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("persistiert die Liste nach dem Löschen einer Position (ohne die gelöschte Zeile)", async () => {
    const {result, saveListItems} = renderHandlers();

    openContextMenu(result, "btn_0_item-b_kg");

    await act(async () => {
      await result.current.onContextMenuClick({
        currentTarget: {dataset: {action: Action.DELETE}},
      } as never);
    });

    expect(saveListItems).toHaveBeenCalledTimes(1);
    const [listId, rows] = saveListItems.mock.calls[0];
    expect(listId).toBe(LIST_ID);
    const names = (rows as {free_text_name?: string}[]).map((r) => r.free_text_name);
    expect(names).toContain("Artikel A");
    expect(names).not.toContain("Artikel B");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("hält saveInProgressRef während des Saves + kurzer Nachlaufzeit oben, danach 0", async () => {
    jest.useFakeTimers();
    const deferred = defer();
    const saveListItems = jest.fn().mockReturnValue(deferred.promise);
    const {result, saveInProgressRef} = renderHandlers({saveListItems});

    openContextMenu(result, "btn_0_item-b_kg");

    let clickPromise!: Promise<void>;
    act(() => {
      clickPromise = result.current.onContextMenuClick({
        currentTarget: {dataset: {action: Action.DELETE}},
      } as never);
    });

    // Save läuft → Zähler > 0
    expect(saveInProgressRef.current).toBe(1);

    await act(async () => {
      deferred.resolve();
      await clickPromise;
    });

    // Nach dem Settle noch oben (Nachlauf-Fenster für WAL-Echos)
    expect(saveInProgressRef.current).toBe(1);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(saveInProgressRef.current).toBe(0);
    jest.useRealTimers();
  });

  test("neues Item aus der Vorlagen-Zeile übernimmt deren ID (Fokus-Regression)", async () => {
    const {result, onShoppingListUpdate} = renderHandlers();

    await act(async () => {
      await result.current.onChangeItem({
        source: "textfield",
        event: {target: {id: "quantity_0_tmpl-row-0"}} as never,
        value: "5",
      });
    });

    const updatedList = onShoppingListUpdate.mock.calls.at(-1)?.[0];
    const createdItem = updatedList.list[0].items.find(
      (entry: {item: {uid: string}}) => entry.item.uid === "tmpl-row-0",
    );
    // Die ID ist die Vorlagen-ID (field[2]) — nicht die frische UUID aus
    // createEmptyListItem —, damit der React-Key der ListItem-Zeile stabil
    // bleibt und der Fokus im Mengenfeld nach dem Re-Render erhalten bleibt.
    expect(createdItem.id).toBe("tmpl-row-0");
    expect(createdItem.quantity).toBe(5);
  });

  test("dekrementiert den Zähler auch bei fehlgeschlagenem Save", async () => {
    jest.useFakeTimers();
    const saveListItems = jest.fn().mockRejectedValue(new Error("boom"));
    const {result, saveInProgressRef} = renderHandlers({saveListItems});

    openContextMenu(result, "btn_0_item-b_kg");

    await act(async () => {
      await result.current.onContextMenuClick({
        currentTarget: {dataset: {action: Action.DELETE}},
      } as never);
    });

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(saveInProgressRef.current).toBe(0);
    expect(Sentry.captureException).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
