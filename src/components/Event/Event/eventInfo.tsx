import React from "react";
import {useTheme} from "@mui/material/styles";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";

import {
  Card,
  CardHeader,
  CardContent,
  Grid,
  TextField,
  Divider,
  Typography,
  Tooltip,
  IconButton,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  ListItemSecondaryAction,
  useMediaQuery,
  Box,
  Stack,
  Alert,
} from "@mui/material";
import {Delete as DeleteIcon, Add as AddIcon} from "@mui/icons-material";

import {
  DEFINE_BASIC_EVENT_DATA as TEXT_DEFINE_BASIC_EVENT_DATA,
  EVENT_INFO as TEXT_EVENT_INFO,
  EVENT_NAME as TEXT_EVENT_NAME,
  EVENT_NAME_HELPERTEXT as TEXT_EVENT_NAME_HELPERTEXT,
  MOTTO as TEXT_MOTTO,
  MOTTO_HELPERTEXT as TEXT_MOTTO_HELPERTEXT,
  LOCATION as TEXT_LOCATION,
  LOCATION_HELPERTEXT as TEXT_LOCATION_HELPERTEXT,
  FROM as TEXT_FROM,
  TO as TEXT_TO,
  DATES as TEXT_DATES,
  DELETE_DATES as TEXT_DELETE_DATES,
  ADD_IMAGE as TEXT_ADD_IMAGE,
  DELETE_IMAGE as TEXT_DELETE_IMAGE,
  COVER_PICTURES as TEXT_COVER_PICTURES,
  ADD_LOGO_OR_CAMP_PICTURE_HERE as TEXT_ADD_LOGO_OR_CAMP_PICTURE_HERE,
  KITCHENCREW as TEXT_KITCHENCREW,
  COOKING_IS_COMMUNITY_SPORT as TEXT_COOKING_IS_COMMUNITY_SPORT,
  ADD_COOK_TO_EVENT as TEXT_ADD_COOK_TO_EVENT,
  QUESTION_DELETE_IMAGE as TEXT_QUESTION_DELETE_IMAGE,
  DELETE as TEXT_DELETE,
  RECEIPT as TEXT_RECEIPT,
  CREATE_RECEIPT as TEXT_CREATE_RECEIPT,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
} from "../../../constants/text";

import useCustomStyles from "../../../constants/styles";

import {ImageRepository} from "../../../constants/imageRepository";

import Event, {EventRefDocuments} from "./event.class";
import User from "../../User/user.class";

import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Utils from "../../Shared/utils.class";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";
import DialogAddUser from "../../User/dialogAddUser";
import {
  FormValidationFieldError,
  FormValidatorUtil,
} from "../../Shared/fieldValidation.error.class";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import Action from "../../../constants/actions";
import Receipt from "./receipt.class";
import EventReceiptPdf from "./eventRecipePdf";
import {EventDate} from "./event.class";
import {DatePicker} from "@mui/x-date-pickers";

/* ===================================================================
// ============================== Global =============================
// =================================================================== */

/** Epoch-Zeitstempel (1.1.1970) für Vergleiche mit leeren Datumsfeldern. */
const EPOCH_TIME = new Date(0).getTime();

/**
 * Normalisiert die Stunden eines Datums abhängig vom Feld.
 * "from" wird auf 00:00:00 gesetzt, "to" auf 23:59:59.
 *
 * @param date Das zu normalisierende Datum.
 * @param field Der Feldname ("from" oder "to").
 * @returns Das normalisierte Datum.
 */
const normalizeDateHours = (date: Date, field: string): Date => {
  const normalized = new Date(date);
  if (field === "to") {
    normalized.setHours(23, 59, 59, 0);
  } else {
    normalized.setHours(0, 0, 0, 0);
  }
  return normalized;
};

/**
 * Füllt das Bis-Datum automatisch mit dem Von-Datum, wenn das
 * Bis-Datum noch auf dem Epoch-Wert steht (1970).
 *
 * @param eventDate Der Datumseintrag, der geprüft wird.
 * @param fromDate Das gesetzte Von-Datum.
 */
const autoFillToDate = (eventDate: EventDate, fromDate: Date): void => {
  if (eventDate.to.getFullYear() === 1970) {
    eventDate.to = new Date(fromDate);
    eventDate.to.setHours(23, 59, 59, 0);
  }
};

/**
 * Fügt automatisch eine neue Datumszeile hinzu, wenn die letzte Zeile
 * bearbeitet wird.
 *
 * @param eventDate Der gerade bearbeitete Datumseintrag.
 * @param totalDates Gesamtanzahl der vorhandenen Datumszeilen.
 * @param dates Aktuelle Datumsliste (wird ggf. erweitert).
 * @returns Die (evtl. erweiterte) Datumsliste.
 */
const autoAppendDateRow = (
  eventDate: EventDate,
  totalDates: number,
  dates: EventDate[]
): EventDate[] => {
  if (eventDate.pos === totalDates) {
    const newDate = Event.createDateEntry();
    newDate.pos = eventDate.pos + 1;
    dates.push(newDate);
  }
  return dates;
};

/* ===================================================================
// ============================ Event-Info ===========================
// =================================================================== */
/** Props für die Event-Informationsseite. */
interface EventInfoPageProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Lokal ausgewähltes Bild (noch nicht hochgeladen). */
  localPicture: File | null;
  /** Firebase-Instanz für DB-Zugriffe. */
  firebase: Firebase;
  /** Datenbank-Service für Supabase-Zugriffe. */
  database: DatabaseService;
  /** Authentifizierter Benutzer. */
  authUser: AuthUser;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Callback bei Änderung des Events. */
  onUpdateEvent: (event: Event) => void;
  /** Callback bei Änderung des lokalen Bildes. */
  onUpdatePicture: (picture: File | null) => void;
  /** Callback bei Änderung der Formular-Validierung. */
  onFormValidationUpdate?: (errors: FormValidationFieldError[]) => void;
  /** Callback bei Fehlern (z.B. DB-Fehler). */
  onError?: (error: Error) => void;
}

/**
 * Hauptseite für die Event-Informationen.
 * Enthält Basisinformationen (Name, Motto, Ort, Daten, Bild) und
 * die Verwaltung des Koch-Teams.
 */
const EventInfoPage = ({
  event,
  localPicture,
  firebase,
  database,
  authUser,
  formValidation,
  onUpdateEvent,
  onUpdatePicture,
  onFormValidationUpdate,
  onError,
}: EventInfoPageProps) => {
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  // Hier damit der AuthUser übergeben werden kann
  const [dialogAddUserOpen, setDialogAddUserOpen] = React.useState(false);
  const {customDialog} = useCustomDialog();
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.eventSettings,
    });
  }, []);

  /* ------------------------------------------
  // Field-Change
  // ------------------------------------------ */
  const onFieldUpdate = (actionEvent: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateEvent({
      ...event,
      [actionEvent.target.name]: actionEvent.target.value,
    } as Event);
  };
  const onDatePickerUpdate = (date: Date | null, field: string) => {
    if (!date) {
      return;
    }

    const changedPos = field.split("_");
    let tempDates = [...event.dates];
    const eventDate = tempDates.find(
      (eventDate) => eventDate.uid === changedPos[1]
    );
    if (!eventDate) {
      return;
    }

    const normalizedDate = normalizeDateHours(date, changedPos[0]);
    eventDate[changedPos[0] as keyof Pick<EventDate, "from" | "to">] =
      normalizedDate;

    if (changedPos[0] === "from") {
      autoFillToDate(eventDate, normalizedDate);
    }

    tempDates = autoAppendDateRow(eventDate, event.dates.length, tempDates);
    tempDates = Utils.renumberArray({array: tempDates, field: "pos"});

    onUpdateEvent({...event, dates: tempDates} as Event);

    if (onFormValidationUpdate) {
      onFormValidationUpdate(Event.validateDates(tempDates));
    }
  };
  const onDateDeleteClick = (
    actionEvent: React.MouseEvent<HTMLButtonElement>,
  ) => {
    let tempDates = event.dates.filter(
      (eventDate) =>
        eventDate.uid !== actionEvent.currentTarget.id.split("_")[1]
    );
    tempDates = Utils.renumberArray({array: tempDates, field: "pos"});

    onUpdateEvent({...event, dates: tempDates} as Event);

    // Inline-Datumsvalidierung auslösen
    if (onFormValidationUpdate) {
      onFormValidationUpdate(Event.validateDates(tempDates));
    }
  };
  /* ------------------------------------------
  // Bild-Handling
  // ------------------------------------------ */
  const onImageDelete = async () => {
    if (!event.uid || (event.uid && !event.pictureSrc)) {
      onUpdatePicture(null);
    } else {
      const isConfirmed = await customDialog({
        dialogType: DialogType.Confirm,
        text: TEXT_QUESTION_DELETE_IMAGE,
        title: `${TEXT_DELETE_IMAGE}?`,
        buttonTextConfirm: TEXT_DELETE,
      });
      if (!isConfirmed) {
        return;
      }

      try {
        await Event.deletePicture({
          firebase: firebase,
          event: event,
          authUser: authUser,
        });
        onUpdateEvent({...event, pictureSrc: ""} as Event);
      } catch (error) {
        onError?.(error as Error);
      }
    }
  };
  /* ------------------------------------------
  // Köche-Handling
  // ------------------------------------------ */
  const onOpenDialogAddUserDialog = () => {
    setDialogAddUserOpen(true);
  };
  const onCloseDialogAddUserDialog = () => {
    setDialogAddUserOpen(false);
  };
  const onAddUserToEvent = async (personUid: string) => {
    if (!personUid) {
      setDialogAddUserOpen(false);
      return;
    }

    try {
      const publicProfile = await User.getPublicProfile({
        database: database,
        uid: personUid,
      });
      const updatedCooks = await Event.addCookToEvent({
        firebase: firebase,
        authUser: authUser,
        cookPublicProfile: publicProfile,
        event: event,
      });
      onUpdateEvent({...event, cooks: updatedCooks} as Event);
    } catch (error) {
      onError?.(error as Error);
    }
    setDialogAddUserOpen(false);
  };
  const onDeleteCook = async (
    actionEvent: React.MouseEvent<HTMLButtonElement>
  ) => {
    const cookUidToDelete = actionEvent.currentTarget.id.split("_")[1];
    if (!cookUidToDelete) {
      return;
    }

    try {
      const result = await Event.removeCookFromEvent({
        firebase: firebase,
        authUser: authUser,
        cookUidToRemove: cookUidToDelete,
        event: event,
      });
      onUpdateEvent({...event, cooks: result} as Event);
    } catch (error) {
      onError?.(error as Error);
    }
  };
  /* ------------------------------------------
  // Quittung
  // ------------------------------------------ */
  const onDownloadReceipt = async () => {
    try {
      const receiptData = await Receipt.getReceipt({
        firebase: firebase,
        eventUid: event.uid,
      });
      const blob = await pdf(
        <EventReceiptPdf receiptData={receiptData} authUser={authUser} />
      ).toBlob();
      fileSaver.saveAs(
        blob,
        event.name + TEXT_CREATE_RECEIPT + TEXT_SUFFIX_PDF
      );
    } catch (error) {
      console.error(error);
      onError?.(error as Error);
    }
  };

  return (
    <React.Fragment>
      <Stack spacing={2}>
        <EventBasicInfoCard
          event={event}
          formValidation={formValidation}
          onFieldUpdate={onFieldUpdate}
          onDatePickerUpdate={onDatePickerUpdate}
          onDateDeleteClick={onDateDeleteClick}
          onImageUpload={onUpdatePicture}
          onImageDelete={onImageDelete}
          previewPictureUrl={
            localPicture ? URL.createObjectURL(localPicture) : ""
          }
          onDownloadReceipt={onDownloadReceipt}
        />
        <EventCookingTeamCard
          event={event}
          formValidation={formValidation}
          authUser={authUser}
          onAddCook={onOpenDialogAddUserDialog}
          onDeleteCook={onDeleteCook}
        />
      </Stack>
      <DialogAddUser
        firebase={firebase}
        database={database}
        authUser={authUser}
        dialogOpen={dialogAddUserOpen}
        handleAddUser={onAddUserToEvent}
        handleClose={onCloseDialogAddUserDialog}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Info-Card ===========================
// =================================================================== */
/** Props für die Basis-Informationskarte des Events. */
interface EventBasicInfoCardProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Callback bei Änderung eines Textfeldes. */
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback bei Änderung eines Datums. */
  onDatePickerUpdate: (date: Date | null, field: string) => void;
  /** Callback zum Löschen einer Datumszeile. */
  onDateDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback beim Hochladen eines Bildes. */
  onImageUpload: (file: File | null) => void;
  /** Callback zum Löschen des Bildes. */
  onImageDelete: () => void;
  /** Callback zum Herunterladen der Quittung als PDF. */
  onDownloadReceipt: () => void;
  /** Vorschau-URL des lokal ausgewählten Bildes. */
  previewPictureUrl: string | null;
}

/**
 * Karte mit den Basisinformationen des Events.
 * Enthält Felder für Name, Motto, Ort, Datumsbereiche und Bild.
 */
const EventBasicInfoCard = ({
  event,
  formValidation,
  onFieldUpdate,
  onDatePickerUpdate,
  onDateDeleteClick,
  onImageUpload,
  onImageDelete,
  onDownloadReceipt,
  previewPictureUrl,
}: EventBasicInfoCardProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  return (
    <Card sx={classes.card}>
      <CardHeader
        title={TEXT_EVENT_INFO}
        subheader={TEXT_DEFINE_BASIC_EVENT_DATA}
        action={
          event.refDocuments?.includes(EventRefDocuments.receipt) ? (
            <Button
              color="primary"
              variant="outlined"
              style={{
                marginTop: theme.spacing(1),
                marginRight: theme.spacing(0.6),
              }}
              onClick={onDownloadReceipt}
            >
              {TEXT_RECEIPT}
            </Button>
          ) : null
        }
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  id="name"
                  name="name"
                  variant="outlined"
                  label={TEXT_EVENT_NAME}
                  value={event.name}
                  onChange={onFieldUpdate}
                  helperText={FormValidatorUtil.getHelperText(
                    formValidation,
                    "name",
                    TEXT_EVENT_NAME_HELPERTEXT,
                  )}
                  error={FormValidatorUtil.isFieldErroneous(
                    formValidation,
                    "name",
                  )}
                  fullWidth
                  required
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id="motto"
                  name="motto"
                  variant="outlined"
                  label={TEXT_MOTTO}
                  helperText={TEXT_MOTTO_HELPERTEXT}
                  value={event.motto}
                  onChange={onFieldUpdate}
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  id="location"
                  name="location"
                  variant="outlined"
                  label={TEXT_LOCATION}
                  helperText={TEXT_LOCATION_HELPERTEXT}
                  value={event.location}
                  onChange={onFieldUpdate}
                  fullWidth
                />
              </Grid>
              <Grid size={12}>
                <EventDatesSection
                  event={event}
                  formValidation={formValidation}
                  onDatePickerUpdate={onDatePickerUpdate}
                  onDateDeleteClick={onDateDeleteClick}
                />
              </Grid>
            </Grid>
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6,
            }}
          >
            <EventImageSection
              event={event}
              previewPictureUrl={previewPictureUrl}
              onImageUpload={onImageUpload}
              onImageDelete={onImageDelete}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ========================= Datums-Bereich ==========================
// =================================================================== */
/** Props für den Datums-Bereich. */
interface EventDatesSectionProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Callback bei Änderung eines Datums. */
  onDatePickerUpdate: (date: Date | null, field: string) => void;
  /** Callback zum Löschen einer Datumszeile. */
  onDateDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Datumsbereich der Event-Informationskarte.
 * Zeigt Von-/Bis-Datumsfelder für jeden Zeitabschnitt mit
 * Löschbutton und automatischer Zeilenerweiterung.
 */
const EventDatesSection = ({
  event,
  formValidation,
  onDatePickerUpdate,
  onDateDeleteClick,
}: EventDatesSectionProps) => {
  const classes = useCustomStyles();

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Typography variant="h6">{TEXT_DATES}</Typography>
      </Grid>
      {event.dates.map((eventDate, counter) => (
        <React.Fragment key={"date_" + eventDate.uid}>
          <Grid size={5}>
            <DatePicker
              key={"dateFrom_" + eventDate.uid}
              label={TEXT_FROM}
              format="dd.MM.yyyy"
              value={
                eventDate.from?.getTime() === EPOCH_TIME
                  ? null
                  : eventDate.from
              }
              onChange={(date) =>
                onDatePickerUpdate(date, "from_" + eventDate.uid)
              }
              slotProps={{
                textField: {
                  helperText: FormValidatorUtil.getHelperText(
                    formValidation,
                    "dateFrom_" + eventDate.uid,
                    ""
                  ),
                },
              }}
            />
          </Grid>
          <Grid sx={classes.centerCenter} size={1}>
            <Typography>-</Typography>
          </Grid>
          <Grid size={5}>
            <DatePicker
              key={"dateTo_" + eventDate.uid}
              label={TEXT_TO}
              format="dd.MM.yyyy"
              value={
                eventDate.to?.getTime() === EPOCH_TIME ? null : eventDate.to
              }
              onChange={(date) =>
                onDatePickerUpdate(date, "to_" + eventDate.uid)
              }
              slotProps={{
                textField: {
                  helperText: FormValidatorUtil.getHelperText(
                    formValidation,
                    "dateTo_" + eventDate.uid,
                    ""
                  ),
                },
              }}
            />
          </Grid>
          <Grid sx={classes.centerCenter} size={1}>
            <Tooltip title={TEXT_DELETE_DATES}>
              <span>
                <IconButton
                  id={"dateDelete_" + eventDate.uid}
                  aria-label="delete"
                  onClick={onDateDeleteClick}
                  color="primary"
                  disabled={
                    (eventDate.from?.getFullYear() === 1970 &&
                      eventDate.to?.getFullYear() === 1970) ||
                    (eventDate.pos === 1 && event.dates.length === 1)
                  }
                  size="large"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Grid>
          {event.dates.length - 1 !== counter ? (
            <Grid size={12}>
              <Divider />
            </Grid>
          ) : null}
        </React.Fragment>
      ))}
    </Grid>
  );
};
/* ===================================================================
// =========================== Bild-Bereich ==========================
// =================================================================== */
/** Props für den Bild-Bereich. */
interface EventImageSectionProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Vorschau-URL des lokal ausgewählten Bildes. */
  previewPictureUrl: string | null;
  /** Callback beim Hochladen eines Bildes. */
  onImageUpload: (file: File | null) => void;
  /** Callback zum Löschen des Bildes. */
  onImageDelete: () => void;
}

/**
 * Bild-Bereich der Event-Informationskarte.
 * Zeigt eine Bildvorschau und Buttons zum Hochladen bzw. Löschen
 * des Event-Bildes.
 */
const EventImageSection = ({
  event,
  previewPictureUrl,
  onImageUpload,
  onImageDelete,
}: EventImageSectionProps) => {
  const classes = useCustomStyles();
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const handleFileChange = (
    actionEvent: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = actionEvent.target.files?.[0] || null;
    onImageUpload(selectedFile);
  };

  return (
    <React.Fragment>
      <Typography variant="subtitle1">{TEXT_COVER_PICTURES}</Typography>
      <Typography color="textSecondary" gutterBottom>
        {TEXT_ADD_LOGO_OR_CAMP_PICTURE_HERE}{" "}
      </Typography>
      <Grid container spacing={1}>
        <Grid size={12}>
          <Box
            component="div"
            sx={[classes.cardMedia, classes.backgroundGrey]}
            style={{
              backgroundImage: `url('${
                previewPictureUrl
                  ? previewPictureUrl
                  : event.pictureSrc
                    ? event.pictureSrc
                    : ImageRepository.getEnviromentRelatedPicture()
                        .CARD_PLACEHOLDER_MEDIA
              }')`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "contain",
              borderRadius: "4px",
              mixBlendMode: prefersDarkMode ? "normal" : "multiply",
            }}
          />
        </Grid>
        <Grid size={6}>
          <input
            accept="image/*"
            style={{display: "none"}}
            id="icon-button-file"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="icon-button-file">
            <Button
              color="primary"
              startIcon={<AddIcon />}
              fullWidth
              component="span"
            >
              {TEXT_ADD_IMAGE}
            </Button>
          </label>
        </Grid>
        <Grid size={6}>
          {(previewPictureUrl || event.pictureSrc) && (
            <Button
              color="primary"
              startIcon={<DeleteIcon />}
              onClick={onImageDelete}
              fullWidth
            >
              {TEXT_DELETE_IMAGE}
            </Button>
          )}
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ============================ Koch-Team ============================
// =================================================================== */
/** Props für die Koch-Team-Karte. */
interface EventCookingTeamCardProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Authentifizierter Benutzer (zum Schutz vor Selbstlöschung). */
  authUser: AuthUser;
  /** Callback zum Hinzufügen eines Kochs. */
  onAddCook: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback zum Entfernen eines Kochs. */
  onDeleteCook: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Karte mit der Auflistung des Koch-Teams.
 * Zeigt alle zugewiesenen Köche mit Avatar und erlaubt
 * das Hinzufügen und Entfernen von Team-Mitgliedern.
 */
const EventCookingTeamCard = ({
  event,
  formValidation,
  authUser,
  onAddCook,
  onDeleteCook,
}: EventCookingTeamCardProps) => {
  const classes = useCustomStyles();
  return (
    <Card>
      <CardHeader
        title={TEXT_KITCHENCREW}
        subheader={TEXT_COOKING_IS_COMMUNITY_SPORT}
      />
      {FormValidatorUtil.isFieldErroneous(formValidation, "cooks") && (
        <CardContent>
          <Alert severity="error">
            {FormValidatorUtil.getHelperText(formValidation, "cooks", "")}
          </Alert>
        </CardContent>
      )}
      <CardContent>
        <List key={"cookList"}>
          {event.cooks.map((cook, counter) => (
            <React.Fragment key={"cook_" + cook.uid}>
              {counter > 0 && <Divider component="li" />}
              <ListItem
                alignItems="flex-start"
                key={"cookListItem_" + cook.uid}
                id={"cookListItem_" + cook.uid}
              >
                <ListItemAvatar>
                  {/* Kompatibilitäts-Shim: In Firestore-Events kann pictureSrc
                      noch als altes Picture-Objekt vorliegen */}
                  {(
                    typeof cook.pictureSrc === "string"
                      ? cook.pictureSrc
                      : ((cook.pictureSrc as any)?.smallSize ?? "")
                  ) ? (
                    <Avatar
                      alt={cook.displayName}
                      src={
                        typeof cook.pictureSrc === "string"
                          ? getImageUrl(cook.pictureSrc, ImageSize.AVATAR)
                          : String((cook.pictureSrc as any)?.smallSize ?? "")
                      }
                    />
                  ) : (
                    <Avatar alt={cook.displayName}>
                      {cook.displayName.charAt(0)}
                    </Avatar>
                  )}
                </ListItemAvatar>

                <ListItemText
                  primary={cook.displayName}
                  secondary={
                    <React.Fragment>
                      <Typography
                        component="span"
                        variant="body2"
                        color="textSecondary"
                      >
                        {cook.motto}
                      </Typography>
                    </React.Fragment>
                  }
                />
                {event.cooks.length > 1 && cook.uid !== authUser.uid ? (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="delete cook"
                      id={"deleteCook_" + cook.uid}
                      color="primary"
                      onClick={onDeleteCook}
                      size="large"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                ) : null}
              </ListItem>
            </React.Fragment>
          ))}
        </List>
        <Box component="div" sx={classes.centerCenter}>
          <Button
            size="small"
            color="primary"
            onClick={onAddCook}
            startIcon={<AddIcon />}
          >
            {TEXT_ADD_COOK_TO_EVENT}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EventInfoPage;
