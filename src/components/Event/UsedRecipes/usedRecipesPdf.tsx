import React from "react";
import {Document, Page, View, Font} from "@react-pdf/renderer";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import StylesPdf from "../../../constants/stylesRecipePdf";

import {
  APP_NAME as TEXT_APP_NAME,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
} from "../../../constants/text";
import {UsedRecipeListEntry} from "./usedRecipes.class";

import {
  RecipeHeader,
  RecipeIngredients,
  RecipeMaterial,
  RecipePreparation,
  RecipeNote,
  RecipeVariantNote,
} from "../../Recipe/recipePdf";

import {
  MealRecipe,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import Recipe, {RecipeType} from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import {Footer, Header} from "../../Shared/pdfComponents";
import Unit from "../../Unit/unit.class";

interface UsedRecipesPdfProps {
  list: UsedRecipeListEntry;
  sortedMenueList: MenueCoordinates[];
  menueplan: MenuplanData;
  eventName: Event["name"];
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  authUser: AuthUser;
}

const UsedRecipesPdf = ({
  list,
  sortedMenueList,
  menueplan,
  eventName,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
  authUser,
}: UsedRecipesPdfProps) => {
  const actualDate = new Date();

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={eventName + " " + TEXT_SHOPPING_LIST}
      subject={TEXT_SHOPPING_LIST + " " + eventName}
      title={TEXT_SHOPPING_LIST + " " + eventName}
    >
      {sortedMenueList.map((menueCoordinate) => {
        return menueplan.menues[menueCoordinate.menueUid].mealRecipeOrder
          .filter((mealRecipeUid) => {
            const mealRecipe = menueplan.mealRecipes[mealRecipeUid];
            return (
              mealRecipe &&
              list.recipes[mealRecipe.recipe.recipeUid]
            );
          })
          .map((mealRecipeUid) => (
            <RecipePage
              eventName={eventName}
              mealRecipe={menueplan.mealRecipes[mealRecipeUid]}
              recipe={
                list.recipes[
                  menueplan.mealRecipes[mealRecipeUid].recipe.recipeUid
                ]
              }
              menueCoordinates={menueCoordinate}
              products={products}
              units={units}
              unitConversionBasic={unitConversionBasic}
              unitConversionProducts={unitConversionProducts}
              actualDate={actualDate}
              authUser={authUser}
              key={"recipePage_" + mealRecipeUid}
            />
          ));
      })}
    </Document>
  );
};

/* ===================================================================
// =========================== Rezept-Seite ==========================
// =================================================================== */
interface RecipePageProps {
  eventName: Event["name"];
  mealRecipe: MealRecipe;
  recipe: Recipe;
  menueCoordinates: MenueCoordinates;
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  actualDate: Date;
  authUser: AuthUser;
}
const RecipePage = ({
  mealRecipe,
  recipe,
  menueCoordinates,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
  eventName,
  actualDate,
  authUser,
}: RecipePageProps) => {
  // Hochrechnen
  const scaledIngredients = Recipe.scaleIngredients({
    recipe: recipe,
    portionsToScale: mealRecipe.totalPortions,
    scalingOptions: {convertUnits: true},
    products: products,
    units: units,
    unitConversionBasic: unitConversionBasic,
    unitConversionProducts: unitConversionProducts,
  });
  const scaledMaterials = Recipe.scaleMaterials({
    recipe: recipe,
    portionsToScale: mealRecipe.totalPortions,
  });

  return (
    <Page key={"page_" + mealRecipe.uid} style={styles.body}>
      <Header text={eventName} uid={mealRecipe.uid} />
      <RecipeHeader
        recipe={recipe}
        scaledPortions={mealRecipe.totalPortions}
        menueCoordinate={menueCoordinates}
      />

      <View style={styles.containerBottomBorder} />
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableCol50}>
            <View style={styles.tableNoMargin}>
              <View style={styles.tableCol100}>
                <RecipeIngredients
                  ingredients={recipe.ingredients}
                  scaledIngredients={scaledIngredients}
                  scaledPortions={mealRecipe.totalPortions}
                />
              </View>
              {recipe.materials?.order.length > 0 &&
              recipe.materials.entries[recipe.materials.order[0]].uid !== "" ? (
                <View style={styles.tableCol100}>
                  <RecipeMaterial
                    materials={recipe.materials}
                    scaledPortions={mealRecipe.totalPortions}
                    scaledMaterials={scaledMaterials}
                  />
                </View>
              ) : (
                <View />
              )}
            </View>
            <View style={styles.tableCol100}></View>
          </View>

          <View style={styles.tableCol50}>
            <View style={styles.tableNoMargin}>
              <View style={styles.tableCol100}>
                <RecipePreparation recipe={recipe} />
              </View>
            </View>
          </View>
        </View>
      </View>
      {recipe.note ? (
        <React.Fragment>
          <View style={styles.containerBottomBorder} />
          <RecipeNote recipe={recipe} />
        </React.Fragment>
      ) : null}
      {recipe.type == RecipeType.variant &&
      recipe.variantProperties?.note !== "" ? (
        <React.Fragment>
          <View style={styles.containerBottomBorder} />
          <RecipeVariantNote recipe={recipe} />
        </React.Fragment>
      ) : null}

      <Footer
        uid={mealRecipe.uid}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Page>
  );
};
export default UsedRecipesPdf;
/* ===================================================================
// ======================== Fonts registrieren =======================
// =================================================================== */
//-->gist.github.com/karimnaaji/b6c9c9e819204113e9cabf290d580551
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/7MygqTe2zs9YkP0adA9QQQ.ttf",
      fontStyle: "normal",
      fontWeight: 100,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v16/zN7GBFwfMP4uA6AR0HCoLQ.ttf",
      fontWeight: 400,
      fontStyle: "normal",
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/bdHGHleUa-ndQCOrdpfxfw.ttf",
      fontStyle: "normal",
      fontWeight: 700,
    },
  ],
});

const styles = StylesPdf.getPdfStyles();
