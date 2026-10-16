import React from "react";
import {Box, Card, Typography} from "@mui/material";

import {useCustomStyles} from "../../../../constants/styles";

/**
 * Props für {@link StatisticTile}.
 *
 * @param title - Überschrift der Kachel (z.B. «Gesamtausgaben»).
 * @param value - Grosse Hauptzahl, bereits formatiert. Wird ignoriert, wenn `hint` gesetzt ist.
 * @param details - Kleine Zeilen unter der Zahl (Anzahl, Rechengrundlage…), bereits formatiert.
 * @param hint - Erklärender Satz statt der Zahl, wenn es (noch) nichts zu zeigen gibt.
 */
type StatisticTileProps = {
  title: string;
  value?: string;
  details?: string[];
  hint?: string;
};

/**
 * Rahmen einer Kennzahl-Kachel der Auswertung: Titel, grosse Zahl (oder ein
 * erklärender Hinweis) und kleine Detailzeilen. Rechnet selbst nichts, alle
 * Texte kommen fertig formatiert.
 *
 * @param props - Siehe {@link StatisticTileProps}.
 */
export const StatisticTile = ({
  title,
  value,
  details = [],
  hint,
}: StatisticTileProps) => {
  const classes = useCustomStyles();

  return (
    <Card variant="outlined" sx={classes.evaluationTile}>
      <Typography variant="subtitle2" color="text.secondary">
        {title}
      </Typography>
      {hint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={classes.evaluationTileHint}
        >
          {hint}
        </Typography>
      ) : (
        <React.Fragment>
          <Box sx={classes.evaluationTileValueRow}>
            {/* h5-Optik, aber <p>: Kacheln sind keine Abschnitte der Seitengliederung */}
            <Typography variant="h5" component="p">
              {value}
            </Typography>
          </Box>
          {details.map((detail) => (
            <Typography key={detail} variant="body2" color="text.secondary">
              {detail}
            </Typography>
          ))}
        </React.Fragment>
      )}
    </Card>
  );
};
