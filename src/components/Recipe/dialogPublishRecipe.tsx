import React from "react";

import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";

import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";

import {
  PUBLISH_RECIPE as TEXT_PUBLISH_RECIPE,
  PUBLISH_RECIPE_RULES_PART1 as TEXT_PUBLISH_RECIPE_RULES_PART1,
  PUBLISH_RECIPE_RULES_BULLET_LIST as TEXT_PUBLISH_RECIPE_RULES_BULLET_LIST,
  PUBLISH_RECIPE_RULES_PART2 as TEXT_PUBLISH_RECIPE_RULES_PART2,
  PUBLISH_RECIPE_RULES_PART3 as TEXT_PUBLISH_RECIPE_RULES_PART3,
  PUBLISH_RECIPE_RULES_PART4 as TEXT_PUBLISH_RECIPE_RULES_PART4,
  PUBLISH_RECIPE_RULES_PART5 as TEXT_PUBLISH_RECIPE_RULES_PART5,
  PUBLISH_RECIPE_RULES_PART6 as TEXT_PUBLISH_RECIPE_RULES_PART6,
  MESSAGE_TO_REVIEW as TEXT_MESSAGE_TO_REVIEW,
  CANCEL as TEXT_CANCEL,
  SEND_RECIPE_TO_REVIEW as TEXT_SEND_RECIPE_TO_REVIEW,
} from "../../constants/text";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/* ===================================================================
// =================== Pop Up Rezept veröffentlichen =================
// =================================================================== */
interface DialogPublishRecipeProps {
  dialogOpen: boolean;
  handleOk: (messageForReview: string) => void;
  handleClose: () => void;
}

const DialogPublishRecipe = ({
  dialogOpen,
  handleOk,
  handleClose,
}: DialogPublishRecipeProps) => {
  const [formFields, setFormFields] = React.useState({
    messageForReview: "",
    initial: true,
  });

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setFormFields({
      ...formFields,
      messageForReview: event.target.value,
      initial: false,
    });
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  const onOkClick = () => {
    setFormFields({...formFields, initial: true});
    handleOk(formFields.messageForReview.trim());
  };
  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onCancelClick = () => {
    handleClose();
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialogPublishRecipeRequest"
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle id="dialogPublishRecipeRequestTitle">
        {TEXT_PUBLISH_RECIPE}
      </DialogTitle>
      <DialogContent>
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART1}</Typography>
        <List dense>
          {TEXT_PUBLISH_RECIPE_RULES_BULLET_LIST.split("•").map(
            (bulletPoint, counter) => (
              <ListItem key={"listitem_" + counter}>
                <ListItemIcon>
                  <CheckBoxOutlinedIcon fontSize={"small"} />
                </ListItemIcon>
                <ListItemText>{bulletPoint}</ListItemText>
              </ListItem>
            )
          )}
        </List>
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART2}</Typography>
        <br />
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART3}</Typography>
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART4}</Typography>
        <br />
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART5}</Typography>
        <Typography>{TEXT_PUBLISH_RECIPE_RULES_PART6}</Typography>
        <br />
        <TextField
          margin="dense"
          id="messageForReview"
          name="messageForReview"
          value={formFields.messageForReview}
          multiline
          fullWidth
          minRows={3}
          maxRows={10}
          onChange={onChangeField}
          variant="outlined"
          label={TEXT_MESSAGE_TO_REVIEW}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClick} variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onOkClick} variant="contained" color="primary">
          {TEXT_SEND_RECIPE_TO_REVIEW}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DialogPublishRecipe;
