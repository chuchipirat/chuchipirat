import {Theme} from "@mui/material/styles";
import {alpha} from "@mui/system/colorManipulator";

/**
 * Styles der Abrechnungsseite (Budget-Karten, Fortschritt, Dialog-Formular).
 * Ausgelagert aus `styles.ts` und dort in `useCustomStyles()` eingehängt.
 *
 * @param theme - Das aktive MUI-Theme.
 * @returns Style-Objekte für die `sx`-Prop.
 */
export const getExpenseTrackingStyles = (theme: Theme) => ({
  budgetCard: {
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(2),
    borderRadius: "12px",
    border: `1px solid ${theme.palette.divider}`,
  },
  budgetCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing(1),
  },
  budgetCardTitleGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  budgetCardTitle: {
    fontWeight: 500,
  },
  budgetChipFixed: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  budgetChipVariable: {
    backgroundColor: alpha(theme.palette.info.main, 0.12),
    color: theme.palette.info.main,
  },
  budgetProgressBar: {
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(0.75),
    height: "8px",
    borderRadius: "4px",
    backgroundColor: theme.palette.action.hover,
  },
  budgetAmountRow: {
    display: "flex",
    justifyContent: "space-between",
  },
  budgetAmountNormal: {
    color: theme.palette.text.secondary,
  },
  budgetAmountOver: {
    color: theme.palette.error.main,
    fontWeight: 500,
  },
  budgetAmountSecondary: {
    color: theme.palette.text.secondary,
  },
  budgetSecondaryCurrencyRow: {
    marginTop: theme.spacing(0.75),
    paddingTop: theme.spacing(0.75),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  budgetCardAddNew: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    height: "100%",
    minHeight: "140px",
    padding: theme.spacing(2),
    borderRadius: "12px",
    border: `1px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    cursor: "pointer",
  },
  expenseTrackingToolbar: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
  },
  expenseToolbarToggleGroup: {
    display: "flex",
    width: "100%",
    "& .MuiToggleButton-root": {flex: 1},
    [theme.breakpoints.up("sm")]: {
      display: "inline-flex",
      width: "auto",
      "& .MuiToggleButton-root": {flex: "none"},
    },
  },
  expenseToolbarAction: {
    width: "100%",
    [theme.breakpoints.up("sm")]: {width: "auto"},
  },
  budgetFormAmountRow: {
    display: "flex",
    gap: theme.spacing(2),
    alignItems: "flex-start",
  },
  budgetFormCurrencySelect: {
    minWidth: "100px",
    flexShrink: 0,
  },
  budgetIconPickerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(4, 1fr)",
    },
  },
  budgetIconPickerButton: {
    aspectRatio: "1",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  budgetIconPickerButtonSelected: {
    aspectRatio: "1",
    border: `2px solid ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.palette.primary.main,
  },
  expenseGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
  },
  // Nur bei Gruppenköpfen ab der zweiten Gruppe: grenzt sie sichtbar von der
  // letzten Zeile der vorherigen Gruppe ab (sonst wirkt der Übergang wie
  // eine gewöhnliche weitere Zeile statt einer neuen Budget-Gruppe).
  expenseGroupHeaderSpacing: {
    marginTop: theme.spacing(4),
  },
  expenseGroupHeaderName: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  expenseGroupHeaderTotals: {
    display: "flex",
    gap: theme.spacing(1.5),
    color: theme.palette.text.primary,
  },
  expenseRowPrimary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: theme.spacing(1),
    minWidth: 0, // nötig, damit noWrap+Ellipsis im Flex-Kind wirken kann
  },
  expenseRowSecondary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  expenseRowSecondaryText: {
    flex: 1,
    minWidth: 0, // ohne das schrumpft ein Flex-Kind mit noWrap nicht unter seine Textbreite
  },
  expenseReceiptIconPresent: {
    color: theme.palette.text.secondary,
  },
  expenseReceiptIconMissing: {
    color: theme.palette.warning.main,
  },
  expenseRowAmount: {
    flexShrink: 0,
    fontWeight: 500,
  },
  expenseListFilterChip: {
    marginBottom: theme.spacing(1),
  },
  noExpensesHint: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(4, 2),
  },
  expenseFormAmountRow: {
    display: "grid",
    gap: theme.spacing(2),
    gridTemplateColumns: {xs: "1fr 1fr", sm: "1fr 1fr 100px"},
    gridTemplateAreas: {
      xs: `"date date" "amount currency"`,
      sm: `"date amount currency"`,
    },
  },
  expenseFormDateField: {
    gridArea: "date",
  },
  expenseFormAmountField: {
    gridArea: "amount",
  },
  expenseFormCurrencySelect: {
    gridArea: "currency",
    minWidth: 0, // ersetzt das alte flexShrink: 0 — im Grid nicht mehr nötig
  },
  payeeOptionCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: "8px",
    padding: theme.spacing(1, 1.5),
    marginTop: theme.spacing(1),
  },
  payeeBalanceSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  attachmentDropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(0.5),
    minHeight: "120px",
    padding: theme.spacing(2),
    borderRadius: "12px",
    border: `1px dashed ${theme.palette.divider}`,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    textAlign: "center",
  },
  attachmentDropzoneActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  attachmentRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    gap: theme.spacing(1),
  },
  attachmentFileName: {
    flex: 1,
    minWidth: 0, // sonst schrumpft ein Flex-Kind mit noWrap nicht
  },
  attachmentFileNameRemoved: {
    textDecoration: "line-through",
    color: theme.palette.text.disabled,
  },
  attachmentActions: {
    display: "flex",
    flexShrink: 0,
  },
  budgetProjection: {
    marginTop: theme.spacing(0.75),
    paddingTop: theme.spacing(0.75),
    borderTop: `1px solid ${theme.palette.divider}`, // gleiche Trennlinie wie Fremdwährungszeilen
  },
  budgetProjectionRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  budgetProjectionWarning: {
    color: theme.palette.warning.main,
    fontWeight: 500,
  },
  evaluationTile: {
    height: "100%",
    padding: theme.spacing(2),
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
  evaluationTileValueRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  evaluationTileHint: {
    marginTop: theme.spacing(1),
  },
  evaluationTopExpenseIcon: {
    minWidth: theme.spacing(4),
  },
  statisticsMissingReceiptsAlert: {
    marginBottom: theme.spacing(2),
  },
  statisticsCurrencyChips: {
    display: "flex",
    gap: theme.spacing(1),
  },
  statisticsCurrencyChipSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
  },
  statisticsScopeNote: {
    marginTop: theme.spacing(-1), // näher an die Chips, zu denen er gehört
    marginBottom: theme.spacing(1.5),
  },
  statisticsFilterBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  statisticsFilterButton: {
    maxWidth: "100%",
    minWidth: 0,
    borderRadius: "16px",
    textTransform: "none", // Budgetnamen nicht in Grossbuchstaben verändern
  },
  statisticsFilterButtonActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
  statisticsFilterMenuPaper: {
    maxHeight: "360px", // bei vielen Budgets scrollbar
    minWidth: "240px",
  },
  evaluationHistoryChart: {
    // gestrichelte Soll-Linie; x-charts vergibt pro Serie die Klasse `MuiLineElement-series-<id>`
    "& .MuiLineElement-series-target": {strokeDasharray: "6 4"},
    // heller «Budgetraum» unter der Soll-Linie, aus primary abgeleitet: passt
    // in Light/Dark und zum lila TEST-Theme. Sonst füllt x-charts deckend in der Linienfarbe.
    "& .MuiAreaElement-series-target": {
      fill: alpha(theme.palette.primary.main, 0.08),
    },
  },
  evaluationShareLayout: {
    // Umbruch nach der Breite der Karte statt nach Breakpoints: Die Karte ist
    // je nach Grid-Spalte schmal (md: 5/12), auch wenn der Bildschirm breit ist
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  evaluationShareChart: {
    flexShrink: 0, // Donut behält seine Grösse, die Legende nimmt den Rest
  },
  evaluationShareLegend: {
    // passt neben den Donut erst ab 150px, sonst bricht sie darunter um
    flex: "1 1 150px",
    minWidth: 0, // erlaubt das Kürzen langer Budgetnamen (noWrap) im Flex-Layout
  },
  evaluationShareLegendIcon: {
    minWidth: theme.spacing(3),
  },
  evaluationShareLegendDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
  },
  evaluationShareGroupedNames: {
    display: "block", // eigene Zeile unter Betrag und Anteil
  },
  evaluationMealTypeChips: {
    display: "flex",
    flexWrap: "wrap", // viele Mahlzeitentypen brechen auf schmalen Kacheln um
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
});
