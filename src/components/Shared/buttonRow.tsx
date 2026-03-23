import React from "react";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";

import {ButtonTypeMap} from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";

import useMediaQuery from "@mui/material/useMediaQuery";

import ClickAwayListener from "@mui/material/ClickAwayListener";
import Grow from "@mui/material/Grow";
import Paper from "@mui/material/Paper";
import Popper from "@mui/material/Popper";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuList from "@mui/material/MenuList";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import {useTheme} from "@mui/material";
import {useCustomStyles} from "../../constants/styles";

/**
 * Konfiguration für einen einzelnen Button in der ButtonRow.
 *
 * @param id Eindeutige ID des Buttons.
 * @param label Beschriftung des Buttons.
 * @param hero Ob der Button als Hero-Button (grösser) dargestellt wird.
 * @param variant MUI-Variante (contained, outlined, text).
 * @param color MUI-Farbe.
 * @param onClick Klick-Handler.
 * @param disabled Ob der Button deaktiviert ist.
 * @param visible Ob der Button sichtbar ist.
 * @param startIcon Optionales Icon links vom Label.
 */
export interface CustomButton {
  id: string;
  label: string;
  hero: boolean;
  variant: ButtonTypeMap["props"]["variant"];
  color: ButtonTypeMap["props"]["color"];
  onClick: (event?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  visible: boolean;
  startIcon?: JSX.Element;
}

interface ButtonRowProps {
  buttons: CustomButton[];
  buttonGroup?: CustomButton[];
  splitButtons?: CustomButton[];
}

/* ===================================================================
// ============================= Button Row ==========================
// =================================================================== */
/**
 * Responsive Button-Zeile mit optionalem Overflow-Menü, Button-Gruppen
 * und Split-Buttons. Buttons werden je nach Bildschirmbreite in ein
 * Overflow-Menü verschoben.
 *
 * @param buttons Hauptbuttons.
 * @param buttonGroup Optionale zusammengehörende Buttons.
 * @param splitButtons Optionale Split-Buttons (Haupt-Aktion + Dropdown).
 */
const ButtonRow = ({buttons, buttonGroup, splitButtons}: ButtonRowProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  /* ------------------------------------------
  // Split-Button
  // ------------------------------------------ */
  const [splitButtonMenuOpen, setSplitButtonMenuOpen] = React.useState(false);
  const splitButtonAnchor = React.useRef<HTMLDivElement>(null);
  const [selectedSplitButtonIndex, setSelectedSplitButtonIndex] =
    React.useState(0);

  const handleSplitButtonClick = () => {
    if (splitButtons) {
      splitButtons[selectedSplitButtonIndex].onClick();
    }
  };
  const handleSplitButtonMenuItemClick = (
    _event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    index: number
  ) => {
    if (splitButtons) {
      setSelectedSplitButtonIndex(index);
      // und gleich ausführen
      splitButtons[index].onClick();
      setSplitButtonMenuOpen(false);
    }
  };
  const handleSplitButtonToggle = () => {
    setSplitButtonMenuOpen((prevOpen) => !prevOpen);
  };
  const handleSplitButtonMenuClose = (event: MouseEvent | TouchEvent) => {
    if (
      splitButtonAnchor.current &&
      splitButtonAnchor.current.contains(event.target as HTMLElement)
    ) {
      return;
    }
    setSplitButtonMenuOpen(false);
  };
  /* ------------------------------------------
  // Vert-More Icon-Button
  // ------------------------------------------ */
  const [vertMoreAnchor, setVertMoreAnchor] =
    React.useState<null | HTMLElement>(null);

  const handleVertMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setVertMoreAnchor(event.currentTarget);
  };
  const handleVertMoreMenuClose = () => {
    setVertMoreAnchor(null);
  };
  const onMenuItemClick = (menuFunction: () => void) => {
    menuFunction();
    setVertMoreAnchor(null);
  };

  // Bestimme, wie viele Buttons sichtbar bleiben und welche ins Overflow wandern
  const isXSBreakPoint = useMediaQuery(theme.breakpoints.down("sm"));
  const isSMBreakPoint = useMediaQuery(theme.breakpoints.down("md"));
  const isMdBreakPoint = useMediaQuery(theme.breakpoints.down("lg"));

  let noOfVisibleButtons: number;
  if (isXSBreakPoint && buttons.length > 1) {
    noOfVisibleButtons = 2;
  } else if (isSMBreakPoint && buttons.length > 3) {
    noOfVisibleButtons = 3;
  } else if (isMdBreakPoint && buttons.length > 4) {
    noOfVisibleButtons = 4;
  } else {
    noOfVisibleButtons = buttons.length;
  }

  // Keine Mutation des Parameters — eigene Arrays für sichtbare und Overflow-Buttons
  const visibleButtons = buttons.slice(0, noOfVisibleButtons);
  const overflowItems = buttons.slice(noOfVisibleButtons);

  return (
    <React.Fragment>
      <Grid container justifyContent="center">
        {visibleButtons.map((button) => (
          <Grid key={"grid_" + button.id}>
            {button.visible && (
              <Button
                sx={button.hero ? classes.heroButton : classes.button}
                aria-label={button.label}
                id={button.id}
                key={button.id}
                variant={button.variant}
                color={button.color}
                onClick={button.onClick}
                disabled={button.disabled}
                startIcon={button.startIcon}
              >
                {button.label}
              </Button>
            )}
          </Grid>
        ))}
        {/* Nur sichtbare zählen */}
        {overflowItems.reduce(
          (counter, button) => (button.visible ? counter + 1 : counter),
          0
        ) > 0 && (
          <React.Fragment>
            <IconButton
              aria-label="more"
              aria-controls="long-menu"
              aria-haspopup="true"
              onClick={handleVertMoreClick}
              size="small"
            >
              <MoreVertIcon />
            </IconButton>

            <Menu
              id="simple-menu"
              anchorEl={vertMoreAnchor}
              keepMounted
              open={Boolean(vertMoreAnchor)}
              onClose={handleVertMoreMenuClose}
            >
              {overflowItems.map(
                (menuItem) =>
                  menuItem.visible && (
                    <MenuItem
                      key={menuItem.id}
                      onClick={() => onMenuItemClick(menuItem.onClick)}
                    >
                      {menuItem.label}
                    </MenuItem>
                  )
              )}
            </Menu>
          </React.Fragment>
        )}
        {buttonGroup && (
          <Grid key={"grid_buttonGroup"}>
            <ButtonGroup
              id="buttonGroup"
              color="primary"
              sx={classes.heroButton}
            >
              {buttonGroup.map((button) => (
                <Button
                  id={button.id}
                  key={button.id}
                  onClick={button.onClick}
                  disabled={button.disabled}
                >
                  {button.label}
                </Button>
              ))}
            </ButtonGroup>
          </Grid>
        )}
        {splitButtons && (
          <Grid key={"grid_splitButton"}>
            <ButtonGroup
              sx={classes.heroButton}
              variant="outlined"
              color="primary"
              ref={splitButtonAnchor}
            >
              <Button id="splitButton" onClick={handleSplitButtonClick}>
                {splitButtons[selectedSplitButtonIndex].label}
              </Button>
              <Button
                id="ButtonarrowDropDown"
                color="primary"
                size="small"
                aria-controls={
                  splitButtonMenuOpen ? "split-button-menu" : undefined
                }
                aria-expanded={splitButtonMenuOpen ? "true" : undefined}
                aria-haspopup="menu"
                onClick={handleSplitButtonToggle}
              >
                <ArrowDropDownIcon />
              </Button>
            </ButtonGroup>
            <Popper
              open={splitButtonMenuOpen}
              anchorEl={splitButtonAnchor.current}
              role={undefined}
              transition
            >
              {({TransitionProps, placement}) => (
                <Grow
                  {...TransitionProps}
                  style={{
                    transformOrigin:
                      placement === "bottom" ? "center top" : "center bottom",
                  }}
                >
                  <Paper>
                    <ClickAwayListener onClickAway={handleSplitButtonMenuClose}>
                      <MenuList id="split-button-menu">
                        {splitButtons.map(
                          (button, index) =>
                            button.visible && (
                              <MenuItem
                                key={button.id}
                                selected={index === selectedSplitButtonIndex}
                                onClick={(event) =>
                                  handleSplitButtonMenuItemClick(event, index)
                                }
                                disabled={button.disabled}
                              >
                                {button.label}
                              </MenuItem>
                            )
                        )}
                      </MenuList>
                    </ClickAwayListener>
                  </Paper>
                </Grow>
              )}
            </Popper>
          </Grid>
        )}
      </Grid>
    </React.Fragment>
  );
};

export {ButtonRow};
