/**
 * Dialog zur Portionenplanung im Menüplan.
 *
 * Erlaubt dem Benutzer, für ausgewählte Menüs die Portionen pro Diätgruppe
 * und Unverträglichkeit festzulegen. Unterstützt Multi-Diät-Planung:
 * mehrere Diäten können gleichzeitig konfiguriert werden (z.B. Omnivore + Vegetarisch).
 *
 * Enthält drei Komponenten:
 * - `DialogPlanPortions` — Hauptdialog mit Diät-Tabs und Validierung
 * - `DialogPlanPortionsMealBlock` — Block pro Mahlzeit (Fix vs. Gruppen)
 * - `DialogPlanPortionsMealBlockRow` — Einzelne Zeile mit Checkbox, Faktor und Total
 */
import React, {useState} from "react";

import {
  Container,
  Switch,
  Button,
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
  Tabs,
  Tab,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";

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
  DialogPlanPortionsDietPlanning,
  DialogPlanPortionsDialogValues,
  DialogPlanPortionsPlanningInfo,
} from "./menuplan.page.types";
import {PlanedObject} from "./menuplan.constants";
import {MenuplanData} from "./menuplan.types";
import {findMealOfMenu} from "./menuplanService";
import EventGroupConfiguration, {
  Intolerance,
} from "../GroupConfiguration/groupConfiguration.class";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";
import {
  DialogType,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";

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
  FACTOR_TOO_LARGE as TEXT_FACTOR_TOO_LARGE,
  FIXED_PORTIONS_WARNING as TEXT_FIXED_PORTIONS_WARNING,
  CONFLICT_ALLE_AND_DIETS_TITLE as TEXT_CONFLICT_ALLE_AND_DIETS_TITLE,
  CONFLICT_ALLE_AND_DIETS_TEXT as TEXT_CONFLICT_ALLE_AND_DIETS_TEXT,
  KEEP_ALL as TEXT_KEEP_ALL,
  KEEP_INDIVIDUAL_DIETS as TEXT_KEEP_INDIVIDUAL_DIETS,
} from "../../../constants/text";

/* ===================================================================
// ========================= Hilfsfunktionen =========================
// =================================================================== */

/**
 * Erstellt die Planungseinträge für eine einzelne Diät (alle Intoleranzen).
 *
 * @param dietUid UID der Diät (oder PlanedDiet.ALL / PlanedDiet.FIX)
 * @param groupConfiguration Gruppenkonfiguration des Events
 * @returns Planungseinträge pro Intoleranz
 */
function buildDietPlan(
  dietUid: string,
  groupConfiguration: EventGroupConfiguration,
): DialogPlanPortionsDietPlanning {
  const dietPlan: DialogPlanPortionsDietPlanning = {};

  if (dietUid === PlanedDiet.FIX) {
    dietPlan[PlanedDiet.FIX] = {
      active: false,
      portions: 0,
      factor: "1.0",
      total: 0,
      diet: PlanedDiet.FIX,
    };
    return dietPlan;
  }

  // Einzelne Intoleranzen
  groupConfiguration.intolerances.order.forEach((intoleranceUid) => {
    dietPlan[intoleranceUid] = {
      active: false,
      factor: "1.0",
      portions:
        dietUid === PlanedDiet.ALL
          ? groupConfiguration.intolerances.entries[intoleranceUid]
              .totalPortions
          : groupConfiguration.portions[dietUid][intoleranceUid],
      total: 0,
      diet: dietUid,
    };
  });

  // «Alle»-Zeile (Summe aller Intoleranzen dieser Diät)
  dietPlan[PlanedIntolerances.ALL] = {
    active: false,
    factor: "1.0",
    portions:
      dietUid === PlanedDiet.ALL
        ? groupConfiguration.totalPortions
        : groupConfiguration.diets.entries[dietUid].totalPortions,
    total: 0,
    diet: dietUid,
  };

  return dietPlan;
}

/**
 * Erstellt die komplette Planungsstruktur für ein Menü (alle Diäten × Intoleranzen).
 *
 * @param groupConfiguration Gruppenkonfiguration des Events
 * @returns Verschachtelte Planung: Diät → Intoleranz → PlanningInfo
 */
function buildMenuPlan(
  groupConfiguration: EventGroupConfiguration,
): DialogPlanPortionsMealPlanning {
  const menuPlan: DialogPlanPortionsMealPlanning = {};

  // «Alle» Diät-Tab
  menuPlan[PlanedDiet.ALL] = buildDietPlan(PlanedDiet.ALL, groupConfiguration);

  // Individuelle Diät-Tabs
  groupConfiguration.diets.order.forEach((dietUid) => {
    menuPlan[dietUid] = buildDietPlan(dietUid, groupConfiguration);
  });

  // Fix-Tab
  menuPlan[PlanedDiet.FIX] = buildDietPlan(PlanedDiet.FIX, groupConfiguration);

  return menuPlan;
}

/**
 * Berechnet die Gesamtportionen eines Diät-Tabs (Summe aller aktiven Einträge).
 *
 * @param dietPlan Planungseinträge einer Diät
 * @returns Summe der Portionen
 */
function getDietTabPortions(
  dietPlan: DialogPlanPortionsDietPlanning | undefined,
): number {
  if (!dietPlan) return 0;
  return Object.values(dietPlan)
    .filter((entry) => entry.active)
    .reduce((sum, entry) => sum + entry.total, 0);
}

/**
 * Prüft ob eine Diät aktive Einträge hat.
 *
 * @param dietPlan Planungseinträge einer Diät
 * @returns `true` wenn mindestens ein Eintrag aktiv ist
 */
function hasDietActiveEntries(
  dietPlan: DialogPlanPortionsDietPlanning | undefined,
): boolean {
  if (!dietPlan) return false;
  return Object.values(dietPlan).some((entry) => entry.active);
}

/* ===================================================================
// ==================== Einplanung der Portionen =====================
// =================================================================== */
interface DialogPlanPortionsProps {
  open: boolean;
  selectedMenues: DialogSelectMenuesForRecipeDialogValues | null;
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  mealTypes: MenuplanData["mealTypes"];
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

const DIALOG_VALUES_INITIAL_VALUES: DialogPlanPortionsDialogValues = {
  keepMenuPortionsInSync: true,
  activeTabs: null,
  menueList: null,
  plan: null,
};

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
  const theme = useTheme();

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
    !dialogValues.plan &&
    selectedMenues &&
    Object.keys(selectedMenues).length > 0
  ) {
    let menueList: string[] = [];

    if (
      Object.keys(selectedMenues).length > 1 &&
      dialogValues.keepMenuPortionsInSync
    ) {
      menueList = [KEEP_IN_SYNC_KEY];
    } else {
      menueList = Object.keys(selectedMenues);
    }

    // Komplettte Planstruktur für jedes Menü erstellen
    const plan: DialogPlanPortionsMealPlan = {};
    const activeTabs: {[key: string]: string} = {};

    menueList.forEach((menuUid) => {
      plan[menuUid] = buildMenuPlan(groupConfiguration);
      activeTabs[menuUid] = PlanedDiet.ALL;
    });

    // Edit-Modus: bestehende Werte übernehmen
    if (planedMealRecipe.length > 0) {
      // Bestehende Einträge nach Diät gruppieren
      const byDiet: {[dietUid: string]: PortionPlan[]} = {};
      planedMealRecipe.forEach((pp) => {
        if (!byDiet[pp.diet]) byDiet[pp.diet] = [];
        byDiet[pp.diet].push(pp);
      });

      // Werte in die Planstruktur übernehmen
      menueList.forEach((menuUid) => {
        const menuPlan = plan[menuUid];
        if (!menuPlan) return;

        Object.keys(byDiet).forEach((dietUid) => {
          if (!menuPlan[dietUid]) return;
          byDiet[dietUid].forEach((pp) => {
            if (menuPlan[dietUid][pp.intolerance]) {
              menuPlan[dietUid][pp.intolerance] = {
                ...menuPlan[dietUid][pp.intolerance],
                active: true,
                factor: pp.factor.toFixed(1),
                total: pp.totalPortions,
                portions:
                  pp.intolerance === PlanedDiet.FIX
                    ? pp.totalPortions
                    : menuPlan[dietUid][pp.intolerance].portions,
              };
            }
          });
        });
      });

      // Aktiven Tab auf die erste Diät mit Einträgen setzen
      const firstDiet = Object.keys(byDiet)[0] || PlanedDiet.ALL;
      menueList.forEach((menuUid) => {
        activeTabs[menuUid] = firstDiet;
      });
    }

    setDialogValues({
      ...dialogValues,
      plan: plan,
      activeTabs: activeTabs,
      menueList: menueList,
    });
  }
  /* ------------------------------------------
  // Tab-Wechsel
  // ------------------------------------------ */
  /**
   * Wechselt den aktiven Diät-Tab eines Menüs.
   * Rein visuell — der Plan wird nicht verändert. Fix-Portionen sind
   * additiv zu Diät-Portionen und können frei kombiniert werden.
   *
   * @param menuUid UID des Menüs (oder SYNC-Key)
   * @param newTab Neuer aktiver Tab (Diät-UID oder PlanedDiet)
   */
  const onTabChange = (_menuUid: string, newTab: string) => {
    setDialogValues({
      ...dialogValues,
      activeTabs: {...dialogValues.activeTabs, [_menuUid]: newTab},
    });
  };
  /* ------------------------------------------
  // Feld-Änderungen
  // ------------------------------------------ */
  const onFieldUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const updatedField = event.target.id.split("_");
    let factor = "";
    let active = false;
    let portions = 0;
    // Neues Format: _${field}_${menuUid}_${dietUid}_${intoleranceUid}
    const [, changedField, menueUid, dietUid, intoleranceUid] = updatedField;

    if (
      !dialogValues.plan ||
      !dialogValues.plan[menueUid] ||
      !dialogValues.plan[menueUid]![dietUid]
    ) {
      return;
    }
    const dietPlanning = dialogValues.plan[menueUid]![dietUid];
    if (!dietPlanning || !dietPlanning[intoleranceUid]) {
      return;
    }
    if (changedField == "active") {
      active = event.target.checked;
      factor = dietPlanning[intoleranceUid].factor;
      portions = dietPlanning[intoleranceUid].portions;
    } else if (changedField == "factor") {
      active = dietPlanning[intoleranceUid].active;
      factor = event.target.value.replace(",", ".");
      portions = dietPlanning[intoleranceUid].portions;
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
      const updatedDietPlan = {...dietPlanning};
      updatedDietPlan[intoleranceUid] = {
        ...updatedDietPlan[intoleranceUid],
        active,
        factor,
        total,
      };

      if (intoleranceUid == PlanedIntolerances.ALL) {
        // «Alle» Checkbox markiert → andere Intoleranzen demarkieren
        Object.keys(updatedDietPlan).forEach((key) => {
          if (key !== PlanedIntolerances.ALL) {
            updatedDietPlan[key] = {
              ...updatedDietPlan[key],
              active: false,
              factor: "1.0",
              total: 0,
            };
          }
        });
      } else {
        // Einzelne Intoleranz markiert → «Alle» demarkieren
        updatedDietPlan[PlanedIntolerances.ALL] = {
          ...updatedDietPlan[PlanedIntolerances.ALL],
          active: false,
          factor: "1.0",
          total: 0,
        };
      }

      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: {
            ...dialogValues.plan[menueUid],
            [dietUid]: updatedDietPlan,
          },
        },
      });
    } else {
      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: {
            ...dialogValues.plan[menueUid],
            [dietUid]: {
              ...dietPlanning,
              [intoleranceUid]: {
                ...dietPlanning[intoleranceUid],
                portions,
                active,
                factor,
                total,
              },
            },
          },
        },
      });
    }
  };

  const onSwitchSyncAllMenues = () => {
    setDialogValues({
      ...dialogValues,
      activeTabs: null,
      keepMenuPortionsInSync: !dialogValues.keepMenuPortionsInSync,
      plan: null,
      menueList: null,
    });
  };
  /* ------------------------------------------
  // Dialog-Schliessen-Handling
  // ------------------------------------------ */
  /**
   * Validiert den Plan und löst ggf. Konflikte zwischen «Alle» und
   * einzelnen Diäten auf. Gibt den Plan an den Aufrufer zurück.
   */
  const onAddClick = async () => {
    if (!dialogValues.plan) {
      return;
    }

    const dialogValidationMessages: FormValidationFieldError[] = [];

    // Über alle Menüs und alle Diäten validieren
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      const menuPlan = dialogValues.plan![menueUid]!;

      // Alle aktiven Einträge sammeln (über alle Diäten)
      const allActiveEntries: DialogPlanPortionsPlanningInfo[] = [];
      Object.keys(menuPlan).forEach((dietUid) => {
        Object.values(menuPlan[dietUid]).forEach((entry) => {
          if (entry.active) allActiveEntries.push(entry);
        });
      });

      // Prüfen: mindestens ein Eintrag aktiv
      if (allActiveEntries.length === 0) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_NO_GROUP_SELECTED,
        });
      }

      // Prüfen: aktive Einträge ohne Faktor
      if (allActiveEntries.some((e) => !e.factor)) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_MISSING_FACTOR,
        });
      }

      // Prüfen: Faktor > 100
      if (
        allActiveEntries.some(
          (e) => e.factor && parseFloat(e.factor) > 100,
        )
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_FACTOR_TOO_LARGE,
        });
      }

      // Prüfen: Fix-Portionen eingegeben
      const fixDiet = menuPlan[PlanedDiet.FIX];
      if (fixDiet) {
        const fixEntry = fixDiet[PlanedDiet.FIX];
        if (
          fixEntry &&
          fixEntry.active &&
          (!fixEntry.portions || fixEntry.portions === 0)
        ) {
          dialogValidationMessages.push({
            priority: 1,
            fieldName: menueUid,
            errorMessage: TEXT_NO_PORTIONS_GIVEN,
          });
        }
      }
    });

    if (dialogValidationMessages.length > 0) {
      setDialogValidation(dialogValidationMessages);
      return;
    }

    // Konflikt-Prüfung: «Alle» + einzelne Diäten gleichzeitig aktiv?
    let discardMode: "ALL" | "INDIVIDUAL" | null = null;

    for (const menueUid of Object.keys(dialogValues.plan)) {
      const menuPlan = dialogValues.plan[menueUid]!;
      const alleHasActive = hasDietActiveEntries(menuPlan[PlanedDiet.ALL]);
      const individualDietsHaveActive = groupConfiguration.diets.order.some(
        (dietUid) => hasDietActiveEntries(menuPlan[dietUid]),
      );

      if (alleHasActive && individualDietsHaveActive) {
        const result = (await customDialog({
          dialogType: DialogType.selectOptions,
          title: TEXT_CONFLICT_ALLE_AND_DIETS_TITLE,
          text: TEXT_CONFLICT_ALLE_AND_DIETS_TEXT,
          options: [
            {key: "ALL", text: TEXT_KEEP_ALL, variant: "contained"},
            {
              key: "INDIVIDUAL",
              text: TEXT_KEEP_INDIVIDUAL_DIETS,
              variant: "contained",
            },
          ],
        })) as {valid: boolean; input: string} | boolean;

        if (typeof result === "boolean") {
          // Abgebrochen (Cancel)
          return;
        }
        if (!result.valid) {
          return;
        }
        if (result.input === "ALL") {
          discardMode = "INDIVIDUAL";
        } else if (result.input === "INDIVIDUAL") {
          discardMode = "ALL";
        }
        // Nur einmal fragen — gleiche Entscheidung für alle Menüs
        break;
      }
    }

    // Ergebnis zusammenstellen: nur aktive Einträge
    setDialogValidation([]);
    const selectedPlans: {
      [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
    } = {};

    Object.keys(dialogValues.plan).forEach((menuUid) => {
      const menuPlan = dialogValues.plan![menuUid]!;
      const filteredMenuPlan: DialogPlanPortionsMealPlanning = {};

      Object.keys(menuPlan).forEach((dietUid) => {
        // «Alle» verwerfen wenn Einzelne gewählt
        if (discardMode === "ALL" && dietUid === PlanedDiet.ALL) return;
        // Einzelne verwerfen wenn «Alle» gewählt
        if (
          discardMode === "INDIVIDUAL" &&
          dietUid !== PlanedDiet.ALL &&
          dietUid !== PlanedDiet.FIX
        ) {
          return;
        }

        const filteredDiet: DialogPlanPortionsDietPlanning = {};
        Object.keys(menuPlan[dietUid]).forEach((intoleranceUid) => {
          if (menuPlan[dietUid][intoleranceUid].active) {
            filteredDiet[intoleranceUid] = menuPlan[dietUid][intoleranceUid];
          }
        });

        if (Object.keys(filteredDiet).length > 0) {
          filteredMenuPlan[dietUid] = filteredDiet;
        }
      });

      selectedPlans[menuUid] = filteredMenuPlan;
    });

    // SYNC: auf alle Menüs umbiegen
    if (
      Object.keys(selectedMenues!).length > 1 &&
      dialogValues.keepMenuPortionsInSync
    ) {
      const syncPlan = selectedPlans[KEEP_IN_SYNC_KEY];
      Object.keys(selectedMenues!).forEach((menueUid) => {
        selectedPlans[menueUid] = syncPlan;
      });
      delete selectedPlans[KEEP_IN_SYNC_KEY];
    }

    onAddClickSuper(selectedPlans);
    setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
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

  /* ------------------------------------------
  // Tab-Label mit Portionenzähler
  // ------------------------------------------ */
  /**
   * Erzeugt das Tab-Label mit optionalem Portionenzähler.
   *
   * @param name Anzeigename der Diät
   * @param menuUid UID des Menüs
   * @param dietUid UID der Diät
   * @returns React-Element für das Tab-Label
   */
  const renderTabLabel = (
    name: string,
    menuUid: string,
    dietUid: string,
  ): React.ReactNode => {
    const dietPlan = dialogValues.plan?.[menuUid]?.[dietUid];
    const portions = getDietTabPortions(dietPlan);
    const hasActive = hasDietActiveEntries(dietPlan);

    return (
      <span>
        {name}
        {hasActive && (
          <span
            style={{
              marginLeft: "0.3em",
              fontWeight: "bold",
              color: theme.palette.primary.main,
            }}
          >
            ({portions})
          </span>
        )}
      </span>
    );
  };

  return (
    <React.Fragment>
      {selectedMenues ? (
        <Dialog open={open} maxWidth="md" fullWidth>
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
              dialogValues.menueList.map((menueUid, counter) => {
                let meal: Meal = {
                  uid: "",
                  date: "",
                  mealType: "",
                  mealTypeName: "",
                  menuOrder: [],
                };
                if (menueUid !== KEEP_IN_SYNC_KEY) {
                  meal = findMealOfMenu({
                    menueUid: menueUid,
                    meals: meals,
                  });
                }
                const activeTab =
                  dialogValues.activeTabs?.[menueUid] || PlanedDiet.ALL;

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
                    {/* Datumsanzeige */}
                    {menueUid == KEEP_IN_SYNC_KEY ? (
                      <React.Fragment>
                        <Typography variant="subtitle1">
                          {`${TEXT_ON_DATE}: `}
                        </Typography>
                        {Object.keys(selectedMenues).map(
                          (syncMenueUid) => {
                            const syncMeal = findMealOfMenu({
                              menueUid: syncMenueUid,
                              meals: meals,
                            });
                            return (
                              <Typography
                                variant="subtitle1"
                                key={"date_" + syncMenueUid + counter}
                              >
                                <strong>
                                  {new Date(
                                    syncMeal.date,
                                  ).toLocaleString("default", {
                                    weekday: "long",
                                  })}
                                </strong>
                                {` ${new Date(
                                  syncMeal.date,
                                ).toLocaleString("de-CH", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                })} - ${mealTypes.entries[syncMeal.mealType].name}`}
                              </Typography>
                            );
                          },
                        )}
                      </React.Fragment>
                    ) : (
                      <Typography variant="subtitle1">
                        {`${TEXT_ON_DATE}: `}
                        <strong>
                          {new Date(meal.date).toLocaleString("default", {
                            weekday: "long",
                          })}
                        </strong>
                        {` ${new Date(meal.date).toLocaleString("de-CH", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })} - ${mealTypes.entries[meal.mealType].name}`}
                      </Typography>
                    )}

                    {/* Diät-Tabs */}
                    <Tabs
                      value={activeTab}
                      onChange={(_e, newValue) =>
                        onTabChange(menueUid, newValue as string)
                      }
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{marginBottom: theme.spacing(2)}}
                    >
                      <Tab
                        value={PlanedDiet.ALL}
                        label={renderTabLabel(
                          TEXT_ALL,
                          menueUid,
                          PlanedDiet.ALL,
                        )}
                      />
                      {groupConfiguration?.diets.order.map((dietUid) => (
                        <Tab
                          key={"dietTab_" + menueUid + "_" + dietUid}
                          value={dietUid}
                          label={renderTabLabel(
                            groupConfiguration.diets.entries[dietUid].name,
                            menueUid,
                            dietUid,
                          )}
                        />
                      ))}
                      <Tab
                        value={PlanedDiet.FIX}
                        label={renderTabLabel(
                          TEXT_FIX_PORTIONS,
                          menueUid,
                          PlanedDiet.FIX,
                        )}
                      />
                    </Tabs>

                    {/* Fix-Warnung */}
                    {activeTab === PlanedDiet.FIX && (
                      <Alert
                        severity="info"
                        sx={{marginBottom: theme.spacing(2)}}
                      >
                        {TEXT_FIXED_PORTIONS_WARNING}
                      </Alert>
                    )}

                    {/* Tab-Inhalt */}
                    {dialogValues.plan?.[menueUid] && (
                      <DialogPlanPortionsMealBlock
                        key={"dialogPlanPortionsMealBlock_" + menueUid}
                        activeDietUid={activeTab}
                        dietPlan={
                          dialogValues.plan[menueUid]![activeTab]
                        }
                        menuPlan={dialogValues.plan[menueUid]!}
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
                            .filter(
                              (message) => message.fieldName == menueUid,
                            )
                            .map((errorMessage, idx) => (
                              <Typography
                                color="error"
                                key={"errormessage_" + idx}
                              >
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
            <Button onClick={onCancelClick} color="primary" variant="outlined">
              {TEXT_CANCEL}
            </Button>
            {planedObject == PlanedObject.RECIPE &&
              planedMealRecipe.length == 0 && (
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
  activeDietUid: string;
  dietPlan: DialogPlanPortionsDietPlanning | undefined;
  menuPlan: DialogPlanPortionsMealPlanning;
  groupConfiguration: EventGroupConfiguration;
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const DialogPlanPortionsMealBlock = ({
  menueUid,
  activeDietUid,
  dietPlan,
  menuPlan,
  groupConfiguration,
  onFieldUpdate,
}: DialogPlanPortionsMealBlockProps) => {
  const theme = useTheme();

  if (!dietPlan) return null;

  if (activeDietUid === PlanedDiet.FIX) {
    return (
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            size="small"
            id={
              "dialogPlanPortionsMealBlockIntolerance_total_" +
              menueUid +
              "_" +
              PlanedDiet.FIX +
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
            value={dietPlan[PlanedDiet.FIX]?.total ?? 0}
            fullWidth
          />
        </Grid>
      </Grid>
    );
  }

  // Zusammenfassung aller aktiven Diäten berechnen
  const allDietEntries: {dietUid: string; name: string; portions: number}[] =
    [];
  // «Alle»-Tab
  const allePortions = getDietTabPortions(menuPlan[PlanedDiet.ALL]);
  if (allePortions > 0) {
    allDietEntries.push({
      dietUid: PlanedDiet.ALL,
      name: TEXT_ALL,
      portions: allePortions,
    });
  }
  // Individuelle Diäten
  const hasIndividualDiets = groupConfiguration.diets.order.some(
    (dietUid) => getDietTabPortions(menuPlan[dietUid]) > 0,
  );
  groupConfiguration.diets.order.forEach((dietUid) => {
    const portions = getDietTabPortions(menuPlan[dietUid]);
    if (portions > 0) {
      allDietEntries.push({
        dietUid,
        name: groupConfiguration.diets.entries[dietUid].name,
        portions,
      });
    }
  });
  // Fix-Portionen
  const fixPortions = getDietTabPortions(menuPlan[PlanedDiet.FIX]);
  if (fixPortions > 0) {
    allDietEntries.push({
      dietUid: PlanedDiet.FIX,
      name: TEXT_FIX_PORTIONS,
      portions: fixPortions,
    });
  }
  // «Alle» ausblenden wenn individuelle Diäten vorhanden — Konflikt
  // wird erst beim Absenden gelöst, Daten bleiben erhalten
  const dietSummary = allDietEntries.filter(
    (e) => !(e.dietUid === PlanedDiet.ALL && hasIndividualDiets),
  );
  const grandTotal = dietSummary.reduce((sum, d) => sum + d.portions, 0);

  return (
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
      {/* «Alle»-Zeile innerhalb des Diät-Tabs */}
      <DialogPlanPortionsMealBlockRow
        key={
          "dialogPlanPortionsMealBlockRow_" +
          menueUid +
          "_" +
          activeDietUid +
          "_" +
          PlanedIntolerances.ALL
        }
        intoleranceUid={PlanedIntolerances.ALL}
        dietUid={activeDietUid}
        menueUid={menueUid}
        intoleranceName={TEXT_ALL}
        portionsOfIntolerance={
          activeDietUid === PlanedDiet.ALL
            ? groupConfiguration.totalPortions
            : groupConfiguration.diets.entries[activeDietUid].totalPortions
        }
        active={dietPlan[PlanedIntolerances.ALL]?.active}
        factor={dietPlan[PlanedIntolerances.ALL]?.factor}
        totalPortions={dietPlan[PlanedIntolerances.ALL]?.total}
        onFieldUpdate={onFieldUpdate}
      />
      {groupConfiguration.intolerances.order.map((intoleranceUid) => (
        <DialogPlanPortionsMealBlockRow
          key={
            "dialogPlanPortionsMealBlockRow_" +
            menueUid +
            "_" +
            activeDietUid +
            "_" +
            intoleranceUid
          }
          intoleranceUid={intoleranceUid}
          dietUid={activeDietUid}
          menueUid={menueUid}
          intoleranceName={
            groupConfiguration.intolerances.entries[intoleranceUid].name
          }
          portionsOfIntolerance={
            activeDietUid === PlanedDiet.ALL
              ? groupConfiguration.intolerances.entries[intoleranceUid]
                  .totalPortions
              : groupConfiguration.portions[activeDietUid][intoleranceUid]
          }
          active={dietPlan[intoleranceUid]?.active}
          factor={dietPlan[intoleranceUid]?.factor}
          totalPortions={dietPlan[intoleranceUid]?.total}
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
          size="small"
          fullWidth
          disabled
          value={getDietTabPortions(dietPlan) || ""}
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
      {/* Aufschlüsselung anderer aktiver Diäten (ohne aktiven Tab) */}
      {dietSummary
        .filter((entry) => entry.dietUid !== activeDietUid)
        .map((entry) => (
          <React.Fragment key={"dietSummary_" + entry.dietUid}>
            <Grid size={8}>
              <Typography
                variant="body1"
                style={{color: theme.palette.text.secondary}}
              >
                {entry.name}
              </Typography>
            </Grid>
            <Grid size={2} />
            <Grid size={2}>
              <TextField
                size="small"
                fullWidth
                disabled
                value={entry.portions || ""}
                label={entry.name}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <strong>+</strong>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </React.Fragment>
        ))}
      {/* Gesamttotal über alle Diäten — nur anzeigen wenn mehrere aktiv */}
      {dietSummary.length > 1 && (
        <React.Fragment>
          <Grid size={8}>
            <Typography variant="body1">
              <strong>{TEXT_TOTAL_PORTIONS}</strong>
            </Typography>
          </Grid>
          <Grid size={2} />
          <Grid size={2}>
            <TextField
              size="small"
              fullWidth
              disabled
              value={grandTotal || ""}
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
      )}
    </Grid>
  );
};
/* ===================================================================
// ================ Einplanung der Portionen - Reihe =================
// =================================================================== */
interface DialogPlanPortionsMealBlockRowProps {
  active: boolean | undefined;
  menueUid: Menue["uid"];
  dietUid: string;
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
  dietUid,
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
        dietUid +
        "_" +
        intoleranceUid
      }
    >
      <Grid size={8}>
        <FormControlLabel
          key={
            "dialogPlanPortionsMealBlockIntoleranceFormcontroll_" +
            menueUid +
            "_" +
            dietUid +
            "_" +
            intoleranceUid
          }
          style={{width: "100%"}}
          control={
            <Checkbox
              id={
                "dialogPlanPortionsMealBlockIntolerance_active_" +
                menueUid +
                "_" +
                dietUid +
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
          size="small"
          id={
            "dialogPlanPortionsMealBlockIntolerance_factor_" +
            menueUid +
            "_" +
            dietUid +
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
          size="small"
          id={
            "dialogPlanPortionsMealBlockIntolerance_totalPortions_" +
            menueUid +
            "_" +
            dietUid +
            "_" +
            intoleranceUid
          }
          fullWidth
          disabled
          value={totalPortions == 0 ? "" : totalPortions}
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
