import React from "react";
import {Box, Chip} from "@mui/material";

import {
  EVALUATION_AVERAGE_PER_MEAL as TEXT_EVALUATION_AVERAGE_PER_MEAL,
  EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR as TEXT_EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR,
  EVALUATION_MEAL_BASIS as TEXT_EVALUATION_MEAL_BASIS,
  EVALUATION_NO_PLANNED_MEALS as TEXT_EVALUATION_NO_PLANNED_MEALS,
  EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL as TEXT_EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {MealType} from "../../Menuplan/menuplan.types";
import {StatisticTile} from "./statisticTile";

/**
 * Props für {@link MealAverageTile}.
 *
 * @param mealTypes - Mahlzeitentypen des Menüplans, in Menüplan-Reihenfolge.
 * @param excludedMealTypeIds - UIDs der abgewählten Mahlzeitentypen.
 * @param onToggleMealType - Wählt den angeklickten Typ ab bzw. wieder aus.
 * @param mealCount - Anzahl eingeplanter Mahlzeiten der ausgewählten Typen.
 * @param averagePerMealInCents - Ø pro Mahlzeit in Rappen, `null` ohne Mahlzeiten.
 * @param averagePerParticipantAndMealInCents - Ø pro Person und Mahlzeit in
 *   Rappen, `null` ohne Mahlzeiten oder Teilnehmende (dann entfällt die Zeile).
 * @param participantCount - Anzahl Teilnehmende, für die Rechengrundlage.
 * @param currency - Währung der Beträge (ISO-4217-Code).
 */
type MealAverageTileProps = {
  mealTypes: MealType[];
  excludedMealTypeIds: string[];
  onToggleMealType: (mealTypeId: string) => void;
  mealCount: number;
  averagePerMealInCents: number | null;
  averagePerParticipantAndMealInCents: number | null;
  participantCount: number;
  currency: string;
};

/**
 * Kachel «Ø pro Mahlzeit» der Auswertung: Ausgaben pro eingeplanter Mahlzeit,
 * darunter pro Person und Mahlzeit und die Rechengrundlage. Mit Chips wählt
 * die Köchin, welche Mahlzeitentypen zählen (z.B. ohne Zvieri und Dessert,
 * weil kleine Mahlzeiten den Durchschnitt verzerren). Der letzte ausgewählte
 * Typ lässt sich nicht abwählen, damit die Kachel nie leer ist.
 *
 * Rechnet selbst nichts: Alle Werte kommen fertig aus `ExpenseEvaluation`.
 *
 * @param props - Siehe {@link MealAverageTileProps}.
 * @returns Die Kachel mit Zahl oder Hinweis, die Chips immer.
 * @example
 * <MealAverageTile
 *   mealTypes={mealTypes}
 *   excludedMealTypeIds={excludedMealTypeIds}
 *   onToggleMealType={toggleMealType}
 *   mealCount={statistics.mealCount}
 *   averagePerMealInCents={statistics.averagePerMealInCents}
 *   averagePerParticipantAndMealInCents={statistics.averagePerParticipantAndMealInCents}
 *   participantCount={participantCount}
 *   currency={selectedCurrency}
 * />
 */
export const MealAverageTile = ({
  mealTypes,
  excludedMealTypeIds,
  onToggleMealType,
  mealCount,
  averagePerMealInCents,
  averagePerParticipantAndMealInCents,
  participantCount,
  currency,
}: MealAverageTileProps) => {
  const classes = useCustomStyles();
  const selectedCount = mealTypes.filter(
    (mealType) => !excludedMealTypeIds.includes(mealType.uid),
  ).length;

  return (
    <StatisticTile
      title={TEXT_EVALUATION_AVERAGE_PER_MEAL}
      hint={
        averagePerMealInCents === null
          ? TEXT_EVALUATION_NO_PLANNED_MEALS
          : undefined
      }
      value={formatAmountFromCents(averagePerMealInCents ?? 0, currency)}
      details={[
        // ohne Teilnehmende entfällt die Zeile pro Person (null)
        ...(averagePerParticipantAndMealInCents !== null
          ? [
              TEXT_EVALUATION_PER_PARTICIPANT_AND_MEAL_SO_FAR(
                averagePerParticipantAndMealInCents,
                currency,
              ),
            ]
          : []),
        TEXT_EVALUATION_MEAL_BASIS(mealCount, participantCount),
      ]}
    >
      <Box
        role="group"
        aria-label={TEXT_EVALUATION_MEAL_TYPE_FILTER_ARIA_LABEL}
        sx={classes.evaluationMealTypeChips}
      >
        {mealTypes.map((mealType) => {
          const isSelected = !excludedMealTypeIds.includes(mealType.uid);
          return (
            <Chip
              key={mealType.uid}
              label={mealType.name}
              size="small"
              variant="outlined"
              clickable
              onClick={() => onToggleMealType(mealType.uid)}
              aria-pressed={isSelected}
              // der letzte ausgewählte Typ bleibt, sonst gäbe es nichts zu rechnen
              disabled={isSelected && selectedCount === 1}
              sx={
                isSelected ? classes.statisticsCurrencyChipSelected : undefined
              }
            />
          );
        })}
      </Box>
    </StatisticTile>
  );
};
