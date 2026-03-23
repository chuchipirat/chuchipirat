import React from "react";
import {useReducer, useContext} from "react";
import {OK as TEXT_OK, CANCEL as TEXT_CANCEL} from "../../constants/text";
import {ButtonOwnProps} from "@mui/material";

// Danke an https://devrecipes.net/custom-confirm-dialog-with-react-hooks-and-the-context-api/

/**
 * Typ des angezeigten Dialogs.
 */
export enum DialogType {
  None,
  Confirm,
  SingleTextInput,
  ConfirmSecure,
  SelectOptions,
}

const CUSTOM_DIALOG_INITIAL_STATE: State = {
  dialogType: DialogType.None,
  visible: false,
  text: "",
  title: "",
  subtitle: "",
  buttonTextConfirm: "",
  buttonTextCancel: "",
  options: [],
};

const CustomDialogContext = React.createContext({
  dialogState: CUSTOM_DIALOG_INITIAL_STATE,
  dispatch: (_value: DispatchAction) => {
    // Platzhalter — wird vom Provider überschrieben
  },
});

/**
 * Ergebnis eines SingleTextInput-Dialogs.
 *
 * @param valid `true` wenn der Benutzer bestätigt hat, `false` bei Abbruch.
 * @param input Der eingegebene Text.
 */
export interface SingleTextInputResult {
  valid: boolean;
  input: string;
}
/* ===================================================================
// ========================= Context Provider ========================
// =================================================================== */
enum ReducerActions {
  SHOW_DIALOG = "SHOW_DIALOG",
  HIDE_DIALOG = "HIDE_DIALOG",
}

type DispatchAction = {
  type: ReducerActions;
  payload?: State;
};

type Option = {
  key: number | string;
  text: string;
  variant?: ButtonOwnProps["variant"];
};

type State = {
  dialogType: DialogType;
  visible: boolean;
  title: string;
  text: string | JSX.Element;
  subtitle: string;
  buttonTextConfirm: string;
  buttonTextCancel: string;
  deletionDialogProperties?: DeletionDialogProperties;
  singleTextInputProperties?: SingleTextInputProperties;
  options: Option[];
};

interface DeletionDialogProperties {
  confirmationString: string;
}

interface SingleTextInputProperties {
  initialValue: string;
  textInputLabel: string;
  textInputMultiline?: boolean;
}

interface DialogContentProps {
  dialogType: DialogType;
  title?: string;
  text?: string | JSX.Element;
  subtitle?: string;
  buttonTextConfirm?: string;
  buttonTextCancel?: string;
  deletionDialogProperties?: DeletionDialogProperties;
  singleTextInputProperties?: SingleTextInputProperties;
  options?: Option[];
}

const reducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SHOW_DIALOG:
      return {
        ...action.payload!,
        visible: true,
      };
    case ReducerActions.HIDE_DIALOG:
      return CUSTOM_DIALOG_INITIAL_STATE;
    default:
      return CUSTOM_DIALOG_INITIAL_STATE;
  }
};

interface CustomDialogContextProviderProps {
  children: JSX.Element;
}

/**
 * Provider für den globalen Dialog-Kontext.
 * Stellt `dialogState` und `dispatch` für alle Kinder bereit.
 *
 * @param children Kinder-Elemente, die Zugriff auf den Dialog-Kontext erhalten.
 */
export const CustomDialogContextProvider = ({
  children,
}: CustomDialogContextProviderProps) => {
  const [state, dispatch] = useReducer(reducer, CUSTOM_DIALOG_INITIAL_STATE);

  return (
    <CustomDialogContext.Provider
      value={{
        dialogState: state,
        dispatch: dispatch,
      }}
    >
      {children}
    </CustomDialogContext.Provider>
  );
};

/* ===================================================================
// ========================== Confirm Promise ========================
// =================================================================== */
let resolveCallback:
  | ((value: boolean | SingleTextInputResult | string | number) => void)
  | undefined;

/**
 * Hook für den Custom-Dialog. Stellt `customDialog`, `onConfirm`,
 * `onCancel` und den aktuellen `dialogState` bereit.
 *
 * @returns Objekt mit Dialog-Funktionen und -Zustand.
 */
export const useCustomDialog = () => {
  const {dialogState, dispatch} = useContext(CustomDialogContext);
  const onConfirm = (input?: string | number) => {
    closeDialog();
    if (typeof input === "string" || typeof input === "number") {
      resolveCallback?.({valid: true, input: String(input)});
    } else {
      resolveCallback?.(true);
    }
  };

  const onCancel = (input?: string | number) => {
    closeDialog();
    if (typeof input === "string" || typeof input === "number") {
      resolveCallback?.({valid: false, input: ""});
    } else {
      resolveCallback?.(false);
    }
  };
  const customDialog = ({
    dialogType,
    title,
    text,
    subtitle,
    buttonTextCancel,
    buttonTextConfirm,
    deletionDialogProperties,
    singleTextInputProperties,
    options,
  }: DialogContentProps) => {
    dispatch({
      type: ReducerActions.SHOW_DIALOG,
      payload: {
        dialogType: dialogType,
        title: title,
        text: text,
        subtitle: subtitle ? subtitle : "",
        buttonTextConfirm: buttonTextConfirm ? buttonTextConfirm : TEXT_OK,
        buttonTextCancel: buttonTextCancel ? buttonTextCancel : TEXT_CANCEL,
        deletionDialogProperties: deletionDialogProperties,
        singleTextInputProperties: singleTextInputProperties,
        options: options,
      } as State,
    });
    return new Promise((res) => {
      resolveCallback = res;
    });
  };

  const closeDialog = () => {
    dispatch({
      type: ReducerActions.HIDE_DIALOG,
    });
  };

  return {customDialog, onConfirm, onCancel, dialogState};
};

export {CustomDialogContext};
