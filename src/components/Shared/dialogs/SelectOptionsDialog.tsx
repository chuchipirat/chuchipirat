import React from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  ButtonOwnProps,
} from "@mui/material";

interface SelectOption {
  key: number | string;
  text: string;
  variant?: ButtonOwnProps["variant"];
}

interface SelectOptionsDialogProps {
  visible: boolean;
  title: string;
  text: string | JSX.Element;
  buttonTextCancel: string;
  options: SelectOption[];
  onSelect: (key: number | string) => void;
  onCancel: () => void;
}

/**
 * Auswahl-Dialog — zeigt mehrere Optionen als Buttons an.
 *
 * @param visible Ob der Dialog sichtbar ist.
 * @param title Dialogtitel.
 * @param text Erklärungstext.
 * @param buttonTextCancel Text des Abbrechen-Buttons.
 * @param options Verfügbare Optionen mit Key, Text und optionaler Variante.
 * @param onSelect Callback bei Auswahl einer Option (mit dem Key der Option).
 * @param onCancel Callback bei Abbruch.
 */
export const SelectOptionsDialog = ({
  visible,
  title,
  text,
  buttonTextCancel,
  options,
  onSelect,
  onCancel,
}: SelectOptionsDialogProps) => {
  return (
    <Dialog
      open={visible}
      onClose={onCancel}
      aria-labelledby="confirm-dialog"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {text}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          {buttonTextCancel}
        </Button>
        {options.map((option) => (
          <Button
            key={"button_" + option.key}
            onClick={() => onSelect(option.key)}
            color="primary"
            variant={option.variant ? option.variant : "outlined"}
          >
            {option.text}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};
