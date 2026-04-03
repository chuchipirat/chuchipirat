/**
 * DonationGoalsPage — Admin-Seite zur Verwaltung der Spendenziel-Abschnitte.
 *
 * Ermöglicht das Anlegen, Bearbeiten und Löschen von Spendenziel-Abschnitten
 * für das Jahres-Widget auf der Spendenseite. Jeder Abschnitt hat eine
 * Bezeichnung, einen Zielbetrag, eine Reihenfolge und ein Jahr.
 */
import React, {useCallback, useEffect, useReducer, SyntheticEvent} from "react";

import {
  Backdrop,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardActions,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  TextField,
  Typography,
  SnackbarCloseReason,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import * as Sentry from "@sentry/react";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useCustomStyles} from "../../../constants/styles";
import {useAuthUser} from "../../Session/authUserContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {DonationGoalSection} from "../../Donate/donation.types";

import {
  DONATION_GOALS_ADMIN as TEXT_TITLE,
  DONATION_GOAL_LABEL as TEXT_LABEL,
  DONATION_GOAL_TARGET as TEXT_TARGET,
  DONATION_GOAL_SORT_ORDER as TEXT_SORT_ORDER,
  DONATION_GOAL_YEAR as TEXT_YEAR,
  DONATION_GOAL_ADD as TEXT_ADD,
  DONATION_GOAL_DELETE_CONFIRM as TEXT_DELETE_CONFIRM,
  DONATION_GOAL_SAVED as TEXT_SAVED,
  DONATION_GOAL_DELETED as TEXT_DELETED,
  SAVE as TEXT_SAVE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
} from "../../../constants/text";

/* ===================================================================
// Reducer
// =================================================================== */
enum ActionType {
  FETCH_INIT,
  FETCH_SUCCESS,
  UPDATE_SECTION,
  ADD_SECTION,
  REMOVE_SECTION,
  SAVE_SUCCESS,
  DELETE_SUCCESS,
  CLOSE_SNACKBAR,
  ERROR,
}

type Action =
  | {type: ActionType.FETCH_INIT}
  | {type: ActionType.FETCH_SUCCESS; payload: DonationGoalSection[]}
  | {type: ActionType.UPDATE_SECTION; payload: {index: number; field: keyof DonationGoalSection; value: string | number}}
  | {type: ActionType.ADD_SECTION}
  | {type: ActionType.REMOVE_SECTION; payload: number}
  | {type: ActionType.SAVE_SUCCESS; payload: {message: string; sections: DonationGoalSection[]}}
  | {type: ActionType.DELETE_SUCCESS; payload: {index: number}}
  | {type: ActionType.CLOSE_SNACKBAR}
  | {type: ActionType.ERROR; payload: Error};

type State = {
  sections: DonationGoalSection[];
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  snackbar: SnackbarState;
};

const initialState: State = {
  sections: [],
  isLoading: true,
  isSaving: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case ActionType.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ActionType.FETCH_SUCCESS:
      return {...state, isLoading: false, sections: action.payload};
    case ActionType.UPDATE_SECTION: {
      const updated = [...state.sections];
      updated[action.payload.index] = {
        ...updated[action.payload.index],
        [action.payload.field]: action.payload.value,
      };
      return {...state, sections: updated};
    }
    case ActionType.ADD_SECTION:
      return {
        ...state,
        sections: [
          ...state.sections,
          {
            id: "",
            label: "",
            targetCents: 10000,
            sortOrder: state.sections.length + 1,
            year: new Date().getFullYear(),
            details: "",
          },
        ],
      };
    case ActionType.REMOVE_SECTION: {
      const filtered = state.sections.filter((_, index) => index !== action.payload);
      return {...state, sections: filtered};
    }
    case ActionType.SAVE_SUCCESS:
      return {
        ...state,
        isSaving: false,
        sections: action.payload.sections,
        snackbar: {open: true, severity: "success", message: action.payload.message},
      };
    case ActionType.DELETE_SUCCESS: {
      const remaining = state.sections.filter((_, index) => index !== action.payload.index);
      return {
        ...state,
        isSaving: false,
        sections: remaining,
        snackbar: {open: true, severity: "success", message: TEXT_DELETED},
      };
    }
    case ActionType.CLOSE_SNACKBAR:
      return {...state, snackbar: {...state.snackbar, open: false}};
    case ActionType.ERROR:
      return {
        ...state,
        isLoading: false,
        isSaving: false,
        error: action.payload,
      };
    default:
      return state;
  }
};

/* ===================================================================
// Seite
// =================================================================== */

/**
 * Admin-Seite zur Verwaltung der Spendenziel-Abschnitte.
 */
const DonationGoalsPage = () => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = useReducer(reducer, initialState);

  /** Daten laden. */
  const loadSections = useCallback(async () => {
    dispatch({type: ActionType.FETCH_INIT});
    try {
      const sections = await database.donations.getGoalSections();
      dispatch({type: ActionType.FETCH_SUCCESS, payload: sections});
    } catch (error) {
      const loadError = error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(loadError);
      dispatch({type: ActionType.ERROR, payload: loadError});
    }
  }, [database]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  /** Einzelnen Abschnitt speichern (Insert oder Update). */
  const handleSave = useCallback(
    async (index: number) => {
      const section = state.sections[index];
      if (!section.label.trim() || section.targetCents <= 0) return;

      try {
        if (section.id) {
          // Bestehenden Abschnitt aktualisieren
          await database.donations.updateGoalSection(section);
          dispatch({
            type: ActionType.SAVE_SUCCESS,
            payload: {message: TEXT_SAVED, sections: state.sections},
          });
        } else {
          // Neuen Abschnitt erstellen
          const created = await database.donations.createGoalSection({
            label: section.label,
            targetCents: section.targetCents,
            sortOrder: section.sortOrder,
            year: section.year,
            details: section.details,
          });
          const updatedSections = [...state.sections];
          updatedSections[index] = created;
          dispatch({
            type: ActionType.SAVE_SUCCESS,
            payload: {message: TEXT_SAVED, sections: updatedSections},
          });
        }
      } catch (error) {
        const saveError = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(saveError);
        dispatch({type: ActionType.ERROR, payload: saveError});
      }
    },
    [database, state.sections],
  );

  /** Abschnitt löschen (mit Bestätigungsdialog). */
  const handleDelete = useCallback(
    async (index: number) => {
      const section = state.sections[index];

      // Neuer, noch nicht gespeicherter Abschnitt — einfach entfernen
      if (!section.id) {
        dispatch({type: ActionType.REMOVE_SECTION, payload: index});
        return;
      }

      const confirmed = await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_DELETE_CONFIRM,
        text: `«${section.label}» (${section.year})`,
      });

      if (!confirmed) return;

      try {
        await database.donations.deleteGoalSection(section.id);
        dispatch({type: ActionType.DELETE_SUCCESS, payload: {index}});
      } catch (error) {
        const deleteError = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(deleteError);
        dispatch({type: ActionType.ERROR, payload: deleteError});
      }
    },
    [database, state.sections, customDialog],
  );

  /** Feld eines Abschnitts ändern. */
  const handleFieldChange = useCallback(
    (index: number, field: keyof DonationGoalSection, value: string | number) => {
      dispatch({type: ActionType.UPDATE_SECTION, payload: {index, field, value}});
    },
    [],
  );

  /** Snackbar schliessen. */
  const handleCloseSnackbar = useCallback(
    (_event: SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
      if (reason === "clickaway") return;
      dispatch({type: ActionType.CLOSE_SNACKBAR});
    },
    [],
  );

  if (!authUser) return null;

  return (
    <>
      <PageTitle title={TEXT_TITLE} breadcrumbs={[SYSTEM_BREADCRUMB]} />
      <Container sx={classes.container} component="main" maxWidth="md">
        {state.isLoading && (
          <Backdrop sx={classes.backdrop} open>
            <CircularProgress color="inherit" />
          </Backdrop>
        )}

        {state.error && (
          <AlertMessage error={state.error} messageTitle={TEXT_ALERT_TITLE_UUPS} />
        )}

        {!state.isLoading && (
          <Stack spacing={2}>
            {state.sections.map((section, index) => (
              <Card key={section.id || `new-${index}`} sx={classes.card}>
                <CardHeader
                  title={section.label || "Neuer Abschnitt"}
                  subheader={section.id ? `ID: ${section.id}` : "Noch nicht gespeichert"}
                  action={
                    <IconButton
                      onClick={() => handleDelete(index)}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid size={{xs: 12, sm: 6}}>
                      <TextField
                        label={TEXT_LABEL}
                        value={section.label}
                        onChange={(event) =>
                          handleFieldChange(index, "label", event.target.value)
                        }
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid size={{xs: 12, sm: 6}}>
                      <TextField
                        label={TEXT_TARGET}
                        value={(section.targetCents / 100).toFixed(2)}
                        onChange={(event) => {
                          const cents = Math.round(
                            parseFloat(event.target.value || "0") * 100,
                          );
                          handleFieldChange(index, "targetCents", cents);
                        }}
                        type="number"
                        slotProps={{htmlInput: {min: 0.01, step: 0.01}}}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid size={{xs: 6, sm: 3}}>
                      <TextField
                        label={TEXT_SORT_ORDER}
                        value={section.sortOrder}
                        onChange={(event) =>
                          handleFieldChange(
                            index,
                            "sortOrder",
                            parseInt(event.target.value || "0", 10),
                          )
                        }
                        type="number"
                        slotProps={{htmlInput: {min: 0}}}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid size={{xs: 6, sm: 3}}>
                      <TextField
                        label={TEXT_YEAR}
                        value={section.year}
                        onChange={(event) =>
                          handleFieldChange(
                            index,
                            "year",
                            parseInt(event.target.value || "2026", 10),
                          )
                        }
                        type="number"
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid size={{xs: 12}}>
                      <TextField
                        label="Details"
                        value={section.details}
                        onChange={(event) =>
                          handleFieldChange(index, "details", event.target.value)
                        }
                        fullWidth
                        size="small"
                        placeholder="z.B. Server, Domain, E-Mail Service usw."
                      />
                    </Grid>
                  </Grid>
                </CardContent>
                <CardActions sx={{justifyContent: "flex-end", px: 2, pb: 2}}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => handleSave(index)}
                    disabled={!section.label.trim() || section.targetCents <= 0}
                  >
                    {TEXT_SAVE}
                  </Button>
                </CardActions>
              </Card>
            ))}

            {/* Neuen Abschnitt hinzufügen */}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => dispatch({type: ActionType.ADD_SECTION})}
              fullWidth
            >
              {TEXT_ADD}
            </Button>

            {state.sections.length === 0 && (
              <Typography color="text.secondary" align="center">
                Keine Spendenziel-Abschnitte vorhanden.
              </Typography>
            )}
          </Stack>
        )}
      </Container>

      <CustomSnackbar
        snackbarOpen={state.snackbar.open}
        severity={state.snackbar.severity}
        message={state.snackbar.message}
        handleClose={handleCloseSnackbar}
      />
    </>
  );
};

export {DonationGoalsPage};
export default DonationGoalsPage;
