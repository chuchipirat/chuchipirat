import React from "react";
import {useNavigate, useLocation} from "react-router";

import {
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  useTheme,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import {DataGrid, GridColDef, GridSortModel} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import isEqual from "lodash/isEqual";

import PageTitle from "../../Shared/pageTitle";
import AlertMessage from "../../Shared/AlertMessage";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
} from "../../Shared/customSnackbar";

import {useDatabase} from "../../Database/DatabaseContext";
import {useAuthUser} from "../../Session/authUserContext";
import {SystemMessageDomain} from "../../Database/Repository/SystemMessageRepository";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";

import {
  SYSTEM_MESSAGES as TEXT_SYSTEM_MESSAGES,
  ATENTION_IMPORTANT_ANNOUNCEMENT as TEXT_ATENTION_IMPORTANT_ANNOUNCEMENT,
  NEW_SYSTEM_MESSAGE as TEXT_NEW_SYSTEM_MESSAGE,
  DELETE_SYSTEM_MESSAGE as TEXT_DELETE_SYSTEM_MESSAGE,
  DELETE_SYSTEM_MESSAGE_CONFIRMATION as TEXT_DELETE_SYSTEM_MESSAGE_CONFIRMATION,
  SHOW_EXPIRED_MESSAGES as TEXT_SHOW_EXPIRED_MESSAGES,
  SYSTEM_MESSAGE_DELETED as TEXT_SYSTEM_MESSAGE_DELETED,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  TITLE as TEXT_TITLE,
  TYPE as TEXT_TYPE,
  VALID_TO as TEXT_VALID_TO,
  EDIT as TEXT_EDIT,
  DELETE as TEXT_DELETE,
} from "../../../constants/text";
import * as ROUTES from "../../../constants/routes";
import useCustomStyles from "../../../constants/styles";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  MESSAGES_FETCH_INIT,
  MESSAGES_FETCH_SUCCESS,
  MESSAGE_DELETED,
  SNACKBAR_SET,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

type DispatchAction =
  | {type: ReducerActions.MESSAGES_FETCH_INIT}
  | {type: ReducerActions.MESSAGES_FETCH_SUCCESS; payload: SystemMessageDomain[]}
  | {type: ReducerActions.MESSAGE_DELETED; payload: string}
  | {type: ReducerActions.SNACKBAR_SET; payload: Snackbar}
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  messages: SystemMessageDomain[];
  isLoading: boolean;
  error: Error | null;
  snackbar: Snackbar;
};

const initialState: State = {
  messages: [],
  isLoading: false,
  error: null,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

const overviewReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.MESSAGES_FETCH_INIT:
      return {...state, isLoading: true};
    case ReducerActions.MESSAGES_FETCH_SUCCESS:
      return {...state, isLoading: false, messages: action.payload};
    case ReducerActions.MESSAGE_DELETED:
      return {
        ...state,
        messages: state.messages.filter((m) => m.uid !== action.payload),
      };
    case ReducerActions.SNACKBAR_SET:
      return {...state, snackbar: action.payload};
    case ReducerActions.SNACKBAR_CLOSE:
      return {...state, snackbar: SNACKBAR_INITIAL_STATE_VALUES};
    case ReducerActions.GENERIC_ERROR:
      return {...state, error: action.payload, isLoading: false};
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${exhaustiveCheck}`);
    }
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Übersichtsseite für Systemmeldungen.
 * Zeigt alle Meldungen in einem DataGrid an, mit Möglichkeit zum
 * Erstellen, Bearbeiten und Löschen.
 */
const SystemMessageOverviewPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(overviewReducer, initialState);
  const [showExpired, setShowExpired] = React.useState(false);
  const [sortModel, setSortModel] = React.useState<GridSortModel>([
    {field: "validTo", sort: "asc"},
  ]);

  // Snackbar aus der Navigation übernehmen (z.B. nach Erstellen/Bearbeiten)
  if (location.state?.snackbar && !state.snackbar.open) {
    dispatch({
      type: ReducerActions.SNACKBAR_SET,
      payload: location.state.snackbar,
    });
    // State einmalig konsumieren
    window.history.replaceState({}, document.title);
  }

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Daten laden
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.MESSAGES_FETCH_INIT});
    database.systemMessages
      .getMessages(showExpired)
      .then((result) => {
        dispatch({
          type: ReducerActions.MESSAGES_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, [showExpired]);

  /* ------------------------------------------
  // Aktionen
  // ------------------------------------------ */
  const onCreateNew = () => {
    navigate(ROUTES.SYSTEM_SYSTEM_MESSAGE_NEW);
  };

  const onEdit = (uid: string) => {
    navigate(ROUTES.SYSTEM_SYSTEM_MESSAGE_EDIT.replace(":id", uid));
  };

  const onDelete = async (uid: string) => {
    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      text: TEXT_DELETE_SYSTEM_MESSAGE_CONFIRMATION,
      title: TEXT_DELETE_SYSTEM_MESSAGE,
      buttonTextConfirm: TEXT_DELETE,
    });

    if (!isConfirmed) return;

    database.systemMessages
      .deleteMessage(uid)
      .then(() => {
        dispatch({type: ReducerActions.MESSAGE_DELETED, payload: uid});
        dispatch({
          type: ReducerActions.SNACKBAR_SET,
          payload: {
            open: true,
            severity: "success",
            message: TEXT_SYSTEM_MESSAGE_DELETED,
          },
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };

  /* ------------------------------------------
  // Snackbar
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };

  /* ------------------------------------------
  // DataGrid Spalten
  // ------------------------------------------ */
  const TYPE_COLORS: Record<string, "success" | "info" | "warning" | "error"> = {
    success: "success",
    info: "info",
    warning: "warning",
    error: "error",
  };

  const columns: GridColDef[] = [
    {
      field: "type",
      headerName: TEXT_TYPE,
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={TYPE_COLORS[params.value as string] ?? "default"}
          size="small"
        />
      ),
    },
    {
      field: "title",
      headerName: TEXT_TITLE,
      flex: 1,
      minWidth: 200,
    },
    {
      field: "validTo",
      headerName: TEXT_VALID_TO,
      width: 150,
      // MUI DataGrid v7 typisiert value als never — explizites any nötig
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (value: any) => {
        if (value && value instanceof Date) {
          return value.toLocaleString("de-CH", {dateStyle: "medium"});
        }
        return "";
      },
    },
    {
      field: "actions",
      headerName: "",
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton
            aria-label={TEXT_EDIT}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(params.row.uid);
            }}
            style={{marginRight: theme.spacing(0.5)}}
          >
            <EditIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            aria-label={TEXT_DELETE}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(params.row.uid);
            }}
          >
            <DeleteIcon fontSize="inherit" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_SYSTEM_MESSAGES}
        subTitle={TEXT_ATENTION_IMPORTANT_ANNOUNCEMENT}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="md">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {state.error && (
          <AlertMessage
            error={state.error}
            messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
          />
        )}

        <Card sx={classes.card} style={{marginBottom: "4em"}}>
          <CardContent>
            <Stack spacing={2}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={showExpired}
                      onChange={(e) => setShowExpired(e.target.checked)}
                    />
                  }
                  label={TEXT_SHOW_EXPIRED_MESSAGES}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={onCreateNew}
                >
                  {TEXT_NEW_SYSTEM_MESSAGE}
                </Button>
              </Stack>

              <Box component="div" style={{display: "flex", height: "100%"}}>
                <Box component="div" style={{flexGrow: 1}}>
                  <DataGrid
                    autoHeight
                    rows={state.messages}
                    columns={columns}
                    getRowId={(row) => row.uid}
                    localeText={
                      deDE.components.MuiDataGrid.defaultProps.localeText
                    }
                    sortModel={sortModel}
                    onSortModelChange={(model) => {
                      if (!isEqual(model, sortModel)) {
                        setSortModel(model);
                      }
                    }}
                    onRowClick={(params) => onEdit(params.row.uid)}
                    sx={{cursor: "pointer"}}
                  />
                </Box>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};

export default SystemMessageOverviewPage;
