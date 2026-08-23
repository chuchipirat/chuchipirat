/**
 * Floating-Toolbar für Bulk-Aktionen auf ausgewählten Produkten.
 *
 * Wird angezeigt, wenn im Edit-Modus Produkte via Checkbox selektiert sind.
 * Ermöglicht Massen-Änderung von Abteilung, Diät und QA-Status sowie
 * das Öffnen des Merge-Dialogs (bei genau 2 selektierten Produkten).
 */
import React from "react";
import {
  Button,
  Paper,
  Typography,
  Menu,
  MenuItem,
  Box,
  Chip,
} from "@mui/material";
import {
  MergeType as MergeTypeIcon,
} from "@mui/icons-material";
import {Diet} from "./product.types";
import Department from "../Department/department.class";
import {
  PRODUCTS_SELECTED,
  BULK_CHANGE_DEPARTMENT,
  BULK_CHANGE_DIET,
  BULK_QA_CHECK,
  MERGE_PRODUCTS,
  CLEAR_SELECTION,
} from "../../constants/text/productQa";
import {DIET_TYPES as TEXT_DIET_TYPES} from "../../constants/text";

/**
 * Minimale Produkt-Information für die Anzeige als Chip in der
 * Bulk-Aktionen-Toolbar.
 */
type SelectedProductChip = {
  uid: string;
  name: string;
};

/**
 * Props für die Bulk-Aktionen-Toolbar.
 *
 * @param selectedCount - Anzahl der ausgewählten Produkte
 * @param selectedProducts - Ausgewählte Produkte (uid + name) für die Chip-Anzeige,
 *   unabhängig vom aktuellen Suchfilter
 * @param departments - Verfügbare Abteilungen für die Abteilungsänderung
 * @param onBulkDepartmentChange - Callback für Massen-Abteilungsänderung
 * @param onBulkDietChange - Callback für Massen-Diätänderung
 * @param onBulkQaCheck - Callback für Massen-QA-Markierung
 * @param onMerge - Callback zum Öffnen des Merge-Dialogs
 * @param canMerge - true wenn genau 2 Produkte ausgewählt sind
 * @param onRemoveSelected - Callback zum gezielten Abwählen eines einzelnen Produkts
 * @param onClearSelection - Callback zum Abwählen aller Produkte
 */
interface ProductsQaBulkActionsProps {
  selectedCount: number;
  selectedProducts: SelectedProductChip[];
  departments: Department[];
  onBulkDepartmentChange: (departmentUid: string, departmentName: string) => void;
  onBulkDietChange: (diet: Diet) => void;
  onBulkQaCheck: () => void;
  onMerge: () => void;
  canMerge: boolean;
  onRemoveSelected: (uid: string) => void;
  onClearSelection: () => void;
}

/**
 * Toolbar für Bulk-Aktionen auf selektierten Produkten.
 */
export const ProductsQaBulkActions = ({
  selectedCount,
  selectedProducts,
  departments,
  onBulkDepartmentChange,
  onBulkDietChange,
  onBulkQaCheck,
  onMerge,
  canMerge,
  onRemoveSelected,
  onClearSelection,
}: ProductsQaBulkActionsProps) => {
  const [deptAnchor, setDeptAnchor] = React.useState<HTMLElement | null>(null);
  const [dietAnchor, setDietAnchor] = React.useState<HTMLElement | null>(null);

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
          {PRODUCTS_SELECTED(selectedCount)}
        </Typography>

        {/* Abteilung ändern */}
        <Button
          variant="outlined"
          size="small"
          sx={{color: "inherit", borderColor: "inherit"}}
          onClick={(event) => setDeptAnchor(event.currentTarget)}
        >
          {BULK_CHANGE_DEPARTMENT}
        </Button>
        <Menu
          anchorEl={deptAnchor}
          open={Boolean(deptAnchor)}
          onClose={() => setDeptAnchor(null)}
        >
          {departments.map((department) => (
            <MenuItem
              key={department.uid}
              onClick={() => {
                onBulkDepartmentChange(department.uid, department.name);
                setDeptAnchor(null);
              }}
            >
              {department.name}
            </MenuItem>
          ))}
        </Menu>

        {/* Diät ändern */}
        <Button
          variant="outlined"
          size="small"
          sx={{color: "inherit", borderColor: "inherit"}}
          onClick={(event) => setDietAnchor(event.currentTarget)}
        >
          {BULK_CHANGE_DIET}
        </Button>
        <Menu
          anchorEl={dietAnchor}
          open={Boolean(dietAnchor)}
          onClose={() => setDietAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              onBulkDietChange(Diet.Meat);
              setDietAnchor(null);
            }}
          >
            {TEXT_DIET_TYPES[Diet.Meat]}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onBulkDietChange(Diet.Vegetarian);
              setDietAnchor(null);
            }}
          >
            {TEXT_DIET_TYPES[Diet.Vegetarian]}
          </MenuItem>
          <MenuItem
            onClick={() => {
              onBulkDietChange(Diet.Vegan);
              setDietAnchor(null);
            }}
          >
            {TEXT_DIET_TYPES[Diet.Vegan]}
          </MenuItem>
        </Menu>

        {/* QA geprüft */}
        <Button
          variant="outlined"
          size="small"
          sx={{color: "inherit", borderColor: "inherit"}}
          onClick={onBulkQaCheck}
        >
          {BULK_QA_CHECK}
        </Button>

        {/* Zusammenführen (nur bei 2 Produkten) */}
        <Button
          variant="outlined"
          size="small"
          sx={{color: "inherit", borderColor: "inherit"}}
          disabled={!canMerge}
          startIcon={<MergeTypeIcon />}
          onClick={onMerge}
        >
          {MERGE_PRODUCTS}
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

      {/* Ausgewählte Produkte als Chips — bleiben auch bei aktivem Suchfilter
          sichtbar, damit weggefilterte Auswahlen gezielt abgewählt werden können */}
      <Box sx={{display: "flex", flexWrap: "wrap", gap: 1}}>
        {selectedProducts.map((product) => (
          <Chip
            key={product.uid}
            label={product.name}
            size="small"
            onDelete={() => onRemoveSelected(product.uid)}
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
