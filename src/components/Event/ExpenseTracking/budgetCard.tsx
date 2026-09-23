import {
  Card,
  Box,
  Typography,
  IconButton,
  Chip,
  LinearProgress,
} from "@mui/material";

import {
  EDIT_BUDGET as TEXT_EDIT_BUDGET,
  BUDGET_PER_PERSON_PER_DAY as TEXT_BUDGET_PER_PERSON_PER_DAY,
  BUDGET_TYPE_FIXED_AMOUNT as TEXT_BUDGET_TYPE_FIXED_AMOUNT,
  BUDGET_TARGET_AMOUNT as TEXT_BUDGET_TARGET_AMOUNT,
  BUDGET_TARGET_AMOUNT_MISSING as TEXT_BUDGET_TARGET_AMOUNT_MISSING,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  SPENT_AMOUNT as TEXT_SPENT_AMOUNT,
  OF_LIMIT as TEXT_OF_LIMIT,
} from "../../../constants/text/expenseTracking";
import {EditOutlined, AddOutlined} from "@mui/icons-material";

import {formatAmountFromCents} from "../../Shared/utils/currencyUtils";
import {useCustomStyles} from "../../../constants/styles";

import {BudgetWithProgress, BudgetType} from "./budget.types";
import {BUDGET_ICON_MAP} from "./budgetIcons";

/** Props für die Budget-Karte. */
interface BudgetCardProps {
  budgetWithProgress: BudgetWithProgress;
  handleEditClick: (budgetId: string) => void;
}

/**
 * Karte eines Budgets: Name, Icon, Typ, Fortschrittsbalken und Beträge.
 * Der Balken wird bei 85 % gelb und ab 100 % rot.
 *
 * @param props - Siehe {@link BudgetCardProps}.
 */
export const BudgetCard = ({
  budgetWithProgress,
  handleEditClick,
}: BudgetCardProps) => {
  const classes = useCustomStyles();

  const BudgetIconComponent = BUDGET_ICON_MAP[budgetWithProgress.budget.icon];

  /** Farbe des Fortschrittsbalkens je nach Ausschöpfung des Budgets. */
  const getProgressColor = (
    percentage: number,
  ): "success" | "warning" | "error" => {
    if (percentage >= 100) return "error";
    if (percentage >= 85) return "warning";
    return "success";
  };

  const isPerPersonPerDay =
    budgetWithProgress.budget.budgetType === BudgetType.PER_PERSON_PER_DAY;

  const chipLabel = isPerPersonPerDay
    ? TEXT_BUDGET_PER_PERSON_PER_DAY(
        budgetWithProgress.budget.amountInCents,
        budgetWithProgress.budget.currency,
      )
    : budgetWithProgress.budget.amountInCents
      ? `${TEXT_BUDGET_TYPE_FIXED_AMOUNT}: ${formatAmountFromCents(budgetWithProgress.budget.amountInCents, budgetWithProgress.budget.currency)}`
      : TEXT_BUDGET_TYPE_FIXED_AMOUNT;

  return (
    <Card
      sx={classes.budgetCard}
      elevation={0}
      data-testid={budgetWithProgress.budget.id}
    >
      <Box sx={classes.budgetCardHeader}>
        <Box sx={classes.budgetCardTitleGroup}>
          <BudgetIconComponent fontSize="small" />
          <Typography variant="subtitle1" sx={classes.budgetCardTitle}>
            {budgetWithProgress.budget.name}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={TEXT_EDIT_BUDGET}
          onClick={() => handleEditClick(budgetWithProgress.budget.id)}
        >
          <EditOutlined fontSize="small" />
        </IconButton>
      </Box>

      <Chip
        size="small"
        label={chipLabel}
        sx={
          isPerPersonPerDay
            ? classes.budgetChipVariable
            : classes.budgetChipFixed
        }
      />

      <LinearProgress
        variant="determinate"
        value={Math.min(budgetWithProgress.percentage, 100)}
        color={getProgressColor(budgetWithProgress.percentage)}
        sx={classes.budgetProgressBar}
      />

      <Box sx={classes.budgetAmountRow}>
        <Typography
          variant="body2"
          sx={
            budgetWithProgress.percentage >= 100
              ? classes.budgetAmountOver
              : classes.budgetAmountNormal
          }
        >
          {TEXT_SPENT_AMOUNT(
            budgetWithProgress.spentAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
        <Typography variant="body2" sx={classes.budgetAmountSecondary}>
          {TEXT_OF_LIMIT(
            budgetWithProgress.targetAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
      </Box>
      {budgetWithProgress.otherCurrenciesSpent.map((currency) => {
        const [key, value] = Object.entries(currency)[0];

        return (
          <Box
            key={"budget_" + budgetWithProgress.budget.id + "_currency_" + key}
            sx={classes.budgetSecondaryCurrencyRow}
          >
            <Typography variant="body2" sx={classes.budgetAmountSecondary}>
              {TEXT_SPENT_AMOUNT(value, key)}
            </Typography>
          </Box>
        );
      })}

      {!isPerPersonPerDay && (
        <Box sx={classes.budgetAmountRow}>
          <Typography variant="body2" sx={classes.budgetAmountSecondary}>
            {budgetWithProgress.budget.amountInCents != null
              ? TEXT_BUDGET_TARGET_AMOUNT(
                  budgetWithProgress.budget.amountInCents,
                  budgetWithProgress.budget.currency,
                )
              : TEXT_BUDGET_TARGET_AMOUNT_MISSING}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

/** Props der «Neues Budget»-Karte. */
interface AddBudgetCardProps {
  onClick: () => void;
}

/**
 * Klickbare Karte am Ende der Budget-Liste zum Anlegen eines neuen Budgets.
 * Dient bei leerer Liste zugleich als Leerzustand (analog Einkaufsliste).
 *
 * @param props - Siehe {@link AddBudgetCardProps}.
 */
export const AddBudgetCard: React.FC<AddBudgetCardProps> = ({onClick}) => {
  const classes = useCustomStyles();

  const handleClick = () => {
    onClick();
  };

  // Die Karte ist ein `Box` mit `role="button"` — Enter und Leertaste müssen
  // für die Tastaturbedienung von Hand abgebildet werden.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <Box
      sx={classes.budgetCardAddNew}
      role="button"
      tabIndex={0}
      aria-label={TEXT_NEW_BUDGET}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <AddOutlined fontSize="medium" />
      <Typography variant="body2">{TEXT_NEW_BUDGET}</Typography>
    </Box>
  );
};
