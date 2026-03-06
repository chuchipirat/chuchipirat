import React from "react";
import {Document, Page, View, Text, Link, Font} from "@react-pdf/renderer";
import Utils from "../Shared/utils.class";

import StylesPdf from "../../constants/stylesRecipePdf";
import * as TEXT from "../../constants/text";
import Recipe, {
  Ingredient,
  PositionType,
  PreparationStep,
  RecipeMaterialPosition,
  RecipeObjectStructure,
  RecipeType,
  Section,
} from "./recipe.class";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {MenueCoordinates} from "../Event/Menuplan/menuplan.class";
import {Footer} from "../Shared/pdfComponents";

/* ===================================================================
// ============================ Rezept PDF ===========================
// =================================================================== */
interface RecipePdfProps {
  recipe: Recipe;
  scaledPortions: number | null;
  scaledIngredients: RecipeObjectStructure<Ingredient>;
  scaledMaterials: RecipeObjectStructure<RecipeMaterialPosition>;
  authUser: AuthUser;
}
const RecipePdf = ({
  recipe,
  scaledPortions,
  scaledIngredients,
  scaledMaterials,
  authUser,
}: RecipePdfProps) => {
  const actualDate = new Date();
  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT.APP_NAME}
      keywords={recipe.name}
      subject={recipe.name}
      title={recipe.name}
    >
      <RecipePage
        key={"recipePage_" + recipe.uid}
        recipe={recipe}
        scaledPortions={scaledPortions}
        scaledIngredients={scaledIngredients}
        scaledMaterials={scaledMaterials}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Document>
  );
};
/* ===================================================================
// =========================== Rezept-Seite ==========================
// =================================================================== */
interface RecipePageProps {
  recipe: Recipe;
  scaledPortions: number | null;
  scaledIngredients: RecipeObjectStructure<Ingredient>;
  scaledMaterials: RecipeObjectStructure<RecipeMaterialPosition>;
  actualDate: Date;
  authUser: AuthUser;
}
const RecipePage = ({
  recipe,
  scaledPortions,
  scaledIngredients,
  scaledMaterials,
  actualDate,
  authUser,
}: RecipePageProps) => {
  const hasMaterials =
    recipe.materials?.order.length > 0 &&
    recipe.materials.entries[recipe.materials.order[0]].uid !== "";

  return (
    <Page key={"page_" + recipe.uid} style={styles.body}>
      <RecipeHeader recipe={recipe} scaledPortions={scaledPortions} />
      {/* Zweispaltiges Layout: Zutaten links, Zubereitung rechts.
          react-pdf behandelt ein flexDirection:"row" View als atomare Einheit
          — passt der Block nicht mehr auf die aktuelle Seite, wandert er als
          Ganzes auf Seite 2. Damit das nicht passiert, wurde der vertikale
          Leerraum auf ein Minimum reduziert (kein margins-Wrapper, kein
          ungenutzter Skalierungs-Header). */}
      <View style={styles.twoColumnRow}>
        <View style={styles.tableCol50}>
          <View style={styles.tableNoMargin}>
            <View style={styles.tableCol100}>
              <RecipeIngredients
                ingredients={recipe.ingredients}
                scaledIngredients={scaledIngredients}
                scaledPortions={scaledPortions}
              />
            </View>
            {hasMaterials ? (
              <View style={styles.tableCol100}>
                <RecipeMaterial
                  materials={recipe.materials}
                  scaledPortions={scaledPortions}
                  scaledMaterials={scaledMaterials}
                />
              </View>
            ) : (
              <View />
            )}
          </View>
        </View>

        <View style={styles.tableCol50}>
          <View style={styles.tableNoMargin}>
            <View style={styles.tableCol100}>
              <RecipePreparation recipe={recipe} />
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
      <Footer uid={recipe.uid} actualDate={actualDate} authUser={authUser} />
    </Page>
  );
};
/* ===================================================================
// ===================== Titel und oberste Infos =====================
// =================================================================== */
interface RecipeHeaderProps {
  recipe: Recipe;
  scaledPortions: number | null;
  menueCoordinate?: MenueCoordinates;
}
export const RecipeHeader = ({
  recipe,
  scaledPortions,
  menueCoordinate,
}: RecipeHeaderProps) => {
  return (
    <React.Fragment>
      {/*===== Rezept Name =====*/}
      <View>
        <Text style={styles.title}>{recipe.name}</Text>
      </View>
      {recipe.type == RecipeType.variant && (
        <View>
          <Text style={styles.subTitle}>
            {`${TEXT.VARIANT} ${recipe.variantProperties?.variantName}`}
          </Text>
        </View>
      )}
      <View style={styles.containerBottomBorder} />

      {/*===== Details =====*/}
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableColKey}>
            <Text style={styles.tableCell}>{TEXT.SOURCE}</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.tableCell}>
              {Utils.isUrl(recipe.source) ? (
                <Link src={recipe.source}>
                  {Utils.getDomain(recipe.source)}
                </Link>
              ) : (
                <Text style={styles.tableCell}>{recipe.source}</Text>
              )}
            </Text>
          </View>
          {/* Zubereitungszeit oder Einplanungszeitpunkt */}
          {!menueCoordinate ? (
            <React.Fragment>
              <View style={styles.tableColKey}>
                <Text style={styles.tableCell}>
                  {TEXT.FIELD_PREPARATION_TIME}
                </Text>
              </View>
              <View style={styles.tableColValue}>
                <Text
                  style={styles.tableCell}
                >{`${recipe.times.preparation} ${TEXT.UNIT_MIN}`}</Text>
              </View>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <View style={styles.tableColKey}>
                <Text style={styles.tableCell}>{TEXT.PLANED_FOR}</Text>
              </View>
              <View style={styles.tableColValue}>
                <Text style={styles.tableCell}>
                  {menueCoordinate.date.toLocaleString("default", {
                    weekday: "long",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </Text>
              </View>
            </React.Fragment>
          )}
        </View>
        <View style={styles.tableRow}>
          <View style={styles.tableColKey}>
            <Text style={styles.tableCell}>{TEXT.FIELD_PORTIONS}</Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.tableCell}>
              {scaledPortions ? scaledPortions : recipe.portions}
            </Text>
          </View>

          {/* Zubereitungszeit oder Einplanungszeitpunkt */}
          {!menueCoordinate ? (
            <React.Fragment>
              <View style={styles.tableColKey}>
                <Text style={styles.tableCell}>{TEXT.FIELD_COOK_TIME}</Text>
              </View>
              <View style={styles.tableColValue}>
                <Text
                  style={styles.tableCell}
                >{`${recipe.times.cooking} ${TEXT.UNIT_MIN}`}</Text>
              </View>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <View style={styles.tableColKey}>
                <Text style={styles.tableCell}>{TEXT.FOR_DATIVE}</Text>
              </View>
              <View style={styles.tableColValue}>
                <Text style={styles.tableCell}>
                  {menueCoordinate.mealType.name}
                </Text>
              </View>
            </React.Fragment>
          )}
        </View>

        <View style={styles.tableRow}>
          <View style={styles.tableColKey}>
            <Text style={styles.tableCell}>
              {scaledPortions ? TEXT.ORIGINAL : ""}
            </Text>
          </View>
          <View style={styles.tableColValue}>
            <Text style={styles.tableCell}>
              {scaledPortions ? recipe.portions : ""}
            </Text>
          </View>
          {/* Zubereitungszeit oder Einplanungszeitpunkt */}
          {!menueCoordinate ? (
            <React.Fragment>
              <View style={styles.tableColKey}>
                <Text style={styles.tableCell}>{TEXT.FIELD_REST_TIME}</Text>
              </View>
              <View style={styles.tableColValue}>
                <Text
                  style={styles.tableCell}
                >{`${recipe.times.rest} ${TEXT.UNIT_MIN}`}</Text>
              </View>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <View style={styles.tableColKey}></View>
              <View style={styles.tableColValue}></View>
            </React.Fragment>
          )}
        </View>
      </View>
    </React.Fragment>
  );
};
/* ===================================================================
// ============================== Zutaten ============================
// =================================================================== */
interface RecipeIngredientsProps {
  ingredients: Recipe["ingredients"];
  scaledPortions?: number | null;
  scaledIngredients: Recipe["ingredients"];
}
export const RecipeIngredients = ({
  ingredients,
  scaledPortions,
  scaledIngredients,
}: RecipeIngredientsProps) => {
  return (
    (<React.Fragment>
      {/*===== Überschriften =====*/}
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableCol100}>
            <Text style={styles.subTitle}>{TEXT.PANEL_INGREDIENTS}</Text>
          </View>
        </View>
        {scaledPortions ? (
          <View style={styles.tableRow}>
            <View style={styles.tableColQuantityHeaderSmall}>
              <Text style={{...styles.tableCell, ...styles.tableCellGrey}}>
                {TEXT.ORIGINAL}
              </Text>
            </View>
            <View style={styles.tableColQuantityHeaderSmall}>
              <Text style={styles.tableCell}>{TEXT.SCALED}</Text>
            </View>
            <View style={styles.tableColQuantitySmall} />
            <View style={styles.tableColItem} />
          </View>
        ) : (
          // Kein Leerzeilen-Platzhalter — spart ~17pt vertikalen Raum
          (<View>
            <View style={styles.tableCol100} />
          </View>)
        )}
        {/*===== Zutaten =====*/}
        {ingredients.order.map((ingredientUid, counter) => {
          let ingredient: Ingredient;
          let section: Section;

          if (
            ingredients.entries[ingredientUid].posType ==
            PositionType.ingredient
          ) {
            ingredient = ingredients.entries[ingredientUid] as Ingredient;
            section = {} as Section;
          } else {
            section = ingredients.entries[ingredientUid] as Section;
            ingredient = {} as Ingredient;
          }

          let quantity: number;
          let unit: string;

          scaledPortions
            ? (quantity = scaledIngredients[ingredientUid]?.quantity)
            : (quantity = ingredient.quantity);
          scaledPortions
            ? (unit = scaledIngredients[ingredientUid]?.unit)
            : (unit = ingredient.unit);

          return (
            (<React.Fragment key={"ingredient_row_" + ingredientUid}>
              {ingredients.entries[ingredientUid].posType ==
              PositionType.section ? (
                <RecipeSection
                  section={section}
                  key={
                    "ingredientBlock_" +
                    ingredient.uid +
                    "_section_" +
                    section.uid
                  }
                />
              ) : (
                <View
                  style={styles.tableRow}
                  key={"ingredientBlock_" + ingredient.uid + "_" + counter}
                >
                  {scaledPortions && scaledIngredients ? (
                    // Originalmenge
                    (<React.Fragment>
                      <View
                        style={styles.tableColQuantitySmall}
                        key={
                          "ingredientOrignalQuantity_" +
                          ingredient.uid +
                          "_" +
                          counter
                        }
                      >
                        <Text
                          style={{...styles.tableCell, ...styles.tableCellGrey}}
                        >
                          {Number.isNaN(ingredient.quantity) ||
                          ingredient.quantity == null ||
                          quantity == 0
                            ? ""
                            : ingredient?.quantity.toLocaleString("de-CH")}
                        </Text>
                      </View>
                      <View
                        style={
                          scaledPortions
                            ? styles.tableColUnitSmall
                            : styles.tableColUnit
                        }
                        key={"ingredientUnit_" + ingredient.uid + "_" + counter}
                      >
                        <Text
                          style={{...styles.tableCell, ...styles.tableCellGrey}}
                        >
                          {ingredient.unit == null || unit == ""
                            ? ""
                            : ingredient?.unit}
                        </Text>
                      </View>
                    </React.Fragment>)
                  ) : (
                    <View
                      key={
                        "ingredientOrignalQuantity_" +
                        ingredient.uid +
                        "_" +
                        counter
                      }
                    />
                  )}
                  <View
                    style={
                      scaledPortions
                        ? styles.tableColQuantitySmall
                        : styles.tableColQuantitySmall
                    }
                    key={"ingredientQuantity_" + ingredient.uid + "_" + counter}
                  >
                    <Text style={styles.tableCell}>
                      {Number.isNaN(quantity) ||
                      quantity == null ||
                      quantity == 0
                        ? ""
                        : quantity.toLocaleString("de-CH")}
                    </Text>
                  </View>
                  <View
                    style={
                      scaledPortions
                        ? styles.tableColUnitSmall
                        : styles.tableColUnit
                    }
                    key={"ingredientUnit_" + ingredient.uid + "_" + counter}
                  >
                    <Text style={styles.tableCell}>{unit}</Text>
                  </View>
                  <View
                    style={
                      scaledPortions
                        ? styles.tableColItemSmall
                        : styles.tableColItem
                    }
                    key={"ingredientProduct_" + ingredient.uid + "_" + counter}
                  >
                    <Text style={styles.tableCell}>
                      {ingredient.product.name}
                      {/* Details abdrucken, falls vorhanden */}
                      {ingredient.detail && (
                        <Text style={styles.tableCellThin}>
                          , {ingredient.detail}
                        </Text>
                      )}
                    </Text>
                  </View>
                </View>
              )}
            </React.Fragment>)
          );
        })}
      </View>
    </React.Fragment>)
  );
};
/* ===================================================================
// ============================ Zubereitung ==========================
// =================================================================== */
interface RecipePreparationProps {
  recipe: Recipe;
}
export const RecipePreparation = ({recipe}: RecipePreparationProps) => {
  return (
    <View style={styles.table}>
      <View style={styles.tableCol100}>
        <Text style={styles.subTitle}>{TEXT.PANEL_PREPARATION}</Text>
      </View>
      {recipe.preparationSteps.order.map((stepUid, counter) => {
        let step: PreparationStep;
        let section: Section;

        if (
          recipe.preparationSteps.entries[stepUid].posType ==
          PositionType.preparationStep
        ) {
          step = recipe.preparationSteps.entries[stepUid] as PreparationStep;
          section = {} as Section;
        } else {
          section = recipe.preparationSteps.entries[stepUid] as Section;
          step = {} as PreparationStep;
        }

        return (
          <React.Fragment key={"step_row_" + counter}>
            {step.step !== "" ? (
              recipe.preparationSteps.entries[stepUid].posType ==
              PositionType.section ? (
                <RecipeSection
                  section={section}
                  key={
                    "ingredientBlock_" + step.uid + "_section_" + section.uid
                  }
                />
              ) : (
                <View
                  style={styles.tableRow}
                  key={"preparationStep_" + recipe.uid + "_" + step.uid}
                >
                  <View
                    style={styles.tableColStepPos}
                    key={"preparationStepPos_" + recipe.uid + "_" + step.uid}
                  >
                    <Text style={styles.tableCell}>{counter + 1}</Text>
                  </View>
                  <View
                    style={styles.tableColStep}
                    key={"preparationStepText_" + recipe.uid + "_" + step.uid}
                  >
                    <Text style={styles.tableCell}>{step.step}</Text>
                  </View>
                </View>
              )
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

interface RecipeSectionProps {
  section: Section;
}
/* ===================================================================
// =0=========================== Abschnitt ===========================
// =================================================================== */
const RecipeSection = ({section}: RecipeSectionProps) => {
  return (
    <View style={styles.tableRow}>
      <View style={styles.tableCol100} key={"section_" + section.uid}>
        <Text style={styles.section}>{`${section.name}:`}</Text>
      </View>
    </View>
  );
};
/* ===================================================================
// ============================== Material ===========================
// =================================================================== */
interface RecipeMaterialProps {
  materials: Recipe["materials"];
  scaledPortions?: number | null;
  scaledMaterials: Recipe["materials"];
}
export const RecipeMaterial = ({
  materials,
  scaledPortions,
  scaledMaterials,
}: RecipeMaterialProps) => {
  return (
    (<React.Fragment>
      {/*===== Überschriften =====*/}
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={styles.tableCol100}>
            <Text style={styles.subTitle}>{TEXT.MATERIAL}</Text>
          </View>
        </View>
        {scaledPortions ? (
          <View style={styles.tableRow}>
            <View style={styles.tableColQuantitySmall}>
              <Text style={{...styles.tableCell, ...styles.tableCellGrey}}>
                {TEXT.ORIGINAL}
              </Text>
            </View>
            <View style={styles.tableColQuantitySmall}>
              <Text style={styles.tableCell}>{TEXT.SCALED}</Text>
            </View>
            <View style={styles.tableColQuantitySmall} />
            <View style={styles.tableColItem} />
          </View>
        ) : (
          //leer
          (<View style={styles.tableRow}>
            <View style={styles.tableCol100} />
          </View>)
        )}
        {/*===== Material =====*/}
        {materials.order.map((materialUid, counter) => {
          const material = materials.entries[materialUid];
          let quantity: number;

          scaledPortions
            ? (quantity = scaledMaterials[materialUid]?.quantity)
            : (quantity = material.quantity);

          return (
            (<View
              style={styles.tableRow}
              key={"materialBlock_" + material.uid + "_" + counter}
            >
              {scaledPortions && scaledMaterials ? (
                // Originalmenge
                (<View
                  style={styles.tableColQuantitySmall}
                  key={
                    "materialOrignalQuantity_" + material.uid + "_" + counter
                  }
                >
                  <Text style={{...styles.tableCell, ...styles.tableCellGrey}}>
                    {Number.isNaN(material.quantity) || quantity == 0
                      ? ""
                      : material.quantity.toLocaleString("de-CH")}
                  </Text>
                </View>)
              ) : (
                <View />
              )}
              <View
                style={
                  scaledPortions
                    ? styles.tableColQuantitySmall
                    : styles.tableColQuantitySmall
                }
                key={"materialQuantity_" + material.uid + "_" + counter}
              >
                <Text style={styles.tableCell}>
                  {Number.isNaN(quantity) || quantity == 0
                    ? ""
                    : quantity.toLocaleString("de-CH")}
                </Text>
              </View>
              <View
                style={
                  scaledPortions
                    ? styles.tableColUnitSmall
                    : styles.tableColUnit
                }
                key={"materialUnit_" + material.uid + "_" + counter}
              ></View>
              <View
                style={
                  scaledPortions
                    ? styles.tableColItemSmall
                    : styles.tableColItem
                }
                key={"materialProduct_" + material.uid + "_" + counter}
              >
                <Text style={styles.tableCell}>{material.material.name}</Text>
              </View>
            </View>)
          );
        })}
      </View>
    </React.Fragment>)
  );
};

/* ===================================================================
// ========================== Hinweis Rezept =========================
// =================================================================== */
interface RecipeNoteProps {
  recipe: Recipe;
}
export const RecipeNote = ({recipe}: RecipeNoteProps) => {
  return (
    <React.Fragment>
      <View style={styles.table}>
        <View style={styles.tableCol100}>
          <Text style={styles.subTitle}>{TEXT.PANEL_NOTES}</Text>
        </View>
        <View style={styles.tableRow} key={"recipeNote_" + recipe.uid}>
          <View
            style={styles.tableColNote}
            key={"recipeNoteText_" + recipe.uid}
          >
            <Text style={styles.tableCell}>{recipe.note}</Text>
          </View>
        </View>
      </View>
    </React.Fragment>
  );
};
/* ===================================================================
// ========================= Varianten Notiz  ========================
// =================================================================== */
interface RecipeVariantNoteProps {
  recipe: Recipe;
}
export const RecipeVariantNote = ({recipe}: RecipeVariantNoteProps) => {
  return (
    <React.Fragment>
      <View style={styles.table}>
        <View style={styles.tableCol100}>
          <Text style={styles.subTitle}>{TEXT.PANEL_NOTES}</Text>
        </View>
        <View style={styles.tableRow} key={"recipeVariantNote_" + recipe.uid}>
          <View
            style={styles.tableColNote}
            key={"recipeNoteVariantText_" + recipe.uid}
          >
            <Text style={styles.tableCell}>
              {recipe?.variantProperties?.note}
            </Text>
          </View>
        </View>
      </View>
    </React.Fragment>
  );
};

export default RecipePdf;
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
