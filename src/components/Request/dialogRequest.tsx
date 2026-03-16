/**
 * DialogRequest — Detailansicht eines Antrags als Modal-Dialog.
 *
 * Zeigt Typ, Name, Status, Datum, Autor*in, Bearbeiter*in, Kommentare
 * und mögliche Statusübergänge an. Ermöglicht das Hinzufügen von
 * Kommentaren und das Zuweisen/Transitionen für Community Leaders.
 */
import React from "react";
import {useNavigate} from "react-router";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Typography,
  TextField,
  Link,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Step,
  StepLabel,
  Stepper,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import useCustomStyles from "../../constants/styles";

import {FormListItem} from "../Shared/formListItem";

import {
  REQUEST as TEXT_REQUEST,
  REQUEST_TYPE_LABEL as TEXT_REQUEST_TYPE_LABEL,
  REQUEST_OBJECT_LABEL as TEXT_REQUEST_OBJECT_LABEL,
  REQUEST_STATUS as TEXT_REQUEST_STATUS,
  REQUEST_NEXT_POSSIBLE_TRANSITION_LABEL as TEXT_REQUEST_NEXT_POSSIBLE_TRANSITION_LABEL,
  REQUEST_CREATION_DATE as TEXT_REQUEST_CREATION_DATE,
  REQUEST_AUTHOR_DISPLAYNAME as TEXT_REQUEST_AUTHOR_DISPLAYNAME,
  REQUEST_ASSIGNEE_DISPLAYNAME as TEXT_REQUEST_ASSIGNEE_DISPLAYNAME,
  REQUEST_ASSIGN_TO_ME_LABEL as TEXT_REQUEST_ASSIGN_TO_ME_LABEL,
  WRONG_ASIGNEE as TEXT_WRONG_ASIGNEE,
  BUTTON_CLOSE as TEXT_BUTTON_CLOSE,
  BUTTON_CANCEL as TEXT_BUTTON_CANCEL,
  COMMENTS as TEXT_COMMENTS,
  FIELD_YOUR_COMMENT as TEXT_FIELD_YOUR_COMMENT,
  BUTTON_ADD_COMMENT as TEXT_BUTTON_ADD_COMMENT,
  UID as TEXT_UID,
  REQUEST_DECLINE_REASON_LABEL as TEXT_REQUEST_DECLINE_REASON_LABEL,
  REQUEST_DECLINE_REASON_REQUIRED as TEXT_REQUEST_DECLINE_REASON_REQUIRED,
  REQUEST_DECLINE_CONFIRM as TEXT_REQUEST_DECLINE_CONFIRM,
  REQUEST_BACK_TO_AUTHOR_HINT as TEXT_REQUEST_BACK_TO_AUTHOR_HINT,
  REQUEST_NO_COMMENTS_YET as TEXT_REQUEST_NO_COMMENTS_YET,
  REQUEST_CHANGELOG_TITLE as TEXT_REQUEST_CHANGELOG_TITLE,
  REQUEST_CONFIRM_STATUS_CHANGE_TITLE as TEXT_REQUEST_CONFIRM_STATUS_CHANGE_TITLE,
  REQUEST_STEPPER_CREATED as TEXT_REQUEST_STEPPER_CREATED,
  REQUEST_STEPPER_IN_REVIEW as TEXT_REQUEST_STEPPER_IN_REVIEW,
  REQUEST_STEPPER_DONE as TEXT_REQUEST_STEPPER_DONE,
  STATUS_NAME as TEXT_STATUS_NAME,
} from "../../constants/text";

import {USER_PUBLIC_PROFILE as ROUTES_USER_PUBLIC_PROFILE} from "../../constants/routes";
import Action from "../../constants/actions";

import {Request, RequestStatus, RequestAction} from "./request.class";
import {RequestDomain, ChangeLogEntry} from "../Database/Repository/RequestRepository";
import {RequestCommentDomain} from "../Database/Repository/RequestCommentRepository";
import AuthUser from "../Firebase/Authentication/authUser.class";
import Role from "../../constants/roles";
import {StatusChips} from "./requestOverview";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";

/* ===================================================================
// =================== Pop Up Rezept veröffentlichen =================
// =================================================================== */

/**
 * Props für den Request-Dialog.
 *
 * @param request - Der anzuzeigende Antrag (Domain-Modell)
 * @param comments - Kommentare zum Antrag
 * @param dialogOpen - Ob der Dialog geöffnet ist
 * @param authUser - Der angemeldete Benutzer
 * @param handleClose - Callback zum Schliessen
 * @param handleUpdateStatus - Callback für Statuswechsel
 * @param handleAssignToMe - Callback für Selbstzuweisung
 * @param handleAddComment - Callback für neuen Kommentar
 * @param handleRecipeOpen - Callback zum Öffnen des Rezepts
 */
interface DialogRequestProps {
  request: RequestDomain;
  comments: RequestCommentDomain[];
  dialogOpen: boolean;
  authUser: AuthUser;
  handleClose: () => void;
  handleUpdateStatus: (nextStatus: RequestStatus, reason?: string) => void;
  handleAssignToMe: () => void;
  handleAddComment: (newComment: string) => void;
  handleRecipeOpen: (uid: string) => void;
}

/**
 * Leitet aus dem aktuellen Request-Status den aktiven Stepper-Schritt ab.
 *
 * @param status - Aktueller Request-Status
 * @returns Index des aktiven Schritts (0-basiert), 3 = alle abgeschlossen
 */
const getActiveStep = (status: string): number => {
  switch (status) {
    case RequestStatus.created:
      return 0;
    case RequestStatus.inReview:
    case RequestStatus.backToAuthor:
    case RequestStatus.declined:
      return 1;
    case RequestStatus.done:
      return 3; // alle Schritte abgeschlossen
    default:
      return 0;
  }
};

/**
 * Übersetzt eine Changelog-Aktion in einen lesbaren deutschen Text.
 *
 * @param entry - Der Changelog-Eintrag
 * @returns Deutschsprachige Beschreibung der Aktion
 */
const translateChangeLogAction = (entry: ChangeLogEntry): string => {
  switch (entry.action) {
    case RequestAction.created:
      return "Antrag erstellt";
    case RequestAction.assign:
      return `Zugewiesen an ${(entry.newValue as Record<string, string>).assignee ?? ""}`;
    case RequestAction.changeState: {
      const statusKey = (entry.newValue as Record<string, string>).status;
      const statusName =
        TEXT_STATUS_NAME[statusKey as keyof typeof TEXT_STATUS_NAME] ?? statusKey;
      return `Status: ${statusName}`;
    }
    default:
      return entry.action || "–";
  }
};

const DialogRequest = ({
  request,
  comments,
  dialogOpen,
  authUser,
  handleClose,
  handleUpdateStatus,
  handleAssignToMe,
  handleAddComment,
  handleRecipeOpen,
}: DialogRequestProps) => {
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const {customDialog} = useCustomDialog();

  const [comment, setComment] = React.useState("");
  const [pendingDecline, setPendingDecline] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");
  const [declineReasonError, setDeclineReasonError] = React.useState(false);

  const isCommunityLeader = authUser.roles.includes(Role.communityLeader);
  const isAssignee = request?.assigneeUid === authUser.authUid;
  const isAuthor = authUser?.authUid === request?.authorUid;
  // Community Leader kann zuweisen, wenn nicht Assignee und nicht Autor
  const canAssignToMe = isCommunityLeader && !isAssignee && !isAuthor;

  const onCancelClick = () => {
    setPendingDecline(false);
    setDeclineReason("");
    setDeclineReasonError(false);
    handleClose();
  };

  const onClickNextStatus = async (nextStatus: RequestStatus) => {
    // Bei Ablehnung: Begründung verlangen
    if (nextStatus === RequestStatus.declined) {
      setPendingDecline(true);
      return;
    }

    // Bestätigungsdialog für nicht-Ablehnungs-Transitionen
    const statusName =
      TEXT_STATUS_NAME[nextStatus as keyof typeof TEXT_STATUS_NAME] ?? nextStatus;
    const confirmed = await customDialog({
      dialogType: DialogType.Confirm,
      title: TEXT_REQUEST_CONFIRM_STATUS_CHANGE_TITLE,
      text: `${statusName}?`,
    });

    if (!confirmed) return;

    handleUpdateStatus(nextStatus);
  };

  const onConfirmDecline = () => {
    if (!declineReason.trim()) {
      setDeclineReasonError(true);
      return;
    }
    setDeclineReasonError(false);
    setPendingDecline(false);
    handleUpdateStatus(RequestStatus.declined, declineReason.trim());
    setDeclineReason("");
  };

  const onCancelDecline = () => {
    setPendingDecline(false);
    setDeclineReason("");
    setDeclineReasonError(false);
  };

  const onChangeComment = (event: React.ChangeEvent<HTMLInputElement>) => {
    setComment(event.target.value);
  };

  const saveComment = () => {
    handleAddComment(comment);
    setComment("");
  };

  const clearComment = () => {
    setComment("");
  };

  // Stepper-Konfiguration
  const activeStep = getActiveStep(request.status);
  const isDeclined = request.status === RequestStatus.declined;
  const stepperSteps = [
    TEXT_REQUEST_STEPPER_CREATED,
    isDeclined ? TEXT_STATUS_NAME.declined : TEXT_REQUEST_STEPPER_IN_REVIEW,
    TEXT_REQUEST_STEPPER_DONE,
  ];

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialog Request"
      fullWidth={true}
      maxWidth="sm"
      style={{zIndex: 500}}
    >
      <DialogTitle
        sx={classes.dialogHeaderWithPicture}
        style={{
          backgroundImage: `url(${request?.recipePictureSrc})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={classes.dialogHeaderWithPictureTitle}
          style={{paddingLeft: "2ex"}}
        >
          {TEXT_REQUEST} #{request.number}
        </Typography>
      </DialogTitle>

      {/* Fortschrittsanzeige */}
      <Stepper
        activeStep={activeStep}
        alternativeLabel
        sx={{pt: 2, pb: 1, px: 2}}
      >
        {stepperSteps.map((label, index) => (
          <Step key={label}>
            <StepLabel
              error={isDeclined && index === 1}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <DialogContent style={{overflow: "unset"}}>
        {/* Hinweis bei backToAuthor */}
        {request.status === RequestStatus.backToAuthor && (
          <Alert severity="info" sx={{mb: 2}}>
            {TEXT_REQUEST_BACK_TO_AUTHOR_HINT}
          </Alert>
        )}

        <List>
          {/* Request Type */}
          <FormListItem
            key={"RequestType"}
            id={"RequestType"}
            value={Request.translateType(request.requestType)}
            label={TEXT_REQUEST_TYPE_LABEL}
          />
          {/* UID */}
          {authUser.roles.includes(Role.admin) && (
            <FormListItem
              key={"RequestUid"}
              id={"RequestUid"}
              value={request.uid}
              label={TEXT_UID}
              displayAsCode={true}
            />
          )}
          {/* Request Name mit externem Link-Icon */}
          <FormListItem
            key={"RequestName"}
            id={"RequestName"}
            value={
              <Link
                style={{cursor: "pointer"}}
                onClick={() => handleRecipeOpen(request.recipeUid)}
              >
                {request.recipeName}
                <OpenInNewIcon
                  sx={{fontSize: 14, verticalAlign: "middle", ml: 0.5}}
                />
              </Link>
            }
            label={TEXT_REQUEST_OBJECT_LABEL}
          />
          {/* Status */}
          <FormListItem
            key={"RequestStatus"}
            id={"RequestStatus"}
            value={<StatusChips status={request.status} />}
            label={TEXT_REQUEST_STATUS}
          />
          {/* Nächster möglicher Status */}
          {(() => {
            const isBackToAuthor =
              request.status === RequestStatus.backToAuthor;

            // Autor sieht Übergänge nur bei backToAuthor
            // Assignee sieht Übergänge bei allen anderen Status
            const canTransition =
              (isAuthor && isBackToAuthor) || (!isAuthor && isAssignee);

            if (!canTransition && !isAuthor) {
              // Nicht-Autor, nicht-Assignee → Hinweis
              return (
                <FormListItem
                  key={"RequestNextPossibleState"}
                  id={"RequestRequestNextPossibleStateType"}
                  value={
                    <Typography color="textSecondary">
                      {TEXT_WRONG_ASIGNEE}
                    </Typography>
                  }
                  label={TEXT_REQUEST_NEXT_POSSIBLE_TRANSITION_LABEL}
                />
              );
            }

            if (!canTransition) return null;

            const transitions = Request.getNextPossibleTransitions(
              request.status,
              request.requestType,
            );
            if (transitions.length === 0) return null;

            return (
              <FormListItem
                key={"RequestNextPossibleState"}
                id={"RequestRequestNextPossibleStateType"}
                value={
                  <React.Fragment>
                    {transitions.map((possibleTransition, counter) => (
                      <React.Fragment
                        key={
                          "transition_" +
                          possibleTransition.description +
                          counter
                        }
                      >
                        {counter > 0 && " | "}
                        <Link
                          key={`transitionLink_${counter}`}
                          style={{cursor: "pointer"}}
                          onClick={() =>
                            onClickNextStatus(possibleTransition.toState)
                          }
                        >
                          {possibleTransition.description}
                        </Link>
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                }
                label={TEXT_REQUEST_NEXT_POSSIBLE_TRANSITION_LABEL}
              />
            );
          })()}
          {/* Begründung für Ablehnung (inline-Formular) */}
          {pendingDecline && (
            <ListItem>
              <ListItemText
                primary={
                  <React.Fragment>
                    <TextField
                      label={TEXT_REQUEST_DECLINE_REASON_LABEL}
                      multiline
                      minRows={3}
                      variant="outlined"
                      fullWidth
                      value={declineReason}
                      onChange={(e) => {
                        setDeclineReason(e.target.value);
                        if (e.target.value.trim()) setDeclineReasonError(false);
                      }}
                      error={declineReasonError}
                      helperText={
                        declineReasonError
                          ? TEXT_REQUEST_DECLINE_REASON_REQUIRED
                          : ""
                      }
                      autoFocus
                      style={{marginBottom: "8px"}}
                    />
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      onClick={onConfirmDecline}
                      style={{marginRight: "8px"}}
                    >
                      {TEXT_REQUEST_DECLINE_CONFIRM}
                    </Button>
                    <Button size="small" onClick={onCancelDecline}>
                      {TEXT_BUTTON_CANCEL}
                    </Button>
                  </React.Fragment>
                }
              />
            </ListItem>
          )}
          {/* Datum */}
          <FormListItem
            key={"RequestCreateDate"}
            id={"RequestCreateDate"}
            value={request?.createdAt?.toLocaleString("de-CH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
            label={TEXT_REQUEST_CREATION_DATE}
          />

          {/* Autor*in */}
          <FormListItem
            key={"RequestAuthor"}
            id={"RequestAuthor"}
            value={
              <Link
                style={{cursor: "pointer"}}
                onClick={() =>
                  navigate(
                    `${ROUTES_USER_PUBLIC_PROFILE}/${request.authorUid}`,
                    {
                      state: {
                        action: Action.VIEW,
                        displayName: request.authorDisplayName,
                        pictureSrc: request.authorPictureSrc,
                      },
                    },
                  )
                }
              >
                {request.authorDisplayName}
              </Link>
            }
            label={TEXT_REQUEST_AUTHOR_DISPLAYNAME}
          />

          {/* Bearbeiter*in */}
          <FormListItem
            key={"RequestAsignee"}
            id={"RequestAsignee"}
            value={
              <Link
                style={{cursor: "pointer"}}
                onClick={() =>
                  navigate(
                    `${ROUTES_USER_PUBLIC_PROFILE}/${request.assigneeUid}`,
                    {
                      state: {
                        action: Action.VIEW,
                        displayName: request.assigneeDisplayName,
                        pictureSrc: request.assigneePictureSrc,
                      },
                    },
                  )
                }
              >
                {request.assigneeDisplayName}
              </Link>
            }
            label={TEXT_REQUEST_ASSIGNEE_DISPLAYNAME}
          />
        </List>

        {/* Kommentare — immer sichtbar */}
        <Typography variant="subtitle1" style={{marginTop: "4ex"}}>
          {TEXT_COMMENTS}
        </Typography>
        {comments.length > 0 ? (
          <List>
            {comments.map((c, counter) => (
              <React.Fragment key={`comment_${counter}`}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    {c.userPictureSrc ? (
                      <Avatar
                        alt={c.userDisplayName}
                        src={c.userPictureSrc}
                      />
                    ) : (
                      <Avatar alt={c.userDisplayName}>
                        {c.userDisplayName?.charAt(0)}
                      </Avatar>
                    )}
                  </ListItemAvatar>

                  <ListItemText
                    primary={c.comment}
                    secondary={
                      <React.Fragment>
                        <Typography
                          component="span"
                          variant="body2"
                          color="textPrimary"
                        >
                          {c.userDisplayName}
                        </Typography>
                        {` — ${c.createdAt.toLocaleString("de-CH", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                      </React.Fragment>
                    }
                  />
                </ListItem>
                {counter !== comments.length - 1 && (
                  <Divider variant="inset" component="li" />
                )}
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Typography
            variant="body2"
            color="textSecondary"
            style={{marginTop: "1ex", marginBottom: "2ex"}}
          >
            {TEXT_REQUEST_NO_COMMENTS_YET}
          </Typography>
        )}

        <TextField
          id="outlined-multiline-static"
          label={TEXT_FIELD_YOUR_COMMENT}
          multiline
          minRows={4}
          variant="outlined"
          fullWidth
          value={comment}
          onChange={onChangeComment}
        />
        <Button size="small" onClick={saveComment}>
          {TEXT_BUTTON_ADD_COMMENT}
        </Button>
        <Button size="small" onClick={clearComment}>
          {TEXT_BUTTON_CANCEL}
        </Button>

        {/* Verlauf (Changelog) */}
        {request.changeLog && request.changeLog.length > 0 && (
          <Accordion sx={{mt: 2}} variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">
                {TEXT_REQUEST_CHANGELOG_TITLE}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {request.changeLog.map((entry, index) => (
                  <ListItem key={`changelog_${index}`}>
                    <ListItemText
                      primary={translateChangeLogAction(entry)}
                      secondary={`${entry.userDisplayName} — ${new Date(entry.date).toLocaleString("de-CH", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}
      </DialogContent>
      <DialogActions>
        {/* Assign-to-Me Button links im Footer */}
        {canAssignToMe && (
          <Button
            onClick={handleAssignToMe}
            startIcon={<AssignmentIndIcon />}
            sx={{mr: "auto"}}
          >
            {TEXT_REQUEST_ASSIGN_TO_ME_LABEL}
          </Button>
        )}
        <Button onClick={onCancelClick} variant="outlined">
          {TEXT_BUTTON_CLOSE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default DialogRequest;
