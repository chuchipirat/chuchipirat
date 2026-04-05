import React, {useState, useEffect, useContext, useRef} from "react";
import * as Sentry from "@sentry/react";

import {Box, useTheme, useMediaQuery} from "@mui/material";

import {Utils} from "../../Shared/utils.class";
import {Action} from "../../../constants/actions";

import {useCustomDialog} from "../../Shared/customDialogContext";
import {
  DialogSelectMenues,
} from "./dialogSelectMenues";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import {DialogSelectMeals} from "./dialogSelectMeals";
import {MenuplanHeaderRow} from "./menuplan.headerRow";
import {MealTypeRows} from "./menuplan.mealTypeRows";
import {RecipeSearchDrawer} from "./menuplan.recipeSearchDrawer";
import {DialogPlanPortions} from "./dialogPlanPortions";
import {DialogEditMenue} from "./dialogEditMenue";
import {DialogGoods} from "./dialogGoods";
import {DialogMenuplanPdfOptions} from "./dialogMenuplanPdfOptions";

import {MenuplanSettings} from "./menuplan.constants";
import type {MenuplanPageProps} from "./menuplan.page.types";
import {
  DIALOG_CHOOSE_MENUES_TITLE as TEXT_DIALOG_CHOOSE_MENUES_TITLE,
  DIALOG_CHOOSE_MEALS_TITLE as TEXT_DIALOG_CHOOSE_MEALS_TITLE,
} from "../../../constants/text";

// Barrel re-exports für Abwärtskompatibilität externer Consumer
export {MenuplanDragDropTypes, blockBoardPanningAttr, generatePlanedPortionsText} from "./menuplan.constants";
export type {MenuplanSettings, DragAndDropDirections, OnMoveDragAndDropElementFx, OnNoteUpdate} from "./menuplan.constants";
export type {DialogPlanPortionsPlanningInfo} from "./menuplan.page.types";

import {RecipeDrawer} from "../../Recipe/RecipeDrawer";
import {useMenuplanDialogs} from "./useMenuplanDialogs";
import {useMenuplanDragDrop} from "./useMenuplanDragDrop";
import {useMenuplanHandlers} from "./useMenuplanHandlers";
const MenuplanPage = ({
  menuplan,
  groupConfiguration,
  event,
  recipes,
  recipeList,
  firebase,
  authUser,
  units,
  products,
  materials,
  departments,
  onMenuplanUpdate: onMenuplanUpdateSuper,
  onRecipeUpdate: onRecipeUpdateSuper,
  fetchMissingData,
  onMasterdataCreate,
}: MenuplanPageProps) => {
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  const navigationValuesContext = useContext(NavigationValuesContext);

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const userDidChangeDnD = useRef(false);

  const [menuplanSettings, setMenuPlanSettings] = useState<MenuplanSettings>({
    showDetails: false,
    enableDragAndDrop: false,
  });

  const dialogs = useMenuplanDialogs();
  const {
    recipeSearchDrawerData,
    recipeSearchResetKey,
    recipeDrawerData,
    setRecipeSearchDrawerData,
    setRecipeDrawerData,
    dialogSelectMenueData,
    setDialogSelectMenueData: _setDialogSelectMenueData,
    dialogSelectMealData,
    dialogPlanPortionsData,
    dialogEditMenue,
    dialogGoodsData,
    dialogPdfOptionsData,
  } = dialogs;

  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToToday = useRef(false);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.menueplan,
    });
    // Bewusst nur beim Mount setzen — Navigation-Kontext ändert sich nicht
  }, []);
  /* ------------------------------------------
  // Auto-Scroll zum heutigen Tag
  // ------------------------------------------ */
  useEffect(() => {
    if (hasScrolledToToday.current) return;
    if (!headerScrollRef.current || !scrollableRef.current || menuplan.dates.length === 0) return;

    const today = Utils.dateAsString(new Date());
    const todayColumn = headerScrollRef.current.querySelector(
      `[data-date="${today}"]`
    );

    if (todayColumn) {
      hasScrolledToToday.current = true;
      requestAnimationFrame(() => {
        const columnEl = todayColumn as HTMLElement;
        const scrollTarget = columnEl.offsetLeft - parseInt(theme.spacing(4));
        scrollableRef.current!.scrollTo({
          left: scrollTarget,
          behavior: "smooth",
        });
        headerScrollRef.current!.scrollTo({
          left: scrollTarget,
          behavior: "smooth",
        });
      });
    }
  }, [menuplan.dates]);
  /* ------------------------------------------
  // Initiale-Einstellungen vornehmen
  // ------------------------------------------ */
  if (recipeSearchDrawerData.isLoadingData && recipeList.length > 0) {
    // Loading-Anzeige der Rezepte wieder abstellen
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      isLoadingData: false,
    });
  }
  if (recipeDrawerData.isLoadingData) {
    if (!recipeDrawerData.recipe.name) {
      // Aktualisierte Werte setzen // es wurden erst die Infos aus der
      // RecipeShort gesetzt. Diese mal anzeigen
      setRecipeDrawerData({
        ...recipeDrawerData,
        isLoadingData:
          recipes[recipeDrawerData.recipe.uid].portions > 0 ? false : true,
        recipe: recipes[recipeDrawerData.recipe.uid],
      });
    } else if (
      recipeDrawerData.recipe?.portions == 0 &&
      recipes[recipeDrawerData.recipe.uid]?.portions > 0
    ) {
      // Nun ist alles da. Loading-Kreis ausblenden
      setRecipeDrawerData({
        ...recipeDrawerData,
        isLoadingData: false,
        recipe: recipes[recipeDrawerData.recipe.uid],
      });
    }
  }

  useEffect(() => {
    if (userDidChangeDnD.current) {
      // Wenn der User üebrsteuert hat, machen wir nichts mehr
      return;
    }
    setMenuPlanSettings((prev) => ({
      ...prev,
      enableDragAndDrop: !isMobile,
    }));
  }, [isMobile]);

  const {onDragAndDropUpdate, onMoveDragAndDropElement} = useMenuplanDragDrop({
    menuplan,
    scrollableRef,
    onMenuplanUpdateSuper,
    setDialogSelectMenueData: dialogs.setDialogSelectMenueData,
    setDialogSelectMealData: dialogs.setDialogSelectMealData,
  });

  const handlers = useMenuplanHandlers({
    menuplan,
    groupConfiguration,
    event,
    recipes,
    recipeList,
    firebase,
    authUser,
    units,
    products,
    materials,
    departments,
    menuplanSettings,
    setMenuPlanSettings,
    onMenuplanUpdateSuper,
    onRecipeUpdateSuper,
    fetchMissingData,
    onMasterdataCreate,
    customDialog,
    dialogs,
    userDidChangeDnD,
  });

  if (
    new Set(menuplan.mealTypes.order).size !== menuplan.mealTypes.order.length
  ) {
    Sentry.captureMessage("Doppelte MealTypes im Menüplan", {
      level: "warning",
      extra: {mealTypesOrder: menuplan.mealTypes.order},
    });
  }
  return (
    <React.Fragment key={"test"}>
      {/* Sticky header — scrolls horizontally via JS sync */}
      <Box
        ref={headerScrollRef}
        sx={{
          position: "sticky",
          top: "64px",
          zIndex: 1000,
          background: theme.palette.background.default,
          overflowX: "hidden",
          paddingX: theme.spacing(4),
        }}
      >
        <MenuplanHeaderRow
          dates={menuplan.dates}
          notes={menuplan.notes}
          menuplanSettings={menuplanSettings}
          onSwitchShowDetails={handlers.onSwitchShowDetails}
          onSwitchEnableDragAndDrop={handlers.onSwitchEnableDragAndDrop}
          onMealTypeUpdate={handlers.onMealTypeUpdate}
          onNoteUpdate={handlers.onNoteUpdate}
          onPrint={handlers.onPrint}
        />
      </Box>
      {/* Horizontally scrollable content */}
      <Box
        component={"div"}
        key={"container_menuplan_rows"}
        style={{
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingLeft: theme.spacing(4),
          paddingRight: theme.spacing(4),
        }}
        ref={scrollableRef}
        onScroll={() => {
          if (headerScrollRef.current && scrollableRef.current) {
            headerScrollRef.current.scrollLeft =
              scrollableRef.current.scrollLeft;
          }
        }}
      >
        <MealTypeRows
          mealTypes={menuplan.mealTypes}
          dates={menuplan.dates}
          meals={menuplan.meals}
          menues={menuplan.menues}
          notes={menuplan.notes}
          products={menuplan.products}
          materials={menuplan.materials}
          mealRecipes={menuplan.mealRecipes}
          menuplanSettings={menuplanSettings}
          groupConfiguration={groupConfiguration}
          onMealTypeUpdate={handlers.onMealTypeUpdate}
          onMenuplanUpdate={handlers.onMenuplanUpdate}
          onAddRecipe={handlers.onAddRecipe}
          onAddProduct={handlers.onAddProduct}
          onAddMaterial={handlers.onAddMaterial}
          onEditMenue={handlers.onEditMenue}
          onMealRecipeOpen={handlers.onMealRecipeOpen}
          onEditMaterialPlan={handlers.onEditMaterialPlan}
          onEditProductPlan={handlers.onEditProductPlan}
          onNoteUpdate={handlers.onNoteUpdate}
          onDragAndDropUpdate={onDragAndDropUpdate}
          onMoveDragAndDropElement={onMoveDragAndDropElement}
        />
      </Box>
      {/* Rezept-Übersicht Drawer */}
      <RecipeSearchDrawer
        drawerSettings={recipeSearchDrawerData}
        recipes={recipeList}
        onClose={handlers.onRecipeSearchDrawerClose}
        onRecipeCardClick={handlers.onRecipeCardClick}
        onRecipeSelection={handlers.onRecipeSelection}
        onNewRecipe={handlers.onNewRecipe}
        authUser={authUser}
        searchResetKey={recipeSearchResetKey}
      />
      {/* Rezept-Drawer */}
      <RecipeDrawer
        drawerSettings={recipeDrawerData}
        recipe={recipeDrawerData.recipe}
        mealPlan={recipeDrawerData.mealPlan}
        groupConfiguration={groupConfiguration}
        scaledPortions={recipeDrawerData.scaledPortions}
        editMode={recipeDrawerData.editMode}
        firebase={firebase}
        authUser={authUser}
        onClose={handlers.onRecipeDrawerClose}
        onAddToEvent={handlers.onRecipeSelection}
        onEditRecipeMealPlan={handlers.onEditRecipeMealPlan}
        onRecipeUpdate={handlers.onRecipeUpdate}
        onSwitchEditMode={handlers.onRecipeSwitchEditMode}
        onRecipeDelete={handlers.onRecipeDelete}
      />
      {/* Dialog Menüwahl */}
      <DialogSelectMenues
        open={dialogSelectMenueData.open}
        title={TEXT_DIALOG_CHOOSE_MENUES_TITLE}
        dates={menuplan.dates}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        preSelectedMenue={dialogSelectMenueData.menues}
        onClose={handlers.onDialogSelectMenueClose}
        onConfirm={handlers.onDialogSelectMenueContinue}
        singleSelection={dialogSelectMenueData.singleSelection}
      />
      {/* Dialog Mahlzeit-Auswahl */}
      <DialogSelectMeals
        open={dialogSelectMealData.open}
        title={TEXT_DIALOG_CHOOSE_MEALS_TITLE}
        dates={menuplan.dates}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        onClose={handlers.onDialogSelectMealClose}
        onConfirm={handlers.onDialogSelectMealConfirm}
      />
      {/* Dialog Portionenauswahl */}
      <DialogPlanPortions
        open={dialogPlanPortionsData.open}
        selectedMenues={dialogPlanPortionsData.menues}
        meals={menuplan.meals}
        menues={menuplan.menues}
        mealTypes={menuplan.mealTypes}
        groupConfiguration={groupConfiguration}
        planedMealRecipe={dialogPlanPortionsData.portionPlan}
        planedObject={dialogPlanPortionsData.planedObject}
        onBackClick={handlers.onDialogPlanPortionsBack}
        onCancelClick={handlers.onDialogPlanPortionsClose}
        onAddClick={handlers.onDialogPlanPortionsAdd}
      />
      {/* Dialog Menüeinträge ändern */}
      <DialogEditMenue
        open={dialogEditMenue.open}
        menue={menuplan.menues[dialogEditMenue.menueUid]}
        note={Object.values(menuplan.notes).find(
          (note) => note.menueUid == dialogEditMenue.menueUid,
        )}
        mealRecipes={menuplan.mealRecipes}
        products={menuplan.products}
        materials={menuplan.materials}
        groupConfiguration={groupConfiguration}
        onCloseDialog={handlers.onCloseDialogEditMenue}
        onEditObject={handlers.onEditMenueEditObject}
        onDeleteObject={handlers.onEditMenueDeleteObject}
      />
      <DialogGoods
        open={dialogGoodsData.open}
        goodsType={dialogGoodsData.goodsType}
        units={units}
        products={products}
        materials={materials}
        departments={departments}
        productToUpdate={dialogGoodsData.product}
        materialToUpdate={dialogGoodsData.material}
        authUser={authUser}
        onCancel={handlers.onDialogGoodsCancel}
        onOk={handlers.onDialogGoodsOk}
        onMaterialCreate={handlers.onMaterialCreate}
        onProductCreate={handlers.onProductCreate}
      />
      {/* Dialog PDF-Exportoptionen */}
      <DialogMenuplanPdfOptions
        open={dialogPdfOptionsData.open}
        onConfirm={handlers.onPrintConfirm}
        onCancel={handlers.onPrintCancel}
      />
    </React.Fragment>
  );
};

export {MenuplanPage};
