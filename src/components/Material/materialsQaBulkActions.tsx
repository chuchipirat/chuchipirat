/**
 * Floating-Toolbar für Bulk-Aktionen auf ausgewählten Materialien.
 *
 * Wird angezeigt, wenn im Edit-Modus Materialien via Checkbox selektiert sind.
 * Ermöglicht Massen-QA-Markierung und das Öffnen des Merge-Dialogs
 * (bei genau 2 selektierten Materialien).
 */
import React from "react";
import {
  Button,
  Paper,
  Typography,
} from "@mui/material";
import {
  MergeType as MergeTypeIcon,
} from "@mui/icons-material";
import {
  MATERIALS_SELECTED,
  BULK_QA_CHECK,
  MERGE_MATERIALS,
} from "../../constants/text/materialQa";

/**
 * Props für die Bulk-Aktionen-Toolbar.
 *
 * @param selectedCount - Anzahl der ausgewählten Materialien
 * @param onBulkQaCheck - Callback für Massen-QA-Markierung
 * @param onMerge - Callback zum Öffnen des Merge-Dialogs
 * @param canMerge - true wenn genau 2 Materialien ausgewählt sind
 */
interface MaterialsQaBulkActionsProps {
  selectedCount: number;
  onBulkQaCheck: () => void;
  onMerge: () => void;
  canMerge: boolean;
}

/**
 * Toolbar für Bulk-Aktionen auf selektierten Materialien.
 */
export const MaterialsQaBulkActions = ({
  selectedCount,
  onBulkQaCheck,
  onMerge,
  canMerge,
}: MaterialsQaBulkActionsProps) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 2,
        marginBottom: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        backgroundColor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Typography variant="body1" sx={{fontWeight: "bold"}}>
        {MATERIALS_SELECTED(selectedCount)}
      </Typography>

      {/* QA geprüft */}
      <Button
        variant="outlined"
        size="small"
        sx={{color: "inherit", borderColor: "inherit"}}
        onClick={onBulkQaCheck}
      >
        {BULK_QA_CHECK}
      </Button>

      {/* Zusammenführen (nur bei 2 Materialien) */}
      <Button
        variant="outlined"
        size="small"
        sx={{color: "inherit", borderColor: "inherit"}}
        disabled={!canMerge}
        startIcon={<MergeTypeIcon />}
        onClick={onMerge}
      >
        {MERGE_MATERIALS}
      </Button>
    </Paper>
  );
};
