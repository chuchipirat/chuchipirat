import React from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";
import Recipe, {
  RecipeType,
  Ingredient,
  RecipeMaterialPosition,
  PositionType,
  Section,
  PreparationStep,
  RecipeObjectStructure,
  ScalingOptions,
} from "./recipe.class";
import {useNavigate} from "react-router";

import {
  Button,
  IconButton,
  CardHeader,
  Collapse,
  Container,
  Divider,
  GridSize,
  ListItemButton,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogContent,
  TextField,
  DialogActions,
  Tooltip,
  Backdrop,
  CircularProgress,
  Box,
  useTheme,
  Link,
  Typography,
  Menu,
  Card,
  CardContent,
  List,
  ListItemText,
  Rating,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {FormListItem} from "../Shared/formListItem";
import ButtonRow, {CustomButton} from "../Shared/buttonRow";

import AddIcon from "@mui/icons-material/Add";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";

import {
  VARIANT_NOTE as TEXT_VARIANT_NOTE,
  MATERIAL as TEXT_MATERIAL,
  PREPARATION as TEXT_PREPARATION,
  SCALED as TEXT_SCALED,
  ORIGINAL as TEXT_ORIGINAL,
  INGREDIENTS as TEXT_INGREDIENTS,
  FOR_ACCUSATIVE as TEXT_FOR_ACCUSATIVE,
  TAG as TEXT_TAG,
  ADD as TEXT_ADD,
  PORTION as TEXT_PORTION,
  PORTIONS as TEXT_PORTIONS,
  ALL as TEXT_ALL,
  THIS_RECIPE_IS_PLANNED_FOR as TEXT_THIS_RECIPE_IS_PLANNED_FOR,
  HAS_MEAT as TEXT_HAS_MEAT,
  IS_VEGAN as TEXT_IS_VEGAN,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  IS_GLUTENFREE as TEXT_IS_GLUTENFREE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  IS_LACTOSEFREE as TEXT_IS_LACTOSEFREE,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  FIELD_TAGS as TEXT_FIELD_TAGS,
  FIELD_HINT as TEXT_FIELD_HINT,
  MENU_TYPE as TEXT_MENU_TYPE,
  MENU_TYPES as TEXT_MENU_TYPES,
  TIPS_AND_TAGS as TEXT_TIPS_AND_TAGS,
  DIET_PROPERTIES as TEXT_DIET_PROPERTIES,
  FIELD_COOK_TIME as TEXT_FIELD_COOK_TIME,
  FIELD_REST_TIME as TEXT_FIELD_REST_TIME,
  UNIT_MIN as TEXT_UNIT_MIN,
  FIELD_PREPARATION_TIME as TEXT_FIELD_PREPARATION_TIME,
  CREATED_FROM as TEXT_CREATED_FROM,
  SOURCE as TEXT_SOURCE,
  DELETE_RECIPE as TEXT_DELETE_RECIPE,
  SHOW_OPEN_REQUESTS as TEXT_SHOW_OPEN_REQUESTS,
  REPORT_ERROR as TEXT_REPORT_ERROR,
  PUBLISH_RECIPE as TEXT_PUBLISH_RECIPE,
  BUTTON_PRINTVERSION as TEXT_BUTTON_PRINTVERSION,
  BUTTON_OWN_VARIANT as TEXT_BUTTON_OWN_VARIANT,
  BUTTON_SCALE as TEXT_BUTTON_SCALE,
  EDIT as TEXT_EDIT,
  BUTTON_ADD_TO_EVENT as TEXT_BUTTON_ADD_TO_EVENT,
  IMAGE_SOURCE as TEXT_IMAGE_SOURCE,
  IMAGE_MAY_BE_SUBJECT_OF_COPYRIGHT as TEXT_IMAGE_MAY_BE_SUBJECT_OF_COPYRIGHT,
  VOTE as TEXT_VOTE,
  VOTES as TEXT_VOTES,
  FIELD_YOUR_RATING as TEXT_FIELD_YOUR_RATING,
  VARIANT as TEXT_VARIANT,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  REPORT_ERROR_RECIPE_REQUEST_CREATED as TEXT_REPORT_ERROR_RECIPE_REQUEST_CREATED,
  PUBLISH_RECIPE_REQUEST_CREATED as TEXT_PUBLISH_RECIPE_REQUEST_CREATED,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  THANK_YOU_FOR_YOUR_RATING as TEXT_THANK_YOU_FOR_YOUR_RATING,
  DIALOG_TITLE_DELETION_CONFIRMATION as TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
  DIALOG_SUBTITLE_DELETION_CONFIRMATION as TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
  DIALOG_TEXT_DELETION_CONFIRMATION as TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
} from "../../constants/text";
import * as ROUTES from "../../constants/routes";
import {ImageRepository} from "../../constants/imageRepository";
import RecipePdf from "./recipePdf";

import Role from "../../constants/roles";
import Action from "../../constants/actions";

import useCustomStyles from "../../constants/styles";

import Utils from "../Shared/utils.class";
import AlertMessage from "../Shared/AlertMessage";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {OnUpdateRecipeProps, RecipeDivider} from "./recipe";
import {
  GlutenFreeIcon,
  GlutenIcon,
  LactoseFreeIcon,
  LactoseIcon,
  MeatIcon,
  VeganIcon,
  VegetarianIcon,
} from "../Shared/icons";
import Firebase from "../Firebase/firebase.class";
import DialogScaleRecipe, {OnScale} from "./dialogScaleRecipe";
import DialogPublishRecipe from "./dialogPublishRecipe";

import Product, {Allergen, Diet} from "../Product/product.class";
import RecipeShort from "./recipeShort.class";
import {
  PlanedMealsRecipe,
  PlanedDiet,
  PlanedIntolerances,
  MealRecipe,
} from "../Event/Menuplan/menuplan.class";
import EventGroupConfiguration from "../Event/GroupConfiguration/groupConfiguration.class";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/navigationContext";
import UnitConversion, {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../Unit/unitConversion.class";
import DialogReportError from "./dialogReportError";
import Unit from "../Unit/unit.class";
/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  FETCH_MISSING_MASTERDATA,
  SET_IS_LOADING,
  GENERIC_ERROR,
}

type DispatchAction =
  | {
      type: ReducerActions.FETCH_MISSING_MASTERDATA;
      payload: {
        units: Unit[];
        unitConversionBasic: UnitConversionBasic;
        unitConversionProducts: UnitConversionProducts;
        products: Product[];
      };
    }
  | {type: ReducerActions.SET_IS_LOADING; payload: {isLoading: boolean}}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  products: Product[];
  isLoading: boolean;
  error: Error | null;
};
const inititialState: State = {
  units: null,
  unitConversionBasic: null,
  unitConversionProducts: null,
  products: [],
  isLoading: false,
  error: null,
};
const recipesReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_MISSING_MASTERDATA:
      return {
        ...state,
        units: action.payload.units,
        unitConversionBasic: action.payload.unitConversionBasic,
        unitConversionProducts: action.payload.unitConversionProducts,
        products: action.payload.products,
        isLoading: false,
      };
    case ReducerActions.SET_IS_LOADING:
      return {...state, isLoading: action.payload.isLoading};
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${exhaustiveCheck}`);
    }
  }
};

export interface OnAddToEvent {
  recipe: RecipeShort;
}
interface ScalingInformation {
  portions: number;
  ingredients: RecipeObjectStructure<Ingredient>;
  materials: RecipeObjectStructure<RecipeMaterialPosition>;
  scalingOptions: ScalingOptions;
}

/* ===================================================================
// ========================== Anzeige-Sicht ==========================
// =================================================================== */

interface RecipeViewProps {
  recipe: Recipe;
  firebase: Firebase;
  mealPlan: Array<PlanedMealsRecipe>;
  scaledPortions: number;
  isLoading: boolean;
  error: Error | null;
  isEmbedded?: boolean;
  groupConfiguration?: EventGroupConfiguration;
  /** Alle Funktionalität deaktivieren (Buttons) */
  disableFunctionality?: boolean;
  switchEditMode?: () => void;
  onUpdateRecipe: ({recipe, snackbar}: OnUpdateRecipeProps) => void;
  onEditRecipeMealPlan?: (mealRecipeUid: MealRecipe["uid"]) => void;
  onError?: (error: Error) => void;
  onAddToEvent?: ({recipe}: OnAddToEvent) => void;
  onRecipeDelete?: () => void;
  authUser: AuthUser;
}
/** @implements {RecipeViewProps} */
const RecipeView = ({
  recipe,
  firebase,
  mealPlan,
  scaledPortions,
  isLoading,
  error,
  isEmbedded = false,
  groupConfiguration,
  disableFunctionality = false,
  switchEditMode,
  onUpdateRecipe,
  onEditRecipeMealPlan,
  onAddToEvent,
  onError,
  onRecipeDelete,
  authUser,
}: RecipeViewProps) => {
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const {customDialog} = useCustomDialog();
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [state, dispatch] = React.useReducer(recipesReducer, inititialState);
  const [tagAddDialogOpen, setTagAddDialogOpen] = React.useState(false);
  const [scaleRecipeDialogOpen, setScaleRecipeDialogOpen] =
    React.useState(false);
  const [scalingInformation, setScalingInformation] =
    React.useState<ScalingInformation>({
      portions: 0,
      ingredients: {} as RecipeObjectStructure<Ingredient>,
      materials: {} as RecipeObjectStructure<RecipeMaterialPosition>,
      scalingOptions: {} as ScalingOptions,
    });
  const [publishRecipeDialogOpen, setPublishRecipeDialogOpen] =
    React.useState(false);
  const [reportErrorDialogOpen, setReportErrorDialogOpen] =
    React.useState(false);

  if (!isEmbedded) {
    document.title = recipe.name;
  }
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.VIEW,
      object: NavigationObject.none,
    });
  }, []);

  /* ------------------------------------------
  // Skalieren, falls nötig
  // ------------------------------------------ */
  React.useEffect(() => {
    if (recipe) {
      if (scaledPortions != 0) {
        const scaledIngredients = Recipe.scaleIngredients({
          recipe: recipe,
          portionsToScale: scaledPortions,
        });
        const scaledMaterials = Recipe.scaleMaterials({
          recipe: recipe,
          portionsToScale: scaledPortions,
        });
        setScalingInformation({
          portions: scaledPortions,
          ingredients: scaledIngredients,
          materials: scaledMaterials,
          scalingOptions: {} as ScalingOptions,
        });
      } else {
        setScalingInformation({
          portions: 0,
          ingredients: {} as RecipeObjectStructure<Ingredient>,
          materials: {} as RecipeObjectStructure<RecipeMaterialPosition>,
          scalingOptions: {} as ScalingOptions,
        });
      }
    }
  }, [scaledPortions, recipe.ingredients]);
  /* ------------------------------------------
  // Rating
  // ------------------------------------------ */
  const onSetRating = (value: number) => {
    Recipe.updateRating({
      firebase: firebase,
      recipe: recipe,
      newRating: value,
      authUser: authUser,
    }).then((result) => {
      onUpdateRecipe({
        recipe: {...recipe, rating: result},
        snackbar: {
          message: TEXT_THANK_YOU_FOR_YOUR_RATING,
          severity: "info",
          open: true,
        },
      });
    });
  };
  /* ------------------------------------------
  // Tags
  // ------------------------------------------ */
  const onTagAdd = () => {
    setTagAddDialogOpen(true);
  };
  const handleTagAddDialogClose = () => {
    setTagAddDialogOpen(false);
  };
  const onTagDelete = (tagToDelete: string) => {
    const tags = Recipe.deleteTag({
      tags: recipe.tags,
      tagToDelete: tagToDelete,
    });
    Recipe.saveTags({
      firebase: firebase,
      recipe: recipe,
      tags: tags,
      authUser: authUser,
    }).then(() => {
      onUpdateRecipe({
        recipe: {...recipe, tags: tags},
      });
    });
  };
  const handleTagAddDialogAdd = (tags: string[]) => {
    const listOfTags = recipe.tags.concat(tags);
    Recipe.saveTags({
      firebase: firebase,
      recipe: recipe,
      tags: listOfTags,
      authUser: authUser,
    }).then(() => {
      onUpdateRecipe({
        recipe: {...recipe, tags: listOfTags},
      });
    });
    setTagAddDialogOpen(false);
  };
  /* ------------------------------------------
  // Rezept zu Event hinzufügen
  // ------------------------------------------ */
  const addToEvent = () => {
    onAddToEvent &&
      onAddToEvent({
        recipe: RecipeShort.createShortRecipeFromRecipe(recipe),
      });
  };
  /* ------------------------------------------
  // Skalierung
  // ------------------------------------------ */
  const onOpenRecipeScaleDialog = () => {
    setScaleRecipeDialogOpen(true);
  };
  const onRecipeScale = async ({scaledPortions, scalingOptions}: OnScale) => {
    let scaledIngredients = {} as RecipeObjectStructure<Ingredient>;
    let scaledMaterials = {} as RecipeObjectStructure<RecipeMaterialPosition>;
    let unitConversionBasic = state.unitConversionBasic;
    let unitConversionProducts = state.unitConversionProducts;
    let products = state.products;
    let units = state.units;
    if (
      scalingOptions.convertUnits == true &&
      (!state.unitConversionBasic || !state.unitConversionProducts)
    ) {
      dispatch({
        type: ReducerActions.SET_IS_LOADING,
        payload: {isLoading: true},
      });

      if (!state.unitConversionBasic) {
        await UnitConversion.getAllConversionBasic({firebase})
          .then((result) => {
            unitConversionBasic = result;
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      if (!state.unitConversionProducts) {
        await UnitConversion.getAllConversionProducts({firebase})
          .then((result) => {
            unitConversionProducts = result;
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      if (state.products.length == 0) {
        await Product.getAllProducts({
          firebase: firebase,
          onlyUsable: true,
        })
          .then((result) => {
            products = result;
          })
          .catch((error) => {
            console.error(error);
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      if (!state.units) {
        await Unit.getAllUnits({
          firebase: firebase,
        })
          .then((result) => {
            units = result;
          })
          .catch((error) => {
            console.error(error);
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      }
      if (
        units &&
        unitConversionBasic &&
        unitConversionProducts &&
        products.length > 0
      ) {
        dispatch({
          type: ReducerActions.FETCH_MISSING_MASTERDATA,
          payload: {
            units: units,
            unitConversionBasic: unitConversionBasic,
            unitConversionProducts: unitConversionProducts,
            products: products,
          },
        });
      }
    }

    if (scaledPortions > 0) {
      scaledIngredients = Recipe.scaleIngredients({
        recipe: recipe,
        portionsToScale: scaledPortions,
        scalingOptions: scalingOptions,
        products: products,
        units: units,
        unitConversionBasic: unitConversionBasic,
        unitConversionProducts: unitConversionProducts,
      });
      scaledMaterials = Recipe.scaleMaterials({
        recipe: recipe,
        portionsToScale: scaledPortions,
        scalingOptions: scalingOptions,
        unitConversionBasic: unitConversionBasic,
        unitConversionProducts: unitConversionProducts,
      });
    }

    setScalingInformation({
      portions: scaledPortions,
      ingredients: scaledIngredients,
      materials: scaledMaterials,
      scalingOptions: scalingOptions,
    });

    //PopUp schliessen
    setScaleRecipeDialogOpen(false);
  };
  const onCloseRecipeScaleDialog = () => {
    setScaleRecipeDialogOpen(false);
  };
  const onMealPlanItemClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    const [, mealPlanRecipeUid] = event.currentTarget.id.split("_");

    const mealPlanRecipe = Object.values(mealPlan).find(
      (plan) => plan.mealPlanRecipe == mealPlanRecipeUid,
    );

    if (mealPlanRecipe) {
      let scaledIngredients = {} as RecipeObjectStructure<Ingredient>;
      let scaledMaterials = {} as RecipeObjectStructure<RecipeMaterialPosition>;
      const scaledPortions = mealPlanRecipe.mealPlan.reduce(
        (runningSum, portion) => runningSum + portion.totalPortions,
        0,
      );
      if (scaledPortions > 0) {
        scaledIngredients = Recipe.scaleIngredients({
          recipe: recipe,
          portionsToScale: scaledPortions,
        });
        scaledMaterials = Recipe.scaleMaterials({
          recipe: recipe,
          portionsToScale: scaledPortions,
        });
      }
      setScalingInformation({
        portions: scaledPortions,
        ingredients: scaledIngredients,
        materials: scaledMaterials,
        scalingOptions: {convertUnits: true},
      });
    }
  };
  /* ------------------------------------------
  // Eigene Variante
  // ------------------------------------------ */
  const createOwnVariant = () => {
    if (groupConfiguration?.uid) {
      // Wir brauchen den Event um eine Variante zu erstellen!
      const recipeVariant = Recipe.createRecipeVariant({
        recipe: recipe,
        eventUid: groupConfiguration.uid,
      });
      onUpdateRecipe({recipe: recipeVariant});
      // switchEditMode();
    }
  };
  /* ------------------------------------------
  // Drucken
  // ------------------------------------------ */
  const onPrint = async () => {
    const pdfRecipeData = {...recipe};
    pdfRecipeData.ingredients = Recipe.deleteEmptyIngredients(
      recipe.ingredients,
    );
    pdfRecipeData.materials = Recipe.deleteEmptyMaterials(recipe.materials);
    pdf(
      <RecipePdf
        recipe={pdfRecipeData}
        scaledPortions={scalingInformation.portions}
        scaledIngredients={scalingInformation.ingredients}
        scaledMaterials={scalingInformation.materials}
        authUser={authUser}
      />,
    )
      .toBlob()
      .then((result) => {
        fileSaver.saveAs(result, recipe.name + TEXT_SUFFIX_PDF);
      });
  };
  /* ------------------------------------------
  // Veröffentlichungsrequest
  // ------------------------------------------ */
  const onOpenRecipePublishRequest = () => {
    setPublishRecipeDialogOpen(true);
  };
  const onCloseRecipePublishRequestDialog = () => {
    setPublishRecipeDialogOpen(false);
  };
  const onCreateRecipePublishRequest = async (messageForReview: string) => {
    // File schreiben, der den Request eröffnet (in Review)
    await Recipe.createRecipePublishRequest({
      firebase: firebase,
      recipe: recipe,
      messageForReview: messageForReview,
      authUser: authUser,
    })
      .then((requestNo) => {
        recipe.isInReview = true;
        onUpdateRecipe({
          recipe: recipe,
          snackbar: {
            message: TEXT_PUBLISH_RECIPE_REQUEST_CREATED(requestNo),
            severity: "success",
            open: true,
          },
        });
      })
      .catch((error) => {
        console.error(error);
        onError && onError(error);
      });

    setPublishRecipeDialogOpen(false);
  };
  const onShowRequest = () => {
    navigate(ROUTES.REQUEST_OVERVIEW, {
      state: {
        action: Action.VIEW,
        recipeUid: recipe.uid,
      },
    });
  };
  /* ------------------------------------------
  // Fehler melden
  // ------------------------------------------ */
  const onOpenReportErrorRequest = () => {
    setReportErrorDialogOpen(true);
  };
  const onCloseReportErrorDialog = () => {
    setReportErrorDialogOpen(false);
  };
  const onReportErrorRequest = async (messageForReview: string) => {
    // File schreiben, der den Request eröffnet (in Review)
    await Recipe.createReportErrorRequest({
      firebase: firebase,
      recipe: recipe,
      messageForReview: messageForReview,
      authUser: authUser,
    })
      .then((requestNo) => {
        onUpdateRecipe({
          recipe: recipe,
          snackbar: {
            message: TEXT_REPORT_ERROR_RECIPE_REQUEST_CREATED(requestNo),
            severity: "success",
            open: true,
          },
        });
      })
      .catch((error) => {
        console.error(error);
        onError && onError(error);
      });

    setReportErrorDialogOpen(false);
  };

  /* ------------------------------------------
  // Rezept löschen
  // ------------------------------------------ */
  const onDeleteRecipe = async () => {
    // Löschung wurde bestätigt. Löschen kann losgehen
    const isConfirmed = await customDialog({
      dialogType: DialogType.ConfirmSecure,
      deletionDialogProperties: {confirmationString: recipe.name},
      title: TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
      subtitle: TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
      text: TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) {
      return;
    }

    dispatch({
      type: ReducerActions.SET_IS_LOADING,
      payload: {isLoading: true},
    });

    await Recipe.delete({
      firebase: firebase,
      recipe: recipe,
      authUser: authUser,
    })
      .then(() => {
        // Kurzer Timeout, damit der Session-Storage nachmag
        setTimeout(function () {
          //Zurück zur Rezeptübersicht
          if (recipe.type !== RecipeType.variant) {
            navigate(ROUTES.RECIPES, {
              state: {
                acion: Action.DELETE,
                object: recipe.uid,
                snackbar: {
                  open: true,
                  severity: "success",
                  message: `Rezept «${recipe.name}» wurde gelöscht.`,
                },
              },
            });
          } else {
            onRecipeDelete && onRecipeDelete();
          }
        }, 500);
      })
      .catch((error) => {
        onError && onError(error);
        return;
      });
  };

  return (
    <React.Fragment>
      <RecipeHeader
        recipe={recipe}
        onSetRating={onSetRating}
        disableFunctionality={disableFunctionality}
      />
      {!disableFunctionality && (
        <RecipeButtonRow
          recipe={recipe}
          isEmbedded={isEmbedded}
          isAddedToEvent={
            mealPlan.length > 0 && groupConfiguration != undefined
          }
          switchEditMode={switchEditMode}
          onAddToEvent={addToEvent}
          onScale={onOpenRecipeScaleDialog}
          onCreateOwnVariant={createOwnVariant}
          onPrint={onPrint}
          onPublish={onOpenRecipePublishRequest}
          onReportError={onOpenReportErrorRequest}
          onShowRequest={onShowRequest}
          onDelete={onDeleteRecipe}
          authUser={authUser}
        />
      )}
      <RecipeDivider />
      <Container sx={classes.container} component="main" maxWidth="md">
        <Backdrop sx={classes.backdrop} open={isLoading || state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Grid container spacing={4} justifyContent="center">
          {(error || state.error) && (
            <Grid size={12} key={"error"}>
              <AlertMessage
                error={error ? error : state.error}
                messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
              />
            </Grid>
          )}
          {mealPlan.length > 0 && groupConfiguration && (
            <Grid size={{xs: 12, sm: 6}}>
              <MealPlanPanel
                mealPlan={mealPlan}
                groupConfiguration={groupConfiguration}
                disableFunctionality={disableFunctionality}
                onMealPlanItemClick={onMealPlanItemClick}
                onEditRecipeMealPlan={onEditRecipeMealPlan}
              />
            </Grid>
          )}
          <Grid size={{xs: 12, sm: 6}}>
            <RecipeInfoPanel
              recipe={recipe}
              disableFunctionality={disableFunctionality}
              onTagDelete={onTagDelete}
              onTagAdd={onTagAdd}
              authUser={authUser}
            />
          </Grid>
          <RecipeDivider style={{marginTop: "1em", marginBottom: "1em"}} />
          <Grid
            size={{xs: 12, sm: 6}}
            style={{marginTop: "2em", marginBottom: "2em"}}
          >
            <RecipeIngredients
              recipe={recipe}
              scaledPortions={scalingInformation.portions}
              scaledIngredients={scalingInformation.ingredients}
            />
          </Grid>
          <Grid
            size={{xs: 12, sm: 6}}
            style={{marginTop: "2em", marginBottom: "2em"}}
          >
            <RecipePreparation recipe={recipe} />
          </Grid>
          {recipe.materials?.order.length > 0 &&
            recipe.materials.entries[recipe.materials.order[0]]?.material
              .uid !== "" && (
              <Grid
                size={{xs: 12, sm: 6}}
                style={{marginTop: "2em", marginBottom: "2em"}}
              >
                <RecipeMaterial
                  recipe={recipe}
                  scaledPortions={scalingInformation.portions}
                  scaledMaterials={scalingInformation.materials}
                />
              </Grid>
            )}
          {recipe.type === RecipeType.variant &&
            recipe.variantProperties?.note && (
              <Grid size={12} style={{marginTop: "2em", marginBottom: "2em"}}>
                <RecipeVariantNote recipe={recipe} />
              </Grid>
            )}
        </Grid>
      </Container>
      <DialogTagAdd
        dialogOpen={tagAddDialogOpen}
        handleClose={handleTagAddDialogClose}
        handleAddTags={handleTagAddDialogAdd}
      />
      <DialogScaleRecipe
        dialogOpen={scaleRecipeDialogOpen}
        scaledPortions={recipe.portions}
        handleOk={onRecipeScale}
        handleClose={onCloseRecipeScaleDialog}
      />
      <DialogPublishRecipe
        dialogOpen={publishRecipeDialogOpen}
        handleOk={onCreateRecipePublishRequest}
        handleClose={onCloseRecipePublishRequestDialog}
      />
      <DialogReportError
        dialogOpen={reportErrorDialogOpen}
        handleOk={onReportErrorRequest}
        handleClose={onCloseReportErrorDialog}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Header ==============================
// =================================================================== */
interface RecipeHeaderProps {
  recipe: Recipe;
  disableFunctionality?: boolean;
  onSetRating: (value: number) => void;
}
const RecipeHeader = ({
  recipe,
  disableFunctionality = false,
  onSetRating,
}: RecipeHeaderProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const [ratingAnchor, setRatingAnchor] = React.useState<null | HTMLElement>(
    null,
  );
  /* ------------------------------------------
  // Menü für eigenes Rating zeigen/schliessen
  // ------------------------------------------ */
  const showRatingMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    setRatingAnchor(event.currentTarget);
  };
  const handleRatingMenuClose = () => {
    setRatingAnchor(null);
  };
  /* ------------------------------------------
  // Rating anpassen
  // ------------------------------------------ */
  const onUpdateMyRating = (
    event: React.SyntheticEvent,
    value: number | null,
  ) => {
    if (value === recipe.rating.myRating || !value) {
      return;
    }
    onSetRating(value);
    setRatingAnchor(null);
  };
  return (
    <React.Fragment>
      <Container
        maxWidth="md"
        sx={classes.recipeHeader}
        style={{
          display: "flex",
          position: "relative",
          paddingLeft: theme.spacing(5),
          paddingRight: theme.spacing(5),
          backgroundImage: `url(${
            recipe.pictureSrc
              ? recipe.pictureSrc
              : ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
          })`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Box component="div" sx={classes.recipeHeaderTitle}>
          <Typography
            component="h1"
            variant="h2"
            align="center"
            color="textPrimary"
            style={{
              display: "block",
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
            gutterBottom
          >
            {recipe.name}
          </Typography>
          {recipe.type === RecipeType.variant && (
            <Typography
              component="h2"
              variant="h5"
              align="center"
              color="textPrimary"
              style={{display: "block"}}
              gutterBottom
            >
              {`${TEXT_VARIANT} ${recipe.variantProperties?.variantName}`}
            </Typography>
          )}
          {recipe.type === RecipeType.public && (
            <React.Fragment>
              <Box sx={classes.statsRatingBox}>
                <div
                  onClick={!disableFunctionality ? showRatingMenu : undefined}
                  style={{
                    cursor: "pointer",
                  }}
                >
                  <Rating
                    name="rating.avgRating"
                    sx={classes.rating}
                    value={recipe.rating.avgRating}
                    precision={0.1}
                    size="small"
                    readOnly
                  />
                </div>
                <Menu
                  id="rating-menu"
                  anchorEl={ratingAnchor}
                  keepMounted
                  open={Boolean(ratingAnchor)}
                  onClose={handleRatingMenuClose}
                  style={{padding: "1em"}}
                >
                  <Box sx={classes.statsKpiBox} style={{margin: "1em"}}>
                    <Typography color="textSecondary" align="center">
                      {TEXT_FIELD_YOUR_RATING}
                    </Typography>
                    <Box sx={classes.statsRatingBox}>
                      <Rating
                        name="rating.myRating"
                        value={recipe.rating.myRating}
                        precision={0.5}
                        size="small"
                        onChange={onUpdateMyRating}
                      />
                    </Box>
                  </Box>
                </Menu>
              </Box>
              <Typography color="textSecondary" align="center" variant="body2">
                {`${recipe.rating.noRatings} ${
                  recipe.rating.noRatings === 1 ? TEXT_VOTE : TEXT_VOTES
                }`}
              </Typography>
            </React.Fragment>
          )}
        </Box>
        {recipe.pictureSrc && (
          <Box component="div" sx={classes.recipeHeaderPictureSource}>
            <Tooltip title={TEXT_IMAGE_MAY_BE_SUBJECT_OF_COPYRIGHT} arrow>
              <Typography variant="body2">
                {TEXT_IMAGE_SOURCE}
                <Link href={recipe.pictureSrc} target="_blank">
                  {Utils.getDomain(recipe.pictureSrc)}
                </Link>
              </Typography>
            </Tooltip>
          </Box>
        )}
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// ========================== Button Reihe ===========================
// =================================================================== */
interface RecipeButtonRowProps {
  recipe: Recipe;
  isEmbedded: boolean;
  isAddedToEvent: boolean; // bereits zu Anlass hinzugefügt
  switchEditMode: RecipeViewProps["switchEditMode"];
  onAddToEvent: () => void;
  onScale: () => void;
  onCreateOwnVariant: () => void;
  onPrint: () => void;
  onPublish: () => void;
  onReportError: () => void;
  onShowRequest: () => void;
  onDelete: () => void;
  authUser: AuthUser;
}

const RecipeButtonRow = ({
  recipe,
  isEmbedded,
  isAddedToEvent,
  switchEditMode,
  onAddToEvent,
  onScale,
  onCreateOwnVariant,
  onPrint,
  onPublish,
  onReportError,
  onShowRequest,
  onDelete,
  authUser,
}: RecipeButtonRowProps) => {
  const buttons: CustomButton[] = [];

  isEmbedded &&
    !isAddedToEvent &&
    buttons.push({
      id: "add_to_event",
      hero: true,
      visible: true,
      label: TEXT_BUTTON_ADD_TO_EVENT,
      variant: "contained",
      color: "primary",
      startIcon: <AddIcon />,
      onClick: onAddToEvent,
    });
  buttons.push({
    id: "edit",
    label: TEXT_EDIT,
    hero: true,
    visible:
      (recipe.type === RecipeType.public &&
        !isEmbedded &&
        (authUser.roles.includes(Role.admin) ||
          authUser.roles.includes(Role.communityLeader))) ||
      (recipe.type === RecipeType.private &&
        (recipe.created.fromUid === authUser.uid ||
          // Falls das Rezepte im Freigabeprozess ist, soll es von
          // der*m Commnunity-Leader*in angepasst weden können
          (recipe.isInReview &&
            authUser.roles.includes(Role.communityLeader)))) ||
      // Bei der Rezeptvariante, sollen alle anpassen können
      // Die DB-Regel fängt das ab, dass das Rezept nur angezeigt wird
      // wenn man auch Teil des Teams ist.
      (recipe.type === RecipeType.variant &&
        (authUser.uid !== "" || authUser.roles.includes(Role.admin))),
    variant: "outlined",
    color: "primary",
    onClick: switchEditMode!,
  });

  buttons.push({
    id: "scale",
    hero: true,
    visible: true,
    label: TEXT_BUTTON_SCALE,
    variant: "outlined",
    color: "primary",
    onClick: onScale,
  });

  isEmbedded &&
    recipe.type !== RecipeType.variant &&
    buttons.push({
      id: "own_variant",
      hero: true,
      visible: true,
      label: TEXT_BUTTON_OWN_VARIANT,
      variant: "outlined",
      color: "primary",
      onClick: onCreateOwnVariant,
    });
  buttons.push({
    id: "print",
    hero: true,
    visible: true,
    label: TEXT_BUTTON_PRINTVERSION,
    variant: "outlined",
    color: "primary",
    onClick: onPrint,
  });

  !isEmbedded &&
    buttons.push({
      id: "publish",
      hero: true,
      visible:
        recipe.type === RecipeType.private &&
        (recipe?.isInReview === false || recipe.isInReview === undefined) &&
        (recipe.created.fromUid === authUser.uid ||
          authUser.roles.includes(Role.admin)),
      label: TEXT_PUBLISH_RECIPE,
      variant: "outlined",
      color: "primary",
      onClick: onPublish,
    });

  !isEmbedded &&
    buttons.push({
      id: "reportError",
      hero: true,
      visible: recipe.type === RecipeType.public,
      label: TEXT_REPORT_ERROR,
      variant: "outlined",
      color: "primary",
      onClick: onReportError,
    });

  !isEmbedded &&
    buttons.push({
      id: "goToRequestOverview",
      hero: true,
      visible:
        recipe.type === RecipeType.private &&
        recipe.created.fromUid === authUser.uid &&
        recipe.isInReview === true,
      label: TEXT_SHOW_OPEN_REQUESTS,
      variant: "outlined",
      color: "primary",
      onClick: onShowRequest,
    });
  buttons.push({
    id: "delete",
    hero: true,
    visible:
      (recipe.type === RecipeType.private &&
        recipe.created.fromUid === authUser.uid &&
        !isEmbedded) ||
      (recipe.type === RecipeType.public &&
        authUser.roles.includes(Role.admin) &&
        !isEmbedded) ||
      // Wenn Embeded, nur Varianten löschen
      (recipe.type === RecipeType.variant &&
        isEmbedded &&
        recipe.created.fromUid === authUser.uid),
    label: TEXT_DELETE_RECIPE,
    variant: "outlined",
    color: "primary",
    onClick: onDelete,
  });

  return (
    <React.Fragment>
      <ButtonRow
        key="action_buttons"
        // style={{ marginTop: "3em", marginBottom: "3em" }}
        buttons={buttons}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Info Panel ============================
// =================================================================== */
interface RecipeInfoPanelProps {
  recipe: Recipe;
  disableFunctionality?: boolean;
  onTagDelete: (tagToDelete: string) => void;
  onTagAdd: () => void;
  authUser: AuthUser;
}
export const RecipeInfoPanel = ({
  recipe,
  disableFunctionality = false,
  onTagDelete,
  onTagAdd,
  authUser,
}: RecipeInfoPanelProps) => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  const [tipsAndTagsSectionOpen, setTipsAndTagsSectionOpen] =
    React.useState(false);

  const handleOnTipsAndTagsClick = () => {
    setTipsAndTagsSectionOpen(!tipsAndTagsSectionOpen);
  };

  return (
    <Card sx={classes.card}>
      <CardContent sx={classes.cardContent}>
        <List dense>
          {/* Quelle */}
          <FormListItem
            key={"source"}
            id={"source"}
            value={
              Utils.isUrl(recipe.source) ? (
                <Link href={recipe.source as string} target="_blank">
                  {Utils.getDomain(recipe.source)}
                </Link>
              ) : (
                recipe.source
              )
            }
            label={TEXT_SOURCE}
          />
          {/* Autor*in */}
          <FormListItem
            key={"author"}
            id={"author"}
            value={
              <Link
                style={{cursor: "pointer"}}
                onClick={() =>
                  navigate(
                    `${ROUTES.USER_PUBLIC_PROFILE}/${recipe.created.fromUid}`,
                    {
                      state: {
                        action: Action.VIEW,
                        displayName: recipe.created.fromDisplayName,
                      },
                    },
                  )
                }
              >
                {recipe.created?.fromDisplayName}
              </Link>
            }
            label={TEXT_CREATED_FROM}
          />
          {/* Zubereitungszeit */}
          <FormListItem
            key={"times.preparation"}
            id={"times.preparation"}
            value={`${recipe.times.preparation} ${TEXT_UNIT_MIN}`}
            label={TEXT_FIELD_PREPARATION_TIME}
          />
          {/* Ruhezeit */}
          <FormListItem
            key={"times.rest"}
            id={"times.rest"}
            value={`${recipe.times.rest} ${TEXT_UNIT_MIN}`}
            label={TEXT_FIELD_REST_TIME}
          />
          {/* Kochzeit */}
          <FormListItem
            key={"times.cooking"}
            id={"times.cooking"}
            value={`${recipe.times.cooking} ${TEXT_UNIT_MIN}`}
            label={TEXT_FIELD_COOK_TIME}
          />
          {/* Diät Infos */}
          <FormListItem
            key={"diet.property"}
            id={"diet.property"}
            value={<DietProperties recipe={recipe} />}
            label={TEXT_DIET_PROPERTIES}
          />

          <ListItemButton onClick={handleOnTipsAndTagsClick}>
            <ListItemText secondary={TEXT_TIPS_AND_TAGS} />
            {tipsAndTagsSectionOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>

          <Collapse in={tipsAndTagsSectionOpen} timeout="auto" unmountOnExit>
            <List dense>
              {/* Hinweis */}
              <FormListItem
                key={"menuType"}
                id={"menuType"}
                value={recipe.menuTypes
                  .map((menuType) => TEXT_MENU_TYPES[menuType])
                  .join(", ")}
                label={TEXT_MENU_TYPE}
              />
              {/* Hinweis */}
              <FormListItem
                key={"note"}
                id={"note"}
                value={recipe.note}
                label={TEXT_FIELD_HINT}
              />
              {/* Tags */}
              <FormListItem
                key={"tags"}
                id={"tags"}
                value={
                  <React.Fragment>
                    {recipe.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={
                          !disableFunctionality
                            ? recipe.type === RecipeType.public &&
                              authUser.roles.includes(Role.communityLeader)
                              ? () => onTagDelete(tag)
                              : recipe.type === RecipeType.private &&
                                  authUser.uid === authUser.uid
                                ? () => onTagDelete(tag)
                                : undefined
                            : undefined
                        }
                        sx={classes.chip}
                        size="small"
                      />
                    ))}
                  </React.Fragment>
                }
                secondaryAction={
                  !disableFunctionality ? (
                    <IconButton
                      edge="end"
                      aria-label="Tag hinzufügen"
                      onClick={onTagAdd}
                      size="small"
                    >
                      <AddIcon />
                    </IconButton>
                  ) : undefined
                }
                label={TEXT_FIELD_TAGS}
              />
            </List>
          </Collapse>
        </List>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ======================= Diät-Eigenschaften ========================
// =================================================================== */
interface DietPropertiesProps {
  recipe: Recipe;
}
const DietProperties = ({recipe}: DietPropertiesProps) => {
  return (
    <React.Fragment>
      <Grid container spacing={2}>
        <Grid size={4} style={{textAlign: "center"}}>
          {recipe.dietProperties.allergens.includes(Allergen.Lactose) ? (
            <React.Fragment>
              <LactoseIcon fontSize="large" />
              <Typography variant="body2">{TEXT_HAS_LACTOSE}</Typography>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <LactoseFreeIcon fontSize="large" />
              <Typography variant="body2">{TEXT_IS_LACTOSEFREE}</Typography>
            </React.Fragment>
          )}
        </Grid>
        <Grid size={4} style={{textAlign: "center"}}>
          {recipe.dietProperties.allergens.includes(Allergen.Gluten) ? (
            <React.Fragment>
              <GlutenIcon fontSize="large" />
              <Typography variant="body2">{TEXT_HAS_GLUTEN}</Typography>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <GlutenFreeIcon fontSize="large" />
              <Typography variant="body2">{TEXT_IS_GLUTENFREE}</Typography>
            </React.Fragment>
          )}
        </Grid>
        <Grid size={4} style={{textAlign: "center"}}>
          {recipe.dietProperties.diet === Diet.Vegetarian ? (
            <React.Fragment>
              <VegetarianIcon fontSize="large" />
              <Typography variant="body2">{TEXT_IS_VEGETARIAN}</Typography>
            </React.Fragment>
          ) : recipe.dietProperties.diet === Diet.Vegan ? (
            <React.Fragment>
              <VeganIcon fontSize="large" />
              <Typography variant="body2">{TEXT_IS_VEGAN}</Typography>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <MeatIcon fontSize="large" />
              <Typography variant="body2">{TEXT_HAS_MEAT}</Typography>
            </React.Fragment>
          )}
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ======================= Einplanungspanel ==========================
// =================================================================== */
interface MealPlanPanelProps {
  mealPlan: Array<PlanedMealsRecipe>;
  groupConfiguration: EventGroupConfiguration;
  disableFunctionality?: boolean;
  onMealPlanItemClick?: (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => void;
  onEditRecipeMealPlan?: (mealRecipeUid: MealRecipe["uid"]) => void;
}
export const MealPlanPanel = ({
  mealPlan,
  groupConfiguration,
  disableFunctionality = false,
  onMealPlanItemClick,
  onEditRecipeMealPlan: onEditRecipeMealPlanSuper,
}: MealPlanPanelProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const onEditRecipeMealPlan = (event: React.MouseEvent<HTMLElement>) => {
    onEditRecipeMealPlanSuper!(event.currentTarget.id.split("_")[1]);
  };

  return (
    <Card sx={classes.card}>
      <CardHeader title={TEXT_THIS_RECIPE_IS_PLANNED_FOR} />
      <CardContent sx={classes.cardContent}>
        <List key={"mealsList"}>
          {mealPlan.map((plan, index) => (
            <React.Fragment key={"mealListItemDiv_" + plan.mealPlanRecipe}>
              <ListItemButton
                dense
                key={"mealListItem_" + plan.mealPlanRecipe}
                id={"mealListItem_" + plan.mealPlanRecipe}
                onClick={onMealPlanItemClick || undefined}
              >
                <ListItemText
                  key={"listitemealListItemText_" + plan.mealPlanRecipe}
                  style={{margin: 0}}
                  primary={
                    <>
                      {new Date(plan.meal.date).toLocaleString("default", {
                        weekday: "long",
                      })}{" "}
                      -{" "}
                      {new Date(plan.meal.date).toLocaleString("de-CH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                      , {plan.meal.mealTypeName}
                      {plan.menue.name && (
                        <>
                          {" — "}
                          <strong>{plan.menue.name}</strong>
                        </>
                      )}
                    </>
                  }
                  secondary={plan.mealPlan.map((singleMealPlan, index) => (
                    <React.Fragment key={index}>
                      {`${
                        singleMealPlan.factor != 1
                          ? `${singleMealPlan.factor} × `
                          : ``
                      } ${
                        singleMealPlan.diet == PlanedDiet.ALL
                          ? TEXT_ALL
                          : singleMealPlan.diet == PlanedDiet.FIX
                            ? ""
                            : groupConfiguration.diets.entries[
                                singleMealPlan.diet
                              ].name
                      }${
                        singleMealPlan.intolerance == PlanedIntolerances.ALL
                          ? ""
                          : singleMealPlan.intolerance == PlanedIntolerances.FIX
                            ? ""
                            : `, ${
                                groupConfiguration.intolerances.entries[
                                  singleMealPlan.intolerance
                                ].name
                              }`
                      } (${singleMealPlan.totalPortions} ${
                        singleMealPlan.totalPortions == 1
                          ? TEXT_PORTION
                          : TEXT_PORTIONS
                      })`}
                      {index !== plan.mealPlan.length - 1 && <br />}
                      {/* Zeilenumbruch, außer beim letzten Element */}
                    </React.Fragment>
                  ))}
                />
                {onEditRecipeMealPlan && !disableFunctionality && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      id={"mealListItemButton_" + plan.mealPlanRecipe}
                      aria-label="Mahlzeit anpassen"
                      size="small"
                      onClick={onEditRecipeMealPlan}
                    >
                      <EditIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItemButton>
              {index !== mealPlan.length - 1 && (
                <Divider
                  style={{
                    marginTop: theme.spacing(1),
                    marginBottom: theme.spacing(1),
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// =================== Dialog um Tags hinzuzufügen  ==================
// =================================================================== */
interface DialogTagAddProps {
  dialogOpen: boolean;
  handleClose: () => void;
  handleAddTags: (tags: string[]) => void;
}
export const DialogTagAdd = ({
  dialogOpen,
  handleClose,
  handleAddTags,
}: DialogTagAddProps) => {
  const classes = useCustomStyles();

  const [tags, setTags] = React.useState<Array<string>>([]);
  const [textFieldValue, setTextFieldValue] = React.useState("");

  const handleTagDelete = (tagToDelete: string) => {
    setTags(tags.filter((tag) => tag != tagToDelete));
  };
  const handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    if (event.target.value.toString().endsWith(" ")) {
      tags.push(event.target.value.toString().trim().toLowerCase());
      setTextFieldValue("");
    } else {
      setTextFieldValue(event.target.value);
    }
  };
  const onDialogCancel = () => {
    setTags([]);
    setTextFieldValue("");
    handleClose();
  };
  const onDialogClose = () => {
    // Letzer Eintrag hinzufügen
    textFieldValue && tags.push(textFieldValue.trim().toLowerCase());
    handleAddTags(tags);
    setTags([]);
    setTextFieldValue("");
  };

  return (
    <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogContent>
        <Typography>
          {TEXT_TAG} {TEXT_ADD}
        </Typography>
        <TextField
          fullWidth
          multiline
          InputProps={{
            startAdornment: tags.map((item) => (
              <Chip
                sx={classes.chip}
                key={item}
                tabIndex={-1}
                label={item}
                onDelete={() => handleTagDelete(item)}
                size="small"
              />
            )),
            onChange: (event) => {
              handleInputChange(event);
            },
          }}
          value={textFieldValue}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onDialogCancel} color="primary">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onDialogClose} color="primary">
          {TEXT_ADD}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
/* ===================================================================
// ============================= Zutaten  ============================
// =================================================================== */
interface RecipeIngredientsProps {
  recipe: Recipe;
  scaledPortions?: number;
  scaledIngredients?: RecipeObjectStructure<Ingredient>;
}
export const RecipeIngredients = ({
  recipe,
  scaledPortions,
  scaledIngredients,
}: RecipeIngredientsProps) => {
  const classes = useCustomStyles();
  const ingredientGridColumSize = {
    scaledOn: {
      originalHeader: 4 as GridSize,
      scaledHeader: 4 as GridSize,
      emptyHeaderSpace: 4 as GridSize,
      original: 2 as GridSize,
      scaled: 2 as GridSize,
      unitOriginal: 2 as GridSize,
      unitScaled: 2 as GridSize,
      ingredient: 4 as GridSize,
    },
    scaledOff: {
      original: 0 as GridSize,
      scaled: 2 as GridSize,
      unit: 2 as GridSize,
      ingrdient: 8 as GridSize,
    },
  };
  if (scaledPortions === 0) {
    scaledPortions = undefined;
  }
  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        style={{display: "block"}}
        gutterBottom
      >
        {TEXT_INGREDIENTS}
      </Typography>
      <Typography component="div" align="center">
        {TEXT_FOR_ACCUSATIVE}
        {"  "}
        <Box fontWeight="fontWeightBold" display="inline">
          {scaledPortions ? scaledPortions : recipe.portions}
        </Box>
        {"  "}
        {TEXT_PORTIONS}
      </Typography>
      {scaledPortions && (
        <Typography component="div" align="center" color="textSecondary">
          {TEXT_ORIGINAL}
          {"  "}
          <Box fontWeight="fontWeightBold" display="inline">
            {recipe?.portions}
          </Box>
          {"  "}
          {TEXT_PORTIONS}
        </Typography>
      )}
      <Divider
        variant="middle"
        style={{
          marginTop: "1em",
          marginBottom: "1em",
          marginLeft: "8em",
          marginRight: "8em",
        }}
      />
      {/* Überschriften Zutaten*/}
      <Grid container spacing={1}>
        {scaledPortions && (
          <React.Fragment>
            <Grid
              size={ingredientGridColumSize.scaledOn.originalHeader}
              key={"ingredient_header_grid_original"}
              sx={classes.centerCenter}
            >
              <Typography
                key={"ingredient_header_original"}
                color="textSecondary"
              >
                {TEXT_ORIGINAL}
              </Typography>
            </Grid>
            <Grid
              size={ingredientGridColumSize.scaledOn.scaledHeader}
              key={"ingredient_header_grid_scaled"}
              sx={classes.centerCenter}
            >
              <Typography key={"ingredient_header_scaled"} color="textPrimary">
                {TEXT_SCALED}
              </Typography>
            </Grid>
            <Grid
              size={ingredientGridColumSize.scaledOn.emptyHeaderSpace}
              key={"ingredient_header_grid_ingredient"}
              sx={classes.centerCenter}
            />
          </React.Fragment>
        )}
        <React.Fragment>
          {recipe.ingredients?.order.map((ingredientUid, counter) => {
            let section: Section;
            let ingredient: Ingredient;

            if (
              recipe.ingredients.entries[ingredientUid]?.posType ==
              PositionType.ingredient
            ) {
              ingredient = recipe.ingredients.entries[
                ingredientUid
              ] as Ingredient;
              section = {} as Section;
            } else {
              section = recipe.ingredients.entries[ingredientUid] as Section;
              ingredient = {} as Ingredient;
            }
            return (
              <React.Fragment key={"ingredient_row_" + ingredientUid}>
                {recipe.ingredients.entries[ingredientUid]?.posType ==
                PositionType.section ? (
                  <Grid
                    size={12}
                    key={"ingredient_section_grid_" + ingredientUid}
                    style={{marginTop: "0.5em", paddingLeft: "1em"}}
                  >
                    {counter > 0 && (
                      <Divider
                        style={{marginTop: "2em", marginBottom: "1em"}}
                      />
                    )}
                    <Typography
                      variant="subtitle1"
                      style={{fontWeight: "bold"}}
                      // align="center"
                    >
                      {section.name}
                      {":"}
                    </Typography>
                  </Grid>
                ) : (
                  <React.Fragment>
                    {scaledPortions && (
                      // Original Menge
                      <React.Fragment>
                        <Grid
                          size={ingredientGridColumSize.scaledOn.original}
                          key={
                            "ingredient_quantity_original_grid_" + ingredientUid
                          }
                          sx={classes.centerRight}
                        >
                          <Typography
                            key={
                              "ingredient_quantity_original_" + ingredientUid
                            }
                            color="textSecondary"
                          >
                            {Number.isNaN(ingredient.quantity) ||
                            ingredient.quantity == 0 ||
                            ingredient.quantity == null
                              ? ""
                              : ingredient.quantity.toLocaleString("de-CH")}
                          </Typography>
                        </Grid>
                        <Grid
                          size={
                            scaledPortions
                              ? ingredientGridColumSize.scaledOn.unitOriginal
                              : ingredientGridColumSize.scaledOff.unit
                          }
                          key={
                            "ingredient_quantity_unitOriginal_grid_" +
                            ingredientUid
                          }
                        >
                          <Typography
                            key={
                              "ingredient_quantity_unitOriginal_" +
                              ingredientUid
                            }
                            color="textSecondary"
                          >
                            {ingredient.unit}
                          </Typography>
                        </Grid>
                      </React.Fragment>
                    )}
                    {/* zu kochende Menge (skaliert/Original)*/}
                    <Grid
                      size={
                        scaledPortions
                          ? ingredientGridColumSize.scaledOn.scaled
                          : ingredientGridColumSize.scaledOff.scaled
                      }
                      key={"ingredient_quantity_scaled_grid_" + ingredientUid}
                      sx={classes.centerRight}
                    >
                      <Typography
                        key={"ingredient_quantity_scaled_" + ingredientUid}
                        color="textPrimary"
                      >
                        {scaledPortions &&
                        scaledIngredients &&
                        scaledIngredients[ingredientUid]?.quantity
                          ? Number.isNaN(
                              scaledIngredients[ingredientUid].quantity,
                            ) || scaledIngredients[ingredientUid].quantity == 0
                            ? ""
                            : scaledIngredients[
                                ingredientUid
                              ]?.quantity.toLocaleString("de-CH")
                          : !ingredient.quantity ||
                              Number.isNaN(ingredient.quantity)
                            ? ""
                            : ingredient.quantity.toLocaleString("de-CH")}
                      </Typography>
                    </Grid>

                    {/* Einheit */}
                    <Grid
                      size={
                        scaledPortions
                          ? ingredientGridColumSize.scaledOn.unitOriginal
                          : ingredientGridColumSize.scaledOff.unit
                      }
                      key={"ingredient_quantity_unit_grid_" + ingredientUid}
                    >
                      <Typography
                        key={"ingredient_quantity_unit_" + ingredientUid}
                        color="textPrimary"
                      >
                        {scaledPortions &&
                        scaledIngredients &&
                        scaledIngredients[ingredientUid]?.unit
                          ? scaledIngredients[ingredientUid]?.unit
                          : ingredient.unit}
                      </Typography>
                    </Grid>

                    {/* Zutat */}
                    <Grid
                      size={
                        scaledPortions
                          ? ingredientGridColumSize.scaledOn.ingredient
                          : ingredientGridColumSize.scaledOff.ingrdient
                      }
                      key={
                        "ingredient_quantity_ingredient_grid_" + ingredientUid
                      }
                    >
                      <Typography
                        key={"ingredient_quantity_ingredient_" + ingredientUid}
                        color="textPrimary"
                        component="div"
                      >
                        {ingredient.product?.name}
                        {ingredient.detail && (
                          <Box display="inline" color="text.secondary">
                            {`, ${ingredient.detail}`}
                          </Box>
                        )}
                      </Typography>
                    </Grid>
                  </React.Fragment>
                )}
              </React.Fragment>
            );
          })}
        </React.Fragment>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Zubereitung  ==========================
// =================================================================== */
interface RecipePreparationProps {
  recipe: Recipe;
}

export const RecipePreparation = ({recipe}: RecipePreparationProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        style={{display: "block"}}
        gutterBottom
      >
        {TEXT_PREPARATION}
      </Typography>
      <Grid container spacing={2}>
        {recipe?.preparationSteps?.order.map((preparationStepUid, counter) => {
          let preparationStep: PreparationStep;
          let section: Section;
          if (
            recipe.preparationSteps.entries[preparationStepUid]?.posType ==
            PositionType.preparationStep
          ) {
            preparationStep = recipe.preparationSteps.entries[
              preparationStepUid
            ] as PreparationStep;
            section = {} as Section;
          } else {
            section = recipe.preparationSteps.entries[
              preparationStepUid
            ] as Section;
            preparationStep = {} as PreparationStep;
          }

          return (
            <React.Fragment
              key={"prepartaionStep_row_grid_" + preparationStepUid}
            >
              {recipe.preparationSteps.entries[preparationStepUid]?.posType ==
              PositionType.section ? (
                <Grid
                  size={12}
                  key={"preparationStep_section_grid_" + section.uid}
                  style={{marginTop: "0.5em", paddingLeft: "1em"}}
                >
                  {counter > 0 && (
                    <Divider style={{marginTop: "2em", marginBottom: "1em"}} />
                  )}
                  <Typography
                    variant="subtitle1"
                    style={{fontWeight: "bold"}}
                    // align="center"
                  >
                    {section.name}
                    {":"}
                  </Typography>
                </Grid>
              ) : (
                <React.Fragment>
                  <Grid
                    size={1}
                    key={"preparationStep_pos_" + preparationStepUid}
                    sx={classes.topCenter}
                  >
                    {/* Wenn kein Text, dann ist es wahrscheinlich die letzte Position
                       --> nicht anzeigen! */}
                    {preparationStep.step && (
                      <Typography color="textSecondary">
                        {Recipe.definePositionSectionAdjusted({
                          uid: preparationStepUid,
                          entries: recipe.preparationSteps.entries,
                          order: recipe.preparationSteps.order,
                        })}
                      </Typography>
                    )}
                  </Grid>
                  <Grid
                    size={11}
                    key={"preparationStep_step_" + preparationStepUid}
                  >
                    <Typography>{preparationStep.step}</Typography>
                  </Grid>
                </React.Fragment>
              )}
            </React.Fragment>
          );
        })}
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Material  ===========================
// =================================================================== */
interface RecipeMaterialProps {
  recipe: Recipe;
  scaledPortions?: number;
  scaledMaterials?: RecipeObjectStructure<RecipeMaterialPosition>;
}

export const RecipeMaterial = ({
  recipe,
  scaledPortions,
  scaledMaterials,
}: RecipeMaterialProps) => {
  const classes = useCustomStyles();
  if (scaledPortions === 0) {
    scaledPortions = undefined;
  }
  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        style={{display: "block"}}
        gutterBottom
      >
        {TEXT_MATERIAL}
      </Typography>
      <Grid container spacing={1}>
        {scaledPortions && (
          <React.Fragment>
            <Grid
              size={2}
              key={"material_header_grid_original"}
              sx={classes.centerCenter}
            >
              <Typography
                key={"material_header_original"}
                color="textSecondary"
              >
                {TEXT_ORIGINAL}
              </Typography>
            </Grid>
            <Grid
              size={2}
              key={"material_header_grid_scaled"}
              sx={classes.centerCenter}
            >
              <Typography key={"material_header_scaled"} color="textPrimary">
                {TEXT_SCALED}
              </Typography>
            </Grid>
            <Grid
              size={1}
              key={"material_header_grid_unit"}
              sx={classes.centerCenter}
            />
            <Grid
              size={7}
              key={"material_header_grid_name"}
              sx={classes.centerCenter}
            />
          </React.Fragment>
        )}

        {recipe.materials?.order.map((materialUid) => {
          const material = recipe.materials.entries[materialUid];
          return (
            <React.Fragment key={"material_row_" + materialUid}>
              <Grid
                size={2}
                key={"material_quantity_original_grid_" + materialUid}
                sx={classes.centerRight}
              >
                {scaledPortions && material && (
                  // Original Menge
                  <Typography
                    key={"material_quantity_original_" + materialUid}
                    color="textSecondary"
                  >
                    {Number.isNaN(material.quantity) ||
                    material.quantity == 0 ||
                    material.quantity == null ||
                    material.quantity == undefined
                      ? ""
                      : material.quantity.toLocaleString("de-CH")}
                  </Typography>
                )}
              </Grid>
              {/* zu kochende Menge (skaliert/Original)*/}
              <Grid
                size={2}
                key={"material_quantity_grid_" + materialUid}
                sx={classes.centerRight}
              >
                <Typography
                  key={"ingredient_quantity_" + materialUid}
                  color="textPrimary"
                >
                  {scaledPortions &&
                  scaledMaterials &&
                  scaledMaterials[materialUid]?.quantity
                    ? Number.isNaN(scaledMaterials[materialUid].quantity) ||
                      scaledMaterials[materialUid].quantity == 0
                      ? ""
                      : scaledMaterials[materialUid].quantity.toLocaleString(
                          "de-CH",
                        )
                    : Number.isNaN(material?.quantity) ||
                        material?.quantity == 0 ||
                        material?.quantity == null
                      ? ""
                      : material?.quantity.toLocaleString("de-CH")}
                </Typography>
              </Grid>
              <Grid size={1} key={"material_unit_grid_" + materialUid}></Grid>
              <Grid size={7} key={"material_name_grid_" + materialUid}>
                <Typography
                  key={"ingredient_name_" + materialUid}
                  color="textPrimary"
                >
                  {material?.material?.name}
                </Typography>
              </Grid>
            </React.Fragment>
          );
        })}
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ========================== Varianten-Notiz  =======================
// =================================================================== */
interface RecipeVariantNoteProps {
  recipe: Recipe;
}

const RecipeVariantNote = ({recipe}: RecipeVariantNoteProps) => {
  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        style={{display: "block"}}
        gutterBottom
      >
        {TEXT_VARIANT_NOTE}
      </Typography>
      <Grid container spacing={1} alignItems="center">
        <Grid size={12} key={"recipe_variant_note_grid"}>
          <Typography key={"recipe_variant_note"} color="textPrimary">
            {recipe.variantProperties?.note}
          </Typography>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};

export default RecipeView;
