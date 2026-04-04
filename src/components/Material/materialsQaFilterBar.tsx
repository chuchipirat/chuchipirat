/**
 * Erweiterte Filterleiste für die Material-QA-Seite.
 *
 * Bietet Text-Suche, Materialtyp-Filter, QA-Status-Toggle,
 * «Nur mit Problemen»-Chip und Materialanzahl.
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
  MATERIALS as TEXT_MATERIALS,
  FROM as TEXT_FROM,
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
} from "../../constants/text";
import {
  FILTER_MATERIAL_TYPE,
  FILTER_QA_STATUS,
  QA_STATUS_ALL,
  QA_STATUS_CHECKED,
  QA_STATUS_UNCHECKED,
  SHOW_ISSUES_ONLY,
} from "../../constants/text/materialQa";

/**
 * QA-Filter-Status für die Filterleiste.
 */
export type QaFilterStatus = "all" | "checked" | "unchecked";

/**
 * Materialtyp-Filter: leer = alle, oder spezifischer Typ.
 */
export type MaterialTypeFilter = "" | "none" | "consumable" | "usage";

/**
 * Props für die erweiterte Filterleiste.
 *
 * @param searchString - Aktueller Suchtext
 * @param onUpdateSearchString - Callback bei Textänderung
 * @param onClearSearchString - Callback zum Leeren des Suchtexts
 * @param materialTypeFilter - Aktueller Materialtyp-Filter
 * @param onMaterialTypeFilterChange - Callback bei Materialtyp-Filteränderung
 * @param qaFilter - Aktueller QA-Filterstatus
 * @param onQaFilterChange - Callback bei QA-Filteränderung
 * @param showIssuesOnly - Ob nur Materialien mit Problemen angezeigt werden
 * @param onShowIssuesOnlyChange - Callback für den Probleme-Filter
 * @param totalCount - Gesamtanzahl Materialien
 * @param filteredCount - Anzahl gefilterter Materialien
 */
interface MaterialsQaFilterBarProps {
  searchString: string;
  onUpdateSearchString: (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  onClearSearchString: () => void;
  materialTypeFilter: MaterialTypeFilter;
  onMaterialTypeFilterChange: (filter: MaterialTypeFilter) => void;
  qaFilter: QaFilterStatus;
  onQaFilterChange: (status: QaFilterStatus) => void;
  showIssuesOnly: boolean;
  onShowIssuesOnlyChange: (show: boolean) => void;
  totalCount: number;
  filteredCount: number;
}

/**
 * Erweiterte Filterleiste mit Text-Suche, Materialtyp, QA-Status und Probleme-Chip.
 */
export const MaterialsQaFilterBar = ({
  searchString,
  onUpdateSearchString,
  onClearSearchString,
  materialTypeFilter,
  onMaterialTypeFilterChange,
  qaFilter,
  onQaFilterChange,
  showIssuesOnly,
  onShowIssuesOnlyChange,
  totalCount,
  filteredCount,
}: MaterialsQaFilterBarProps) => {
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

        {/* Materialtyp-Filter */}
        <FormControl size="small" sx={{minWidth: 180}}>
          <InputLabel>{FILTER_MATERIAL_TYPE}</InputLabel>
          <Select
            label={FILTER_MATERIAL_TYPE}
            value={materialTypeFilter}
            onChange={(event: SelectChangeEvent) =>
              onMaterialTypeFilterChange(event.target.value as MaterialTypeFilter)
            }
          >
            <MenuItem value="">
              <em>Alle Typen</em>
            </MenuItem>
            <MenuItem value="none">Kein Typ</MenuItem>
            <MenuItem value="consumable">{TEXT_MATERIAL_TYPE_CONSUMABLE}</MenuItem>
            <MenuItem value="usage">{TEXT_MATERIAL_TYPE_USAGE}</MenuItem>
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

      {/* Materialanzahl */}
      <Typography variant="body2" sx={{marginTop: "0.5em", marginBottom: "1em"}}>
        {filteredCount === totalCount
          ? `${totalCount} ${TEXT_MATERIALS}`
          : `${filteredCount} ${TEXT_FROM.toLowerCase()} ${totalCount} ${TEXT_MATERIALS}`}
      </Typography>
    </Box>
  );
};
