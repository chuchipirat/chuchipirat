import React from "react";

import {
  Dialog,
  Button,
  Card,
  CardHeader,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Radio,
  RadioGroup,
  Box,
  useTheme,
} from "@mui/material";

import {Meal, MenuplanData} from "./menuplan.types";
import {Utils} from "../../Shared/utils.class";
import {useCustomStyles} from "../../../constants/styles";

import {
  CONTINUE as TEXT_CONTINUE,
  CANCEL as TEXT_CANCEL,
} from "../../../constants/text";
import {getMealForMealTypeAndDate} from "./dialogSelectMenues";

// ===================================================================
// ============================== Global =============================
// =================================================================== */

interface DialogSelectMealsProps {
  open: boolean;
  title: string;
  dates: MenuplanData["dates"];
  mealTypes: MenuplanData["mealTypes"];
  meals: MenuplanData["meals"];
  onClose: () => void;
  onConfirm: (mealUid: Meal["uid"]) => void;
}

export const DialogSelectMeals = ({
  open,
  title,
  dates,
  mealTypes,
  meals,
  onConfirm,
  onClose,
}: DialogSelectMealsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const [selectedMeal, setSelectedMeal] = React.useState<Meal["uid"] | null>(
    null
  );

  // ------------------------------------------
  // Helpers
  // ------------------------------------------

  // ------------------------------------------
  // Change-Events
  // ------------------------------------------
  const onRadioChange = (
    _: React.ChangeEvent<HTMLInputElement>,
    value: string
  ) => {
    setSelectedMeal(value);
  };

  // ------------------------------------------
  // OK / Close
  // ------------------------------------------
  const onOkClick = () => {
    if (!selectedMeal) return;

    onConfirm(selectedMeal);
  };

  const onCloseClick = () => {
    setSelectedMeal(null);
    onClose();
  };

  // ------------------------------------------
  // Grid styles (einheitlich)
  // ------------------------------------------
  const rowGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${dates.length}, 1fr)`,
    gap: "8px",
  };

  return (
    <Dialog open={open} maxWidth="xl">
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        {/* Header-Zeile: Wochentage / Datum */}
        <Box sx={classes.dialogSelectMenueRow} style={rowGridStyle}>
          {dates.map((date) => (
            <Box
              sx={classes.dialogSelectMenueItem}
              key={"dialogSelectMenueDayCardContainer_" + date.toISOString()}
            >
              <Card
                sx={classes.cardDate}
                style={{width: "100%"}}
                variant="outlined"
              >
                <CardHeader
                  align="center"
                  title={date.toLocaleString("default", {weekday: "long"})}
                  titleTypographyProps={{variant: "h6"}}
                  subheader={date.toLocaleString("de-CH", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                />
              </Card>
            </Box>
          ))}
        </Box>

        {/* MealType-Zeilen */}
        <RadioGroup
          value={selectedMeal}
          onChange={onRadioChange}
          // Trick: macht RadioGroup layout-"transparent", damit das Grid greift
          sx={{display: "contents"}}
        >
          {mealTypes.order.map((mealTypeUid) => (
            <Box
              sx={classes.dialogSelectMenueRow}
              key={"dialogSelectMenueRow_" + mealTypeUid}
              style={rowGridStyle}
            >
              {dates.map((date) => {
                const actualMeal = getMealForMealTypeAndDate(
                  meals,
                  mealTypeUid,
                  date
                );

                if (!actualMeal) {
                  return;
                }
                return (
                  <Box
                    sx={classes.dialogSelectMenueItemCheckboxBox}
                    key={"cell_" + Utils.dateAsString(date) + "_" + mealTypeUid}
                    style={{paddingLeft: theme.spacing(6)}}
                  >
                    <FormControlLabel
                      key={"radio_" + actualMeal.uid}
                      value={actualMeal.uid}
                      control={<Radio />}
                      label={mealTypes.entries[mealTypeUid].name}
                      style={{width: "100%"}}
                    />
                  </Box>
                );
              })}
            </Box>
          ))}
        </RadioGroup>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCloseClick} color="primary" variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onOkClick} color="primary" variant="contained">
          {TEXT_CONTINUE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
