import React from "react";
import {Grid, Typography} from "@mui/material";

import Recipe from "./recipe.class";
import {Allergen, Diet} from "../Product/product.types";
import {
  GlutenFreeIcon,
  GlutenIcon,
  LactoseFreeIcon,
  LactoseIcon,
  MeatIcon,
  VeganIcon,
  VegetarianIcon,
} from "../Shared/icons";
import {
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_MEAT as TEXT_HAS_MEAT,
  IS_GLUTENFREE as TEXT_IS_GLUTENFREE,
  IS_LACTOSEFREE as TEXT_IS_LACTOSEFREE,
  IS_VEGAN as TEXT_IS_VEGAN,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
} from "../../constants/text";

/**
 * Props für {@link DietPropertyItem}.
 *
 * @param icon - Symbol der Eigenschaft, z.B. `<LactoseFreeIcon />`.
 * @param label - Text unter dem Symbol, z.B. «Laktosefrei».
 */
type DietPropertyItemProps = {
  icon: React.ReactNode;
  label: string;
};

/**
 * Eine Spalte der Diät-Eigenschaften: Symbol mit Text darunter.
 *
 * Auf dem Handy ist eine Spalte nur gut 50 px breit. Darum ist der Text klein
 * und darf umbrechen (mit Silbentrennung, die Seite hat `lang="de"`), statt
 * in die Nachbarspalte zu laufen.
 *
 * @param props - Siehe {@link DietPropertyItemProps}.
 * @returns Grid-Spalte mit Symbol und Text.
 */
const DietPropertyItem = ({icon, label}: DietPropertyItemProps) => (
  <Grid size={4} sx={{textAlign: "center"}}>
    {icon}
    <Typography
      variant="caption"
      component="p"
      sx={{overflowWrap: "anywhere", hyphens: "auto"}}
    >
      {label}
    </Typography>
  </Grid>
);

/**
 * Props für {@link DietProperties}.
 *
 * @param recipe - Rezept, dessen Allergene und Ernährungsform gezeigt werden.
 */
type DietPropertiesProps = {
  recipe: Recipe;
};

/**
 * Zeigt drei Diät-Eigenschaften eines Rezepts nebeneinander: Laktose, Gluten
 * und Ernährungsform (vegetarisch, vegan oder mit Fleisch).
 *
 * @param props - Siehe {@link DietPropertiesProps}.
 * @returns Drei Spalten mit Symbol und Text.
 * @example
 * <DietProperties recipe={recipe} />
 */
export const DietProperties = ({recipe}: DietPropertiesProps) => {
  const {allergens, diet} = recipe.dietProperties;
  const hasLactose = allergens.includes(Allergen.Lactose);
  const hasGluten = allergens.includes(Allergen.Gluten);

  return (
    <Grid container spacing={2}>
      <DietPropertyItem
        icon={
          hasLactose ? (
            <LactoseIcon fontSize="large" />
          ) : (
            <LactoseFreeIcon fontSize="large" />
          )
        }
        label={hasLactose ? TEXT_HAS_LACTOSE : TEXT_IS_LACTOSEFREE}
      />
      <DietPropertyItem
        icon={
          hasGluten ? (
            <GlutenIcon fontSize="large" />
          ) : (
            <GlutenFreeIcon fontSize="large" />
          )
        }
        label={hasGluten ? TEXT_HAS_GLUTEN : TEXT_IS_GLUTENFREE}
      />
      <DietPropertyItem {...getDietItem(diet)} />
    </Grid>
  );
};

/**
 * Wählt Symbol und Text für die Ernährungsform. Alles ausser vegetarisch und
 * vegan gilt als «mit Fleisch», wie bisher in der Rezeptansicht.
 *
 * @param diet - Ernährungsform des Rezepts.
 * @returns Props für {@link DietPropertyItem}.
 */
const getDietItem = (diet: Diet): DietPropertyItemProps => {
  if (diet === Diet.Vegetarian) {
    return {
      icon: <VegetarianIcon fontSize="large" />,
      label: TEXT_IS_VEGETARIAN,
    };
  }
  if (diet === Diet.Vegan) {
    return {icon: <VeganIcon fontSize="large" />, label: TEXT_IS_VEGAN};
  }
  return {icon: <MeatIcon fontSize="large" />, label: TEXT_HAS_MEAT};
};
