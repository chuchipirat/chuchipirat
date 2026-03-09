/**
 * RecipeDrawer — wiederverwendbarer Bottom-Drawer zur Anzeige und Bearbeitung von Rezepten.
 *
 * Wurde aus `menuplan.tsx` extrahiert, damit er auch in anderen Kontexten
 * (z.B. Admin-Übersicht) eingesetzt werden kann. Im Admin-Kontext ist
 * `groupConfiguration` optional und wird intern durch eine leere Instanz ersetzt.
 *
 * @example
 * <RecipeDrawer
 *   drawerSettings={{open: true, isLoadingData: false}}
 *   recipe={myRecipe}
 *   mealPlan={[]}
 *   scaledPortions={0}
 *   editMode={false}
 *   firebase={firebase}
 *   authUser={authUser}
 *   onClose={() => setOpen(false)}
 * />
 */
import React from "react";
import {Container, Drawer, IconButton} from "@mui/material";
import {Close as CloseIcon} from "@mui/icons-material";
import useCustomStyles from "../../constants/styles";
import RecipeView from "./recipe.view";
import type {OnAddToEvent} from "./recipe.view";
import RecipeEdit from "./recipe.edit";
import Recipe from "./recipe.class";
import EventGroupConfiguration from "../Event/GroupConfiguration/groupConfiguration.class";
import type {PlanedMealsRecipe, MealRecipe} from "../Event/Menuplan/menuplan.types";
import Firebase from "../Firebase/firebase.class";
import AuthUser from "../Firebase/Authentication/authUser.class";

/* =====================================================================
// Typen — werden auch von menuplan.tsx und Admin-Seiten genutzt
// ===================================================================== */

/**
 * Basis-Einstellungen für Drawer-Anzeige.
 *
 * @param open - Ob der Drawer geöffnet ist
 * @param isLoadingData - Ob Daten noch geladen werden (zeigt Ladeanzeige)
 */
export interface DrawerSettings {
  open: boolean;
  isLoadingData: boolean;
}

/**
 * Vollständige Daten für den Rezept-Drawer (erweitert DrawerSettings).
 *
 * @param recipe - Das anzuzeigende Rezept
 * @param mealPlan - Liste der geplanten Mahlzeiten (leer wenn kein Event-Kontext)
 * @param scaledPortions - Skalierte Portionenanzahl (0 = nicht skaliert)
 * @param editMode - Ob der Drawer im Bearbeitungsmodus geöffnet ist
 */
export interface RecipeDrawerData extends DrawerSettings {
  recipe: Recipe;
  mealPlan: Array<PlanedMealsRecipe>;
  scaledPortions: number;
  editMode: boolean;
}

/** Standardwerte für RecipeDrawerData (Drawer geschlossen, leeres Rezept). */
export const RECIPE_DRAWER_DATA_INITIAL_VALUES: RecipeDrawerData = {
  open: false,
  isLoadingData: false,
  recipe: new Recipe(),
  mealPlan: [],
  scaledPortions: 0,
  editMode: false,
};

/* =====================================================================
// Props
// ===================================================================== */

/**
 * Props für den RecipeDrawer.
 *
 * @param drawerSettings - Öffnungszustand und Ladestatus
 * @param recipe - Das anzuzeigende Rezept
 * @param mealPlan - Geplante Mahlzeiten (leer im Admin-Kontext)
 * @param groupConfiguration - Event-Gruppenkonfiguration (optional; im Admin-Kontext weglassen)
 * @param scaledPortions - Skalierte Portionen
 * @param editMode - Edit-Modus aktiv
 * @param disableFunctionality - Alle Aktions-Buttons deaktivieren (z.B. im Admin-Kontext)
 * @param firebase - Firebase-Instanz
 * @param authUser - Angemeldeter Benutzer
 * @param onClose - Callback beim Schliessen
 * @param onAddToEvent - Callback: Rezept zu Event hinzufügen (optional)
 * @param onEditRecipeMealPlan - Callback: Mahlzeit-Plan bearbeiten (optional)
 * @param onRecipeUpdate - Callback: Rezept wurde aktualisiert (optional)
 * @param onSwitchEditMode - Callback: Edit-Modus umschalten (optional)
 * @param onRecipeDelete - Callback: Rezept wurde gelöscht (optional)
 */
interface RecipeDrawerProps {
  drawerSettings: DrawerSettings;
  recipe: Recipe;
  mealPlan: Array<PlanedMealsRecipe>;
  groupConfiguration?: EventGroupConfiguration;
  scaledPortions: number;
  editMode: boolean;
  disableFunctionality?: boolean;
  firebase: Firebase;
  authUser: AuthUser;
  onClose: () => void;
  onAddToEvent?: ({recipe}: OnAddToEvent) => void;
  onEditRecipeMealPlan?: (mealRecipeUid: MealRecipe["uid"]) => void;
  onRecipeUpdate?: (recipe: Recipe) => void;
  onSwitchEditMode?: () => void;
  onRecipeDelete?: () => void;
}

/* =====================================================================
// Komponente
// ===================================================================== */

/**
 * Bottom-Drawer zur Anzeige und Bearbeitung eines Rezepts.
 *
 * Rendert je nach `editMode` entweder `RecipeEdit` oder `RecipeView`.
 * Im Admin-Kontext ist `groupConfiguration` optional — fehlt sie, wird
 * eine leere `EventGroupConfiguration` als Fallback verwendet.
 */
export const RecipeDrawer = ({
  drawerSettings,
  recipe,
  mealPlan,
  groupConfiguration,
  editMode,
  disableFunctionality = false,
  scaledPortions,
  firebase,
  authUser,
  onClose,
  onAddToEvent,
  onEditRecipeMealPlan,
  onSwitchEditMode,
  onRecipeDelete,
  onRecipeUpdate: onRecipeUpdateSuper,
}: RecipeDrawerProps) => {
  const classes = useCustomStyles();

  /** Adaptiert die Signatur von RecipeView/RecipeEdit auf den externen Callback. */
  const onRecipeUpdate = ({recipe}: {recipe: Recipe}) => {
    if (onRecipeUpdateSuper) {
      onRecipeUpdateSuper(recipe);
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={drawerSettings.open}
      onClose={onClose}
      sx={classes.recipeDrawerBackground}
      ModalProps={{
        keepMounted: true,
      }}
    >
      <IconButton
        color="inherit"
        aria-label="close"
        sx={classes.closeDrawerIconButton}
        onClick={onClose}
        size="large"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <Container
        style={{width: "100%", height: "100vh", padding: "0"}}
        maxWidth={false}
      >
        {editMode ? (
          <RecipeEdit
            dbRecipe={recipe}
            mealPlan={mealPlan}
            isLoading={false}
            isEmbedded={true}
            switchEditMode={onSwitchEditMode}
            onUpdateRecipe={onRecipeUpdate}
            authUser={authUser}
          />
        ) : (
          <RecipeView
            recipe={recipe}
            mealPlan={mealPlan}
            firebase={firebase}
            isEmbedded={true}
            isLoading={drawerSettings.isLoadingData}
            error={null}
            disableFunctionality={disableFunctionality}
            groupConfiguration={groupConfiguration ?? new EventGroupConfiguration()}
            scaledPortions={scaledPortions}
            switchEditMode={onSwitchEditMode}
            onUpdateRecipe={onRecipeUpdate}
            onEditRecipeMealPlan={onEditRecipeMealPlan}
            onAddToEvent={onAddToEvent}
            onRecipeDelete={onRecipeDelete}
            authUser={authUser}
          />
        )}
      </Container>
    </Drawer>
  );
};
