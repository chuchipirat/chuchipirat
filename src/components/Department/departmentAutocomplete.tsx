import React from "react";
import TextField from "@mui/material/TextField";

import {Autocomplete, AutocompleteChangeReason} from "@mui/material";

import {
  ITEM_CANT_BE_CHANGED,
  DEPARTMENT,
  ERROR_NO_OPTIONS,
} from "../../constants/text";
import {DepartmentDomain} from "../Database/Repository/DepartmentRepository";
import {TextFieldSize} from "../../constants/defaultValues";

/**
 * Props für die {@link DepartmentAutocomplete}-Komponente.
 *
 * @param componentKey - Optionaler Schlüssel zur Unterscheidung mehrerer Instanzen.
 * @param department - Aktuell ausgewählte Abteilung (oder null).
 * @param departments - Liste aller verfügbaren Abteilungen.
 * @param label - Optionales Label (Standard: "Abteilung").
 * @param disabled - Ob das Feld deaktiviert ist.
 * @param onChange - Callback bei Auswahl einer neuen Abteilung.
 * @param error - Optionales Fehlerobjekt mit isError-Flag und Fehlertext.
 * @param size - Optionale Textfeldgrösse (Standard: medium).
 */
interface DepartmentAutocompleteProps {
  componentKey?: string;
  department: DepartmentDomain | null;
  departments: DepartmentDomain[];
  label?: string;
  disabled: boolean;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue: DepartmentDomain | null,
    action: AutocompleteChangeReason,
    objectId: string
  ) => void;
  error?: {isError: boolean; errorText: string};
  size?: TextFieldSize;
}

/**
 * Autocomplete-Feld zur Auswahl einer Abteilung.
 *
 * Zeigt alle verfügbaren Abteilungen als Dropdown an und erlaubt die
 * Auswahl per Eingabe oder Klick. Im deaktivierten Zustand wird ein
 * Hinweistext angezeigt.
 *
 * @param componentKey - Optionaler Schlüssel zur Unterscheidung mehrerer Instanzen.
 * @param department - Aktuell ausgewählte Abteilung (oder null).
 * @param departments - Liste aller verfügbaren Abteilungen.
 * @param label - Optionales Label (Standard: "Abteilung").
 * @param disabled - Ob das Feld deaktiviert ist.
 * @param onChange - Callback bei Auswahl einer neuen Abteilung.
 * @param error - Optionales Fehlerobjekt mit isError-Flag und Fehlertext.
 * @param size - Optionale Textfeldgrösse (Standard: medium).
 */
export const DepartmentAutocomplete = ({
  componentKey,
  department,
  departments,
  label = DEPARTMENT,
  disabled,
  onChange,
  error,
  size = TextFieldSize.medium,
}: DepartmentAutocompleteProps) => {
  return (
    <Autocomplete
      key={componentKey ? "department_" + componentKey : "department"}
      id={componentKey ? "department_" + componentKey : "department"}
      value={department}
      options={departments}
      autoSelect
      autoHighlight
      getOptionLabel={(option) => {
        if (typeof option === "string") {
          return option;
        }
        if (option == undefined || !option?.name) {
          return "";
        }
        return option.name;
      }}
      noOptionsText={ERROR_NO_OPTIONS}
      disabled={disabled}
      onChange={(event, newValue, action) => {
        onChange(
          event as unknown as React.ChangeEvent<HTMLInputElement>,
          newValue,
          action,
          componentKey ? "department_" + componentKey : "department"
        );
      }}
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error?.isError}
          helperText={
            error?.isError
              ? error.errorText
              : disabled
              ? ITEM_CANT_BE_CHANGED
              : ""
          }
          size={size}
        />
      )}
    />
  );
};
