/**
 * MealTypeCutoffTimesPage — Admin-Seite zur Verwaltung der
 * Mahlzeit-Typ-Cutoff-Zeiten.
 *
 * Mahlzeit-Typ-Namen (z.B. "Zmorge") sind komplett freier Text pro Event.
 * Diese Seite pflegt eine globale Liste, die festlegt, ab welcher Uhrzeit
 * eine Mahlzeit dieses Namens im "Läuft gerade"-Widget der Startseite nicht
 * mehr als anstehend angezeigt wird.
 */
import React, {
  useCallback,
  useEffect,
  useReducer,
  useState,
  SyntheticEvent,
} from "react";

import {
  Autocomplete,
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
import {Add as AddIcon, Delete as DeleteIcon} from "@mui/icons-material";
import * as Sentry from "@sentry/react";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useCustomStyles} from "../../../constants/styles";
import {useAuthUser} from "../../Session/authUserContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {MealTypeCutoffDomain} from "../../Database/Repository/MenuplanRepository";

import {
  MEAL_TYPE_CUTOFF_TIMES_ADMIN as TEXT_TITLE,
  MEAL_TYPE_CUTOFF_NAME as TEXT_NAME,
  MEAL_TYPE_CUTOFF_TIME as TEXT_CUTOFF_TIME,
  MEAL_TYPE_CUTOFF_SORT_ORDER as TEXT_SORT_ORDER,
  MEAL_TYPE_CUTOFF_ADD as TEXT_ADD,
  MEAL_TYPE_CUTOFF_DELETE_CONFIRM as TEXT_DELETE_CONFIRM,
  MEAL_TYPE_CUTOFF_SAVED as TEXT_SAVED,
  MEAL_TYPE_CUTOFF_DELETED as TEXT_DELETED,
  MEAL_TYPE_CUTOFF_EMPTY as TEXT_EMPTY,
  MEAL_TYPE_CUTOFF_INVALID_TIME_FORMAT as TEXT_INVALID_TIME_FORMAT,
  SAVE as TEXT_SAVE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
} from "../../../constants/text";

/** Prüft, ob eine Zeitangabe dem Format "HH:MM" (24h) entspricht. */
const CUTOFF_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/* ===================================================================
// Reducer
// =================================================================== */
enum ActionType {
  FETCH_INIT,
  FETCH_SUCCESS,
  UPDATE_CUTOFF,
  ADD_CUTOFF,
  REMOVE_CUTOFF,
  SAVE_SUCCESS,
  DELETE_SUCCESS,
  CLOSE_SNACKBAR,
  ERROR,
}

type Action =
  | {type: ActionType.FETCH_INIT}
  | {type: ActionType.FETCH_SUCCESS; payload: MealTypeCutoffDomain[]}
  | {
      type: ActionType.UPDATE_CUTOFF;
      payload: {
        index: number;
        field: keyof MealTypeCutoffDomain;
        value: string | number | string[];
      };
    }
  | {type: ActionType.ADD_CUTOFF}
  | {type: ActionType.REMOVE_CUTOFF; payload: number}
  | {
      type: ActionType.SAVE_SUCCESS;
      payload: {message: string; cutoffs: MealTypeCutoffDomain[]};
    }
  | {type: ActionType.DELETE_SUCCESS; payload: {index: number}}
  | {type: ActionType.CLOSE_SNACKBAR}
  | {type: ActionType.ERROR; payload: Error};

type State = {
  cutoffs: MealTypeCutoffDomain[];
  isLoading: boolean;
  error: Error | null;
  snackbar: SnackbarState;
};

const initialState: State = {
  cutoffs: [],
  isLoading: true,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case ActionType.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ActionType.FETCH_SUCCESS:
      return {...state, isLoading: false, cutoffs: action.payload};
    case ActionType.UPDATE_CUTOFF: {
      const updated = [...state.cutoffs];
      updated[action.payload.index] = {
        ...updated[action.payload.index],
        [action.payload.field]: action.payload.value,
      };
      return {...state, cutoffs: updated};
    }
    case ActionType.ADD_CUTOFF:
      return {
        ...state,
        cutoffs: [
          ...state.cutoffs,
          {
            id: "",
            names: [],
            cutoffTime: "10:00",
            sortOrder: state.cutoffs.length + 1,
          },
        ],
      };
    case ActionType.REMOVE_CUTOFF: {
      const filtered = state.cutoffs.filter(
        (_, index) => index !== action.payload,
      );
      return {...state, cutoffs: filtered};
    }
    case ActionType.SAVE_SUCCESS:
      return {
        ...state,
        cutoffs: action.payload.cutoffs,
        snackbar: {
          open: true,
          severity: "success",
          message: action.payload.message,
        },
      };
    case ActionType.DELETE_SUCCESS: {
      const remaining = state.cutoffs.filter(
        (_, index) => index !== action.payload.index,
      );
      return {
        ...state,
        cutoffs: remaining,
        snackbar: {open: true, severity: "success", message: TEXT_DELETED},
      };
    }
    case ActionType.CLOSE_SNACKBAR:
      return {...state, snackbar: {...state.snackbar, open: false}};
    case ActionType.ERROR:
      return {...state, isLoading: false, error: action.payload};
    default:
      return state;
  }
};

/* ===================================================================
// Seite
// =================================================================== */

/**
 * Admin-Seite zur Verwaltung der Mahlzeit-Typ-Cutoff-Zeiten.
 */
const MealTypeCutoffTimesPage = () => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = useReducer(reducer, initialState);
  // Nicht committierter Freitext je Zeile — Enter committet bereits nativ
  // (MUI freeSolo), aber Leertaste und Verlassen des Feldes tun das nicht
  // von Haus aus. Wird lokal gehalten, da es reiner UI-Zwischenzustand ist.
  const [pendingNameInputs, setPendingNameInputs] = useState<
    Record<number, string>
  >({});

  /** Daten laden. */
  const loadCutoffs = useCallback(async () => {
    dispatch({type: ActionType.FETCH_INIT});
    try {
      const cutoffs = await database.menuplan.getCutoffTimes();
      dispatch({type: ActionType.FETCH_SUCCESS, payload: cutoffs});
    } catch (error) {
      const loadError =
        error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(loadError);
      dispatch({type: ActionType.ERROR, payload: loadError});
    }
  }, [database]);

  useEffect(() => {
    loadCutoffs();
  }, [loadCutoffs]);

  /** Einzelne Cutoff-Zeit speichern (Insert oder Update). */
  const handleSave = useCallback(
    async (index: number) => {
      const cutoff = state.cutoffs[index];
      if (
        cutoff.names.length === 0 ||
        !CUTOFF_TIME_PATTERN.test(cutoff.cutoffTime)
      ) {
        return;
      }

      try {
        if (cutoff.id) {
          await database.menuplan.updateCutoffTime(cutoff);
          dispatch({
            type: ActionType.SAVE_SUCCESS,
            payload: {message: TEXT_SAVED, cutoffs: state.cutoffs},
          });
        } else {
          const created = await database.menuplan.createCutoffTime({
            names: cutoff.names,
            cutoffTime: cutoff.cutoffTime,
            sortOrder: cutoff.sortOrder,
          });
          const updatedCutoffs = [...state.cutoffs];
          updatedCutoffs[index] = created;
          dispatch({
            type: ActionType.SAVE_SUCCESS,
            payload: {message: TEXT_SAVED, cutoffs: updatedCutoffs},
          });
        }
      } catch (error) {
        const saveError =
          error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(saveError);
        dispatch({type: ActionType.ERROR, payload: saveError});
      }
    },
    [database, state.cutoffs],
  );

  /** Cutoff-Zeit löschen (mit Bestätigungsdialog). */
  const handleDelete = useCallback(
    async (index: number) => {
      const cutoff = state.cutoffs[index];

      // Neue, noch nicht gespeicherte Zeile — einfach entfernen
      if (!cutoff.id) {
        dispatch({type: ActionType.REMOVE_CUTOFF, payload: index});
        // Nachfolgende Zeilen-Indizes verschieben sich — noch nicht
        // committierten Freitext verwerfen statt fehlerhaft neu zuzuordnen.
        setPendingNameInputs({});
        return;
      }

      const confirmed = await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_DELETE_CONFIRM,
        text: `«${cutoff.names.join(", ")}»`,
      });

      if (!confirmed) return;

      try {
        await database.menuplan.deleteCutoffTime(cutoff.id);
        dispatch({type: ActionType.DELETE_SUCCESS, payload: {index}});
        setPendingNameInputs({});
      } catch (error) {
        const deleteError =
          error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(deleteError);
        dispatch({type: ActionType.ERROR, payload: deleteError});
      }
    },
    [database, state.cutoffs, customDialog],
  );

  /** Feld einer Cutoff-Zeit ändern. */
  const handleFieldChange = useCallback(
    (
      index: number,
      field: keyof MealTypeCutoffDomain,
      value: string | number | string[],
    ) => {
      dispatch({type: ActionType.UPDATE_CUTOFF, payload: {index, field, value}});
    },
    [],
  );

  /**
   * Übernimmt den noch nicht committierten Freitext einer Zeile als neuen
   * Namen (Chip). Wird bei Leertaste und beim Verlassen des Feldes
   * aufgerufen — Enter committet bereits nativ über die Autocomplete
   * (freeSolo).
   */
  const commitPendingName = useCallback(
    (index: number) => {
      const pending = (pendingNameInputs[index] ?? "").trim();
      setPendingNameInputs((previous) => ({...previous, [index]: ""}));
      if (!pending) return;

      const cutoff = state.cutoffs[index];
      if (cutoff.names.includes(pending)) return;

      handleFieldChange(index, "names", [...cutoff.names, pending]);
    },
    [pendingNameInputs, state.cutoffs, handleFieldChange],
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
            {state.cutoffs.map((cutoff, index) => {
              const isValidTime = CUTOFF_TIME_PATTERN.test(cutoff.cutoffTime);
              return (
                <Card key={cutoff.id || `new-${index}`} sx={classes.card}>
                  <CardHeader
                    title={cutoff.names.join(", ") || "Neue Cutoff-Zeit"}
                    subheader={cutoff.id ? `ID: ${cutoff.id}` : "Noch nicht gespeichert"}
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
                        <Autocomplete<string, true, false, true>
                          multiple
                          freeSolo
                          options={[]}
                          value={cutoff.names}
                          inputValue={pendingNameInputs[index] ?? ""}
                          onChange={(_event, newValue) =>
                            handleFieldChange(index, "names", newValue)
                          }
                          onInputChange={(_event, newInputValue) =>
                            setPendingNameInputs((previous) => ({
                              ...previous,
                              [index]: newInputValue,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === " ") {
                              event.preventDefault();
                              commitPendingName(index);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={TEXT_NAME}
                              size="small"
                              onBlur={() => commitPendingName(index)}
                            />
                          )}
                          size="small"
                        />
                      </Grid>
                      <Grid size={{xs: 12, sm: 3}}>
                        <TextField
                          label={TEXT_CUTOFF_TIME}
                          value={cutoff.cutoffTime}
                          onChange={(event) =>
                            handleFieldChange(
                              index,
                              "cutoffTime",
                              event.target.value,
                            )
                          }
                          error={cutoff.cutoffTime !== "" && !isValidTime}
                          helperText={
                            cutoff.cutoffTime !== "" && !isValidTime
                              ? TEXT_INVALID_TIME_FORMAT
                              : undefined
                          }
                          fullWidth
                          size="small"
                        />
                      </Grid>
                      <Grid size={{xs: 12, sm: 3}}>
                        <TextField
                          label={TEXT_SORT_ORDER}
                          value={cutoff.sortOrder}
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
                    </Grid>
                  </CardContent>
                  <CardActions sx={{justifyContent: "flex-end", px: 2, pb: 2}}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSave(index)}
                      disabled={cutoff.names.length === 0 || !isValidTime}
                    >
                      {TEXT_SAVE}
                    </Button>
                  </CardActions>
                </Card>
              );
            })}

            {/* Neue Cutoff-Zeit hinzufügen */}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => dispatch({type: ActionType.ADD_CUTOFF})}
              fullWidth
            >
              {TEXT_ADD}
            </Button>

            {state.cutoffs.length === 0 && (
              <Typography color="text.secondary" align="center">
                {TEXT_EMPTY}
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

export {MealTypeCutoffTimesPage};
