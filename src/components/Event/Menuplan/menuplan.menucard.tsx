import React, {memo, useRef, useState, useEffect, useContext} from "react";

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  Button,
  ListItemIcon,
  Typography,
  useTheme,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ShoppingCart as ShoppingCartIcon,
  Build as BuildIcon,
  // Close as CloseIcon,
  // Info as InfoIcon,
  Notes as NotesIcon,
  DeleteSweep as DeleteSweepIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import {
  MENUE as TEXT_MENUE,
  ADD_RECIPE as TEXT_ADD_RECIPE,
  NOTE as TEXT_NOTE,
  EDIT as TEXT_EDIT,
  ADD as TEXT_ADD,
  DELETE as TEXT_DELETE,
  EDIT_MENUE as TEXT_EDIT_MENUE,
  ADD_PRODUCT as TEXT_ADD_PRODUCT,
  ADD_MATERIAL as TEXT_ADD_MATERIAL,
  DELETE_MENUE as TEXT_DELETE_MENUE,
  TOOLTIP_MOVE_UP as TEXT_TOOLTIP_MOVE_UP,
  TOOLTIP_MOVE_DOWN as TEXT_TOOLTIP_MOVE_DOWN,
  TOOLTIP_MOVE_OTHER_MEAL as TEXT_TOOLTIP_MOVE_OTHER_MEAL,
} from "../../../constants/text";

import {
  Meal,
  MealRecipe,
  MealRecipes,
  Menue,
  MenuplanMaterial,
  MenuplanProduct,
  Note,
  MenuplanData,
  // MenueListOrderTypes,
} from "./menuplan.types";
import {createEmptyNote} from "./menuplanService";
import {
  DragAndDropDirections,
  MenuplanDragDropTypes,
  MenuplanSettings,
  OnMoveDragAndDropElementFx,
  OnNoteUpdate,
} from "./menuplan";

import {
  type Edge,
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {createPortal} from "react-dom";
import useCustomStyles from "../../../constants/styles";

import invariant from "tiny-invariant";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {setCustomNativeDragPreview} from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {preserveOffsetOnSource} from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";

import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {HighlightedMenueContext} from "./highlightContext";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {
  MenueCardList,
  isDraggingACardListItem,
  getListContainerDropTargetData,
} from "./menuplan.menucard.list";
import Action from "../../../constants/actions";
import Utils from "../../Shared/utils.class";

/* ===================================================================
// ================== Global Defintion & Type Guards =================
// =================================================================== */

export type TMenueCard = {
  id: Menue["uid"];
  menue: Menue;
  mealUid: Meal["uid"];
  type: MenuplanDragDropTypes;
};

type TMenueCardState =
  | {
      type: "idle";
    }
  | {
      type: "is-dragging";
      // dragging: DOMRect;
    }
  | {
      type: "is-dragging-and-left-self";
    }
  | {
      type: "is-over";
      dragging: DOMRect;
      closestEdge: Edge;
    }
  | {
      type: "preview";
      container: HTMLElement;
      dragging: DOMRect;
    };
const menueCardKey = Symbol("menueCard");
export type TMenueCardData = {
  itemType: MenuplanDragDropTypes;
  [menueCardKey]: true;
  listItem: TMenueCard;
  rect: DOMRect;
  mealUid: Meal["uid"];
};
export function getMenueCardData({
  listItem,
  rect,
  mealUid,
}: Omit<TMenueCardData, typeof menueCardKey> & {
  mealUid: string;
}): TMenueCardData {
  return {
    [menueCardKey]: true,
    itemType: listItem.type,
    rect,
    listItem,
    mealUid,
  };
}
export function isMenueCardData(
  value: Record<string | symbol, unknown>,
): value is TMenueCardData {
  return Boolean(value[menueCardKey]);
}
export function isDraggingAMenueCard({
  source,
}: {
  source: {data: Record<string | symbol, unknown>};
}): boolean {
  return isMenueCardData(source.data);
}

export function isMenueCardType({
  source,
  cardType,
}: {
  source: {data: Record<string | symbol, unknown>};
  cardType: MenuplanDragDropTypes;
}): boolean {
  return source.data.itemType == cardType;
}
// type TMenueCardDropState =
//   | {
//       type: "idle";
//     }
//   | {
//       type: "is-dragging";
//       dragging: DOMRect;
//     }
//   | {
//       type: "is-over";
//     }
//   | {
//       type: "preview";
//       container: HTMLElement;
//       dragging: DOMRect;
//     };
const cardDropTargetKey = Symbol("card-list-drop-target");
export type TMenueCardDropTargetData = {
  [cardDropTargetKey]: true;
  listItem: TMenueCard;
  mealUid: Meal["uid"];
  rect: DOMRect;
};
export function isMenueCardDropTargetData(
  value: Record<string | symbol, unknown>,
): value is TMenueCardDropTargetData {
  return Boolean(value[cardDropTargetKey]);
}
export function getMenueCardDropTargetData({
  listItem,
  rect,
  mealUid,
}: Omit<TMenueCardDropTargetData, typeof cardDropTargetKey> & {
  mealUid: string;
}): TMenueCardDropTargetData {
  return {
    [cardDropTargetKey]: true,
    listItem,
    mealUid,
    rect,
  };
}

const menueCardContainerKey = Symbol("menuecard-container");
export type TMenueCardContainerDropTargetData = {
  [menueCardContainerKey]: true;
  mealUid: Meal["uid"];
  listType: MenuplanDragDropTypes;
  isEmpty: boolean;
};
export function getMenueCardContainerDropTargetData({
  mealUid,
  listType,
  isEmpty,
}: Omit<
  TMenueCardContainerDropTargetData,
  typeof menueCardContainerKey
>): TMenueCardContainerDropTargetData {
  return {
    [menueCardContainerKey]: true,
    mealUid,
    listType,
    isEmpty,
  };
}
export function isMenueCardContainerDropTargetData(
  value: Record<string | symbol, unknown>,
): value is TMenueCardContainerDropTargetData {
  return Boolean(value[menueCardContainerKey]);
}
export function isShallowEqual(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }
  return keys1.every((key1) => Object.is(obj1[key1], obj2[key1]));
}

/* ===================================================================
// ======================= Menüs einer Mahlzeit ======================
// =================================================================== */
interface MenueListOfMealProps {
  meal: Meal;
  menues: MenuplanData["menues"];
  mealRecipes: MealRecipes;
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  notes: MenuplanData["notes"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  mealTypes: MenuplanData["mealTypes"];
  onUpdateMenue: (menue: Menue) => void;
  onAddRecipe: (menue: Menue) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onDeleteMenue: (menueUid: Menue["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onMealProductOpen: (uid: MenuplanProduct["uid"]) => void;
  onMealMaterialOpen: (uid: MenuplanMaterial["uid"]) => void;

  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
// ===================================================================== */
/**
 * Liste aller Menüs in dieser Mahlzeit
 * A memoized component for rendering out the list.
 * Created so that state changes to the list don't require all lists to be rendered
 * @returns JSX
 */
export const MenueListOfMeal = memo(function MenueListOfMeal({
  meal,
  menues,
  mealRecipes,
  products,
  materials,
  notes,
  menuplanSettings,
  groupConfiguration,
  mealTypes,
  onUpdateMenue,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onDeleteMenue,
  onNoteUpdate,
  onMealRecipeOpen,
  onMealProductOpen,
  onMealMaterialOpen,
  onMoveDragAndDropElement,
}: MenueListOfMealProps) {
  const theme = useTheme();
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }

    const list = listRef.current;
    if (!list) return;

    return dropTargetForElements({
      element: list,
      canDrop: ({source}) =>
        Boolean(
          isDraggingAMenueCard({source}) &&
          isMenueCardType({
            source: source,
            cardType: MenuplanDragDropTypes.MENU,
          }),
        ),

      getData: () =>
        getMenueCardContainerDropTargetData({
          mealUid: meal.uid,
          listType: MenuplanDragDropTypes.MENU,
          isEmpty: meal.menuOrder.length === 0,
        }),
    });
  }, [meal.menuOrder]);

  return (
    <>
      <Box
        component={"div"}
        ref={listRef}
        style={{
          minHeight: theme.spacing(3),
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {meal.menuOrder.map((menueUid: Menue["uid"], index) => (
          <DraggableMenueCard
            key={menueUid}
            listItem={{
              id: menueUid,
              menue: menues[menueUid],
              mealUid: meal.uid,
              type: MenuplanDragDropTypes.MENU,
            }}
            index={index}
            isLastElement={index === meal.menuOrder.length - 1}
            listType={MenuplanDragDropTypes.MENU}
            meal={{
              ...meal,
              mealTypeName: mealTypes.entries[meal.mealType]?.name,
            }}
            notes={notes}
            mealRecipes={mealRecipes}
            products={products}
            materials={materials}
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
        ))}
      </Box>
    </>
  );
});
/* ===================================================================
// =============== Drag & Drop Menü-Card-Listeneintrag ===============
// =================================================================== */
interface DraggableMenueCardProps extends Omit<
  MenueCardProps,
  "menue" | "outerRef" | "innerRef" | "state"
> {
  // listItemKey: string;
  listType: MenuplanDragDropTypes;
  listItem: TMenueCard;
  meal: Meal;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
const menueCardStateIdle = {type: "idle"} satisfies TMenueCardState;
// ===================================================================== */
/**
 * Menü-Card List-Entry: Listeneingtrag der dich Dragen lässt
 * @returns JSX
 */
const DraggableMenueCard = ({
  listItem,
  listType,
  index,
  isLastElement,
  meal,
  notes,
  mealRecipes,
  products,
  materials,
  menuplanSettings,
  groupConfiguration,
  onUpdateMenue,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onDeleteMenue,
  onNoteUpdate,
  onMealRecipeOpen,
  onMealProductOpen,
  onMealMaterialOpen,
  onMoveDragAndDropElement,
}: DraggableMenueCardProps) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<TMenueCardState>(menueCardStateIdle);
  const theme = useTheme();
  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }
    const outer = outerRef.current;
    const inner = innerRef.current;
    invariant(outer && inner);

    return combine(
      draggable({
        element: inner,
        getInitialData: ({element}) =>
          getMenueCardData({
            listItem,
            mealUid: meal.uid,
            rect: element.getBoundingClientRect(),
            itemType: listItem.type,
          }),
        onGenerateDragPreview({nativeSetDragImage, location, source}) {
          const data = source.data;
          invariant(isMenueCardData(data));
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: inner,
              input: location.current.input,
            }),

            render({container}) {
              const rect = outer.getBoundingClientRect();
              const preview = outer.cloneNode(true);
              invariant(preview instanceof HTMLElement);
              preview.style.width = `${rect.width}px`;
              preview.style.height = `${rect.height}px`;
              preview.style.backgroundColor = theme.palette.background.paper;
              preview.style.borderRadius = theme.shape.borderRadius + "px";
              preview.style.opacity = "0.9";

              // rotation of native drag previews does not work in safari
              if (!Utils.isSafari()) {
                preview.style.transform = "rotate(4deg)";
              }

              container.appendChild(preview);
            },
          });
        },
        onDragStart() {
          setState({type: "is-dragging"});
        },
        onDrop() {
          setState(menueCardStateIdle);
        },
      }),
      dropTargetForElements({
        element: outer,
        getIsSticky: () => true,
        canDrop: ({source}) =>
          Boolean(
            isDraggingAMenueCard({source}) &&
            isMenueCardType({source: source, cardType: listType}),
          ),
        getData: ({element, input}) => {
          const data = getMenueCardDropTargetData({
            listItem,
            mealUid: meal.uid,
            rect: element.getBoundingClientRect(),
          });
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter({source, self}) {
          if (!isMenueCardData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItem.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }

          setState({type: "is-over", dragging: source.data.rect, closestEdge});
        },
        onDrag({source, self}) {
          if (!isMenueCardData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItem.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }
          // optimization - Don't update react state if we don't need to.
          const proposed: TMenueCardState = {
            type: "is-over",
            dragging: source.data.rect,
            closestEdge,
          };
          setState((current) => {
            if (isShallowEqual(proposed, current)) {
              return current;
            }
            return proposed;
          });
        },
        onDragLeave({source}) {
          if (!isMenueCardData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItem.id) {
            setState({type: "is-dragging-and-left-self"});
            return;
          }
          setState(menueCardStateIdle);
        },
        onDrop() {
          setState(menueCardStateIdle);
        },
      }),
      // Fallback-Drop-Target: Nimmt Produkte/Materialien entgegen,
      // wenn die jeweilige Liste leer (und daher nicht gerendert) ist.
      dropTargetForElements({
        element: inner,
        canDrop: ({source}) => {
          if (!isDraggingACardListItem({source})) return false;
          const itemType = source.data.itemType as MenuplanDragDropTypes;
          return (
            (itemType === MenuplanDragDropTypes.PRODUCT &&
              listItem.menue.productOrder.length === 0) ||
            (itemType === MenuplanDragDropTypes.MATERIAL &&
              listItem.menue.materialOrder.length === 0)
          );
        },
        getData: ({source}) =>
          getListContainerDropTargetData({
            menueUid: listItem.menue.uid,
            listType: source.data.itemType as MenuplanDragDropTypes,
            isEmpty: true,
          }),
      }),
    );
  }, [listItem, meal.uid]);

  return (
    <>
      <MenueCard
        outerRef={outerRef}
        innerRef={innerRef}
        state={state}
        menue={listItem.menue}
        index={index}
        isLastElement={isLastElement}
        meal={meal}
        notes={notes}
        mealRecipes={mealRecipes}
        products={products}
        materials={materials}
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
      {state.type === "preview"
        ? createPortal(
            <MenueCard
              state={state}
              menue={listItem.menue}
              index={index}
              isLastElement={isLastElement}
              meal={meal}
              notes={notes}
              mealRecipes={mealRecipes}
              products={products}
              materials={materials}
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
            />,

            state.container,
          )
        : null}
    </>
  );
};

/* ===================================================================
// ===================== Menü-Card-Listen-Eintrag ====================
// =================================================================== */
interface MenueCardProps {
  menue: Menue;
  meal: Meal;
  index: number;
  isLastElement: boolean;
  notes: MenuplanData["notes"];
  mealRecipes: MealRecipes;
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  state: TMenueCardState;
  outerRef?: React.MutableRefObject<HTMLDivElement | null>;
  innerRef?: React.MutableRefObject<HTMLDivElement | null>;
  onUpdateMenue: (menue: Menue) => void;
  onAddRecipe: (menue: Menue) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onDeleteMenue: (menueUid: Menue["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onMealProductOpen: (uid: MenuplanProduct["uid"]) => void;
  onMealMaterialOpen: (uid: MenuplanMaterial["uid"]) => void;

  onMoveDragAndDropElement?: OnMoveDragAndDropElementFx;
}
// ===================================================================== */
/**
 * Menü-Card List-Entry: Listeneingtrag für die Menü-Karte-Liste
 * @returns JSX
 */
const MenueCard = ({
  menue,
  index,
  isLastElement,
  meal,
  notes,
  mealRecipes,
  products,
  materials,
  menuplanSettings,
  groupConfiguration,
  state,
  outerRef,
  innerRef,
  onUpdateMenue,
  onAddRecipe: onAddRecipeSuper,
  onAddProduct: onAddProductSuper,
  onAddMaterial: onAddMaterialSuper,
  onEditMenue: onEditMenueSuper,
  onDeleteMenue: onDeleteMenueSuper,
  onNoteUpdate,
  onMealRecipeOpen,
  onMealProductOpen,
  onMealMaterialOpen,
  onMoveDragAndDropElement,
}: MenueCardProps) => {
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();
  const highlightedUids = useContext(HighlightedMenueContext);
  const isHighlighted = highlightedUids.has(menue.uid);

  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);
  const [menueName, setMenueName] = useState<Menue["name"]>(menue.name);
  const note = Object.values(notes).find((note) => note.menueUid == menue.uid);

  // Lokalen State mit Prop synchronisieren (z.B. bei Realtime-Updates anderer Benutzer)
  useEffect(() => {
    setMenueName(menue.name);
  }, [menue.name]);

  /* ------------------------------------------
  // Kontexmenü
  // ------------------------------------------ */
  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setContextMenuAnchorElement(event.currentTarget);
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
  };
  /* ------------------------------------------
    // Input-Handler
    // ------------------------------------------ */
  const onChangeMenueName = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.value == "") {
      // Wert gelöscht --> hochgeben
      onUpdateMenue({...menue, name: ""});
    }
    setMenueName(event.target.value);
  };
  const onMenueNameBlur = () => {
    // Name im Controller updaten, aber erst
    // wenn dieser fertig erfasst wurde
    onUpdateMenue({...menue, name: menueName});
  };
  const onAddRecipe = () => {
    // Drawer anzeigen
    onAddRecipeSuper(menue);
  };
  /* ------------------------------------------
  // Kontex-Menü-Handler
  // ------------------------------------------ */
  const onEditMenue = () => {
    if (contextMenuAnchorElement?.id) {
      onEditMenueSuper(contextMenuAnchorElement.id.split("_")[1]);
    }
    setContextMenuAnchorElement(null);
  };
  const onDeleteMenue = () => {
    if (contextMenuAnchorElement?.id) {
      onDeleteMenueSuper(contextMenuAnchorElement.id.split("_")[1]);
    }
  };
  const onAddProduct = () => {
    if (contextMenuAnchorElement?.id) {
      onAddProductSuper(contextMenuAnchorElement.id.split("_")[1]);
    }
    setContextMenuAnchorElement(null);
  };
  const onAddMaterial = () => {
    if (contextMenuAnchorElement?.id) {
      onAddMaterialSuper(contextMenuAnchorElement.id.split("_")[1]);
    }
    setContextMenuAnchorElement(null);
  };
  const onEditNote = async () => {
    let userInput = {valid: false, input: ""} as SingleTextInputResult;

    const existingNote = Object.values(notes).find(
      (note) => note.menueUid == menue.uid,
    );

    userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_NOTE} ${existingNote?.text ? TEXT_EDIT : TEXT_ADD}`,
      singleTextInputProperties: {
        initialValue: existingNote?.text ? existingNote?.text : "",
        textInputLabel: TEXT_NOTE,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      let note: Note;
      if (!existingNote?.text) {
        note = createEmptyNote();
      } else {
        note = existingNote;
      }
      note.text = userInput.input;
      note.menueUid = menue.uid;
      // Menü-Notizen erhalten das Datum der zugehörigen Mahlzeit
      note.date = meal.date;
      onNoteUpdate({
        action: existingNote?.text ? Action.EDIT : Action.ADD,
        note: note,
      });
    }
    setContextMenuAnchorElement(null);
  };
  const onMoveElement = (direction: DragAndDropDirections) => {
    if (contextMenuAnchorElement?.id && onMoveDragAndDropElement != undefined) {
      onMoveDragAndDropElement({
        kind: MenuplanDragDropTypes.MENU,
        direction: direction,
        mealUid: meal.uid,
        itemUid: contextMenuAnchorElement.id.split("_")[1],
      });
    }
    setContextMenuAnchorElement(null);
  };
  /* ------------------------------------------
  // On-List-Element-Click
  // ------------------------------------------ */
  return (
    <>
      {/* // Outerstyle */}
      <Box
        component="div"
        ref={outerRef}
        sx={{
          ...classes.menueCardDragBox[state.type],
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Put a shadow before the item if closer to the top edge */}
        {state.type === "is-over" && state.closestEdge === "top" ? (
          <MenueCardShadow dragging={state.dragging} />
        ) : null}
        {/* InnerStyle */}
        <Box
          component="div"
          ref={innerRef}
          sx={{
            ...(state.type === "preview"
              ? classes.menueCardListItemDrag.preview(state.dragging)
              : classes.menueCardListItemDrag[state.type]),
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Card
            sx={{
              ...classes.menuCard,
              ...classes.menueCardDrag[state.type],
              ...(state.type === "is-dragging" && {opacity: 0.4}),
              ...(isHighlighted && {
                "@keyframes remoteChangeGlow": {
                  "0%": {boxShadow: "0 0 8px 3px rgba(25, 118, 210, 0.5)"},
                  "100%": {boxShadow: "0 0 0 0 rgba(25, 118, 210, 0)"},
                },
                animation: "remoteChangeGlow 2s ease-out",
              }),
            }}
          >
            <CardHeader
              key={"menu_cardHeader_" + menue.uid}
              action={
                <IconButton
                  id={"MoreBtn_" + menue.uid}
                  aria-label="settings"
                  onClick={onContextMenuClick}
                  size="large"
                >
                  <MoreVertIcon />
                </IconButton>
              }
              title={
                <TextField
                  fullWidth
                  variant="standard"
                  value={menueName}
                  onChange={onChangeMenueName}
                  onBlur={onMenueNameBlur}
                  label={menueName ? TEXT_MENUE : meal.mealTypeName}
                />
              }
            />
            <CardContent>
              {note && (
                <Box>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    align="center"
                  >
                    <em>{note.text}</em>
                  </Typography>
                </Box>
              )}
              {/* Rezepte */}
              <MenueCardList
                menue={menue}
                mealRecipes={mealRecipes}
                products={products}
                listType={MenuplanDragDropTypes.MEALRECIPE}
                menuplanSettings={menuplanSettings}
                groupConfiguration={groupConfiguration}
                onListElementClick={onMealRecipeOpen}
                onMoveDragAndDropElement={onMoveDragAndDropElement!}
              />
              {/* Rezept hinzufügen */}
              <Box component={"div"} sx={classes.centerCenter}>
                <Button
                  onClick={onAddRecipe}
                  color="primary"
                  endIcon={<AddIcon />}
                >
                  {TEXT_ADD_RECIPE}
                </Button>
              </Box>
              {/* Produkte – nur anzeigen, wenn vorhanden */}
              {menue.productOrder.length > 0 && (
                <MenueCardList
                  menue={menue}
                  products={products}
                  listType={MenuplanDragDropTypes.PRODUCT}
                  menuplanSettings={menuplanSettings}
                  groupConfiguration={groupConfiguration}
                  onListElementClick={onMealProductOpen}
                  onMoveDragAndDropElement={onMoveDragAndDropElement!}
                />
              )}
              {/* Material – nur anzeigen, wenn vorhanden */}
              {menue.materialOrder.length > 0 && (
                <MenueCardList
                  menue={menue}
                  materials={materials}
                  listType={MenuplanDragDropTypes.MATERIAL}
                  menuplanSettings={menuplanSettings}
                  groupConfiguration={groupConfiguration}
                  onListElementClick={onMealMaterialOpen}
                  onMoveDragAndDropElement={onMoveDragAndDropElement!}
                />
              )}
            </CardContent>
            <Menu
              open={Boolean(contextMenuAnchorElement)}
              keepMounted
              anchorEl={contextMenuAnchorElement}
              onClose={closeContextMenu}
            >
              <MenuItem
                onClick={onEditMenue}
                disabled={
                  menue.materialOrder.length == 0 &&
                  menue.productOrder.length == 0 &&
                  menue.mealRecipeOrder.length == 0 &&
                  note == undefined
                }
              >
                <ListItemIcon>
                  <EditIcon />
                </ListItemIcon>
                <Typography variant="inherit" noWrap>
                  {TEXT_EDIT_MENUE}
                </Typography>
              </MenuItem>
              <MenuItem onClick={onAddProduct}>
                <ListItemIcon>
                  <ShoppingCartIcon />
                </ListItemIcon>
                <Typography variant="inherit" noWrap>
                  {TEXT_ADD_PRODUCT}
                </Typography>
              </MenuItem>
              <MenuItem onClick={onAddMaterial}>
                <ListItemIcon>
                  <BuildIcon />
                </ListItemIcon>
                <Typography variant="inherit" noWrap>
                  {TEXT_ADD_MATERIAL}
                </Typography>
              </MenuItem>
              <MenuItem onClick={onEditNote}>
                <ListItemIcon>
                  <NotesIcon />
                </ListItemIcon>
                <Typography variant="inherit" noWrap>
                  {`${TEXT_NOTE} ${note ? TEXT_EDIT : TEXT_ADD}`}
                </Typography>
              </MenuItem>
              {note && (
                <MenuItem
                  onClick={() =>
                    onNoteUpdate({action: Action.DELETE, note: note})
                  }
                >
                  <ListItemIcon>
                    <DeleteSweepIcon />
                  </ListItemIcon>
                  <Typography variant="inherit" noWrap>
                    {`${TEXT_NOTE} ${TEXT_DELETE}`}
                  </Typography>
                </MenuItem>
              )}

              <MenuItem onClick={onDeleteMenue}>
                <ListItemIcon>
                  <DeleteIcon />
                </ListItemIcon>
                <Typography variant="inherit" noWrap>
                  {TEXT_DELETE_MENUE}
                </Typography>
              </MenuItem>
              {/* Wenn nur ein Element, dass gibt Hoch/Runter keinen sinn */}
              {/* //TODO: alle neuen Felder versorgen */}
              {!(index === 0 && isLastElement) && (
                <>
                  <MenuItem
                    onClick={() => onMoveElement("up")}
                    disabled={index === 0}
                  >
                    <ListItemIcon>
                      <ArrowUpwardIcon fontSize="small"></ArrowUpwardIcon>
                    </ListItemIcon>
                    <Typography>{TEXT_TOOLTIP_MOVE_UP}</Typography>
                  </MenuItem>
                  <MenuItem
                    onClick={() => onMoveElement("down")}
                    disabled={isLastElement}
                  >
                    <ListItemIcon>
                      <ArrowDownwardIcon fontSize="small"></ArrowDownwardIcon>
                    </ListItemIcon>
                    <Typography>{TEXT_TOOLTIP_MOVE_DOWN}</Typography>
                  </MenuItem>
                </>
              )}
              <MenuItem onClick={() => onMoveElement("inOtherMenu")}>
                <ListItemIcon>
                  <ArrowForwardIcon fontSize="small"></ArrowForwardIcon>
                </ListItemIcon>
                <Typography>{TEXT_TOOLTIP_MOVE_OTHER_MEAL}</Typography>
              </MenuItem>
            </Menu>
          </Card>
        </Box>
        {state.type === "is-over" && state.closestEdge === "bottom" ? (
          <MenueCardShadow dragging={state.dragging} />
        ) : null}
      </Box>
    </>
  );
};
/* ===================================================================
// ======================= Menü-Karte-Schatten =======================
// =================================================================== */
/**
 * Menü-Card-Schatten: Wird angezeigt, wenn der Drag&Drop
 * ausgeführt wird.
 * @returns JSX
 */
const MenueCardShadow = ({dragging}: {dragging: DOMRect}) => {
  const classes = useCustomStyles();
  return (
    <Card sx={classes.menuCardPlaceholder} style={{height: dragging.height}} />
  );
};
