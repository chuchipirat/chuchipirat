import React from "react";
import {useCustomStyles} from "../../constants/styles";

import {
  Typography,
  Card,
  CardMedia,
  CardHeader,
  CardContent,
  CardActions,
  Tooltip,
  Grid,
  CardActionArea,
  Fab,
  Rating,
  Skeleton,
  Box,
} from "@mui/material";
import {
  Info as InfoIcon,
  Add as AddIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
} from "@mui/icons-material";

import {RecipeShort} from "./recipe.types";
import {ImageRepository} from "../../constants/imageRepository";
import {OnRecipeCardClickProps} from "./recipes";
import {
  DIET_TYPES as TEXT_DIET_TYPES,
  ALLERGENS_FREE_TYPES as TEXT_ALLERGENS_FREE_TYPES,
  VOTE as TEXT_VOTE,
  VOTES as TEXT_VOTES,
  VARIANT as TEXT_VARIANT,
} from "../../constants/text";

import {Utils} from "../Shared/utils.class";
import {Allergen, Diet, DietProperties} from "../Product/product.types";
import {RecipeType} from "./recipe.class";
// ===================================================================== */
/**
 * Aktionen in der Recipe Card
 * @param key - ID/KEY des Button
 * @param name - Anzeigetext des Button
 * @param onClick - Funktion die ausgeführt wird.
 */
export interface RecipeCardActions {
  key: string;
  name: string;
  onClick: ({event, recipe}: OnRecipeCardClickProps) => void;
}

// ===================================================================== */
/**
 * Parameter für Rezeptkarte
 * @param recipe - Kurzinformationen zu Rezept
 * @param cardActions -  Allfällige Aktionen auf der Karte
 * @param ribbon: Informationen zum Ribbon
 * @param fabButton: FAB-Button, als JSX
 */
interface RecipeCardProps {
  recipe: RecipeShort;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  ribbon?: CardRibbonProps;
  fabButtonIcon?: JSX.Element;
  onFabButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
// ===================================================================== */
/**
 * Rezept-Karte zur Anzeige eines Kurz-Rezepts mit Bild, Titel, Bewertungen
 * und optionalem Ribbon sowie FAB-Button. Wird im Rezeptübersichtsraster verwendet.
 *
 * @param props - Eigenschaften gemäss RecipeCardProps.
 * @returns JSX-Element der Rezeptkarte.
 */
export const RecipeCard = ({
  recipe,
  onCardClick,
  ribbon,
  fabButtonIcon,
  onFabButtonClick: onFabButtonClickSuper,
}: RecipeCardProps) => {
  const classes = useCustomStyles();

  const [hover, setHover] = React.useState(false);

  const createInfoLine = (dietProperties: DietProperties) => {
    let infoLine = "";

    if (dietProperties.diet != Diet.Meat) {
      infoLine = addTextEntry(infoLine, TEXT_DIET_TYPES[dietProperties.diet]);
    }

    if (dietProperties.allergens.length > 0) {
      Object.keys(Allergen).map((allergen) => {
        if (
          parseInt(allergen) > 0 &&
          !isNaN(parseInt(allergen)) &&
          !dietProperties.allergens.includes(parseInt(allergen))
        ) {
          infoLine = addTextEntry(
            infoLine,
            TEXT_ALLERGENS_FREE_TYPES[parseInt(allergen)],
          );
        }
      });
    }

    return infoLine;
  };
  const addTextEntry = (existingText: string, textToAdd: string) => {
    return existingText ? existingText + ", " + textToAdd : textToAdd;
  };
  /* ------------------------------------------
  // Hover
  // ------------------------------------------ */
  const handleHover = () => {
    setHover(true);
  };

  const handleMouseOut = () => {
    setHover(false);
  };
  /* ------------------------------------------
  // Fab-Button Handling
  // ------------------------------------------ */
  const onFabButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!onFabButtonClickSuper) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    onFabButtonClickSuper(event);
  };
  const infoLine = createInfoLine(recipe.dietProperties);

  return (
    <Card
      sx={classes.card}
      onMouseOver={handleHover}
      onMouseOut={handleMouseOut}
    >
      <CardActionArea
        id={"recipeCardActionArea_" + recipe.uid}
        onClick={onCardClick}
        sx={{height: "100%"}}
      >
        <Box component="div" sx={classes.card}>
          <div style={{overflow: "hidden"}}>
            {ribbon && (
              <CardRibbon
                cssProperty={ribbon.cssProperty}
                icon={ribbon.icon}
                tooltip={ribbon.tooltip}
              />
            )}
            <CardMedia
              sx={{
                ...classes.cardMedia,
                transform: hover ? "scale(1.05)" : "scale(1)",
                transition: "0.5s ease",
              }}
              image={
                recipe.pictureSrc
                  ? recipe.pictureSrc
                  : ImageRepository.getEnvironmentRelatedPicture()
                      .CARD_PLACEHOLDER_MEDIA
              }
              title={recipe.name}
            />
          </div>
          <CardHeader
            title={
              <span>
                {recipe.name}
                <span>
                  <Typography variant="subtitle1" color="textSecondary">
                    {recipe.type === RecipeType.variant
                      ? ` [${TEXT_VARIANT}: ${recipe.variantName}]`
                      : ``}
                  </Typography>
                </span>
              </span>
            }
            subheader={
              <Typography variant="body2" color="textSecondary">
                {Utils.isUrl(recipe.source)
                  ? Utils.getDomain(recipe.source)
                  : recipe.source}
              </Typography>
            }
          />
          <CardContent sx={classes.cardContent}>
            {infoLine ? (
              <Grid container spacing={1}>
                <Grid size={2}>
                  <InfoIcon fontSize="small" color="action" />
                </Grid>
                <Grid size={10}>
                  <Typography>{infoLine}</Typography>
                </Grid>
              </Grid>
            ) : (
              <div />
            )}
          </CardContent>

          {/* <CardActions> */}
          <CardActions
            sx={{
              ...classes.cardActions,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
              <Box sx={{display: "flex", alignItems: "center"}}>
                <Rating value={recipe.rating.avgRating} size="small" readOnly />
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{marginLeft: "0.5rem"}}
                >
                  {`${recipe.rating.noRatings} ${
                    recipe.rating.noRatings === 1 ? TEXT_VOTE : TEXT_VOTES
                  }`}
                </Typography>
              </Box>
              {(recipe.noComments ?? 0) > 0 && (
                <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                  <ChatBubbleOutlineIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="textSecondary">
                    {recipe.noComments}
                  </Typography>
                </Box>
              )}
            </Box>
            {onFabButtonClickSuper ? (
              <Fab
                id={"recipeCardFab_" + recipe.uid}
                size="small"
                color="primary"
                aria-label="add"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={onFabButtonClick}
              >
                {fabButtonIcon ? fabButtonIcon : <AddIcon />}
              </Fab>
            ) : null}
          </CardActions>
        </Box>
      </CardActionArea>
    </Card>
  );
};
/* ===================================================================
// =====================Rezept Karte am laden ========================
// =================================================================== */
const RecipeCardLoading = () => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card}>
      {/* Card Media */}
      <Skeleton animation="wave" variant="rectangular" sx={classes.cardMedia} />
      <CardContent sx={classes.cardContent}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          <Skeleton />
        </Typography>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ===================== Ribbon auf der Karte ========================
// =================================================================== */
/**
 * Eigenschaften für Card-Ribbon
 * @param cssProperty - CSS Eigenschaften
 * @param icon - MUI-Icon, dass auf dem Ribon angezeigt wird
 * @param tooltip - Text, der als Tooltip angezeigt wird.
 */
export interface CardRibbonProps {
  cssProperty: string;
  icon: JSX.Element;
  tooltip?: string;
}
/**
 * Ribon auf der Karte
 * @param Object - Siehe CardRibbonProps
 * @returns JSX.Element
 */
export const CardRibbon = ({cssProperty, icon, tooltip}: CardRibbonProps) => {
  return (
    <div className={cssProperty}>
      {tooltip ? (
        <Tooltip title={tooltip} arrow>
          {icon}
        </Tooltip>
      ) : (
        icon
      )}
    </div>
  );
};

export {RecipeCardLoading};
