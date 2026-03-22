import React from "react";
import useCustomStyles from "../../../constants/styles";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  CardMedia,
  DialogContent,
  Link,
  List,
} from "@mui/material";

import {FormListItem} from "../../Shared/formListItem";

import {
  LOCATION as TEXT_LOCATION,
  UID as TEXT_UID,
  MOTTO as TEXT_MOTTO,
  NO_OF_COOKS as TEXT_NO_OF_COOKS,
  NO_OF_DAYS as TEXT_NO_OF_DAYS,
  START_DATE as TEXT_START_DATE,
  END_DATE as TEXT_END_DATE,
  CREATED_FROM as TEXT_CREATED_FROM,
} from "../../../constants/text";

import {EventShort} from "./eventShort.class";
import {ImageRepository} from "../../../constants/imageRepository";
import {useNavigate} from "react-router";
import Action from "../../../constants/actions";
import {USER_PUBLIC_PROFILE as ROUTES_USER_PUBLIC_PROFILE} from "../../../constants/routes";

export interface DialogQuickViewActions {
  key: string;
  name: string;
  variant: "text" | "outlined" | "contained";
  onClick: (
    actionEvent: React.MouseEvent<HTMLButtonElement> | undefined,
    event: EventShort,
  ) => void;
}

interface DialogEventQuickViewProps {
  eventShort: EventShort;
  dialogOpen: boolean;
  handleClose: (event, reason) => void;
  dialogActions: DialogQuickViewActions[];
}

const DialogEventQuickView = ({
  eventShort,
  dialogOpen,
  handleClose,
  dialogActions,
}: DialogEventQuickViewProps) => {
  const classes = useCustomStyles();
  const navigate = useNavigate();

  return (
    <Dialog
      onClose={handleClose}
      aria-labelledby="Event Quick View"
      fullWidth
      maxWidth={"sm"}
      open={dialogOpen}
      scroll={"paper"}
    >
      {eventShort.pictureSrc && (
        <CardMedia
          sx={classes.cardMedia}
          image={
            eventShort.pictureSrc
              ? eventShort.pictureSrc
              : ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
          }
          title={"Bild " + eventShort.name}
        />
      )}
      <DialogTitle id="simple-dialog-title">{eventShort.name}</DialogTitle>
      <DialogContent>
        <List dense>
          {/* UID */}
          <FormListItem
            key={"uid"}
            id={"uid"}
            value={eventShort.uid}
            label={TEXT_UID}
            displayAsCode={true}
          />

          {/* Ort */}
          <FormListItem
            key={"location"}
            id={"location"}
            value={eventShort.location}
            label={TEXT_LOCATION}
          />
          {/* Motto */}
          <FormListItem
            key={"motto"}
            id={"motto"}
            value={eventShort.motto}
            label={TEXT_MOTTO}
          />
          {/* Anzahl Köche */}
          <FormListItem
            key={"noOfCooks"}
            id={"noOfCooks"}
            value={eventShort.noOfCooks}
            label={TEXT_NO_OF_COOKS}
          />
          {/* Start-Datum */}
          <FormListItem
            key={"startDate"}
            id={"startDate"}
            value={
              eventShort.startDate instanceof Date
                ? eventShort.startDate.toLocaleString("de-CH", {
                    dateStyle: "medium",
                  })
                : ""
            }
            label={TEXT_START_DATE}
          />
          {/* Ende-Datum */}
          <FormListItem
            key={"EndDate"}
            id={"EndDate"}
            value={
              eventShort.endDate instanceof Date
                ? eventShort.endDate.toLocaleString("de-CH", {
                    dateStyle: "medium",
                  })
                : ""
            }
            label={TEXT_END_DATE}
          />
          {/* Anzahl Tage */}
          <FormListItem
            key={"noOfDays"}
            id={"noOfDays"}
            value={eventShort.numberOfDays}
            label={TEXT_NO_OF_DAYS}
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
                    `${ROUTES_USER_PUBLIC_PROFILE}/${eventShort.created.fromUid}`,
                    {
                      state: {
                        action: Action.VIEW,
                        displayName: eventShort.created.fromDisplayName,
                      },
                    },
                  )
                }
              >
                {eventShort.created.fromDisplayName}
              </Link>
            }
            label={TEXT_CREATED_FROM}
          />
          <FormListItem
            key={"authorUid"}
            id={"authorUid"}
            value={eventShort.created.fromUid}
            label={`${TEXT_CREATED_FROM} ${TEXT_UID}`}
            displayAsCode={true}
          />
        </List>
      </DialogContent>
      <DialogActions>
        {dialogActions.map((action) => (
          <Button
            key={action.key}
            id={action.key}
            size="small"
            color="primary"
            variant={action.variant}
            onClick={(actionEvent) => action.onClick(actionEvent, eventShort)}
          >
            {action.name}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};

export {DialogEventQuickView};
