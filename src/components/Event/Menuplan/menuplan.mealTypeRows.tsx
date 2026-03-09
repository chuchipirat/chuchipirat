/**
 * Komponenten für die Darstellung der Mahlzeit-Typ-Reihen im Menüplan.
 *
 * `MealTypeRows` rendert alle Mahlzeit-Typen (z.B. Frühstück, Mittagessen)
 * als Zeilen und stellt den Drag-&-Drop-Kontext bereit.
 * `MealTypeRow` rendert eine einzelne Zeile mit der Mahlzeit-Typ-Karte
 * und den Datumsspalten mit den jeweiligen Menüs.
 */
import React, {useState, useEffect, useMemo, useCallback, useRef} from "react";

import {Box, Container, useTheme} from "@mui/material";

import {
  DraggableState,
  idleState,
  draggingState,
  ListContextValue,
  LastCardMoved,
} from "../../../constants/dragAndDrop";
import invariant from "tiny-invariant";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {reorder} from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {getReorderDestinationIndex} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import {triggerPostMoveFlash} from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import {DropIndicator} from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import mergeRefs from "@atlaskit/ds-lib/merge-refs";

import useCustomStyles from "../../../constants/styles";
import {
  NEW_MENU as TEXT_NEW_MENU,
  DELETE as TEXT_DELETE,
  ATTENTION as TEXT_ATTENTION,
  ALL_RECIPES_AND_VALUES_WILL_BE_DELETED as TEXT_ALL_RECIPES_AND_VALUES_WILL_BE_DELETED,
} from "../../../constants/text";
import Utils from "../../Shared/utils.class";
import {
  MealType,
  Meal,
  Menue,
  Note,
  MealRecipe,
  MealRecipes,
  MenuplanProduct,
  MenuplanMaterial,
  Products,
  Materials,
  MenuplanData,
} from "./menuplan.types";
import {createMenu} from "./menuplanService";
import {
  MenuplanSettings,
  MenuplanDragDropTypes,
  OnMoveDragAndDropElementFx,
  OnNoteUpdate,
  OnMealTypeUpdate,
} from "./menuplan.constants";
import type {OnMenuplanUpdate} from "./menuplan.page.types";
import {
  MealTypesRowContext,
  useMealTypeRowContext,
  getItemData,
  isItemData,
  getItemRegistry,
} from "./menuplan.dragdrop";
import type {ItemData} from "./menuplan.dragdrop";
import {MenueListOfMeal} from "./menuplan.menucard";
import {EmptyMealContainer} from "./menuplan.emptycontainer";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import MealTypeCard from "./menuplan.mealTypeCard";

/* ===================================================================
// ========================= Mahlzeit-Reihen =========================
// =================================================================== */
/**
 * Props für die MealTypeRows-Komponente.
 */
interface MealTypeRowsProps {
  mealTypes: MenuplanData["mealTypes"];
  dates: MenuplanData["dates"];
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  notes: MenuplanData["notes"];
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  mealRecipes: MenuplanData["mealRecipes"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMenuplanUpdate: (updatedValues: OnMenuplanUpdate) => void;
  onAddRecipe: (menue: Menue) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onEditProductPlan: (uid: MenuplanProduct["uid"]) => void;
  onEditMaterialPlan: (uid: MenuplanMaterial["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropList: MenuplanDragDropTypes,
  ) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
/**
 * Rendert alle Mahlzeit-Typ-Reihen im Menüplan und stellt den
 * Drag-&-Drop-Kontext (MealTypesRowContext) bereit.
 *
 * @param props - Siehe {@link MealTypeRowsProps}.
 */
const MealTypeRows = ({
  mealTypes,
  dates,
  meals,
  menues,
  notes,
  products,
  materials,
  mealRecipes,
  menuplanSettings,
  groupConfiguration,
  onMealTypeUpdate,
  onMenuplanUpdate,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onMealRecipeOpen,
  onEditProductPlan,
  onEditMaterialPlan,
  onNoteUpdate,
  onDragAndDropUpdate,
  onMoveDragAndDropElement,
}: MealTypeRowsProps) => {
  /* ------------------------------------------
  // Drag & Drop Handling
  // ------------------------------------------ */
  const [registry] = useState(getItemRegistry);
  const [lastCardMoved, setLasCardMoved] =
    useState<LastCardMoved<MealType>>(null);

  // Isolated instances of this component from one another
  const [instanceId] = useState(() => Symbol("instance-id"));
  const reorderItem = useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget,
    }: {
      startIndex: number;
      indexOfTarget: number;
      closestEdgeOfTarget: Edge | null;
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        // Keine Änderung, Kein Update
        return;
      }

      const itemKey = mealTypes.order[startIndex];
      const item = mealTypes.entries[itemKey];

      onDragAndDropUpdate(
        reorder({
          list: mealTypes.order,
          startIndex,
          finishIndex,
        }),
        MenuplanDragDropTypes.MEALTYPE,
      );
      setLasCardMoved({
        item,
        previousIndex: startIndex,
        currentIndex: finishIndex,
        numberOfItems: mealTypes.order.length,
      });
    },
    [mealTypes],
  );

  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }
    return monitorForElements({
      canMonitor({source}) {
        return isItemData(source.data) && source.data.instanceId === instanceId;
      },
      onDrop({location, source}) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return;
        }

        const indexOfTarget = mealTypes.order.findIndex(
          (itemUiId) => itemUiId === (targetData.item as MealType).uid,
        );
        if (indexOfTarget < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);
        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget,
        });
      },
    });
  }, [instanceId, mealTypes.order, reorderItem]);

  // Drag beendet, Abschlussarbeiten
  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }

    if (lastCardMoved === null) {
      return;
    }
    const {item} = lastCardMoved;
    const element = registry.getElement(item.uid);
    if (element) {
      triggerPostMoveFlash(element);
    }
  }, [lastCardMoved, registry]);

  const getListLength = useCallback(
    () => mealTypes.order.length,
    [mealTypes.order.length],
  );

  const contextValue: ListContextValue = useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength,
    };
  }, [registry.register, reorderItem, instanceId, getListLength]);

  return (
    <MealTypesRowContext.Provider value={contextValue}>
      {mealTypes.order.map((mealTypeUid, index) => (
        <MealTypeRow
          key={"mealTypeRow_" + mealTypeUid}
          index={index}
          isLastElement={index === mealTypes.order.length - 1}
          mealType={mealTypes.entries[mealTypeUid]}
          dates={dates}
          meals={meals}
          menues={menues}
          notes={notes}
          products={products}
          materials={materials}
          mealRecipes={mealRecipes}
          menuplanSettings={menuplanSettings}
          groupConfiguration={groupConfiguration}
          mealTypes={mealTypes}
          onMealTypeUpdate={onMealTypeUpdate}
          onMenuplanUpdate={onMenuplanUpdate}
          onAddRecipe={onAddRecipe}
          onAddProduct={onAddProduct}
          onAddMaterial={onAddMaterial}
          onEditMenue={onEditMenue}
          onMealRecipeOpen={onMealRecipeOpen}
          onMealProductOpen={onEditProductPlan}
          onMealMaterialOpen={onEditMaterialPlan}
          onNoteUpdate={onNoteUpdate}
          onMoveDragAndDropElement={onMoveDragAndDropElement}
        />
      ))}
    </MealTypesRowContext.Provider>
  );
};

/* ===================================================================
// ========================== Mahlzeit-Reihe =========================
// =================================================================== */
/**
 * Props für die MealTypeRow-Komponente.
 */
interface MealTypeRowProps {
  index: number;
  isLastElement: boolean;
  mealType: MealType;
  dates: MenuplanData["dates"];
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  notes: MenuplanData["notes"];
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  mealRecipes: MenuplanData["mealRecipes"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  mealTypes: MenuplanData["mealTypes"];
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMenuplanUpdate: (updatedValues: OnMenuplanUpdate) => void;
  onAddRecipe: (menue: Menue) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onMealProductOpen: (uid: MenuplanProduct["uid"]) => void;
  onMealMaterialOpen: (uid: MenuplanMaterial["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
/**
 * Rendert eine einzelne Mahlzeit-Typ-Reihe mit der MealTypeCard und
 * den Datumsspalten, in denen die Menüs angezeigt werden.
 * Enthält die Drag-&-Drop-Logik für das Verschieben von Mahlzeit-Typen.
 *
 * @param props - Siehe {@link MealTypeRowProps}.
 */
const MealTypeRow = ({
  index,
  isLastElement,
  mealType,
  dates,
  meals,
  menues,
  notes,
  products,
  materials,
  mealRecipes,
  menuplanSettings,
  groupConfiguration,
  mealTypes,
  onMealTypeUpdate,
  onMenuplanUpdate,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onMealRecipeOpen,
  onMealProductOpen,
  onMealMaterialOpen,
  onNoteUpdate,
  onMoveDragAndDropElement,
}: MealTypeRowProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  /* ------------------------------------------
  // Drag & Drop
  // ------------------------------------------ */
  const {registerItem, instanceId} = useMealTypeRowContext();

  const mealRowRef = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  // **const scrollableRef = useRef<HTMLDivElement | null>(null);
  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }

    const element = mealRowRef.current;
    const dragHandle = dragHandleRef.current;
    invariant(element);
    invariant(dragHandle);

    // Instance-ID (Liste in dem das Drag & drop Stattfindet)
    const data = getItemData({item: mealType, index, instanceId});

    return combine(
      registerItem({itemUiId: mealType.uid, element}),
      draggable({
        element: dragHandle,
        getInitialData: () => data,

        onDragStart() {
          setDraggableState(draggingState);
        },
        onDrop() {
          setDraggableState(idleState);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({source}) {
          return (
            isItemData<MealType>(source.data) &&
            source.data.instanceId === instanceId
          );
        },
        getData({input}) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDrag({self, source}) {
          const isSource = source.element === element;
          if (isSource) {
            setClosestEdge(null);
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          const sourceIndex = source.data.index;
          invariant(typeof sourceIndex === "number");

          const isItemBeforeSource = index === sourceIndex - 1;
          const isItemAfterSource = index === sourceIndex + 1;

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top");

          if (isDropIndicatorHidden) {
            setClosestEdge(null);
            return;
          }

          setClosestEdge(closestEdge);
          setDraggableState(draggingState);
        },
        onDragLeave() {
          setClosestEdge(null);
          setDraggableState(idleState);
        },
        onDrop() {
          setClosestEdge(null);
          setDraggableState(idleState);
        },
      }),
    );
  }, [
    instanceId,
    mealType,
    index,
    registerItem,
    menuplanSettings.enableDragAndDrop,
  ]);
  /* ------------------------------------------
  // Menü-Handling
  // ------------------------------------------ */
  const onCreateMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const newMenu = createMenu();
    const mealsToUpdate = {...meals};
    const mealToUpdate = Object.values(mealsToUpdate).find(
      (meal) => meal.uid == event.currentTarget.id.split("_")[1],
    );
    const menuesToUpdate = {...menues};

    if (!mealToUpdate || !menuesToUpdate) {
      return;
    }
    mealToUpdate.menuOrder.push(newMenu.uid);
    menuesToUpdate[newMenu.uid] = newMenu;

    onMenuplanUpdate({
      meals: {...meals, [mealToUpdate.uid]: mealToUpdate},
      menues: menuesToUpdate,
    });
  };
  const onUpdateMenue = (menue: Menue) => {
    onMenuplanUpdate({
      menues: {...menues, [menue.uid]: menue},
    });
  };
  const onDeleteMenue = async (menueUid: Menue["uid"]) => {
    // Alle Rezepte, Produkte, Materialien entfernen,
    // die in diesem Menü sind

    // Falls das Menue leer ist, braucht es keine Bestätigung
    if (
      menues[menueUid].mealRecipeOrder.length != 0 ||
      menues[menueUid].productOrder.length != 0 ||
      menues[menueUid].materialOrder.length != 0
    ) {
      const isConfirmed = await customDialog({
        dialogType: DialogType.Confirm,
        text: TEXT_ALL_RECIPES_AND_VALUES_WILL_BE_DELETED,
        title: `⚠️  ${TEXT_ATTENTION}`,
        buttonTextConfirm: TEXT_DELETE,
      });
      if (!isConfirmed) {
        return;
      }
    }

    const updatedMealRecipes = {...mealRecipes};
    const updatedMenues = {...menues};
    const updatedMeals = {...meals};
    const updateProducts = {...products};
    const updateMaterials = {...materials};
    const updatedNotes = {...notes};

    menues[menueUid].mealRecipeOrder.forEach(
      (recipeUid) => delete updatedMealRecipes[recipeUid],
    );
    menues[menueUid].productOrder.forEach(
      (productUid) => delete updateProducts[productUid],
    );
    menues[menueUid].materialOrder.forEach(
      (materialUid) => delete updateMaterials[materialUid],
    );
    delete updatedMenues[menueUid];

    // Notizen entfernen, die dem gelöschten Menü zugeordnet sind
    Object.keys(updatedNotes).forEach((noteUid) => {
      if (updatedNotes[noteUid].menueUid === menueUid) {
        delete updatedNotes[noteUid];
      }
    });

    Object.values(updatedMeals).forEach((meal) => {
      if (meal.menuOrder.includes(menueUid)) {
        meal.menuOrder = meal.menuOrder.filter(
          (mealMenuUid) => mealMenuUid != menueUid,
        );
      }
    });

    onMenuplanUpdate({
      menues: updatedMenues,
      mealRecipes: updatedMealRecipes,
      meals: updatedMeals,
      products: updateProducts,
      materials: updateMaterials,
      notes: updatedNotes,
    });
  };
  return (
    <React.Fragment>
      {draggableState.type == "dragging" && closestEdge == "top" && (
        <Box
          component="div"
          className="custom-drop-indicator"
          style={{position: "relative", margin: theme.spacing(1)}}
        >
          <DropIndicator edge={closestEdge} />
        </Box>
      )}
      <Box
        component={"div"}
        ref={mergeRefs([mealRowRef, dragHandleRef])}
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "stretch",
        }}
      >
        <Container
          sx={classes.menuplanItem}
          style={{
            display: "flex",
            padding: theme.spacing(1),
            paddingBottom: theme.spacing(2),
          }}
        >
          <MealTypeCard
            mealType={mealType}
            index={index}
            isLastElement={isLastElement}
            onMealTypeUpdate={onMealTypeUpdate}
            onMoveDragAndDropElement={onMoveDragAndDropElement}
          />
        </Container>
        {dates.map((date) => {
          let actualMeal = {} as Meal;
          Object.values(meals).forEach((meal) => {
            if (
              meal.mealType == mealType.uid &&
              meal.date == Utils.dateAsString(date)
            ) {
              actualMeal = meal;
            }
          });
          return (
            <Container
              sx={classes.menuplanItem}
              style={{
                display: "flex",
                padding: theme.spacing(1),
                paddingBottom: theme.spacing(2),
                // height: "100%",
                flexDirection: "column",
              }}
              key={
                "mealCardContainer_" +
                Utils.dateAsString(date) +
                "_" +
                mealType.uid
              }
            >
              {actualMeal.menuOrder?.length > 0 ? (
                <MenueListOfMeal
                  meal={actualMeal}
                  menues={menues}
                  mealRecipes={mealRecipes}
                  products={products}
                  materials={materials}
                  notes={notes}
                  mealTypes={mealTypes}
                  menuplanSettings={menuplanSettings}
                  groupConfiguration={groupConfiguration}
                  onUpdateMenue={onUpdateMenue}
                  onAddRecipe={onAddRecipe}
                  onAddProduct={onAddProduct}
                  onAddMaterial={onAddMaterial}
                  onEditMenue={onEditMenue}
                  onDeleteMenue={onDeleteMenue}
                  onNoteUpdate={onNoteUpdate}
                  onMealRecipeOpen={onMealRecipeOpen}
                  onMealProductOpen={onMealProductOpen}
                  onMealMaterialOpen={onMealMaterialOpen}
                  onMoveDragAndDropElement={onMoveDragAndDropElement}
                />
              ) : (
                // Kein Menü vorhanden - MenuCard erstellen.....
                <EmptyMealContainer
                  mealUid={actualMeal.uid}
                  buttonText={TEXT_NEW_MENU}
                  onCreateMenu={(mealUid) => {
                    const event = {
                      currentTarget: {id: "onCreateMenu_" + mealUid},
                    } as React.MouseEvent<HTMLButtonElement>;
                    onCreateMenu(event);
                  }}
                />
              )}
              {/* {closestEdge && (
                <Box component="div" className="custom-drop-indicator">
                  <p>Hier bin ich</p>
                  <DropIndicator edge={closestEdge} gap="272px" />
                </Box>
              )} */}
            </Container>
          );
        })}
      </Box>
      {draggableState.type == "dragging" && closestEdge == "bottom" && (
        <Box
          component="div"
          className="custom-drop-indicator"
          style={{position: "relative", margin: theme.spacing(1)}}
        >
          <DropIndicator edge={closestEdge} />
        </Box>
      )}
    </React.Fragment>
  );
};

export default MealTypeRows;
export {MealTypeRow};
