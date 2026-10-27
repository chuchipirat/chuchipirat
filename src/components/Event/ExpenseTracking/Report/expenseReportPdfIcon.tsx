import React from "react";
import {Path, Svg} from "@react-pdf/renderer";
import {Style} from "@react-pdf/types";

/** SVG-Pfad von MUI `ReceiptOutlined` (Trenner, Klebefeld). */
export const RECEIPT_ICON_PATHS = [
  "M19.5 3.5 18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2zM19 19.09H5V4.91h14zM6 15h12v2H6zm0-4h12v2H6zm0-4h12v2H6z",
];

/**
 * Props für {@link PdfIcon}.
 *
 * @param paths - SVG-Pfade im Raster 24 × 24 (MUI-Icons).
 * @param size - Kantenlänge in pt.
 * @param color - Füllfarbe.
 * @param style - Zusätzlicher Style, z.B. Abstand.
 */
type PdfIconProps = {
  paths: string[];
  size: number;
  color: string;
  style?: Style;
};

/**
 * MUI-Icon im PDF: react-pdf zeichnet keine MUI-Komponenten, darum die
 * SVG-Pfade direkt.
 *
 * @param props - Siehe {@link PdfIconProps}.
 * @returns Das Icon.
 * @example
 * <PdfIcon paths={RECEIPT_ICON_PATHS} size={14} color={REPORT_COLORS.primary} />
 */
export const PdfIcon = ({paths, size, color, style}: PdfIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    {paths.map((path) => (
      <Path key={path} d={path} fill={color} />
    ))}
  </Svg>
);
