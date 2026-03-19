/**
 * Antrags-Übersicht — Hauptseite für die Verwaltung von Anträgen.
 *
 * Zeigt aktive und abgeschlossene Anträge in einer Tabelle an.
 * Community Leaders sehen alle Anträge, andere Benutzer nur eigene.
 * Unterstützt Suchen, Filtern (aktiv/alle) und Statusübergänge.
 */
import React from "react";
import {useNavigate, useParams} from "react-router";
import * as Sentry from "@sentry/browser";

import {
  Alert,
  Button,
  Container,
  Backdrop,
  CircularProgress,
  Stack,
  Card,
  CardContent,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from "@mui/material";

import {
  REQUESTS as TEXT_REQUESTS,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
  NUMBER as TEXT_NUMBER,
  REQUEST_STATUS as TEXT_REQUEST_STATUS,
  NAME as TEXT_NAME,
  REQUEST_CREATION_DATE as TEXT_REQUEST_CREATION_DATE,
  REQUEST_ASSIGNEE_DISPLAYNAME as TEXT_REQUEST_ASSIGNEE_DISPLAYNAME,
  REQUEST_AUTHOR_DISPLAYNAME as TEXT_REQUEST_AUTHOR_DISPLAYNAME,
  ACTIVE_REQUESTS as TEXT_ACTIVE_REQUESTS,
  ALL_REQUESTS as TEXT_ALL_REQUESTS,
  REQUEST_EMPTY_STATE as TEXT_REQUEST_EMPTY_STATE,
  REQUEST_EMPTY_STATE_LEADER as TEXT_REQUEST_EMPTY_STATE_LEADER,
  REQUEST_STATUS_CHANGED as TEXT_REQUEST_STATUS_CHANGED,
  REQUEST_COMMENT_ADDED as TEXT_REQUEST_COMMENT_ADDED,
  REQUEST_ASSIGNED_TO_ME as TEXT_REQUEST_ASSIGNED_TO_ME,
  REQUEST_SEARCH_ALSO_CLOSED as TEXT_REQUEST_SEARCH_ALSO_CLOSED,
} from "../../constants/text";

import {RECIPE as ROUTES_RECIPE} from "../../constants/routes";

import useCustomStyles from "../../constants/styles";

import PageTitle from "../Shared/pageTitle";

import {Request, RequestStatus, RequestType, RequestAction} from "./request.class";
import {RequestService} from "./requestService";
import {RequestDomain} from "../Database/Repository/RequestRepository";
import {RequestCommentDomain} from "../Database/Repository/RequestCommentRepository";

import CustomSnackbar, {Snackbar} from "../Shared/customSnackbar";
import AlertMessage from "../Shared/AlertMessage";
import EnhancedTable, {
  TableColumnTypes,
  ColumnTextAlign,
} from "../Shared/enhancedTable";

import DialogRequest from "./dialogRequest";
import SearchPanel from "../Shared/searchPanel";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/navigationContext";
import Action from "../../constants/actions";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import Recipe, {Recipes} from "../Recipe/recipe.class";
import Role from "../../constants/roles";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  FETCH_INIT,
  FETCH_SUCCESS,
  FETCH_CLOSED_REQUESTS,
  FETCH_RECIPE_INIT,
  FETCH_RECIPE_SUCCESS,
  UPDATE_REQUEST_SELECTION,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
  UPDATE_SINGLE_REQUEST,
}

type DispatchAction =
  | {type: ReducerActions.FETCH_INIT; payload: Record<string, never>}
  | {type: ReducerActions.FETCH_SUCCESS; payload: RequestDomain[]}
  | {type: ReducerActions.FETCH_CLOSED_REQUESTS; payload: RequestDomain[]}
  | {
      type: ReducerActions.UPDATE_REQUEST_SELECTION;
      payload: {newStateFilter: string};
    }
  | {type: ReducerActions.FETCH_RECIPE_INIT; payload: Record<string, never>}
  | {type: ReducerActions.FETCH_RECIPE_SUCCESS; payload: Recipe}
  | {type: ReducerActions.SNACKBAR_SHOW; payload: {message: string}}
  | {type: ReducerActions.SNACKBAR_CLOSE; payload: Record<string, never>}
  | {type: ReducerActions.UPDATE_SINGLE_REQUEST; payload: RequestDomain}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  requests: RequestDomain[];
  recipes: Recipes;
  activeRequests: RequestDomain[];
  closedRequests: RequestDomain[];
  isLoading: boolean;
  snackbar: Snackbar;
  closedRequestsFetched: boolean;
  error: Error | null;
};

const initialState: State = {
  requests: [],
  recipes: {},
  activeRequests: [],
  closedRequests: [],
  isLoading: false,
  snackbar: {} as Snackbar,
  closedRequestsFetched: false,
  error: null,
};

/** UI-Darstellung eines Antrags in der Tabelle. */
interface RequestUi {
  uid: string;
  number: number;
  status: JSX.Element;
  recipeName: string;
  createDate: Date;
  assigneeDisplayName: string;
  authorDisplayName: string;
  // Felder für den Dialog (nicht in Tabelle sichtbar)
  _domain: RequestDomain;
}

enum RequestStateFilter {
  Active = "active",
  All = "all",
}

interface RequestTableProps {
  requests: RequestDomain[];
  onClick: (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    name: string,
  ) => void;
  isLoading: State["isLoading"];
  requestStateFilter: RequestStateFilter;
  handleStateFilterChange: (
    event: React.MouseEvent<HTMLElement>,
    newStateFilter: string,
  ) => void;
  isCommunityLeader: boolean;
}

interface StatusChipsProps {
  status: string;
}

const requestReducer = (state: State, action: DispatchAction): State => {
  let tmpRequests: RequestDomain[] = [];
  let index: number;
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        requests: action.payload,
        activeRequests: action.payload,
      };
    case ReducerActions.FETCH_CLOSED_REQUESTS:
      return {
        ...state,
        isLoading: false,
        closedRequestsFetched: true,
        requests: [...state.activeRequests, ...action.payload],
        closedRequests: action.payload,
      };
    case ReducerActions.UPDATE_REQUEST_SELECTION:
      action.payload.newStateFilter == RequestStateFilter.All
        ? (tmpRequests = [...state.activeRequests, ...state.closedRequests])
        : (tmpRequests = state.activeRequests);
      return {
        ...state,
        requests: tmpRequests,
      };
    case ReducerActions.FETCH_RECIPE_INIT:
      return {...state, isLoading: true};
    case ReducerActions.FETCH_RECIPE_SUCCESS:
      return {
        ...state,
        isLoading: false,
        recipes: {...state.recipes, [action.payload.uid]: action.payload},
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: action.payload.message,
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    case ReducerActions.UPDATE_SINGLE_REQUEST:
      tmpRequests = [...state.requests];
      index = tmpRequests.findIndex(
        (request) => request.uid === action.payload.uid,
      );
      if (index !== -1) {
        tmpRequests[index] = action.payload;
      }
      return {
        ...state,
        requests: tmpRequests,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
const RequestOverviewPage = () => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const classes = useCustomStyles();
  const navigate = useNavigate();
  const {id: deepLinkRequestId} = useParams<{id: string}>();

  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [state, dispatch] = React.useReducer(requestReducer, initialState);
  const [requestStateFilter, setRequestStateFilter] = React.useState(
    RequestStateFilter.Active,
  );

  const [requestPopupValues, setRequestPopupValues] = React.useState({
    selectedRequest: null as RequestDomain | null,
    comments: [] as RequestCommentDomain[],
    open: false,
  });
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.none,
    });
  }, []);

  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!authUser) return;

    dispatch({type: ReducerActions.FETCH_INIT, payload: {}});

    database.requests
      .getActiveRequests()
      .then((result) => {
        dispatch({type: ReducerActions.FETCH_SUCCESS, payload: result});
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, [authUser]);

  /* ------------------------------------------
  // Deep-Link: Antrag per URL-Parameter öffnen
  // Wird ausgelöst durch /requestoverview/:id (z.B. aus E-Mail-Link)
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!deepLinkRequestId || state.isLoading || requestPopupValues.open) return;

    // Antrag in aktiven Requests suchen
    let targetRequest = state.requests.find((r) => r.uid === deepLinkRequestId);

    if (targetRequest) {
      // Gefunden — Dialog öffnen
      database.requestComments
        .getCommentsForRequest(targetRequest.uid)
        .then((comments) => {
          setRequestPopupValues({
            selectedRequest: targetRequest!,
            comments,
            open: true,
          });
        })
        .catch((error) => {
          Sentry.captureException(error);
          setRequestPopupValues({
            selectedRequest: targetRequest!,
            comments: [],
            open: true,
          });
        });
    } else if (!state.closedRequestsFetched) {
      // Nicht in aktiven Requests — geschlossene nachladen
      database.requests
        .getClosedRequests()
        .then((closedRequests) => {
          dispatch({
            type: ReducerActions.FETCH_CLOSED_REQUESTS,
            payload: closedRequests,
          });

          targetRequest = closedRequests.find(
            (r) => r.uid === deepLinkRequestId,
          );
          if (!targetRequest) return;

          return database.requestComments
            .getCommentsForRequest(targetRequest.uid)
            .then((comments) => {
              setRequestPopupValues({
                selectedRequest: targetRequest!,
                comments,
                open: true,
              });
            });
        })
        .catch((error) => {
          Sentry.captureException(error);
        });
    }
  }, [deepLinkRequestId, state.requests, state.isLoading]);

  if (!authUser) return null;

  const isCommunityLeader = authUser.roles.includes(Role.communityLeader);

  /* ------------------------------------------
  // PopUp öffnen
  // ------------------------------------------ */
  const onRowClick = async (
    _event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    requestNumber: string,
  ) => {
    const selectedRequest = state.requests.find(
      (request) => request.number === parseInt(requestNumber),
    );
    if (!selectedRequest) return;

    // Kommentare für den Antrag laden
    try {
      const comments = await database.requestComments.getCommentsForRequest(
        selectedRequest.uid,
      );
      setRequestPopupValues({
        selectedRequest,
        comments,
        open: true,
      });
    } catch (error) {
      Sentry.captureException(error);
      setRequestPopupValues({
        selectedRequest,
        comments: [],
        open: true,
      });
    }
  };

  /* ------------------------------------------
  // PopUp schliessen
  // ------------------------------------------ */
  const onPopUpClose = () => {
    setRequestPopupValues({...requestPopupValues, open: false});
  };

  /* ------------------------------------------
  // Status anpassen
  // ------------------------------------------ */
  const onUpdateStatus = async (nextStatus: RequestStatus, reason?: string) => {
    if (!requestPopupValues.selectedRequest) return;
    const request = requestPopupValues.selectedRequest;
    // Status vor dem Wechsel merken (für bedingte Post-Actions)
    const previousStatus = request.status;

    try {
      // Kommentar speichern (falls vorhanden).
      // Bei done/declined: skipNotification = true, da der Statuswechsel
      // bereits eine eigene E-Mail auslöst (requestRecipePublished / requestDeclined).
      // Bei anderen Übergängen (z.B. backToAuthor): Kommentar-Benachrichtigung
      // ist die einzige E-Mail → normal senden.
      if (reason) {
        const isClosingTransition =
          nextStatus === RequestStatus.done ||
          nextStatus === RequestStatus.declined;
        const comment = await database.requestComments.insertComment(
          request.uid,
          reason,
          authUser,
          isClosingTransition,
        );
        setRequestPopupValues((prev) => ({
          ...prev,
          comments: [...prev.comments, comment],
        }));
      }

      const changeLog = Request.createChangeLogEntry(
        request.changeLog,
        RequestAction.changeState,
        {authUid: authUser.authUid, displayName: authUser.publicProfile.displayName},
        {status: nextStatus},
      );

      const resolveDate = Request.isClosedStatus(nextStatus) ? new Date() : undefined;

      const updated = await database.requests.updateStatus(
        request.uid,
        nextStatus,
        changeLog,
        authUser,
        resolveDate,
      );

      dispatch({
        type: ReducerActions.UPDATE_SINGLE_REQUEST,
        payload: updated,
      });
      setRequestPopupValues((prev) => ({
        ...prev,
        selectedRequest: updated,
      }));

      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {message: TEXT_REQUEST_STATUS_CHANGED},
      });

      // Post-Actions ausführen (Rezept veröffentlichen, E-Mails etc.)
      await RequestService.executePostAction(
        updated,
        nextStatus,
        database,
        authUser,
        previousStatus,
      );
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Request mir zuweisen
  // ------------------------------------------ */
  const onAssignToMe = async () => {
    if (!requestPopupValues.selectedRequest) return;
    const request = requestPopupValues.selectedRequest;

    try {
      const changeLog = Request.createChangeLogEntry(
        request.changeLog,
        RequestAction.assign,
        {authUid: authUser.authUid, displayName: authUser.publicProfile.displayName},
        {assignee: authUser.publicProfile.displayName},
      );

      const updated = await database.requests.assignRequest(
        request.uid,
        authUser.authUid,
        changeLog,
        authUser,
      );

      dispatch({
        type: ReducerActions.UPDATE_SINGLE_REQUEST,
        payload: updated,
      });
      setRequestPopupValues({
        ...requestPopupValues,
        selectedRequest: updated,
      });

      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {message: TEXT_REQUEST_ASSIGNED_TO_ME},
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Neuer Kommentar hinzufügen
  // ------------------------------------------ */
  const onAddComment = async (newComment: string) => {
    if (!requestPopupValues.selectedRequest) return;

    try {
      const comment = await database.requestComments.insertComment(
        requestPopupValues.selectedRequest.uid,
        newComment,
        authUser,
      );

      setRequestPopupValues({
        ...requestPopupValues,
        comments: [...requestPopupValues.comments, comment],
      });

      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {message: TEXT_REQUEST_COMMENT_ADDED},
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Filter der Requests nach Status
  // ------------------------------------------ */
  const onStateFilterChange = (
    _event: React.MouseEvent<HTMLElement> | null,
    newStateFilter: string,
  ) => {
    if (
      state.closedRequestsFetched === false &&
      newStateFilter === RequestStateFilter.All
    ) {
      dispatch({type: ReducerActions.FETCH_INIT, payload: {}});
      database.requests
        .getClosedRequests()
        .then((result) => {
          dispatch({
            type: ReducerActions.FETCH_CLOSED_REQUESTS,
            payload: result,
          });
        })
        .catch((error) => {
          Sentry.captureException(error);
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    } else {
      dispatch({
        type: ReducerActions.UPDATE_REQUEST_SELECTION,
        payload: {newStateFilter},
      });
    }

    setRequestStateFilter(newStateFilter as RequestStateFilter);
  };

  /* ------------------------------------------
  // Recipe-Drawer-Handling
  // ------------------------------------------ */
  /** Rezept in neuem Tab öffnen (Community Leader kann dort bearbeiten). */
  const onRecipeOpen = (recipeUid: string) => {
    window.open(`${ROUTES_RECIPE}/${recipeUid}`, "_blank");
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_REQUESTS} />
      {/* ===== BODY ===== */}
      <Stack>
        <Container sx={classes.container} component="main" maxWidth="md">
          <Backdrop sx={classes.backdrop} open={state.isLoading}>
            <CircularProgress color="inherit" />
          </Backdrop>

          {state.error && (
            <AlertMessage
              error={state.error}
              severity="error"
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          <RequestTable
            requests={state.requests}
            onClick={onRowClick}
            isLoading={state.isLoading}
            requestStateFilter={requestStateFilter}
            handleStateFilterChange={onStateFilterChange}
            isCommunityLeader={isCommunityLeader}
          />
        </Container>
        {requestPopupValues.selectedRequest && (
          <DialogRequest
            request={requestPopupValues.selectedRequest}
            comments={requestPopupValues.comments}
            dialogOpen={requestPopupValues.open}
            authUser={authUser}
            handleClose={onPopUpClose}
            handleUpdateStatus={onUpdateStatus}
            handleAssignToMe={onAssignToMe}
            handleAddComment={onAddComment}
            handleRecipeOpen={onRecipeOpen}
          />
        )}
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={(_event, _reason) =>
            dispatch({type: ReducerActions.SNACKBAR_CLOSE, payload: {}})
          }
        />
      </Stack>
    </React.Fragment>
  );
};

/* ===================================================================
// ========================= Request-Tabelle =========================
// =================================================================== */
const RequestTable = ({
  requests,
  onClick,
  isLoading,
  requestStateFilter,
  handleStateFilterChange,
  isCommunityLeader,
}: RequestTableProps) => {
  const TABLE_COLUMNS = [
    {
      id: "uid",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      label: TEXT_UID,
      visible: false,
    },
    {
      id: "number",
      type: TableColumnTypes.number,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      label: TEXT_NUMBER,
      visible: true,
    },
    {
      id: "recipeName",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_NAME,
      visible: true,
    },
    {
      id: "status",
      type: TableColumnTypes.JSX,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_REQUEST_STATUS,
      visible: true,
    },
    {
      id: "createDate",
      type: TableColumnTypes.date,
      textAlign: ColumnTextAlign.center,
      disablePadding: false,
      label: TEXT_REQUEST_CREATION_DATE,
      visible: true,
    },
    {
      id: "assigneeDisplayName",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_REQUEST_ASSIGNEE_DISPLAYNAME,
      visible: true,
    },
    {
      id: "authorDisplayName",
      type: TableColumnTypes.string,
      textAlign: ColumnTextAlign.left,
      disablePadding: false,
      label: TEXT_REQUEST_AUTHOR_DISPLAYNAME,
      visible: true,
    },
  ];
  const classes = useCustomStyles();
  const theme = useTheme();

  const [searchString, setSearchString] = React.useState("");
  const [requestsUi, setRequestsUi] = React.useState<RequestUi[]>([]);

  const clearSearchString = () => {
    setSearchString("");
  };

  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    setSearchString(event.target.value);
    setRequestsUi(createRequestsForUi(requests, event.target.value));
  };

  /** Wandelt RequestDomain-Objekte in die Tabellen-Darstellung um. */
  const createRequestsForUi = (
    requests: RequestDomain[],
    searchString: string,
  ): RequestUi[] => {
    let filteredRequests: RequestDomain[] = [];
    if (searchString) {
      const search = searchString.toLowerCase();
      filteredRequests = requests.filter(
        (r) =>
          r.number.toString().includes(search) ||
          r.recipeName.toLowerCase().includes(search) ||
          r.assigneeDisplayName.toLowerCase().includes(search) ||
          r.authorDisplayName.toLowerCase().includes(search),
      );
    } else {
      filteredRequests = requests;
    }

    return filteredRequests.map((r) => ({
      uid: r.uid,
      number: r.number,
      status: <StatusChips status={r.status} />,
      recipeName: r.recipeName,
      createDate: r.createdAt,
      assigneeDisplayName: r.assigneeDisplayName,
      authorDisplayName: r.authorDisplayName,
      _domain: r,
    }));
  };

  if (!searchString && requests.length > 0 && requestsUi.length === 0) {
    setRequestsUi(createRequestsForUi(requests, searchString));
  } else if (
    !searchString &&
    requests.length > 0 &&
    requests.length !== requestsUi.length
  ) {
    setRequestsUi(createRequestsForUi(requests, searchString));
  } else if (requests.length === 0 && requestsUi.length > 0) {
    // Requests-Liste wurde geleert (z.B. Wechsel zurück auf «Aktiv» ohne aktive Anträge)
    setRequestsUi([]);
  }

  return (
    <Card sx={classes.card} key={"requestTablePanel"}>
      <CardContent sx={classes.cardContent} key={"requestTableContent"}>
        <Stack spacing={theme.spacing(2)}>
          <SearchPanel
            searchString={searchString}
            onUpdateSearchString={updateSearchString}
            onClearSearchString={clearSearchString}
          />
          <ToggleButtonGroup
            value={requestStateFilter}
            exclusive
            onChange={handleStateFilterChange}
            aria-label="text alignment"
            size="small"
            color="primary"
          >
            <ToggleButton
              value={RequestStateFilter.Active}
              aria-label="left aligned"
            >
              {TEXT_ACTIVE_REQUESTS}
            </ToggleButton>
            <ToggleButton value={RequestStateFilter.All} aria-label="centered">
              {TEXT_ALL_REQUESTS}
            </ToggleButton>
          </ToggleButtonGroup>
          <EnhancedTable
            tableData={requestsUi}
            tableColumns={TABLE_COLUMNS}
            keyColum={"number"}
            onRowClick={onClick}
          />
          {/* Keine Treffer bei Suche im Aktiv-Filter */}
          {requestsUi.length === 0 &&
            !isLoading &&
            searchString &&
            requestStateFilter === RequestStateFilter.Active && (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() =>
                      handleStateFilterChange(null, RequestStateFilter.All)
                    }
                  >
                    {TEXT_ALL_REQUESTS}
                  </Button>
                }
              >
                {TEXT_REQUEST_SEARCH_ALSO_CLOSED}
              </Alert>
            )}
          {/* Leerer Zustand ohne Suche */}
          {requestsUi.length === 0 && !isLoading && !searchString && (
            <Alert severity="info">
              {isCommunityLeader
                ? TEXT_REQUEST_EMPTY_STATE_LEADER
                : TEXT_REQUEST_EMPTY_STATE}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

/* =====================================================================
// Status-Chip
// ===================================================================== */
/**
 * Zeigt den Status als farbigen Chip an.
 *
 * @param status - Status-Wert für den Chip
 */
export const StatusChips = ({status}: StatusChipsProps) => {
  const classes = useCustomStyles();

  const chipStyle = (() => {
    switch (status) {
      case RequestStatus.done:
        return classes.workflowChipDone;
      case RequestStatus.declined:
        return classes.workflowChipAborted;
      case RequestStatus.backToAuthor:
        return classes.workflowChipBackToAuthor;
      default:
        return classes.workflowChipActive;
    }
  })();

  return (
    <Chip
      label={Request.translateStatus(status)}
      sx={chipStyle}
      size="small"
    />
  );
};

export default RequestOverviewPage;
