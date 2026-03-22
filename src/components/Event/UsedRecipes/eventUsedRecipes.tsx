/**
 * Übersichtskomponente für die Rezepte einer ausgewählten Liste.
 *
 * Iteriert über die sortierten Menüs und rendert für jedes Menü-Rezept
 * eine `EventUsedMealRecipe`-Karte. Gelöschte Rezepte und Rezepte ohne
 * geladene Daten werden übersprungen.
 *
 * @param props - Sortierte Menüliste, geladene Rezepte und Menüplan
 */
import React from "react";

import {Stack, Container, useTheme, Box} from "@mui/material";

import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {
  MealRecipe,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import Recipe from "../../Recipe/recipe.class";
import {EventUsedMealRecipe} from "./eventUsedMealRecipe";

interface RecipeCard {
  mrUid: string;
  coord: MenueCoordinates;
  recipe: Recipe;
  mealRecipe: MealRecipe;
}

interface EventUsedRecipesProps {
  sortedMenueList: MenueCoordinates[];
  usedRecipes: Record<string, Recipe>;
  menuplan: MenuplanData;
  groupConfiguration: EventGroupConfiguration;
}

const EventUsedRecipes = React.memo(function EventUsedRecipes({
  sortedMenueList,
  usedRecipes,
  menuplan,
  groupConfiguration,
}: EventUsedRecipesProps) {
  const theme = useTheme();

  // Rezept-Karten vorberechnen, damit das Rendering nur ein flaches .map() ist
  const recipeCards = React.useMemo<RecipeCard[]>(
    () =>
      sortedMenueList.flatMap((coord) =>
        menuplan.menues[coord.menueUid].mealRecipeOrder
          .filter((mrUid) => {
            const mr = menuplan.mealRecipes[mrUid];
            return (
              mr.recipe &&
              !mr.recipe.recipeUid.includes("[DELETED]") &&
              usedRecipes[mr.recipe.recipeUid]
            );
          })
          .map((mrUid) => ({
            mrUid,
            coord,
            recipe: usedRecipes[menuplan.mealRecipes[mrUid].recipe.recipeUid],
            mealRecipe: menuplan.mealRecipes[mrUid],
          })),
      ),
    [sortedMenueList, menuplan, usedRecipes],
  );

  return (
    <Container style={{marginTop: theme.spacing(2)}}>
      <Box component="div" sx={{justifyContent: "center", display: "flex"}}>
        <Stack spacing={2}>
          {recipeCards.map((card) => (
            <EventUsedMealRecipe
              recipe={card.recipe}
              mealRecipe={card.mealRecipe}
              menueCoordinate={card.coord}
              groupConfiguration={groupConfiguration}
              key={"eventUsedRecipe_" + card.mrUid}
            />
          ))}
        </Stack>
      </Box>
    </Container>
  );
});

export {EventUsedRecipes};
