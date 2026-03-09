/**
 * Karte für einen Mahlzeitentyp (z.B. Frühstück, Mittagessen) im Menüplan.
 *
 * Zeigt den Namen des Mahlzeitentyps mit einem Kontextmenü zum Umbenennen,
 * Löschen und Verschieben (hoch/runter).
 */
import React, {memo, useState} from "react";

import {
  Card,
  CardHeader,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
} from "@mui/icons-material";

import useCustomStyles from "../../../constants/styles";
import {
  MEAL as TEXT_MEAL,
  EDIT as TEXT_EDIT,
  DELETE as TEXT_DELETE,
  RENAME as TEXT_RENAME,
  TOOLTIP_MOVE_UP as TEXT_TOOLTIP_MOVE_UP,
  TOOLTIP_MOVE_DOWN as TEXT_TOOLTIP_MOVE_DOWN,
} from "../../../constants/text";
import Action from "../../../constants/actions";
import {MealType} from "./menuplan.types";
import {
  DragAndDropDirections,
  MenuplanDragDropTypes,
  OnMoveDragAndDropElementFx,
  OnMealTypeUpdate,
} from "./menuplan.constants";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";

/**
 * Props für die MealTypeCard-Komponente.
 *
 * @param mealType - Der anzuzeigende Mahlzeitentyp
 * @param index - Position in der Liste (für hoch/runter)
 * @param isLastElement - Ob dies das letzte Element ist
 * @param onMealTypeUpdate - Callback bei Änderungen am Mahlzeitentyp
 * @param onMoveDragAndDropElement - Callback zum Verschieben via Kontextmenü
 */
interface MealTypeCardProps {
  mealType: MealType;
  index: number;
  isLastElement: boolean;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}

/**
 * Karte für einen Mahlzeitentyp mit Kontextmenü.
 * Erlaubt Umbenennen, Löschen und Verschieben des Mahlzeitentyps.
 */
const MealTypeCard = memo(function MealTypeCard({
  mealType,
  index,
  isLastElement,
  onMealTypeUpdate,
  onMoveDragAndDropElement,
}: MealTypeCardProps) {
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);
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
  // Kontexmenü-Handler
  // ------------------------------------------ */
  const onRenameItem = async () => {
    let userInput = {valid: false, input: ""} as SingleTextInputResult;

    userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_MEAL} ${TEXT_EDIT} `,
      text: "",
      singleTextInputProperties: {
        initialValue: mealType.name,
        textInputLabel: TEXT_MEAL,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      onMealTypeUpdate({
        action: Action.EDIT,
        mealType: {...mealType, name: userInput.input},
      });
    }
    setContextMenuAnchorElement(null);
  };
  const onDeleteItem = () => {
    onMealTypeUpdate({
      action: Action.DELETE,
      mealType: mealType,
    });
    setContextMenuAnchorElement(null);
  };
  const onMoveElement = (direction: DragAndDropDirections) => {
    onMoveDragAndDropElement({
      direction: direction,
      kind: MenuplanDragDropTypes.MEALTYPE,
      itemUid: mealType.uid,
    });
    setContextMenuAnchorElement(null);
  };
  return (
    <React.Fragment>
      <Card
        key={"mealtype_card_" + mealType.uid}
        sx={classes.cardMealType}
        variant="outlined"
      >
        <CardHeader
          key={"mealtype_cardHeader_" + mealType.uid}
          action={
            <IconButton
              id={"MoreBtn_" + mealType.uid}
              aria-label="settings"
              onClick={onContextMenuClick}
              size="large"
            >
              <MoreVertIcon />
            </IconButton>
          }
          title={mealType.name}
          titleTypographyProps={{variant: "h6"}}
        />
      </Card>
      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={onRenameItem}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_RENAME}
          </Typography>
        </MenuItem>
        <MenuItem onClick={onDeleteItem}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_DELETE}
          </Typography>
        </MenuItem>
        <MenuItem onClick={() => onMoveElement("up")} disabled={index === 0}>
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
      </Menu>
    </React.Fragment>
  );
});

export default MealTypeCard;
