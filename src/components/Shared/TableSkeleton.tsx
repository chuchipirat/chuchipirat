import React from "react";

import {
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

/* =====================================================================
// ========================= Types =====================================
// ===================================================================== */

/**
 * Props für die TableSkeleton-Komponente.
 *
 * @param rows - Anzahl der Platzhalter-Zeilen (Standard: 5).
 * @param columns - Anzahl der Spalten (Standard: 3).
 */
type TableSkeletonProps = {
  rows?: number;
  columns?: number;
};

/* =====================================================================
// ========================= Komponente ================================
// ===================================================================== */

/**
 * Skeleton-Ladeindikator für Tabellen/Listen.
 *
 * Zeigt eine animierte Platzhalter-Tabelle an, während die echten Daten
 * geladen werden. Ersetzt den blockierenden Backdrop/CircularProgress
 * für initiale Datenladungen.
 *
 * @param rows - Anzahl der Platzhalter-Zeilen (Standard: 5).
 * @param columns - Anzahl der Spalten (Standard: 3).
 * @example
 * if (state.isLoading) return <TableSkeleton rows={8} columns={4} />;
 */
export const TableSkeleton = ({rows = 5, columns = 3}: TableSkeletonProps) => {
  return (
    <Card>
      <CardContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {Array.from({length: columns}, (_, columnIndex) => (
                  <TableCell key={`skeleton-header-${columnIndex}`}>
                    <Skeleton animation="wave" width="60%" />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({length: rows}, (_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`}>
                  {Array.from({length: columns}, (_, columnIndex) => (
                    <TableCell key={`skeleton-cell-${rowIndex}-${columnIndex}`}>
                      <Skeleton animation="wave" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};
