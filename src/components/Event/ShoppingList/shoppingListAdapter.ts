/**
 * Adapter-Funktionen zwischen Supabase-Domain-Modellen und dem
 * Legacy-Format (ShoppingListCollection / ShoppingList).
 *
 * Minimiert die Änderungen an der 1400-Zeilen-Rendering-Komponente,
 * indem die Supabase-Daten in das bestehende UI-Format konvertiert
 * werden und umgekehrt.
 */
import {ShoppingListCollection,
  ShoppingListEntry,
  ShoppingListProperties,
} from "./shoppingListCollection.class";
import {ShoppingList,
  ItemType,
  ShoppingListDepartment,
  ShoppingListItem,
  ShoppingListTrace,
} from "./shoppingList.class";
import {
  ShoppingListHeaderDomain,
  ShoppingListItemDomain,
  ShoppingListItemInsertRow,
} from "../../Database/Repository/ShoppingListRepository";
import Department from "../../Department/department.class";


/**
 * Konvertiert Supabase-Header-Domain-Objekte in eine ShoppingListCollection.
 *
 * Trace-Maps werden leer initialisiert, da Traces nicht in Supabase
 * persistiert werden. Sie werden beim Erstellen/Refresh in-memory berechnet
 * und über den lokalen State gehalten.
 *
 * @param headers - Array von Supabase-Header-Domain-Objekten
 * @param eventId - Die Event-ID für die Collection
 * @returns ShoppingListCollection im Legacy-Format
 */
export function headersDomainToCollection(
  headers: ShoppingListHeaderDomain[],
  eventId: string,
): ShoppingListCollection {
  const collection = new ShoppingListCollection();
  collection.eventUid = eventId;
  collection.noOfLists = headers.length;

  if (headers.length > 0) {
    // Letztes Update über alle Listen hinweg bestimmen
    const latestUpdate = headers.reduce((latest, h) =>
      h.updatedAt > latest.updatedAt ? h : latest,
    );
    collection.lastChange = {
      date: latestUpdate.updatedAt,
      fromUid: "",
      fromDisplayName: "",
    };
  }

  headers.forEach((header) => {
    const properties: ShoppingListProperties = {
      uid: header.id,
      name: header.name,
      selectedMeals: header.selectedMeals,
      selectedMenues: header.selectedMenues,
      selectedDepartments: header.selectedDepartments,
      generated: {
        date: header.updatedAt,
        fromUid: "",
        fromDisplayName: "",
      },
      hasManuallyAddedItems: header.hasManuallyAddedItems,
    };

    const entry: ShoppingListEntry = {
      properties,
      // Trace wird in-memory beim Erstellen/Refresh befüllt
      trace: {} as ShoppingListTrace,
    };

    collection.lists[header.id] = entry;
  });

  return collection;
}


/**
 * Leitet den ItemType aus einem Supabase-Domain-Item ab.
 *
 * @param item - Das Supabase-Item-Domain-Objekt
 * @returns Der abgeleitete ItemType
 */
export function deriveItemType(item: ShoppingListItemDomain): ItemType {
  if (item.productId) return ItemType.food;
  if (item.materialId) return ItemType.material;
  if (item.freeTextName) return ItemType.custom;
  return ItemType.none;
}

/**
 * Konvertiert Supabase-Item-Domain-Objekte in eine Legacy-ShoppingList.
 *
 * Items werden anhand der Abteilungsposition gruppiert, genau wie im
 * bestehenden UI-Format. Die supabaseId wird für granulare Updates
 * (z.B. Checkbox-Toggle) mitgegeben.
 *
 * @param items - Array von Supabase-Item-Domain-Objekten
 * @param listId - Die Listen-ID (wird als ShoppingList.uid gesetzt)
 * @returns ShoppingList im Legacy-Format
 */
export function itemsDomainToShoppingList(
  items: ShoppingListItemDomain[],
  listId: string,
): ShoppingList {
  const shoppingList = new ShoppingList();
  shoppingList.uid = listId;
  // Leere default-Abteilung entfernen
  shoppingList.list = {};

  items.forEach((item) => {
    const departmentPos = item.departmentPos ?? 99;
    const departmentName = item.departmentName ?? "Keine Zuordnung möglich";
    const departmentUid = item.departmentId ?? "NotIdentifiable";

    if (!Object.prototype.hasOwnProperty.call(shoppingList.list, departmentPos)) {
      shoppingList.list[departmentPos as Department["pos"]] = {
        departmentUid,
        departmentName,
        items: [],
      } as ShoppingListDepartment;
    }

    const shoppingListItem: ShoppingListItem = {
      checked: item.checked,
      quantity: item.quantity,
      unit: item.unit ?? "",
      item: {
        uid: item.productId ?? item.materialId ?? item.id,
        name: item.itemName,
      },
      type: deriveItemType(item),
      id: item.id,
      supabaseId: item.id,
    };

    // Edit-Source auf manualEdit/manualAdd mappen
    if (item.editSource === "manual_edit") {
      shoppingListItem.manualEdit = true;
    } else if (item.editSource === "manual_add") {
      shoppingListItem.manualAdd = true;
    }

    shoppingList.list[departmentPos as Department["pos"]].items.push(
      shoppingListItem,
    );
  });

  return shoppingList;
}


/**
 * Leitet die edit_source aus einem Legacy-ShoppingListItem ab.
 *
 * @param item - Das Legacy-ShoppingListItem
 * @returns Die edit_source für die Supabase-Zeile
 */
export function deriveEditSource(
  item: ShoppingListItem,
): "generated" | "manual_add" | "manual_edit" {
  if (item.manualAdd) return "manual_add";
  if (item.manualEdit) return "manual_edit";
  return "generated";
}

/**
 * Ermittelt die Quell-Spalte einer Einkaufslisten-Position.
 *
 * Die DB-Constraint `chk_item_source` verlangt, dass **genau eine** der Spalten
 * `product_id`, `material_id`, `free_text_name` gesetzt ist. Positionen ohne
 * gültige Quelle (z.B. nur eine Menge eingetippt, aber noch kein Produkt/Name
 * gewählt, oder ein per Autocomplete geleerter Eintrag) haben keine — der
 * Aufrufer überspringt sie, statt eine Constraint-Verletzung zu riskieren.
 *
 * @param item - Die Legacy-Position.
 * @returns Das Quell-Fragment für die Insert-Zeile oder `null`, wenn die
 *   Position keine gültige Quelle hat.
 */
export function resolveItemSource(
  item: ShoppingListItem,
): Pick<
  ShoppingListItemInsertRow,
  "product_id" | "material_id" | "free_text_name"
> | null {
  switch (item.type) {
    case ItemType.food:
      return item.item.uid ? {product_id: item.item.uid} : null;
    case ItemType.material:
      return item.item.uid ? {material_id: item.item.uid} : null;
    // ItemType.custom und ItemType.none werden als Freitext behandelt
    default:
      return item.item.name ? {free_text_name: item.item.name} : null;
  }
}

/**
 * Konvertiert eine Legacy-ShoppingList in Supabase-InsertRows.
 *
 * Iteriert über alle Abteilungen und Items und erzeugt die
 * entsprechenden Insert-Zeilen mit aufgelösten IDs. Positionen ohne gültige
 * Quelle (siehe {@link resolveItemSource}) werden übersprungen.
 *
 * @param list - Die Legacy-ShoppingList
 * @param listId - Die Listen-ID für die Supabase-Zuordnung
 * @param departments - Alle Abteilungen (für UID-Auflösung)
 * @returns Array von ShoppingListItemInsertRow für Supabase
 */
export function shoppingListToInsertRows(
  list: ShoppingList,
  listId: string,
  departments: Department[],
): ShoppingListItemInsertRow[] {
  const rows: ShoppingListItemInsertRow[] = [];
  let sortOrder = 0;

  Object.entries(list.list).forEach(([departmentPosStr, department]) => {
    const departmentPos = Number(departmentPosStr);

    // Abteilungs-UID aus dem Department-Array auflösen
    const dept = departments.find((d) => d.pos === departmentPos);
    const departmentId =
      dept?.uid && dept.uid !== "NotIdentifiable" ? dept.uid : null;

    department.items.forEach((item) => {
      // Leere Platzhalter-Items (vom Edit-Modus) überspringen
      if (item.quantity === 0 && item.unit === "" && item.item.name === "") {
        return;
      }

      // Positionen ohne gültige Quelle überspringen — sie würden die
      // DB-Constraint chk_item_source verletzen (z.B. eine Menge wurde
      // eingetippt, aber es ist noch kein Produkt/Name gesetzt).
      const source = resolveItemSource(item);
      if (!source) {
        return;
      }

      rows.push({
        id: item.id,
        list_id: listId,
        quantity: item.quantity,
        unit: item.unit || null,
        checked: item.checked,
        edit_source: deriveEditSource(item),
        sort_order: sortOrder++,
        department_id: departmentId,
        ...source,
      });
    });
  });

  return dedupeInsertRows(rows);
}

/**
 * Entfernt versehentliche Doppel-Positionen aus den Insert-Zeilen.
 *
 * Zwei Ebenen:
 * 1. Exakte ID-Kollision (kann bei einem Bug in der Vorlagen-Zeilen-ID
 *    entstehen) — die zweite Zeile würde per `ON CONFLICT (id)` die erste
 *    überschreiben; wir behalten die mit der grösseren Menge.
 * 2. Derselbe Katalog-Artikel (`product_id`/`material_id`) mit derselben
 *    Einheit in mehreren Zeilen — ein Katalog-Artikel gehört zu genau einer
 *    Abteilung, ein solcher Zustand entsteht nur durch eine Race-Bedingung
 *    beim gleichzeitigen Autocomplete-Select + Blur. Freitext-Positionen
 *    (eigene, eindeutige `id`) sind davon nicht betroffen.
 *
 * @param rows - Die roh erzeugten Insert-Zeilen.
 * @returns Die deduplizierten Insert-Zeilen in ursprünglicher Reihenfolge.
 */
function dedupeInsertRows(
  rows: ShoppingListItemInsertRow[],
): ShoppingListItemInsertRow[] {
  const byKey = new Map<string, ShoppingListItemInsertRow>();

  for (const row of rows) {
    const sourceKey = row.product_id
      ? `p:${row.product_id}`
      : row.material_id
        ? `m:${row.material_id}`
        : `id:${row.id}`;
    const key = `${sourceKey}|${row.unit ?? ""}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      continue;
    }

    // Kollision: die „vollständigere" Zeile behalten (grössere Menge, sonst
    // die bereits erfasste).
    if ((row.quantity ?? 0) > (existing.quantity ?? 0)) {
      byKey.set(key, {...row, id: existing.id, sort_order: existing.sort_order});
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
}
