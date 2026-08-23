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
  Box,
  Chip,
} from "@mui/material";
import {
  MergeType as MergeTypeIcon,
} from "@mui/icons-material";
import {
  MATERIALS_SELECTED,
  BULK_QA_CHECK,
  MERGE_MATERIALS,
  CLEAR_SELECTION,
} from "../../constants/text/materialQa";

/**
 * Minimale Material-Information für die Anzeige als Chip in der
 * Bulk-Aktionen-Toolbar.
 */
type SelectedMaterialChip = {
  uid: string;
  name: string;
};

/**
 * Props für die Bulk-Aktionen-Toolbar.
 *
 * @param selectedCount - Anzahl der ausgewählten Materialien
 * @param selectedMaterials - Ausgewählte Materialien (uid + name) für die Chip-Anzeige,
 *   unabhängig vom aktuellen Suchfilter
 * @param onBulkQaCheck - Callback für Massen-QA-Markierung
 * @param onMerge - Callback zum Öffnen des Merge-Dialogs
 * @param canMerge - true wenn genau 2 Materialien ausgewählt sind
 * @param onRemoveSelected - Callback zum gezielten Abwählen eines einzelnen Materials
 * @param onClearSelection - Callback zum Abwählen aller Materialien
 */
interface MaterialsQaBulkActionsProps {
  selectedCount: number;
  selectedMaterials: SelectedMaterialChip[];
  onBulkQaCheck: () => void;
  onMerge: () => void;
  canMerge: boolean;
  onRemoveSelected: (uid: string) => void;
  onClearSelection: () => void;
}

/**
 * Toolbar für Bulk-Aktionen auf selektierten Materialien.
 */
export const MaterialsQaBulkActions = ({
  selectedCount,
  selectedMaterials,
  onBulkQaCheck,
  onMerge,
  canMerge,
  onRemoveSelected,
  onClearSelection,
}: MaterialsQaBulkActionsProps) => {
  return (
    <Paper
      elevation={3}
      sx={{
        padding: 2,
        marginBottom: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        backgroundColor: "primary.main",
        color: "primary.contrastText",
      }}
    >
      <Box sx={{display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap"}}>
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

        {/* Alle entfernen */}
        <Button
          variant="text"
          size="small"
          sx={{color: "inherit"}}
          onClick={onClearSelection}
        >
          {CLEAR_SELECTION}
        </Button>
      </Box>

      {/* Ausgewählte Materialien als Chips — bleiben auch bei aktivem Suchfilter
          sichtbar, damit weggefilterte Auswahlen gezielt abgewählt werden können */}
      <Box sx={{display: "flex", flexWrap: "wrap", gap: 1}}>
        {selectedMaterials.map((material) => (
          <Chip
            key={material.uid}
            label={material.name}
            size="small"
            onDelete={() => onRemoveSelected(material.uid)}
            sx={{
              color: "inherit",
              borderColor: "inherit",
              backgroundColor: "primary.dark",
              "& .MuiChip-deleteIcon": {color: "inherit"},
            }}
          />
        ))}
      </Box>
    </Paper>
  );
};
