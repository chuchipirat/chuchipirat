import React, {useCallback} from "react";

import {
  Stack,
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
} from "@mui/material";
import {
  Fastfood as FastfoodIcon,
  ShoppingCart as ShoppingCartIcon,
  Restaurant as RestaurantIcon,
  Build as BuildIcon,
  SwapHoriz as SwapHorizIcon,
  Event as EventIcon,
  OpenInNew as OpenInNewIcon,
  AccountTree as AccountTreeIcon,
} from "@mui/icons-material";

import {FOUND_REFERENCE as TEXT_FOUND_REFERENCES} from "../../constants/text";
import {
  RECIPE as ROUTE_RECIPE,
  EVENT as ROUTE_EVENT,
  UNITCONVERSION as ROUTE_UNITCONVERSION,
} from "../../constants/routes";

import {useCustomStyles} from "../../constants/styles";
import {WhereUsedEntry} from "../Database/Repository/AdminOperationsRepository";

/**
 * Zuordnung von Tabellennamen zu menschenlesbaren Gruppentiteln und Icons.
 */
const TABLE_GROUP_CONFIG: Record<
  string,
  {label: string; icon: React.ReactElement}
> = {
  recipe_ingredients: {label: "Rezepte (Zutaten)", icon: <FastfoodIcon />},
  recipe_materials: {label: "Rezepte (Material)", icon: <BuildIcon />},
  event_shopping_list_items: {
    label: "Einkaufslisten",
    icon: <ShoppingCartIcon />,
  },
  event_material_list_items: {label: "Materiallisten", icon: <BuildIcon />},
  event_menue_products: {
    label: "Menüpläne (Produkte)",
    icon: <RestaurantIcon />,
  },
  event_menue_materials: {
    label: "Menüpläne (Material)",
    icon: <RestaurantIcon />,
  },
  event_menue_recipes: {label: "Menüpläne (Rezepte)", icon: <RestaurantIcon />},
  unit_conversion_products: {
    label: "Einheitenumrechnungen",
    icon: <SwapHorizIcon />,
  },
  recipe_variants: {label: "Varianten", icon: <AccountTreeIcon />},
  recipe_original: {label: "Original-Rezept", icon: <AccountTreeIcon />},
};

/**
 * Zuordnung von Tabellennamen auf den Query-Parameter für den Event-Tab-Deep-Link.
 * Einträge ohne Mapping landen auf dem Standard-Tab (Menüplan).
 */
const TAB_PARAM_BY_TABLE: Record<string, string> = {
  event_shopping_list_items: "shoppinglist",
  event_material_list_items: "materiallist",
};

/**
 * Gruppiert Einträge nach table_name.
 *
 * @param entries Flache Liste aller Fundstellen.
 * @returns Map: table_name → Einträge.
 */
const groupByTable = (
  entries: WhereUsedEntry[],
): Map<string, WhereUsedEntry[]> => {
  const groups = new Map<string, WhereUsedEntry[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.table_name) ?? [];
    existing.push(entry);
    groups.set(entry.table_name, existing);
  }
  return groups;
};

/**
 * Props für das Ergebnis-Panel.
 *
 * @param entries Gefundene Verwendungsstellen aus der Datenbank.
 */
type WhereUsedResultPanelProps = {
  entries: WhereUsedEntry[];
};

/**
 * Zeigt die Ergebnisse eines Verwendungsnachweises gruppiert nach Tabelle an.
 *
 * Jede Gruppe wird als eigene Card dargestellt. Die Einträge zeigen den
 * Namen des Rezepts/Events als Primärtext und die UID als Sekundärtext.
 * Klickbare Einträge öffnen das jeweilige Rezept oder Event in einem
 * neuen Tab, damit die aktuelle Ansicht (z.B. ein offener Dialog) erhalten bleibt.
 *
 * Wiederverwendet von der Where-Used-Seite (`whereUsed.tsx`) sowie von
 * Vorschau-Dialogen (z.B. vor dem Löschen oder Prüfen eines Produkts).
 */
export const WhereUsedResultPanel = ({entries}: WhereUsedResultPanelProps) => {
  const classes = useCustomStyles();

  /** Öffnet das übergeordnete Objekt (Rezept oder Event) in einem neuen Tab. */
  const handleNavigate = useCallback((entry: WhereUsedEntry) => {
    let path = "";
    if (entry.table_name === "unit_conversion_products") {
      path = `${ROUTE_UNITCONVERSION}?tab=product`;
    } else if (entry.parent_type === "recipe") {
      path = `${ROUTE_RECIPE}/${entry.parent_id}`;
    } else if (entry.parent_type === "event") {
      // Tab-Parameter für Deep-Link auf den passenden Event-Tab
      const tabParam = TAB_PARAM_BY_TABLE[entry.table_name] ?? "";
      const query = tabParam ? `?tab=${tabParam}` : "";
      // Bei Einkaufslisten zusätzlich die Listen-ID übergeben
      const listParam = entry.list_id ? `&listId=${entry.list_id}` : "";
      path = `${ROUTE_EVENT}/${entry.parent_id}${query}${listParam}`;
    }
    if (path) {
      window.open(path, "_blank", "noopener,noreferrer");
    }
  }, []);

  const grouped = groupByTable(entries);

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2">
        {`${TEXT_FOUND_REFERENCES}: ${entries.length}`}
      </Typography>

      {Array.from(grouped.entries()).map(([tableName, tableEntries]) => {
        const config = TABLE_GROUP_CONFIG[tableName] ?? {
          label: tableName,
          icon: <EventIcon />,
        };
        const isNavigable =
          tableEntries[0]?.parent_type === "recipe" ||
          tableEntries[0]?.parent_type === "event" ||
          tableName === "unit_conversion_products";

        return (
          <Card sx={classes.card} key={tableName}>
            <CardHeader
              avatar={config.icon}
              title={config.label}
              action={
                <Chip
                  label={tableEntries.length}
                  size="small"
                  color="primary"
                />
              }
            />
            <CardContent sx={{pt: 0}}>
              <List dense disablePadding>
                {tableEntries.map((entry, index) =>
                  isNavigable ? (
                    <ListItemButton
                      key={`${tableName}_${index}`}
                      divider={index < tableEntries.length - 1}
                      onClick={() => handleNavigate(entry)}
                    >
                      <ListItemText
                        primary={entry.context}
                        secondary={entry.parent_id}
                      />
                      <ListItemIcon sx={{minWidth: "auto"}}>
                        <OpenInNewIcon fontSize="small" color="action" />
                      </ListItemIcon>
                    </ListItemButton>
                  ) : (
                    <ListItem
                      key={`${tableName}_${index}`}
                      divider={index < tableEntries.length - 1}
                    >
                      <ListItemText
                        primary={entry.context}
                        secondary={entry.record_id}
                      />
                    </ListItem>
                  ),
                )}
              </List>
            </CardContent>
          </Card>
        );
      })}

      {entries.length === 0 && (
        <Card sx={classes.card}>
          <CardContent>
            <Typography color="textSecondary" align="center">
              Keine Verwendung gefunden.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};
