/**
 * Gemeinsame Konstanten, Enums, Interfaces und Hilfsfunktionen für den Menüplan.
 *
 * Enthält alles, was von mehreren Menüplan-Dateien (UI-Komponenten, Hooks, Dialoge)
 * gemeinsam genutzt wird, aber keine React-Komponenten darstellt.
 */
import React from "react";

import {
  MealType,
  Menue,
  Meal,
  PortionPlan,
  Note,
  MenueListOrderTypes,
  PlanedDiet,
  PlanedIntolerances,
} from "./menuplan.types";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import Action from "../../../constants/actions";
import {
  ALL as TEXT_ALL,
  PORTIONS as TEXT_PORTIONS,
  PORTION as TEXT_PORTION,
} from "../../../constants/text";

/* ===================================================================
// ============================== Enums ==============================
// =================================================================== */

/**
 * Einstellungen für die Menüplan-Ansicht.
 *
 * @param showDetails - Ob Details (Portionen, etc.) angezeigt werden
 * @param enableDragAndDrop - Ob Drag & Drop aktiviert ist
 */
export interface MenuplanSettings {
  showDetails: boolean;
  enableDragAndDrop: boolean;
}

/**
 * Drag-&-Drop-Typen im Menüplan — bestimmt, welche Art von Objekt
 * gezogen wird.
 */
export enum MenuplanDragDropTypes {
  MEALTYPE = "MEALTYPE",
  MENU = "MENU",
  MEALRECIPE = "RECIPE",
  PRODUCT = "PRODUCT",
  MATERIAL = "MATERIAL",
}

/**
 * Typen von Objekten innerhalb eines Menüs, die bearbeitet werden können.
 */
export enum MenueEditTypes {
  NOTE = "NOTE",
  MEALRECIPE = "MEALRECIPE",
  PRODUCT = "PRODUCT",
  MATERIAL = "MATERIAL",
}

/**
 * Attribut-Name für das Blockieren von Board-Panning.
 * Wird auf interaktive Elemente gesetzt, die Panning verhindern sollen.
 */
export const blockBoardPanningAttr = "data-block-board-panning" as const;

/**
 * Richtungen für Drag-&-Drop-Verschiebungen via Kontextmenü.
 */
export type DragAndDropDirections = "up" | "down" | "inOtherMenu";

/**
 * Befehl zum Verschieben eines Drag-&-Drop-Elements.
 *
 * @param kind - Typ des verschobenen Elements
 * @param direction - Richtung der Verschiebung
 * @param menueUid - UID des Menüs (bei Rezepten, Produkten, Materialien)
 * @param mealUid - UID der Mahlzeit (bei Menü-Verschiebungen)
 * @param itemUid - UID des verschobenen Elements
 */
export interface DragAndDropMoveCommand {
  kind: MenuplanDragDropTypes;
  direction: DragAndDropDirections;
  menueUid?: Menue["uid"];
  mealUid?: Meal["uid"];
  itemUid: string;
}

/**
 * Callback-Typ für das Verschieben eines DnD-Elements via Kontextmenü.
 */
export type OnMoveDragAndDropElementFx = (cmd: DragAndDropMoveCommand) => void;

/**
 * Update-Event für eine Notiz im Menüplan.
 *
 * @param action - Art der Aktion (ADD, EDIT, DELETE)
 * @param note - Die betroffene Notiz
 */
export interface OnNoteUpdate {
  action: Action;
  note: Note;
}

/**
 * Update-Event für einen Mahlzeitentyp.
 *
 * @param action - Art der Aktion (ADD, EDIT, DELETE)
 * @param mealType - Der betroffene Mahlzeitentyp
 */
export interface OnMealTypeUpdate {
  action: Action;
  mealType: MealType;
}

/**
 * Manipulation eines Objekts im Menü-Bearbeitungs-Dialog.
 *
 * @param objectType - Typ des Objekts
 * @param uid - UID des Objekts
 */
export interface EditMenueObjectManipulation {
  objectType: MenueEditTypes;
  uid: string;
}

/**
 * Objekt, das geplant wird (Rezept oder Material/Produkt).
 */
export enum PlanedObject {
  RECIPE,
  GOOD,
}

/* ===================================================================
// ========================= Hilfsfunktionen =========================
// =================================================================== */

/**
 * Gibt den Order-Listen-Namen für den gegebenen DnD-Typ zurück.
 *
 * @param dragAndDropType - Der DnD-Typ
 * @returns Der entsprechende Order-Listen-Name aus MenueListOrderTypes
 */
export const getOrderListNameFromDragAndDropTypes = (
  dragAndDropType: MenuplanDragDropTypes,
) => {
  switch (dragAndDropType) {
    case MenuplanDragDropTypes.MEALRECIPE:
      return MenueListOrderTypes.mealRecipeOrder;
    case MenuplanDragDropTypes.MATERIAL:
      return MenueListOrderTypes.materialOrder;
    case MenuplanDragDropTypes.PRODUCT:
      return MenueListOrderTypes.productOrder;
    case MenuplanDragDropTypes.MEALTYPE:
      return MenueListOrderTypes.mealTypeOrder;
    case MenuplanDragDropTypes.MENU:
      return MenueListOrderTypes.menuOrder;
  }
};

/* ===================================================================
// ==================== Portionen-Text-Generierung ===================
// =================================================================== */

/**
 * Props für die Generierung des Portionsplan-Textes.
 *
 * @param uid - UID des Objekts (für React-Keys)
 * @param portionPlan - Portionsplan-Zeilen
 * @param groupConfiguration - Gruppen-Konfiguration des Events
 */
export interface GeneratePlanedPortionsTextProps {
  uid: string;
  portionPlan: PortionPlan[];
  groupConfiguration: EventGroupConfiguration;
}

/**
 * Generiert formatierten Text für die Portionsplan-Anzeige.
 * Zeigt Diät, Intoleranz, Faktor und Gesamtportionen pro Zeile an.
 *
 * @param props - UID, Portionsplan und Gruppen-Konfiguration
 * @returns Array von React-Fragmenten mit formatiertem Text
 */
export const generatePlanedPortionsText = ({
  uid,
  portionPlan,
  groupConfiguration,
}: GeneratePlanedPortionsTextProps) => {
  return portionPlan.map((plan, index) => (
    <React.Fragment key={"listItem" + uid + "_" + index}>
      {`${plan.factor != 1 ? `${plan.factor} × ` : ``} ${
        plan.diet == PlanedDiet.ALL
          ? TEXT_ALL
          : plan.diet == PlanedDiet.FIX
            ? ""
            : groupConfiguration.diets.entries[plan.diet].name
      }${
        plan.intolerance == PlanedIntolerances.ALL
          ? ""
          : plan.intolerance == PlanedIntolerances.FIX
            ? ""
            : `, ${
                groupConfiguration.intolerances.entries[plan.intolerance].name
              }`
      } (${plan.totalPortions.toFixed(1)} ${
        plan.totalPortions == 1 ? TEXT_PORTION : TEXT_PORTIONS
      })`}

      {index !== portionPlan.length - 1 && <br />}
      {/* Zeilenumbruch, außer beim letzten Element */}
    </React.Fragment>
  ));
};
