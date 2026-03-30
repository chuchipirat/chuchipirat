/**
 * Floating-Toolbar für Bulk-Aktionen auf ausgewählten Produkten.
 *
 * Wird angezeigt, wenn im Edit-Modus Produkte via Checkbox selektiert sind.
 * Ermöglicht Massen-Änderung von Abteilung, Diät und QA-Status sowie
 * das Öffnen des Merge-Dialogs (bei genau 2 selektierten Produkten).
 */
import React from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  Menu,
  MenuItem,
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
} from "../../constants/text/productQa";
import {DIET_TYPES as TEXT_DIET_TYPES} from "../../constants/text";

/**
 * Props für die Bulk-Aktionen-Toolbar.
 *
 * @param selectedCount - Anzahl der ausgewählten Produkte
 * @param departments - Verfügbare Abteilungen für die Abteilungsänderung
 * @param onBulkDepartmentChange - Callback für Massen-Abteilungsänderung
 * @param onBulkDietChange - Callback für Massen-Diätänderung
 * @param onBulkQaCheck - Callback für Massen-QA-Markierung
 * @param onMerge - Callback zum Öffnen des Merge-Dialogs
 * @param canMerge - true wenn genau 2 Produkte ausgewählt sind
 */
interface ProductsQaBulkActionsProps {
  selectedCount: number;
  departments: Department[];
  onBulkDepartmentChange: (departmentUid: string, departmentName: string) => void;
  onBulkDietChange: (diet: Diet) => void;
  onBulkQaCheck: () => void;
  onMerge: () => void;
  canMerge: boolean;
}

/**
 * Toolbar für Bulk-Aktionen auf selektierten Produkten.
 */
export const ProductsQaBulkActions = ({
  selectedCount,
  departments,
  onBulkDepartmentChange,
  onBulkDietChange,
  onBulkQaCheck,
  onMerge,
  canMerge,
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
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap",
        backgroundColor: "primary.main",
        color: "primary.contrastText",
      }}
    >
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
    </Paper>
  );
};
