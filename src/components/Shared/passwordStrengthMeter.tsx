import React, {useEffect, useState} from "react";
import * as TEXT from "../../constants/text";

import {
  Typography,
  LinearProgress,
  LinearProgressProps,
  Box,
} from "@mui/material";

import {zxcvbnAsync, zxcvbnOptions} from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnDePackage from "@zxcvbn-ts/language-de";

// zxcvbn-ts Optionen einmalig konfigurieren (Wörterbücher und Tastaturlayouts)
zxcvbnOptions.setOptions({
  translations: zxcvbnDePackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnDePackage.dictionary,
  },
});

/* ===================================================================
// ============================= Hilfsfunktionen =====================
// =================================================================== */

/**
 * Gibt das Label zur Passwortstärke zurück.
 *
 * @param result Ergebnis von zxcvbn mit Score-Wert.
 * @returns Lokalisiertes Label (z.B. «schwach», «stark»).
 */
const getPasswordLabel = (result: {score: number}): string => {
  switch (result.score) {
    case 0:
      return TEXT.PASSWORD_STRENGTH_METER.WEAK;
    case 1:
      return TEXT.PASSWORD_STRENGTH_METER.WEAK;
    case 2:
      return TEXT.PASSWORD_STRENGTH_METER.SUFFICENT;
    case 3:
      return TEXT.PASSWORD_STRENGTH_METER.GOOD;
    case 4:
      return TEXT.PASSWORD_STRENGTH_METER.STRONG;
    default:
      return TEXT.PASSWORD_STRENGTH_METER.WEAK;
  }
};

/**
 * Bestimmt die Fortschrittsbalken-Farbe basierend auf dem Score.
 *
 * @param score zxcvbn-Score (0–4).
 * @param hasPassword Ob ein Passwort eingegeben wurde.
 * @returns MUI LinearProgress Farbwert.
 */
const getProgressColor = (
  score: number,
  hasPassword: boolean
): LinearProgressProps["color"] => {
  if (!hasPassword) return "primary";
  if (score <= 1) return "error";
  if (score === 2) return "warning";
  if (score === 3) return "info";
  if (score === 4) return "success";
  return "primary";
};

/* ===================================================================
// ====================== Password-Strength-Meter =====================
// =================================================================== */
interface PasswordStrengthMeterProps {
  password: string;
}

/**
 * Zeigt einen Fortschrittsbalken und ein Label zur Passwortstärke an.
 * Verwendet zxcvbn-ts (async) zur nicht-blockierenden Bewertung.
 *
 * @param password Das zu bewertende Passwort.
 */
const PasswordStrengthMeter = ({password}: PasswordStrengthMeterProps) => {
  const [score, setScore] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Asynchrone Bewertung, damit der Main-Thread nicht blockiert wird
    zxcvbnAsync(password).then((result) => {
      if (!cancelled) {
        setScore(result.score);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [password]);

  return (
    <React.Fragment>
      <LinearProgress
        variant="determinate"
        value={(100 / 4) * score}
        color={getProgressColor(score, password.length > 0)}
      />
      <Box sx={{mt: 1}} />

      <Typography>
        {TEXT.PASSWORD_HOW_STRONG_IS_IT}
        {password.length > 0 && (
          <strong>{getPasswordLabel({score})}</strong>
        )}
      </Typography>
    </React.Fragment>
  );
};

export {PasswordStrengthMeter};
