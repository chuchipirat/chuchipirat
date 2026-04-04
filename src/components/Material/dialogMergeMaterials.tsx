/**
 * Dialog zum Zusammenführen (Merge) von zwei Materialien.
 *
 * Zeigt beide Materialien nebeneinander an, ermöglicht die Auswahl
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
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import {SwapHoriz as SwapHorizIcon} from "@mui/icons-material";
import {Material, MaterialType} from "./material.types";
import {MergeMaterialsResult} from "../Database/Repository/AdminOperationsRepository";
import {useDatabase} from "../Database/DatabaseContext";
import {
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
  USABLE as TEXT_USABLE,
} from "../../constants/text";
import {
  MERGE_MATERIALS,
  MERGE_MATERIAL_SOURCE,
  MERGE_MATERIAL_TARGET,
  MERGE_MATERIAL_CONFIRM,
  MERGE_MATERIAL_SUCCESS,
  MERGE_MATERIAL_REFERENCES_LABEL,
  SWAP_SOURCE_TARGET,
  MERGE_MATERIAL_WARNING_TEXT,
} from "../../constants/text/materialQa";

/** Map von MaterialType-Enum zu lesbarem Label. */
const MATERIAL_TYPE_LABELS: Record<number, string> = {
  [MaterialType.none]: "—",
  [MaterialType.consumable]: TEXT_MATERIAL_TYPE_CONSUMABLE,
  [MaterialType.usage]: TEXT_MATERIAL_TYPE_USAGE,
};

/**
 * Props für den Merge-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param onClose - Callback zum Schliessen des Dialogs
 * @param materials - Alle Materialien (für die Anzeige der Details)
 * @param sourceMaterialUid - UID des Quellmaterials (wird gelöscht)
 * @param targetMaterialUid - UID des Zielmaterials (bleibt bestehen)
 * @param onMerge - Callback zur Ausführung des Merge
 */
interface DialogMergeMaterialsProps {
  open: boolean;
  onClose: () => void;
  materials: Material[];
  sourceMaterialUid: string;
  targetMaterialUid: string;
  onMerge: (
    sourceUid: string,
    targetUid: string,
  ) => Promise<MergeMaterialsResult | null>;
}

/**
 * Dialog zum Zusammenführen von Materialien mit Vorschau und Rollenwahl.
 */
export const DialogMergeMaterials = ({
  open,
  onClose,
  materials,
  sourceMaterialUid,
  targetMaterialUid,
  onMerge,
}: DialogMergeMaterialsProps) => {
  const database = useDatabase();
  const [sourceUid, setSourceUid] = React.useState(sourceMaterialUid);
  const [targetUid, setTargetUid] = React.useState(targetMaterialUid);
  const [isLoading, setIsLoading] = React.useState(false);
  const [mergeResult, setMergeResult] =
    React.useState<MergeMaterialsResult | null>(null);
  const [referenceCountA, setReferenceCountA] = React.useState<number | null>(
    null,
  );
  const [referenceCountB, setReferenceCountB] = React.useState<number | null>(
    null,
  );

  const materialA = materials.find((material) => material.uid === sourceUid);
  const materialB = materials.find((material) => material.uid === targetUid);

  // Referenzen laden
  React.useEffect(() => {
    if (open && sourceUid && targetUid) {
      database.adminOps
        .whereUsed(sourceUid, "material")
        .then((entries) => setReferenceCountA(entries.length))
        .catch(() => setReferenceCountA(null));

      database.adminOps
        .whereUsed(targetUid, "material")
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
   * Zeigt die Details eines einzelnen Materials an.
   */
  const renderMaterialDetails = (
    material: Material | undefined,
    role: string,
    refCount: number | null,
  ) => {
    if (!material) {
      return <Typography color="error">Material nicht gefunden</Typography>;
    }
    return (
      <Box sx={{flex: 1, padding: 2}}>
        <Typography
          variant="subtitle2"
          color={role === MERGE_MATERIAL_SOURCE ? "error" : "success.main"}
          sx={{marginBottom: 1}}
        >
          {role}
        </Typography>
        <Typography variant="h6">{material.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          Typ: {MATERIAL_TYPE_LABELS[material.type] ?? "—"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {TEXT_USABLE}: {material.usable ? "Ja" : "Nein"}
        </Typography>
        {refCount !== null && (
          <Typography variant="body2" color="text.secondary">
            {MERGE_MATERIAL_REFERENCES_LABEL}: {refCount}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{MERGE_MATERIALS}</DialogTitle>
      <DialogContent>
        {mergeResult ? (
          <Alert severity="success" sx={{marginTop: 1}}>
            {MERGE_MATERIAL_SUCCESS}
            <br />
            Rezeptmaterialien: {mergeResult.recipe_materials},
            Materiallisten: {mergeResult.material_list_items},
            Menüplan: {mergeResult.menue_materials},
            Einkaufslisten: {mergeResult.shopping_list_items}
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
              {renderMaterialDetails(
                materialA,
                MERGE_MATERIAL_SOURCE,
                referenceCountA,
              )}
              <Divider orientation="vertical" flexItem />
              {renderMaterialDetails(
                materialB,
                MERGE_MATERIAL_TARGET,
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
              {MERGE_MATERIAL_WARNING_TEXT(
                materialA?.name ?? "—",
                materialB?.name ?? "—",
              )}
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
            disabled={isLoading || !materialA || !materialB}
            startIcon={
              isLoading ? <CircularProgress size={16} /> : undefined
            }
          >
            {MERGE_MATERIAL_CONFIRM}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
