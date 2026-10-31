import React from "react";
import {ExportProgress} from "./expenseExport.types";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@mui/material";

import {
  EXPORT_ZIP_PROGRESS_TITLE as TEXT_EXPORT_ZIP_PROGRESS_TITLE,
  REPORT_PROGRESS_LOADING as TEXT_REPORT_PROGRESS_LOADING,
} from "../../../../constants/text";

/**
 * Props des Fortschrittsdialogs.
 *
 * @param progress - Stand des Exports; `null` = kein Export, Dialog zu.
 */
type ExportProgressDialogProps = {
  progress: ExportProgress | null;
};

/**
 * Dialog, solange das ZIP erstellt wird. Er lässt sich nicht schliessen,
 * der Export ist erst fertig, wenn der Download startet.
 *
 * Bei `total === 0` (vor dem ersten Beleg) läuft der Balken ohne Wert,
 * sonst zeigt er den Anteil der geladenen Belege mit Text darunter.
 *
 * @param props.progress - Stand des Exports oder `null`.
 * @returns Den Dialog, offen nur während eines Exports.
 * @example
 * <ExportProgressDialog progress={zipProgress} />
 */
export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({
  progress,
}) => {
  return (
    <Dialog open={progress !== null} maxWidth="xs" fullWidth>
      <DialogTitle>{TEXT_EXPORT_ZIP_PROGRESS_TITLE}</DialogTitle>
      <DialogContent>
        {progress && progress.total > 0 ? (
          <>
            <LinearProgress
              variant="determinate"
              value={(progress.loaded * 100) / progress.total}
            />
            {/* role="status": Screenreader liest jede neue Zahl vor */}
            <Typography role="status" variant="caption">
              {TEXT_REPORT_PROGRESS_LOADING(progress.loaded, progress.total)}
            </Typography>
          </>
        ) : (
          // ohne total kein Prozentwert, sonst 0 / 0 = NaN
          <LinearProgress />
        )}
      </DialogContent>
    </Dialog>
  );
};
