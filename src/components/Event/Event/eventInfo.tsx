import * as Sentry from "@sentry/react";
import React from "react";
import {useTheme} from "@mui/material/styles";
import {trackEvent} from "../../Analytics/analyticsService";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {generateAndDownloadPdf} from "../../Shared/pdfUtils";

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
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  ReceiptLong as ReceiptLongIcon,
} from "@mui/icons-material";

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
  IMAGE_FORMAT_NOT_SUPPORTED as TEXT_IMAGE_FORMAT_NOT_SUPPORTED,
  IMAGE_TOO_LARGE as TEXT_IMAGE_TOO_LARGE,
} from "../../../constants/text";

import {DONATION_RECEIPT_DOWNLOAD as TEXT_DONATION_RECEIPT_DOWNLOAD} from "../../../constants/text/donations";
import {DonationDomain} from "../../Donate/donation.types";
import {DonationReceiptPdf} from "../../Donate/DonationReceiptPdf";
import {useCustomStyles} from "../../../constants/styles";

import {ImageRepository} from "../../../constants/imageRepository";

import {Event,EventRefDocuments} from "./event.class";
import {User} from "../../User/user.class";

import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import {FeedType} from "../../Shared/feed.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {Utils} from "../../Shared/utils.class";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";
import {DialogAddUser} from "../../User/dialogAddUser";
import {
  FormValidationFieldError,
  FormValidatorUtil,
} from "../../Shared/fieldValidation.error.class";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import {Action} from "../../../constants/actions";
import {Receipt} from "./receipt.class";
import {EventReceiptPdf} from "./eventRecipePdf";
import {EventDate} from "./event.class";
import {DatePicker} from "@mui/x-date-pickers";
import dayjs, {Dayjs} from "dayjs";


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
  dates: EventDate[],
): EventDate[] => {
  if (eventDate.pos === totalDates) {
    const newDate = Event.createDateEntry();
    newDate.pos = eventDate.pos + 1;
    dates.push(newDate);
  }
  return dates;
};

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
  const [eventDonation, setEventDonation] =
    React.useState<DonationDomain | null>(null);
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
  // Spende für dieses Event laden
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!event.uid) return;

    database.donations
      .getEventDonations(event.uid)
      .then((donations) => {
        setEventDonation(donations.length > 0 ? donations[0] : null);
      })
      .catch((error) => {
        Sentry.captureException(error, {
          extra: {context: "Event-Spende laden"},
        });
      });
  }, [event.uid]);

  /* ------------------------------------------
  // Field-Change
  // ------------------------------------------ */
  const onFieldUpdate = (actionEvent: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateEvent({
      ...event,
      [actionEvent.target.name]: actionEvent.target.value,
    } as Event);
  };
  const onDatePickerUpdate = (
    date: Dayjs | null,
    dateUid: string,
    fieldName: "from" | "to",
  ) => {
    let updatedDates = [...event.dates];
    const eventDate = updatedDates.find(
      (eventDate) => eventDate.uid === dateUid,
    );
    if (!eventDate) {
      return;
    }

    // Null = Benutzer hat das Feld geleert → auf Epoch zurücksetzen,
    // damit die Validierung erkennt, dass kein Datum gesetzt ist.
    if (!date) {
      eventDate[fieldName] = new Date(0);
    } else {
      const normalizedDate = normalizeDateHours(date.toDate(), fieldName);
      eventDate[fieldName] = normalizedDate;

      if (fieldName === "from") {
        autoFillToDate(eventDate, normalizedDate);
      }
    }

    updatedDates = autoAppendDateRow(
      eventDate,
      event.dates.length,
      updatedDates,
    );
    updatedDates = Utils.renumberArray({array: updatedDates, field: "pos"});

    onUpdateEvent({...event, dates: updatedDates} as Event);

    if (onFormValidationUpdate) {
      onFormValidationUpdate(Event.validateDates(updatedDates));
    }
  };
  const onDateDeleteClick = (event_: React.MouseEvent<HTMLButtonElement>) => {
    const dateUid = event_.currentTarget.dataset.dateUid;
    if (!dateUid) return;

    let updatedDates = event.dates.filter(
      (eventDate) => eventDate.uid !== dateUid,
    );
    updatedDates = Utils.renumberArray({array: updatedDates, field: "pos"});

    onUpdateEvent({...event, dates: updatedDates} as Event);

    // Inline-Datumsvalidierung auslösen
    if (onFormValidationUpdate) {
      onFormValidationUpdate(Event.validateDates(updatedDates));
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
        // Bild aus Supabase Storage löschen
        await database.storage.events.remove(event.uid + "/cover.jpg").catch(() => {
          // Ignorieren falls kein Bild vorhanden
        });
        // Event-Dokument aktualisieren (Bild-URL leeren)
        const eventDomain = database.events.eventUiToDomain({...event, pictureSrc: ""} as Event);
        await database.events.updateEvent(eventDomain, authUser);
        onUpdateEvent({...event, pictureSrc: ""} as Event);
      } catch (error) {
        onError?.(error as Error);
      }
    }
  };
  /* ------------------------------------------
  // Köche-Handling
  // ------------------------------------------ */
  const onOpenAddCookDialog = () => {
    setDialogAddUserOpen(true);
  };
  const onCloseAddCookDialog = () => {
    setDialogAddUserOpen(false);
  };
  const onAddCookToEvent = async (personUid: string) => {
    if (!personUid) {
      setDialogAddUserOpen(false);
      return;
    }

    try {
      const publicProfile = await User.getPublicProfile({
        database: database,
        uid: personUid,
      });

      // Koch zum lokalen State hinzufügen
      const updatedCooks = [
        ...event.cooks,
        {
          uid: personUid,
          displayName: publicProfile.displayName,
          motto: publicProfile.motto,
          pictureSrc: publicProfile.pictureSrc,
        },
      ];

      if (event.uid) {
        // Koch in Supabase hinzufügen — publicProfile.uid enthält die Auth-UUID
        await database.events.addCook(event.uid, personUid, authUser);
        trackEvent(AnalyticsEvent.EVENT_COOK_ADDED);

        // Feed-Eintrag: Koch zum Team hinzugefügt
        database.feeds
          .insertFeed(
            {
              feedType: FeedType.eventCookAdded,
              sourceObjectType: "event",
              sourceObjectUid: event.uid,
              userUid: personUid,
            },
            authUser,
          )
          .catch((error) => Sentry.captureException(error, {extra: {context: "Feed-Eintrag erstellen"}}));
      }

      onUpdateEvent({...event, cooks: updatedCooks} as Event);
    } catch (error) {
      onError?.(error as Error);
    }
    setDialogAddUserOpen(false);
  };
  const onDeleteCook = async (event_: React.MouseEvent<HTMLButtonElement>) => {
    const cookUidToDelete = event_.currentTarget.dataset.cookUid;
    if (!cookUidToDelete) {
      return;
    }

    try {
      // Koch aus dem lokalen State entfernen
      const updatedCooks = event.cooks.filter(
        (cook) => cook.uid !== cookUidToDelete,
      );

      if (event.uid) {
        // Den Cook-Eintrag in Supabase finden und löschen
        // event.cooks enthält Cook-Objekte mit uid = userId (Auth-UUID)
        // Wir müssen die event_cooks-Zeile via Realtime/Event-Reload finden
        // Da subscribeToEvent die Köche als EventCookDomain liefert und
        // eventDomainToClass die userId als cook.uid setzt, können wir über
        // die Events-Tabelle den richtigen Cook-Record ermitteln.
        const eventDomain = await database.events.getEvent(event.uid);
        const cookRecord = eventDomain?.cooks.find(
          (c) => c.userId === cookUidToDelete,
        );
        if (cookRecord) {
          await database.events.removeCook(cookRecord.uid);
          trackEvent(AnalyticsEvent.EVENT_COOK_REMOVED);
        }
      }

      onUpdateEvent({...event, cooks: updatedCooks} as Event);
    } catch (error) {
      onError?.(error as Error);
    }
  };
  /* ------------------------------------------
  // Quittung
  // ------------------------------------------ */
  const onDownloadReceipt = async () => {
    trackEvent(AnalyticsEvent.PDF_EXPORTED, {type: "receipt"});
    try {
      const receiptData = await Receipt.getReceipt({
        firebase: firebase,
        eventUid: event.uid,
      });
      await generateAndDownloadPdf(
        <EventReceiptPdf receiptData={receiptData} authUser={authUser} />,
        event.name + TEXT_CREATE_RECEIPT + TEXT_SUFFIX_PDF,
        (error) => onError?.(error),
        {eventUid: event.uid},
      );
    } catch (error) {
      Sentry.captureException(error);
      onError?.(error as Error);
    }
  };

  /* ------------------------------------------
  // Spendenquittung
  // ------------------------------------------ */
  const onDownloadDonationReceipt = async () => {
    if (!eventDonation) return;
    trackEvent(AnalyticsEvent.DONATION_RECEIPT_DOWNLOADED);
    try {
      await generateAndDownloadPdf(
        <DonationReceiptPdf donation={eventDonation} authUser={authUser} />,
        `${TEXT_DONATION_RECEIPT_DOWNLOAD}${eventDonation.eventName ? ` ${eventDonation.eventName}` : ""}${TEXT_SUFFIX_PDF}`,
        (error) => onError?.(error),
        {donationId: eventDonation.id},
      );
    } catch (error) {
      Sentry.captureException(error);
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
          onError={onError}
          previewPictureUrl={
            localPicture ? URL.createObjectURL(localPicture) : ""
          }
          onDownloadReceipt={onDownloadReceipt}
          eventDonation={eventDonation}
          onDownloadDonationReceipt={onDownloadDonationReceipt}
        />
        <EventCookingTeamCard
          event={event}
          formValidation={formValidation}
          authUser={authUser}
          onAddCook={onOpenAddCookDialog}
          onDeleteCook={onDeleteCook}
        />
      </Stack>
      <DialogAddUser
        database={database}
        authUser={authUser}
        eventId={event.uid || undefined}
        dialogOpen={dialogAddUserOpen}
        handleAddUser={onAddCookToEvent}
        handleClose={onCloseAddCookDialog}
      />
    </React.Fragment>
  );
};
/** Props für die Basis-Informationskarte des Events. */
interface EventBasicInfoCardProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Callback bei Änderung eines Textfeldes. */
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback bei Änderung eines Datums. */
  onDatePickerUpdate: (
    date: Dayjs | null,
    dateUid: string,
    fieldName: "from" | "to",
  ) => void;
  /** Callback zum Löschen einer Datumszeile. */
  onDateDeleteClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback beim Hochladen eines Bildes. */
  onImageUpload: (file: File | null) => void;
  /** Callback zum Löschen des Bildes. */
  onImageDelete: () => void;
  /** Callback bei Fehlern (z.B. Bildvalidierung). */
  onError?: (error: Error) => void;
  /** Callback zum Herunterladen der Quittung als PDF. */
  onDownloadReceipt: () => void;
  /** Bestätigte Spende für dieses Event (null wenn keine vorhanden). */
  eventDonation: DonationDomain | null;
  /** Callback zum Herunterladen der Spendenquittung als PDF. */
  onDownloadDonationReceipt: () => void;
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
  onError,
  onDownloadReceipt,
  eventDonation,
  onDownloadDonationReceipt,
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
          (event.refDocuments?.includes(EventRefDocuments.receipt) ||
            eventDonation) && (
            <Stack
              direction="row"
              spacing={1}
              sx={{mt: theme.spacing(1), mr: theme.spacing(0.6)}}
            >
              {event.refDocuments?.includes(EventRefDocuments.receipt) && (
                <Button
                  color="primary"
                  variant="outlined"
                  onClick={onDownloadReceipt}
                >
                  {TEXT_RECEIPT}
                </Button>
              )}
              {eventDonation && (
                <Button
                  color="primary"
                  variant="outlined"
                  startIcon={<ReceiptLongIcon />}
                  onClick={onDownloadDonationReceipt}
                >
                  {TEXT_DONATION_RECEIPT_DOWNLOAD}
                </Button>
              )}
            </Stack>
          )
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
                  slotProps={{htmlInput: {maxLength: 200}}}
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
                  slotProps={{htmlInput: {maxLength: 500}}}
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
                  slotProps={{htmlInput: {maxLength: 200}}}
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
              onError={onError}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
/** Props für den Datums-Bereich. */
interface EventDatesSectionProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Aktuelle Formular-Validierungsfehler. */
  formValidation: FormValidationFieldError[];
  /** Callback bei Änderung eines Datums. */
  onDatePickerUpdate: (
    date: Dayjs | null,
    dateUid: string,
    fieldName: "from" | "to",
  ) => void;
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
              format="DD.MM.YYYY"
              value={
                eventDate.from?.getTime() === EPOCH_TIME ? null : dayjs(eventDate.from)
              }
              onChange={(date) =>
                onDatePickerUpdate(date, eventDate.uid, "from")
              }
              slotProps={{
                textField: {
                  helperText: FormValidatorUtil.getHelperText(
                    formValidation,
                    "dateFrom_" + eventDate.uid,
                    "",
                  ),
                  error: FormValidatorUtil.isFieldErroneous(
                    formValidation,
                    "dateFrom_" + eventDate.uid,
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
              format="DD.MM.YYYY"
              value={
                eventDate.to?.getTime() === EPOCH_TIME ? null : dayjs(eventDate.to)
              }
              onChange={(date) => onDatePickerUpdate(date, eventDate.uid, "to")}
              slotProps={{
                textField: {
                  helperText: FormValidatorUtil.getHelperText(
                    formValidation,
                    "dateTo_" + eventDate.uid,
                    "",
                  ),
                  error: FormValidatorUtil.isFieldErroneous(
                    formValidation,
                    "dateTo_" + eventDate.uid,
                  ),
                },
              }}
            />
          </Grid>
          <Grid sx={classes.centerCenter} size={1}>
            <Tooltip title={TEXT_DELETE_DATES}>
              <span>
                <IconButton
                  data-date-uid={eventDate.uid}
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
/** Erlaubte MIME-Typen für Event-Bilder. */
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Maximale Dateigrösse für Event-Bilder (10 MB, wird vor Upload auf <2 MB skaliert). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
  /** Callback bei Fehlern (z.B. ungültiges Format oder zu grosse Datei). */
  onError?: (error: Error) => void;
}

/**
 * Bild-Bereich der Event-Informationskarte.
 * Zeigt eine Bildvorschau und Buttons zum Hochladen bzw. Löschen
 * des Event-Bildes. Validiert Format und Dateigrösse vor der Übernahme.
 */
const EventImageSection = ({
  event,
  previewPictureUrl,
  onImageUpload,
  onImageDelete,
  onError,
}: EventImageSectionProps) => {
  const classes = useCustomStyles();
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    if (!selectedFile) return;

    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      onError?.(new Error(TEXT_IMAGE_FORMAT_NOT_SUPPORTED));
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      onError?.(new Error(TEXT_IMAGE_TOO_LARGE));
      return;
    }

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
                    : ImageRepository.getEnvironmentRelatedPicture()
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
            accept="image/jpeg,image/png,image/webp"
            style={{display: "none"}}
            id="icon-button-file"
            type="file"
            aria-label="Event-Bild hochladen"
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
                      aria-label={`Koch ${cook.displayName} entfernen`}
                      data-cook-uid={cook.uid}
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

export {EventInfoPage};
