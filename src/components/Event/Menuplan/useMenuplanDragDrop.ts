/**
 * Custom Hook für die gesamte Drag-&-Drop-Logik des Menüplans.
 *
 * Kapselt alle DnD-Effekte (monitorForElements, autoScroll, Board-Panning)
 * sowie die Handler-Funktionen für Reihenfolgen-Updates und
 * Kontextmenü-Verschiebungen.
 */
import {useCallback, useEffect, useRef} from "react";
import invariant from "tiny-invariant";
import * as Sentry from "@sentry/react";
import {monitorForElements} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {extractClosestEdge} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {reorder} from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {reorderWithEdge} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import {autoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import {unsafeOverflowAutoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";
import {bindAll} from "bind-event-listener";
import type {CleanupFn} from "@atlaskit/pragmatic-drag-and-drop/types";

import {
  isMenueCardData,
  isDraggingAMenueCard,
  isMenueCardDropTargetData,
  isMenueCardContainerDropTargetData,
} from "./menuplan.menucard";
import {
  isCardListData,
  isCardListDropTargetData,
  isListContainerDropTargetData,
  isDraggingACardListItem,
} from "./menuplan.menucard.list";
import {isEmptyContainerData} from "./menuplan.emptycontainer";
import {Menue, Meal, MenuplanData} from "./menuplan.types";
import {
  MenuplanDragDropTypes,
  DragAndDropMoveCommand,
  OnMoveDragAndDropElementFx,
  blockBoardPanningAttr,
  getOrderListNameFromDragAndDropTypes,
} from "./menuplan.constants";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";
import RecipeShort from "../../Recipe/recipeShort.class";
import type {
  DialogSelectMenueData,
  DialogSelectMealData,
} from "./menuplan.page.types";


/**
 * Eingangsparameter für den useMenuplanDragDrop-Hook.
 *
 * @param menuplan - Aktueller Menüplan-Zustand
 * @param scrollableRef - Ref auf das scrollbare Board-Element
 * @param onMenuplanUpdateSuper - Callback zum Aktualisieren des Menüplans
 * @param setDialogSelectMenueData - Setter für den Menü-Auswahl-Dialog
 * @param setDialogSelectMealData - Setter für den Mahlzeit-Auswahl-Dialog
 */
interface UseMenuplanDragDropParams {
  menuplan: MenuplanData;
  scrollableRef: React.RefObject<HTMLDivElement>;
  onMenuplanUpdateSuper: (menuplan: MenuplanData) => void;
  setDialogSelectMenueData: React.Dispatch<
    React.SetStateAction<DialogSelectMenueData>
  >;
  setDialogSelectMealData: React.Dispatch<
    React.SetStateAction<DialogSelectMealData>
  >;
}

/**
 * Rückgabewerte des useMenuplanDragDrop-Hooks.
 *
 * @param onDragAndDropUpdate - Handler für Reihenfolgen-Updates (z.B. MealType-Order)
 * @param onMoveDragAndDropElement - Handler für Kontextmenü-Verschiebungen
 */
interface UseMenuplanDragDropReturn {
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropListType: MenuplanDragDropTypes,
  ) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}


/**
 * Kapselt die gesamte Drag-&-Drop-Logik für den Menüplan.
 *
 * Registriert useEffects für:
 * - monitorForElements (CardListItems und MenueCards)
 * - autoScrollForElements und unsafeOverflowAutoScrollForElements
 * - Board-Panning (horizontales Scrollen via Pointer-Events)
 *
 * Stellt Handler bereit für:
 * - onDragAndDropUpdate: Reihenfolge einer Order-Liste aktualisieren
 * - onMoveDragAndDropElement: Element via Kontextmenü verschieben
 *
 * @param params - Hook-Parameter (Menuplan, Refs, Callbacks)
 * @returns Handler-Funktionen für DnD-Updates
 *
 * @example
 * const { onDragAndDropUpdate, onMoveDragAndDropElement } = useMenuplanDragDrop({
 *   menuplan,
 *   scrollableRef,
 *   onMenuplanUpdateSuper,
 *   setDialogSelectMenueData,
 *   setDialogSelectMealData,
 * });
 */
export const useMenuplanDragDrop = ({
  menuplan,
  scrollableRef,
  onMenuplanUpdateSuper,
  setDialogSelectMenueData,
  setDialogSelectMealData,
}: UseMenuplanDragDropParams): UseMenuplanDragDropReturn => {
  // Ref für stabile Zugriffe in DnD-Callbacks (verhindert unnötige useEffect-Neuregistrierung)
  const menuplanRef = useRef(menuplan);
  menuplanRef.current = menuplan;

  // Ref für potenziell instabile Callbacks — ermöglicht stabile useCallback-Referenzen
  const callbacksRef = useRef({onMenuplanUpdateSuper});
  callbacksRef.current = {onMenuplanUpdateSuper};

  /* ------------------------------------------
  // Drag & Drop Handling — monitorForElements + autoScroll
  // ------------------------------------------ */
  useEffect(() => {
    const element = scrollableRef.current;

    invariant(element);
    return combine(
      monitorForElements({
        canMonitor: isDraggingACardListItem,
        onDrop({source, location}) {
          const dragging = source.data;
          if (!isCardListData(dragging)) {
            return;
          }
          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }

          // Herausfinden wo zu Hause
          const homeMenue: Menue | undefined =
            menuplanRef.current.menues[dragging.menueUid];
          if (!homeMenue) {
            return;
          }

          // In welcher Liste befindet sich das Objekt?
          const homeOrderList = (() => {
            switch (dragging.itemType) {
              case MenuplanDragDropTypes.MEALRECIPE:
                return homeMenue.mealRecipeOrder;
              case MenuplanDragDropTypes.MATERIAL:
                return homeMenue.materialOrder;
              case MenuplanDragDropTypes.PRODUCT:
                return homeMenue.productOrder;
            }
          })();

          const orderListName = getOrderListNameFromDragAndDropTypes(
            dragging.itemType,
          );

          if (
            orderListName !== "mealRecipeOrder" &&
            orderListName !== "materialOrder" &&
            orderListName !== "productOrder"
          ) {
            return;
          }

          if (!homeOrderList || !orderListName) {
            return;
          }
          const homeListItemIndex = homeOrderList.findIndex(
            (listItemUid) => listItemUid == dragging.listItem.id,
          );

          // Drop auf eine Liste
          const dropTargetData = innerMost.data;
          if (isCardListDropTargetData(dropTargetData)) {
            const destinationMenue: Menue | undefined =
              menuplanRef.current.menues[dropTargetData.menueUid];
            if (!destinationMenue) {
              return;
            }
            // unable to find destination
            if (!destinationMenue) {
              Sentry.addBreadcrumb({category: "menuplan.dnd", message: "Drag & Drop kein Ziel gefunden"});
              return;
            }

            // reordering in home column
            if (homeMenue === destinationMenue) {
              const destinationListItemIndex = homeOrderList.findIndex(
                (listItemUid) => listItemUid === dropTargetData.listItem.id,
              );
              // could not find cards needed
              if (homeListItemIndex === -1 || destinationListItemIndex === -1) {
                return;
              }
              // no change needed
              if (homeListItemIndex === destinationListItemIndex) {
                return;
              }
              const closestEdge = extractClosestEdge(dropTargetData);
              const reorderedList = reorderWithEdge({
                axis: "vertical",
                list: homeOrderList,
                startIndex: homeListItemIndex,
                indexOfTarget: destinationListItemIndex,
                closestEdgeOfTarget: closestEdge,
              });
              callbacksRef.current.onMenuplanUpdateSuper({
                ...menuplanRef.current,
                menues: {
                  ...menuplanRef.current.menues,
                  [dragging.menueUid]: {
                    ...homeMenue,
                    [orderListName]: reorderedList,
                  },
                },
              });
              return;
            }
            // In welcher Liste befindet sich das Objekt?
            const destinationOrderList = (() => {
              switch (dragging.itemType) {
                case MenuplanDragDropTypes.MEALRECIPE:
                  return destinationMenue.mealRecipeOrder;
                case MenuplanDragDropTypes.MATERIAL:
                  return destinationMenue.materialOrder;
                case MenuplanDragDropTypes.PRODUCT:
                  return destinationMenue.productOrder;
              }
            })();

            if (!destinationOrderList) {
              return;
            }

            const destinationListItemIndex = destinationOrderList.findIndex(
              (listItemUid) => listItemUid == dropTargetData.listItem.id,
            );

            const closestEdge = extractClosestEdge(dropTargetData);
            const finalIndex =
              closestEdge === "bottom"
                ? destinationListItemIndex + 1
                : destinationListItemIndex;

            // remove card from home list
            const homeReorderedList = [...homeOrderList];
            homeReorderedList.splice(homeListItemIndex, 1);
            // insert into destination list
            const destinationReorderedList = [...destinationOrderList];
            destinationReorderedList.splice(
              finalIndex,
              0,
              dragging.listItem.id,
            );

            callbacksRef.current.onMenuplanUpdateSuper({
              ...menuplanRef.current,
              menues: {
                ...menuplanRef.current.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }

          // Drop auf eine Karte (aber nicht Liste)
          if (isMenueCardData(dropTargetData)) {
            const destinationMenue =
              menuplanRef.current.menues[dropTargetData.listItem.menue.uid];
            if (!destinationMenue) {
              return;
            }

            // Drop auf gleiches Menü
            if (homeMenue === destinationMenue) {
              // an letzte Stelle verschieben
              const reorderedList = reorder({
                list: homeMenue[orderListName],
                startIndex: homeListItemIndex,
                finishIndex: homeMenue[orderListName].length - 1,
              });

              callbacksRef.current.onMenuplanUpdateSuper({
                ...menuplanRef.current,
                menues: {
                  ...menuplanRef.current.menues,
                  [dragging.menueUid]: {
                    ...homeMenue,
                    [orderListName]: reorderedList,
                  },
                },
              });
              return;
            }

            // Aus Homeliste entfernen
            const homeReorderedList = homeOrderList;
            homeReorderedList.splice(homeListItemIndex, 1);

            // In Zielliste einfügen
            const destinationReorderedList = destinationMenue[orderListName];
            destinationReorderedList.splice(
              destinationReorderedList.length,
              0,
              dragging.listItem.id,
            );

            callbacksRef.current.onMenuplanUpdateSuper({
              ...menuplanRef.current,
              menues: {
                ...menuplanRef.current.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }
          // Drop auf leere Liste
          if (isListContainerDropTargetData(dropTargetData)) {
            const destinationMenue = menuplanRef.current.menues[dropTargetData.menueUid];

            if (!destinationMenue || !dropTargetData.isEmpty) {
              return;
            }

            // Element aus Home-Liste entfernen
            const homeReorderedList = homeOrderList;
            homeReorderedList.splice(homeListItemIndex, 1);

            // Element in leere Ziel-Liste einfügen
            const destinationReorderedList = [dragging.listItem.id];
            callbacksRef.current.onMenuplanUpdateSuper({
              ...menuplanRef.current,
              menues: {
                ...menuplanRef.current.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }
        },
      }),
      monitorForElements({
        canMonitor: isDraggingAMenueCard,
        onDrop({source, location}) {
          //  Menü-Card wurd verschoben

          const dragging = source.data;
          if (!isMenueCardData(dragging)) {
            return;
          }

          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }
          const dropTargetData = innerMost.data;

          // Drop auf leeren Container
          if (isEmptyContainerData(dropTargetData)) {
            const homeMeal = menuplanRef.current.meals[dragging.mealUid];
            const destinationMeal = menuplanRef.current.meals[dropTargetData.mealUid];

            if (!homeMeal || !destinationMeal) {
              return;
            }

            if (homeMeal.uid === destinationMeal.uid) {
              // Gleiche Mahlzeit - keine Änderung nötig
              return;
            }

            const homeMenuIndex = homeMeal.menuOrder.findIndex(
              (menuUid) => menuUid == dragging.listItem.menue.uid,
            );

            if (homeMenuIndex === -1) {
              return;
            }

            // Menü aus Home-Mahlzeit entfernen
            const homeReorderedList = [...homeMeal.menuOrder];
            homeReorderedList.splice(homeMenuIndex, 1);

            // In leere Ziel-Mahlzeit einfügen
            const destinationReorderedList = [dragging.listItem.menue.uid];

            callbacksRef.current.onMenuplanUpdateSuper({
              ...menuplanRef.current,
              meals: {
                ...menuplanRef.current.meals,
                [homeMeal.uid]: {
                  ...homeMeal,
                  menuOrder: homeReorderedList,
                },
                [destinationMeal.uid]: {
                  ...destinationMeal,
                  menuOrder: destinationReorderedList,
                },
              },
            });
            return;
          }

          if (
            !isMenueCardData(dropTargetData) &&
            !isMenueCardDropTargetData(dropTargetData) &&
            !isMenueCardContainerDropTargetData(dropTargetData)
          ) {
            return;
          }

          const homeMeal = menuplanRef.current.meals[dragging.mealUid];
          const destinationMeal = menuplanRef.current.meals[dropTargetData.mealUid];

          if (!homeMeal || !destinationMeal) {
            return;
          }

          const homeMenuIndex = homeMeal.menuOrder.findIndex(
            (menuUid) => menuUid == dragging.listItem.menue.uid,
          );
          let destinationMenuIndex = -1;
          if (!isMenueCardContainerDropTargetData(dropTargetData)) {
            destinationMenuIndex = destinationMeal.menuOrder.findIndex(
              (menuUid) => menuUid === dropTargetData.listItem.menue.uid,
            );
          } else {
            destinationMenuIndex = destinationMeal.menuOrder.length;
          }

          // could not find cards needed
          if (homeMenuIndex === -1 || destinationMenuIndex === -1) {
            return;
          }

          if (homeMeal.uid === destinationMeal.uid) {
            // Wird nur in der Position verschoben im gleich Meal
            const closestEdge = extractClosestEdge(dropTargetData);
            const reorderedList = reorderWithEdge({
              axis: "vertical",
              list: homeMeal.menuOrder,
              startIndex: homeMenuIndex,
              indexOfTarget: destinationMenuIndex,
              closestEdgeOfTarget: closestEdge,
            });

            callbacksRef.current.onMenuplanUpdateSuper({
              ...menuplanRef.current,
              meals: {
                ...menuplanRef.current.meals,
                [dragging.mealUid]: {
                  ...homeMeal,
                  menuOrder: reorderedList,
                },
              },
            });
            return;
          }

          const closestEdge = extractClosestEdge(dropTargetData);
          const finalIndex =
            closestEdge === "bottom"
              ? destinationMenuIndex + 1
              : destinationMenuIndex;

          // Menü aus Home-Mahlzeit entfernen
          const homeReorderedList = [...homeMeal.menuOrder];
          homeReorderedList.splice(homeMenuIndex, 1);
          // In Ziel Mahlzeit einfügen
          const destinationReorderedList = [...destinationMeal.menuOrder];
          destinationReorderedList.splice(
            finalIndex,
            0,
            dragging.listItem.menue.uid,
          );

          callbacksRef.current.onMenuplanUpdateSuper({
            ...menuplanRef.current,
            meals: {
              ...menuplanRef.current.meals,
              [homeMeal.uid]: {
                ...homeMeal,
                menuOrder: homeReorderedList,
              },
              [destinationMeal.uid]: {
                ...destinationMeal,
                menuOrder: destinationReorderedList,
              },
            },
          });
        },
      }),
      autoScrollForElements({
        canScroll({source}) {
          return (
            isDraggingACardListItem({source}) || isDraggingAMenueCard({source})
          );
        },
        element,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        canScroll({source}) {
          return (
            isDraggingACardListItem({source}) || isDraggingAMenueCard({source})
          );
        },
        getOverflow() {
          return {
            forLeftEdge: {top: 1000, left: 1000, bottom: 1000},
            forRightEdge: {top: 1000, right: 1000, bottom: 1000},
          };
        },
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------
  // Board-Panning — horizontales Scrollen via Pointer-Events
  // ------------------------------------------ */
  useEffect(() => {
    let cleanupActive: CleanupFn | null = null;
    const scrollable = scrollableRef.current;
    invariant(scrollable);

    function begin({startX}: {startX: number}) {
      let lastX = startX;

      const cleanupEvents = bindAll(
        window,
        [
          {
            type: "pointermove",
            listener(event) {
              const currentX = event.clientX;
              const diffX = lastX - currentX;

              lastX = currentX;
              scrollable?.scrollBy({left: diffX});
            },
          },
          // stop panning if we see any of these events
          ...(
            [
              "pointercancel",
              "pointerup",
              "pointerdown",
              "keydown",
              "resize",
              "click",
              "visibilitychange",
            ] as const
          ).map((eventName) => ({
            type: eventName,
            listener: () => cleanupEvents(),
          })),
        ],
        // need to make sure we are not after the "pointerdown" on the scrollable
        // Also this is helpful to make sure we always hear about events from this point
        {capture: true},
      );

      cleanupActive = cleanupEvents;
    }

    const cleanupStart = bindAll(scrollable, [
      {
        type: "pointerdown",
        listener(event) {
          if (!(event.target instanceof HTMLElement)) {
            return;
          }
          // ignore interactive elements
          if (event.target.closest(`[${blockBoardPanningAttr}]`)) {
            return;
          }

          begin({startX: event.clientX});
        },
      },
    ]);

    return function cleanupAll() {
      cleanupStart();
      cleanupActive?.();
    };
  }, []);

  /* ------------------------------------------
  // Drag & Drop Handler
  // ------------------------------------------ */

  /**
   * Aktualisiert die Reihenfolge einer Order-Liste im Menüplan
   * (z.B. MealType-Order nach Drag-&-Drop).
   *
   * @param newOrder - Neue Reihenfolge der UIDs
   * @param dragAndDropListType - Typ der DnD-Liste
   */
  const onDragAndDropUpdate = useCallback(
    (newOrder: string[], dragAndDropListType: MenuplanDragDropTypes) => {
      switch (dragAndDropListType) {
        case MenuplanDragDropTypes.MEALTYPE:
          callbacksRef.current.onMenuplanUpdateSuper({
            ...menuplanRef.current,
            mealTypes: {
              entries: menuplanRef.current.mealTypes.entries,
              order: newOrder,
            },
          });
          break;
      }
    },
    [],
  );

  /**
   * Verschiebt ein Element via Kontextmenü (hoch/runter/in anderes Menü).
   *
   * Bei Verschiebung in ein anderes Menü wird je nach Typ ein Auswahl-Dialog
   * geöffnet (Menü-Auswahl oder Mahlzeit-Auswahl).
   *
   * @param cmd - Befehl mit Kind, Richtung und UIDs
   */
  // Element mittels Kontextmenü ändern
  const onMoveDragAndDropElement = useCallback(
    ({
      kind,
      direction,
      menueUid,
      mealUid,
      itemUid,
    }: DragAndDropMoveCommand) => {
      if (direction === "inOtherMenu") {
        switch (kind) {
          case MenuplanDragDropTypes.MEALRECIPE:
          case MenuplanDragDropTypes.PRODUCT:
          case MenuplanDragDropTypes.MATERIAL:
            // Dialog anzeigen um das Element zu verschieben.
            if (!menueUid) {
              return;
            }
            setDialogSelectMenueData({
              open: true,
              menues: {
                [menueUid]: true,
              } as DialogSelectMenuesForRecipeDialogValues,
              selectedRecipe: {} as RecipeShort,
              singleSelection: true,
              caller: onMoveDragAndDropElement.name,
              dragAndDropHandler: {
                listElementUid: itemUid,
                menuUid: menueUid,
                dragAndDropListType: kind,
              },
            });
            break;
          case MenuplanDragDropTypes.MENU:
            if (!mealUid) {
              return;
            }

            setDialogSelectMealData({
              open: true,
              dragAndDropHandler: {menuUid: itemUid, mealUid: mealUid},
            });
        }
        return;
      }

      // In welcher Liste befindet sich das Objekt?
      const orderListName = getOrderListNameFromDragAndDropTypes(kind);
      if (!orderListName) {
        return;
      }

      if (
        (kind === MenuplanDragDropTypes.MEALRECIPE ||
          kind === MenuplanDragDropTypes.PRODUCT ||
          kind === MenuplanDragDropTypes.MATERIAL) &&
        !menueUid
      ) {
        return;
      } else if (kind === MenuplanDragDropTypes.MENU && !mealUid) {
        return;
      }

      const orderList = (() => {
        switch (kind) {
          case MenuplanDragDropTypes.MEALRECIPE:
            return menuplanRef.current.menues[menueUid!].mealRecipeOrder;
          case MenuplanDragDropTypes.PRODUCT:
            return menuplanRef.current.menues[menueUid!].productOrder;
          case MenuplanDragDropTypes.MATERIAL:
            return menuplanRef.current.menues[menueUid!].materialOrder;
          case MenuplanDragDropTypes.MEALTYPE:
            return menuplanRef.current.mealTypes.order;
          case MenuplanDragDropTypes.MENU:
            return menuplanRef.current.meals[mealUid!].menuOrder;
        }
      })();

      if (!orderList) {
        return;
      }

      const index = orderList.findIndex((item) => item === itemUid);
      if (index === -1) {
        return;
      }

      const targetIndex = direction === "up" ? index - 1 : index + 1;

      const reorderedList = [...orderList];
      [reorderedList[index], reorderedList[targetIndex]] = [
        reorderedList[targetIndex],
        reorderedList[index],
      ];

      switch (kind) {
        case MenuplanDragDropTypes.MEALRECIPE:
        case MenuplanDragDropTypes.PRODUCT:
        case MenuplanDragDropTypes.MATERIAL:
          callbacksRef.current.onMenuplanUpdateSuper({
            ...menuplanRef.current,
            menues: {
              ...menuplanRef.current.menues,
              [menueUid!]: {
                ...menuplanRef.current.menues[menueUid!],
                [orderListName]: reorderedList,
              },
            },
          });
          break;
        case MenuplanDragDropTypes.MEALTYPE:
          callbacksRef.current.onMenuplanUpdateSuper({
            ...menuplanRef.current,
            mealTypes: {
              entries: menuplanRef.current.mealTypes.entries,
              order: reorderedList,
            },
          });
          break;
        case MenuplanDragDropTypes.MENU:
          callbacksRef.current.onMenuplanUpdateSuper({
            ...menuplanRef.current,
            meals: {
              ...menuplanRef.current.meals,
              [mealUid!]: {
                ...menuplanRef.current.meals[mealUid!],
                menuOrder: reorderedList,
              },
            },
          });
          break;
      }
    },
    [],
  );

  return {onDragAndDropUpdate, onMoveDragAndDropElement};
};
