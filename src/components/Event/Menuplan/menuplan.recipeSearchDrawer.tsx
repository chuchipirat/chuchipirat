/**
 * Drawer zum Suchen und Auswählen von Rezepten für den Menüplan.
 *
 * Wird geöffnet, wenn der Benutzer ein Rezept zu einem Menü hinzufügen möchte.
 * Enthält eine Rezept-Suche und erlaubt das Erstellen neuer Rezepte.
 */
import React from "react";

import {
  Container,
  IconButton,
  Typography,
  Drawer,
} from "@mui/material";
import {
  Add as AddIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

import {useCustomStyles} from "../../../constants/styles";
import {RECIPES_DRAWER_TITLE as TEXT_RECIPES_DRAWER_TITLE} from "../../../constants/text";
import {DrawerSettings} from "../../Recipe/RecipeDrawer";
import {RecipeSearch} from "../../Recipe/recipes";
import {RecipeShort} from "../../Recipe/recipe.types";
import {OnRecipeCardClickProps} from "../../Recipe/recipes";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import type {OnRecipeSelection} from "./menuplan.page.types";

/**
 * Props für den Rezept-Suchen-Drawer.
 *
 * @param drawerSettings - Einstellungen des Drawers (open, isLoadingData)
 * @param recipes - Liste der verfügbaren Rezepte
 * @param authUser - Authentifizierter Benutzer
 * @param onClose - Callback beim Schliessen
 * @param onRecipeCardClick - Callback beim Klick auf eine Rezeptkarte
 * @param onRecipeSelection - Callback bei Rezeptauswahl (FAB-Button)
 * @param onNewRecipe - Callback zum Erstellen eines neuen Rezepts
 * @param searchResetKey - Key zum Zurücksetzen der Suche
 */
interface RecipeSearchDrawerProps {
  drawerSettings: DrawerSettings;
  recipes: RecipeShort[];
  authUser: AuthUser;
  onClose: () => void;
  onRecipeCardClick: ({event, recipe}: OnRecipeCardClickProps) => void;
  onRecipeSelection: ({recipe}: OnRecipeSelection) => void;
  onNewRecipe: () => void;
  searchResetKey?: number;
}

/**
 * Drawer-Komponente für die Rezeptsuche im Menüplan.
 * Zeigt eine durchsuchbare Liste aller Rezepte und erlaubt deren Auswahl.
 */
const RecipeSearchDrawer = ({
  drawerSettings,
  recipes,
  onClose,
  onRecipeCardClick,
  onRecipeSelection,
  onNewRecipe,
  authUser,
  searchResetKey = 0,
}: RecipeSearchDrawerProps) => {
  const classes = useCustomStyles();

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
        style={{marginTop: "2rem", width: "100%", height: "100vh"}}
        maxWidth={false}
      >
        <Typography variant="h2" align="center" style={{marginBottom: "2rem"}}>
          {TEXT_RECIPES_DRAWER_TITLE}{" "}
        </Typography>
        <RecipeSearch
          key={searchResetKey}
          recipes={recipes}
          embeddedMode={true}
          fabButtonIcon={<AddIcon />}
          onFabButtonClick={onRecipeSelection}
          onNewClick={onNewRecipe}
          onCardClick={onRecipeCardClick}
          isLoading={drawerSettings.isLoadingData}
          authUser={authUser}
        />
      </Container>
    </Drawer>
  );
};

export {RecipeSearchDrawer};
