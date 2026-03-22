/**
 * PDF-Export des Menüplans als Querformat-Tabelle.
 *
 * Generiert ein mehrseitiges PDF-Dokument mit einer tabellarischen Darstellung
 * des Menüplans. Jede Seite zeigt bis zu 4 Tage als Spalten, mit Mahlzeitentypen
 * als Zeilen. Enthält Rezepte, Varianten und Notizen.
 */
import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import {Style} from "@react-pdf/types";
import Utils from "../../Shared/utils.class";
import {MENUPLAN_NO_OF_COLUMS_PRINT} from "../../../constants/defaultValues";
import {
  MENUPLAN as TEXT_MENUPLAN,
  APP_NAME as TEXT_APP_NAME,
} from "../../../constants/text";

import {pdfStyles} from "../../../constants/stylesMenuplanPdf";
import {
  MealType,
  Meal,
  Note,
  MenuplanData,
  Menue,
  MealRecipes,
  Materials,
  Products,
} from "./menuplan.types";
import type {MenuplanPdfOptions} from "./dialogMenuplanPdfOptions";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {Footer, Header} from "../../Shared/pdfComponents";
import "../../Shared/pdfFontRegistration";

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Teilt die Datumsarray in Seiten-Chunks auf und füllt die letzte Seite
 * mit `null`-Werten auf, damit die Tabellenspalten konsistent bleiben.
 *
 * @param dates - Sortierte Liste der Menüplan-Tage.
 * @param columnsPerPage - Anzahl Tages-Spalten pro Seite.
 * @returns Array von Seiten, jede Seite ein Array von Dates (oder null für Padding).
 */
function splitDatesIntoPages(
  dates: Date[],
  columnsPerPage: number
): (Date | null)[][] {
  const pages: (Date | null)[][] = [];
  let currentPage: (Date | null)[] = [];

  dates.forEach((day) => {
    currentPage.push(day);
    if (currentPage.length === columnsPerPage) {
      pages.push(currentPage);
      currentPage = [];
    }
  });

  // Letzte Seite auffüllen, damit die Spalten links ausgerichtet bleiben
  if (currentPage.length > 0) {
    const remaining = columnsPerPage - currentPage.length;
    for (let i = 0; i < remaining; i++) {
      currentPage.push(null);
    }
    pages.push(currentPage);
  }

  return pages;
}

/**
 * Erstellt eine Lookup-Map für Mahlzeiten, indiziert nach `mealTypeUid_dateString`.
 * Vermeidet O(n²)-Suche bei jedem Zellen-Rendering.
 *
 * @param meals - Alle Mahlzeiten des Menüplans.
 * @returns Map mit Key `${mealTypeUid}_${dateString}` → Meal.
 */
function buildMealLookup(meals: MenuplanData["meals"]): Map<string, Meal> {
  const map = new Map<string, Meal>();
  Object.values(meals).forEach((meal) => {
    map.set(`${meal.mealType}_${meal.date}`, meal);
  });
  return map;
}

/**
 * Berechnet den Zell-Rahmen-Stil basierend auf Position in der Tabelle.
 * Nullzellen (Padding) erhalten keinen Rahmen; letzte Spalte/Zeile
 * unterdrückt den rechten bzw. unteren Rand.
 *
 * @param options - Position der Zelle in der Tabelle.
 * @returns Style-Objekt mit den passenden Rahmen-Properties.
 */
function getCellBorderStyle(options: {
  isNullCell: boolean;
  isLastColumn: boolean;
  isLastRow: boolean;
}): Style[] {
  const {isNullCell, isLastColumn, isLastRow} = options;

  if (isNullCell) {
    return [styles.tableCol20];
  }

  const result: Style[] = [styles.tableCol20, styles.cellPadding];
  if (!isLastRow) result.push(styles.containerBottomBorderThin);
  if (!isLastColumn) result.push(styles.containerRightBorderThin);
  return result;
}

/**
 * Sucht die Tages-Notiz für ein bestimmtes Datum (ohne Menü-Zuordnung).
 *
 * @param notes - Alle Notizen des Menüplans.
 * @param date - Das Datum, für das die Notiz gesucht wird.
 * @returns Die gefundene Notiz oder undefined.
 */
function findNoteForDate(
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
function findNoteForMenu(
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
 * Wurzelkomponente des Menüplan-PDFs.
 * Erzeugt ein mehrseitiges Querformat-Dokument mit Kopf- und Fusszeile.
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

const MenuplanPdf = ({event, menuplan, authUser, pdfOptions}: MenuplanPdfProps) => {
  const actualDate = new Date();
  const splitedDates = splitDatesIntoPages(
    menuplan.dates,
    MENUPLAN_NO_OF_COLUMS_PRINT
  );

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={event.name + " " + TEXT_MENUPLAN}
      subject={TEXT_MENUPLAN + " " + event.name}
      title={TEXT_MENUPLAN + " " + event.name}
    >
      {splitedDates.map((datesOfPage, pageCounter) => (
        <MenuplanPage
          key={"menuplanPage_" + event.uid + "_" + pageCounter}
          event={event}
          menuplan={menuplan}
          datesOfPage={datesOfPage}
          pageCounter={pageCounter}
          actualDate={actualDate}
          authUser={authUser}
          pdfOptions={pdfOptions}
        />
      ))}
    </Document>
  );
};


/**
 * Eine einzelne Seite des Menüplan-PDFs (Querformat).
 * Enthält Header, Titel, Datums-/Mahlzeit-Tabelle und Footer.
 *
 * @param event - Der zugehörige Event.
 * @param menuplan - Vollständige Menüplan-Daten.
 * @param datesOfPage - Die Tage dieser Seite (inkl. null-Padding).
 * @param pageCounter - Seitenindex (0-basiert).
 * @param actualDate - Aktuelles Datum für den Footer.
 * @param authUser - Authentifizierter Benutzer.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
interface MenuplanPageProps {
  event: Event;
  menuplan: MenuplanData;
  datesOfPage: (Date | null)[];
  pageCounter: number;
  actualDate: Date;
  authUser: AuthUser;
  pdfOptions: MenuplanPdfOptions;
}

const MenuplanPage = ({
  event,
  menuplan,
  datesOfPage,
  pageCounter,
  actualDate,
  authUser,
  pdfOptions,
}: MenuplanPageProps) => {
  return (
    <Page
      key={"page_" + event.uid + "_" + pageCounter}
      orientation="landscape"
      style={styles.pageMargins}
    >
      <Header text={event.name} uid={event.uid} />
      <MenuplanTitle />
      <View key={"menuPlanTable_" + pageCounter} style={styles.table}>
        <MenuplanDateRow
          datesOfPage={datesOfPage}
          pageCounter={pageCounter}
          notes={menuplan.notes}
        />
        {menuplan.mealTypes.order.map((mealTypeUid, mealTypeCounter) => (
          <MenuplanMealRow
            key={"menuplanRow_" + mealTypeUid + "_" + mealTypeCounter}
            mealType={menuplan.mealTypes.entries[mealTypeUid]}
            meals={menuplan.meals}
            menues={menuplan.menues}
            mealRecipes={menuplan.mealRecipes}
            products={menuplan.products}
            materials={menuplan.materials}
            datesOfPage={datesOfPage}
            pageCounter={pageCounter}
            notes={menuplan.notes}
            isLastRow={
              mealTypeCounter + 1 === menuplan.mealTypes.order.length
            }
            pdfOptions={pdfOptions}
          />
        ))}
      </View>
      <Footer uid={event.uid} actualDate={actualDate} authUser={authUser} />
    </Page>
  );
};


/**
 * Titelzeile des Menüplan-PDFs.
 */
const MenuplanTitle = () => {
  return (
    <View>
      <Text style={styles.title}>{TEXT_MENUPLAN}</Text>
    </View>
  );
};


/**
 * Kopfzeile der Tabelle mit Wochentagen, Datumsangaben und Tagesnotizen.
 *
 * @param datesOfPage - Die Tage dieser Seite (inkl. null-Padding).
 * @param pageCounter - Seitenindex.
 * @param notes - Alle Notizen des Menüplans.
 */
interface MenuplanDateRowProps {
  datesOfPage: (Date | null)[];
  pageCounter: number;
  notes: MenuplanData["notes"];
}

const MenuplanDateRow = ({
  datesOfPage,
  pageCounter,
  notes,
}: MenuplanDateRowProps) => {
  return (
    <View key={"dayRow_" + pageCounter} style={styles.tableRow}>
      {/* Leere Zelle oben links */}
      <View
        key={"dayRow_" + pageCounter + "_empty"}
        style={{
          ...styles.tableCol20,
          ...styles.cellPadding,
          ...styles.containerRightBorderThin,
          ...styles.containerBottomBorderThin,
        }}
      >
        <Text key={"day_" + pageCounter + "_empty"} style={styles.body}>
          {" "}
        </Text>
      </View>
      {/* Wochentage mit Datum */}
      {datesOfPage.map((day, dayCounter) => {
        const isNullCell = day === null;
        const isLastColumn =
          dayCounter === MENUPLAN_NO_OF_COLUMS_PRINT ||
          datesOfPage[dayCounter + 1] === null;

        const note =
          day !== null ? findNoteForDate(notes, day) : undefined;

        return (
          <View
            key={"day_" + pageCounter + "_" + dayCounter}
            style={getCellBorderStyle({
              isNullCell,
              isLastColumn,
              isLastRow: false,
            })}
          >
            <Text style={{...styles.body, ...styles.bold}}>
              {day
                ? day.toLocaleString("default", {weekday: "long"})
                : " "}
            </Text>
            <Text
              style={{
                ...styles.body,
                ...styles.bodyThin,
                ...styles.bodyFontSmall,
              }}
            >
              {day
                ? day.toLocaleString("de-CH", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                : " "}
            </Text>
            {note && <MenuplanNoteBlock text={note.text} />}
          </View>
        );
      })}
    </View>
  );
};


/**
 * Eine Tabellenzeile für einen Mahlzeitentyp (z.B. Frühstück).
 * Zeigt den Mahlzeitnamen links und delegiert jede Tagesspalte an MenuplanMealCell.
 *
 * @param mealType - Der Mahlzeitentyp dieser Zeile.
 * @param meals - Alle Mahlzeiten des Menüplans.
 * @param menues - Alle Menüs.
 * @param mealRecipes - Alle eingeplanten Rezepte.
 * @param products - Alle eingeplanten Produkte.
 * @param materials - Alle eingeplanten Materialien.
 * @param datesOfPage - Die Tage dieser Seite.
 * @param pageCounter - Seitenindex.
 * @param notes - Alle Notizen.
 * @param isLastRow - Ob dies die letzte Mahlzeitenzeile ist (unterdrückt unteren Rand).
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
interface MenuplanMealRowProps {
  mealType: MealType;
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  mealRecipes: MenuplanData["mealRecipes"];
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  datesOfPage: (Date | null)[];
  pageCounter: number;
  notes: MenuplanData["notes"];
  isLastRow: boolean;
  pdfOptions: MenuplanPdfOptions;
}

const MenuplanMealRow = ({
  mealType,
  meals,
  menues,
  mealRecipes,
  products,
  materials,
  datesOfPage,
  pageCounter,
  notes,
  isLastRow,
  pdfOptions,
}: MenuplanMealRowProps) => {
  const mealLookup = buildMealLookup(meals);

  return (
    <View key={"dayRow_" + pageCounter} style={styles.tableRow}>
      {/* Name der Mahlzeit */}
      <View
        key={"mealRow_" + pageCounter + "_" + mealType.uid}
        style={{
          ...styles.tableCol20,
          ...styles.cellPadding,
          ...styles.containerRightBorderThin,
          ...(!isLastRow ? styles.containerBottomBorderThin : {}),
        }}
      >
        <Text
          key={"meal_" + pageCounter + "_" + mealType.uid}
          style={{
            ...styles.body,
            ...styles.alignLeft,
            ...styles.marginTop6,
          }}
        >
          {mealType.name}
        </Text>
      </View>
      {/* Tagesspalten */}
      {datesOfPage.map((day, dayCounter) => (
        <MenuplanMealCell
          key={
            "mealRow_" + mealType.uid + "_" + pageCounter + "_" + dayCounter
          }
          day={day}
          dayCounter={dayCounter}
          datesOfPage={datesOfPage}
          mealType={mealType}
          mealLookup={mealLookup}
          menues={menues}
          mealRecipes={mealRecipes}
          products={products}
          materials={materials}
          notes={notes}
          isLastRow={isLastRow}
          pdfOptions={pdfOptions}
        />
      ))}
    </View>
  );
};


/**
 * Eine einzelne Zelle in der Mahlzeiten-Tabelle (ein Tag × ein Mahlzeitentyp).
 * Rendert alle Menüs dieses Tages für den gegebenen Mahlzeitentyp.
 *
 * @param day - Das Datum dieser Spalte (oder null für Padding).
 * @param dayCounter - Spaltenindex.
 * @param datesOfPage - Alle Tage der Seite (für Rand-Berechnung).
 * @param mealType - Der Mahlzeitentyp.
 * @param mealLookup - Vorberechnete Meal-Lookup-Map.
 * @param menues - Alle Menüs.
 * @param mealRecipes - Alle eingeplanten Rezepte.
 * @param products - Alle eingeplanten Produkte.
 * @param materials - Alle eingeplanten Materialien.
 * @param notes - Alle Notizen.
 * @param isLastRow - Ob dies die letzte Zeile ist.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
interface MenuplanMealCellProps {
  day: Date | null;
  dayCounter: number;
  datesOfPage: (Date | null)[];
  mealType: MealType;
  mealLookup: Map<string, Meal>;
  menues: MenuplanData["menues"];
  mealRecipes: MenuplanData["mealRecipes"];
  products: MenuplanData["products"];
  materials: MenuplanData["materials"];
  notes: MenuplanData["notes"];
  isLastRow: boolean;
  pdfOptions: MenuplanPdfOptions;
}

const MenuplanMealCell = ({
  day,
  dayCounter,
  datesOfPage,
  mealType,
  mealLookup,
  menues,
  mealRecipes,
  products,
  materials,
  notes,
  isLastRow,
  pdfOptions,
}: MenuplanMealCellProps) => {
  const isNullCell = day === null;
  const isLastColumn =
    dayCounter === MENUPLAN_NO_OF_COLUMS_PRINT ||
    datesOfPage[dayCounter + 1] === null;

  const meal =
    day !== null
      ? mealLookup.get(`${mealType.uid}_${Utils.dateAsString(day)}`) ?? null
      : null;

  return (
    <View style={getCellBorderStyle({isNullCell, isLastColumn, isLastRow})}>
      {meal !== null &&
        meal.menuOrder.map((menuUid) => (
          <MenuplanMenuBlock
            key={"menue" + menuUid}
            menue={menues[menuUid]}
            mealRecipes={mealRecipes}
            products={products}
            materials={materials}
            note={
              day !== null
                ? findNoteForMenu(notes, menuUid, day)
                : undefined
            }
            pdfOptions={pdfOptions}
          />
        ))}
    </View>
  );
};


/**
 * Ein einzelnes Menü innerhalb einer Mahlzeit-Zelle.
 * Zeigt den Menünamen (fett), alle Rezepte, optionale Produkte/Materialien
 * und eine optionale Notiz.
 *
 * @param menue - Das Menü mit Name und Rezept-/Produkt-/Material-Reihenfolge.
 * @param mealRecipes - Alle eingeplanten Rezepte.
 * @param products - Alle eingeplanten Produkte.
 * @param materials - Alle eingeplanten Materialien.
 * @param note - Optionale Notiz zu diesem Menü.
 * @param pdfOptions - Vom Benutzer gewählte Darstellungsoptionen.
 */
interface MenuplanMenuBlockProps {
  menue: Menue;
  mealRecipes: MealRecipes;
  products: Products;
  materials: Materials;
  note: Note | undefined;
  pdfOptions: MenuplanPdfOptions;
}

const MenuplanMenuBlock = ({
  menue,
  mealRecipes,
  products,
  materials,
  note,
  pdfOptions,
}: MenuplanMenuBlockProps) => {
  // Prüfen, ob nach den Rezepten noch Produkte/Materialien folgen
  // (beeinflusst den Abstand des letzten Rezepts)
  const hasTrailingGoods =
    (pdfOptions.showProducts && menue.productOrder.length > 0) ||
    (pdfOptions.showMaterials && menue.materialOrder.length > 0);

  return (
    <React.Fragment>
      <Text
        style={{
          ...styles.body,
          ...styles.bold,
          ...styles.alignLeft,
          ...styles.marginTop6,
          ...styles.marginBottom3,
        }}
      >
        {menue.name}
      </Text>
      {menue.mealRecipeOrder.map((recipeUid, recipeCounter) => (
        <MenuplanRecipeEntry
          key={"recipe_" + recipeUid}
          mealRecipe={mealRecipes[recipeUid]}
          isLastEntry={
            recipeCounter + 1 === menue.mealRecipeOrder.length &&
            !hasTrailingGoods
          }
          showPortions={pdfOptions.showPortions}
        />
      ))}
      {/* Produkte */}
      {pdfOptions.showProducts &&
        menue.productOrder.map((productUid, idx) => {
          const product = products[productUid];
          if (!product) return null;
          const isLast =
            idx + 1 === menue.productOrder.length &&
            !(pdfOptions.showMaterials && menue.materialOrder.length > 0);
          return (
            <MenuplanGoodsEntry
              key={"product_" + productUid}
              name={product.productName}
              quantity={product.totalQuantity}
              unit={product.unit}
              isLastEntry={isLast}
            />
          );
        })}
      {/* Materialien */}
      {pdfOptions.showMaterials &&
        menue.materialOrder.map((materialUid, idx) => {
          const material = materials[materialUid];
          if (!material) return null;
          return (
            <MenuplanGoodsEntry
              key={"material_" + materialUid}
              name={material.materialName}
              quantity={material.totalQuantity}
              unit={material.unit}
              isLastEntry={idx + 1 === menue.materialOrder.length}
            />
          );
        })}
      {note && <MenuplanNoteBlock text={note.text} />}
    </React.Fragment>
  );
};


/**
 * Eine einzelne Rezeptzeile innerhalb eines Menü-Blocks.
 * Zeigt den Rezeptnamen mit optionalem Varianten-Badge und Portionen.
 *
 * @param mealRecipe - Das eingeplante Rezept (kann undefined sein, wenn gelöscht).
 * @param isLastEntry - Ob dies der letzte Eintrag im Menü ist (für Abstand).
 * @param showPortions - Ob die Portionenzahl angezeigt werden soll.
 */
interface MenuplanRecipeEntryProps {
  mealRecipe: MealRecipes[string] | undefined;
  isLastEntry: boolean;
  showPortions: boolean;
}

const MenuplanRecipeEntry = ({
  mealRecipe,
  isLastEntry,
  showPortions,
}: MenuplanRecipeEntryProps) => {
  return (
    <Text
      style={
        isLastEntry
          ? {
              ...styles.body,
              ...styles.alignLeft,
              ...styles.marginLeft12,
              ...styles.marginBottom6,
            }
          : {
              ...styles.body,
              ...styles.alignLeft,
              ...styles.marginLeft12,
            }
      }
    >
      {/* Kann sein, dass das Menü nicht mehr existiert (aber der Index-Eintrag).
          Daher wird mit ?. gearbeitet, damit es keine Exception auslöst. */}
      {mealRecipe?.recipe.name}
      {mealRecipe?.recipe.type === RecipeType.variant && (
        <Text style={{...styles.gray}}>
          {` [${mealRecipe.recipe.variantName}]`}
        </Text>
      )}
      {showPortions && mealRecipe && mealRecipe.totalPortions > 0 && (
        <Text style={{...styles.gray, ...styles.bodyFontSmall}}>
          {` (${mealRecipe.totalPortions} Port.)`}
        </Text>
      )}
    </Text>
  );
};


/**
 * Eine einzelne Produkt- oder Material-Zeile innerhalb eines Menü-Blocks.
 * Darstellung in Kursiv/Grau, um sie von Rezepten zu unterscheiden.
 *
 * @param name - Anzeigename des Produkts/Materials.
 * @param quantity - Gesamtmenge.
 * @param unit - Einheits-Key.
 * @param isLastEntry - Ob dies der letzte Eintrag im Menü ist (für Abstand).
 */
interface MenuplanGoodsEntryProps {
  name: string;
  quantity: number;
  unit: string;
  isLastEntry: boolean;
}

const MenuplanGoodsEntry = ({
  name,
  quantity,
  unit,
  isLastEntry,
}: MenuplanGoodsEntryProps) => {
  // Menge formatieren: 0 nicht anzeigen, Dezimalstellen nur wenn nötig
  const quantityText =
    quantity > 0
      ? `${Number.isInteger(quantity) ? quantity : quantity.toFixed(1)} ${unit} `
      : "";

  return (
    <Text
      style={
        isLastEntry
          ? {
              ...styles.body,
              ...styles.italic,
              ...styles.gray,
              ...styles.alignLeft,
              ...styles.marginLeft12,
              ...styles.marginBottom6,
            }
          : {
              ...styles.body,
              ...styles.italic,
              ...styles.gray,
              ...styles.alignLeft,
              ...styles.marginLeft12,
            }
      }
    >
      {quantityText}{name}
    </Text>
  );
};


/**
 * Einheitliche Darstellung einer Notiz im Menüplan-PDF.
 * Grauer Hintergrund, kursiv — wird sowohl für Tages- als auch Menü-Notizen verwendet.
 *
 * @param text - Der Notiztext.
 */
const MenuplanNoteBlock = ({text}: {text: string}) => {
  return (
    <View
      style={{
        ...styles.noteBackground,
        ...styles.marginTop6,
        ...styles.marginBottom6,
      }}
    >
      <Text
        style={{
          ...styles.body,
          ...styles.italic,
          textAlign: "center",
        }}
      >
        {text}
      </Text>
    </View>
  );
};

export {MenuplanPdf};

// Export für Unit-Tests
export {
  splitDatesIntoPages,
  buildMealLookup,
  getCellBorderStyle,
  findNoteForDate,
  findNoteForMenu,
};

const styles = pdfStyles;
