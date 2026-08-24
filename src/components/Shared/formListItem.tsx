import React from "react";
import {useCustomStyles} from "../../constants/styles";

import {
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  TextField,
  Box,
  Switch,
} from "@mui/material";

/**
 * Eigenschaften für ein einzelnes Formularelement in einer Liste.
 *
 * @param value Anzuzeigender Wert (Text, Zahl, Datum oder JSX). Bei `type="switch"` ungenutzt.
 * @param id Eindeutige ID des Feldes.
 * @param label Beschriftung / Label.
 * @param icon Optionales Icon links.
 * @param type HTML-Input-Typ (z.B. "number", "text") oder "switch" für einen Ein/Aus-Schalter.
 * @param checked Schalterzustand — nur bei `type="switch"` verwendet.
 * @param multiLine Mehrzeilige Eingabe erlauben.
 * @param disabled Feld deaktivieren.
 * @param required Feld als Pflichtfeld markieren.
 * @param editMode Bearbeitungsmodus (TextField) statt Anzeige (ListItemText). Bei `type="switch"` ignoriert.
 * @param helperText Hilfetext unter dem Feld.
 * @param onChange Änderungs-Handler (bei `type="switch"` liefert `event.target.checked` den neuen Zustand).
 * @param displayAsCode Wert als Code-Schrift anzeigen.
 * @param withDivider Trennlinie nach dem Eintrag anzeigen.
 * @param secondaryAction Optionale sekundäre Aktion (z.B. IconButton).
 * @param endAdornment Optionales Element am Ende des Eingabefeldes.
 * @param maxLength Maximale Zeichenlänge für das Eingabefeld.
 */
interface FormListItemProps {
  value?: string | number | Date | JSX.Element | JSX.Element[];
  id: string;
  label: string;
  icon?: JSX.Element;
  type?: string;
  checked?: boolean;
  multiLine?: boolean;
  disabled?: boolean;
  required?: boolean;
  editMode?: boolean;
  helperText?: string;
  maxLength?: number;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  displayAsCode?: boolean;
  withDivider?: boolean;
  secondaryAction?: JSX.Element;
  endAdornment?: JSX.Element;
}

/**
 * Formular-Listeneintrag — zeigt im Bearbeitungsmodus ein TextField,
 * im Ansichtsmodus einen ListItemText mit Label und Wert.
 */
export const FormListItem = ({
  value,
  id,
  label,
  icon,
  type,
  checked,
  multiLine = false,
  disabled = false,
  required = false,
  editMode = false,
  withDivider = true,
  helperText = "",
  maxLength,
  onChange,
  displayAsCode,
  secondaryAction,
  endAdornment,
}: FormListItemProps) => {
  const classes = useCustomStyles();
  return (
    <React.Fragment>
      <ListItem key={"listItem_" + id}>
        {icon && <ListItemIcon sx={classes.listItemIcon}>{icon}</ListItemIcon>}
        {type === "switch" ? (
          <React.Fragment>
            <ListItemText sx={classes.listItemTitle} secondary={label} />
            <Box sx={classes.listItemContent}>
              <Switch
                id={id}
                name={id}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
              />
            </Box>
          </React.Fragment>
        ) : editMode ? (
          <TextField
            id={id}
            key={id}
            name={id}
            type={type}
            slotProps={{
              input: {
                endAdornment: endAdornment,
                inputProps: {min: 0, ...(maxLength ? {maxLength} : {})},
              },
            }}
            label={label}
            disabled={disabled}
            required={required}
            autoComplete={id}
            value={value}
            onChange={onChange}
            multiline={multiLine}
            helperText={helperText}
            fullWidth
            margin="dense"
          />
        ) : (
          <React.Fragment>
            {/* Nur Möglichkeit von JSX Element oder von einfachem Text.. alles andere wird overhead */}
            <ListItemText sx={classes.listItemTitle} secondary={label} />
            {typeof value === "string" ? (
              <ListItemText
                sx={classes.listItemContent}
                primary={value}
                primaryTypographyProps={
                  displayAsCode
                    ? {sx: classes.typographyCode}
                    : undefined
                }
              />
            ) : value instanceof Date ? (
              <ListItemText sx={classes.listItemContent}>
                {value.toLocaleString("de-CH", {
                  dateStyle: "medium",
                })}
              </ListItemText>
            ) : (
              <ListItemText sx={classes.listItemContent}>{value}</ListItemText>
            )}
            {secondaryAction && (
              <ListItemSecondaryAction>
                {secondaryAction}
              </ListItemSecondaryAction>
            )}
          </React.Fragment>
        )}
      </ListItem>
      {!editMode && withDivider && <Divider component="li" />}
    </React.Fragment>
  );
};
