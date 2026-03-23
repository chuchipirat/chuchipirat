import * as ROUTES from "../../constants/routes";
import {HELPCENTER_URL} from "../../constants/defaultValues";
import {Action} from "../../constants/actions";
import {NavigationObject} from "./NavigationContext";

/**
 * Parameter für {@link getMatchingHelpPage}.
 *
 * @param actualPath - Der aktuelle URL-Pfad der Anwendung.
 * @param navigationObject - Optionales Navigations-Objekt (z.B. Menüplan, Einkaufsliste).
 * @param action - Optionale Aktion (z.B. VIEW, EDIT, NEW).
 */
type GetMatchingHelpPageParams = {
  actualPath: string;
  navigationObject?: NavigationObject;
  action?: Action;
};

/**
 * Ermittelt die passende Helpcenter-URL basierend auf dem aktuellen
 * Anwendungspfad, dem Navigations-Objekt und der Aktion.
 *
 * @param params - Siehe {@link GetMatchingHelpPageParams}.
 * @returns Vollständige URL zur passenden Helpcenter-Seite.
 *
 * @example
 * getMatchingHelpPage({actualPath: "/home"})
 * // => "https://help.chuchipirat.ch/docs/home/home"
 *
 * getMatchingHelpPage({actualPath: "/event/abc", navigationObject: NavigationObject.menueplan})
 * // => "https://help.chuchipirat.ch/docs/event/menueplan"
 */
export const getMatchingHelpPage = ({
  actualPath,
  navigationObject,
  action,
}: GetMatchingHelpPageParams): string => {
  const path = actualPath.split("/");
  let subdirectory = "";
  let page = "";

  switch (`/${path[1]}`) {
    case ROUTES.HOME:
      subdirectory = "home";
      page = "home";
      break;
    case ROUTES.RECIPE:
      subdirectory = "recipe";
      if (action === Action.VIEW) {
        page = "structure";
      } else if (action === Action.EDIT) {
        page = "create_edit";
      } else {
        page = "recipe";
      }
      break;
    case ROUTES.RECIPES:
      subdirectory = "recipe";
      page = "overview";
      break;
    case ROUTES.EVENT:
      subdirectory = "event";
      switch (navigationObject) {
        case NavigationObject.menueplan:
          page = "menueplan";
          break;
        case NavigationObject.groupConfiguration:
          page = "groupconfiguration";
          break;
        case NavigationObject.usedRecipes:
          page = "used_recipes";
          break;
        case NavigationObject.shoppingList:
          page = "shoppinglist";
          break;
        case NavigationObject.materialList:
          page = "materiallist";
          break;
        case NavigationObject.eventSettings:
          page = "settings";
          break;
        default:
          if (action === Action.NEW) {
            page = "create";
          } else {
            page = "event";
          }
      }
      break;
    case ROUTES.PRODUCTS:
      subdirectory = "masterdata";
      page = "products";
      break;
    case ROUTES.MATERIALS:
      subdirectory = "masterdata";
      page = "materials";
      break;
    case ROUTES.REQUEST_OVERVIEW:
      subdirectory = "request";
      page = "requests";
      break;
    case ROUTES.UNITS:
      subdirectory = "masterdata";
      page = "units";
      break;
    case ROUTES.UNITCONVERSION:
      subdirectory = "masterdata";
      page = "unitconversion";
      break;
    case ROUTES.DEPARTMENTS:
      subdirectory = "masterdata";
      page = "departments";
      break;
    case ROUTES.USER_PROFILE:
      subdirectory = "user";
      page = "profile";
      break;
    case ROUTES.PASSWORD_CHANGE:
      subdirectory = "user";
      page = "profile";
      break;
    case ROUTES.SYSTEM:
      subdirectory = "admin";
      if (path.length > 2) {
        switch (actualPath) {
          case ROUTES.SYSTEM_WHERE_USED:
            page = "where_used";
            break;
          case ROUTES.SYSTEM_ACTIVATE_SUPPORT_USER:
            page = "activate_support_user";
            break;
          case ROUTES.SYSTEM_OVERVIEW_MAILBOX:
            page = "mailbox_overview";
            break;
          case ROUTES.SYSTEM_OVERVIEW_EVENTS:
            page = "event_overview";
            break;
          case ROUTES.SYSTEM_OVERVIEW_RECIPES:
            page = "recipe_overview";
            break;
          case ROUTES.SYSTEM_OVERVIEW_FEEDS:
            page = "feeds_overview";
            break;
          case ROUTES.SYSTEM_MAIL_CONSOLE:
            page = "mailconsole";
            break;
          case ROUTES.SYSTEM_MERGE_ITEM:
            page = "merge_items";
            break;
          case ROUTES.SYSTEM_CONVERT_ITEM:
            page = "convert_items";
            break;
          case ROUTES.SYSTEM_SYSTEM_MESSAGES:
            page = "system_message";
            break;
          default:
            page = "system";
        }
      } else {
        page = "system";
      }
      break;
    case ROUTES.SYSTEM_OVERVIEW_USERS:
      subdirectory = "admin";
      page = "users";
      break;
    default:
      subdirectory = "";
  }

  if (subdirectory === "" && page === "") {
    return `${HELPCENTER_URL}`;
  }
  return `${HELPCENTER_URL}/docs/${subdirectory}/${page}`;
};
