/**
 * OverviewUsersPage — Admin-Übersichtsseite aller Benutzer.
 *
 * Zeigt alle Benutzer in einem DataGrid (inkl. Supabase Auth UUID).
 * Klick auf eine Zeile öffnet einen Dialog mit drei Tabs:
 *  - Profil: Name, E-Mail, Rollen (editierbar), IDs
 *  - Statistiken: Rezeptanzahl (read-only) + noFoundBugs (editierbar mit +/-)
 *  - Anlässe: Platzhalter (noch nicht migriert)
 *
 * Verwendet ausschliesslich Supabase (kein Firebase).
 *
 * @example
 * // In App.jsx (lazy-loaded)
 * const OverviewUsers = lazy(() => import("../Admin/Overview/overviewUsers"));
 */
import React, {useEffect, useReducer, useState} from "react";

import {
  USER_LIST as TEXT_USER_LIST,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  UID as TEXT_UID,
  FIRSTNAME as TEXT_FIRSTNAME,
  LASTNAME as TEXT_LASTNAME,
  DISPLAYNAME as TEXT_DISPLAYNAME,
  USERS as TEXT_USERS,
  FROM as TEXT_FROM,
  EMAIL as TEXT_EMAIL,
  MEMBER_ID as TEXT_MEMBER_ID,
  MEMBER_SINCE as TEXT_MEMBER_SINCE,
  MOTTO as TEXT_MOTTO,
  ROLES as TEXT_ROLES,
  OPEN as TEXT_OPEN,
  EDIT_AUTHORIZATION as TEXT_EDIT_AUTHORIZATION,
  EDIT_AUTHORIZATION_DESCRIPTION as TEXT_EDIT_AUTHORIZATION_DESCRIPTION,
  RE_SIGN_IN_REQUIRED as TEXT_RE_SIGN_IN_REQUIRED,
  RE_SIGN_IN_REQUIRED_AFTER_ROLES_ASSIGNMENT as TEXT_RE_SIGN_IN_REQUIRED_AFTER_ROLES_ASSIGNMENT,
  ROLE_TYPES as TEXT_ROLE_TYPES,
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
  ROLES_UPDATED_SUCCSESSFULLY as TEXT_ROLES_UPDATED_SUCCSESSFULLY,
  YOU_CANT_UPDATE_YOUR_OWN_AUTHORIZATION as TEXT_YOU_CANT_UPDATE_YOUR_OWN_AUTHORIZATION,
  STATS as TEXT_STATS,
  FOUND_BUGS as TEXT_FOUND_BUGS,
  PUBLIC_RECIPES as TEXT_PUBLIC_RECIPES,
  PRIVATE_RECIPES as TEXT_PRIVATE_RECIPES,
  EVENTS as TEXT_EVENTS,
} from "../../../constants/text";

import {
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Event as EventIcon,
} from "@mui/icons-material";

import PageTitle from "../../Shared/pageTitle";
import AlertMessage from "../../Shared/AlertMessage";
import SearchPanel from "../../Shared/searchPanel";
import CustomSnackbar, {
  SNACKBAR_INITIAL_STATE_VALUES,
  Snackbar,
} from "../../Shared/customSnackbar";
import {FormListItem} from "../../Shared/formListItem";

import User, {UserOverviewStructure} from "../../User/user.class";
import {UserDomain} from "../../Database/Repository/UserRepository";
import {EventDomain} from "../../Database/Repository/EventRepository";
import Role from "../../../constants/roles";
import {EVENT as ROUTE_EVENT} from "../../../constants/routes";
import Action from "../../../constants/actions";
import useCustomStyles from "../../../constants/styles";
import {ImageRepository} from "../../../constants/imageRepository";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";

import {useNavigate} from "react-router";
import {useAuthUser} from "../../Session/authUserContext";
import {useDatabase} from "../../Database/DatabaseContext";

import {
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  IconButton,
  List,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
  useTheme,
  Alert,
  AlertTitle,
} from "@mui/material";

import {DataGrid, GridColDef, GridSortModel} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import isEqual from "lodash/isEqual";

import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== Typen / State ============================
// =================================================================== */

enum ReducerActions {
  FETCH_INIT,
  FETCH_SUCCESS,
  SNACKBAR_SET,
  SNACKBAR_CLOSE,
  GENERIC_ERROR,
}

type DispatchAction = {
  type: ReducerActions;
  payload: Record<string, unknown>;
};

type State = {
  users: UserOverviewStructure[];
  isLoading: boolean;
  error: Error | null;
  snackbar: Snackbar;
};

const initialState: State = {
  users: [],
  isLoading: false,
  error: null,
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
};

const usersReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ReducerActions.FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        users: action.payload as unknown as UserOverviewStructure[],
      };
    case ReducerActions.SNACKBAR_SET:
      return {...state, snackbar: action.payload as unknown as Snackbar};
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {severity: "success", message: "", open: false},
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload as unknown as Error,
      };
    default:
      throw new Error("Unbekannter ReducerAction");
  }
};

/* ===================================================================
// ======================== Hauptkomponente ==========================
// =================================================================== */

const OverviewUsersPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const classes = useCustomStyles();

  const [state, dispatch] = useReducer(usersReducer, initialState);

  // Dialog-State (lokal, kein Reducer)
  const [selectedUser, setSelectedUser] =
    useState<UserOverviewStructure | null>(null);
  const [userDomain, setUserDomain] = useState<UserDomain | null>(null);
  const [recipeCounts, setRecipeCounts] = useState<{
    noRecipesPublic: number;
    noRecipesPrivate: number;
  } | null>(null);
  const [userEvents, setUserEvents] = useState<EventDomain[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  const [roleDialog, setRoleDialog] = useState({
    open: false,
    userUid: "" as string,
  });

  /* ------------------------------------------
  // Daten laden
  // ------------------------------------------ */
  useEffect(() => {
    dispatch({type: ReducerActions.FETCH_INIT, payload: {}});

    User.getUsersOverview({database})
      .then((result) => {
        dispatch({
          type: ReducerActions.FETCH_SUCCESS,
          payload: result as unknown as Record<string, unknown>,
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  if (!authUser) return null;

  /* ------------------------------------------
  // Dialog öffnen — Profil + Rezeptanzahl parallel laden
  // ------------------------------------------ */
  const onOpenDialog = async (user: UserOverviewStructure) => {
    setSelectedUser(user);
    setDialogOpen(true);
    setDialogLoading(true);
    setUserDomain(null);
    setRecipeCounts(null);
    setUserEvents([]);

    try {
      const repo = database.admin?.users ?? database.users;
      const recipeRepo = database.admin?.recipes ?? database.recipes;

      const [domain, counts, events] = await Promise.all([
        repo.findById(user.uid ?? ""),
        user.authUid
          ? recipeRepo.findRecipeCountsByCreator(user.authUid)
          : Promise.resolve({noRecipesPublic: 0, noRecipesPrivate: 0}),
        user.authUid
          ? database.events.getAllEventsForUser(user.authUid)
          : Promise.resolve([]),
      ]);

      setUserDomain(domain);
      setRecipeCounts(counts);
      setUserEvents(events);
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Record<string, unknown>});
    } finally {
      setDialogLoading(false);
    }
  };

  const onCloseDialog = () => {
    setDialogOpen(false);
    setSelectedUser(null);
    setUserDomain(null);
    setRecipeCounts(null);
    setUserEvents([]);
  };

  /* ------------------------------------------
  // no_found_bugs ändern
  // ------------------------------------------ */
  const onChangeFoundBugs = async (delta: number) => {
    if (!selectedUser?.uid) return;

    try {
      await User.updateStats({
        database,
        userUid: selectedUser.uid,
        statsValue: delta,
      });
      setUserDomain((prev) =>
        prev
          ? {...prev, noFoundBugs: Math.max(0, prev.noFoundBugs + delta)}
          : null
      );
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Record<string, unknown>});
    }
  };

  /* ------------------------------------------
  // Rollen aktualisieren
  // ------------------------------------------ */
  const onDialogEditRolesClose = () => {
    setRoleDialog({open: false, userUid: ""});
  };

  const onDialogEditRolesUpdate = async (newRoles: Role[]) => {
    if (!selectedUser?.uid) return;

    try {
      const repo = database.admin?.users ?? database.users;
      await repo.patch({
        id: selectedUser.uid,
        fields: {roles: newRoles},
        authUser: authUser,
      });
      dispatch({
        type: ReducerActions.SNACKBAR_SET,
        payload: {
          severity: "success",
          message: TEXT_ROLES_UPDATED_SUCCSESSFULLY,
          open: true,
        } as unknown as Record<string, unknown>,
      });
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Record<string, unknown>});
    }
    setRoleDialog({open: false, userUid: ""});
  };

  const handleSnackbarClose = (_event: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    dispatch({type: ReducerActions.SNACKBAR_CLOSE, payload: {}});
  };

  return (
    <React.Fragment>
      <PageTitle title={TEXT_USER_LIST} />

      <Container sx={classes.container} component="main" maxWidth="xl">
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

        <UsersTable dbUsers={state.users} onUserSelect={onOpenDialog} />
      </Container>

      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />

      <DialogEditRoles
        open={roleDialog.open}
        roles={userDomain?.roles ?? []}
        userUid={roleDialog.userUid}
        authUser={authUser}
        handleClose={onDialogEditRolesClose}
        handleUpdate={onDialogEditRolesUpdate}
      />

      {selectedUser && (
        <DialogUser
          dialogOpen={dialogOpen}
          isLoading={dialogLoading}
          user={selectedUser}
          userDomain={userDomain}
          recipeCounts={recipeCounts}
          userEvents={userEvents}
          handleClose={onCloseDialog}
          onEditRoles={() =>
            setRoleDialog({open: true, userUid: selectedUser.uid ?? ""})
          }
          onChangeFoundBugs={onChangeFoundBugs}
          onOpenEvent={(eventUid) => {
            navigate(`${ROUTE_EVENT}/${eventUid}`, {
              state: {action: Action.VIEW},
            });
          }}
        />
      )}
    </React.Fragment>
  );
};

/* ===================================================================
// ===================== Benutzertabelle =============================
// =================================================================== */
interface UsersTableProps {
  dbUsers: UserOverviewStructure[];
  onUserSelect: (user: UserOverviewStructure) => void;
}

const UsersTable = ({dbUsers, onUserSelect}: UsersTableProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const [searchString, setSearchString] = useState("");
  const [users, setUsers] = useState<UserOverviewStructure[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserOverviewStructure[]>(
    []
  );
  const [sortModel, setSortModel] = useState<GridSortModel>([
    {field: "displayName", sort: "asc"},
  ]);

  const DATA_GRID_COLUMNS: GridColDef[] = [
    {
      field: "edit",
      headerName: TEXT_OPEN,
      sortable: false,
      width: 80,
      renderCell: (params) => {
        const row = params.row as UserOverviewStructure;
        return (
          <IconButton
            aria-label="open User"
            style={{margin: theme.spacing(1)}}
            size="small"
            onClick={() => onUserSelect(row)}
          >
            <OpenInNewIcon fontSize="inherit" />
          </IconButton>
        );
      },
    },
    {
      field: "authUid",
      headerName: "Supabase-ID",
      editable: false,
      width: 290,
      cellClassName: () => `super-app ${classes.typographyCode}`,
      valueFormatter: (value: string | undefined) =>
        value ? value : "—",
    },
    {
      field: "displayName",
      headerName: TEXT_DISPLAYNAME,
      editable: false,
      width: 150,
    },
    {
      field: "firstName",
      headerName: TEXT_FIRSTNAME,
      editable: false,
      width: 150,
    },
    {
      field: "lastName",
      headerName: TEXT_LASTNAME,
      editable: false,
      width: 150,
    },
    {
      field: "email",
      headerName: TEXT_EMAIL,
      editable: false,
      width: 300,
    },
    {
      field: "memberId",
      headerName: TEXT_MEMBER_ID,
      editable: false,
      width: 120,
    },
    {
      field: "memberSince",
      headerName: TEXT_MEMBER_SINCE,
      editable: false,
      width: 150,
      valueFormatter: (value: Date | undefined) => {
        if (value instanceof Date) {
          return value.toLocaleString("de-CH", {dateStyle: "medium"});
        }
        return "";
      },
    },
  ];

  const filterUsers = (
    list: UserOverviewStructure[],
    term: string
  ): UserOverviewStructure[] => {
    if (!term) return list;
    const lower = term.toLowerCase();
    return list.filter(
      (u) =>
        u.uid?.toLowerCase().includes(lower) ||
        u.authUid?.toLowerCase().includes(lower) ||
        u.firstName.toLowerCase().includes(lower) ||
        u.lastName.toLowerCase().includes(lower) ||
        u.displayName.toLowerCase().includes(lower) ||
        u.email.toLowerCase().includes(lower)
    );
  };

  // Initiale Daten übernehmen
  if (dbUsers.length > 0 && users.length === 0) {
    setUsers([...dbUsers]);
  }
  if (!searchString && users.length > 0 && filteredUsers.length === 0) {
    setFilteredUsers(filterUsers(users, ""));
  }

  const clearSearch = () => {
    setSearchString("");
    setFilteredUsers(filterUsers(users, ""));
  };

  const updateSearch = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const val = event.target.value;
    setSearchString(val);
    setFilteredUsers(filterUsers(users, val));
  };

  return (
    <Card sx={classes.card} style={{marginBottom: "4em"}}>
      <CardContent sx={classes.cardContent}>
        <Stack spacing={2}>
          <SearchPanel
            searchString={searchString}
            onUpdateSearchString={updateSearch}
            onClearSearchString={clearSearch}
          />
          <Typography variant="body2" style={{marginTop: "0.5em", marginBottom: "2em"}}>
            {filteredUsers.length === users.length
              ? `${users.length} ${TEXT_USERS}`
              : `${filteredUsers.length} ${TEXT_FROM.toLowerCase()} ${users.length} ${TEXT_USERS}`}
          </Typography>
          <Box style={{display: "flex", height: "100%"}}>
            <Box style={{flexGrow: 1}}>
              <DataGrid
                rows={filteredUsers}
                columns={DATA_GRID_COLUMNS}
                getRowId={(row) => row.uid ?? row.authUid ?? row.email}
                localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
                onSortModelChange={(model) => {
                  if (!isEqual(model, sortModel)) setSortModel(model);
                }}
              />
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ========================= Benutzer-Dialog =========================
// =================================================================== */
interface DialogUserProps {
  dialogOpen: boolean;
  isLoading: boolean;
  user: UserOverviewStructure;
  userDomain: UserDomain | null;
  recipeCounts: {noRecipesPublic: number; noRecipesPrivate: number} | null;
  userEvents: EventDomain[];
  handleClose: () => void;
  onEditRoles: () => void;
  onChangeFoundBugs: (delta: number) => void;
  onOpenEvent: (eventUid: string) => void;
}

const DialogUser = ({
  dialogOpen,
  isLoading,
  user,
  userDomain,
  recipeCounts,
  userEvents,
  handleClose,
  onEditRoles,
  onChangeFoundBugs,
  onOpenEvent,
}: DialogUserProps) => {
  const [activeTab, setActiveTab] = useState(0);
  const classes = useCustomStyles();

  const pictureSrc = userDomain?.pictureSrc
    ? getImageUrl(userDomain.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle
        sx={classes.dialogHeaderWithPicture}
        style={{
          backgroundImage: `url(${pictureSrc})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={classes.dialogHeaderWithPictureTitle}
          style={{paddingLeft: "2ex"}}
        >
          {user.displayName || "Benutzer"}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <React.Fragment>
            <Tabs
              value={activeTab}
              onChange={(_e, v) => setActiveTab(v)}
              sx={{borderBottom: 1, borderColor: "divider", mb: 2}}
            >
              <Tab label="Profil" />
              <Tab label={TEXT_STATS} />
              <Tab label={TEXT_EVENTS} />
            </Tabs>

            {/* Tab 0: Profil */}
            {activeTab === 0 && (
              <List>
                <FormListItem
                  key="displayName"
                  id="displayName"
                  value={user.displayName}
                  label={TEXT_DISPLAYNAME}
                />
                <FormListItem
                  key="firstName"
                  id="firstName"
                  value={user.firstName}
                  label={TEXT_FIRSTNAME}
                />
                <FormListItem
                  key="lastName"
                  id="lastName"
                  value={user.lastName}
                  label={TEXT_LASTNAME}
                />
                <FormListItem
                  key="email"
                  id="email"
                  value={user.email}
                  label={TEXT_EMAIL}
                />
                {user.authUid && (
                  <FormListItem
                    key="authUid"
                    id="authUid"
                    value={user.authUid}
                    label="Supabase-ID"
                    displayAsCode
                  />
                )}
                {user.uid && (
                  <FormListItem
                    key="uid"
                    id="uid"
                    value={user.uid}
                    label={`Firebase-${TEXT_UID}`}
                    displayAsCode
                  />
                )}
                {userDomain?.motto && (
                  <FormListItem
                    key="motto"
                    id="motto"
                    value={userDomain.motto}
                    label={TEXT_MOTTO}
                  />
                )}
                <FormListItem
                  key="memberId"
                  id="memberId"
                  value={user.memberId}
                  label={TEXT_MEMBER_ID}
                />
                <FormListItem
                  key="memberSince"
                  id="memberSince"
                  value={user.memberSince}
                  label={TEXT_MEMBER_SINCE}
                />
                <FormListItem
                  key="roles"
                  id="roles"
                  value={userDomain?.roles?.join(", ") ?? ""}
                  label={TEXT_ROLES}
                />
              </List>
            )}

            {/* Tab 1: Statistiken */}
            {activeTab === 1 && (
              <List>
                <FormListItem
                  key="noRecipesPublic"
                  id="noRecipesPublic"
                  value={recipeCounts?.noRecipesPublic ?? 0}
                  label={`Anzahl ${TEXT_PUBLIC_RECIPES}`}
                />
                <FormListItem
                  key="noRecipesPrivate"
                  id="noRecipesPrivate"
                  value={recipeCounts?.noRecipesPrivate ?? 0}
                  label={`Anzahl ${TEXT_PRIVATE_RECIPES}`}
                />
                <FormListItem
                  key="noFoundBugs"
                  id="noFoundBugs"
                  value={userDomain?.noFoundBugs ?? 0}
                  label={TEXT_FOUND_BUGS}
                  secondaryAction={
                    <React.Fragment>
                      <IconButton
                        size="small"
                        aria-label="Bug hinzufügen"
                        onClick={() => onChangeFoundBugs(1)}
                      >
                        <AddIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Bug entfernen"
                        onClick={() => onChangeFoundBugs(-1)}
                      >
                        <RemoveIcon />
                      </IconButton>
                    </React.Fragment>
                  }
                />
              </List>
            )}

            {/* Tab 2: Anlässe */}
            {activeTab === 2 && (
              <Box py={1}>
                {userEvents.length === 0 ? (
                  <Typography variant="body2" color="textSecondary" sx={{py: 2}}>
                    Keine Anlässe vorhanden.
                  </Typography>
                ) : (
                  <React.Fragment>
                    <Typography variant="body2" color="textSecondary" sx={{mb: 1}}>
                      {userEvents.length} {userEvents.length === 1 ? "Anlass" : "Anlässe"}
                    </Typography>
                    <List dense>
                      {userEvents.map((event) => {
                        // Datumsbereich berechnen
                        const startDate = event.dates.length > 0
                          ? event.dates.reduce((min, d) => d.dateFrom < min ? d.dateFrom : min, event.dates[0].dateFrom)
                          : null;
                        const endDate = event.dates.length > 0
                          ? event.dates.reduce((max, d) => d.dateTo > max ? d.dateTo : max, event.dates[0].dateTo)
                          : null;
                        const dateStr = startDate && endDate
                          ? startDate.toLocaleDateString("de-CH", {dateStyle: "medium"}) +
                            " – " +
                            endDate.toLocaleDateString("de-CH", {dateStyle: "medium"})
                          : "";

                        return (
                          <FormListItem
                            key={event.uid}
                            id={event.uid}
                            value={event.name}
                            label={dateStr || "Kein Datum"}
                            icon={<EventIcon />}
                            secondaryAction={
                              <IconButton
                                size="small"
                                aria-label={`${event.name} öffnen`}
                                onClick={() => onOpenEvent(event.uid)}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            }
                          />
                        );
                      })}
                    </List>
                  </React.Fragment>
                )}
              </Box>
            )}
          </React.Fragment>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onEditRoles} color="primary">
          {TEXT_EDIT_AUTHORIZATION}
        </Button>
        <Button onClick={handleClose} color="primary" variant="outlined">
          {TEXT_CANCEL}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ===================================================================
// ==================== Dialog: Rollen bearbeiten ====================
// =================================================================== */
interface DialogEditRolesProps {
  open: boolean;
  roles: Role[];
  userUid: string;
  authUser: AuthUser;
  handleClose: () => void;
  handleUpdate: (roles: Role[]) => void;
}

/** Anzeigereihenfolge der Rollen (aufsteigend nach Berechtigungsstufe). */
const ROLE_ORDER: Role[] = [Role.basic, Role.communityLeader, Role.admin];

/** Erzeugt ein initiales Selection-Objekt aus den übergebenen aktiven Rollen. */
const makeRoleSelection = (activeRoles: Role[]): Record<Role, boolean> =>
  Object.fromEntries(
    Object.values(Role).map((r) => [r, activeRoles.includes(r)])
  ) as Record<Role, boolean>;

const DialogEditRoles = ({
  open,
  roles,
  userUid,
  authUser,
  handleClose,
  handleUpdate,
}: DialogEditRolesProps) => {
  const theme = useTheme();

  // Selektion wird via useEffect bei jedem Öffnen aus der aktuellen
  // Rollenliste des gewählten Benutzers neu initialisiert.
  const [selected, setSelected] = useState<Record<Role, boolean>>(
    makeRoleSelection(roles)
  );

  useEffect(() => {
    if (open) {
      setSelected(makeRoleSelection(roles));
    }
  }, [open, roles]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = event.target.name as Role;
    const checked = event.target.checked;
    setSelected((prev) => {
      const next = {...prev};
      switch (name) {
        case Role.basic:
          next[Role.basic] = checked;
          if (!checked) {
            next[Role.communityLeader] = false;
            next[Role.admin] = false;
          }
          break;
        case Role.communityLeader:
          next[Role.communityLeader] = checked;
          if (checked) next[Role.basic] = true;
          else next[Role.admin] = false;
          break;
        case Role.admin:
          next[Role.admin] = checked;
          if (checked) {
            next[Role.basic] = true;
            next[Role.communityLeader] = true;
          }
          break;
      }
      return next;
    });
  };

  const save = () => {
    handleUpdate(Object.values(Role).filter((r) => selected[r]));
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>{TEXT_EDIT_AUTHORIZATION}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>{TEXT_EDIT_AUTHORIZATION_DESCRIPTION}</Typography>
          {userUid === authUser.uid ? (
            <Alert severity="warning" style={{marginTop: theme.spacing(1)}}>
              {TEXT_YOU_CANT_UPDATE_YOUR_OWN_AUTHORIZATION}
            </Alert>
          ) : (
            <Alert severity="info" style={{marginTop: theme.spacing(1)}}>
              <AlertTitle>{TEXT_RE_SIGN_IN_REQUIRED}</AlertTitle>
              {TEXT_RE_SIGN_IN_REQUIRED_AFTER_ROLES_ASSIGNMENT}
            </Alert>
          )}
          <FormControl component="fieldset">
            <FormLabel component="legend">Berechtigungen</FormLabel>
            <FormGroup>
              {ROLE_ORDER.map((role) => (
                <FormControlLabel
                  key={role}
                  control={
                    <Switch
                      checked={selected[role]}
                      onChange={handleChange}
                      name={role}
                      // basic kann nicht entzogen werden; eigene Rollen sind gesperrt
                      disabled={
                        role === Role.basic || userUid === authUser.uid
                      }
                    />
                  }
                  label={TEXT_ROLE_TYPES[role]}
                />
              ))}
            </FormGroup>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary" variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button
          onClick={save}
          color="primary"
          variant="outlined"
          disabled={userUid === authUser.uid}
        >
          {TEXT_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverviewUsersPage;
