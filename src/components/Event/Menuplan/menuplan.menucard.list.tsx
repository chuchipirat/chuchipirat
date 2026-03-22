import React, {memo, useRef, useState, useEffect, useCallback} from "react";

import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from "@mui/material";
import {
  GoodsPlanMode,
  MealRecipes,
  Menue,
  MenueListOrderTypes,
  MenuplanData,
} from "./menuplan.types";
import {
  DragAndDropDirections,
  generatePlanedPortionsText,
  MenuplanDragDropTypes,
  MenuplanSettings,
  OnMoveDragAndDropElementFx,
} from "./menuplan";

import {
  type Edge,
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {createPortal} from "react-dom";
import useCustomStyles from "../../../constants/styles";

import {
  DragIndicator as DragIndicatorIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import invariant from "tiny-invariant";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {setCustomNativeDragPreview} from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {preserveOffsetOnSource} from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import {RecipeType} from "../../Recipe/recipe.class";

import {
  VARIANT as TEXT_VARIANT,
  RECIPE_WIHOUT_PORTIONPLAN as TEXT_RECIPE_WIHOUT_PORTIONPLAN,
  PER_PORTION as TEXT_PER_PORTION,
  TOOLTIP_MOVE_UP as TEXT_TOOLTIP_MOVE_UP,
  TOOLTIP_MOVE_DOWN as TEXT_TOOLTIP_MOVE_DOWN,
  TOOLTIP_MOVE_OTHER_MENU as TEXT_TOOLTIP_MOVE_OTHER_MENU,
} from "../../../constants/text";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";

export type TListItem = {
  id: string;
  primaryText: JSX.Element | string | null;
  secondaryText: JSX.Element | JSX.Element[] | string | null;
  type: MenuplanDragDropTypes;
};

type TListItemState =
  | {
      type: "idle";
    }
  | {
      type: "is-dragging";
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
const cardListItemKey = Symbol("cardListItem");
export type TListItemData = {
  itemType: MenuplanDragDropTypes;
  [cardListItemKey]: true;
  listItem: TListItem;
  menueUid: string;
  rect: DOMRect;
};
export function getCardListItemData({
  listItem,
  rect,
  menueUid,
}: Omit<TListItemData, typeof cardListItemKey> & {
  menueUid: string;
}): TListItemData {
  return {
    [cardListItemKey]: true,
    itemType: listItem.type,
    rect,
    listItem,
    menueUid,
  };
}
export function isCardListData(
  value: Record<string | symbol, unknown>
): value is TListItemData {
  return Boolean(value[cardListItemKey]);
}
export function isDraggingACardListItem({
  source,
}: {
  source: {data: Record<string | symbol, unknown>};
}): boolean {
  return isCardListData(source.data);
}

export function isCardListType({
  source,
  cardType,
}: {
  source: {data: Record<string | symbol, unknown>};
  cardType: MenuplanDragDropTypes;
}): boolean {
  return source.data.itemType == cardType;
}

const cardDropTargetKey = Symbol("card-list-drop-target");
export type TCardListDropTargetData = {
  [cardDropTargetKey]: true;
  listItem: TListItem;
  menueUid: string;
};
export function isCardListDropTargetData(
  value: Record<string | symbol, unknown>
): value is TCardListDropTargetData {
  return Boolean(value[cardDropTargetKey]);
}
export function getCardListDropTargetData({
  listItem,
  menueUid,
}: Omit<TCardListDropTargetData, typeof cardDropTargetKey> & {
  menueUid: string;
}): TCardListDropTargetData {
  return {
    [cardDropTargetKey]: true,
    listItem,
    menueUid,
  };
}

const listContainerKey = Symbol("list-container");
export type TListContainerDropTargetData = {
  [listContainerKey]: true;
  menueUid: string;
  listType: MenuplanDragDropTypes;
  isEmpty: boolean;
};
export function getListContainerDropTargetData({
  menueUid,
  listType,
  isEmpty,
}: Omit<
  TListContainerDropTargetData,
  typeof listContainerKey
>): TListContainerDropTargetData {
  return {
    [listContainerKey]: true,
    menueUid,
    listType,
    isEmpty,
  };
}
export function isListContainerDropTargetData(
  value: Record<string | symbol, unknown>
): value is TListContainerDropTargetData {
  return Boolean(value[listContainerKey]);
}
export function isShallowEqual(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>
): boolean {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }
  return keys1.every((key1) => Object.is(obj1[key1], obj2[key1]));
}

type onListElementClick = (itemUid: string) => void;

// Stabile Style-Konstanten (verhindern neue Objekt-Referenzen bei jedem Render)
const STYLE_LIST_MIN_HEIGHT: React.CSSProperties = {minHeight: "3em"};
const STYLE_LIST_ITEM_TEXT: React.CSSProperties = {margin: 0, flex: 1};

/* ===================================================================
// ========================= Menü-Card-Liste =========================
// =================================================================== */
interface MenucardListProps {
  menue: Menue;
  mealRecipes?: MealRecipes;
  products?: MenuplanData["products"];
  materials?: MenuplanData["materials"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  listType: MenuplanDragDropTypes;
  onListElementClick: onListElementClick;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
// ===================================================================== */
/**
 * Menü-Card List: Liste für die Menü-Karte
 * A memoized component for rendering out the list.
 * Created so that state changes to the list don't require all lists to be rendered
 * @returns JSX
 */
export const MenueCardList = memo(function MenueCardList({
  menue,
  mealRecipes,
  products,
  materials,
  listType,
  groupConfiguration,
  menuplanSettings,
  onMoveDragAndDropElement,
  onListElementClick,
}: MenucardListProps) {
  let memberName = "" as MenueListOrderTypes;

  const theme = useTheme();
  const listRef = useRef<HTMLDivElement | null>(null);
  // Ref für stabile Zugriffe in Drag-&-Drop-Callbacks
  const menueRef = useRef(menue);
  menueRef.current = menue;

  switch (listType) {
    case MenuplanDragDropTypes.MEALRECIPE:
      memberName = MenueListOrderTypes.mealRecipeOrder;
      break;
    case MenuplanDragDropTypes.PRODUCT:
      memberName = MenueListOrderTypes.productOrder;
      break;
    case MenuplanDragDropTypes.MATERIAL:
      memberName = MenueListOrderTypes.materialOrder;
      break;
    default:
      throw new Error("kein MenuplanDragDropType erkannt");
  }

  const getPrimaryText = (
    menue: Menue,
    memberName: string,
    listEntryUid: string
  ) => {
    switch (listType) {
      case MenuplanDragDropTypes.MEALRECIPE:
        if (!mealRecipes) {
          throw new Error("Keine eingeplanten Rezepte vorhanden");
        }
        return !mealRecipes[listEntryUid]?.recipe.recipeUid ? (
          <span
            style={{
              color: theme.palette.text.secondary,
            }}
          >
            {`🗑️ ${mealRecipes[listEntryUid]?.recipe.name} (gelöscht)`}
          </span>
        ) : (
          <span>
            {mealRecipes[listEntryUid]?.recipe.name}
            <span
              style={{
                color: theme.palette.text.secondary,
              }}
            >
              {mealRecipes[listEntryUid]?.recipe.type === RecipeType.variant
                ? ` [${TEXT_VARIANT}: ${mealRecipes[listEntryUid]?.recipe.variantName}]`
                : ``}
            </span>
          </span>
        );
      case MenuplanDragDropTypes.PRODUCT:
        if (!products) {
          throw new Error("Keine eingeplanten Produkte vorhanden");
        }
        return `${
          menuplanSettings.showDetails &&
          products[listEntryUid]?.totalQuantity > 0
            ? `${products[listEntryUid]?.totalQuantity} ${
                products[listEntryUid].unit ? products[listEntryUid].unit : " ×"
              }`
            : ``
        } ${products[listEntryUid]?.productName}
                                        ${
                                          products[listEntryUid]?.planMode ==
                                            GoodsPlanMode.PER_PORTION &&
                                          menuplanSettings.showDetails
                                            ? `(${products[listEntryUid].quantity} ${products[listEntryUid].unit} ${TEXT_PER_PORTION})`
                                            : ``
                                        }`;
      case MenuplanDragDropTypes.MATERIAL:
        if (!materials) {
          throw new Error("Keine eingeplanten Materialien vorhanden");
        }
        return `${
          menuplanSettings.showDetails &&
          materials[listEntryUid]?.totalQuantity > 0
            ? `${materials[listEntryUid]?.totalQuantity} ${
                materials[listEntryUid].unit
                  ? materials[listEntryUid].unit
                  : " ×"
              }`
            : ``
        } ${materials[listEntryUid]?.materialName}
                                ${
                                  materials[listEntryUid]?.planMode ==
                                    GoodsPlanMode.PER_PORTION &&
                                  menuplanSettings.showDetails
                                    ? `(${materials[listEntryUid].quantity} ${materials[listEntryUid].unit} ${TEXT_PER_PORTION})`
                                    : ``
                                }`;
      default:
        return null;
    }
  };
  const getSecondaryText = (
    menue: Menue,
    memberName: string,
    listEntryUid: string
  ) => {
    switch (listType) {
      case MenuplanDragDropTypes.MEALRECIPE:
        if (!mealRecipes) {
          throw new Error("Keine eingeplanten Rezepte vorhanden");
        }
        return mealRecipes[listEntryUid]?.plan.length == 0 ? (
          <span
            style={{
              color: theme.palette.error.main,
            }}
          >
            {TEXT_RECIPE_WIHOUT_PORTIONPLAN}
          </span>
        ) : menuplanSettings.showDetails &&
          mealRecipes[listEntryUid]?.plan.length > 0 ? (
          generatePlanedPortionsText({
            uid: listEntryUid,
            portionPlan: mealRecipes[listEntryUid].plan,
            groupConfiguration: groupConfiguration,
          })
        ) : null;
      case MenuplanDragDropTypes.PRODUCT:
        if (!products) {
          throw new Error("Keine eingeplanten Produkte vorhanden");
        }
        return menuplanSettings.showDetails
          ? products[listEntryUid]?.planMode == GoodsPlanMode.PER_PORTION
            ? generatePlanedPortionsText({
                uid: listEntryUid,
                portionPlan: products[listEntryUid].plan,
                groupConfiguration: groupConfiguration,
              })
            : ``
          : null;
      case MenuplanDragDropTypes.MATERIAL:
        if (!materials) {
          throw new Error("Keine eingeplanten Materialien vorhanden");
        }
        return menuplanSettings.showDetails
          ? materials[listEntryUid]?.planMode == GoodsPlanMode.PER_PORTION
            ? generatePlanedPortionsText({
                uid: listEntryUid,
                portionPlan: materials[listEntryUid].plan,
                groupConfiguration: groupConfiguration,
              })
            : ``
          : null;
      default:
        return null;
    }
  };

  // Register list as drop target to allow drops into empty lists
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
          isDraggingACardListItem({source}) &&
            isCardListType({source: source, cardType: listType})
        ),
      getData: () =>
        getListContainerDropTargetData({
          menueUid: menueRef.current.uid,
          listType: listType,
          isEmpty: menueRef.current[memberName].length === 0,
        }),
    });
  }, [listType, memberName, menuplanSettings.enableDragAndDrop]);

  return (
    <>
      <Box component={"div"} ref={listRef}>
        <List
          dense
          key={"menuplanlist_" + listType + "_" + menue.uid}
          style={STYLE_LIST_MIN_HEIGHT}
        >
          {menue[memberName].map((uid: string, index) => {
            // Kein Rendering, solange Daten noch nicht verfügbar
            if (
              listType === MenuplanDragDropTypes.PRODUCT &&
              !products?.[uid]
            )
              return null;
            if (
              listType === MenuplanDragDropTypes.MATERIAL &&
              !materials?.[uid]
            )
              return null;
            return (
              <DraggableListItem
                key={uid}
                index={index}
                listItem={{
                  primaryText: getPrimaryText(menue, memberName, uid),
                  secondaryText: getSecondaryText(menue, memberName, uid),
                  id: uid,
                  type: listType,
                }}
                menueUid={menue.uid}
                listType={listType}
                listItemKey={uid}
                lastElement={index === menue[memberName].length - 1}
                menuplanSettings={menuplanSettings}
                onListElementClick={onListElementClick}
                onMoveDragAndDropElement={onMoveDragAndDropElement}
              />
            );
          })}
        </List>
      </Box>
    </>
  );
});
/* ===================================================================
// =============== Drag & Drop Menü-Card-Listeneintrag ===============
// =================================================================== */
interface DraggableListItemProps {
  index: number;
  lastElement: boolean;
  listItemKey: string;
  listType: MenuplanDragDropTypes;
  listItem: TListItem;
  menueUid: Menue["uid"];
  menuplanSettings: MenuplanSettings;
  onListElementClick: onListElementClick;
  onMoveDragAndDropElement?: OnMoveDragAndDropElementFx;
}
const listItemIdle = {type: "idle"} satisfies TListItemState;
// ===================================================================== */
/**
 * Menü-Card List-Entry: Listeneingtrag der dich Dragen lässt
 * @returns JSX
 */
const DraggableListItem = memo(function DraggableListItem({
  index,
  listItem,
  menueUid,
  listItemKey,
  listType,
  lastElement,
  menuplanSettings,
  onListElementClick,
  onMoveDragAndDropElement,
}: DraggableListItemProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<TListItemState>(listItemIdle);
  // Ref für stabile Zugriffe in Drag-&-Drop-Callbacks
  const listItemRef = useRef(listItem);
  listItemRef.current = listItem;

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
          getCardListItemData({
            listItem: listItemRef.current,
            menueUid,
            rect: element.getBoundingClientRect(),
            itemType: listItemRef.current.type,
          }),
        onGenerateDragPreview({nativeSetDragImage, location, source}) {
          const data = source.data;
          invariant(isCardListData(data));
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: inner,
              input: location.current.input,
            }),
            render({container}) {
              setState({
                type: "preview",
                container,
                dragging: inner.getBoundingClientRect(),
              });
            },
          });
        },
        onDragStart() {
          setState({type: "is-dragging"});
        },
        onDrop() {
          setState(listItemIdle);
        },
      }),
      dropTargetForElements({
        element: outer,
        getIsSticky: () => true,
        canDrop: ({source}) =>
          Boolean(
            isDraggingACardListItem({source}) &&
              isCardListType({source: source, cardType: listType})
          ),
        getData: ({element, input}) => {
          const data = getCardListDropTargetData({
            listItem: listItemRef.current,
            menueUid,
          });
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter({source, self}) {
          if (!isCardListData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItemRef.current.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }

          setState({type: "is-over", dragging: source.data.rect, closestEdge});
        },
        onDrag({source, self}) {
          if (!isCardListData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItemRef.current.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }
          // optimization - Don't update react state if we don't need to.
          const proposed: TListItemState = {
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
          if (!isCardListData(source.data)) {
            return;
          }
          if (source.data.listItem.id === listItemRef.current.id) {
            setState({type: "is-dragging-and-left-self"});
            return;
          }
          setState(listItemIdle);
        },
        onDrop() {
          setState(listItemIdle);
        },
      })
    );
  }, [menueUid, menuplanSettings.enableDragAndDrop]);

  return (
    <>
      <MenuCardListItem
        outerRef={outerRef}
        innerRef={innerRef}
        state={state}
        listItemKey={listItemKey}
        primaryText={listItem.primaryText}
        secondaryText={listItem.secondaryText}
        index={index}
        lastElement={lastElement}
        dragAndDropListType={listType}
        menueUid={menueUid}
        onListElementClick={onListElementClick}
        onMoveDragAndDropElement={onMoveDragAndDropElement}
      />
      {state.type === "preview"
        ? createPortal(
            <MenuCardListItem
              state={state}
              listItemKey={listItemKey}
              primaryText={listItem.primaryText}
              secondaryText={listItem.secondaryText}
              index={index}
              lastElement={lastElement}
              dragAndDropListType={listType}
              menueUid={menueUid}
            />,
            state.container
          )
        : null}
    </>
  );
});

/* ===================================================================
// ===================== Menü-Card-Listen-Eintrag ====================
// =================================================================== */
interface MenuCardListItemProps {
  index: number;
  lastElement: boolean;
  listItemKey: string;
  primaryText: JSX.Element | string | null;
  secondaryText: JSX.Element | JSX.Element[] | string | null;
  menueUid: Menue["uid"];
  dragAndDropListType: MenuplanDragDropTypes;
  state: TListItemState;
  outerRef?: React.MutableRefObject<HTMLDivElement | null>;
  innerRef?: React.MutableRefObject<HTMLDivElement | null>;
  onListElementClick?: onListElementClick;
  onMoveDragAndDropElement?: OnMoveDragAndDropElementFx;
}
// ===================================================================== */
/**
 * Menü-Card List-Entry: Listeneingtrag für die Menü-Karte-Liste
 * @returns JSX
 */
const MenuCardListItem = memo(function MenuCardListItem({
  index,
  listItemKey,
  primaryText,
  secondaryText,
  lastElement,
  dragAndDropListType,
  menueUid,
  state,
  outerRef,
  innerRef,
  onListElementClick,
  onMoveDragAndDropElement,
}: MenuCardListItemProps) {
  const classes = useCustomStyles();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);

  /* ------------------------------------------
    // Kontext-Menü-Handling
    // ------------------------------------------ */
  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setContextMenuAnchorElement(event.currentTarget);
  };
  const closeContextMenue = () => {
    setContextMenuAnchorElement(null);
  };
  const onMoveElement = (direction: DragAndDropDirections) => {
    if (contextMenuAnchorElement?.id && onMoveDragAndDropElement != undefined) {
      onMoveDragAndDropElement({
        kind: dragAndDropListType,
        direction: direction,
        menueUid: menueUid,
        itemUid: contextMenuAnchorElement.id.split("_")[1],
      });
    }
    setContextMenuAnchorElement(null);
  };

  return (
    <>
      {/* // Outerstyle */}
      <Box
        component="div"
        ref={outerRef}
        sx={classes.menueCardDragBox[state.type]}
      >
        {/* Put a shadow before the item if closer to the top edge */}
        {state.type === "is-over" && state.closestEdge === "top" ? (
          <ListEntryShadow dragging={state.dragging} />
        ) : null}
        {/* InnerStyle */}
        <Box
          component="div"
          ref={innerRef}
          sx={
            state.type === "preview"
              ? classes.menueCardListItemDrag.preview(state.dragging)
              : classes.menueCardListItemDrag[state.type]
          }
        >
          <ListItem
            key={listItemKey}
            sx={{
              ...classes.menueCardListItem,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            dense
            disablePadding
          >
            <ListItemButton
              key={listItemKey}
              onClick={() => onListElementClick!(listItemKey)}
              sx={{py: 0.25}}
            >
              <ListItemText
                primary={primaryText}
                secondary={secondaryText}
                style={STYLE_LIST_ITEM_TEXT}
              />
            </ListItemButton>
            <ListItemIcon
              id={"moveElement_" + listItemKey}
              onClick={onContextMenuClick}
              sx={{
                minWidth: "auto",
                marginLeft: "auto",
                cursor: "pointer",
              }}
            >
              <DragIndicatorIcon fontSize="small" />
            </ListItemIcon>
          </ListItem>
        </Box>
        {state.type === "is-over" && state.closestEdge === "bottom" ? (
          <ListEntryShadow dragging={state.dragging} />
        ) : null}
      </Box>

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenue}
      >
        <MenuItem onClick={() => onMoveElement("up")} disabled={index === 0}>
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small"></ArrowUpwardIcon>
          </ListItemIcon>
          <Typography>{TEXT_TOOLTIP_MOVE_UP}</Typography>
        </MenuItem>
        <MenuItem onClick={() => onMoveElement("down")} disabled={lastElement}>
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small"></ArrowDownwardIcon>
          </ListItemIcon>
          <Typography>{TEXT_TOOLTIP_MOVE_DOWN}</Typography>
        </MenuItem>
        <MenuItem onClick={() => onMoveElement("inOtherMenu")}>
          <ListItemIcon>
            <ArrowForwardIcon fontSize="small"></ArrowForwardIcon>
          </ListItemIcon>
          <Typography>{TEXT_TOOLTIP_MOVE_OTHER_MENU}</Typography>
        </MenuItem>
      </Menu>
    </>
  );
});

// ===================================================================== */
/**
 * Menü-Card List-Entry-Schatten: Wird angezeigt, wenn der Drag&Drop
 * ausgeführt wird.
 * @returns JSX
 */
const ListEntryShadow = ({dragging}: {dragging: DOMRect}) => {
  const classes = useCustomStyles();
  return (
    <ListItem
      sx={classes.menueCardListItemPlaceholder}
      style={{height: dragging.height}}
    />
  );
};
