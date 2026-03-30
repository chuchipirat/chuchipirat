/**
 * Dialog zum Zusammenführen (Merge) von zwei Produkten.
 *
 * Zeigt beide Produkte nebeneinander an, ermöglicht die Auswahl
 * von Quelle (wird gelöscht) und Ziel (bleibt bestehen) und
 * führt den Merge via AdminOperationsRepository aus.
 */
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Radio,
  RadioGroup,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import {SwapHoriz as SwapHorizIcon} from "@mui/icons-material";
import {Product} from "./product.types";
import {MergeProductsResult} from "../Database/Repository/AdminOperationsRepository";
import {useDatabase} from "../Database/DatabaseContext";
import {DIET_TYPES as TEXT_DIET_TYPES} from "../../constants/text";
import {
  MERGE_PRODUCTS,
  MERGE_SOURCE,
  MERGE_TARGET,
  MERGE_CONFIRM,
  MERGE_SUCCESS,
  MERGE_REFERENCES_LABEL,
  SWAP_SOURCE_TARGET,
} from "../../constants/text/productQa";

/**
 * Props für den Merge-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param onClose - Callback zum Schliessen des Dialogs
 * @param products - Alle Produkte (für die Anzeige der Details)
 * @param sourceProductUid - UID des Quellprodukts (wird gelöscht)
 * @param targetProductUid - UID des Zielprodukts (bleibt bestehen)
 * @param onMerge - Callback zur Ausführung des Merge
 */
interface DialogMergeProductsProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  sourceProductUid: string;
  targetProductUid: string;
  onMerge: (
    sourceUid: string,
    targetUid: string,
  ) => Promise<MergeProductsResult | null>;
}

/**
 * Dialog zum Zusammenführen von Produkten mit Vorschau und Rollenwahl.
 */
export const DialogMergeProducts = ({
  open,
  onClose,
  products,
  sourceProductUid,
  targetProductUid,
  onMerge,
}: DialogMergeProductsProps) => {
  const database = useDatabase();
  const [sourceUid, setSourceUid] = React.useState(sourceProductUid);
  const [targetUid, setTargetUid] = React.useState(targetProductUid);
  const [isLoading, setIsLoading] = React.useState(false);
  const [mergeResult, setMergeResult] =
    React.useState<MergeProductsResult | null>(null);
  const [referenceCountA, setReferenceCountA] = React.useState<number | null>(
    null,
  );
  const [referenceCountB, setReferenceCountB] = React.useState<number | null>(
    null,
  );

  const productA = products.find((product) => product.uid === sourceUid);
  const productB = products.find((product) => product.uid === targetUid);

  // Referenzen laden
  React.useEffect(() => {
    if (open && sourceUid && targetUid) {
      database.adminOps
        .whereUsed(sourceUid, "product")
        .then((entries) => setReferenceCountA(entries.length))
        .catch(() => setReferenceCountA(null));

      database.adminOps
        .whereUsed(targetUid, "product")
        .then((entries) => setReferenceCountB(entries.length))
        .catch(() => setReferenceCountB(null));
    }
  }, [open, sourceUid, targetUid]);

  const handleSwap = () => {
    setSourceUid(targetUid);
    setTargetUid(sourceUid);
  };

  const handleMerge = async () => {
    setIsLoading(true);
    const result = await onMerge(sourceUid, targetUid);
    setIsLoading(false);
    if (result) {
      setMergeResult(result);
    }
  };

  /**
   * Zeigt die Details eines einzelnen Produkts an.
   */
  const renderProductDetails = (
    product: Product | undefined,
    role: string,
    refCount: number | null,
  ) => {
    if (!product) {
      return <Typography color="error">Produkt nicht gefunden</Typography>;
    }
    return (
      <Box sx={{flex: 1, padding: 2}}>
        <Typography
          variant="subtitle2"
          color={role === MERGE_SOURCE ? "error" : "success.main"}
          sx={{marginBottom: 1}}
        >
          {role}
        </Typography>
        <Typography variant="h6">{product.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          Abteilung: {product.department.name || "—"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Einkaufseinheit: {product.shoppingUnit || "—"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Diät: {TEXT_DIET_TYPES[product.dietProperties.diet]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Nutzbar: {product.usable ? "Ja" : "Nein"}
        </Typography>
        {refCount !== null && (
          <Typography variant="body2" color="text.secondary">
            {MERGE_REFERENCES_LABEL}: {refCount}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MERGE_PRODUCTS}</DialogTitle>
      <DialogContent>
        {mergeResult ? (
          <Alert severity="success" sx={{marginTop: 1}}>
            {MERGE_SUCCESS}
            <br />
            Rezeptzutaten: {mergeResult.recipe_ingredients},
            Einkaufslisteneinträge: {mergeResult.shopping_list_items},
            Menüplan: {mergeResult.menue_products},
            Umrechnungen: {mergeResult.unit_conversions}
          </Alert>
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "stretch",
                gap: 2,
                marginTop: 1,
              }}
            >
              {renderProductDetails(
                productA,
                MERGE_SOURCE,
                referenceCountA,
              )}
              <Divider orientation="vertical" flexItem />
              {renderProductDetails(
                productB,
                MERGE_TARGET,
                referenceCountB,
              )}
            </Box>

            <Box sx={{display: "flex", justifyContent: "center", marginTop: 2}}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SwapHorizIcon />}
                onClick={handleSwap}
              >
                {SWAP_SOURCE_TARGET}
              </Button>
            </Box>

            <Alert severity="warning" sx={{marginTop: 2}}>
              Das Quellprodukt (<strong>{productA?.name}</strong>) wird
              gelöscht. Alle Referenzen werden auf das Zielprodukt (
              <strong>{productB?.name}</strong>) übertragen.
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {mergeResult ? "Schliessen" : "Abbrechen"}
        </Button>
        {!mergeResult && (
          <Button
            variant="contained"
            color="error"
            onClick={handleMerge}
            disabled={isLoading || !productA || !productB}
            startIcon={
              isLoading ? <CircularProgress size={16} /> : undefined
            }
          >
            {MERGE_CONFIRM}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
