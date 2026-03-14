import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import "../../Shared/pdfFontRegistration";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {pdfStyles} from "../../../constants/stylesShoppingListPdf";

import {
  APP_NAME as TEXT_APP_NAME,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
  ITEM as TEXT_ITEM,
} from "../../../constants/text";

import {Footer, Header} from "../../Shared/pdfComponents";
import ShoppingList, {ShoppingListItem} from "./shoppingList.class";
import {ShoppingListProperties} from "./shoppingListCollection.class";

const styles = pdfStyles;

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/** Zahlenformat für Mengenangaben (Schweizer Locale, max. 3 signifikante Stellen). */
const QUANTITY_FORMAT = new Intl.NumberFormat("de-CH", {
  maximumSignificantDigits: 3,
});

// Anzahl Zeilen, die pro Seite platz haben
const LINES_PER_PAGE = {
  FIRST: 31,
  REST: 33,
};

enum Column {
  LEFT,
  RIGHT,
}
enum LineType {
  DEPARTMENT,
  ITEM,
}

/** Seite der formatierten Einkaufsliste mit Steuerungsinformationen. */
interface FormattedShoppingListPage {
  pageControl: PageControl;
  list: FormattedShoppingListLine[];
}

/** Zeile der formatierten Einkaufsliste (linke + rechte Spalte). */
interface FormattedShoppingListLine {
  left: FormattedShoppingListItem | FormattedShoppingListDepartment | null;
  right: FormattedShoppingListItem | FormattedShoppingListDepartment | null;
}

/** Einzelnes Produkt in der formatierten Einkaufsliste. */
interface FormattedShoppingListItem {
  type: LineType.ITEM;
  checked: boolean;
  quantity: ShoppingListItem["quantity"];
  unit: ShoppingListItem["unit"];
  name: string;
}
/** Abteilungsüberschrift in der formatierten Einkaufsliste. */
interface FormattedShoppingListDepartment {
  type: LineType.DEPARTMENT;
  name: string;
}

/** Cursor-Zustand für die aktuelle Position im zweispaltigen Layout. */
interface PageControl {
  lineCounter: number;
  actualColumn: Column;
  maxLines: number;
}

/**
 * Erzeugt einen neuen PageControl mit Zeiger auf Zeile 0, linke Spalte.
 *
 * @param maxLines - Maximale Zeilenanzahl pro Spalte auf dieser Seite.
 * @returns Neuer PageControl.
 */
function createPageControl(maxLines: number): PageControl {
  return {lineCounter: 0, actualColumn: Column.LEFT, maxLines};
}

// ===================================================================== */
/**
 * Formatiert eine Einkaufsliste für das zweispaltige PDF-Layout.
 *
 * Die Einträge werden so gebündelt, dass sie in der Render-Methode
 * korrekt nebeneinander angezeigt werden, auch wenn die Leserichtung
 * von oben nach unten ist.
 *
 * @param shoppingList - Die zu formatierende Einkaufsliste.
 * @returns Array von formatierten Seiten mit Steuerungsinformationen.
 */
function formatShoppingList(
  shoppingList: ShoppingList,
): FormattedShoppingListPage[] {
  const pages: FormattedShoppingListPage[] = [];
  let actualPage = 0;

  // Leere Abteilungen herausfiltern
  const departments = Object.values(shoppingList.list).filter(
    (dept) => dept.items.length > 0,
  );
  const noDepartments = departments.length;
  const noItems = departments.reduce(
    (sum, dept) => sum + dept.items.length,
    0,
  );

  // Keine Einträge → leere Seite zurückgeben
  if (noDepartments === 0) {
    pages.push({pageControl: createPageControl(0), list: []});
    return pages;
  }

  // Anzahl Zeilen bestimmen (Items + Abteilungstitel + Trennzeilen zwischen Abteilungen)
  const noEntries = noItems + noDepartments + (noDepartments - 1);
  // 2 Spalten → halb so viele Zeilen (aufgerundet, damit die rechte Spalte nicht überläuft)
  let noLines = Math.ceil(noEntries / 2);

  // Seiten mit Max.Zeilen bestimmen
  do {
    if (pages.length === 0 && noLines > LINES_PER_PAGE.FIRST) {
      pages.push({pageControl: createPageControl(LINES_PER_PAGE.FIRST), list: []});
      noLines = noLines - LINES_PER_PAGE.FIRST;
    } else if (pages.length === 0 && noLines <= LINES_PER_PAGE.FIRST) {
      pages.push({pageControl: createPageControl(noLines), list: []});
      noLines = 0;
    } else if (pages.length > 0 && noLines > LINES_PER_PAGE.REST) {
      pages.push({pageControl: createPageControl(LINES_PER_PAGE.REST), list: []});
      noLines = noLines - LINES_PER_PAGE.REST;
    } else {
      pages.push({pageControl: createPageControl(noLines), list: []});
      noLines = 0;
    }
  } while (noLines > 0);

  /* ----------------------------------------------------------------- */
  /* Hilfsfunktionen (Closures über pages / actualPage)                */
  /* ----------------------------------------------------------------- */

  /** Stellt sicher, dass die aktuelle Seite im Array existiert. */
  function ensurePageExists() {
    if (!pages[actualPage]) {
      pages.push({pageControl: createPageControl(LINES_PER_PAGE.REST), list: []});
    }
  }

  /** Füllt die linke Spalte bis maxLines mit Leerzeilen auf. */
  function padToEndOfLeftColumn(pageControl: PageControl) {
    while (pageControl.lineCounter < pageControl.maxLines) {
      pages[actualPage].list.push({left: null, right: null});
      pageControl.lineCounter++;
    }
  }

  /** Prüft ob ein Spalten- oder Seitenumbruch nötig ist. */
  function updatePageControl(pageControl: PageControl) {
    if (
      pageControl.lineCounter === pageControl.maxLines &&
      pageControl.actualColumn === Column.LEFT
    ) {
      pageControl.lineCounter = 0;
      pageControl.actualColumn = Column.RIGHT;
    } else if (
      pageControl.lineCounter === pageControl.maxLines &&
      pageControl.actualColumn === Column.RIGHT
    ) {
      actualPage++;
      ensurePageExists();
    }
  }

  /**
   * Stellt sicher, dass genügend Platz für einen Abteilungstitel
   * plus mindestens ein Item vorhanden ist.
   */
  function ensureSpaceForDepartment(
    pageControl: PageControl,
    itemsCount: number,
  ) {
    if (itemsCount <= 0) return;

    const freeLines = pageControl.maxLines - pageControl.lineCounter;
    if (freeLines >= 2) return;

    if (pageControl.actualColumn === Column.LEFT) {
      padToEndOfLeftColumn(pageControl);
      pageControl.lineCounter = 0;
      pageControl.actualColumn = Column.RIGHT;
    } else {
      actualPage++;
      ensurePageExists();
    }
  }

  /**
   * Stellt sicher, dass die Zeile am aktuellen lineCounter existiert.
   * Wird vor jedem Schreiben in die rechte Spalte aufgerufen.
   */
  function ensureRowExists(pageControl: PageControl) {
    if (!pages[actualPage].list[pageControl.lineCounter]) {
      pages[actualPage].list.push({left: null, right: null});
    }
  }

  /* ----------------------------------------------------------------- */
  /* Einträge in die Seiten einfüllen                                  */
  /* ----------------------------------------------------------------- */

  departments.forEach((department, departmentIndex) => {
    let pageControl = pages[actualPage].pageControl;

    // Platz prüfen, bevor die Überschrift geschrieben wird
    ensureSpaceForDepartment(pageControl, department.items.length);

    // pageControl neu holen (falls Seite/Spalte gewechselt wurde)
    pageControl = pages[actualPage].pageControl;

    // Abteilungs-Überschrift schreiben
    switch (pageControl.actualColumn) {
      case Column.LEFT:
        pages[actualPage].list.push({
          left: {type: LineType.DEPARTMENT, name: department.departmentName},
          right: null,
        });
        pageControl.lineCounter++;
        break;
      case Column.RIGHT:
        ensureRowExists(pageControl);
        pages[actualPage].list[pageControl.lineCounter].right = {
          type: LineType.DEPARTMENT,
          name: department.departmentName,
        };
        pageControl.lineCounter++;
        break;
    }
    updatePageControl(pageControl);

    // Items der Abteilung schreiben
    department.items.forEach((item) => {
      pageControl = pages[actualPage].pageControl;
      switch (pageControl.actualColumn) {
        case Column.LEFT:
          pages[actualPage].list.push({
            left: {
              type: LineType.ITEM,
              quantity: item.quantity,
              checked: item.checked,
              unit: item.unit,
              name: item.item.name,
            },
            right: null,
          });
          pageControl.lineCounter++;
          break;
        case Column.RIGHT:
          ensureRowExists(pageControl);
          pages[actualPage].list[pageControl.lineCounter].right = {
            type: LineType.ITEM,
            checked: item.checked,
            quantity: item.quantity,
            unit: item.unit,
            name: item.item.name,
          };
          pageControl.lineCounter++;
          break;
      }
      updatePageControl(pageControl);
    });

    // Leerzeile nach jeder Abteilung ausser der letzten
    const isLastDepartment = departmentIndex === noDepartments - 1;
    if (!isLastDepartment && pageControl.lineCounter !== 0) {
      if (pageControl.actualColumn === Column.LEFT) {
        pages[actualPage].list.push({left: null, right: null});
      }
      pageControl.lineCounter++;
      updatePageControl(pageControl);
    }
  });

  return pages;
}

/* ===================================================================
// ========================= PDF Einkaufsliste =======================
// =================================================================== */
/**
 * PDF-Dokument für die Einkaufsliste.
 *
 * Rendert die Einkaufsliste als zweispaltiges, mehrseitiges PDF-Dokument.
 * Die Einträge werden mit {@link formatShoppingList} für das zweispaltige
 * Layout vorformatiert.
 *
 * @param props - Einkaufslistendaten, Event-Name und Autoreninfo.
 */
interface ShoppingListPdfProps {
  shoppingList: ShoppingList;
  shoppingListName: ShoppingListProperties["name"];
  shoppingListSelectedTimeSlice: string;
  eventName: Event["name"];
  authUser: AuthUser;
}
const ShoppingListPdf = ({
  shoppingList,
  shoppingListName,
  shoppingListSelectedTimeSlice,
  eventName,
  authUser,
}: ShoppingListPdfProps) => {
  const actualDate = new Date();
  const formattedShoppingList = formatShoppingList(shoppingList);
  const itemCount = ShoppingList.countItems({shoppingList});

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={eventName + " " + TEXT_SHOPPING_LIST}
      subject={TEXT_SHOPPING_LIST + " " + eventName}
      title={TEXT_SHOPPING_LIST + " " + eventName}
    >
      {formattedShoppingList.map((page, counter) => (
        <ShoppingListPage
          eventName={eventName}
          shoppingList={page.list}
          shoppingListName={shoppingListName}
          shoppingListSelectedTimeSlice={shoppingListSelectedTimeSlice}
          itemCount={itemCount}
          actualDate={actualDate}
          pageNumber={counter}
          authUser={authUser}
          key={"shoppintListPage_" + counter}
        />
      ))}
    </Document>
  );
};

/* ===================================================================
// =========================== Einkaufsliste-Seite ===================
// =================================================================== */
/**
 * Einzelne Seite der Einkaufsliste im PDF.
 *
 * @param props - Formatierte Listenzeilen, Seitenmetadaten und Autoreninfo.
 */
interface ShoppingListPageProps {
  shoppingList: FormattedShoppingListLine[];
  shoppingListName: ShoppingListProperties["name"];
  shoppingListSelectedTimeSlice: string;
  eventName: Event["name"];
  itemCount: number;
  actualDate: Date;
  pageNumber: number;
  authUser: AuthUser;
}
const ShoppingListPage = ({
  shoppingList,
  shoppingListName,
  shoppingListSelectedTimeSlice,
  eventName,
  itemCount,
  actualDate,
  pageNumber,
  authUser,
}: ShoppingListPageProps) => {
  return (
    <Page key={"page_" + pageNumber} style={styles.body}>
      <Header text={eventName} uid={"Header_" + pageNumber} />
      <ShoppingListTitle
        shoppingListName={shoppingListName}
        shoppingListSelectedTimeSlice={shoppingListSelectedTimeSlice}
        itemCount={itemCount}
      />
      <ShoppingListList shoppingList={shoppingList} pageNumber={pageNumber} />

      <Footer
        uid={"Footer_" + pageNumber}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Page>
  );
};
/* ===================================================================
// ============================== Titel ==============================
// =================================================================== */
/**
 * Titelbereich der Einkaufsliste mit Name, Zeitraum und Artikelanzahl.
 *
 * @param props - Listenname, ausgewählter Zeitabschnitt und Artikelanzahl.
 */
interface ShoppingListTitleProps {
  shoppingListName: ShoppingListProperties["name"];
  shoppingListSelectedTimeSlice: string;
  itemCount: number;
}
const ShoppingListTitle = ({
  shoppingListName,
  shoppingListSelectedTimeSlice,
  itemCount,
}: ShoppingListTitleProps) => {
  return (
    <React.Fragment>
      <View>
        <Text style={styles.title}>{TEXT_SHOPPING_LIST}</Text>
      </View>
      <View style={styles.containerBottomBorder} />
      <Text
        style={styles.subSubTitle}
      >{`${shoppingListName}: ${shoppingListSelectedTimeSlice} (${itemCount} ${TEXT_ITEM})`}</Text>
      <View style={styles.containerBottomBorder} />
    </React.Fragment>
  );
};
/* ===================================================================
// ============================ Item-Liste ===========================
// =================================================================== */
/**
 * Zweispaltige Tabelle mit den Einkaufslistenpositionen.
 *
 * @param props - Formatierte Listenzeilen und Seitennummer.
 */
interface ShoppingListListProps {
  shoppingList: FormattedShoppingListLine[];
  pageNumber: number;
}
const ShoppingListList = ({
  shoppingList,
  pageNumber,
}: ShoppingListListProps) => {
  return (
    <View style={styles.table} key={"itemBlockTable_" + pageNumber}>
      {shoppingList.map((item, line) => (
        <View
          style={styles.tableRow}
          key={"itemBlock_" + "_" + pageNumber + "_" + line}
        >
          <ShoppingListColumn
            entry={item.left}
            side="Left"
            pageNumber={pageNumber}
            line={line}
          />
          <ShoppingListColumn
            entry={item.right}
            side="Right"
            pageNumber={pageNumber}
            line={line}
          />
        </View>
      ))}
    </View>
  );
};

/* ===================================================================
// ======================== Einzelne Spalte ===========================
// =================================================================== */

/**
 * Gibt den Zellenstil für einen Eintrag zurück — durchgestrichen und grau
 * wenn abgehakt, sonst normaler Tabellenzellenstil.
 *
 * @param checked - Ob der Eintrag abgehakt ist.
 * @returns Kombinierter Style für die Tabellenzelle.
 */
const checkedCellStyle = (checked: boolean) =>
  checked
    ? {...styles.tableCell, ...styles.gray, ...styles.strikeTrough}
    : styles.tableCell;

/**
 * Rendert eine einzelne Spalte (links oder rechts) einer Einkaufslistenzeile.
 *
 * Zeigt je nach Typ: nichts (null), eine Abteilungsüberschrift oder
 * ein Item mit Menge, Einheit und Name.
 *
 * @param props.entry - Der Spalteninhalt (Item, Abteilung oder null).
 * @param props.side - "Left" oder "Right" für eindeutige Keys.
 * @param props.pageNumber - Seitennummer für eindeutige Keys.
 * @param props.line - Zeilennummer für eindeutige Keys.
 */
interface ShoppingListColumnProps {
  entry: FormattedShoppingListItem | FormattedShoppingListDepartment | null;
  side: "Left" | "Right";
  pageNumber: number;
  line: number;
}
const ShoppingListColumn = ({
  entry,
  side,
  pageNumber,
  line,
}: ShoppingListColumnProps) => {
  if (entry == null) {
    return (
      <View
        style={styles.tableCol50}
        key={`itemBlockNull_${side}_${pageNumber}_${line}`}
      />
    );
  }

  if (entry.type === LineType.DEPARTMENT) {
    return (
      <View
        style={styles.tableCol50}
        key={`itemBlockDepartment_${side}_${pageNumber}_${line}`}
      >
        <Text
          style={{
            ...styles.tableCellBold,
            ...styles.tableCellAlignLeft,
            ...styles.tableCellMarginTop,
          }}
        >
          {entry.name}
        </Text>
      </View>
    );
  }

  // LineType.ITEM
  const cellStyle = checkedCellStyle(entry.checked);
  return (
    <React.Fragment key={`item_${side}_${pageNumber}_${line}`}>
      <View
        style={styles.tableColQuantity}
        key={`itemBlockQuantity_${side}_${pageNumber}_${line}`}
      >
        <Text style={cellStyle}>
          {Number.isNaN(entry.quantity) || !entry.quantity
            ? ""
            : QUANTITY_FORMAT.format(entry.quantity)}
        </Text>
      </View>
      <View
        style={styles.tableColUnit}
        key={`itemBlockUnit_${side}_${pageNumber}_${line}`}
      >
        <Text style={cellStyle}>{entry.unit}</Text>
      </View>
      <View
        style={styles.tableColItem}
        key={`itemBlockProduct_${side}_${pageNumber}_${line}`}
      >
        <Text style={cellStyle}>{entry.name}</Text>
      </View>
    </React.Fragment>
  );
};

export default ShoppingListPdf;
