import {useCallback} from "react";
import {useNavigate} from "react-router";

import {Box, Divider, Drawer, List, ListItemButton} from "@mui/material";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";

import {
  navigationMenuItems,
  type NavigationMenuItem,
} from "./navigationMenuConfig";
import AuthUser from "../Firebase/Authentication/authUser.class";

/**
 * Props für die NavigationDrawer-Komponente.
 *
 * @param open - Ob der Drawer aktuell geöffnet ist.
 * @param onClose - Callback zum Schliessen des Drawers.
 * @param authUser - Der aktuell angemeldete Benutzer (für Rollen-Guards).
 */
type NavigationDrawerProps = {
  open: boolean;
  onClose: () => void;
  authUser: AuthUser;
};

/**
 * Seitliche Hauptnavigation der App.
 *
 * Filtert die Menüeinträge anhand der Benutzerrollen und rendert
 * sie als Liste mit Icons. Beim Klick wird zur jeweiligen Route
 * navigiert und der Drawer geschlossen.
 *
 * @param props - Siehe {@link NavigationDrawerProps}.
 * @returns MUI-Drawer mit rollenbasierter Menüliste.
 */
export const NavigationDrawer = ({
  open,
  onClose,
  authUser,
}: NavigationDrawerProps) => {
  const navigate = useNavigate();

  const handleItemClick = useCallback(
    (route: string) => {
      navigate(route);
      onClose();
    },
    [navigate, onClose]
  );

  // Menüeinträge nach Rollen-Guards filtern
  const visibleItems = navigationMenuItems.filter(
    (item) => !item.guard || item.guard(authUser)
  );

  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box role="presentation" aria-label="Hauptnavigation">
        {visibleItems.map((item: NavigationMenuItem, index: number) => (
          <div key={item.key}>
            {/* Trennstrich vor Gruppenwechsel (aber nicht ganz oben) */}
            {item.dividerBefore && index > 0 && <Divider />}
            <List disablePadding>
              <ListItemButton onClick={() => handleItemClick(item.route)}>
                <ListItemIcon>
                  <item.icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </List>
          </div>
        ))}
      </Box>
    </Drawer>
  );
};
