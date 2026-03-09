import React from "react";
import {Document, Page, View, Text, Font} from "@react-pdf/renderer";
import Utils from "../../Shared/utils.class";
import {MENUPLAN_NO_OF_COLUMS_PRINT as DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT} from "../../../constants/defaultValues";
import {
  MENUPLAN as TEXT_MENUPLAN,
  APP_NAME as TEXT_APP_NAME,
} from "../../../constants/text";

import StylesPdf from "../../../constants/stylesMenuplanPdf";
import {MealType, Meal, Note, MenuplanData} from "./menuplan.types";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {Footer, Header} from "../../Shared/pdfComponents";

/* ===================================================================
// =========================== Menuplan PDF ==========================
// =================================================================== */
interface MenuplanPdfProps {
  event: Event;
  menuplan: MenuplanData;
  authUser: AuthUser;
}

const MenuplanPdf = ({event, menuplan, authUser}: MenuplanPdfProps) => {
  const actualDate = new Date();
  // Array erstellen, das dem Aufbau des PDF entspricht
  //  Eine Seite hat 5 Spalten (1 die Mahlzeiten, 4 die Daten)
  const splitedDates: (Date | null)[][] = [];
  let datesOfPage: (Date | null)[] = [];

  menuplan.dates.forEach((day) => {
    datesOfPage.push(day);
    if (datesOfPage.length === DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT) {
      splitedDates.push(datesOfPage);
      datesOfPage = [];
    }
  });

  if (menuplan.dates.length % DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT !== 0) {
    //Auffüllen auf 4 damit die letzten Zeilen auch links sind
    for (
      let i = 1;
      i <=
      DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT -
        (menuplan.dates.length % DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT);
      i++
    ) {
      datesOfPage.push(null);
    }
    // Angefangene Seite aufnehmen
    splitedDates.push(datesOfPage);
  }

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
          key={"menuplanPage_" + event.uid}
          event={event}
          menuplan={menuplan}
          datesOfPage={datesOfPage}
          pageCounter={pageCounter}
          actualDate={actualDate}
          authUser={authUser}
        />
      ))}
    </Document>
  );
};
/* ===================================================================
// =========================== Rezept-Seite ==========================
// =================================================================== */
interface MenuplanPageProps {
  event: Event;
  menuplan: MenuplanData;
  datesOfPage: (Date | null)[];
  pageCounter: number;
  actualDate: Date;
  authUser: AuthUser;
}
const MenuplanPage = ({
  event,
  menuplan,
  datesOfPage,
  pageCounter,
  actualDate,
  authUser,
}: MenuplanPageProps) => {
  return (
    <Page
      key={"page_" + event.uid + "_" + pageCounter}
      orientation="landscape"
      style={styles.pageMargins}
    >
      <Header text={event.name} uid={event.uid} />
      <MenuplanTitle />
      {/*===== Body =====*/}
      <View key={"menuPlanTable_" + pageCounter} style={styles.table}>
        <MenuplanDateRow
          datesOfPage={datesOfPage}
          pageCounter={pageCounter}
          notes={menuplan.notes}
        />
        {/* Über Mahlzeiten loopen und Reihe erstellen */}
        {menuplan.mealTypes.order.map((mealTypeUid, mealTypeCounter) => {
          return (
            <MenuplanMealRow
              key={"menuplanRow_" + mealTypeUid + "_" + mealTypeCounter}
              mealType={menuplan.mealTypes.entries[mealTypeUid]}
              meals={menuplan.meals}
              menues={menuplan.menues}
              mealRecipes={menuplan.mealRecipes}
              datesOfPage={datesOfPage}
              pageCounter={pageCounter}
              notes={menuplan.notes}
              isLastRow={mealTypeCounter + 1 == menuplan.mealTypes.order.length}
            />
          );
        })}
      </View>
      <Footer uid={event.uid} actualDate={actualDate} authUser={authUser} />
    </Page>
  );
};
/* ===================================================================
// ============================== Titel ==============================
// =================================================================== */
const MenuplanTitle = () => {
  return (
    <React.Fragment>
      <View>
        <Text style={styles.title}>{TEXT_MENUPLAN}</Text>
      </View>
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Datumsreihe ===========================
// =================================================================== */
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
  let note: Note | undefined = undefined;
  return (
    <View key={"dayRow_" + pageCounter} style={styles.tableRow}>
      {/* leere Zelle oben links */}
      <View
        key={"dayRow_" + pageCounter + "_empty"}
        style={{
          ...styles.tableCol20,
          ...styles.cellPadding,
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
        if (day !== null) {
          note = Object.values(notes).find(
            (note) =>
              note.date == Utils.dateAsString(day) && note.menueUid == ""
          );
        } else {
          note = undefined;
        }
        return (
          <View
            key={"day_" + pageCounter + "_" + dayCounter}
            style={
              datesOfPage[dayCounter] == null
                ? {
                    ...styles.tableCol20,
                  }
                : dayCounter == DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT ||
                  datesOfPage[dayCounter + 1] == null
                ? {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                    ...styles.cellPadding,
                    ...styles.containerBottomBorderThin,
                  }
                : {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                    ...styles.cellPadding,
                    ...styles.containerRightBorderThin,
                    ...styles.containerBottomBorderThin,
                  }
            }
          >
            <Text style={{...styles.body, ...styles.bold}}>
              {day
                ? day.toLocaleString("default", {
                    weekday: "long",
                  })
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
            {note && (
              <Text
                style={{
                  ...styles.body,
                  ...styles.italic,
                  ...styles.gray,
                  ...styles.marginTop6,
                  ...styles.marginBottom6,
                }}
              >
                {note.text}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};
/* ===================================================================
// ========================= Mahlzeit-Reihe ==========================
// =================================================================== */
interface MenuplanMealRowProps {
  mealType: MealType;
  meals: MenuplanData["meals"];
  menues: MenuplanData["menues"];
  mealRecipes: MenuplanData["mealRecipes"];
  datesOfPage: (Date | null)[];
  pageCounter: number;
  notes: MenuplanData["notes"];
  isLastRow: boolean;
}
const MenuplanMealRow = ({
  mealType,
  meals,
  menues,
  mealRecipes,
  datesOfPage,
  pageCounter,
  notes,
  isLastRow,
}: MenuplanMealRowProps) => {
  let actualMeal: Meal | null = null;
  let note: Note | undefined = undefined;

  return (
    <View key={"dayRow_" + pageCounter} style={styles.tableRow}>
      {/* Name der Mahlzeit */}
      <View
        key={"mealRow_" + pageCounter + "_" + mealType.uid}
        style={
          isLastRow
            ? {
                // Unterstrich ausblenden
                ...styles.tableCol20,
                ...styles.cellPadding,
                ...styles.containerRightBorderThin,
              }
            : {
                ...styles.tableCol20,
                ...styles.cellPadding,
                ...styles.containerRightBorderThin,
                ...styles.containerBottomBorderThin,
              }
        }
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
      {/* Menües */}
      {datesOfPage.map((day, dayCounter) => {
        // Die Mahlzeit holen dieses Datum
        if (day != null) {
          Object.values(meals).forEach((meal) => {
            if (
              meal.mealType == mealType.uid &&
              meal.date == Utils.dateAsString(day)
            ) {
              actualMeal = meal;
            }
          });
        } else {
          actualMeal = null;
        }

        return (
          <View
            key={
              "mealRow_" + mealType.uid + "_" + pageCounter + "_" + dayCounter
            }
            style={
              datesOfPage[dayCounter] == null
                ? {
                    ...styles.tableCol20,
                  }
                : (dayCounter == DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT ||
                    datesOfPage[dayCounter + 1] == null) &&
                  isLastRow
                ? {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                  }
                : dayCounter == DEFAULT_MENUPLAN_NO_OF_COLUMS_PRINT ||
                  datesOfPage[dayCounter + 1] == null
                ? {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                    ...styles.containerBottomBorderThin,
                  }
                : isLastRow
                ? {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                    ...styles.containerRightBorderThin,
                  }
                : {
                    ...styles.tableCol20,
                    ...styles.cellPadding,
                    ...styles.containerRightBorderThin,
                    ...styles.containerBottomBorderThin,
                  }
            }
          >
            {/* Menües und deren Rezepte holen */}
            {actualMeal !== null &&
              actualMeal.menuOrder.map((menuUid) => {
                if (day !== null) {
                  note = Object.values(notes).find(
                    (note) => note.date == "" && note.menueUid == menuUid
                  );
                } else {
                  note = undefined;
                }
                return (
                  <React.Fragment key={"menue" + menuUid}>
                    <Text
                      style={{
                        ...styles.body,
                        ...styles.bold,
                        ...styles.alignLeft,
                        ...styles.marginTop6,
                        ...styles.marginBottom3,
                        // ...styles.marginLeft12,
                      }}
                    >
                      {menues[menuUid].name}
                    </Text>
                    {menues[menuUid].mealRecipeOrder.map(
                      (recipeUid, recipeCounter) => (
                        <Text
                          key={"recipe_" + recipeUid}
                          style={
                            recipeCounter + 1 ==
                            menues[menuUid].mealRecipeOrder.length
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
                              Daher wird mit ? gearbeietet, damit es keine Exception auslöst. */}
                          {mealRecipes[recipeUid]?.recipe.name}
                          {/* Variante anzeigen, falls eine! */}
                          {mealRecipes[recipeUid]?.recipe.type ==
                            RecipeType.variant && (
                            <Text style={{...styles.gray}}>
                              {` [${mealRecipes[recipeUid].recipe.variantName}]`}
                            </Text>
                          )}
                        </Text>
                      )
                    )}
                    {/* Notizen */}
                    {note && (
                      <Text
                        style={{
                          ...styles.body,
                          ...styles.gray,
                          ...styles.italic,
                          ...styles.alignLeft,
                          ...styles.marginTop6,
                          ...styles.marginBottom6,
                        }}
                      >
                        {`-> ${note.text}`}
                      </Text>
                    )}
                  </React.Fragment>
                );
              })}
          </View>
        );
      })}
    </View>
  );
};
export default MenuplanPdf;
/* ===================================================================
// ======================== Fonts registrieren =======================
// =================================================================== */
//-->gist.github.com/karimnaaji/b6c9c9e819204113e9cabf290d580551
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/7MygqTe2zs9YkP0adA9QQQ.ttf",
      fontStyle: "normal",
      fontWeight: 100,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/T1xnudodhcgwXCmZQ490TPesZW2xOQ-xsNqO47m55DA.ttf",
      fontStyle: "italic",
      fontWeight: 100,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v16/zN7GBFwfMP4uA6AR0HCoLQ.ttf",
      fontStyle: "normal",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/bdHGHleUa-ndQCOrdpfxfw.ttf",
      fontStyle: "normal",
      fontWeight: 700,
    },
  ],
});

const styles = StylesPdf.getPdfStyles();
