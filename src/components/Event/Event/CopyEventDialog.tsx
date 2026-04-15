/**
 * CopyEventDialog — Dialog zum Kopieren eines bestehenden Events.
 *
 * Ermöglicht die Eingabe von neuem Namen, Motto und Ort sowie die
 * Festlegung neuer Zeitscheiben. Der Menüplan und die Gruppenconfig
 * werden immer kopiert; Kochcrew und Rezeptvarianten sind optional.
 */
import * as Sentry from "@sentry/react";
import React from "react";
import dayjs, {Dayjs} from "dayjs";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  CircularProgress,
  Alert,
  Box,
  Divider,
} from "@mui/material";
import {DatePicker} from "@mui/x-date-pickers";

import {useDatabase} from "../../Database/DatabaseContext";
import {trackEvent} from "../../Analytics/analyticsService";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {
  computeSliceDuration,
  computeEndDate,
  suggestNextSliceStart,
} from "./copyEventUtils";

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Minimale Zeitscheiben-Daten für den Dialog.
 *
 * @param dateFrom Startdatum der Zeitscheibe.
 * @param dateTo Enddatum der Zeitscheibe.
 * @param sortOrder Reihenfolge der Zeitscheibe.
 */
type SourceDateSlice = {
  dateFrom: Date;
  dateTo: Date;
  sortOrder: number;
};

/**
 * Props für den CopyEventDialog.
 *
 * @param open Ob der Dialog sichtbar ist.
 * @param onClose Callback zum Schliessen.
 * @param onSuccess Callback nach erfolgreichem Kopieren (neue Event-ID und Name).
 * @param sourceEvent Daten des Quell-Events.
 */
type CopyEventDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (newEventId: string, eventName: string) => void;
  sourceEvent: {
    uid: string;
    name: string;
    motto: string;
    location: string;
    dates: SourceDateSlice[];
  };
};

/**
 * Interner Zustand für eine Zeitscheibe im Dialog.
 *
 * @param originalFrom Originales Startdatum (nur Anzeige).
 * @param originalTo Originales Enddatum (nur Anzeige).
 * @param durationDays Dauer der Zeitscheibe in Tagen.
 * @param newFrom Neues Startdatum (vom Benutzer wählbar).
 */
type SliceState = {
  originalFrom: Date;
  originalTo: Date;
  durationDays: number;
  newFrom: Date;
};

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/** Formatiert ein Datum als DD.MM.YYYY. */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Erstellt den initialen Slice-Zustand aus den Quell-Zeitscheiben.
 * Alle neuen Startdaten werden auf heute gesetzt, nachfolgende
 * Zeitscheiben werden automatisch vorgeschlagen.
 */
function buildInitialSlices(sourceDates: SourceDateSlice[]): SliceState[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sorted = [...sourceDates].sort(
    (sliceA, sliceB) => sliceA.sortOrder - sliceB.sortOrder,
  );

  const originalSlices = sorted.map((sourceDate) => ({
    dateFrom: sourceDate.dateFrom,
    dateTo: sourceDate.dateTo,
  }));

  return sorted.map((sourceDate, index) => {
    const durationDays = computeSliceDuration(
      sourceDate.dateFrom,
      sourceDate.dateTo,
    );
    const newFrom =
      index === 0
        ? today
        : suggestNextSliceStart(originalSlices, today, index);

    return {
      originalFrom: sourceDate.dateFrom,
      originalTo: sourceDate.dateTo,
      durationDays,
      newFrom,
    };
  });
}

/* =====================================================================
// Komponente
// ===================================================================== */

/**
 * Dialog zum Kopieren eines Events.
 *
 * Zeigt Felder für Name, Motto, Ort, neue Zeitscheiben und
 * Optionen (Kochcrew, Rezeptvarianten). Ruft die serverseitige
 * `copy_event`-RPC-Funktion auf.
 */
const CopyEventDialog = ({
  open,
  onClose,
  onSuccess,
  sourceEvent,
}: CopyEventDialogProps) => {
  const database = useDatabase();

  // Formularfelder
  const [eventName, setEventName] = React.useState(
    `Kopie von ${sourceEvent.name}`,
  );
  const [motto, setMotto] = React.useState("");
  const [location, setLocation] = React.useState("");

  // Zeitscheiben
  const [slices, setSlices] = React.useState<SliceState[]>(() =>
    buildInitialSlices(sourceEvent.dates),
  );

  // Optionen
  const [copyVariants, setCopyVariants] = React.useState(false);
  const [copyCooks, setCopyCooks] = React.useState(false);

  // Zustand
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Bei Wechsel des Source-Events den State zurücksetzen
  React.useEffect(() => {
    if (open) {
      setEventName(`Kopie von ${sourceEvent.name}`);
      setMotto("");
      setLocation("");
      setSlices(buildInitialSlices(sourceEvent.dates));
      setCopyVariants(false);
      setCopyCooks(false);
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [open, sourceEvent.uid]);

  /**
   * Aktualisiert das Startdatum einer Zeitscheibe.
   * Wenn es die erste Zeitscheibe ist, werden nachfolgende
   * Zeitscheiben automatisch neu berechnet.
   */
  const handleSliceDateChange = (sliceIndex: number, newDate: Dayjs | null) => {
    if (!newDate || !newDate.isValid()) return;

    const dateObj = newDate.toDate();
    dateObj.setHours(0, 0, 0, 0);

    setSlices((previousSlices) => {
      const updated = [...previousSlices];
      updated[sliceIndex] = {...updated[sliceIndex], newFrom: dateObj};

      // Bei Änderung der ersten Zeitscheibe: nachfolgende Slices automatisch anpassen
      if (sliceIndex === 0) {
        const originalSlices = previousSlices.map((slice) => ({
          dateFrom: slice.originalFrom,
          dateTo: slice.originalTo,
        }));

        for (
          let followingIndex = 1;
          followingIndex < updated.length;
          followingIndex++
        ) {
          const suggested = suggestNextSliceStart(
            originalSlices,
            dateObj,
            followingIndex,
          );
          updated[followingIndex] = {
            ...updated[followingIndex],
            newFrom: suggested,
          };
        }
      }

      return updated;
    });
  };

  /**
   * Sendet die Kopier-Anfrage an die Datenbank.
   */
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const dates = slices.map((slice) => {
        const endDate = computeEndDate(slice.newFrom, slice.durationDays);
        return {
          date_from: formatIsoDate(slice.newFrom),
          date_to: formatIsoDate(endDate),
        };
      });

      const newEventId = await database.events.copyEvent(
        sourceEvent.uid,
        {
          name: eventName.trim(),
          motto: motto.trim(),
          location: location.trim(),
          dates,
        },
        {
          copy_cooks: copyCooks,
          copy_variants: copyVariants,
        },
      );

      trackEvent(AnalyticsEvent.EVENT_COPIED);
      onSuccess(newEventId, eventName.trim());
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Event kopieren"},
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Beim Kopieren ist ein Fehler aufgetreten.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Anlass kopieren</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{mt: 1}}>
          {/* ── Sektion 1: Event-Infos ── */}
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={eventName}
              onChange={(event) => setEventName(event.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
            <TextField
              label="Motto"
              value={motto}
              onChange={(event) => setMotto(event.target.value)}
              fullWidth
              size="small"
              placeholder="Optional"
            />
            <TextField
              label="Ort"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              fullWidth
              size="small"
              placeholder="Optional"
            />
          </Stack>

          <Divider />

          {/* ── Sektion 2: Zeitscheiben ── */}
          <Stack spacing={2}>
            <Typography variant="subtitle2">Zeitscheiben</Typography>
            {slices.map((slice, sliceIndex) => {
              const newEndDate = computeEndDate(
                slice.newFrom,
                slice.durationDays,
              );
              return (
                <Box
                  key={sliceIndex}
                  sx={{
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    p: 2,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {`Zeitscheibe ${sliceIndex + 1}: ${formatDate(slice.originalFrom)} – ${formatDate(slice.originalTo)} (${slice.durationDays} ${slice.durationDays === 1 ? "Tag" : "Tage"})`}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{mt: 1}}>
                    <DatePicker
                      label="Neuer Start"
                      format="DD.MM.YYYY"
                      value={dayjs(slice.newFrom)}
                      onChange={(date) =>
                        handleSliceDateChange(sliceIndex, date)
                      }
                      slotProps={{
                        textField: {size: "small", fullWidth: true},
                      }}
                    />
                    <TextField
                      label="Neues Ende"
                      value={formatDate(newEndDate)}
                      size="small"
                      fullWidth
                      slotProps={{input: {readOnly: true}}}
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>

          <Divider />

          {/* ── Sektion 3: Optionen ── */}
          <Stack spacing={1}>
            <Typography variant="subtitle2">Optionen</Typography>
            <FormGroup>
              <FormControlLabel
                control={<Checkbox checked disabled />}
                label="Menüplan"
              />
              <FormControlLabel
                control={<Checkbox checked disabled />}
                label="Gruppenconfig"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyVariants}
                    onChange={(event) => setCopyVariants(event.target.checked)}
                  />
                }
                label="Rezeptvarianten kopieren"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyCooks}
                    onChange={(event) => setCopyCooks(event.target.checked)}
                  />
                }
                label="Kochcrew übernehmen"
              />
            </FormGroup>
          </Stack>

          {/* ── Fehlermeldung ── */}
          {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Abbrechen
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !eventName.trim()}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
        >
          {isSubmitting ? "Kopiere…" : "Kopieren"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* =====================================================================
// Hilfsfunktion: Datum als ISO-Datumsstring (YYYY-MM-DD)
// ===================================================================== */

/**
 * Formatiert ein Datum als ISO-Datumsstring (YYYY-MM-DD) ohne Zeitzonen-Verschiebung.
 *
 * @param date Das zu formatierende Datum.
 * @returns Datumsstring im Format YYYY-MM-DD.
 */
function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export {CopyEventDialog};
export type {CopyEventDialogProps, SourceDateSlice};
