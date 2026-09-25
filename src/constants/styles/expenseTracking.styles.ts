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
  budgetToolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2),
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
  expenseRowAmount: {
    flexShrink: 0,
    fontWeight: 500,
  },
  noExpensesHint: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(4, 2),
  },
});
