import {Theme} from "@mui/material/styles";

/**
 * Styles der User-Profilseite
 * Ausgelagert aus `styles.ts` und dort in `useCustomStyles()` eingehängt.
 *
 * @param theme - Das aktive MUI-Theme.
 * @returns Style-Objekte für die `sx`-Prop.
 */
export const getUserStyles = (theme: Theme) => ({
  paymentDetailsAddress: {
    fontStyle: "normal", // <address> ist im Browser standardmässig kursiv
  },
  paymentDetailsIban: {
    fontVariantNumeric: "tabular-nums", // alle Ziffern gleich breit → Viererblöcke stehen sauber
    overflowWrap: "anywhere", // lange IBANs (bis 34 Zeichen) brechen auf Mobile um
  },
  paymentDetailsPostalCodeRow: {
    display: "grid",
    gridTemplateColumns: "130px 1fr",
    gap: theme.spacing(2),
  },
});
