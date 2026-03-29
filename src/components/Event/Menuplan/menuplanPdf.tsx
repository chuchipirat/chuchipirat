/**
 * PDF-Export des Menüplans auf einer einzelnen A4-Querformat-Seite.
 *
 * Passt den gesamten Menüplan auf eine Seite, indem Spaltenbreiten dynamisch
 * berechnet, Schriftgrössen adaptiv angepasst und Notizen inline dargestellt
 * werden. Einheitliche App-Farbe für Mahlzeitentyp-Bänder, Zeitscheiben-Grenzen
 * und vertikale Spaltentrennlinien verbessern die Lesbarkeit.
 */
import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import {Utils} from "../../Shared/utils.class";
import {
  MENUPLAN as TEXT_MENUPLAN,
  APP_NAME as TEXT_APP_NAME,
} from "../../../constants/text";

import {
  createMenuplanPdfStyles,
  MEAL_BAND_BG,
  MEAL_BAND_TEXT,
  getColumnBackground,
  isTimesliceBoundary,
} from "../../../constants/stylesMenuplanPdf";
import {
  MealType,
  Meal,
  MenuplanData,
  Menue,
  MealRecipes,
  Materials,
  Products,
  Note,
} from "./menuplan.types";
import type {MenuplanPdfOptions} from "./dialogMenuplanPdfOptions";
import {Event} from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {Footer, Header} from "../../Shared/pdfComponents";
import "../../Shared/pdfFontRegistration";


/**
 * Erstellt eine Lookup-Map für Mahlzeiten, indiziert nach `mealTypeUid_dateString`.
 * Vermeidet O(n²)-Suche bei jedem Zellen-Rendering.
 *
 * @param meals - Alle Mahlzeiten des Menüplans.
 * @returns Map mit Key `${mealTypeUid}_${dateString}` → Meal.
 */
export function buildMealLookup(meals: MenuplanData["meals"]): Map<string, Meal> {
  const map = new Map<string, Meal>();
  Object.values(meals).forEach((meal) => {
    map.set(`${meal.mealType}_${meal.date}`, meal);
  });
  return map;
}

/**
 * Sucht die Tages-Notiz für ein bestimmtes Datum (ohne Menü-Zuordnung).
 *
 * @param notes - Alle Notizen des Menüplans.
 * @param date - Das Datum, für das die Notiz gesucht wird.
 * @returns Die gefundene Notiz oder undefined.
 */
export function findNoteForDate(
  notes: MenuplanData["notes"],
  date: Date
): Note | undefined {
  const dateString = Utils.dateAsString(date);
  return Object.values(notes).find(
    (note) => note.date === dateString && note.menueUid === ""
  );
}

/**
 * Sucht die Menü-Notiz für ein bestimmtes Menü an einem bestimmten Datum.
 *
 * @param notes - Alle Notizen des Menüplans.
 * @param menuUid - UID des Menüs.
 * @param date - Das Datum der Notiz.
 * @returns Die gefundene Notiz oder undefined.
 */
export function findNoteForMenu(
  notes: MenuplanData["notes"],
  menuUid: string,
  date: Date
): Note | undefined {
  const dateString = Utils.dateAsString(date);
  return Object.values(notes).find(
    (note) => note.menueUid === menuUid && note.date === dateString
  );
}


/**
 * Berechnet die Basis-Schriftgrösse abhängig von der Anzahl Tage.
 * Mehr Tage → kleinere Schrift, damit alles auf eine Seite passt.
 *
 * @param numDays - Anzahl Tage im Menüplan.
 * @returns Basis-Schriftgrösse in Punkt.
 */
export function calculateBaseFontSize(numDays: number): number {
  if (numDays <= 7) return 8;
  if (numDays <= 10) return 7;
  return 6;
}


/**
 * Berechnet die prozentuale Spaltenbreite pro Tag.
 * Alle Spalten teilen sich die volle Breite gleichmässig.
 *
 * @param numDays - Anzahl Tage im Menüplan.
 * @returns Breite als Prozent-String (z.B. "14.29%").
 */
export function computeColumnWidth(numDays: number): string {
  return `${(100 / numDays).toFixed(2)}%`;
}


/**
 * Formatiert eine Menge mit Einheit für die Anzeige im PDF.
 * Zeigt Ganzzahlen ohne Dezimalstellen, Dezimalzahlen mit einer Stelle.
 *
 * @param quantity - Die Menge.
 * @param unit - Die Einheit.
 * @returns Formatierter String (z.B. "2 kg") oder leer wenn Menge 0.
 */
function formatQuantity(quantity: number, unit: string): string {
  if (quantity <= 0) return "";
  const formatted = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(1);
  return `${formatted} ${unit} `;
}


/**
 * Ermittelt den rechten Randstil für eine Spalte.
 * Erkennt Zeitscheiben-Grenzen (nicht-aufeinanderfolgende Tage) und
 * verwendet dafür eine dickere, farbige Trennlinie.
 *
 * @param dates - Alle Tage des Menüplans.
 * @param dayIndex - Index der aktuellen Spalte.
 * @param styles - Adaptives StyleSheet.
 * @returns Style-Objekt für den rechten Rand (oder leeres Objekt).
 */
function getRightBorderStyle(
  dates: Date[],
  dayIndex: number,
  styles: ReturnType<typeof createMenuplanPdfStyles>,
): Record<string, unknown> {
  const isLastColumn = dayIndex === dates.length - 1;
  if (isLastColumn) return {};

  const nextDay = dates[dayIndex + 1];
  if (isTimesliceBoundary(dates[dayIndex], nextDay)) {
    return styles.timesliceBorderRight;
  }
  return styles.columnBorderRight;
}


// ─── Props ──────────────────────────────────────────────────────────

/**
 * Props der Wurzelkomponente des Menüplan-PDFs.
 *
 * @param event - Der zugehörige Event.
 * @param menuplan - Vollständige Menüplan-Daten.
 * @param authUser - Authentifizierter Benutzer (für Autor-Metadaten).
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
interface MenuplanPdfProps {
  event: Event;
  menuplan: MenuplanData;
  authUser: AuthUser;
  pdfOptions: MenuplanPdfOptions;
}


/**
 * Wurzelkomponente des Menüplan-PDFs.
 * Erzeugt ein einziges Querformat-Dokument mit allen Tagen auf einer Seite.
 *
 * @param event - Der zugehörige Event.
 * @param menuplan - Vollständige Menüplan-Daten.
 * @param authUser - Authentifizierter Benutzer.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
const MenuplanPdf = ({
  event,
  menuplan,
  authUser,
  pdfOptions,
}: MenuplanPdfProps) => {
  const actualDate = new Date();
  const numDays = menuplan.dates.length;
  const baseFontSize = calculateBaseFontSize(numDays);
  const styles = createMenuplanPdfStyles(baseFontSize);
  const columnWidth = computeColumnWidth(numDays);
  const mealLookup = buildMealLookup(menuplan.meals);

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={event.name + " " + TEXT_MENUPLAN}
      subject={TEXT_MENUPLAN + " " + event.name}
      title={TEXT_MENUPLAN + " " + event.name}
    >
      <Page orientation="landscape" style={styles.pageMargins}>
        <Header text={event.name} uid={event.uid} />
        <Text style={styles.title}>{TEXT_MENUPLAN}</Text>

        <View style={styles.table}>
          {/* Datums-Kopfzeile mit inline Tagesnotizen */}
          <DateHeaderRow
            dates={menuplan.dates}
            columnWidth={columnWidth}
            notes={menuplan.notes}
            styles={styles}
          />

          {/* Mahlzeitentyp-Bänder mit Inhaltszellen */}
          {menuplan.mealTypes.order.map((mealTypeUid) => (
            <MealTypeBand
              key={"band_" + mealTypeUid}
              mealType={menuplan.mealTypes.entries[mealTypeUid]}
              dates={menuplan.dates}
              columnWidth={columnWidth}
              mealLookup={mealLookup}
              menues={menuplan.menues}
              mealRecipes={menuplan.mealRecipes}
              products={menuplan.products}
              materials={menuplan.materials}
              notes={menuplan.notes}
              pdfOptions={pdfOptions}
              styles={styles}
            />
          ))}
        </View>

        <Footer uid={event.uid} actualDate={actualDate} authUser={authUser} />
      </Page>
    </Document>
  );
};


// ─── Datums-Kopfzeile ──────────────────────────────────────────────

/**
 * Props der Datums-Kopfzeile.
 *
 * @param dates - Alle Tage des Menüplans.
 * @param columnWidth - Berechnete Spaltenbreite.
 * @param notes - Alle Notizen (für inline Tagesnotizen).
 * @param styles - Adaptives StyleSheet.
 */
interface DateHeaderRowProps {
  dates: Date[];
  columnWidth: string;
  notes: MenuplanData["notes"];
  styles: ReturnType<typeof createMenuplanPdfStyles>;
}

/**
 * Kopfzeile mit abgekürzten Wochentagen, Kurzformat-Datum und Tagesnotizen.
 * Zeigt z.B. "Mo 24.03" und darunter optional die Tagesnotiz.
 * Zeitscheiben-Grenzen werden mit dickeren Trennlinien markiert.
 *
 * @param dates - Alle Tage des Menüplans.
 * @param columnWidth - Berechnete Spaltenbreite.
 * @param notes - Alle Notizen.
 * @param styles - Adaptives StyleSheet.
 */
const DateHeaderRow = ({
  dates,
  columnWidth,
  notes,
  styles,
}: DateHeaderRowProps) => {
  return (
    <View style={styles.tableRow}>
      {dates.map((day, dayIndex) => {
        // Abgekürzter Wochentag (2 Zeichen)
        const weekday = day.toLocaleString("de-CH", {weekday: "short"});
        // Kurzformat-Datum (TT.MM)
        const shortDate = day.toLocaleString("de-CH", {
          day: "2-digit",
          month: "2-digit",
        });
        // Tagesnotiz inline im Header
        const dayNote = findNoteForDate(notes, day);
        const rightBorder = getRightBorderStyle(dates, dayIndex, styles);

        return (
          <View
            key={"dateHeader_" + dayIndex}
            style={{
              ...styles.dateHeaderCell,
              ...rightBorder,
              width: columnWidth,
              backgroundColor: getColumnBackground(dayIndex),
            }}
          >
            <Text style={{...styles.headerText, textAlign: "center"}}>
              {`${weekday} ${shortDate}`}
            </Text>
            {dayNote && (
              <Text style={styles.noteInline}>
                {dayNote.text}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};


// ─── Mahlzeitentyp-Band ────────────────────────────────────────────

/**
 * Props eines Mahlzeitentyp-Bands (farbiges Banner + Inhaltszellen).
 *
 * @param mealType - Der Mahlzeitentyp.
 * @param dates - Alle Tage des Menüplans.
 * @param columnWidth - Berechnete Spaltenbreite.
 * @param mealLookup - Vorberechnete Meal-Lookup-Map.
 * @param menues - Alle Menüs.
 * @param mealRecipes - Alle eingeplanten Rezepte.
 * @param products - Alle eingeplanten Produkte.
 * @param materials - Alle eingeplanten Materialien.
 * @param notes - Alle Notizen.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 * @param styles - Adaptives StyleSheet.
 */
interface MealTypeBandProps {
  mealType: MealType;
  dates: Date[];
  columnWidth: string;
  mealLookup: Map<string, Meal>;
  menues: MenuplanData["menues"];
  mealRecipes: MealRecipes;
  products: Products;
  materials: Materials;
  notes: MenuplanData["notes"];
  pdfOptions: MenuplanPdfOptions;
  styles: ReturnType<typeof createMenuplanPdfStyles>;
}

/**
 * Farbiges Band für einen Mahlzeitentyp.
 * Besteht aus einem farbigen Banner mit dem Typnamen und einer
 * Zeile mit Inhaltszellen (eine pro Tag).
 *
 * @param mealType - Der Mahlzeitentyp.
 * @param dates - Alle Tage.
 * @param columnWidth - Spaltenbreite.
 * @param mealLookup - Meal-Lookup-Map.
 * @param menues - Menüs.
 * @param mealRecipes - Rezepte.
 * @param products - Produkte.
 * @param materials - Materialien.
 * @param notes - Notizen.
 * @param pdfOptions - PDF-Optionen.
 * @param styles - StyleSheet.
 */
const MealTypeBand = ({
  mealType,
  dates,
  columnWidth,
  mealLookup,
  menues,
  mealRecipes,
  products,
  materials,
  notes,
  pdfOptions,
  styles,
}: MealTypeBandProps) => {
  return (
    <React.Fragment>
      {/* Farbiges Banner mit Mahlzeitentyp-Name */}
      <View
        style={{
          ...styles.mealBanner,
          backgroundColor: MEAL_BAND_BG,
        }}
      >
        <Text style={{...styles.mealBannerText, color: MEAL_BAND_TEXT}}>
          {mealType.name}
        </Text>
      </View>

      {/* Inhaltszellen: eine pro Tag */}
      <View style={styles.contentRow}>
        {dates.map((day, dayIndex) => {
          const dateString = Utils.dateAsString(day);
          const meal = mealLookup.get(`${mealType.uid}_${dateString}`) ?? null;

          return (
            <CompactCell
              key={"cell_" + mealType.uid + "_" + dayIndex}
              day={day}
              dayIndex={dayIndex}
              dates={dates}
              columnWidth={columnWidth}
              meal={meal}
              menues={menues}
              mealRecipes={mealRecipes}
              products={products}
              materials={materials}
              notes={notes}
              pdfOptions={pdfOptions}
              styles={styles}
            />
          );
        })}
      </View>
    </React.Fragment>
  );
};


// ─── Kompakte Zelle ────────────────────────────────────────────────

/**
 * Props einer kompakten Inhaltszelle (ein Tag × ein Mahlzeitentyp).
 *
 * @param day - Das Datum dieser Zelle.
 * @param dayIndex - Spaltenindex (für Hintergrund-Tinting).
 * @param dates - Alle Tage (für Zeitscheiben-Grenze-Erkennung).
 * @param columnWidth - Berechnete Spaltenbreite.
 * @param meal - Die Mahlzeit (oder null wenn keine geplant).
 * @param menues - Alle Menüs.
 * @param mealRecipes - Alle eingeplanten Rezepte.
 * @param products - Alle eingeplanten Produkte.
 * @param materials - Alle eingeplanten Materialien.
 * @param notes - Alle Notizen.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 * @param styles - Adaptives StyleSheet.
 */
interface CompactCellProps {
  day: Date;
  dayIndex: number;
  dates: Date[];
  columnWidth: string;
  meal: Meal | null;
  menues: MenuplanData["menues"];
  mealRecipes: MealRecipes;
  products: Products;
  materials: Materials;
  notes: MenuplanData["notes"];
  pdfOptions: MenuplanPdfOptions;
  styles: ReturnType<typeof createMenuplanPdfStyles>;
}

/**
 * Kompakte Darstellung einer einzelnen Zelle im Menüplan-Grid.
 * Zeigt Menüname, Rezepte, optionale Produkte/Materialien
 * und inline Menü-Notizen. Nur Notizen sind zentriert.
 *
 * @param day - Datum der Zelle.
 * @param dayIndex - Spaltenindex.
 * @param dates - Alle Tage.
 * @param columnWidth - Spaltenbreite.
 * @param meal - Mahlzeit oder null.
 * @param menues - Menüs.
 * @param mealRecipes - Rezepte.
 * @param products - Produkte.
 * @param materials - Materialien.
 * @param notes - Notizen.
 * @param pdfOptions - PDF-Optionen.
 * @param styles - StyleSheet.
 */
const CompactCell = ({
  day,
  dayIndex,
  dates,
  columnWidth,
  meal,
  menues,
  mealRecipes,
  products,
  materials,
  notes,
  pdfOptions,
  styles,
}: CompactCellProps) => {
  const rightBorder = getRightBorderStyle(dates, dayIndex, styles);

  return (
    <View
      style={{
        ...styles.cellPadding,
        ...rightBorder,
        width: columnWidth,
        backgroundColor: getColumnBackground(dayIndex),
      }}
    >
      {/* Menü-Inhalte */}
      {meal !== null &&
        meal.menuOrder.map((menuUid) => {
          const menue = menues[menuUid];
          if (!menue) return null;

          // Menü-Notiz inline anzeigen
          const menuNote = findNoteForMenu(notes, menuUid, day);

          return (
            <View key={"compactMenu_" + menuUid}>
              {/* Menüname immer anzeigen */}
              <Text style={{...styles.menuName, ...styles.alignLeft}}>
                {menue.name}
              </Text>

              {/* Rezepte */}
              {menue.mealRecipeOrder.map((recipeUid) => {
                const mealRecipe = mealRecipes[recipeUid];
                return (
                  <Text
                    key={"recipe_" + recipeUid}
                    style={{...styles.body, ...styles.alignLeft}}
                  >
                    {mealRecipe?.recipe.name}
                    {mealRecipe?.recipe.type === RecipeType.variant && (
                      <Text style={styles.gray}>
                        {` [${mealRecipe.recipe.variantName}]`}
                      </Text>
                    )}
                    {pdfOptions.showPortions &&
                      mealRecipe &&
                      mealRecipe.totalPortions > 0 && (
                        <Text style={{...styles.gray, ...styles.bodySmall}}>
                          {` (${mealRecipe.totalPortions} P.)`}
                        </Text>
                      )}
                  </Text>
                );
              })}

              {/* Produkte — ein Eintrag pro Zeile */}
              {pdfOptions.showProducts &&
                menue.productOrder.map((productUid) => {
                  const product = products[productUid];
                  if (!product) return null;
                  return (
                    <Text
                      key={"product_" + productUid}
                      style={{
                        ...styles.bodySmall,
                        ...styles.italic,
                        ...styles.gray,
                        ...styles.alignLeft,
                      }}
                    >
                      {formatQuantity(product.totalQuantity, product.unit)}
                      {product.productName}
                    </Text>
                  );
                })}

              {/* Materialien — ein Eintrag pro Zeile */}
              {pdfOptions.showMaterials &&
                menue.materialOrder.map((materialUid) => {
                  const material = materials[materialUid];
                  if (!material) return null;
                  return (
                    <Text
                      key={"material_" + materialUid}
                      style={{
                        ...styles.bodySmall,
                        ...styles.italic,
                        ...styles.gray,
                        ...styles.alignLeft,
                      }}
                    >
                      {formatQuantity(material.totalQuantity, material.unit)}
                      {material.materialName}
                    </Text>
                  );
                })}

              {/* Menü-Notiz inline */}
              {menuNote && (
                <Text style={styles.noteInline}>
                  {menuNote.text}
                </Text>
              )}
            </View>
          );
        })}
    </View>
  );
};


export {MenuplanPdf};
