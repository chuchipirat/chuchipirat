/**
 * Seitenkomponente für die «Geplante Rezepte»-Ansicht eines Events.
 *
 * Delegiert State-Management und Handler an `useUsedRecipesHandlers`,
 * Rezept-Rendering an `EventUsedRecipes` und die Menü-Auswahl an
 * `DialogSelectMenues`. Diese Komponente ist nur noch für Layout und
 * Komposition zuständig.
 *
 * @param props - Event-Daten, Menüplan und Callbacks
 */
import React from "react";

import {Stack, Backdrop, CircularProgress} from "@mui/material";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  USED_RECIPES_MENUE_SELECTION_DESCRIPTION as TEXT_USED_RECIPES_MENUE_SELECTION_DESCRIPTION,
  WHICH_MENUES_FOR_RECIPE_GENERATION as TEXT_WHICH_MENUES_FOR_RECIPE_GENERATION,
  PLANED_RECIPES as TEXT_PLANED_RECIPES,
  LIST_ENTRY_MAYBE_OUT_OF_DATE as TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE,
  LIST as TEXT_LIST,
} from "../../../constants/text";

import {useCustomStyles} from "../../../constants/styles";

import AuthUser from "../../Firebase/Authentication/authUser.class";
import {Event} from "../Event/event.class";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {AlertMessage} from "../../Shared/AlertMessage";
import {DialogSelectMenues} from "../Menuplan/dialogSelectMenues";
import {MenuplanData} from "../Menuplan/menuplan.types";
import {UsedRecipes} from "./usedRecipes.class";
import {FetchMissingDataProps} from "../Event/event";
import {EventListCard} from "../Event/eventSharedComponents";
import {useUsedRecipesHandlers} from "./useUsedRecipesHandlers";
import {EventUsedRecipes} from "./eventUsedRecipes";

interface EventUsedRecipesPageProps {
  authUser: AuthUser;
  event: Event;
  groupConfiguration: EventGroupConfiguration;
  menuplan: MenuplanData;
  usedRecipes: UsedRecipes;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onUsedRecipesUpdate: (usedRecipes: UsedRecipes) => void;
}

const EventUsedRecipesPage = ({
  authUser,
  event,
  groupConfiguration,
  menuplan,
  usedRecipes,
  fetchMissingData,
  onUsedRecipesUpdate,
}: EventUsedRecipesPageProps) => {
  const classes = useCustomStyles();

  const {state, dialogSelectMenueData, handlers} = useUsedRecipesHandlers({
    authUser,
    event,
    menuplan,
    usedRecipes,
    fetchMissingData,
    onUsedRecipesUpdate,
  });

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
        onCreateList={handlers.onCreateList}
        onListElementSelect={handlers.onListElementSelect}
        onListElementDelete={handlers.onListElementDelete}
        onListElementEdit={handlers.onListElementEdit}
        onRefreshLists={handlers.onRefreshLists}
        onGeneratePrintVersion={handlers.onGeneratePrintVersion}
      />
      {state.selectedListItem && (
        <EventUsedRecipes
          sortedMenueList={state.sortedMenueList}
          usedRecipes={state.loadedRecipes}
          menuplan={menuplan}
          groupConfiguration={groupConfiguration}
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
        onClose={handlers.onCloseDialogSelectMenues}
        onConfirm={handlers.onConfirmDialogSelectMenues}
      />
    </Stack>
  );
};

export {EventUsedRecipesPage};
