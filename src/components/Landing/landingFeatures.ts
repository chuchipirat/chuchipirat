import type {ComponentType} from "react";
import type {SvgIconComponent} from "@mui/icons-material";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TuneIcon from "@mui/icons-material/Tune";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ScaleIcon from "@mui/icons-material/Scale";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Diversity3Icon from "@mui/icons-material/Diversity3";
import CloudOffIcon from "@mui/icons-material/CloudOff";

import {RecipeSearchAnimation} from "./animations/RecipeSearchAnimation";
import {ScalingAnimation} from "./animations/ScalingAnimation";
import {ShoppingListAnimation} from "./animations/ShoppingListAnimation";
import {MenuplanAnimation} from "./animations/MenuplanAnimation";
import {GroupConfigAnimation} from "./animations/GroupConfigAnimation";
import {CollaborationAnimation} from "./animations/CollaborationAnimation";
import {OfflineAnimation} from "./animations/OfflineAnimation";
import {
  LANDING_RECIPES_BLOCK_TITLE,
  LANDING_RECIPES_BLOCK_TEXT,
  LANDING_GROUP_CONFIG_TITLE,
  LANDING_GROUP_CONFIG_TEXT,
  LANDING_MENUPLAN_TITLE,
  LANDING_MENUPLAN_TEXT,
  LANDING_SCALING_TITLE,
  LANDING_SCALING_TEXT,
  LANDING_SHOPPINGLIST_TITLE,
  LANDING_SHOPPINGLIST_TEXT,
  LANDING_SOCIAL_TITLE,
  LANDING_SOCIAL_TEXT,
  LANDING_OFFLINE_TITLE,
  LANDING_OFFLINE_TEXT,
} from "../../constants/text";

/**
 * Beschreibt ein einzelnes Feature auf der Landing-Page.
 *
 * @param id - Eindeutiger Bezeichner des Features.
 * @param icon - MUI-Icon-Komponente für das Feature.
 * @param title - Überschrift (aus text.ts).
 * @param description - Beschreibungstext (aus text.ts).
 * @param imagePath - Optionaler Pfad zum Screenshot-Bild (relativ zu /public).
 * @param animationComponent - Optionale React-Komponente für eine interaktive Animation (ersetzt imagePath).
 * @param slideDirection - Richtung der Einblend-Animation ("left" oder "right").
 */
export type LandingFeature = {
  id: string;
  icon: SvgIconComponent;
  title: string;
  description: string;
  imagePath?: string;
  animationComponent?: ComponentType<{isActive: boolean}>;
  slideDirection: "left" | "right";
};

/**
 * Alle Features der Landing-Page als datengetriebenes Array.
 * Die Reihenfolge bestimmt die Darstellungsreihenfolge auf der Seite.
 */
export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "recipes",
    icon: MenuBookIcon,
    title: LANDING_RECIPES_BLOCK_TITLE,
    description: LANDING_RECIPES_BLOCK_TEXT,
    animationComponent: RecipeSearchAnimation,
    slideDirection: "left",
  },
  {
    id: "groupconfig",
    icon: TuneIcon,
    title: LANDING_GROUP_CONFIG_TITLE,
    description: LANDING_GROUP_CONFIG_TEXT,
    animationComponent: GroupConfigAnimation,
    slideDirection: "right",
  },
{
    id: "menuplan",
    icon: CalendarMonthIcon,
    title: LANDING_MENUPLAN_TITLE,
    description: LANDING_MENUPLAN_TEXT,
    animationComponent: MenuplanAnimation,
    slideDirection: "right",
  },
  {
    id: "scaling",
    icon: ScaleIcon,
    title: LANDING_SCALING_TITLE,
    description: LANDING_SCALING_TEXT,
    animationComponent: ScalingAnimation,
    slideDirection: "left",
  },
  {
    id: "shoppinglist",
    icon: ShoppingCartIcon,
    title: LANDING_SHOPPINGLIST_TITLE,
    description: LANDING_SHOPPINGLIST_TEXT,
    animationComponent: ShoppingListAnimation,
    slideDirection: "right",
  },
  {
    id: "social",
    icon: Diversity3Icon,
    title: LANDING_SOCIAL_TITLE,
    description: LANDING_SOCIAL_TEXT,
    animationComponent: CollaborationAnimation,
    slideDirection: "left",
  },
  {
    id: "offline",
    icon: CloudOffIcon,
    title: LANDING_OFFLINE_TITLE,
    description: LANDING_OFFLINE_TEXT,
    animationComponent: OfflineAnimation,
    slideDirection: "right",
  },
];
