import React from "react";

import {
  Dialog,
  Container,
  Typography,
  Button,
  Card,
  CardHeader,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  CardActions,
  Radio,
  RadioGroup,
  Box,
  useTheme,
} from "@mui/material";

import {Menue, Meal, MealType, MenuplanData} from "./menuplan.types";
import Utils from "../../Shared/utils.class";
import useCustomStyles from "../../../constants/styles";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";

import {DoneAll as DoneAllIcon} from "@mui/icons-material";

import {
  NO_MENUES_MARKED as TEXT_NO_MENUES_MARKED,
  SELECT_DAY as TEXT_SELECT_DAY,
  SELECT_ALL as TEXT_SELECT_ALL,
  CONTINUE as TEXT_CONTINUE,
  CANCEL as TEXT_CANCEL,
} from "../../../constants/text";

// ===================================================================
// ============================== Global =============================
// =================================================================== */

/**
 * Parameter für `decodeSelectedMeals`.
 *
 * @param selectedMeals - UIDs der selektierten Meals
 * @param menuplan - Vollständiger Menüplan (für Datums- und Mahlzeit-Reihenfolge)
 */
interface DecodeSeletedMenues {
  selectedMeals: string[];
  menuplan: MenuplanData;
}

interface TimeSlice {
  from: {date: Date | null; mealType: MealType["uid"]};
  to: {date: Date | null; mealType: MealType["uid"]};
}

/**
 * Dekodiert die selektierten Meals in einen lesbaren Zeitbereich-String.
 *
 * Fasst aufeinanderfolgende Meals zu Von-Bis-Bereichen zusammen
 * (z.B. «01.01.2026 Frühstück - 03.01.2026 Abendessen»).
 *
 * @param params - SelectedMeals und Menüplan
 * @returns Formatierter Anzeigetext der selektierten Zeitbereiche
 */
export const decodeSelectedMeals = ({
  selectedMeals,
  menuplan,
}: DecodeSeletedMenues) => {
  // Über den Menüplan in der Reihenfolge loopen und ein Array
  // mit Von-Bis aufbauen.
  const selectedRange: TimeSlice[] = [];
  const preRecord = {date: new Date(), mealType: ""};

  let timeslice: TimeSlice = {
    from: {date: null, mealType: ""},
    to: {date: null, mealType: ""},
  };
  let openTimeSlice = false;

  menuplan.dates.forEach((date) => {
    menuplan.mealTypes.order.forEach((mealTypeUid) => {
      const meal = Object.values(menuplan.meals).find(
        (meal) =>
          meal.date == Utils.dateAsString(date) && meal.mealType == mealTypeUid,
      );

      if (meal) {
        if (selectedMeals?.includes(meal.uid)) {
          if (!openTimeSlice) {
            // Neuer Range erfassen
            timeslice.from = {
              date: date,
              mealType: menuplan.mealTypes.entries[mealTypeUid].name,
            };
          }
          openTimeSlice = true;
        } else {
          if (openTimeSlice) {
            // abschliessen
            timeslice.to = {
              date: preRecord.date,
              mealType: menuplan.mealTypes.entries[preRecord.mealType].name,
            };
            selectedRange.push(timeslice);
            timeslice = {
              from: {date: null, mealType: ""},
              to: {date: null, mealType: ""},
            };
            openTimeSlice = false;
          }
        }
      }
      preRecord.mealType = mealTypeUid;
      preRecord.date = date;
    });
  });
  if (openTimeSlice) {
    // Konnte im Loop nicht agebschlossen werden
    timeslice.to = {
      date: preRecord.date,
      mealType: menuplan.mealTypes.entries[preRecord.mealType].name,
    };
    selectedRange.push(timeslice);
  }

  let displayText = "";

  selectedRange.forEach((timeslice, counter) => {
    if (counter > 0) {
      displayText = `${displayText}, `;
    }

    displayText = `${displayText}${timeslice.from.date!.toLocaleString(
      "de-CH",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    )} ${timeslice.from.mealType}`;

    if (
      timeslice.from.date != timeslice.to.date ||
      timeslice.from.mealType != timeslice.to.mealType
    ) {
      displayText = `${displayText} - ${timeslice.to.date!.toLocaleString(
        "de-CH",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      )} ${timeslice.to.mealType}`;
    }
  });
  return displayText;
};
/**
 * Sucht das Meal für eine bestimmte Mahlzeitart und ein Datum.
 *
 * @param meals - Alle Meals des Menüplans
 * @param mealTypeUid - UID der Mahlzeitart
 * @param date - Datum
 * @returns Das gefundene Meal oder `null`
 */
export const getMealForMealTypeAndDate = (
  meals: MenuplanData["meals"],
  mealTypeUid: MealType["uid"],
  date: Date,
): Meal | null => {
  const dateStr = Utils.dateAsString(date);
  return (
    Object.values(meals).find(
      (meal) => meal.mealType === mealTypeUid && meal.date === dateStr,
    ) ?? null
  );
};


/**
 * Props für den Menü-Auswahldialog.
 *
 * @param open - Dialog sichtbar
 * @param title - Dialogtitel
 * @param dates - Alle Datum-Einträge des Menüplans
 * @param preSelectedMenue - Vorausgewählte Menüs (z.B. beim Bearbeiten)
 * @param mealTypes - Mahlzeitarten mit Reihenfolge
 * @param meals - Alle Meals
 * @param menues - Alle Menüs
 * @param showSelectAll - «Alle auswählen»-Button anzeigen
 * @param singleSelection - Nur ein Menü auswählbar (Radio statt Checkbox)
 * @param onClose - Callback beim Abbrechen
 * @param onConfirm - Callback bei Bestätigung mit selektierten Menüs
 */
interface DialogSelectMenuesProps {
  open: boolean;
  title: string;
  dates: MenuplanData["dates"];
  preSelectedMenue: DialogSelectMenuesForRecipeDialogValues;
  mealTypes: MenuplanData["mealTypes"];
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  showSelectAll?: boolean;
  singleSelection?: boolean;
  onClose: () => void;
  onConfirm: (dialogValues: DialogSelectMenuesForRecipeDialogValues) => void;
}

export interface DialogSelectMenuesForRecipeDialogValues {
  [key: Menue["uid"]]: boolean;
}

/**
 * Dialog zur Auswahl von Menüs aus dem Menüplan.
 *
 * Zeigt ein Datums-×-Mahlzeitart-Raster mit Checkboxen (oder Radios bei
 * `singleSelection`). Unterstützt Tages- und Gesamt-Auswahl.
 *
 * @param props - Dialog-Konfiguration und Callbacks
 */
export const DialogSelectMenues = ({
  open,
  title,
  dates,
  preSelectedMenue,
  mealTypes,
  meals,
  menues,
  showSelectAll = false,
  singleSelection = false,
  onConfirm,
  onClose,
}: DialogSelectMenuesProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  // Lookup-Map für schnellen Zugriff: `${mealTypeUid}_${dateStr}` → Meal
  const mealLookup = React.useMemo(() => {
    const map = new Map<string, Meal>();
    for (const meal of Object.values(meals)) {
      map.set(`${meal.mealType}_${meal.date}`, meal);
    }
    return map;
  }, [meals]);

  const [dialogValues, setDialogValues] =
    React.useState<DialogSelectMenuesForRecipeDialogValues | null>(null);

  const [dialogValidation, setDialogValidation] = React.useState<
    Array<FormValidationFieldError>
  >([]);

  // ------------------------------------------
  // Helpers
  // ------------------------------------------
  const createInitialValues = React.useCallback(
    (allMenues: DialogSelectMenuesProps["menues"]) => {
      const initialValues = {} as DialogSelectMenuesForRecipeDialogValues;
      Object.keys(allMenues).forEach((menueUid) => {
        initialValues[menueUid] = false;
      });
      return initialValues;
    },
    [],
  );

  // dialogValues sauber initialisieren, sobald Dialog geöffnet/geschlossen wird
  React.useEffect(() => {
    if (!open) {
      setDialogValues(null);
      setDialogValidation([]);
      return;
    }

    const initial = createInitialValues(menues);
    setDialogValues({...initial, ...preSelectedMenue});
  }, [open, menues, preSelectedMenue, createInitialValues]);

  // Für RadioGroup.value: aktuell selektierte UID ableiten
  const selectedMenueUid = React.useMemo(() => {
    if (!singleSelection || !dialogValues) return "";
    return Object.keys(dialogValues).find((menueUid) => dialogValues[menueUid]) ?? "";
  }, [dialogValues, singleSelection]);

  // ------------------------------------------
  // Select-Menues
  // ------------------------------------------
  const selectMenuesOfDay = (event: React.MouseEvent<HTMLButtonElement>) => {
    const selectedDate = event.currentTarget.id;
    if (!selectedDate || !dialogValues) return;

    const newDialogValues = {...dialogValues};
    let newValueToSet = true;

    const meal = Object.values(meals).find(
      (candidate) => candidate.date === selectedDate && candidate.menuOrder.length !== 0,
    );
    if (meal) {
      newValueToSet = !dialogValues[meal.menuOrder[0]];
    }

    Object.values(meals).forEach((meal) => {
      if (meal.date === selectedDate) {
        meal.menuOrder.forEach((menueUid) => {
          newDialogValues[menueUid] = newValueToSet;
        });
      }
    });

    setDialogValues(newDialogValues);
  };

  const selectAllMenues = () => {
    if (!dialogValues) return;

    const newDialogValues = {...dialogValues};
    const firstKey = Object.keys(newDialogValues)[0];
    const newValueToSet = firstKey ? !newDialogValues[firstKey] : true;

    Object.values(meals).forEach((meal) => {
      meal.menuOrder.forEach((menueUid) => {
        newDialogValues[menueUid] = newValueToSet;
      });
    });

    setDialogValues(newDialogValues);
  };

  // ------------------------------------------
  // Change-Events (getrennt: Checkbox vs Radio)
  // ------------------------------------------
  const onRadioChange = (
    _: React.ChangeEvent<HTMLInputElement>,
    value: string,
  ) => {
    // singleSelection: genau eines true
    setDialogValues({[value]: true} as DialogSelectMenuesForRecipeDialogValues);
  };

  const onCheckboxChange =
    (menueUid: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setDialogValues((prev) => {
        if (!prev) return prev;
        return {...prev, [menueUid]: event.target.checked};
      });
    };

  // ------------------------------------------
  // OK / Close
  // ------------------------------------------
  const onOkClick = () => {
    if (!dialogValues) return;

    const marked = Object.keys(dialogValues).filter((uid) => dialogValues[uid]);

    if (marked.length === 0) {
      setDialogValidation([
        {
          priority: 1,
          fieldName: "ERROR_MESSAGE_NO_MENUE_MARKED",
          errorMessage: TEXT_NO_MENUES_MARKED,
        },
      ]);
      return;
    }

    setDialogValidation([]);

    const selectedMenues = {} as DialogSelectMenuesForRecipeDialogValues;
    marked.forEach((uid) => (selectedMenues[uid] = true));

    setDialogValues(null);
    onConfirm(selectedMenues);
  };

  const onCloseClick = () => {
    setDialogValues(null);
    onClose();
  };

  // ------------------------------------------
  // Grid styles (einheitlich)
  // ------------------------------------------
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `max-content repeat(${dates.length}, minmax(200px, 1fr))`,
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),
    overflowX: "auto",
  };

  const rowContentsStyle = {display: "contents"} as const;

  return (
    <Dialog open={open} maxWidth="xl">
      <DialogTitle>{title}</DialogTitle>

      <DialogContent style={gridStyle}>
        {/* Header-Zeile: Wochentage / Datum */}
        <Box sx={{display: "flex", alignItems: "flex-end"}}>
          {showSelectAll && !singleSelection && (
            <Button
              color="primary"
              startIcon={<DoneAllIcon />}
              onClick={selectAllMenues}
              sx={{mb: "26px"}}
            >
              {TEXT_SELECT_ALL}
            </Button>
          )}
        </Box>

        {dates.map((date) => (
          <Box
            sx={{paddingBottom: theme.spacing(2)}}
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
                slotProps={{title: {variant: "h6"}}}
                subheader={date.toLocaleString("de-CH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              />

              {showSelectAll && (
                <CardActions
                  style={{marginTop: "-3ex", justifyContent: "center"}}
                >
                  <Button
                    id={Utils.dateAsString(date)}
                    color="primary"
                    startIcon={<DoneAllIcon />}
                    onClick={selectMenuesOfDay}
                  >
                    {TEXT_SELECT_DAY}
                  </Button>
                </CardActions>
              )}
            </Card>
          </Box>
        ))}

        {/* MealType-Zeilen */}
        {mealTypes.order.map((mealTypeUid) => (
          <React.Fragment key={"dialogSelectMenueRow_" + mealTypeUid}>
            {/* Erste Spalte: MealType */}
            <Box sx={{paddingBottom: theme.spacing(2)}}>
              <Card
                sx={classes.dialogSelectMenuCardMealtype}
                variant="outlined"
              >
                <CardHeader
                  title={mealTypes.entries[mealTypeUid].name}
                  slotProps={{title: {variant: "h6"}}}
                />
              </Card>
            </Box>

            {/* Restliche Spalten: pro Datum ein Feld */}
            {singleSelection ? (
              <RadioGroup
                value={selectedMenueUid}
                onChange={onRadioChange}
                sx={rowContentsStyle}
              >
                {dates.map((date) => {
                  const actualMeal = mealLookup.get(
                    `${mealTypeUid}_${Utils.dateAsString(date)}`,
                  ) ?? null;

                  return (
                    <Container
                      sx={classes.dialogSelectMenueItemCheckboxBox}
                      key={
                        "cell_" + Utils.dateAsString(date) + "_" + mealTypeUid
                      }
                    >
                      {actualMeal?.menuOrder?.map((menueUid) => (
                        <FormControlLabel
                          key={"radio_" + menueUid}
                          value={menueUid}
                          control={<Radio />}
                          label={
                            menues[menueUid].name
                              ? menues[menueUid].name
                              : mealTypes.entries[mealTypeUid].name
                          }
                          style={{width: "100%"}}
                        />
                      ))}
                    </Container>
                  );
                })}
              </RadioGroup>
            ) : (
              <>
                {dates.map((date) => {
                  const actualMeal = mealLookup.get(
                    `${mealTypeUid}_${Utils.dateAsString(date)}`,
                  ) ?? null;

                  return (
                    <Container
                      sx={classes.dialogSelectMenueItemCheckboxBox}
                      key={
                        "cell_" + Utils.dateAsString(date) + "_" + mealTypeUid
                      }
                    >
                      {actualMeal?.menuOrder?.map((menueUid) => (
                        <FormControlLabel
                          key={"checkbox_" + menueUid}
                          control={
                            <Checkbox
                              checked={!!dialogValues?.[menueUid]}
                              onChange={onCheckboxChange(menueUid)}
                            />
                          }
                          label={
                            menues[menueUid].name
                              ? menues[menueUid].name
                              : mealTypes.entries[mealTypeUid].name
                          }
                          sx={{
                            width: "100%",
                            paddingLeft: theme.spacing(2),
                          }}
                        />
                      ))}
                    </Container>
                  );
                })}
              </>
            )}
          </React.Fragment>
        ))}

        {dialogValidation[0]?.fieldName === "ERROR_MESSAGE_NO_MENUE_MARKED" && (
          <Typography color="error" style={{gridColumn: "1 / -1"}}>
            {dialogValidation[0].errorMessage}
          </Typography>
        )}
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
