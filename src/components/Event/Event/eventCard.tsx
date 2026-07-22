import React from "react";

import {
  Typography,
  Card,
  CardMedia,
  CardHeader,
  CardActionArea,
  Box,
  Skeleton,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  List,
  ListItemButton,
  Checkbox,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";

import {ImageRepository} from "../../../constants/imageRepository";
import {useCustomStyles} from "../../../constants/styles";
import {parseLocalDate} from "../../../utils/dateUtils";
import {EVENT_READINESS_CHECKLIST_TITLE as TEXT_READINESS_CHECKLIST_TITLE} from "../../../constants/text";

/**
 * Minimale Datumsangabe fuer die EventCard-Anzeige.
 * Kompatibel mit EventDateDomain (dateFrom/dateTo) und EventDate (from/to).
 */
interface CardDateEntry {
  dateFrom?: Date;
  dateTo?: Date;
  from?: Date;
  to?: Date;
}

/**
 * Minimales Interface fuer die EventCard-Daten.
 * Wird sowohl von EventDomain als auch von der alten Event-Klasse erfuellt.
 *
 * @param uid - Eindeutige ID des Events
 * @param name - Name des Events
 * @param motto - Motto des Events
 * @param pictureSrc - URL des Event-Bilds
 * @param dates - Zeitscheiben (optional, fuer Datumsanzeige)
 */
export interface EventCardData {
  uid: string;
  name: string;
  motto: string;
  pictureSrc: string;
  dates?: CardDateEntry[];
}

/**
 * Countdown-Badge für die EventCard des nächsten bevorstehenden Anlasses.
 *
 * @param label - Countdown-/Status-Text (z.B. "Heute", "Morgen", "In 5 Tagen", "Tag 2 von 5").
 */
interface EventCardCountdown {
  label: string;
}

/**
 * Wettervorhersage für einen einzelnen Tag, zur Anzeige im Subheader der Karte.
 *
 * @param date - Datum dieses Vorhersagetages ("YYYY-MM-DD", lokal).
 * @param iconLabel - Emoji-Symbol für den Wetterzustand.
 * @param tempMax - Maximaltemperatur in Grad Celsius.
 * @param tempMin - Minimaltemperatur in Grad Celsius.
 */
export interface EventCardWeatherDay {
  date: string;
  iconLabel: string;
  tempMax: number;
  tempMin: number;
}

/**
 * Ein Eintrag der Bereitschafts-Checkliste (Menuplan/Einkaufsliste/Materialliste).
 *
 * @param label - Anzeigetext des Eintrags.
 * @param ready - Ob die Liste für die aktuelle Zeitscheibe bereits existiert.
 * @param onNavigate - Callback beim Klick — navigiert zum passenden Tab des Anlasses.
 */
export interface EventCardReadinessItem {
  label: string;
  ready: boolean;
  onNavigate: () => void;
}

interface EventCardProps {
  event: EventCardData;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Optionaler Callback zum Kopieren des Events. Zeigt das Kontextmenü nur wenn gesetzt. */
  onCopyClick?: (event: EventCardData) => void;
  /** Optionaler Countdown-Badge, nur für den nächsten bevorstehenden bzw. laufenden Anlass. */
  countdown?: EventCardCountdown;
  /** Optionale Mehrtages-Wettervorhersage, angezeigt im Subheader unterhalb des Datumsbereichs. */
  weatherDays?: EventCardWeatherDay[];
  /** Optionale Bereitschafts-Checkliste, angezeigt im Subheader (nur bevorstehende Anlässe, nahe am Start). */
  readiness?: EventCardReadinessItem[];
}

const formatDay = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;

const formatFull = (d: Date) => `${formatDay(d)}${d.getFullYear()}`;

/**
 * Formatiert eine einzelne Zeitscheibe als lesbaren Datumsstring.
 * Zeigt nur ein Datum, falls Start und Ende identisch sind, sonst einen Bereich.
 *
 * @param from - Startdatum
 * @param to - Enddatum
 * @returns Formatierter String (z.B. "12.03. – 14.03.2026")
 */
function formatSingleRange(from: Date, to: Date): string {
  if (from.getTime() === to.getTime()) {
    return formatFull(from);
  }
  return `${formatDay(from)} – ${formatFull(to)}`;
}

/**
 * Formatiert alle Zeitscheiben eines Events als separate Strings.
 * Jede Zeitscheibe wird einzeln dargestellt, damit bei mehreren
 * Zeitscheiben alle Bereiche sichtbar sind.
 *
 * @param dates - Die Zeitscheiben des Events
 * @returns Array mit einem formatierten String pro Zeitscheibe
 */
function formatDateRanges(dates?: CardDateEntry[]): string[] {
  if (!dates || dates.length === 0) return [];

  return dates
    .map((d) => {
      // Kompatibel mit EventDateDomain (dateFrom/dateTo) und EventDate (from/to)
      const from = d.dateFrom ?? d.from;
      const to = d.dateTo ?? d.to;
      if (!from || !to) return "";
      return formatSingleRange(from, to);
    })
    .filter(Boolean);
}

/**
 * Formatiert ein "YYYY-MM-DD"-Datum als kurzes Wochentagskürzel (z.B. "Mo").
 *
 * @param dateStr - Datum als "YYYY-MM-DD" String.
 * @returns Kurzes deutsches Wochentagskürzel.
 */
function formatWeekdayShort(dateStr: string): string {
  return new Intl.DateTimeFormat("de-CH", {weekday: "short"}).format(
    parseLocalDate(dateStr),
  );
}

// ===================================================================== */
/**
 * Event-Karte mit Bild, Name, Motto und optionalem Datumsbereich.
 *
 * @param event - Die Event-Daten
 * @param onCardClick - Callback beim Klick auf die Karte
 * @param onCopyClick - Optionaler Callback zum Kopieren des Events
 * @param countdown - Optionaler Countdown-Badge für den nächsten bevorstehenden bzw. laufenden Anlass
 * @param weatherDays - Optionale Mehrtages-Wettervorhersage
 * @param readiness - Optionale Bereitschafts-Checkliste
 * @returns JSX-Element
 */
const EventCard = ({
  event,
  onCardClick,
  onCopyClick,
  countdown,
  weatherDays,
  readiness,
}: EventCardProps) => {
  const classes = useCustomStyles();
  const [hover, setHover] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);

  /* ------------------------------------------
  // Hover
  // ------------------------------------------ */
  const handleHover = () => {
    setHover(true);
  };
  const handleMouseOut = () => {
    setHover(false);
  };

  /** Kontextmenü öffnen — stopPropagation verhindert Navigation. */
  const handleMenuOpen = (clickEvent: React.MouseEvent<HTMLButtonElement>) => {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();
    setMenuAnchor(clickEvent.currentTarget);
  };

  /** Kontextmenü schliessen. */
  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  /** «Anlass kopieren» im Kontextmenü. */
  const handleCopyClick = () => {
    handleMenuClose();
    onCopyClick?.(event);
  };

  const dateLines = formatDateRanges(event.dates);

  return (
    <Card
      sx={classes.card}
      onMouseOver={handleHover}
      onMouseOut={handleMouseOut}
      key={"eventcard_" + event.uid}
    >
      {/* Kontextmenü-Button — nur sichtbar wenn onCopyClick übergeben */}
      {onCopyClick && (
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            zIndex: 1,
            // backgroundColor: "rgba(255,255,255,0.7)",
            "&:hover": {backgroundColor: "rgba(255,255,255,0.9)"},
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      )}
      {onCopyClick && (
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
        >
          <MenuItem onClick={handleCopyClick}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Anlass kopieren</ListItemText>
          </MenuItem>
        </Menu>
      )}
      {/* Countdown-/Status-Badge — nur für den nächsten bevorstehenden bzw. laufenden Anlass */}
      {countdown && (
        <Chip
          size="small"
          color="primary"
          label={countdown.label}
          sx={{position: "absolute", top: 8, left: 8, zIndex: 1}}
        />
      )}
      <CardActionArea
        data-event-uid={event.uid}
        onClick={onCardClick}
        style={{height: "100%"}}
      >
        <Box component="div" sx={classes.card}>
          <div style={{overflow: "hidden"}}>
            <CardMedia
              component="img"
              loading="lazy"
              sx={{
                aspectRatio: "16 / 9",
                objectFit: "contain",
                objectPosition: "center",
                transform: hover ? "scale(1.05)" : "scale(1)",
                transition: "0.5s ease",
              }}
              image={
                event.pictureSrc
                  ? event.pictureSrc
                  : ImageRepository.getEnvironmentRelatedPicture()
                      .CARD_PLACEHOLDER_MEDIA
              }
              alt={event.name}
              title={event.name}
            />
          </div>
          <CardHeader
            title={event.name}
            subheader={
              <React.Fragment>
                <Typography variant="body2" color="textSecondary">
                  {event.motto}
                </Typography>
                {dateLines.map((line, i) => (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    key={i}
                    display="block"
                  >
                    {line}
                  </Typography>
                ))}
                {weatherDays && weatherDays.length > 0 && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                    sx={{mt: 0.75}}
                  >
                    {weatherDays
                      .map(
                        (day) =>
                          `${formatWeekdayShort(day.date)} ${day.iconLabel} ${Math.round(day.tempMax)}°/${Math.round(day.tempMin)}°`,
                      )
                      .join("   ")}
                  </Typography>
                )}
              </React.Fragment>
            }
          />
        </Box>
      </CardActionArea>
      {/* Bereitschafts-Checkliste — ausserhalb der CardActionArea, da ein
          MUI Checkbox selbst ein interaktives Element ist und nicht
          innerhalb eines anderen Buttons verschachtelt werden darf. */}
      {readiness && readiness.length > 0 && (
        <Box sx={{px: 2, pt: 1, pb: 0.5}}>
          <Typography variant="caption" color="text.secondary">
            {TEXT_READINESS_CHECKLIST_TITLE}
          </Typography>
          <List dense disablePadding>
            {readiness.map((item, i) => (
              <ListItemButton
                key={i}
                onClick={item.onNavigate}
                dense
                disableGutters
                sx={{py: 0, minHeight: 28}}
              >
                <Checkbox
                  checked={item.ready}
                  disabled
                  edge="start"
                  size="small"
                  sx={{p: 0.5}}
                />
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      variant: "body2",
                      color: item.ready ? "text.secondary" : "text.primary",
                    },
                  }}
                  sx={{my: 0}}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </Card>
  );
};
const EventCardLoading = () => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card}>
      {/* Card Media */}
      <Skeleton animation="wave" variant="rectangular" sx={classes.cardMedia} />

      <CardHeader
        sx={classes.cardContent}
        title={
          <Typography gutterBottom={true} variant="h5" component="h2">
            <Skeleton />
          </Typography>
        }
      ></CardHeader>
    </Card>
  );
};

export {EventCard};
export {EventCardLoading};
