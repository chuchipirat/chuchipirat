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
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";

import {ImageRepository} from "../../../constants/imageRepository";
import {useCustomStyles} from "../../../constants/styles";

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

interface EventCardProps {
  event: EventCardData;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Optionaler Callback zum Kopieren des Events. Zeigt das Kontextmenü nur wenn gesetzt. */
  onCopyClick?: (event: EventCardData) => void;
}


const formatDay = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;

const formatFull = (d: Date) =>
  `${formatDay(d)}${d.getFullYear()}`;

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

// ===================================================================== */
/**
 * Event-Karte mit Bild, Name, Motto und optionalem Datumsbereich.
 *
 * @param event - Die Event-Daten
 * @param onCardClick - Callback beim Klick auf die Karte
 * @returns JSX-Element
 */
const EventCard = ({event, onCardClick, onCopyClick}: EventCardProps) => {
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
            backgroundColor: "rgba(255,255,255,0.7)",
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
      <CardActionArea
        data-event-uid={event.uid}
        onClick={onCardClick}
        style={{height: "100%"}}
      >
        <Box component="div" sx={classes.card}>
          <div style={{overflow: "hidden"}}>
            <CardMedia
              sx={classes.cardMedia}
              image={
                event.pictureSrc
                  ? event.pictureSrc
                  : ImageRepository.getEnvironmentRelatedPicture()
                      .CARD_PLACEHOLDER_MEDIA
              }
              title={event.name}
              style={{
                transform: hover ? "scale(1.05)" : "scale(1)",
                transition: "0.5s ease",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "contain",
              }}
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
                  <Typography variant="caption" color="textSecondary" key={i} display="block">
                    {line}
                  </Typography>
                ))}
              </React.Fragment>
            }
          />
        </Box>
      </CardActionArea>
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
