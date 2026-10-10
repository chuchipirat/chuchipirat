import React from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  text: string | JSX.Element;
  buttonTextConfirm: string;
  buttonTextCancel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Einfacher Bestätigungsdialog mit Bestätigen/Abbrechen-Buttons.
 *
 * @param visible Ob der Dialog sichtbar ist.
 * @param title Dialogtitel.
 * @param text Dialogtext.
 * @param buttonTextConfirm Text des Bestätigen-Buttons.
 * @param buttonTextCancel Text des Abbrechen-Buttons.
 * @param destructive Bestätigung löscht oder verwirft etwas: Bestätigen-Button
 *   rot, Fokus auf "Abbrechen" (Enter löst so nicht versehentlich das Löschen aus).
 * @param onConfirm Callback bei Bestätigung.
 * @param onCancel Callback bei Abbruch.
 */
export const ConfirmDialog = ({
  visible,
  title,
  text,
  buttonTextConfirm,
  buttonTextCancel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  return (
    <Dialog
      open={visible}
      onClose={(_event, reason) => reason !== "backdropClick" && onCancel()}
      aria-labelledby="confirm-dialog"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {text}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary" autoFocus={destructive}>
          {buttonTextCancel}
        </Button>
        <Button
          onClick={onConfirm}
          color={destructive ? "error" : "primary"}
          variant={destructive ? "contained" : "text"}
          autoFocus={!destructive}
        >
          {buttonTextConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
