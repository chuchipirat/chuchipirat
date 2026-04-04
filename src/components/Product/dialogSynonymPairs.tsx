/**
 * Dialog zur Verwaltung von Synonym-Paaren für die Duplikaterkennung.
 *
 * Zeigt alle bestehenden Synonym-Paare an und ermöglicht das
 * Hinzufügen und Löschen von Einträgen.
 */
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import {Delete as DeleteIcon, Add as AddIcon} from "@mui/icons-material";
import {ProductSynonymDomain} from "../Database/Repository/ProductSynonymRepository";
import {useDatabase} from "../Database/DatabaseContext";
import {useAuthUser} from "../Session/authUserContext";
import {
  SYNONYM_PAIRS,
  ADD_SYNONYM,
  SYNONYM_NAME_A,
  SYNONYM_NAME_B,
} from "../../constants/text/productQa";

/**
 * Props für den Synonym-Verwaltungsdialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param onClose - Callback zum Schliessen des Dialogs
 * @param synonymPairs - Aktuelle Liste der Synonym-Paare
 * @param onReload - Callback zum Neuladen der Synonym-Paare
 */
interface DialogSynonymPairsProps {
  open: boolean;
  onClose: () => void;
  synonymPairs: ProductSynonymDomain[];
  onReload: () => void;
}

/**
 * Dialog zur CRUD-Verwaltung von Synonym-Paaren.
 */
export const DialogSynonymPairs = ({
  open,
  onClose,
  synonymPairs,
  onReload,
}: DialogSynonymPairsProps) => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const [nameA, setNameA] = React.useState("");
  const [nameB, setNameB] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);

  const handleAdd = async () => {
    if (!nameA.trim() || !nameB.trim() || !authUser) return;

    setIsAdding(true);
    try {
      await database.productSynonyms.insertSynonym(
        {nameA: nameA.trim(), nameB: nameB.trim()},
        authUser,
      );
      setNameA("");
      setNameB("");
      onReload();
    } catch {
      // Fehlerbehandlung via Sentry im Repository
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (synonymId: string) => {
    try {
      await database.productSynonyms.deleteSynonym(synonymId);
      onReload();
    } catch {
      // Fehlerbehandlung via Sentry im Repository
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{SYNONYM_PAIRS}</DialogTitle>
      <DialogContent>
        {/* Neues Synonym-Paar hinzufügen */}
        <Box
          sx={{
            display: "flex",
            gap: 1,
            alignItems: "center",
            marginBottom: 2,
            marginTop: 1,
          }}
        >
          <TextField
            size="small"
            label={SYNONYM_NAME_A}
            value={nameA}
            onChange={(event) => setNameA(event.target.value)}
            sx={{flex: 1}}
          />
          <TextField
            size="small"
            label={SYNONYM_NAME_B}
            value={nameB}
            onChange={(event) => setNameB(event.target.value)}
            sx={{flex: 1}}
          />
          <IconButton
            color="primary"
            onClick={handleAdd}
            disabled={isAdding || !nameA.trim() || !nameB.trim()}
            title={ADD_SYNONYM}
          >
            <AddIcon />
          </IconButton>
        </Box>

        {/* Bestehende Paare */}
        {synonymPairs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Noch keine Synonym-Paare vorhanden.
          </Typography>
        ) : (
          <List dense>
            {synonymPairs.map((synonym) => (
              <ListItem key={synonym.uid}>
                <ListItemText
                  primary={`${synonym.nameA} ↔ ${synonym.nameB}`}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleDelete(synonym.uid)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Schliessen</Button>
      </DialogActions>
    </Dialog>
  );
};
