import React from "react";
import {
  Button,
  Checkbox,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import {ArrowDropDown} from "@mui/icons-material";

import {BudgetDomain} from "../Budget/budget.types";
import {
  EVALUATION_BUDGET_FILTER_ALL as TEXT_EVALUATION_BUDGET_FILTER_ALL,
  EVALUATION_BUDGET_FILTER_ARIA_LABEL as TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {BUDGET_ICON_MAP} from "../Budget/budgetIcons";
import {getBudgetFilterLabel} from "./evaluationLabels";

/**
 * Props für {@link BudgetFilter}.
 *
 * @param budgets - Alle Budgets des Anlasses, in der Reihenfolge der Übersicht.
 * @param deselectedBudgetIds - IDs der abgewählten Budgets (B3). Unbekannte IDs
 *   (gelöschte Budgets) werden ignoriert.
 * @param onToggleBudget - Wählt das angeklickte Budget ab bzw. wieder aus.
 * @param onSelectAllBudgets - Wählt alle Budgets wieder aus (leert die Abwahl).
 */
type BudgetFilterProps = {
  budgets: BudgetDomain[];
  deselectedBudgetIds: string[];
  onToggleBudget: (budgetId: string) => void;
  onSelectAllBudgets: () => void;
};

/**
 * Button mit Dropdown, um die Budgets der Auswertung zu wählen. Die
 * Beschriftung zeigt die aktuelle Auswahl («Alle Budgets», ein Budgetname
 * oder «2 von 4 Budgets»). Das letzte ausgewählte Budget lässt sich nicht
 * abwählen, damit die Auswertung nie ganz leer ist.
 *
 * @param props - Siehe {@link BudgetFilterProps}.
 */
export const BudgetFilter = ({
  budgets,
  deselectedBudgetIds,
  onToggleBudget,
  onSelectAllBudgets,
}: BudgetFilterProps) => {
  const classes = useCustomStyles();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(
    null,
  );

  const selectedBudgets = budgets.filter(
    (budget) => !deselectedBudgetIds.includes(budget.id),
  );
  const isFilterActive = selectedBudgets.length < budgets.length;
  const selectionLabel = getBudgetFilterLabel(selectedBudgets, budgets.length);

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        endIcon={<ArrowDropDown />}
        onClick={(clickEvent) => setAnchorElement(clickEvent.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorElement)}
        aria-label={TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL(selectionLabel)}
        sx={[
          classes.statisticsFilterButton,
          isFilterActive && classes.statisticsFilterButtonActive,
        ]}
      >
        <Typography component="span" variant="inherit" noWrap>
          {selectionLabel}
        </Typography>
      </Button>

      <Menu
        anchorEl={anchorElement}
        open={Boolean(anchorElement)}
        onClose={() => setAnchorElement(null)}
        slotProps={{paper: {sx: classes.statisticsFilterMenuPaper}}}
      >
        <MenuItem onClick={onSelectAllBudgets} disabled={!isFilterActive}>
          <ListItemText>{TEXT_EVALUATION_BUDGET_FILTER_ALL}</ListItemText>
        </MenuItem>
        <Divider />
        {budgets.map((budget) => {
          const BudgetIconComponent = BUDGET_ICON_MAP[budget.icon];
          const isSelected = !deselectedBudgetIds.includes(budget.id);
          const isLastSelected = isSelected && selectedBudgets.length === 1;
          return (
            <MenuItem
              key={budget.id}
              role="menuitemcheckbox"
              aria-checked={isSelected}
              disabled={isLastSelected}
              onClick={() => onToggleBudget(budget.id)}
            >
              <Checkbox
                edge="start"
                checked={isSelected}
                disableRipple
                tabIndex={-1}
              />
              <ListItemIcon>
                <BudgetIconComponent fontSize="small" />
              </ListItemIcon>
              <ListItemText>{budget.name}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
