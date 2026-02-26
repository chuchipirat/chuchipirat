import React from "react";

import {
  Typography,
  Card,
  CardMedia,
  CardHeader,
  CardActionArea,
  Box,
  Skeleton,
} from "@mui/material";

import Event from "./event.class";
import {ImageRepository} from "../../../constants/imageRepository";
import useCustomStyles from "../../../constants/styles";
interface EventCardProps {
  event: Event;
  onCardClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}
// ===================================================================== */
/**
 * Rezept-Karte
 * @param Objekt nach mit Event und onCardClickAction
 * @returns JSX-Element
 */

const EventCard = ({event, onCardClick}: EventCardProps) => {
  const classes = useCustomStyles();
  const [hover, setHover] = React.useState(false);

  /* ------------------------------------------
  // Hover
  // ------------------------------------------ */
  const handleHover = () => {
    setHover(true);
  };
  const handleMouseOut = () => {
    setHover(false);
  };
  return (
    <Card
      sx={classes.card}
      onMouseOver={handleHover}
      onMouseOut={handleMouseOut}
      key={"eventcard_" + event.uid}
    >
      <CardActionArea
        name={"eventCardActionArea_" + event.uid}
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

                // backgroundSize: "contain",
              }}
            />
          </div>
          <CardHeader
            title={event.name}
            subheader={
              <Typography variant="body2" color="textSecondary">
                {event.motto}
              </Typography>
            }
          />
        </Box>
      </CardActionArea>
    </Card>
  );
};
/* ===================================================================
// =====================Rezept Karte am laden ========================
// =================================================================== */
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

export default EventCard;
export {EventCardLoading};
