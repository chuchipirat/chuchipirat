import {Grid} from "@mui/material";

import {AddBudgetCard, BudgetCard} from "./budgetCard";
import {BudgetWithProgress} from "./budget.types";

/**
 * Props für {@link BudgetCardGrid}.
 *
 * @param budgetsWithProgress - Budgets mit Fortschritt, eine Karte pro Budget.
 * @param highlightedBudgetIds - Budgets, deren Karte kurz aufleuchtet.
 * @param handleEditClick - Öffnet den Dialog des angeklickten Budgets. Ohne
 *   diesen Handler haben die Karten keinen Knopf zum Bearbeiten.
 * @param handleAddClick - Öffnet den Dialog für ein neues Budget. Ohne diesen
 *   Handler erscheint keine Karte zum Hinzufügen.
 */
type BudgetCardGridProps = {
  budgetsWithProgress: BudgetWithProgress[];
  highlightedBudgetIds: Set<string>;
  handleEditClick?: (budgetId: string) => void;
  handleAddClick?: () => void;
};

/**
 * Raster der Budget-Karten: auf dem Handy einspaltig, ab `md` dreispaltig.
 *
 * @param props - Siehe {@link BudgetCardGridProps}.
 */
export const BudgetCardGrid = ({
  budgetsWithProgress,
  highlightedBudgetIds,
  handleEditClick,
  handleAddClick,
}: BudgetCardGridProps) => (
  <Grid container spacing={2}>
    {budgetsWithProgress.map((budget) => (
      <Grid key={budget.budget.id} size={{xs: 12, md: 4}}>
        <BudgetCard
          budgetWithProgress={budget}
          isHighlighted={highlightedBudgetIds.has(budget.budget.id)}
          handleEditClick={handleEditClick}
        />
      </Grid>
    ))}
    {handleAddClick && (
      <Grid size={{xs: 12, md: 4}}>
        <AddBudgetCard onClick={handleAddClick} />
      </Grid>
    )}
  </Grid>
);
