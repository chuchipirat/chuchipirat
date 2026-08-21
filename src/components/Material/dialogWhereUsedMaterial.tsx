/**
 * Dialog zur Anzeige des Verwendungsnachweises für ein einzelnes Material.
 *
 * Lädt beim Öffnen alle Fundstellen via AdminOperationsRepository.whereUsed
 * und zeigt sie gruppiert an (gleiche Darstellung wie die Where-Used-Seite).
 * Rein informativ — löst keine Aktion aus, ermöglicht aber die Einschätzung,
 * ob ein Umbenennen/Zusammenführen unbedenklich ist.
 */
import React from "react";
import * as Sentry from "@sentry/react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
} from "@mui/material";

import {useDatabase} from "../Database/DatabaseContext";
import {WhereUsedEntry} from "../Database/Repository/AdminOperationsRepository";
import {WhereUsedResultPanel} from "../Admin/whereUsedResultPanel";
import {AlertMessage} from "../Shared/AlertMessage";
import {CLOSE as TEXT_CLOSE, ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS} from "../../constants/text";
import {WHERE_USED_MATERIAL_TITLE as TEXT_WHERE_USED_MATERIAL_TITLE} from "../../constants/text/materialQa";

/**
 * Props für den Verwendungsnachweis-Dialog eines Materials.
 *
 * @param open - Ob der Dialog geöffnet ist.
 * @param onClose - Callback zum Schliessen des Dialogs.
 * @param materialUid - UID des zu prüfenden Materials.
 * @param materialName - Name des Materials (für den Dialogtitel).
 */
interface DialogWhereUsedMaterialProps {
  open: boolean;
  onClose: () => void;
  materialUid: string;
  materialName: string;
}

/**
 * Zeigt in einem Dialog, wo ein einzelnes Material in der Datenbank
 * referenziert wird (Rezepte, Materiallisten, Menüpläne).
 */
export const DialogWhereUsedMaterial = ({
  open,
  onClose,
  materialUid,
  materialName,
}: DialogWhereUsedMaterialProps) => {
  const database = useDatabase();
  const [isLoading, setIsLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<WhereUsedEntry[]>([]);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!open || !materialUid) return;

    setIsLoading(true);
    setError(null);
    database.adminOps
      .whereUsed(materialUid, "material")
      .then((result) => setEntries(result))
      .catch((fetchError) => {
        Sentry.captureException(fetchError, {
          extra: {context: "Verwendungsnachweis Material", materialUid},
        });
        setError(
          fetchError instanceof Error
            ? fetchError
            : new Error(String(fetchError)),
        );
      })
      .finally(() => setIsLoading(false));
  }, [open, materialUid]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TEXT_WHERE_USED_MATERIAL_TITLE(materialName)}</DialogTitle>
      <DialogContent>
        {isLoading && (
          <Box sx={{display: "flex", justifyContent: "center", padding: 4}}>
            <CircularProgress />
          </Box>
        )}
        {!isLoading && error && (
          <AlertMessage error={error} messageTitle={TEXT_ALERT_TITLE_UUPS} />
        )}
        {!isLoading && !error && <WhereUsedResultPanel entries={entries} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{TEXT_CLOSE}</Button>
      </DialogActions>
    </Dialog>
  );
};
