/**
 * Dialog zur Anzeige des Verwendungsnachweises für ein einzelnes Produkt.
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
import {WHERE_USED_PRODUCT_TITLE as TEXT_WHERE_USED_PRODUCT_TITLE} from "../../constants/text/productQa";

/**
 * Props für den Verwendungsnachweis-Dialog eines Produkts.
 *
 * @param open - Ob der Dialog geöffnet ist.
 * @param onClose - Callback zum Schliessen des Dialogs.
 * @param productUid - UID des zu prüfenden Produkts.
 * @param productName - Name des Produkts (für den Dialogtitel).
 */
interface DialogWhereUsedProductProps {
  open: boolean;
  onClose: () => void;
  productUid: string;
  productName: string;
}

/**
 * Zeigt in einem Dialog, wo ein einzelnes Produkt in der Datenbank
 * referenziert wird (Rezepte, Einkaufs-/Materiallisten, Menüpläne,
 * Einheitenumrechnungen, Varianten).
 */
export const DialogWhereUsedProduct = ({
  open,
  onClose,
  productUid,
  productName,
}: DialogWhereUsedProductProps) => {
  const database = useDatabase();
  const [isLoading, setIsLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<WhereUsedEntry[]>([]);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!open || !productUid) return;

    setIsLoading(true);
    setError(null);
    database.adminOps
      .whereUsed(productUid, "product")
      .then((result) => setEntries(result))
      .catch((fetchError) => {
        Sentry.captureException(fetchError, {
          extra: {context: "Verwendungsnachweis Produkt", productUid},
        });
        setError(
          fetchError instanceof Error
            ? fetchError
            : new Error(String(fetchError)),
        );
      })
      .finally(() => setIsLoading(false));
  }, [open, productUid]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TEXT_WHERE_USED_PRODUCT_TITLE(productName)}</DialogTitle>
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
