import {Theme} from "@mui/material/styles";
import {alpha} from "@mui/system/colorManipulator";
import {lineClasses} from "@mui/x-charts/LineChart";

/**
 * Styles der Abrechnungsseite (Budget-Karten, Fortschritt, Dialog-Formular).
 * Ausgelagert aus `styles.ts` und dort in `useCustomStyles()` eingehängt.
 *
 * @param theme - Das aktive MUI-Theme.
 * @returns Style-Objekte für die `sx`-Prop.
 */
export const getExpenseTrackingStyles = (theme: Theme) => ({
  /* ------------------------------------------
  // Seite und Toolbar
  // ------------------------------------------ */
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

  /* ------------------------------------------
  // Budget-Karte inkl. Hochrechnung
  // ------------------------------------------ */
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

  /* ------------------------------------------
  // Budget-Dialog
  // ------------------------------------------ */
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

  /* ------------------------------------------
  // Ausgabenliste
  // ------------------------------------------ */
  expenseListFilterChip: {
    marginBottom: theme.spacing(1),
  },
  noExpensesHint: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(4, 2),
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
  expenseRowAmount: {
    flexShrink: 0,
    fontWeight: 500,
  },
  expenseReceiptIconPresent: {
    color: theme.palette.text.secondary,
  },
  expenseReceiptIconMissing: {
    color: theme.palette.warning.main,
  },

  /* ------------------------------------------
  // Ausgaben-Dialog (Formular, zahlende Instanz, Beleg)
  // ------------------------------------------ */
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

  /* ------------------------------------------
  // Übersicht: Beträge pro Person
  // ------------------------------------------ */
  expenseOverviewDivider: {
    // Abstand zur letzten Budgetkarte und zu den Beträgen pro Person
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  payeeBalanceSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },

  /* ------------------------------------------
  // Auswertung
  // ------------------------------------------ */
  evaluationMissingReceiptsAlert: {
    marginBottom: theme.spacing(2),
  },
  evaluationFilterBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  evaluationFilterButton: {
    maxWidth: "100%",
    minWidth: 0,
    borderRadius: "16px",
    textTransform: "none", // Budgetnamen nicht in Grossbuchstaben verändern
  },
  evaluationFilterButtonActive: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
  evaluationFilterMenuPaper: {
    maxHeight: "360px", // bei vielen Budgets scrollbar
    minWidth: "240px",
  },
  evaluationCurrencyChips: {
    display: "flex",
    gap: theme.spacing(1),
  },
  evaluationCurrencyChipSelected: {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
    color: theme.palette.primary.main,
  },
  evaluationScopeNote: {
    marginTop: theme.spacing(-1), // näher an die Chips, zu denen er gehört
    marginBottom: theme.spacing(1.5),
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
  evaluationHistoryChart: {
    // gestrichelte Soll-Linie. x-charts kennzeichnet die Serie über das
    // Attribut `data-series` (Wert = Serien-ID, siehe TARGET_SERIES_ID in
    // expenseHistoryChart.tsx); die Klassen kommen aus `lineClasses`, damit
    // eine Umbenennung in x-charts als Typfehler auffällt statt still zu brechen.
    [`& .${lineClasses.line}[data-series="target"]`]: {strokeDasharray: "6 4"},
    // heller «Budgetraum» unter der Soll-Linie, aus primary abgeleitet: passt
    // in Light/Dark und zum lila TEST-Theme. Sonst füllt x-charts deckend in der Linienfarbe.
    [`& .${lineClasses.area}[data-series="target"]`]: {
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
  /* PDF-Abrechnung */

  /* ------------------------------------------
  // PDF-Abrechnung
  // ------------------------------------------ */
  expenseReportDialogContent: {
    paddingTop: theme.spacing(1), // sonst schneidet DialogContent das Label des ersten Feldes ab
  },
  expenseReportProgress: {
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
    paddingTop: theme.spacing(2),
  },

  /* ------------------------------------------
  // Vorschau ohne Spende
  // ------------------------------------------ */
  expenseTrackingPreviewHeader: {
    marginBottom: theme.spacing(2),
  },
  expenseTrackingPreviewArea: {
    position: "relative",
    // so hoch, dass der Verlauf in der Auswertung noch als Diagramm erkennbar
    // ist; auf dem Handy einspaltig und darum höher
    maxHeight: {xs: theme.spacing(270), md: theme.spacing(140)},
    overflow: "hidden",
    pointerEvents: "none",
    userSelect: "none",
    // blendet nach unten in den Seitenhintergrund aus, hell wie dunkel
    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "50%",
      background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0)}, ${theme.palette.background.default})`,
    },
  },
  expenseTrackingPreviewSection: {
    marginTop: theme.spacing(3),
  },
});
