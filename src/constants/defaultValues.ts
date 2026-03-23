// Default Werte für jegliche Parameter

import {Utils, Environment} from "../components/Shared/utils.class";
import {
  WITHOUT_INTOLERANCES as TEXT_WITHOUT_INTOLERANCES,
  LACTOSE_INTOLERANCE as TEXT_LACTOSE_INTOLERANCE,
  GLUTEN_INTOLERANCE as TEXT_GLUTEN_INTOLERANCE,
  MEAT as TEXT_MEAT,
  VEGETARIAN as TEXT_VEGETARIAN,
} from "../constants/text";

export const FEEDS_DISPLAY = 10;
export const RECIPE_DISPLAY = 6;
export const COMMENT_DISPLAY = 3;
export const RECIPES_SEARCH = 12;

export const MENUPLAN_MEALS = [
  {name: "Zmorgen", uid: ""},
  {name: "Zmittag", uid: ""},
  {name: "Znacht", uid: ""},
];

export const TWINT_PAYLINK = "https://pay.raisenow.io/jhbvj";

export const MENUPLAN_NO_OF_COLUMS_PRINT = 4;

export const HELPCENTER_URL = "https://help.chuchipirat.ch";

export const MAILADDRESS = "hallo@chuchipirat.ch";

export const INSTAGRAM_URL = "https://www.instagram.com/chuchipirat/";

export const SESSION_STORAGE_VALIDITY_DURATION = 3600;

export const INTOLERANCES = [
  TEXT_WITHOUT_INTOLERANCES,
  TEXT_LACTOSE_INTOLERANCE,
  TEXT_GLUTEN_INTOLERANCE,
];

export const DIETS = [TEXT_MEAT, TEXT_VEGETARIAN];

/**
 * Gibt die UID des Support-Users für die aktuelle Umgebung zurück.
 *
 * @returns UID des Support-Users (DEV/TEST/PROD).
 */
export const getSupportUserUid = () => {
  switch (Utils.getEnvironment()) {
    case Environment.development:
      return "uQRD5ZpXkhT0sRo8VSLknNuyVkJ3";
    case Environment.test:
      return "xCehsNho63VgoAKKmpVeQzAHRAA2";
    case Environment.production:
      return "yuvhzHC3aGMpw0JYlMxUv8T2USl2";
  }
};

export enum TextFieldSize {
  small = "small",
  medium = "medium",
}
