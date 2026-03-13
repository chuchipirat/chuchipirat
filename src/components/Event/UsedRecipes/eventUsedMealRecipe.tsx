/**
 * Einzelne Rezeptkarte in der UsedRecipes-Übersicht.
 *
 * Zeigt Titel, Info-Block (Quelle, Portionen, Notizen), skalierte Zutaten,
 * Zubereitungsschritte und optional Material für ein geplantes Rezept.
 * Stammdaten (products, units, unitConversions) werden aus dem
 * EventMasterDataContext bezogen.
 *
 * @param props - Rezeptdaten, MealRecipe-Koordinaten und Gruppenkonfiguration
 */
import React from "react";

import {
  Typography,
  Divider,
  List,
  Container,
  useTheme,
  Link,
  Box,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  PLANED_FOR as TEXT_PLANED_FOR,
  FOR_DATIVE as TEXT_FOR_DATIVE,
  SOURCE as TEXT_SOURCE,
  NOTE as TEXT_NOTE,
  VARIANT_NOTE as TEXT_VARIANT_NOTE,
} from "../../../constants/text";
import {ImageRepository} from "../../../constants/imageRepository";
import useCustomStyles from "../../../constants/styles";

import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {MealRecipe, MenueCoordinates} from "../Menuplan/menuplan.types";
import {generatePlanedPortionsText} from "../Menuplan/menuplan";
import Recipe, {RecipeType} from "../../Recipe/recipe.class";
import Utils from "../../Shared/utils.class";
import {FormListItem} from "../../Shared/formListItem";
import {
  RecipeIngredients,
  RecipeMaterial,
  RecipePreparation,
} from "../../Recipe/recipe.view";
import {useEventMasterData} from "../Event/eventMasterDataContext";

/* ===================================================================
// ======================== Einzelnes Rezept =========================
// =================================================================== */

interface EventUsedMealRecipeProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
  menueCoordinate: MenueCoordinates;
  groupConfiguration: EventGroupConfiguration;
}

/**
 * Rezeptkarte mit Titel, Info, Zutaten, Zubereitung und Material.
 *
 * @param props - Rezept- und Menüplan-Daten
 */
const EventUsedMealRecipe = React.memo(function EventUsedMealRecipe({
  recipe,
  mealRecipe,
  menueCoordinate,
  groupConfiguration,
}: EventUsedMealRecipeProps) {
  const classes = useCustomStyles();
  return (
    <Container
      sx={classes.container}
      component="main"
      maxWidth="md"
      key={"recipeContainer_" + mealRecipe.uid}
    >
      <Grid
        container
        justifyContent="center"
        spacing={2}
        key={"recipeGridUsedRecipe_" + mealRecipe.uid}
      >
        {/* Titel */}
        <EventUsedMealRecipeTitle
          recipe={recipe}
          menueCoordinate={menueCoordinate}
        />
        {/* Info-Block */}
        <EventUsedMealRecipeInfoBlock
          recipe={recipe}
          menueCoordinate={menueCoordinate}
          mealRecipe={mealRecipe}
          groupConfiguration={groupConfiguration}
        />
        {/* Zutaten */}
        <Grid
          size={{xs: 12, sm: 6}}
          style={{marginTop: "2em", marginBottom: "2em"}}
          key={"recipeGridIngredients_" + mealRecipe.uid}
        >
          <EventUsedMealRecipeIngredientBlock
            recipe={recipe}
            mealRecipe={mealRecipe}
          />
        </Grid>
        {/* Zubereitung */}
        <Grid
          size={{xs: 12, sm: 6}}
          style={{marginTop: "2em", marginBottom: "2em"}}
          key={"recipeGridPreparations_" + mealRecipe.uid}
        >
          <RecipePreparation recipe={recipe} />
        </Grid>
        {/* Material */}
        {recipe?.materials?.order.length > 0 && (
          <Grid
            size={12}
            style={{marginTop: "2em", marginBottom: "2em"}}
            key={"recipeGridMaterials_" + mealRecipe.uid}
          >
            <EventUsedMealRecipeMaterialBlock
              recipe={recipe}
              mealRecipe={mealRecipe}
            />
          </Grid>
        )}
        {/* Divider */}
        <Grid size={12} key={"recipeGridDividerLeft_" + mealRecipe.uid}>
          <Divider key={"recipeDividerLeft_" + mealRecipe.uid}>
            <Box
              component="img"
              sx={classes.marginCenter}
              src={
                ImageRepository.getEnvironmentRelatedPicture().VECTOR_LOGO_GREY
              }
              alt=""
              width="50px"
            />
          </Divider>
        </Grid>
      </Grid>
    </Container>
  );
});

/* ===================================================================
// =========================  Rezept Title ===========================
// =================================================================== */

interface EventUsedMealRecipeTitleProps {
  recipe: Recipe;
  menueCoordinate: MenueCoordinates;
}

/**
 * Titelbereich eines Rezepts: Name, Varianten-Label und Menüplan-Zuordnung.
 *
 * @param props - Rezept und zugehörige Menü-Koordinate
 */
const EventUsedMealRecipeTitle = React.memo(function EventUsedMealRecipeTitle({
  recipe,
  menueCoordinate,
}: EventUsedMealRecipeTitleProps) {
  const theme = useTheme();
  return (
    <Grid size={12} key={"recipeName_" + recipe.uid}>
      <Typography
        component="h1"
        variant="h4"
        align="center"
        gutterBottom={recipe.type != RecipeType.variant}
      >
        {recipe.name}
      </Typography>
      {recipe.type == RecipeType.variant && (
        <Typography
          component="h2"
          variant="h5"
          align="center"
          gutterBottom
          color="textSecondary"
        >
          {"["}
          {recipe.variantProperties?.variantName}
          {"]"}
        </Typography>
      )}
      <Typography align="center">
        <Box component="span" color={theme.palette.text.secondary}>
          {TEXT_PLANED_FOR}
          {": "}
        </Box>
        {menueCoordinate.date.toLocaleString("default", {
          weekday: "long",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })}
        <Box component="span" color={theme.palette.text.secondary}>
          {", "}
          {TEXT_FOR_DATIVE}
          {": "}
        </Box>
        {menueCoordinate.mealType.name}
      </Typography>
    </Grid>
  );
});

/* ===================================================================
// =========================  Rezept Info ============================
// =================================================================== */

interface EventUsedMealRecipeInfoBlockProps {
  recipe: Recipe;
  menueCoordinate: MenueCoordinates;
  mealRecipe: MealRecipe;
  groupConfiguration: EventGroupConfiguration;
}

/**
 * Info-Block mit Quelle, geplanten Portionen und Notizen.
 *
 * @param props - Rezept, MealRecipe-Daten und Gruppenkonfiguration
 */
const EventUsedMealRecipeInfoBlock = React.memo(
  function EventUsedMealRecipeInfoBlock({
    recipe,
    mealRecipe,
    groupConfiguration,
  }: EventUsedMealRecipeInfoBlockProps) {
    return (
      <Grid size={12} key={"recipeInfoBlockTime" + mealRecipe.uid}>
        <Container maxWidth="sm">
          <List dense>
            <FormListItem
              id={"source"}
              value={
                Utils.isUrl(recipe.source) ? (
                  <Link
                    href={recipe.source as string}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {Utils.getDomain(recipe.source)}
                  </Link>
                ) : (
                  recipe.source
                )
              }
              label={TEXT_SOURCE}
            />
            <FormListItem
              id={"portions"}
              value={generatePlanedPortionsText({
                uid: mealRecipe.uid,
                portionPlan: mealRecipe.plan,
                groupConfiguration: groupConfiguration,
              })}
              label={TEXT_PLANED_FOR}
            />
            {recipe.note && (
              <FormListItem
                id={"note"}
                value={recipe.note}
                label={TEXT_NOTE}
              />
            )}
            {recipe.type == RecipeType.variant &&
              recipe.variantProperties?.note && (
                <FormListItem
                  id={"variantNote"}
                  value={recipe.variantProperties?.note}
                  label={TEXT_VARIANT_NOTE}
                />
              )}
          </List>
        </Container>
      </Grid>
    );
  },
);

/* ===================================================================
// =======================  Rezept Zutaten ===========================
// =================================================================== */

interface EventUsedMealRecipeIngredientBlockProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
}

/**
 * Zutaten-Block mit automatischer Portionsskalierung und Einheitenumrechnung.
 * Stammdaten werden aus dem EventMasterDataContext bezogen.
 *
 * @param props - Rezept und MealRecipe
 */
const EventUsedMealRecipeIngredientBlock = React.memo(
  function EventUsedMealRecipeIngredientBlock({
    recipe,
    mealRecipe,
  }: EventUsedMealRecipeIngredientBlockProps) {
    const {products, units, unitConversionBasic, unitConversionProducts} =
      useEventMasterData();

    const scaledIngredients = React.useMemo(
      () =>
        Recipe.scaleIngredients({
          recipe: recipe,
          portionsToScale: mealRecipe.totalPortions,
          scalingOptions: {convertUnits: true},
          products: products,
          units: units,
          unitConversionBasic: unitConversionBasic,
          unitConversionProducts: unitConversionProducts,
        }),
      [
        recipe,
        mealRecipe.totalPortions,
        products,
        units,
        unitConversionBasic,
        unitConversionProducts,
      ],
    );

    return (
      <RecipeIngredients
        recipe={recipe}
        scaledIngredients={scaledIngredients}
        scaledPortions={mealRecipe.totalPortions}
      />
    );
  },
);

/* ===================================================================
// =======================  Rezept Material ==========================
// =================================================================== */

interface EventUsedMealRecipeMaterialBlockProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
}

/**
 * Material-Block mit automatischer Portionsskalierung.
 *
 * @param props - Rezept und MealRecipe für die Materialskalierung
 */
const EventUsedMealRecipeMaterialBlock = React.memo(
  function EventUsedMealRecipeMaterialBlock({
    recipe,
    mealRecipe,
  }: EventUsedMealRecipeMaterialBlockProps) {
    const scaledMaterials = React.useMemo(
      () =>
        Recipe.scaleMaterials({
          recipe: recipe,
          portionsToScale: mealRecipe.totalPortions,
        }),
      [recipe, mealRecipe.totalPortions],
    );

    return (
      <RecipeMaterial
        recipe={recipe}
        scaledMaterials={scaledMaterials}
        scaledPortions={mealRecipe.totalPortions}
      />
    );
  },
);

export {EventUsedMealRecipe};
