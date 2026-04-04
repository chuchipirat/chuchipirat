/**
 * Dialog zum Bearbeiten eines Menüs im Menüplan.
 *
 * Zeigt die Inhalte eines Menüs (Notiz, Rezepte, Produkte, Material) an und
 * ermöglicht das Bearbeiten und Löschen einzelner Einträge.
 *
 * Extrahiert aus `menuplan.tsx`.
 */
import React from "react";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ListSubheader from "@mui/material/ListSubheader";
import ListItemText from "@mui/material/ListItemText";
import {useTheme} from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Delete";
import {Edit} from "@mui/icons-material";

import {
  Menue,
  Note,
  GoodsPlanMode,
  MenuplanData,
} from "./menuplan.types";
import {
  MenueEditTypes,
  EditMenueObjectManipulation,
  generatePlanedPortionsText,
} from "./menuplan.constants";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {
  RECIPES as TEXT_RECIPES,
  PRODUCTS as TEXT_PRODUCTS,
  MATERIAL as TEXT_MATERIAL,
  VARIANT as TEXT_VARIANT,
  CLOSE as TEXT_CLOSE,
  PER_PORTION as TEXT_PER_PORTION,
} from "../../../constants/text";

interface DialogEditMenueProps {
  open: boolean;
  menue: Menue;
  note: Note | undefined;
  mealRecipes: MenuplanData["mealRecipes"];
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  groupConfiguration: EventGroupConfiguration;
  onCloseDialog: () => void;
  onEditObject: ({objectType, uid}: EditMenueObjectManipulation) => void;
  onDeleteObject: ({objectType, uid}: EditMenueObjectManipulation) => void;
}
export const DialogEditMenue = ({
  open,
  menue,
  note,
  mealRecipes,
  products,
  materials,
  groupConfiguration,
  onCloseDialog,
  onEditObject,
  onDeleteObject,
}: DialogEditMenueProps) => {
  const theme = useTheme();

  return (
    <React.Fragment>
      <Dialog open={open} maxWidth="sm" onClose={onCloseDialog} fullWidth>
        {menue?.name && <DialogTitle>{menue.name}</DialogTitle>}
        <DialogContent>
          {/* Notiz  */}
          {note && (
            <List dense>
              <ListItem>
                <ListItemText primary={note.text} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() =>
                      onDeleteObject({
                        objectType: MenueEditTypes.NOTE,
                        uid: note.uid,
                      })
                    }
                    size="large"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          )}
          {menue?.mealRecipeOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_RECIPES}</ListSubheader>
              }
            >
              {menue.mealRecipeOrder.map((mealRecipeUid) => (
                <ListItem key={"listItemMealRecipe_" + mealRecipeUid}>
                  <ListItemText
                    primary={
                      <span>
                        {mealRecipes[mealRecipeUid]?.recipe.name}
                        <span
                          style={{
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {mealRecipes[mealRecipeUid]?.recipe.type ===
                          RecipeType.variant
                            ? ` [${TEXT_VARIANT}: ${mealRecipes[mealRecipeUid]?.recipe.variantName}]`
                            : ``}
                        </span>
                      </span>
                    }
                    secondary={generatePlanedPortionsText({
                      uid: mealRecipeUid,
                      portionPlan: mealRecipes[mealRecipeUid].plan,
                      groupConfiguration: groupConfiguration,
                    })}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.MEALRECIPE,
                          uid: mealRecipeUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.MEALRECIPE,
                          uid: mealRecipeUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
          {/* Produkte und Material */}
          {menue?.productOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_PRODUCTS}</ListSubheader>
              }
            >
              {menue.productOrder.map((productUid) => (
                <ListItem key={"listItemProducts_" + productUid}>
                  <ListItemText
                    primary={`${
                      products[productUid]?.totalQuantity > 0
                        ? `${products[productUid]?.totalQuantity} ${
                            products[productUid].unit
                              ? products[productUid].unit
                              : " ×"
                          }`
                        : ``
                    } ${products[productUid]?.productName}
                      ${
                        products[productUid]?.planMode ==
                        GoodsPlanMode.PER_PORTION
                          ? `(${products[productUid].quantity} ${products[productUid].unit} ${TEXT_PER_PORTION})`
                          : ``
                      }`}
                    secondary={
                      products[productUid]?.planMode ==
                      GoodsPlanMode.PER_PORTION
                        ? generatePlanedPortionsText({
                            uid: productUid,
                            portionPlan: products[productUid].plan,
                            groupConfiguration: groupConfiguration,
                          })
                        : ``
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.PRODUCT,
                          uid: productUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.PRODUCT,
                          uid: productUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {menue?.materialOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_MATERIAL}</ListSubheader>
              }
            >
              {menue.materialOrder.map((materialUid) => (
                <ListItem key={"listItemMaterials_" + materialUid}>
                  <ListItemText
                    primary={`${
                      materials[materialUid]?.totalQuantity > 0
                        ? `${materials[materialUid]?.totalQuantity} ${
                            materials[materialUid].unit
                              ? materials[materialUid].unit
                              : " ×"
                          }`
                        : ``
                    } ${materials[materialUid]?.materialName}
                      ${
                        materials[materialUid]?.planMode ==
                        GoodsPlanMode.PER_PORTION
                          ? `(${materials[materialUid].quantity} ${materials[materialUid].unit} ${TEXT_PER_PORTION})`
                          : ``
                      }`}
                    secondary={
                      materials[materialUid]?.planMode ==
                      GoodsPlanMode.PER_PORTION
                        ? generatePlanedPortionsText({
                            uid: materialUid,
                            portionPlan: materials[materialUid].plan,
                            groupConfiguration: groupConfiguration,
                          })
                        : ``
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.MATERIAL,
                          uid: materialUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.MATERIAL,
                          uid: materialUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions style={{marginTop: theme.spacing(2)}}>
          {/* schliessen */}
          <Button onClick={onCloseDialog} color="primary" variant="contained">
            {TEXT_CLOSE}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
