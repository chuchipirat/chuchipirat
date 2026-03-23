import React from "react";
import {createPortal} from "react-dom";
import {DialogType, useCustomDialog} from "./customDialogContext";
import {ConfirmDialog} from "./dialogs/ConfirmDialog";
import {SingleTextInputDialog} from "./dialogs/SingleTextInputDialog";
import {ConfirmSecureDialog} from "./dialogs/ConfirmSecureDialog";
import {SelectOptionsDialog} from "./dialogs/SelectOptionsDialog";

/**
 * Globaler Dialog — rendert den aktuell sichtbaren Dialog-Typ
 * (Confirm, SingleTextInput, ConfirmSecure, SelectOptions) via Portal.
 * Delegiert das Rendering an spezialisierte Sub-Komponenten.
 */
const CustomDialog = () => {
  const {dialogState, onConfirm, onCancel} = useCustomDialog();
  const portalElement = document.getElementById("portal");

  const renderDialog = () => {
    if (!dialogState.visible) return null;

    switch (dialogState.dialogType) {
      case DialogType.Confirm:
        return (
          <ConfirmDialog
            visible={dialogState.visible}
            title={dialogState.title}
            text={dialogState.text}
            buttonTextConfirm={dialogState.buttonTextConfirm}
            buttonTextCancel={dialogState.buttonTextCancel}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        );

      case DialogType.SingleTextInput:
        return (
          <SingleTextInputDialog
            visible={dialogState.visible}
            title={dialogState.title}
            text={dialogState.text}
            buttonTextConfirm={dialogState.buttonTextConfirm}
            buttonTextCancel={dialogState.buttonTextCancel}
            initialValue={
              dialogState.singleTextInputProperties?.initialValue
            }
            textInputLabel={
              dialogState.singleTextInputProperties?.textInputLabel
            }
            textInputMultiline={
              dialogState.singleTextInputProperties?.textInputMultiline
            }
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        );

      case DialogType.ConfirmSecure:
        return (
          <ConfirmSecureDialog
            visible={dialogState.visible}
            title={dialogState.title}
            subtitle={dialogState.subtitle}
            text={dialogState.text}
            buttonTextConfirm={dialogState.buttonTextConfirm}
            buttonTextCancel={dialogState.buttonTextCancel}
            confirmationString={
              dialogState.deletionDialogProperties?.confirmationString
            }
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        );

      case DialogType.SelectOptions:
        return (
          <SelectOptionsDialog
            visible={dialogState.visible}
            title={dialogState.title}
            text={dialogState.text}
            buttonTextCancel={dialogState.buttonTextCancel}
            options={dialogState.options}
            onSelect={onConfirm}
            onCancel={onCancel}
          />
        );

      default:
        return null;
    }
  };

  return createPortal(renderDialog(), portalElement ?? document.body);
};

export {CustomDialog};
