import React from "react";
import Recipe, {Recipes} from "../../Recipe/recipe.class";
import {MealRecipe, Menue, MenuplanData} from "../Menuplan/menuplan.types";
import {RecipeShort} from "../../Recipe/recipe.types";
import {
  RECIPE_DRAWER_DATA_INITIAL_VALUES,
  RecipeDrawerData,
} from "../../Recipe/RecipeDrawer";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";

interface UseRecipeDrawerProps {
  recipes: Recipes;
  menuplan: MenuplanData;
  fetchMissingData: (props: FetchMissingDataProps) => void;
}

const useRecipeDrawer = ({
  recipes,
  menuplan,
  fetchMissingData,
}: UseRecipeDrawerProps) => {
  const [recipeDrawerData, setRecipeDrawerData] =
    React.useState<RecipeDrawerData>(RECIPE_DRAWER_DATA_INITIAL_VALUES);

  // Update drawer data when recipes load (moved from render body to useEffect)
  React.useEffect(() => {
    setRecipeDrawerData((prev) => {
      if (
        prev.isLoadingData &&
        Object.prototype.hasOwnProperty.call(recipes, prev.recipe.uid)
      ) {
        if (!prev.recipe.name) {
          return {
            ...prev,
            isLoadingData:
              recipes[prev.recipe.uid].portions > 0 ? false : true,
            open: true,
            recipe: recipes[prev.recipe.uid],
          };
        } else if (
          prev.recipe?.portions == 0 &&
          recipes[prev.recipe.uid]?.portions > 0
        ) {
          return {
            ...prev,
            isLoadingData: false,
            open: true,
            recipe: recipes[prev.recipe.uid],
          };
        }
      }
      return prev;
    });
  }, [recipes]);

  const onOpenRecipeDrawer = React.useCallback(
    (menueUid: Menue["uid"], recipeUid: Recipe["uid"]) => {
      let mealRecipe = {} as MealRecipe;
      let recipe = new Recipe();
      recipe.uid = recipeUid;

      let loadingData = false;
      let openDrawer = false;

      menuplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
        if (
          menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid == recipeUid
        ) {
          mealRecipe = menuplan.mealRecipes[mealRecipeUid];
        }
      });

      if (!mealRecipe) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(recipes, recipeUid)) {
        recipe = recipes[recipeUid] as Recipe;
        openDrawer = true;
      } else {
        recipe.name = mealRecipe.recipe.name;
        fetchMissingData({
          type: FetchMissingDataType.RECIPE,
          recipeShort: {
            uid: mealRecipe.recipe.recipeUid,
            name: mealRecipe.recipe.name,
            type: mealRecipe.recipe.type,
            created: {
              fromUid: mealRecipe.recipe.createdFromUid,
            },
          } as RecipeShort,
        });
        loadingData = true;
      }

      setRecipeDrawerData((prev) => ({
        ...prev,
        open: openDrawer,
        isLoadingData: loadingData,
        recipe: recipe,
        scaledPortions: mealRecipe.totalPortions,
      }));
    },
    [menuplan, recipes, fetchMissingData],
  );

  const onRecipeDrawerClose = React.useCallback(() => {
    setRecipeDrawerData((prev) => ({...prev, open: false}));
  }, []);

  return {
    recipeDrawerData,
    onOpenRecipeDrawer,
    onRecipeDrawerClose,
  };
};

export {useRecipeDrawer};
