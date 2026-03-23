import React, {memo, useEffect, useRef, useState} from "react"; //   useEffect, //   MutableRefObject, //   useRef, //   memo, //   useState,

// https://stackblitz.com/~/github.com/alexreardon/pragmatic-board?file=src/shared/column.tsx
// https://atlassian.design/components/pragmatic-drag-and-drop/examples/

//TODO: Checkliste Drag & Drop
// [X] Bei Drag, Objekt leicht schräg stellen
// [X] Hintergrund gefärbt, wenn Drag stattfindet
// [X] Bei Mobile deaktivieren --> nur mit Buttons möglich --> ist vom Framework so vorgegeben.
// [X] Card/ Listitem Shaddow einfügen
// [X] Richtige Objekte mit Memo memoizieren
// [ ] Menüplan mit einzelnen File arbeiten --> Menucard // List //
// [ ] sauberes Renaming au alle Objekte
// [X] canDrop muss sichergestellt sein, dass es vom gleichen Typ ist!

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import {
  DragIndicator as DragIndicatorIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";

import Role from "../../constants/roles";

import {useFirebase} from "../Firebase/firebaseContext";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {useAuthUser} from "../Session/authUserContext";
import {PageTitle} from "../Shared/pageTitle";
import useCustomStyles from "../../constants/styles";
import Grid from "@mui/material/Grid";

import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {setCustomNativeDragPreview} from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import {preserveOffsetOnSource} from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import type {DragLocationHistory} from "@atlaskit/pragmatic-drag-and-drop/types";
import {monitorForElements} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  type Edge,
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {reorderWithEdge} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import {autoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import {unsafeOverflowAutoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";
import type {CleanupFn} from "@atlaskit/pragmatic-drag-and-drop/types";
import {bindAll} from "bind-event-listener";
import {reorder} from "@atlaskit/pragmatic-drag-and-drop/reorder";

import {createPortal} from "react-dom";

import invariant from "tiny-invariant";
import {Utils} from "../Shared/utils.class";

// type Item = {
//   label: string;
//   id: string;
// };

/* ===================================================================
// =============================== Framework ==============================
// =================================================================== */

enum EntryType {
  card,
  listEntry,
}

const initialData: TBoard = {
  cards: {
    "card-A": {id: "card-A", description: "Karte A", type: EntryType.card},
    "card-B": {id: "card-B", description: "Karte B", type: EntryType.card},
    "card-C": {id: "card-C", description: "Karte C", type: EntryType.card},
    "card-D": {id: "card-D", description: "Karte D", type: EntryType.card},
    "card-E": {id: "card-E", description: "Karte E", type: EntryType.card},
    "card-F": {id: "card-F", description: "Karte F", type: EntryType.card},
    "card-G": {id: "card-G", description: "Karte G", type: EntryType.card},
    "card-H": {id: "card-H", description: "Karte H", type: EntryType.card},
  },
  listEntries: {
    list1: {
      id: "list1",
      description: "Listen-Eintrag 1",
      type: EntryType.listEntry,
    },
    list2: {
      id: "list2",
      description: "Listen-Eintrag 2",
      type: EntryType.listEntry,
    },
    list3: {
      id: "list3",
      description: "Listen-Eintrag 3",
      type: EntryType.listEntry,
    },
    list4: {
      id: "list4",
      description: "Listen-Eintrag 4",
      type: EntryType.listEntry,
    },
    list5: {
      id: "list5",
      description: "Listen-Eintrag 5",
      type: EntryType.listEntry,
    },
    list6: {
      id: "list6",
      description: "Listen-Eintrag 6",
      type: EntryType.listEntry,
    },
    list7: {
      id: "list7",
      description: "Listen-Eintrag 7",
      type: EntryType.listEntry,
    },
    list8: {
      id: "list8",
      description: "Listen-Eintrag 8",
      type: EntryType.listEntry,
    },
    list9: {
      id: "list9",
      description: "Listen-Eintrag 9",
      type: EntryType.listEntry,
    },
  },
  columns: {
    entries: {
      col1: {
        id: "col1",
        title: "Spalte 1",
        cardsOrder: ["card-A", "card-B", "card-C"],
        listEntryOrder: ["list1", "list2", "list3"],
      },
      col2: {
        id: "col2",
        title: "Spalte 2",
        cardsOrder: ["card-D", "card-E"],
        listEntryOrder: ["list4", "list5", "list6"],
      },
      col3: {
        id: "col3",
        title: "Spalte 3",
        cardsOrder: ["card-F", "card-G"],
        listEntryOrder: ["list7", "list8", "list9"],
      },
    },
    order: ["col1", "col2", "col3"],
  },
};

export type TCard = {
  id: string;
  description: string;
  type: EntryType;
};

export type TColumn = {
  id: string;
  title: string;
  cardsOrder: TCard["id"][];
  listEntryOrder: TCard["id"][];
};

export type ColumnOrder = {
  entries: {[Key: TColumn["id"]]: TColumn};
  order: TColumn["id"][];
};

export type TBoard = {
  columns: ColumnOrder;
  cards: {[Key: TCard["id"]]: TCard};
  listEntries: {[Key: TCard["id"]]: TCard};
};

type TCardState =
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

type TColumnState =
  | {
      type: "is-card-over";
      isOverChildCard: boolean;
      dragging: DOMRect;
    }
  | {
      type: "is-column-over";
    }
  | {
      type: "idle";
    }
  | {
      type: "is-dragging";
    };

// const itemKey = Symbol("card");
// export type ItemData = {
//   [itemKey]: true;
//   item: Item;
//   columnId: string;
//   rect: DOMRect;
// };
const cardKey = Symbol("card");
export type TCardData = {
  itemType: EntryType;
  [cardKey]: true;
  card: TCard;
  columnId: string;
  rect: DOMRect;
};
export function getCardData({
  card,
  rect,
  columnId,
}: Omit<TCardData, typeof cardKey> & {columnId: string}): TCardData {
  return {
    [cardKey]: true,
    itemType: card.type,
    rect,
    card,
    columnId,
  };
}
export function isCardData(
  value: Record<string | symbol, unknown>
): value is TCardData {
  return Boolean(value[cardKey]);
}
export function isDraggingACard({
  source,
}: {
  source: {data: Record<string | symbol, unknown>};
}): boolean {
  return isCardData(source.data);
}

export function isCardType({
  source,
  cardType,
}: {
  source: {data: Record<string | symbol, unknown>};
  cardType: EntryType;
}): boolean {
  return source.data.itemType == cardType;
}

const cardDropTargetKey = Symbol("card-drop-target");
export type TCardDropTargetData = {
  [cardDropTargetKey]: true;
  card: TCard;
  columnId: string;
};
export function isCardDropTargetData(
  value: Record<string | symbol, unknown>
): value is TCardDropTargetData {
  return Boolean(value[cardDropTargetKey]);
}
export function getCardDropTargetData({
  card,
  columnId,
}: Omit<TCardDropTargetData, typeof cardDropTargetKey> & {
  columnId: string;
}): TCardDropTargetData {
  return {
    [cardDropTargetKey]: true,
    card,
    columnId,
  };
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
const columnKey = Symbol("column");
export type TColumnData = {
  [columnKey]: true;
  column: TColumn;
};
export function getColumnData({
  column,
}: Omit<TColumnData, typeof columnKey>): TColumnData {
  return {
    [columnKey]: true,
    column,
  };
}
export function isColumnData(
  value: Record<string | symbol, unknown>
): value is TColumnData {
  return Boolean(value[columnKey]);
}
export function isDraggingAColumn({
  source,
}: {
  source: {data: Record<string | symbol, unknown>};
}): boolean {
  return isColumnData(source.data);
}
export const blockBoardPanningAttr = "data-block-board-panning" as const;

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const TempPage = () => {
  const firebase = useFirebase();
  // const classes = useCustomStyles();

  const [data, setData] = useState(initialData);
  const scrollableRef = useRef<HTMLDivElement | null>(null);

  if (!authUser) {
    return null;
  }

  useEffect(() => {
    const element = scrollableRef.current;

    invariant(element);
    return combine(
      monitorForElements({
        canMonitor: isDraggingACard,
        onDrop({source, location}) {
          const dragging = source.data;
          if (!isCardData(dragging)) {
            return;
          }
          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }
          const dropTargetData = innerMost.data;
          const homeColumnIndex = data.columns.order.findIndex(
            (columnId) => columnId === dragging.columnId
          );
          const home: TColumn | undefined =
            data.columns.entries[dragging.columnId];

          if (!home) {
            return;
          }

          // const homeList =
          //   dragging.itemType == EntryType.card
          //     ? home.cardsOrder
          //     : home.listEntryOrder;
          const memberName =
            dragging.itemType == EntryType.card
              ? "cardsOrder"
              : "listEntryOrder";
          const cardIndexInHome = home[memberName].findIndex(
            (cardId) => cardId === dragging.card.id
          );
          // dropping on a card
          if (isCardDropTargetData(dropTargetData)) {
            // const destinationColumnIndex = data.columns.order.findIndex(
            //   (columnId) => columnId === dropTargetData.columnId
            // );
            const destination = data.columns.entries[dropTargetData.columnId];
            // reordering in home column
            if (home === destination) {
              const cardFinishIndex = home[memberName].findIndex(
                (cardId) => cardId === dropTargetData.card.id
              );
              // could not find cards needed
              if (cardIndexInHome === -1 || cardFinishIndex === -1) {
                return;
              }

              // no change needed
              if (cardIndexInHome === cardFinishIndex) {
                return;
              }

              const closestEdge = extractClosestEdge(dropTargetData);

              const reordered = reorderWithEdge({
                axis: "vertical",
                list: home[memberName],
                startIndex: cardIndexInHome,
                indexOfTarget: cardFinishIndex,
                closestEdgeOfTarget: closestEdge,
              });
              const updated: TColumn = {
                ...home,
                [memberName]: reordered,
              };
              // const oldCardsOrder = Array.from(
              //   data.columns.entries[home.id].cardsOrder
              // );
              // oldCardsOrder
              console.log(updated);
              setData({
                ...data,
                columns: {
                  entries: {...data.columns.entries, [home.id]: updated},
                  order: [...data.columns.order],
                },
              });
              return;
            }

            // moving card from one column to another

            // unable to find destination
            if (!destination) {
              console.warn("Drag & Drop kein Ziel gefunden");
              return;
            }

            const indexOfTarget = destination[memberName].findIndex(
              (cardId) => cardId === dropTargetData.card.id
            );

            const closestEdge = extractClosestEdge(dropTargetData);
            const finalIndex =
              closestEdge === "bottom" ? indexOfTarget + 1 : indexOfTarget;

            // remove card from home list
            const homeCards = Array.from(home[memberName]);
            homeCards.splice(cardIndexInHome, 1);

            // insert into destination list
            const destinationCards = Array.from(destination[memberName]);
            destinationCards.splice(finalIndex, 0, dragging.card.id);

            // const columns = Array.from(data.columns.order);

            // const newColumnEntries = _.cloneDeep(data.columns.entries);

            // newColumnEntries[home.id].cardsOrder = homeCards;
            // newColumnEntries[destination.id].cardsOrder = destinationCards;

            setData({
              ...data,
              columns: {
                ...data.columns,
                entries: {
                  ...data.columns.entries,
                  [home.id]: {
                    ...data.columns.entries[home.id],
                    [memberName]: homeCards,
                  },
                  [destination.id]: {
                    ...data.columns.entries[destination.id],
                    [memberName]: destinationCards,
                  },
                },
              },
            });
            return;
          }

          // dropping onto a column, but not onto a card
          if (isColumnData(dropTargetData)) {
            // const destinationColumnIndex = data.columns.order.findIndex(
            //   (columnId) => columnId === dropTargetData.column.id
            // );
            const destination = data.columns.entries[dropTargetData.column.id];

            if (!destination) {
              return;
            }

            // dropping on home
            if (home === destination) {
              console.info("moving card to home column");

              // move to last position
              const reordered = reorder({
                list: home[memberName],
                startIndex: cardIndexInHome,
                finishIndex: home[memberName].length - 1,
              });

              const updated: TColumn = {
                ...home,
                [memberName]: reordered,
              };
              const columns = Array.from(data.columns.order);
              columns[homeColumnIndex] = updated.id;
              setData({
                ...data,
                columns: {
                  ...data.columns,
                  entries: {
                    ...data.columns.entries,
                    [home.id]: {
                      ...data.columns.entries[home.id],
                      [memberName]: reordered,
                    },
                  },
                },
              });
              return;
            }

            console.info("moving card to another column");

            // remove card from home list

            const homeCards = Array.from(home[memberName]);
            homeCards.splice(cardIndexInHome, 1);
            // insert into destination list
            const destinationCards = Array.from(destination[memberName]);
            destinationCards.splice(
              destination[memberName].length,
              0,
              dragging.card.id
            );

            // const columns = Array.from(data.columns.order);

            setData({
              ...data,
              columns: {
                ...data.columns,
                entries: {
                  ...data.columns.entries,
                  [home.id]: {
                    ...data.columns.entries[home.id],
                    [memberName]: homeCards,
                  },
                  [destination.id]: {
                    ...data.columns.entries[destination.id],
                    [memberName]: destinationCards,
                  },
                },
              },
            });

            return;
          }
        },
      }),
      monitorForElements({
        canMonitor: isDraggingAColumn,
        onDrop({source, location}) {
          const dragging = source.data;
          if (!isColumnData(dragging)) {
            return;
          }

          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }
          const dropTargetData = innerMost.data;

          if (!isColumnData(dropTargetData)) {
            return;
          }

          const homeIndex = data.columns.order.findIndex(
            (columnId) => columnId === dragging.column.id
          );
          const destinationIndex = data.columns.order.findIndex(
            (columnId) => columnId === dropTargetData.column.id
          );

          if (homeIndex === -1 || destinationIndex === -1) {
            return;
          }

          if (homeIndex === destinationIndex) {
            return;
          }

          const reordered = reorder({
            list: data.columns.order,
            startIndex: homeIndex,
            finishIndex: destinationIndex,
          });
          setData({...data, columns: {...data.columns, order: reordered}});
        },
      }),
      autoScrollForElements({
        canScroll({source}) {
          // if (!settings.isOverElementAutoScrollEnabled) {
          //   return false;
          // }

          return isDraggingACard({source}) || isDraggingAColumn({source});
        },
        // getConfiguration: () => ({maxScrollSpeed: settings.boardScrollSpeed}),
        element,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        // getConfiguration: () => ({maxScrollSpeed: settings.boardScrollSpeed}),
        canScroll({source}) {
          // if (!settings.isOverElementAutoScrollEnabled) {
          //   return false;
          // }

          // if (!settings.isOverflowScrollingEnabled) {
          //   return false;
          // }

          return isDraggingACard({source}) || isDraggingAColumn({source});
        },
        getOverflow() {
          return {
            forLeftEdge: {
              top: 1000,
              left: 1000,
              bottom: 1000,
            },
            forRightEdge: {
              top: 1000,
              right: 1000,
              bottom: 1000,
            },
          };
        },
      })
    );
  }, [data]);

  // Panning the board
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
        {capture: true}
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

  return (
    <React.Fragment>
      <PageTitle title="Temp" subTitle="Drag & Drop" />
      <Box component={"div"} ref={scrollableRef}>
        {/* style={{backgroundColor: "red"}}> */}
        <Grid container spacing={2}>
          {data.columns.order.map((columnId) => (
            <Grid xs={4} key={columnId}>
              <Column
                key={columnId}
                column={data.columns.entries[columnId]}
                cards={data.cards}
                listEntries={data.listEntries}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    </React.Fragment>
  );
};
// = Card
const Column = ({
  column,
  cards,
  listEntries,
}: {
  column: TColumn;
  cards: TBoard["cards"];
  listEntries: TBoard["listEntries"];
}) => {
  // const scrollableRef = useRef<HTMLDivElement | null>(null);
  const outerFullHeightRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [stateColumn, setStateColumn] = useState<TColumnState>(columnIdle);

  const classes = useCustomStyles();

  useEffect(() => {
    const outer = outerFullHeightRef.current;
    // const scrollable = scrollableRef.current;
    const header = headerRef.current;
    const inner = innerRef.current;
    invariant(outer);
    // invariant(scrollable);
    invariant(header);
    invariant(inner);

    const data = getColumnData({column});

    function setIsCardOver({
      data,
      location,
    }: {
      data: TCardData;
      location: DragLocationHistory;
    }) {
      const innerMost = location.current.dropTargets[0];
      const isOverChildCard = Boolean(
        innerMost && isCardDropTargetData(innerMost.data)
      );

      const proposed: TColumnState = {
        type: "is-card-over",
        dragging: data.rect,
        isOverChildCard,
      };
      // optimization - don't update state if we don't need to.
      setStateColumn((current) => {
        if (isShallowEqual(proposed, current)) {
          console.log(proposed, current);
          return current;
        }
        return proposed;
      });
      console.log("hier, setIsCardOver");
    }

    return combine(
      draggable({
        element: header,
        getInitialData: () => data,
        onGenerateDragPreview({source, location, nativeSetDragImage}) {
          const data = source.data;
          invariant(isColumnData(data));
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: header,
              input: location.current.input,
            }),
            render({container}) {
              // Simple drag preview generation: just cloning the current element.
              // Not using react for this.
              const rect = inner.getBoundingClientRect();
              const preview = inner.cloneNode(true);
              invariant(preview instanceof HTMLElement);
              preview.style.width = `${rect.width}px`;
              preview.style.height = `${rect.height}px`;

              // rotation of native drag previews does not work in safari
              if (!Utils.isSafari()) {
                preview.style.transform = "rotate(4deg)";
              }

              container.appendChild(preview);
            },
          });
        },
        onDragStart() {
          console.log("hier", "onDragStart");

          setStateColumn({type: "is-dragging"});
        },
        onDrop() {
          console;
          setStateColumn(columnIdle);
        },
      }),
      dropTargetForElements({
        element: outer,
        getData: () => data,
        canDrop({source}) {
          return isDraggingACard({source}) || isDraggingAColumn({source});
        },

        getIsSticky: () => true,
        onDragStart({source, location}) {
          if (isCardData(source.data)) {
            setIsCardOver({data: source.data, location});
          }
        },
        onDragEnter({source, location}) {
          if (isCardData(source.data)) {
            setIsCardOver({data: source.data, location});
            return;
          }
          if (
            isColumnData(source.data) &&
            source.data.column.id !== column.id
          ) {
            console.log("hier, isColumnData");
            setStateColumn({type: "is-column-over"});
          }
        },
        onDropTargetChange({source, location}) {
          if (isCardData(source.data)) {
            setIsCardOver({data: source.data, location});
            return;
          }
        },
        onDragLeave({source}) {
          if (
            isColumnData(source.data) &&
            source.data.column.id === column.id
          ) {
            return;
          }
          console.log("hier, onDragLeave", columnIdle);
          setStateColumn(columnIdle);
        },
        onDrop() {
          console.log("hier, onDrop");
          setStateColumn(columnIdle);
        },
      })
      //  autoScrollForElements({
      //   canScroll({source}) {
      //     // if (!settings.isOverElementAutoScrollEnabled) {
      //     //   return false;
      //     // }

      //     return isDraggingACard({source});
      //   },
      //   getConfiguration: () => ({maxScrollSpeed: "standard"}),
      //   element: scrollable,
      // }),
      // unsafeOverflowAutoScrollForElements({
      //   element: scrollable,
      //   getConfiguration: () => ({maxScrollSpeed: "standard"}),
      //   canScroll({source}) {
      //     // if (!settings.isOverElementAutoScrollEnabled) {
      //     //   return false;
      //     // }

      //     // if (!settings.isOverflowScrollingEnabled) {
      //     //   return false;
      //     // }

      //     return isDraggingACard({source});
      //   },
      //   getOverflow() {
      //     return {
      //       forTopEdge: {
      //         top: 1000,
      //       },
      //       forBottomEdge: {
      //         bottom: 1000,
      //       },
      //     };
      //   },
      // })
    );
  }, [column]);
  return (
    <Box component="div" ref={outerFullHeightRef} style={{userSelect: "none"}}>
      <Card sx={classes.menueCardDrag[stateColumn.type]}>
        {/* Extra wrapping element to make it easy to toggle visibility of content when a column is dragging over */}
        <Box
          component={"div"}
          sx={
            stateColumn.type === "is-column-over"
              ? {visibility: "hidden"}
              : undefined
          }
        >
          <Box component={"div"} ref={headerRef}>
            <CardHeader
              title={
                <TextField
                  fullWidth
                  variant="standard"
                  value={column.title}
                  label={"Menü"}
                />
              }
            />
            <CardContent>
              <Box component={"div"} ref={innerRef}>
                <CardList
                  columnId={column.id}
                  order={column.cardsOrder}
                  entries={cards}
                  entryType={EntryType.card}
                />
                <br />
                <Divider />
                <br />
                <CardList
                  columnId={column.id}
                  order={column.listEntryOrder}
                  entries={listEntries}
                  entryType={EntryType.listEntry}
                />

                {/* </List> */}
              </Box>
            </CardContent>
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

/**
 * A memoized component for rendering out the card.
 *
 * Created so that state changes to the column don't require all cards to be rendered
 */
// = Liste in einer Karte
const CardList = memo(function CardList({
  columnId,
  order: order,
  entries,
  entryType,
}: {
  columnId: TColumn["id"];
  order: string[];
  entries: TBoard["cards"];
  entryType: EntryType;
}) {
  console.info("memo exe", columnId);
  return (
    <>
      <Box component={"div"}>
        <List dense>
          {order.map((entryId) => (
            <CustomListEntry
              key={entryId}
              card={entries[entryId]}
              columnId={columnId}
              entryType={entryType}
            />
          ))}
        </List>
      </Box>
    </>
  );
});

interface CustomListEntry {
  card: TCard;
  columnId: TColumn["id"];
  entryType: EntryType;
}

const columnIdle = {type: "idle"} satisfies TColumnState;
const cardIdle = {type: "idle"} satisfies TCardState;

// ATTENTION: Wobei Card einem Listem-Element entspricht!!
// = Listeneintrag in einer Karte ## DONE
const CustomListEntry = ({card, columnId, entryType}: CustomListEntry) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<TCardState>(cardIdle);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    invariant(outer && inner);

    return combine(
      draggable({
        element: inner,
        getInitialData: ({element}) =>
          getCardData({
            card,
            columnId,
            rect: element.getBoundingClientRect(),
            itemType: card.type,
          }),
        onGenerateDragPreview({nativeSetDragImage, location, source}) {
          const data = source.data;
          invariant(isCardData(data));
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: inner,
              input: location.current.input,
            }),
            render({container}) {
              // Demonstrating using a react portal to generate a preview
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
          setState(cardIdle);
        },
      }),
      dropTargetForElements({
        element: outer,
        getIsSticky: () => true,
        canDrop: ({source}) =>
          Boolean(
            isDraggingACard({source}) &&
              isCardType({source: source, cardType: entryType})
          ),
        getData: ({element, input}) => {
          const data = getCardDropTargetData({card, columnId});
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter({source, self}) {
          if (!isCardData(source.data)) {
            return;
          }
          if (source.data.card.id === card.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }

          setState({type: "is-over", dragging: source.data.rect, closestEdge});
        },
        onDrag({source, self}) {
          if (!isCardData(source.data)) {
            return;
          }
          if (source.data.card.id === card.id) {
            return;
          }
          const closestEdge = extractClosestEdge(self.data);
          if (!closestEdge) {
            return;
          }
          // optimization - Don't update react state if we don't need to.
          const proposed: TCardState = {
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
          if (!isCardData(source.data)) {
            return;
          }
          if (source.data.card.id === card.id) {
            setState({type: "is-dragging-and-left-self"});
            return;
          }
          setState(cardIdle);
        },
        onDrop() {
          setState(cardIdle);
        },
      })
    );
  }, [card, columnId]);

  return (
    <>
      <CardDisplay
        outerRef={outerRef}
        innerRef={innerRef}
        state={state}
        card={card}
      />
      {state.type === "preview"
        ? createPortal(
            <CardDisplay state={state} card={card} />,
            state.container
          )
        : null}
    </>
  );
};
interface CardDisplayProps {
  card: TCard;
  state: TCardState;
  outerRef?: React.MutableRefObject<HTMLDivElement | null>;
  innerRef?: React.MutableRefObject<HTMLDivElement | null>;
}
// Drag-bares Listenelement ## DONE
const CardDisplay = ({card, state, outerRef, innerRef}: CardDisplayProps) => {
  const classes = useCustomStyles();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);

  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setContextMenuAnchorElement(event.currentTarget);
  };
  const closeContextMenue = () => {
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
          <CardShadow dragging={state.dragging} />
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
          <ListItem key={card.id} sx={classes.menueCardListItem}>
            <ListItemIcon onClick={onContextMenuClick}>
              <DragIndicatorIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{card.description}</ListItemText>
          </ListItem>
        </Box>
        {state.type === "is-over" && state.closestEdge === "bottom" ? (
          <CardShadow dragging={state.dragging} />
        ) : null}
      </Box>

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenue}
      >
        <MenuItem onClick={closeContextMenue}>
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small"></ArrowUpwardIcon>
          </ListItemIcon>
          <Typography>Hoch</Typography>
        </MenuItem>
        <MenuItem onClick={closeContextMenue}>
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small"></ArrowDownwardIcon>
          </ListItemIcon>
          <Typography>Runter</Typography>
        </MenuItem>
        <MenuItem onClick={closeContextMenue}>
          <ListItemIcon>
            <ArrowForwardIcon fontSize="small"></ArrowForwardIcon>
          </ListItemIcon>
          <Typography>in anderes Menü verschieben</Typography>
        </MenuItem>
      </Menu>
    </>
  );
};

// Schatten für während des Drags
const CardShadow = ({dragging}: {dragging: DOMRect}) => {
  const classes = useCustomStyles();
  return (
    <ListItem
      sx={classes.menueCardListItemPlaceholder}
      style={{height: dragging.height}}
    />
  );
};

export default TempPage;
