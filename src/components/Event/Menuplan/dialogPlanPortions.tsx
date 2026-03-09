/**
 * Dialog zur Portionenplanung im Menüplan.
 *
 * Erlaubt dem Benutzer, für ausgewählte Menüs die Portionen pro Diätgruppe
 * und Unverträglichkeit festzulegen. Unterstützt synchronisierte Portionen
 * über mehrere Menüs hinweg sowie fixe Portionen.
 *
 * Enthält drei Komponenten:
 * - `DialogPlanPortions` — Hauptdialog mit Diät-Toggle und Validierung
 * - `DialogPlanPortionsMealBlock` — Block pro Mahlzeit (Fix vs. Gruppen)
 * - `DialogPlanPortionsMealBlockRow` — Einzelne Zeile mit Checkbox, Faktor und Total
 */
import React, {useState} from "react";

import {
  Container,
  Switch,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Tooltip,
  Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {alpha} from "@mui/system/colorManipulator";

import {Info as InfoIcon} from "@mui/icons-material";

import {
  Menue,
  Meal,
  PortionPlan,
  PlanedDiet,
  PlanedIntolerances,
} from "./menuplan.types";
import {
  DialogPlanPortionsMealPlanning,
  DialogPlanPortionsMealPlan,
  DialogPlanPortionsDialogValues,
} from "./menuplan.page.types";
import {PlanedObject} from "./menuplan.constants";
import Menuplan from "./menuplan.class";
import EventGroupConfiguration, {
  Intolerance,
} from "../GroupConfiguration/groupConfiguration.class";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";
import {
  DialogType,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";
import useCustomStyles from "../../../constants/styles";

import {
  DIALOG_PLAN_RECIPE_PORTIONS_TITLE as TEXT_DIALOG_PLAN_RECIPE_PORTIONS_TITLE,
  DIALOG_PLAN_GOODS_PORTIONS_TITLE as TEXT_DIALOG_PLAN_GOODS_PORTIONS_TITLE,
  ALL as TEXT_ALL,
  FIX_PORTIONS as TEXT_FIX_PORTIONS,
  ON_DATE as TEXT_ON_DATE,
  KEEP_PLANED_PORTIONS_IN_SYNC as TEXT_KEEP_PLANED_PORTIONS_IN_SYNC,
  FACTOR as TEXT_FACTOR,
  TOTAL_PORTIONS as TEXT_TOTAL_PORTIONS,
  FACTOR_TOOLTIP as TEXT_FACTOR_TOOLTIP,
  PORTIONS as TEXT_PORTIONS,
  PORTION as TEXT_PORTION,
  YOUR_SELECTION_MAKES_X_SERVINGS as TEXT_YOUR_SELECTION_MAKES_X_SERVINGS,
  BACK as TEXT_BACK,
  NO_OF_SERVINGS as TEXT_NO_OF_SERVINGS,
  PLEASE_PROVIDE_VALID_FACTOR as TEXT_PLEASE_PROVIDE_VALID_FACTOR,
  MISSING_FACTOR as TEXT_MISSING_FACTOR,
  NO_GROUP_SELECTED as TEXT_NO_GROUP_SELECTED,
  NO_PORTIONS_GIVEN as TEXT_NO_PORTIONS_GIVEN,
  CANCEL as TEXT_CANCEL,
  ADD as TEXT_ADD,
  APPLY as TEXT_APPLY,
  ATTENTION as TEXT_ATTENTION,
  CONFIRM_DIET_SWITCH as TEXT_CONFIRM_DIET_SWITCH,
  PROCEED as TEXT_PROCEED,
} from "../../../constants/text";

/* ===================================================================
// ==================== Einplanung der Portionen =====================
// =================================================================== */
interface DialogPlanPortionsProps {
  open: boolean;
  selectedMenues: DialogSelectMenuesForRecipeDialogValues | null;
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  mealTypes: Menuplan["mealTypes"];
  groupConfiguration: EventGroupConfiguration;
  planedMealRecipe: PortionPlan[];
  planedObject: PlanedObject;
  onCancelClick: () => void;
  onBackClick: () => void;
  onAddClick: (plan: {
    [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
  }) => void;
}
const KEEP_IN_SYNC_KEY = "SYNC";

const DialogPlanPortions = ({
  open,
  selectedMenues,
  meals,
  mealTypes,
  groupConfiguration,
  planedMealRecipe,
  planedObject,
  onCancelClick: onCancelClickSuper,
  onBackClick: onBackClickSuper,
  onAddClick: onAddClickSuper,
}: DialogPlanPortionsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const DIALOG_VALUES_INITIAL_VALUES = {
    keepMenuPortionsInSync: true,
    selectedDiets: null,
    menueList: null,
    plan: null,
  };

  const {customDialog} = useCustomDialog();
  const [dialogValues, setDialogValues] =
    useState<DialogPlanPortionsDialogValues>(DIALOG_VALUES_INITIAL_VALUES);
  const [dialogValidation, setDialogValidation] = useState<
    Array<FormValidationFieldError>
  >([]);
  /* ------------------------------------------
  // Initialisierung
  // ------------------------------------------ */
  if (
    (!dialogValues.plan || Object.values(dialogValues.plan).includes(null)) &&
    selectedMenues &&
    Object.keys(selectedMenues).length > 0
  ) {
    let dietButtons = {} as {[key: Menue["uid"]]: PortionPlan["diet"]};
    let menueList: string[] = [];

    if (!dialogValues.menueList) {
      if (
        Object.keys(selectedMenues).length > 1 &&
        dialogValues.keepMenuPortionsInSync
      ) {
        menueList[0] = KEEP_IN_SYNC_KEY;
      } else {
        Object.keys(selectedMenues).forEach((menueUid) =>
          menueList.push(menueUid),
        );
      }
    } else {
      menueList = dialogValues.menueList;
    }

    if (!dialogValues.selectedDiets && planedMealRecipe.length === 0) {
      menueList.forEach((menueUid) => {
        dietButtons[menueUid] = PlanedDiet.ALL;
      });
    } else if (
      dialogValues.selectedDiets == null &&
      planedMealRecipe.length > 0
    ) {
      dietButtons[menueList[0]] = planedMealRecipe[0].diet;
    } else {
      dietButtons = dialogValues.selectedDiets as {
        [key: Menue["uid"]]: PortionPlan["diet"];
      };
    }

    let plan = {} as DialogPlanPortionsMealPlan;
    if (!dialogValues.plan) {
      menueList.forEach((menueUid) => (plan[menueUid] = null));
    } else {
      plan = dialogValues.plan;
    }

    // Zuerst die Alle und Fix Portionen
    Object.keys(plan).forEach((menuUid) => {
      if (plan[menuUid] == null) {
        const mealPlan = {} as DialogPlanPortionsMealPlanning;
        if (dietButtons[menuUid] == PlanedDiet.FIX) {
          // Fixe-Portionen
          mealPlan[PlanedDiet.FIX] = {
            active: true,
            portions: 0,
            factor: "1.0",
            total: 0,
            diet: dietButtons[menuUid],
          };
        } else {
          groupConfiguration.intolerances.order.forEach((intoleranceUid) => {
            mealPlan[intoleranceUid] = {
              active: false,
              portions:
                dietButtons[menuUid] == PlanedDiet.ALL
                  ? groupConfiguration.intolerances.entries[intoleranceUid]
                      .totalPortions
                  : groupConfiguration.portions[dietButtons[menuUid]][
                      intoleranceUid
                    ],
              factor: "1.0",
              total: 0,
              diet: dietButtons[menuUid],
            };
          });
          // Totalsumme einfügen
          mealPlan[PlanedDiet.ALL] = {
            active: false,
            portions:
              dietButtons[menuUid] == PlanedDiet.ALL
                ? groupConfiguration.totalPortions
                : groupConfiguration.diets.entries[dietButtons[menuUid]]
                    .totalPortions,
            factor: "1.0",
            total: 0,
            diet: dietButtons[menuUid],
          };
        }

        plan[menuUid] = mealPlan;
      }
    });

    if (dialogValues.selectedDiets == null && planedMealRecipe.length > 0) {
      // Vorauswahl setzen
      dietButtons[menueList[0]] = planedMealRecipe[0].diet;
    }

    if (
      planedMealRecipe.length > 0 &&
      plan &&
      dietButtons[menueList[0]] == planedMealRecipe[0].diet
    ) {
      // Werte übernehmen --> im Change Modus
      Object.values(plan as DialogPlanPortionsMealPlan).forEach(
        (planOfMenu) =>
          planOfMenu &&
          planedMealRecipe.forEach(
            (mealPlan) =>
              (planOfMenu[mealPlan.intolerance] = {
                ...planOfMenu[mealPlan.intolerance],
                active: true,
                diet: mealPlan.diet,
                factor: mealPlan.factor.toFixed(1),
                total: mealPlan.totalPortions,
                portions:
                  mealPlan.intolerance == PlanedDiet.FIX
                    ? mealPlan.totalPortions
                    : planOfMenu[mealPlan.intolerance].portions,
              }),
          ),
      );
    }
    setDialogValues({
      ...dialogValues,
      plan: plan,
      selectedDiets: dietButtons,
      menueList: menueList,
    });
  }
  /* ------------------------------------------
  // Feld-Änderungen
  // ------------------------------------------ */
  const onFieldUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const updatedField = event.target.id.split("_");
    let factor = "";
    let active = false;
    let portions = 0;
    const [, changedField, menueUid, intoleranceUid] = updatedField;

    if (
      !dialogValues.plan ||
      !dialogValues.plan[menueUid] ||
      dialogValues.plan[menueUid] === null
    ) {
      return;
    }
    const mealPlanning = dialogValues.plan[menueUid];
    if (!mealPlanning || mealPlanning[intoleranceUid] === null) {
      return;
    }
    if (changedField == "active") {
      active = event.target.checked;
      factor = mealPlanning[intoleranceUid]?.factor;
      portions = mealPlanning[intoleranceUid].portions;
    } else if (changedField == "factor") {
      active = mealPlanning[intoleranceUid].active;
      factor = event.target.value.replace(",", ".");
      portions = mealPlanning[intoleranceUid].portions;
    } else if (changedField == "total") {
      active = true;
      factor = "1.0";
      portions = parseInt(event.target.value);
    }

    let total = active ? Math.round(portions * parseFloat(factor)) : 0;

    if (isNaN(total)) {
      total = 0;
    }

    if (changedField == "active") {
      const menuePlan = dialogValues.plan[menueUid];
      if (menuePlan === null) {
        return;
      }
      // Gesetzte Werte übernehmen
      menuePlan[intoleranceUid].active = active;
      menuePlan[intoleranceUid].factor = factor;
      menuePlan[intoleranceUid].total = total;

      if (intoleranceUid == PlanedIntolerances.ALL) {
        // Wenn die 'Alle' Checkbox markiert ist, die anderen demarkieren.
        Object.keys(menuePlan).forEach((menueKey) => {
          if (menueKey !== PlanedIntolerances.ALL) {
            menuePlan![menueKey].active = false;
            menuePlan![menueKey].factor = "1.0";
            menuePlan![menueKey].total = 0;
          }
        });
      } else if (intoleranceUid != PlanedIntolerances.ALL) {
        // Die 'Alle' Checkbox demarkieren
        menuePlan[PlanedIntolerances.ALL].active = false;
        menuePlan[PlanedIntolerances.ALL].factor = "1.0";
        menuePlan[PlanedIntolerances.ALL].total = 0;
      }
      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: menuePlan,
        },
      });
    } else {
      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: {
            ...dialogValues.plan[menueUid],
            [intoleranceUid]: {
              ...mealPlanning[intoleranceUid],
              portions: portions,
              active: active,
              factor: factor,
              total: total,
            },
          },
        },
      });
    }
  };
  const onSwitchSyncAllMenues = () => {
    setDialogValues({
      ...dialogValues,
      selectedDiets: null,
      keepMenuPortionsInSync: !dialogValues.keepMenuPortionsInSync,
      plan: null,
      menueList: null, // diese muss neu aufgebaut werden
    });
  };
  /* ------------------------------------------
  // ToggleButton-Handling
  // ------------------------------------------ */
  /**
   * Prüft ob der Benutzer im aktuellen Plan für ein Menü bereits
   * Werte eingegeben hat (Checkbox aktiviert, Faktor geändert, etc.).
   *
   * @param menuUid UID des Menüs, dessen Plan geprüft wird.
   * @returns `true` wenn Änderungen vorliegen.
   */
  const hasUserModifiedPlan = (menuUid: string): boolean => {
    const mealPlan = dialogValues.plan?.[menuUid];
    if (!mealPlan) {
      return false;
    }
    const currentDiet = dialogValues.selectedDiets?.[menuUid];
    if (currentDiet === PlanedDiet.FIX) {
      // Bei Fix-Portionen: geändert, sobald Portionen eingegeben wurden
      const fixEntry = mealPlan[PlanedDiet.FIX];
      return fixEntry != null && fixEntry.portions > 0;
    }
    // Bei Diät-Modus: geändert, sobald eine Checkbox aktiviert oder
    // ein Faktor angepasst wurde
    return Object.values(mealPlan).some(
      (entry) => entry.active || entry.factor !== "1.0",
    );
  };

  const onToggleButtonClick = async (
    event: React.MouseEvent<HTMLElement>,
    activeButton: string | null,
  ) => {
    if (activeButton == null) {
      // Etwas muss markiert sein.
      return;
    }
    const [, menuUid] = event.currentTarget.id.split("_");

    // Prüfen ob Benutzer bereits Werte geändert hat
    if (hasUserModifiedPlan(menuUid)) {
      const isConfirmed = (await customDialog({
        dialogType: DialogType.Confirm,
        title: `⚠️  ${TEXT_ATTENTION}`,
        text: TEXT_CONFIRM_DIET_SWITCH,
        buttonTextConfirm: TEXT_PROCEED,
      })) as boolean;

      if (!isConfirmed) {
        return;
      }
    }

    setDialogValues({
      ...dialogValues,
      selectedDiets: {
        ...dialogValues.selectedDiets,
        [menuUid]: activeButton,
      },
      //  Darf nur für das Menü neu aufgebaut werden, für das eine neue Diät-Gruppe gewählt wurde
      plan: {...dialogValues.plan, [menuUid]: null},
    });
  };
  /* ------------------------------------------
  // Dialog-Schliessen-Handling
  // ------------------------------------------ */
  const onAddClick = () => {
    // Prüfen ob Checkboxen markiert sind ohne Faktor!
    if (!dialogValues.plan) {
      return;
    }

    const dialogValidationMessages: FormValidationFieldError[] = [];
    //Prüfen ob es aktivierte Checkboxen ohne Faktor gibt, dass kann nicht gerechnet werden
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.values(dialogValues.plan![menueUid]!).reduce(
          (innerRunningCounter, intolerance) => {
            if (intolerance.active == true && !intolerance.factor) {
              innerRunningCounter++;
            }
            return innerRunningCounter;
          },
          0,
        ) > 0
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_MISSING_FACTOR,
        });
      }
    });

    // Prüfen ob pro Menü überhaupt eine Checkbox aktiviert wurde
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.values(dialogValues.plan![menueUid]!).reduce(
          (innerRunningCounter, intolerance) => {
            if (intolerance.active == true) {
              innerRunningCounter++;
            }
            return innerRunningCounter;
          },
          0,
        ) == 0
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_NO_GROUP_SELECTED,
        });
      }
    });

    // Prüfen ob fixe Portionen eingegeben wurden
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.keys(dialogValues.plan![menueUid]!).includes(PlanedDiet.FIX) &&
        (dialogValues.plan![menueUid]![PlanedDiet.FIX].portions == 0 ||
          !dialogValues.plan![menueUid]![PlanedDiet.FIX].portions)
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_NO_PORTIONS_GIVEN,
        });
      }
    });

    if (dialogValidationMessages.length == 0) {
      // Zurückmelden, was alles aktiv ist.
      setDialogValidation([]);
      const selectedPlans = {} as {
        [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
      };

      Object.keys(dialogValues.plan).forEach((menuUid) => {
        const intolerances = {} as DialogPlanPortionsMealPlanning;
        Object.keys(dialogValues.plan![menuUid]!).forEach((intoleraceUid) => {
          if (dialogValues.plan![menuUid]![intoleraceUid].active === true) {
            intolerances[intoleraceUid] =
              dialogValues.plan![menuUid]![intoleraceUid];
          }
        });
        selectedPlans[menuUid] = intolerances;
      });

      if (
        Object.keys(selectedMenues!).length > 1 &&
        dialogValues.keepMenuPortionsInSync
      ) {
        Object.keys(selectedMenues!).forEach((menueUid) => {
          selectedPlans[menueUid] = selectedPlans[KEEP_IN_SYNC_KEY];
        });
        delete selectedPlans?.[KEEP_IN_SYNC_KEY];
      }

      // Wenn SYNC --> auf alles Menüs umbiegen
      // Objekt erzeugen --> menueUid: {intolerance {factore}}
      onAddClickSuper(selectedPlans);
      setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    } else {
      setDialogValidation(dialogValidationMessages);
    }
  };
  const onBackClick = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    setDialogValidation([]);
    onBackClickSuper();
  };
  const onCancelClick = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    setDialogValidation([]);
    onCancelClickSuper();
  };

  return (
    <React.Fragment>
      {selectedMenues ? (
        <Dialog open={open} maxWidth="md">
          <DialogTitle>
            {planedObject == PlanedObject.RECIPE
              ? TEXT_DIALOG_PLAN_RECIPE_PORTIONS_TITLE
              : TEXT_DIALOG_PLAN_GOODS_PORTIONS_TITLE}
          </DialogTitle>
          <DialogContent>
            {Object.keys(selectedMenues).length > 1 && (
              <FormGroup style={{marginBottom: "1em"}}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={dialogValues.keepMenuPortionsInSync}
                      onChange={onSwitchSyncAllMenues}
                    />
                  }
                  label={TEXT_KEEP_PLANED_PORTIONS_IN_SYNC}
                />
              </FormGroup>
            )}
            {dialogValues.menueList &&
              // Für alle gewählten Menü, den Block aufbauen
              dialogValues.menueList.map((menueUid, counter) => {
                let meal: Meal = {
                  uid: "",
                  date: "",
                  mealType: "",
                  mealTypeName: "",
                  menuOrder: [],
                };
                if (menueUid !== KEEP_IN_SYNC_KEY) {
                  meal = Menuplan.findMealOfMenu({
                    menueUid: menueUid,
                    meals: meals,
                  });
                }
                return (
                  <React.Fragment
                    key={"dialogPlanPortionsDetailBlock_" + menueUid}
                  >
                    {counter > 0 && (
                      <Divider
                        key={"dialogPortion_Divider_" + menueUid}
                        variant="fullWidth"
                        style={{
                          marginTop: theme.spacing(4),
                          marginBottom: theme.spacing(4),
                          marginRight: theme.spacing(-2),
                          marginLeft: theme.spacing(-2),
                          backgroundColor: theme.palette.primary.main,
                          height: "2px",
                        }}
                      />
                    )}
                    {menueUid == KEEP_IN_SYNC_KEY ? (
                      <React.Fragment>
                        <Typography variant="subtitle1">
                          {`${TEXT_ON_DATE}: `}
                        </Typography>
                        {Object.keys(selectedMenues).map((menueUid) => {
                          meal = Menuplan.findMealOfMenu({
                            menueUid: menueUid,
                            meals: meals,
                          });

                          return (
                            <Typography
                              variant="subtitle1"
                              key={"date_" + menueUid + counter}
                            >
                              <strong>
                                {`${new Date(meal.date).toLocaleString(
                                  "default",
                                  {
                                    weekday: "long",
                                  },
                                )}`}
                              </strong>
                              {` ${new Date(meal.date).toLocaleString("de-CH", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              })} - ${mealTypes.entries[meal.mealType].name}`}
                            </Typography>
                          );
                        })}
                      </React.Fragment>
                    ) : (
                      <Typography variant="subtitle1">
                        {`${TEXT_ON_DATE}: `}
                        <strong>
                          {`${new Date(meal.date).toLocaleString("default", {
                            weekday: "long",
                          })}`}
                        </strong>
                        {` ${new Date(meal.date).toLocaleString("de-CH", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })} - ${mealTypes.entries[meal.mealType].name}`}
                      </Typography>
                    )}
                    <ToggleButtonGroup
                      key={"dialogPortion_ToggleButtonGroup_" + menueUid}
                      id={"dialogPortion_ToggleButtonGroup_" + menueUid}
                      exclusive
                      value={dialogValues.selectedDiets}
                      onChange={onToggleButtonClick}
                      aria-label="Mögliche-Gruppen"
                      style={{
                        display: "flex",
                      }}
                      sx={classes.toggleButtonGroup}
                      color="primary"
                    >
                      <ToggleButton
                        key={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.ALL
                        }
                        id={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.ALL
                        }
                        value={PlanedDiet.ALL}
                        aria-label={TEXT_ALL}
                        sx={classes.toggleButton}
                        style={{
                          ...(dialogValues.selectedDiets &&
                            dialogValues.selectedDiets[menueUid] ===
                              PlanedDiet.ALL && {
                              color: theme.palette.primary.main,
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1,
                              ),
                            }),
                        }}
                      >
                        {TEXT_ALL}
                      </ToggleButton>
                      {groupConfiguration?.diets.order.map((dietUid) => (
                        <ToggleButton
                          key={
                            "dialogPlanPortionsMealBlockDietButton_" +
                            menueUid +
                            "_" +
                            dietUid
                          }
                          id={
                            "dialogPlanPortionsMealBlockDietButton_" +
                            menueUid +
                            "_" +
                            dietUid
                          }
                          value={dietUid}
                          aria-label={
                            groupConfiguration.diets.entries[dietUid].name
                          }
                          sx={classes.toggleButton}
                          style={{
                            ...(dialogValues.selectedDiets &&
                              dialogValues.selectedDiets[menueUid] ===
                                dietUid && {
                                color: theme.palette.primary.main,
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.1,
                                ),
                              }),
                          }}
                        >
                          {groupConfiguration.diets.entries[dietUid].name}
                        </ToggleButton>
                      ))}
                      <ToggleButton
                        id={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.FIX
                        }
                        value={PlanedDiet.FIX}
                        aria-label={TEXT_FIX_PORTIONS}
                        sx={classes.toggleButton}
                        style={{
                          ...(dialogValues.selectedDiets &&
                            dialogValues.selectedDiets[menueUid] ===
                              PlanedDiet.FIX && {
                              color: theme.palette.primary.main,
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1,
                              ),
                            }),
                        }}
                      >
                        {TEXT_FIX_PORTIONS}
                      </ToggleButton>
                    </ToggleButtonGroup>

                    {dialogValues.selectedDiets && (
                      <DialogPlanPortionsMealBlock
                        key={"dialogPlanPortionsMealBlock_" + menueUid}
                        selectedDietUid={dialogValues.selectedDiets[menueUid]}
                        plan={dialogValues.plan}
                        menueUid={menueUid}
                        groupConfiguration={groupConfiguration}
                        onFieldUpdate={onFieldUpdate}
                      />
                    )}
                    {/* Fehlermeldung anzeigen falls notwendig */}
                    {dialogValidation.length > 0 &&
                      dialogValidation.some(
                        (errorMessage) => errorMessage.fieldName === menueUid,
                      ) && (
                        <Container
                          style={{
                            marginTop: theme.spacing(4),
                            paddingLeft: 0,
                            paddingRight: 0,
                          }}
                        >
                          {dialogValidation
                            .filter((message) => message.fieldName == menueUid)
                            .map((errorMessage) => (
                              <Typography color="error" key="errormessage">
                                {errorMessage.errorMessage}
                              </Typography>
                            ))}
                        </Container>
                      )}
                  </React.Fragment>
                );
              })}
          </DialogContent>
          <DialogActions style={{marginTop: theme.spacing(2)}}>
            {/* Abbrechen, Bestägigen, Zurück */}
            <Button onClick={onCancelClick} color="primary" variant="outlined">
              {TEXT_CANCEL}
            </Button>
            {planedObject == PlanedObject.RECIPE &&
              planedMealRecipe.length == 0 && (
                // Nur anzeigen, wenn neues Rezept hinzugeüfgt wird.
                <Button
                  onClick={onBackClick}
                  color="primary"
                  variant="outlined"
                >
                  {TEXT_BACK}
                </Button>
              )}
            <Button onClick={onAddClick} color="primary" variant="contained">
              {planedMealRecipe.length == 0 ? TEXT_ADD : TEXT_APPLY}
            </Button>
          </DialogActions>
        </Dialog>
      ) : (
        <React.Fragment />
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ========== Einplanung der Portionen - Block pro Mahlzeit===========
// =================================================================== */
interface DialogPlanPortionsMealBlockProps {
  menueUid: Menue["uid"];
  selectedDietUid: PortionPlan["diet"];
  groupConfiguration: EventGroupConfiguration;
  plan: DialogPlanPortionsDialogValues["plan"];
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const DialogPlanPortionsMealBlock = ({
  menueUid,
  plan,
  selectedDietUid,
  groupConfiguration,
  onFieldUpdate,
}: DialogPlanPortionsMealBlockProps) => {
  return (
    plan &&
    (selectedDietUid == PlanedDiet.FIX ? (
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            id={
              "dialogPlanPortionsMealBlockIntolerance_total_" +
              menueUid +
              "_" +
              PlanedDiet.FIX
            }
            key={
              "dialogPlanPortionsMealBlockIntolerance_total_" +
              menueUid +
              "_" +
              PlanedDiet.FIX
            }
            label={TEXT_NO_OF_SERVINGS}
            type="outlined"
            onChange={onFieldUpdate}
            value={plan[Object.keys(plan)[0]]!.FIX.total}
            fullWidth
          />
        </Grid>
      </Grid>
    ) : (
      <Grid container spacing={2}>
        <Grid size={8} />
        <Grid size={2}>
          <Typography>
            <strong>{TEXT_FACTOR} </strong>
            <Tooltip title={TEXT_FACTOR_TOOLTIP} placement="bottom" arrow>
              <InfoIcon fontSize="small" style={{marginLeft: "0.5em"}} />
            </Tooltip>
          </Typography>
        </Grid>
        <Grid size={2}>
          <strong>{TEXT_TOTAL_PORTIONS}</strong>
        </Grid>
        {/* Zuerst eine Zeile mit für das Total der gewählten Diät-Gruppe */}
        <DialogPlanPortionsMealBlockRow
          key={
            "dialogPlanPortionsMealBlockRow_" +
            menueUid +
            "_" +
            PlanedIntolerances.ALL
          }
          intoleranceUid={PlanedIntolerances.ALL}
          menueUid={menueUid}
          intoleranceName={TEXT_ALL}
          portionsOfIntolerance={
            selectedDietUid == PlanedDiet.ALL
              ? groupConfiguration.totalPortions
              : groupConfiguration.diets.entries[selectedDietUid].totalPortions
          }
          active={plan[menueUid]?.[PlanedIntolerances.ALL]?.active}
          factor={plan[menueUid]?.[PlanedIntolerances.ALL]?.factor}
          totalPortions={plan[menueUid]?.[PlanedIntolerances.ALL]?.total}
          onFieldUpdate={onFieldUpdate}
        />
        {groupConfiguration.intolerances.order.map((intoleranceUid) => (
          <DialogPlanPortionsMealBlockRow
            key={
              "dialogPlanPortionsMealBlockRow_" +
              menueUid +
              "_" +
              intoleranceUid
            }
            intoleranceUid={intoleranceUid}
            menueUid={menueUid}
            intoleranceName={
              groupConfiguration.intolerances.entries[intoleranceUid].name
            }
            portionsOfIntolerance={
              selectedDietUid == PlanedDiet.ALL
                ? groupConfiguration.intolerances.entries[intoleranceUid]
                    .totalPortions
                : groupConfiguration.portions[selectedDietUid][intoleranceUid]
            }
            active={plan[menueUid]?.[intoleranceUid]?.active}
            factor={plan[menueUid]?.[intoleranceUid]?.factor}
            totalPortions={plan[menueUid]?.[intoleranceUid]?.total}
            onFieldUpdate={onFieldUpdate}
          />
        ))}
        <Grid size={12}>
          <Divider />
        </Grid>
        <Grid size={8}>
          <Typography>
            <strong>{TEXT_YOUR_SELECTION_MAKES_X_SERVINGS}</strong>
          </Typography>
        </Grid>
        <Grid size={2} />
        <Grid size={2}>
          <TextField
            fullWidth
            disabled
            value={
              plan && plan[menueUid]
                ? Object.values(plan[menueUid]!)
                    .filter((portion) => portion !== null && portion.active)
                    .reduce(
                      (runningSum, portion) => runningSum + portion.total,
                      0,
                    )
                : ""
            }
            label={TEXT_TOTAL_PORTIONS}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <strong>=</strong>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>
    ))
  );
};
/* ===================================================================
// ================ Einplanung der Portionen - Reihe =================
// =================================================================== */
interface DialogPlanPortionsMealBlockRowProps {
  active: boolean | undefined;
  menueUid: Menue["uid"];
  intoleranceUid: PortionPlan["intolerance"];
  intoleranceName: Intolerance["name"];
  portionsOfIntolerance: number;
  factor: string | undefined;
  totalPortions: PortionPlan["totalPortions"] | undefined;
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
export const DialogPlanPortionsMealBlockRow = ({
  active,
  menueUid,
  intoleranceUid,
  intoleranceName,
  portionsOfIntolerance,
  factor,
  totalPortions,
  onFieldUpdate,
}: DialogPlanPortionsMealBlockRowProps) => {
  const theme = useTheme();

  return (
    <React.Fragment
      key={
        "dialogPlanPortionsMealBlockIntoleranceRow_" +
        menueUid +
        "_" +
        intoleranceUid
      }
    >
      <Grid size={8}>
        <FormControlLabel
          key={
            "dialogPlanPortionsMealBlockIntoleranceFormcontroll_" +
            menueUid +
            intoleranceUid
          }
          style={{width: "100%"}}
          control={
            <Checkbox
              id={
                "dialogPlanPortionsMealBlockIntolerance_active_" +
                menueUid +
                "_" +
                intoleranceUid
              }
              checked={active}
              onChange={onFieldUpdate}
            />
          }
          label={
            <Typography variant="body1">
              {intoleranceName}
              <span
                style={{
                  color: theme.palette.text.secondary,
                  marginLeft: theme.spacing(1),
                }}
              >
                {`(${portionsOfIntolerance} ${
                  portionsOfIntolerance == 1 ? TEXT_PORTION : TEXT_PORTIONS
                })`}
              </span>
            </Typography>
          }
        />
      </Grid>
      <Grid size={2}>
        <TextField
          id={
            "dialogPlanPortionsMealBlockIntolerance_factor_" +
            menueUid +
            "_" +
            intoleranceUid
          }
          fullWidth
          value={active ? factor : ""}
          error={
            !factor
              ? false
              : factor != "" &&
                !/^(\d+|\d+\.\d*|\d*\.\d+|1\.|\.|,)?$/.test(factor)
          }
          helperText={
            factor && !/^(\d+|\d+\.\d*|\d*\.\d+|1\.|\.|,)?$/.test(factor)
              ? TEXT_PLEASE_PROVIDE_VALID_FACTOR
              : ""
          }
          disabled={!active}
          onChange={onFieldUpdate}
          label={TEXT_FACTOR}
        />
      </Grid>
      <Grid size={2}>
        <TextField
          id={
            "dialogPlanPortionsMealBlockIntolerance_totalPortions_" +
            menueUid +
            "_" +
            intoleranceUid
          }
          fullWidth
          disabled
          value={totalPortions == 0 ? "" : totalPortions}
          // onChange={onChangeMenueName}
          label={TEXT_TOTAL_PORTIONS}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <strong>=</strong>
              </InputAdornment>
            ),
          }}
        />
      </Grid>
    </React.Fragment>
  );
};

export default DialogPlanPortions;
