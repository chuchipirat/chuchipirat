/**
 * EnhancedTable — Wiederverwendbare Tabelle mit Sortierung.
 *
 * Unterstützt verschiedene Spaltentypen (string, number, date, button,
 * checkbox, link, icon, chip, JSX) und clientseitiges Sortieren per
 * stabiler Sort-Funktion. Unsichtbare Spalten werden weder im Kopf
 * noch im Körper gerendert.
 */
import React from "react";

import {
  Checkbox,
  Chip,
  IconButton,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from "@mui/material";

import useCustomStyles from "../../constants/styles";
import Utils from "./utils.class";

/* ===================================================================
// ======================== Typen & Enums ============================
// =================================================================== */

/**
 * Generischer Zeilendatentyp für die Tabelle.
 *
 * Bewusst mit `any`-Werttyp, damit typisierte Domain-Objekte ohne
 * expliziten Cast übergeben werden können (z.B. `Unit[]`, `DepartmentDomain[]`).
 */
type RowData = {[key: string]: any};

/**
 * Verfügbare Spaltentypen für die EnhancedTable.
 */
export enum TableColumnTypes {
  number = "number",
  string = "string",
  date = "date",
  button = "button",
  checkbox = "checkbox",
  link = "link",
  icon = "icon",
  chip = "chip",
  JSX = "jsx",
}

/**
 * Mögliche horizontale Ausrichtungen einer Tabellenspalte.
 */
export enum ColumnTextAlign {
  center = "center",
  inherit = "inherit",
  justify = "justify",
  left = "left",
  right = "right",
}

/**
 * Definition einer Tabellenspalte.
 *
 * @param id - Schlüssel im Datenobjekt (Punkt-Notation für verschachtelte Felder)
 * @param type - Darstellungstyp der Zelle
 * @param textAlign - Horizontale Ausrichtung
 * @param disablePadding - Ob das Standard-Padding deaktiviert werden soll
 * @param label - Spaltenüberschrift
 * @param visible - Ob die Spalte angezeigt werden soll
 * @param iconButton - Icon-Element für Spalten vom Typ `button`
 * @param monoSpaces - Ob der Zellinhalt in Monospace-Schrift dargestellt werden soll
 */
export interface Column {
  id: string;
  type: TableColumnTypes;
  textAlign: ColumnTextAlign;
  disablePadding: boolean;
  label: string;
  visible: boolean;
  iconButton?: JSX.Element;
  monoSpaces?: boolean;
}

/** Sortierrichtung */
type Order = "asc" | "desc";

/* ===================================================================
// ==================== Hilfsfunktionen Sortierung ===================
// =================================================================== */

/**
 * Stabiles Sortieren eines Arrays mit dem angegebenen Komparator.
 *
 * Hält die ursprüngliche Reihenfolge gleicher Elemente aufrecht.
 *
 * @param array - Das zu sortierende Array
 * @param comparator - Vergleichsfunktion, die zwei Elemente vergleicht
 * @returns Sortiertes Array (neue Referenz)
 */
function stableSort(
  array: RowData[],
  comparator: (a: RowData, b: RowData) => number
): RowData[] {
  const stabilizedThis = array.map(
    (el, index) => [el, index] as [RowData, number]
  );
  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilizedThis.map((el) => el[0]);
}

/**
 * Absteigender Komparator für einen beliebigen Schlüssel.
 *
 * @param a - Erstes Objekt
 * @param b - Zweites Objekt
 * @param orderBy - Schlüssel, nach dem verglichen wird
 * @returns Negatives/nulles/positives Ergebnis wie beim Array.sort-Komparator
 */
function descendingComparator<T>(a: T, b: T, orderBy: keyof T): number {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;
  return 0;
}

/**
 * Erzeugt einen Komparator für die angegebene Sortierrichtung und den Schlüssel.
 *
 * @param order - Sortierrichtung ("asc" oder "desc")
 * @param orderBy - Schlüssel, nach dem sortiert wird
 * @returns Komparatorfunktion
 */
function getComparator(
  order: Order,
  orderBy: string
): (a: RowData, b: RowData) => number {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

/* ===================================================================
// ============================== Tabelle ============================
// ===================================================================
// ATTENTION: Wird mit den Icons gearbeitet um einen Eintrag zu ändern,
// kann immer nur eine Zeile bearbeitet werden.
*/

/**
 * Props für die EnhancedTable-Hauptkomponente.
 *
 * @param tableData - Daten als Array von Objekten (Schlüssel = Spalten-id)
 * @param tableColumns - Spaltendefinitionen
 * @param keyColum - Schlüssel des Felds, das als eindeutiger Zeilenschlüssel dient
 * @param onIconClick - Optionaler Klick-Handler für Button-Spalten
 * @param onRowClick - Optionaler Klick-Handler für Tabellenzeilen
 */
interface EnhancedTableProps {
  tableData: RowData[];
  tableColumns: Column[];
  keyColum: string;
  onIconClick?: (
    event: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    row: RowData
  ) => void;
  onRowClick?: (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    rowId: string
  ) => void;
}

/**
 * Tabelle mit clientseitiger Sortierung und verschiedenen Spaltentypen.
 *
 * @param tableData - Anzuzeigende Daten
 * @param tableColumns - Spaltendefinitionen (Typ, Label, Sichtbarkeit etc.)
 * @param keyColum - Feld, das als eindeutiger Zeilenschlüssel verwendet wird
 * @param onIconClick - Handler für Klicks auf Button-Spalten
 * @param onRowClick - Handler für Klicks auf eine gesamte Zeile
 */
const EnhancedTable = ({
  tableData,
  tableColumns,
  keyColum,
  onIconClick,
  onRowClick,
}: EnhancedTableProps) => {
  const [order, setOrder] = React.useState<Order>("asc");
  const [orderBy, setOrderBy] = React.useState("pos");

  const handleRequestSort = (
    _event: React.MouseEvent<unknown>,
    property: string
  ) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  return (
    <TableContainer style={{width: "100%"}}>
      <Table
        aria-labelledby="tableTitle"
        aria-label="enhanced table"
        style={{width: "100%"}}
      >
        <EnhancedTableHead
          tableColumns={tableColumns}
          order={order}
          orderBy={orderBy}
          onRequestSort={handleRequestSort}
        />
        <EnhancedTableBody
          tableColumns={tableColumns}
          tableData={tableData}
          keyColum={keyColum}
          order={order}
          orderBy={orderBy}
          onIconClick={onIconClick}
          onRowClick={onRowClick}
        />
      </Table>
    </TableContainer>
  );
};

/* ===================================================================
// =========================== Tabellenkopf ==========================
// ===================================================================
// Beispiel Spalte:
// {
//   id: "firstName",
//   type: TableColumnTypes.string,
//   textAlign: ColumnTextAlign.left,
//   disablePadding: false,
//   label: "Vorname",
//   visible: true,
//   iconButton: <EditIcon />
// }
// id der Spalte entspricht dem Feldschlüssel im Datenobjekt.
*/

/**
 * Props für den Tabellenkopf.
 *
 * @param tableColumns - Spaltendefinitionen
 * @param order - Aktuelle Sortierrichtung
 * @param orderBy - Aktuell sortierte Spalten-id
 * @param onRequestSort - Handler für Sortierwechsel
 */
interface EnhancedTableHeadProps {
  tableColumns: Column[];
  order: Order;
  orderBy: string;
  onRequestSort: (event: React.MouseEvent<unknown>, property: string) => void;
}

/**
 * Tabellenkopf mit klickbaren Sortier-Labels.
 *
 * Nur sichtbare Spalten (`column.visible === true`) werden gerendert.
 *
 * @param tableColumns - Spaltendefinitionen
 * @param order - Aktuelle Sortierrichtung
 * @param orderBy - Aktuell sortierte Spalten-id
 * @param onRequestSort - Callback bei Klick auf eine Spaltenüberschrift
 */
const EnhancedTableHead = ({
  tableColumns,
  order,
  orderBy,
  onRequestSort,
}: EnhancedTableHeadProps) => {
  const createSortHandler =
    (property: string) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        {tableColumns.map((column) =>
          column.visible ? (
            <TableCell
              key={column.id}
              align={column.textAlign}
              padding={column.disablePadding ? "none" : "normal"}
              sortDirection={orderBy === column.id ? order : false}
            >
              <TableSortLabel
                active={orderBy === column.id}
                direction={orderBy === column.id ? order : "asc"}
                onClick={createSortHandler(column.id)}
              >
                {column.label}
              </TableSortLabel>
            </TableCell>
          ) : null
        )}
      </TableRow>
    </TableHead>
  );
};

/* ===================================================================
// ========================== Tabellenkörper =========================
// =================================================================== */

/**
 * Props für den Tabellenkörper.
 *
 * @param tableData - Anzuzeigende Daten
 * @param tableColumns - Spaltendefinitionen
 * @param keyColum - Feldname des eindeutigen Zeilenschlüssels
 * @param order - Aktuelle Sortierrichtung
 * @param orderBy - Aktuell sortierte Spalten-id
 * @param onIconClick - Handler für Button-Spalten
 * @param onRowClick - Handler für Zeilenklicks
 */
interface EnhancedTableBodyProps {
  tableData: RowData[];
  tableColumns: Column[];
  keyColum: string;
  order: Order;
  orderBy: string;
  onIconClick?: (
    event: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    row: RowData
  ) => void;
  onRowClick?: (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    rowKey: string
  ) => void;
}

/**
 * Rendert die Datenzeilen der EnhancedTable.
 *
 * Wertet den `type` jeder Spalte aus und wählt die passende
 * Darstellung (Text, Checkbox, Button, Link, Chip, Icon, JSX).
 * Unsichtbare Spalten werden übersprungen.
 *
 * @param tableData - Daten als Array von Schlüssel-Wert-Objekten
 * @param tableColumns - Spaltendefinitionen
 * @param keyColum - Feldname, der als React key und Klick-ID dient
 * @param order - Sortierrichtung
 * @param orderBy - Zu sortierende Spalte
 * @param onIconClick - Handler für Button-Spalten-Klicks
 * @param onRowClick - Handler für Zeilenklicks
 */
const EnhancedTableBody = ({
  tableData,
  tableColumns,
  keyColum,
  order,
  orderBy,
  onIconClick,
  onRowClick,
}: EnhancedTableBodyProps) => {
  const classes = useCustomStyles();

  return (
    <TableBody>
      {stableSort(tableData, getComparator(order, orderBy)).map((row) => {
        const rowKey = row[keyColum] as string;

        return (
          <TableRow
            hover
            tabIndex={-1}
            key={rowKey}
            onClick={(event) => onRowClick && onRowClick(event, rowKey)}
          >
            {tableColumns.map((column) => {
              if (!column.visible) {
                return null;
              }

              // Punkt-Notation auflösen: "a.b.c" → row["a"]["b"]["c"]
              let cellValue: unknown;
              if (column.id.includes(".")) {
                cellValue = row;
                for (const member of column.id.split(".")) {
                  cellValue = (cellValue as RowData)[member];
                }
              } else {
                cellValue = row[column.id];
              }

              const cellKey = `${rowKey}_cell_${column.id}`;

              switch (column.type) {
                case TableColumnTypes.number:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      {cellValue as React.ReactNode}
                    </TableCell>
                  );
                case TableColumnTypes.string:
                  return (
                    <TableCell
                      align={column.textAlign}
                      key={cellKey}
                      sx={column.monoSpaces ? classes.typographyCode : undefined}
                    >
                      {cellValue as React.ReactNode}
                    </TableCell>
                  );
                case TableColumnTypes.date:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      {(cellValue as Date).toLocaleString("de-CH", {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                  );
                case TableColumnTypes.button:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      <IconButton
                        color="primary"
                        component="span"
                        id={`${rowKey}_button_${column.id}`}
                        onClick={(event) => onIconClick!(event, row)}
                        size="large"
                      >
                        {column.iconButton}
                      </IconButton>
                    </TableCell>
                  );
                case TableColumnTypes.checkbox:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      <Checkbox disabled checked={cellValue as boolean} />
                    </TableCell>
                  );
                case TableColumnTypes.link:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      <Typography>
                        <Link href={cellValue as string}>
                          {Utils.getDomain(cellValue as string)}
                        </Link>
                      </Typography>
                    </TableCell>
                  );
                case TableColumnTypes.icon:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      {cellValue as React.ReactNode}
                    </TableCell>
                  );
                case TableColumnTypes.chip:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      <Chip
                        label={cellValue as React.ReactNode}
                        size="small"
                      />
                    </TableCell>
                  );
                case TableColumnTypes.JSX:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      {cellValue as React.ReactNode}
                    </TableCell>
                  );
                default:
                  return (
                    <TableCell align={column.textAlign} key={cellKey}>
                      {cellValue as React.ReactNode}
                    </TableCell>
                  );
              }
            })}
          </TableRow>
        );
      })}
    </TableBody>
  );
};

export default EnhancedTable;
