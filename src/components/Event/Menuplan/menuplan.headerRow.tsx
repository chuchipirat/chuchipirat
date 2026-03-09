/**
 * Kopfzeile des Menüplans mit Tages-Überschriften und Einstellungen.
 *
 * Zeigt die Tage als Karten mit Kontextmenü (Notiz hinzufügen/bearbeiten/löschen),
 * sowie Schalter für Detail-Anzeige und Drag & Drop.
 */
import React, {useState, useEffect} from "react";

import {
  Box,
  Container,
  Switch,
  Button,
  Card,
  FormGroup,
  FormControlLabel,
  CardHeader,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  CardContent,
  useTheme,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

import useCustomStyles from "../../../constants/styles";
import {
  SHOW_DETAILS as TEXT_SHOW_DETAILS,
  ENABLE_DRAG_AND_DROP as TEXT_ENABLE_DRAG_AND_DROP,
  ADD_MEAL as TEXT_ADD_MEAL,
  MEAL as TEXT_MEAL,
  NOTE as TEXT_NOTE,
  EDIT as TEXT_EDIT,
  ADD as TEXT_ADD,
  DELETE as TEXT_DELETE,
  PRINTVERSION as TEXT_PRINTVERSION,
} from "../../../constants/text";
import Action from "../../../constants/actions";
import Utils from "../../Shared/utils.class";
import {Note, MenuplanData} from "./menuplan.types";
import {createMealType, createEmptyNote} from "./menuplanService";
import {MenuplanSettings, OnNoteUpdate, OnMealTypeUpdate} from "./menuplan.constants";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";

/**
 * Props für die Menüplan-Kopfzeile.
 *
 * @param dates - Sortierte Liste der Tage
 * @param notes - Notizen
 * @param menuplanSettings - Aktuelle Einstellungen
 * @param onSwitchShowDetails - Callback für Detail-Schalter
 * @param onSwitchEnableDragAndDrop - Callback für DnD-Schalter
 * @param onMealTypeUpdate - Callback bei Mahlzeitentyp-Änderungen
 * @param onNoteUpdate - Callback bei Notiz-Änderungen
 * @param onPrint - Callback für PDF-Export
 */
interface MenuplanHeaderRowProps {
  dates: MenuplanData["dates"];
  notes: MenuplanData["notes"];
  menuplanSettings: MenuplanSettings;
  onSwitchShowDetails: () => void;
  onSwitchEnableDragAndDrop: () => void;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onPrint: () => void;
}

/**
 * State für das Kontextmenü einer Tages-Spalte.
 *
 * @param date - Datum der Spalte
 * @param note - Vorhandene Notiz (oder undefined)
 */
interface DaysRowContextMenuState {
  date: string;
  note: Note | undefined;
}

const CONTEXT_MENU_INITIAL_STATE: DaysRowContextMenuState = {
  date: "",
  note: undefined,
};

/**
 * Sticky-Kopfzeile des Menüplans.
 * Enthält Einstellungs-Schalter, Tages-Spalten mit Kontextmenü und PDF-Export-Button.
 */
const MenuplanHeaderRow = ({
  dates,
  notes,
  menuplanSettings,
  onSwitchShowDetails,
  onSwitchEnableDragAndDrop,
  onMealTypeUpdate,
  onNoteUpdate,
  onPrint,
}: MenuplanHeaderRowProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);

  const [contextMenuState, setContextMenuState] =
    useState<DaysRowContextMenuState>(CONTEXT_MENU_INITIAL_STATE);
  const [scrolled, setScrolled] = useState(false);

  /* ------------------------------------------
  // Button-Handling
  // ------------------------------------------ */
  const onAddMeal = async () => {
    let userInput = {valid: false, input: ""} as SingleTextInputResult;

    userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_MEAL} ${TEXT_ADD} `,
      singleTextInputProperties: {
        initialValue: "",
        textInputLabel: TEXT_MEAL,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      const newMealType = createMealType({
        newMealName: userInput.input,
      });
      onMealTypeUpdate({action: Action.ADD, mealType: newMealType});
    }
  };
  /* ------------------------------------------
  // Scroll-Listener für Sticky Header
  // ------------------------------------------ */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 64);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ------------------------------------------
  // Kontext-Menü
  // ------------------------------------------ */
  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    const selectedDate = Utils.dateAsString(
      new Date(event.currentTarget.id.split("_")[1]),
    );

    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuState({
      date: selectedDate,
      note: Object.values(notes).find((note) => note.date == selectedDate),
    });
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
  };
  const onDeleteNote = () => {
    if (!contextMenuState.note) {
      return;
    }
    onNoteUpdate({
      action: Action.DELETE,
      note: contextMenuState.note,
    });
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
    setContextMenuAnchorElement(null);
  };
  const onModifyNote = async () => {
    // Input holen
    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_NOTE} ${
        contextMenuState.note?.text ? TEXT_EDIT : TEXT_ADD
      }`,
      text: "",
      singleTextInputProperties: {
        initialValue: contextMenuState.note?.text
          ? contextMenuState.note.text
          : "",
        textInputLabel: TEXT_NOTE,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      // Notiz anlegen resp. ändern
      let note: Note;
      if (!contextMenuState.note?.uid) {
        note = createEmptyNote();
        note.date = contextMenuState.date as string;
      } else {
        note = contextMenuState.note;
      }
      note.text = userInput.input;

      onNoteUpdate({
        action: contextMenuState.note?.uid ? Action.EDIT : Action.ADD,
        note: note,
      });
    }
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
    setContextMenuAnchorElement(null);
  };
  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        "&::after": scrolled
          ? {
              content: '""',
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: "10px",
              background:
                "linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0))",
              pointerEvents: "none",
            }
          : {},
      }}
    >
      <Container
        sx={classes.menuplanItem}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexWrap: "nowrap",
          justifyContent: "center",
          padding: theme.spacing(1),
          paddingBottom: theme.spacing(2),
        }}
      >
        <FormGroup style={{marginBottom: "1em"}}>
          <FormControlLabel
            control={
              <Switch
                checked={menuplanSettings.showDetails}
                onChange={onSwitchShowDetails}
              />
            }
            label={TEXT_SHOW_DETAILS}
          />
          <FormControlLabel
            control={
              <Switch
                checked={menuplanSettings.enableDragAndDrop}
                onChange={onSwitchEnableDragAndDrop}
              />
            }
            label={TEXT_ENABLE_DRAG_AND_DROP}
          />
        </FormGroup>
        <Button
          color="primary"
          onClick={onAddMeal}
          variant="outlined"
          size="small"
          style={{marginBottom: "1em"}}
        >
          {TEXT_ADD_MEAL}
        </Button>
        <Button
          color="primary"
          onClick={onPrint}
          size="small"
          variant="outlined"
        >
          {TEXT_PRINTVERSION}
        </Button>
      </Container>

      {dates.map((date) => {
        const note = Object.values(notes).find(
          (note) =>
            note.date == Utils.dateAsString(date) && note.menueUid == "",
        );
        return (
          <Container
            sx={classes.menuplanItem}
            key={"dayCardContainer_" + date}
            data-date={Utils.dateAsString(date)}
            style={{
              display: "flex",
              padding: theme.spacing(1),
              paddingBottom: theme.spacing(2),
            }}
          >
            <Card
              key={"date_card_" + date}
              sx={classes.cardDate}
              style={{width: "100%"}}
              variant="outlined"
            >
              <CardHeader
                key={"date_cardHeader_" + date}
                align="center"
                action={
                  <IconButton
                    id={"MoreBtn_" + date}
                    aria-label="settings"
                    onClick={onContextMenuClick}
                    size="large"
                  >
                    <MoreVertIcon />
                  </IconButton>
                }
                title={date.toLocaleString("default", {weekday: "long"})}
                titleTypographyProps={{variant: "h6"}}
                subheader={date.toLocaleString("de-CH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              />
              {note && (
                <CardContent>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    align="center"
                  >
                    <em>{note.text}</em>
                  </Typography>
                </CardContent>
              )}
            </Card>
          </Container>
        );
      })}

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        {/* Entweder ist es leer --> dann nur hinzufügen --> sonst ändern und löschen*/}
        <MenuItem onClick={onModifyNote}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {`${TEXT_NOTE} ${contextMenuState.note ? TEXT_EDIT : TEXT_ADD}`}
          </Typography>
        </MenuItem>

        {contextMenuState.note && (
          <MenuItem onClick={onDeleteNote}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <Typography variant="inherit" noWrap>
              {`${TEXT_NOTE} ${TEXT_DELETE}`}
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default MenuplanHeaderRow;
