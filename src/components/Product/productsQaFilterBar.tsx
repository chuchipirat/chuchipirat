/**
 * Erweiterte Filterleiste für die Produkt-QA-Seite.
 *
 * Bietet Text-Suche, Abteilungs-Filter, QA-Status-Toggle,
 * "Nur mit Problemen"-Chip und Produktanzahl.
 */
import React from "react";
import {
  Box,
  TextField,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from "@mui/material";
import {
  Search as SearchIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import {
  QA_STATUS_ALL,
  QA_STATUS_CHECKED,
  QA_STATUS_UNCHECKED,
  FILTER_DEPARTMENT,
  FILTER_QA_STATUS,
  SHOW_ISSUES_ONLY,
} from "../../constants/text/productQa";
import {
  PRODUCTS as TEXT_PRODUCTS,
  FROM as TEXT_FROM,
} from "../../constants/text";
import {QaFilterStatus} from "./useProductsQa";

/**
 * Props für die erweiterte Filterleiste.
 *
 * @param searchString - Aktueller Suchtext
 * @param onUpdateSearchString - Callback bei Textänderung
 * @param onClearSearchString - Callback zum Leeren des Suchtexts
 * @param qaFilter - Aktueller QA-Filterstatus
 * @param onQaFilterChange - Callback bei QA-Filteränderung
 * @param departmentFilter - UID der gefilterten Abteilung (leer = alle)
 * @param onDepartmentFilterChange - Callback bei Abteilungsänderung
 * @param availableDepartments - Liste verfügbarer Abteilungen für den Filter
 * @param showIssuesOnly - Ob nur Produkte mit Problemen angezeigt werden
 * @param onShowIssuesOnlyChange - Callback für den Probleme-Filter
 * @param totalCount - Gesamtanzahl Produkte
 * @param filteredCount - Anzahl gefilterter Produkte
 */
interface ProductsQaFilterBarProps {
  searchString: string;
  onUpdateSearchString: (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  onClearSearchString: () => void;
  qaFilter: QaFilterStatus;
  onQaFilterChange: (status: QaFilterStatus) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (departmentUid: string) => void;
  availableDepartments: {uid: string; name: string}[];
  showIssuesOnly: boolean;
  onShowIssuesOnlyChange: (show: boolean) => void;
  totalCount: number;
  filteredCount: number;
}

/**
 * Erweiterte Filterleiste mit Text-Suche, Abteilung, QA-Status und Probleme-Chip.
 */
export const ProductsQaFilterBar = ({
  searchString,
  onUpdateSearchString,
  onClearSearchString,
  qaFilter,
  onQaFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  availableDepartments,
  showIssuesOnly,
  onShowIssuesOnlyChange,
  totalCount,
  filteredCount,
}: ProductsQaFilterBarProps) => {
  return (
    <Box sx={{marginBottom: 2}}>
      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 1,
        }}
      >
        {/* Textsuche */}
        <TextField
          size="small"
          placeholder="Suche..."
          value={searchString}
          onChange={onUpdateSearchString}
          sx={{minWidth: 200, flex: 1, maxWidth: 400}}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchString ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={onClearSearchString}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* Abteilungs-Filter */}
        <FormControl size="small" sx={{minWidth: 180}}>
          <InputLabel>{FILTER_DEPARTMENT}</InputLabel>
          <Select
            label={FILTER_DEPARTMENT}
            value={departmentFilter}
            onChange={(event: SelectChangeEvent) =>
              onDepartmentFilterChange(event.target.value)
            }
          >
            <MenuItem value="">
              <em>Alle Abteilungen</em>
            </MenuItem>
            {availableDepartments.map((department) => (
              <MenuItem key={department.uid} value={department.uid}>
                {department.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* QA-Status */}
        <FormControl size="small" sx={{minWidth: 140}}>
          <InputLabel>{FILTER_QA_STATUS}</InputLabel>
          <Select
            label={FILTER_QA_STATUS}
            value={qaFilter}
            onChange={(event: SelectChangeEvent) =>
              onQaFilterChange(event.target.value as QaFilterStatus)
            }
          >
            <MenuItem value="all">{QA_STATUS_ALL}</MenuItem>
            <MenuItem value="checked">{QA_STATUS_CHECKED}</MenuItem>
            <MenuItem value="unchecked">{QA_STATUS_UNCHECKED}</MenuItem>
          </Select>
        </FormControl>

        {/* Probleme-Chip */}
        <Chip
          label={SHOW_ISSUES_ONLY}
          variant={showIssuesOnly ? "filled" : "outlined"}
          color={showIssuesOnly ? "warning" : "default"}
          onClick={() => onShowIssuesOnlyChange(!showIssuesOnly)}
          clickable
        />
      </Box>

      {/* Produktanzahl */}
      <Typography variant="body2" sx={{marginTop: "0.5em", marginBottom: "1em"}}>
        {filteredCount === totalCount
          ? `${totalCount} ${TEXT_PRODUCTS}`
          : `${filteredCount} ${TEXT_FROM.toLowerCase()} ${totalCount} ${TEXT_PRODUCTS}`}
      </Typography>
    </Box>
  );
};
