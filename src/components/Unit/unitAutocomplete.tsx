import React from "react";
import {useTheme} from "@mui/material/styles";

import useMediaQuery from "@mui/material/useMediaQuery";

import {TextField, Autocomplete} from "@mui/material";

import {Unit} from "./unit.class";

import {
  FIELD_UNIT,
  ABBREVIATION_UNIT,
  ERROR_NO_OPTIONS,
} from "../../constants/text";
import {AutocompleteChangeReason} from "@mui/material";
import {TextFieldSize} from "../../constants/defaultValues";

interface UnitAutocompleteProps {
  componentKey?: string;
  unitKey: Unit["key"];
  units: Unit[];
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue: Unit | null,
    action: AutocompleteChangeReason,
    objectId: string
  ) => void;
  size?: TextFieldSize;
}
// ===================================================================== */
/**
 * Autocomplete-Feld zur Auswahl einer Einheit.
 *
 * Zeigt alle verfügbaren Einheiten als Dropdown an. Auf kleinen Bildschirmen
 * wird eine abgekürzte Bezeichnung als Label verwendet.
 *
 * @param componentKey - Optionaler Schlüssel zur Unterscheidung mehrerer Instanzen.
 * @param unitKey - Schlüssel der aktuell ausgewählten Einheit.
 * @param units - Liste aller verfügbaren Einheiten.
 * @param onChange - Callback bei Auswahl einer neuen Einheit.
 * @param size - Grösse des Textfeldes (Standard: medium).
 */
const UnitAutocomplete = ({
  componentKey,
  unitKey,
  units,
  onChange,
  size = TextFieldSize.medium,
}: UnitAutocompleteProps) => {
  const theme = useTheme();
  const breakpointIsXs = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Autocomplete
      key={componentKey ? "unit_" + componentKey : "unit"}
      id={componentKey ? "unit_" + componentKey : "unit"}
      value={units.find((unit) => unit.key === unitKey) ?? null}
      options={units}
      autoSelect
      autoHighlight
      isOptionEqualToValue={(option) => option.key === unitKey}
      getOptionLabel={(option) => {
        if (typeof option === "string") {
          return option;
        }
        if (option.key) {
          return option.key;
        }
        return option.name;
      }}
      noOptionsText={ERROR_NO_OPTIONS}
      onChange={(event, newValue, action) => {
        onChange(
          event as unknown as React.ChangeEvent<HTMLInputElement>,
          newValue,
          action,
          componentKey ? "unit_" + componentKey : "unit"
        );
      }}
      fullWidth
      renderInput={(params) => (
        <TextField
          {...params}
          size={size}
          label={breakpointIsXs ? ABBREVIATION_UNIT : FIELD_UNIT}
        />
      )}
    />
  );
};
export {UnitAutocomplete};
