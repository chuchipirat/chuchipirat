/**
 * Adapter-Funktionen zwischen Supabase-Domain-Modellen und dem
 * Legacy-Format (MaterialList / MaterialListEntry / MaterialListMaterial).
 *
 * Minimiert die Änderungen an der Rendering-Komponente, indem die
 * Supabase-Daten in das bestehende UI-Format konvertiert werden
 * und umgekehrt.
 */
import MaterialList, {
  MaterialListEntry,
  MaterialListMaterial,
} from "./materialList.class";
import {
  MaterialListHeaderDomain,
  MaterialListItemDomain,
  MaterialListItemInsertRow,
} from "../../Database/Repository/MaterialListRepository";
import Material, {MaterialType} from "../../Material/material.class";

/* =====================================================================
// Supabase → Legacy: Kopfzeilen → MaterialList
// ===================================================================== */

/**
 * Konvertiert Supabase-Header-Domain-Objekte in eine MaterialList.
 *
 * Trace-Maps werden leer initialisiert, da Traces nicht in Supabase
 * persistiert werden. Sie werden beim Erstellen/Refresh in-memory
 * berechnet und über den lokalen State gehalten.
 *
 * @param headers - Array von Supabase-Header-Domain-Objekten
 * @param eventId - Die Event-ID für die MaterialList
 * @returns MaterialList im Legacy-Format
 */
export function headersDomainToMaterialList(
  headers: MaterialListHeaderDomain[],
  eventId: string,
): MaterialList {
  const materialList = new MaterialList();
  materialList.uid = eventId;

  if (headers.length > 0) {
    // Letztes Update über alle Listen hinweg bestimmen
    const latestUpdate = headers.reduce((latest, h) =>
      h.updatedAt > latest.updatedAt ? h : latest,
    );
    materialList.lastChange = {
      date: latestUpdate.updatedAt,
      fromUid: "",
      fromDisplayName: "",
    };
  }

  headers.forEach((header) => {
    const entry: MaterialListEntry = {
      properties: {
        uid: header.id,
        name: header.name,
        selectedMeals: header.selectedMeals,
        selectedMenues: header.selectedMenues,
        generated: {
          date: header.updatedAt,
          fromUid: "",
          fromDisplayName: "",
        },
      },
      items: [],
    };

    materialList.lists[header.id] = entry;
  });

  return materialList;
}

/* =====================================================================
// Supabase → Legacy: Items → MaterialListMaterial[]
// ===================================================================== */

/**
 * Konvertiert Supabase-Item-Domain-Objekte in ein Array von
 * MaterialListMaterial-Objekten (Legacy-UI-Format).
 *
 * Die supabaseId wird im uid-Feld gespeichert, damit granulare
 * Updates (Checkbox, Inline-Edit) funktionieren.
 *
 * @param items - Array von Supabase-Item-Domain-Objekten
 * @returns Array von MaterialListMaterial im Legacy-Format
 */
export function itemsDomainToMaterialListItems(
  items: MaterialListItemDomain[],
): MaterialListMaterial[] {
  return items.map((item) => {
    const material: MaterialListMaterial = {
      checked: item.checked,
      name: item.itemName,
      uid: item.materialId ?? item.id,
      type: MaterialType.usage,
      quantity: item.quantity,
      trace: [],
      supabaseId: item.id,
      assignedCookId: item.assignedCookId,
      assignedCookName: item.assignedCookName,
      resolvedCookName: item.resolvedCookName,
    };

    // Edit-Source auf manualEdit/manualAdd mappen
    if (item.editSource === "manual_edit") {
      material.manualEdit = true;
    } else if (item.editSource === "manual_add") {
      material.manualAdd = true;
    }

    return material;
  });
}

/* =====================================================================
// Legacy → Supabase: MaterialListMaterial[] → InsertRows
// ===================================================================== */

/**
 * Leitet die edit_source aus einem Legacy-MaterialListMaterial ab.
 *
 * @param item - Das Legacy-MaterialListMaterial
 * @returns Die edit_source für die Supabase-Zeile
 */
export function deriveEditSource(
  item: MaterialListMaterial,
): "generated" | "manual_add" | "manual_edit" {
  if (item.manualAdd) return "manual_add";
  if (item.manualEdit) return "manual_edit";
  return "generated";
}

/**
 * Konvertiert Legacy-MaterialListMaterial-Objekte in Supabase-InsertRows.
 *
 * Iteriert über alle Items und erzeugt die entsprechenden
 * Insert-Zeilen mit aufgelösten IDs. Bekannte Materialien werden
 * über die materials-Liste identifiziert (nicht über UID-Länge).
 *
 * @param items - Die Legacy-MaterialListMaterial-Objekte
 * @param listId - Die Listen-ID für die Supabase-Zuordnung
 * @param materials - Alle bekannten Materialien (für UID-Erkennung)
 * @returns Array von MaterialListItemInsertRow für Supabase
 */
export function materialListItemsToInsertRows(
  items: MaterialListMaterial[],
  listId: string,
  materials: Material[],
): MaterialListItemInsertRow[] {
  // Lookup-Set für schnelle Prüfung ob eine UID ein bekanntes Material ist
  const knownMaterialUids = new Set(materials.map((material) => material.uid));

  const rows: MaterialListItemInsertRow[] = [];
  let sortOrder = 0;

  items.forEach((item) => {
    // Leere Platzhalter-Items (vom Edit-Modus) überspringen
    if (item.quantity === 0 && !item.name) {
      return;
    }

    const row: MaterialListItemInsertRow = {
      list_id: listId,
      quantity: item.quantity,
      checked: item.checked,
      edit_source: deriveEditSource(item),
      sort_order: sortOrder++,
    };

    // Bekanntes Material vs. Freitext: Prüfung über Stammdaten-Lookup
    if (item.uid && knownMaterialUids.has(item.uid)) {
      row.material_id = item.uid;
    } else {
      row.free_text_name = item.name;
    }

    // Koch-Zuordnung übernehmen
    if (item.assignedCookId) {
      row.assigned_cook_id = item.assignedCookId;
    } else if (item.assignedCookName) {
      row.assigned_cook_name = item.assignedCookName;
    }

    rows.push(row);
  });

  return rows;
}
