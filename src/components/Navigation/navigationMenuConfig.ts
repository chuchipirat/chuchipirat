import React from "react";
import type {SvgIconProps} from "@mui/material/SvgIcon";
import HomeIcon from "@mui/icons-material/Home";
import FastfoodIcon from "@mui/icons-material/Fastfood";
import EventIcon from "@mui/icons-material/Event";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import DescriptionIcon from "@mui/icons-material/Description";
import LoyaltyIcon from "@mui/icons-material/Loyalty";
import BuildIcon from "@mui/icons-material/Build";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import StraightenIcon from "@mui/icons-material/Straighten";
import SettingsIcon from "@mui/icons-material/Settings";

import * as ROUTES from "../../constants/routes";
import * as TEXT from "../../constants/text";
import {Role} from "../../constants/roles";
import {DonateIcon} from "../Shared/icons";
import AuthUser from "../Firebase/Authentication/authUser.class";

/**
 * Konfiguration eines einzelnen Navigations-Menüeintrags.
 *
 * @param key - Eindeutiger Schlüssel für React.
 * @param label - Anzeigetext des Menüeintrags.
 * @param icon - MUI-Icon-Komponente.
 * @param route - Zielpfad für die Navigation.
 * @param guard - Optionale Zugriffsprüfung basierend auf Benutzerrollen.
 * @param dividerBefore - Ob ein Trennstrich vor diesem Eintrag angezeigt wird.
 */
export type NavigationMenuItem = {
  key: string;
  label: string;
  icon: React.ComponentType<SvgIconProps>;
  route: string;
  guard?: (authUser: AuthUser) => boolean;
  dividerBefore?: boolean;
};

/**
 * Prüft, ob der Benutzer die Rolle «Community Leader» besitzt.
 *
 * @param authUser - Der aktuell angemeldete Benutzer.
 * @returns `true`, wenn der Benutzer Community Leader ist.
 */
const isCommunityLeader = (authUser: AuthUser): boolean =>
  authUser.roles?.includes(Role.communityLeader) ?? false;

/**
 * Prüft, ob der Benutzer die Rolle «Admin» besitzt.
 *
 * @param authUser - Der aktuell angemeldete Benutzer.
 * @returns `true`, wenn der Benutzer Admin ist.
 */
const _isAdmin = (authUser: AuthUser): boolean =>
  authUser.roles?.includes(Role.admin) ?? false;

/**
 * Daten-getriebene Menükonfiguration für die Hauptnavigation.
 *
 * Jeder Eintrag definiert Schlüssel, Label, Icon, Route und
 * optionale Rollen-Guards. `dividerBefore` steuert die visuelle
 * Trennung zwischen Menügruppen.
 */
export const navigationMenuItems: NavigationMenuItem[] = [
  // --- Basis-Navigation ---
  {
    key: "home",
    label: TEXT.HOME_DASHBOARD,
    icon: HomeIcon,
    route: ROUTES.HOME,
    dividerBefore: true,
  },
  {
    key: "recipes",
    label: TEXT.RECIPES,
    icon: FastfoodIcon,
    route: ROUTES.RECIPES,
    dividerBefore: true,
  },
  {
    key: "events",
    label: TEXT.EVENTS,
    icon: EventIcon,
    route: ROUTES.EVENTS,
  },
  {
    key: "unitConversion",
    label: TEXT.NAVIGATION_UNIT_CONVERSION,
    icon: SwapHorizIcon,
    route: ROUTES.UNITCONVERSION,
    dividerBefore: true,
  },
  {
    key: "requestOverview",
    label: TEXT.NAVIGATION_REQUEST_OVERVIEW,
    icon: DescriptionIcon,
    route: ROUTES.REQUEST_OVERVIEW,
    dividerBefore: true,
  },
  {
    key: "donate",
    label: TEXT.DONATE,
    icon: DonateIcon,
    route: ROUTES.DONATE,
    dividerBefore: true,
  },
  // --- Community Leader ---
  {
    key: "products",
    label: TEXT.NAVIGATION_PRODUCTS,
    icon: LoyaltyIcon,
    route: ROUTES.PRODUCTS,
    guard: isCommunityLeader,
    dividerBefore: true,
  },
  {
    key: "materials",
    label: TEXT.MATERIALS,
    icon: BuildIcon,
    route: ROUTES.MATERIALS,
    guard: isCommunityLeader,
  },
  {
    key: "departments",
    label: TEXT.NAVIGATION_DEPARTMENTS,
    icon: ShoppingCartIcon,
    route: ROUTES.DEPARTMENTS,
    guard: isCommunityLeader,
  },
  {
    key: "units",
    label: TEXT.NAVIGATION_UNITS,
    icon: StraightenIcon,
    route: ROUTES.UNITS,
    guard: isCommunityLeader,
  },
  {
    key: "system",
    label: TEXT.NAVIGATION_SYSTEM,
    icon: SettingsIcon,
    route: ROUTES.SYSTEM,
    guard: isCommunityLeader,
    dividerBefore: true,
  },
];
