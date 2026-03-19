import React from "react";
import useCustomStyles from "../../constants/styles";

import {
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  TextField,
} from "@mui/material";

interface FormListItemProps {
  value: string | number | Date | JSX.Element | JSX.Element[];
  id: string;
  label: string;
  icon?: JSX.Element;
  type?: string;
  multiLine?: boolean;
  disabled?: boolean;
  required?: boolean;
  editMode?: boolean;
  helperText?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  displayAsCode?: boolean;
  withDivider?: boolean;
  secondaryAction?: JSX.Element;
  endAdornment?: JSX.Element;
}

export const FormListItem = ({
  value,
  id,
  label,
  icon,
  type,
  multiLine = false,
  disabled = false,
  required = false,
  editMode = false,
  withDivider = true,
  helperText = "",
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
        {editMode ? (
          <TextField
            id={id}
            key={id}
            name={id}
            type={type}
            InputProps={{
              ...{endAdornment: endAdornment},
              ...{inputProps: {min: 0}},
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
