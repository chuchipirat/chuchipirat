/**
 * PDF-Dokument für die geplanten Rezepte eines Events.
 *
 * Erzeugt pro Rezept eine Seite mit Header, Zutaten (skaliert),
 * Zubereitung, Material und optionalen Notizen. Wird über
 * `@react-pdf/renderer` gerendert und als Blob exportiert.
 *
 * Hinweis: React-PDF nutzt einen eigenen Reconciler — React Context
 * (z.B. EventMasterDataContext) funktioniert hier nicht. Stammdaten
 * werden deshalb weiterhin als Props übergeben.
 *
 * @param props - Liste, Menüplan-Koordinaten, Stammdaten und Autor
 */
import React from "react";
import {Document, Page, View} from "@react-pdf/renderer";
import "../../Shared/pdfFontRegistration";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {pdfStyles} from "../../../constants/stylesRecipePdf";

import {
  APP_NAME as TEXT_APP_NAME,
  QUANTITY_CALCULATION as TEXT_QUANTITY_CALCULATION,
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

/**
 * Props für das UsedRecipes-PDF-Dokument.
 *
 * @param list - Rezeptliste mit Properties und geladenen Rezepten
 * @param sortedMenueList - Sortierte Menü-Koordinaten
 * @param menueplan - Vollständiger Menüplan
 * @param eventName - Name des Events (für Titel und Header)
 * @param products - Alle Produkte (für Einheitenumrechnung)
 * @param units - Alle Einheiten
 * @param unitConversionBasic - Basis-Einheitenumrechnungen
 * @param unitConversionProducts - Produktspezifische Einheitenumrechnungen
 * @param authUser - Aktueller Benutzer (für Footer und Autor-Metadaten)
 */
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
      keywords={eventName + " " + TEXT_QUANTITY_CALCULATION}
      subject={TEXT_QUANTITY_CALCULATION + " " + eventName}
      title={TEXT_QUANTITY_CALCULATION + " " + eventName}
    >
      {sortedMenueList.map((menueCoordinate) => {
        const menue = menueplan.menues[menueCoordinate.menueUid];
        if (!menue) return null;

        return menue.mealRecipeOrder
          .filter((mealRecipeUid) => {
            const mealRecipe = menueplan.mealRecipes[mealRecipeUid];
            return (
              mealRecipe?.recipe &&
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

/**
 * Einzelne PDF-Seite für ein Rezept.
 *
 * Rendert Header, skalierte Zutaten, Zubereitung, Material und Notizen.
 * Zutaten und Material werden anhand der geplanten Portionen hochgerechnet.
 *
 * @param props - Rezeptdaten, Menü-Koordinaten und Stammdaten
 */
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
  // Zutaten und Material auf geplante Portionen hochrechnen
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
              {recipe.materials?.order?.length > 0 &&
              recipe.materials?.entries?.[recipe.materials.order[0]]?.uid !== "" ? (
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
      recipe.variantProperties?.note ? (
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

const styles = pdfStyles;
