import React from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";

import {
  Stack,
  Backdrop,
  CircularProgress,
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
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  USED_RECIPES_MENUE_SELECTION_DESCRIPTION as TEXT_USED_RECIPES_MENUE_SELECTION_DESCRIPTION,
  WHICH_MENUES_FOR_RECIPE_GENERATION as TEXT_WHICH_MENUES_FOR_RECIPE_GENERATION,
  PLANED_FOR as TEXT_PLANED_FOR,
  FOR_DATIVE as TEXT_FOR_DATIVE,
  SOURCE as TEXT_SOURCE,
  NOTE as TEXT_NOTE,
  VARIANT_NOTE as TEXT_VARIANT_NOTE,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  QUANTITY_CALCULATION as TEXT_QUANTITY_CALCULATION,
  NAME as TEXT_NAME,
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_LIST_A_NAME as TEXT_GIVE_THE_NEW_LIST_A_NAME,
  PLANED_RECIPES as TEXT_PLANED_RECIPES,
  LIST_ENTRY_MAYBE_OUT_OF_DATE as TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE,
  LIST as TEXT_LIST,
  ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND,
} from "../../../constants/text";
import {ImageRepository} from "../../../constants/imageRepository";

import useCustomStyles from "../../../constants/styles";

import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Event from "../Event/event.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {Snackbar} from "../../Shared/customSnackbar";
import AlertMessage from "../../Shared/AlertMessage";
import {
  DialogSelectMenues,
  DialogSelectMenuesForRecipeDialogValues,
} from "../Menuplan/dialogSelectMenues";
import {
  MealRecipe,
  Menue,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals, sortSelectedMenues} from "../Menuplan/menuplanService";
import {generatePlanedPortionsText} from "../Menuplan/menuplan";
import UsedRecipes, {UsedRecipeListEntry} from "./usedRecipes.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import Recipe, {RecipeType} from "../../Recipe/recipe.class";
import Utils from "../../Shared/utils.class";
import {FormListItem} from "../../Shared/formListItem";
import {
  RecipeIngredients,
  RecipeMaterial,
  RecipePreparation,
} from "../../Recipe/recipe.view";
import UsedRecipesPdf from "./usedRecipesPdf";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import Action from "../../../constants/actions";
import Product from "../../Product/product.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";
import {EventListCard, OperationType} from "../Event/eventSharedComponents";
import Unit from "../../Unit/unit.class";

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
enum ReducerActions {
  SHOW_LOADING,
  SET_SELECTED_LIST_ITEM,
  GENERIC_ERROR,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}
type State = {
  selectedListItem: string | null;
  sortedMenueList: MenueCoordinates[];
  isLoading: boolean;
  error: Error | null;
  snackbar: Snackbar;
};
type DispatchAction = {
  type: ReducerActions;
  payload: {[key: string]: any};
};
const inititialState: State = {
  selectedListItem: null,
  sortedMenueList: [],
  isLoading: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};
const usedRecipesReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SHOW_LOADING:
      return {
        ...state,
        error: null,
        isLoading: action.payload.isLoading,
      };
    case ReducerActions.SET_SELECTED_LIST_ITEM:
      return {
        ...state,
        selectedListItem: action.payload.uid,
        sortedMenueList: action.payload.sortedMenueList,
      };

    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload as Error,
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        snackbar: {
          severity: action.payload.severity,
          message: action.payload.message,
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
  }
};

const DIALOG_SELECT_MENUE_DATA_INITIAL_DATA = {
  open: false,
  menues: {} as DialogSelectMenuesForRecipeDialogValues,
  selectedListUid: "",
  operationType: OperationType.none,
};

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
interface EventUsedRecipesPageProps {
  firebase: Firebase;
  authUser: AuthUser;
  event: Event;
  groupConfiguration: EventGroupConfiguration;
  menuplan: MenuplanData;
  usedRecipes: UsedRecipes;
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onUsedRecipesUpdate: (usedRecipes: UsedRecipes) => void;
}
const EventUsedRecipesPage = ({
  firebase,
  authUser,
  event,
  groupConfiguration,
  menuplan,
  usedRecipes,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
  fetchMissingData,
  onUsedRecipesUpdate,
}: EventUsedRecipesPageProps) => {
  const classes = useCustomStyles();

  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(
    usedRecipesReducer,
    inititialState,
  );
  const [dialogSelectMenueData, setDialogSelectMenueData] = React.useState(
    DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
  );
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.usedRecipes,
    });
  }, []);

  React.useEffect(() => {
    if (products.length == 0) {
      fetchMissingData({type: FetchMissingDataType.PRODUCTS});
    }
    if (!unitConversionBasic || !unitConversionProducts) {
      fetchMissingData({type: FetchMissingDataType.UNIT_CONVERSION});
    }
    if (!units || units.length == 0) {
      fetchMissingData({type: FetchMissingDataType.UNITS});
    }
  }, []);

  /* ------------------------------------------
  // Dialog-Handling
  // ------------------------------------------ */
  const onCreateList = () => {
    setDialogSelectMenueData({
      ...dialogSelectMenueData,
      open: true,
      operationType: OperationType.Create,
    });
  };
  const onCloseDialogSelectMenues = () => {
    setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
  };
  const onConfirmDialogSelectMenues = async (
    selectedMenues: DialogSelectMenuesForRecipeDialogValues,
  ) => {
    setDialogSelectMenueData({...dialogSelectMenueData, open: false});

    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: TEXT_NEW_LIST,
      text: TEXT_GIVE_THE_NEW_LIST_A_NAME,
      singleTextInputProperties: {
        initialValue:
          dialogSelectMenueData.operationType === OperationType.Update
            ? usedRecipes.lists[dialogSelectMenueData.selectedListUid]
                .properties.name
            : "",
        textInputLabel: TEXT_NAME,
      },
    })) as SingleTextInputResult;

    if (userInput.valid) {
      // Wait anzeigen
      dispatch({type: ReducerActions.SHOW_LOADING, payload: {isLoading: true}});

      if (dialogSelectMenueData.operationType === OperationType.Create) {
        // Rezepte holen und berechnen
        UsedRecipes.createNewList({
          name: userInput.input,
          selectedMenues: Object.keys(selectedMenues),
          menueplan: menuplan,
          firebase: firebase,
          authUser: authUser,
        })
          .then((result) => {
            const newUsedRecipes = {...usedRecipes};
            newUsedRecipes.lists[result.properties.uid] = result;
            newUsedRecipes.noOfLists++;
            newUsedRecipes.uid = event.uid;

            onUsedRecipesUpdate(newUsedRecipes);

            dispatch({
              type: ReducerActions.SHOW_LOADING,
              payload: {isLoading: false},
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      } else if (dialogSelectMenueData.operationType === OperationType.Update) {
        onRefreshLists(userInput.input, Object.keys(selectedMenues));
      }
    } else {
      // Abbruch wieder das andere anzeigen
      setDialogSelectMenueData({
        ...dialogSelectMenueData,
        menues: selectedMenues,
        open: true,
      });
    }
  };
  /* ------------------------------------------
  // List-Handling
  // ------------------------------------------ */
  const onRefreshLists = (
    newName?: string,
    selectedMenues?: Menue["uid"][],
  ) => {
    // Alle Liste aktualisieren
    dispatch({type: ReducerActions.SHOW_LOADING, payload: {isLoading: true}});
    const usedRecipesToRefresh = {...usedRecipes};

    if (dialogSelectMenueData.operationType === OperationType.Update) {
      // Namen übernehmen
      usedRecipesToRefresh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.name = newName!;

      usedRecipesToRefresh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.selectedMenues = selectedMenues!;
      usedRecipesToRefresh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.selectedMeals = getMealsOfMenues({
        menuplan: menuplan,
        menues: selectedMenues!,
      });
      setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
    }

    // Rezepte holen und berechnen
    UsedRecipes.refreshLists({
      usedRecipes: usedRecipesToRefresh,
      menueplan: menuplan,
      firebase: firebase,
      authUser: authUser,
    })
      .then((result) => {
        onUsedRecipesUpdate(result);

        dispatch({
          type: ReducerActions.SHOW_LOADING,
          payload: {isLoading: false},
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };

  const onListElementSelect = async (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ) => {
    // Menües in der richtigen Reihenfolge aufbauen, damit diese dann auch richtig angezeigt werden

    const selectedListItem = event.currentTarget.id.split("_")[1];
    dispatch({
      type: ReducerActions.SET_SELECTED_LIST_ITEM,
      payload: {
        uid: selectedListItem,
        sortedMenueList: sortSelectedMenues({
          menueList:
            usedRecipes.lists[selectedListItem!].properties.selectedMenues,
          menuplan: menuplan,
        }),
      },
    });
  };
  const onListElementDelete = (event: React.MouseEvent<HTMLElement>) => {
    const selectedList = event.currentTarget.id.split("_")[1];
    if (!selectedList) {
      return;
    }

    const updatedUsedRecipes = UsedRecipes.deleteList({
      usedRecipes: usedRecipes,
      listUidToDelete: selectedList,
      authUser: authUser,
    });
    onUsedRecipesUpdate(updatedUsedRecipes);

    dispatch({
      type: ReducerActions.SET_SELECTED_LIST_ITEM,
      payload: {
        uid: "",
        sortedMenueList: [],
      },
    });
  };
  const onListElementEdit = async (event: React.MouseEvent<HTMLElement>) => {
    const selectedListUid = event.currentTarget.id.split("_")[1];
    if (!selectedListUid) {
      return;
    }
    const selectedMenuesForDialog: DialogSelectMenuesForRecipeDialogValues = {};
    console.log("hier");
    let selectedMenues =
      usedRecipes.lists[selectedListUid].properties.selectedMenues;

    // Prüfen ob die Menüs immer noch gleich sind
    if (
      !Utils.areStringArraysEqual(
        usedRecipes.lists[selectedListUid].properties.selectedMeals,
        getMealsOfMenues({
          menuplan: menuplan,
          menues: usedRecipes.lists[selectedListUid].properties.selectedMenues,
        }),
      ) ||
      // Sind neue Menü dazugekommen/ oder wurden Menüs aus der
      // Auswahl entfernt
      usedRecipes.lists[selectedListUid].properties.selectedMenues.length !==
        getMenuesOfMeals({
          menuplan: menuplan,
          meals: usedRecipes.lists[selectedListUid].properties.selectedMeals,
        }).length
    ) {
      selectedMenues = getMenuesOfMeals({
        menuplan: menuplan,
        meals: usedRecipes.lists[selectedListUid].properties.selectedMeals,
      });
    }

    // Menues der Mahlzeiten holen und Objekt umwandeln
    // getMealsOfMenues({
    //   menuplan: menuplan,
    //   menues: usedRecipes.lists[selectedListUid].properties.selectedMeals,
    // }).forEach((menueUid) => (selectedMenues[menueUid] = true));

    selectedMenues.forEach(
      (menueUid) => (selectedMenuesForDialog[menueUid] = true),
    );
    setDialogSelectMenueData({
      menues: selectedMenuesForDialog,
      open: true,
      selectedListUid: selectedListUid,
      operationType: OperationType.Update,
    });
  };
  /* ------------------------------------------
  // PDF erzeugen
  // ------------------------------------------ */
  const onGeneratePrintVersion = () => {
    if (
      Object.keys(usedRecipes.lists[state.selectedListItem!].recipes).length ===
      0
    ) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error(TEXT_ERROR_NO_RECIPES_FOUND),
      });
      return;
    }

    pdf(
      <UsedRecipesPdf
        list={usedRecipes.lists[state.selectedListItem!]}
        sortedMenueList={state.sortedMenueList}
        menueplan={menuplan}
        eventName={event.name}
        products={products}
        units={units}
        unitConversionBasic={unitConversionBasic}
        unitConversionProducts={unitConversionProducts}
        authUser={authUser}
      />,
    )
      .toBlob()
      .then((result) => {
        fileSaver.saveAs(
          result,
          event.name + " " + TEXT_QUANTITY_CALCULATION + TEXT_SUFFIX_PDF,
        );
      });
  };
  return (
    <Stack spacing={2}>
      {state.error && (
        <AlertMessage
          error={state.error}
          messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
        />
      )}

      <Backdrop sx={classes.backdrop} open={state.isLoading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <EventListCard
        cardTitle={TEXT_PLANED_RECIPES}
        cardDescription={TEXT_USED_RECIPES_MENUE_SELECTION_DESCRIPTION}
        outOfDateWarnMessage={TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE(TEXT_LIST)}
        selectedListItem={state.selectedListItem}
        lists={usedRecipes.lists}
        noOfLists={usedRecipes.noOfLists}
        menuplan={menuplan}
        onCreateList={onCreateList}
        onListElementSelect={onListElementSelect}
        onListElementDelete={onListElementDelete}
        onListElementEdit={onListElementEdit}
        onRefreshLists={onRefreshLists}
        onGeneratePrintVersion={onGeneratePrintVersion}
      />
      {state.selectedListItem && (
        <EventUsedRecipes
          sortedMenueList={state.sortedMenueList}
          usedRecipes={usedRecipes.lists[state.selectedListItem].recipes}
          menuplan={menuplan}
          groupConfiguration={groupConfiguration}
          products={products}
          units={units}
          unitConversionBasic={unitConversionBasic}
          unitConversionProducts={unitConversionProducts}
        />
      )}
      <DialogSelectMenues
        open={dialogSelectMenueData.open}
        title={TEXT_WHICH_MENUES_FOR_RECIPE_GENERATION}
        dates={menuplan.dates}
        preSelectedMenue={dialogSelectMenueData.menues}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        showSelectAll={true}
        onClose={onCloseDialogSelectMenues}
        onConfirm={onConfirmDialogSelectMenues}
      />
    </Stack>
  );
};

/* ===================================================================
// ======================== Rezepte-Übersicht ========================
// =================================================================== */
interface EventUsedRecipesProps {
  sortedMenueList: MenueCoordinates[];
  usedRecipes: UsedRecipeListEntry["recipes"];
  menuplan: MenuplanData;
  groupConfiguration: EventGroupConfiguration;
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
}
const EventUsedRecipes = ({
  sortedMenueList,
  usedRecipes,
  menuplan,
  groupConfiguration,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
}: EventUsedRecipesProps) => {
  const theme = useTheme();

  return (
    <Container style={{marginTop: theme.spacing(2)}}>
      <Box component="div" sx={{justifyContent: "center", display: "flex"}}>
        <Stack spacing={2}>
          {sortedMenueList.map((menueCoordinate) => {
            return menuplan.menues[
              menueCoordinate.menueUid
            ].mealRecipeOrder.map(
              (mealRecipeUid) =>
                !menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid.includes(
                  "[DELETED]",
                ) &&
                usedRecipes[
                  menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid
                ] && (
                  <EventUsedMealRecipe
                    recipe={
                      usedRecipes[
                        menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid
                      ]
                    }
                    mealRecipe={menuplan.mealRecipes[mealRecipeUid]}
                    menueCoordinate={menueCoordinate}
                    groupConfiguration={groupConfiguration}
                    products={products}
                    units={units}
                    unitConversionBasic={unitConversionBasic}
                    unitConversionProducts={unitConversionProducts}
                    key={"eventUsedRecipe_" + mealRecipeUid}
                  />
                ),
            );
          })}
        </Stack>
      </Box>
    </Container>
  );
};
/* ===================================================================
// ======================== Einzelnes Rezept =========================
// =================================================================== */
interface EventUsedMealRecipeProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
  menueCoordinate: MenueCoordinates;
  groupConfiguration: EventGroupConfiguration;
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
}
const EventUsedMealRecipe = ({
  recipe,
  mealRecipe,
  menueCoordinate,
  groupConfiguration,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
}: EventUsedMealRecipeProps) => {
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
            products={products}
            units={units}
            unitConversionBasic={unitConversionBasic}
            unitConversionProducts={unitConversionProducts}
          />
        </Grid>
        {/* Zubereitung */}
        <Grid
          size={{xs: 12, sm: 6}}
          style={{marginTop: "2em", marginBottom: "2em"}}
          key={"recipeGridPreparations_" + mealRecipe.uid}
        >
          <EventUsedMealRecipePreparationStepsBlock recipe={recipe} />
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
};
/* ===================================================================
// =========================  Rezept Title ===========================
// =================================================================== */
interface EventUsedMealRecipeTitleProps {
  recipe: Recipe;
  menueCoordinate: MenueCoordinates;
}
const EventUsedMealRecipeTitle = ({
  recipe,
  menueCoordinate,
}: EventUsedMealRecipeTitleProps) => {
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
};
/* ===================================================================
// =========================  Rezept Info ============================
// =================================================================== */
interface EventUsedMealRecipeInfoBlockProps {
  recipe: Recipe;
  menueCoordinate: MenueCoordinates;
  mealRecipe: MealRecipe;
  groupConfiguration: EventGroupConfiguration;
}
const EventUsedMealRecipeInfoBlock = ({
  recipe,
  mealRecipe,
  groupConfiguration,
}: EventUsedMealRecipeInfoBlockProps) => {
  return (
    <Grid size={12} key={"recipeInfoBlockTime" + mealRecipe.uid}>
      <Container maxWidth="sm">
        <List dense>
          <FormListItem
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
          <FormListItem
            id={"plan"}
            value={generatePlanedPortionsText({
              uid: mealRecipe.uid,
              portionPlan: mealRecipe.plan,
              groupConfiguration: groupConfiguration,
            })}
            label={TEXT_PLANED_FOR}
          />
          {recipe.note && (
            <FormListItem id={"plan"} value={recipe.note} label={TEXT_NOTE} />
          )}
          {recipe.type == RecipeType.variant &&
            recipe.variantProperties?.note && (
              <FormListItem
                id={"plan"}
                value={recipe.variantProperties?.note}
                label={TEXT_VARIANT_NOTE}
              />
            )}
        </List>
      </Container>
    </Grid>
  );
};
/* ===================================================================
// =======================  Rezept Zutaten ===========================
// =================================================================== */
interface EventUsedMealRecipeIngredientBlockProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
  products: Product[];
  units: Unit[] | null;
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
}
const EventUsedMealRecipeIngredientBlock = ({
  recipe,
  mealRecipe,
  products,
  units,
  unitConversionBasic,
  unitConversionProducts,
}: EventUsedMealRecipeIngredientBlockProps) => {
  const scaledIngredients = Recipe.scaleIngredients({
    recipe: recipe,
    portionsToScale: mealRecipe.totalPortions,
    scalingOptions: {convertUnits: true}, // Hier fix WAHR
    products: products,
    units: units,
    unitConversionBasic: unitConversionBasic,
    unitConversionProducts: unitConversionProducts,
  });

  return (
    <RecipeIngredients
      recipe={recipe}
      scaledIngredients={scaledIngredients}
      scaledPortions={mealRecipe.totalPortions}
    />
  );
};
/* ===================================================================
// =======================  Rezept Zutaten ===========================
// =================================================================== */
interface EventUsedMealRecipePreparationStepsBlockProps {
  recipe: Recipe;
}
const EventUsedMealRecipePreparationStepsBlock = ({
  recipe,
}: EventUsedMealRecipePreparationStepsBlockProps) => {
  return <RecipePreparation recipe={recipe} />;
};

/* ===================================================================
// =======================  Rezept Zutaten ===========================
// =================================================================== */
interface EventUsedMealRecipeMaterialBlockProps {
  recipe: Recipe;
  mealRecipe: MealRecipe;
}
const EventUsedMealRecipeMaterialBlock = ({
  recipe,
  mealRecipe,
}: EventUsedMealRecipeMaterialBlockProps) => {
  const scaledMaterials = Recipe.scaleMaterials({
    recipe: recipe,
    portionsToScale: mealRecipe.totalPortions,
  });

  return (
    <RecipeMaterial
      recipe={recipe}
      scaledMaterials={scaledMaterials}
      scaledPortions={mealRecipe.totalPortions}
    />
  );
};

export default EventUsedRecipesPage;
