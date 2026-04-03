/**
 * DataIntegrityPage — Admin-Seite für Datenintegritätsprüfungen.
 *
 * Zeigt eine Liste von Prüfungen, die einzeln oder alle zusammen
 * ausgeführt werden können. Ergebnisse werden als lesbare Liste angezeigt
 * mit optionalen Detail-Dialogen und Cleanup-Aktionen.
 */
import React, {useCallback, useReducer, useState} from "react";
import * as Sentry from "@sentry/react";

import {
  Container,
  Card,
  CardContent,
  CardHeader,
  Button,
  Stack,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Box,
  Tooltip,
  Divider,
} from "@mui/material";
import {
  PlayArrow as PlayArrowIcon,
  PlaylistPlay as PlaylistPlayIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  DeleteSweep as DeleteSweepIcon,
} from "@mui/icons-material";

import {
  DATA_INTEGRITY as TEXT_DATA_INTEGRITY,
  DATA_INTEGRITY_DESCRIPTION as TEXT_DATA_INTEGRITY_DESCRIPTION,
  UID as TEXT_UID,
  CLOSE as TEXT_CLOSE,
  DISPLAYNAME as TEXT_DISPLAYNAME,
  EMAIL as TEXT_EMAIL,
  MEMBER_SINCE as TEXT_MEMBER_SINCE,
  ERROR_GENERIC as TEXT_ERROR_GENERIC,
} from "../../../constants/text";

import {PageTitle} from "../../Shared/pageTitle";
import {FormListItem} from "../../Shared/formListItem";
import {SYSTEM_BREADCRUMB} from "../system";
import {useCustomStyles} from "../../../constants/styles";
import {supabase} from "../../Database/supabaseClient";
import {useDatabase} from "../../Database/DatabaseContext";
import {useFirebase} from "../../Firebase/firebaseContext";
import {useAuthUser} from "../../Session/authUserContext";
import {
  RecipeRepository,
  RecipeDomain,
  RecipeShortDomain,
} from "../../Database/Repository/RecipeRepository";
import {
  UserRepository,
  UserDomain,
} from "../../Database/Repository/UserRepository";
import {DialogRecipeAdminDetail} from "../Overview/overviewRecipes";
import {RecipeDrawer} from "../../Recipe/RecipeDrawer";
import Recipe from "../../Recipe/recipe.class";
import {ImageRepository} from "../../../constants/imageRepository";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";

/* ===================================================================
// ======================== Prüfungs-Definition ======================
// =================================================================== */

/** Definition einer einzelnen Integritätsprüfung. */
type IntegrityCheck = {
  /** Eindeutiger Schlüssel. */
  key: string;
  /** Anzeigename (Deutsch). */
  label: string;
  /** Beschreibung was geprüft wird. */
  description: string;
  /** Name der Postgres-Funktion. */
  rpcName: string;
  /** Feld im Anomalie-Objekt, das als ID dient (z.B. "product_id"). */
  idField?: string;
  /** Feld im Anomalie-Objekt, das als Anzeigename dient (z.B. "product_name"). */
  nameField?: string;
  /** Name der Cleanup-RPC. Wenn gesetzt, werden Lösch-Aktionen aktiviert. */
  cleanupRpcName?: string;
  /** Wenn gesetzt, wird ein Info-Icon für Detail-Dialoge angezeigt. */
  detailType?: "recipe" | "user";
};

/** Alle verfügbaren Prüfungen. */
const CHECKS: IntegrityCheck[] = [
  {
    key: "orphanedRecipes",
    label: "Verwaiste Rezepte",
    description: "Rezepte, deren Ersteller nicht mehr existiert",
    rpcName: "check_orphaned_recipes",
    idField: "recipe_id",
    nameField: "recipe_name",
  },
  {
    key: "orphanedEventCooks",
    label: "Verwaiste Event-Köche",
    description: "Koch-Einträge ohne zugehöriges Event",
    rpcName: "check_orphaned_event_cooks",
    idField: "cook_id",
    nameField: "event_id",
  },
  {
    key: "eventsWithoutDates",
    label: "Events ohne Zeitscheiben",
    description: "Anlässe ohne definierte Zeiträume",
    rpcName: "check_events_without_dates",
    idField: "event_id",
    nameField: "event_name",
  },
  {
    key: "unusedProducts",
    label: "Unbenutzte Produkte",
    description:
      "Produkte ohne Rezept-, Einkaufslisten-, Menüplan- oder Umrechnungs-Referenz",
    rpcName: "check_unused_products",
    idField: "product_id",
    nameField: "product_name",
    cleanupRpcName: "cleanup_unused_products",
  },
  {
    key: "unusedMaterials",
    label: "Unbenutzte Materialien",
    description:
      "Materialien ohne Rezept-, Materiallisten- oder Menüplan-Referenz",
    rpcName: "check_unused_materials",
    idField: "material_id",
    nameField: "material_name",
    cleanupRpcName: "cleanup_unused_materials",
  },
  {
    key: "recipesWithoutEvents",
    label: "Rezepte ohne Event",
    description:
      "Öffentliche Rezepte, die in keinem Event-Menü verwendet werden",
    rpcName: "check_recipes_without_events",
    idField: "recipe_id",
    nameField: "recipe_name",
    cleanupRpcName: "cleanup_recipes_without_events",
    detailType: "recipe",
  },
  {
    key: "usersWithoutEvents",
    label: "Benutzer ohne Event",
    description: "Benutzer, die in keinem Event als Koch eingetragen sind",
    rpcName: "check_users_without_events",
    idField: "user_id",
    nameField: "display_name",
    detailType: "user",
  },
  {
    key: "duplicateEmails",
    label: "Doppelte E-Mail-Adressen",
    description: "Benutzer mit identischer E-Mail (case-insensitive)",
    rpcName: "check_duplicate_emails",
    idField: "email",
    nameField: "email",
  },
  {
    key: "authUsersSync",
    label: "Auth/Users Sync",
    description: "public.users ohne passenden auth.users-Eintrag",
    rpcName: "check_auth_users_sync",
    idField: "user_id",
    nameField: "display_name",
  },
];

/* ===================================================================
// ======================== State / Reducer ===========================
// =================================================================== */

/** Ergebnis einer einzelnen Prüfung. */
type CheckResult = {
  status: "idle" | "running" | "done" | "error";
  anomalies: Record<string, unknown>[];
  error?: string;
  /** Cleanup-Status pro Prüfung. */
  cleanupStatus?: "idle" | "running" | "done" | "error";
  cleanupError?: string;
};

type State = {
  results: Record<string, CheckResult>;
  isRunningAll: boolean;
};

enum ReducerActions {
  CHECK_START = "CHECK_START",
  CHECK_SUCCESS = "CHECK_SUCCESS",
  CHECK_ERROR = "CHECK_ERROR",
  RUN_ALL_START = "RUN_ALL_START",
  RUN_ALL_DONE = "RUN_ALL_DONE",
  CLEANUP_START = "CLEANUP_START",
  CLEANUP_SUCCESS = "CLEANUP_SUCCESS",
  CLEANUP_ERROR = "CLEANUP_ERROR",
  REMOVE_ANOMALY = "REMOVE_ANOMALY",
}

/** Diskriminierte Union für typsichere Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.CHECK_START; payload: string}
  | {
      type: ReducerActions.CHECK_SUCCESS;
      payload: {key: string; anomalies: Record<string, unknown>[]};
    }
  | {type: ReducerActions.CHECK_ERROR; payload: {key: string; error: string}}
  | {type: ReducerActions.RUN_ALL_START}
  | {type: ReducerActions.RUN_ALL_DONE}
  | {type: ReducerActions.CLEANUP_START; payload: string}
  | {type: ReducerActions.CLEANUP_SUCCESS; payload: string}
  | {type: ReducerActions.CLEANUP_ERROR; payload: {key: string; error: string}}
  | {
      type: ReducerActions.REMOVE_ANOMALY;
      payload: {key: string; idField: string; idValue: string};
    };

const initialResults: Record<string, CheckResult> = {};
CHECKS.forEach((check) => {
  initialResults[check.key] = {status: "idle", anomalies: []};
});

const initialState: State = {
  results: initialResults,
  isRunningAll: false,
};

/**
 * Reducer für die Datenintegritätsseite.
 *
 * @param state Aktueller State.
 * @param action Typsichere Reducer-Aktion.
 * @returns Neuer State.
 */
const integrityReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.CHECK_START:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload]: {status: "running", anomalies: []},
        },
      };
    case ReducerActions.CHECK_SUCCESS:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload.key]: {
            status: "done",
            anomalies: action.payload.anomalies,
          },
        },
      };
    case ReducerActions.CHECK_ERROR:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload.key]: {
            status: "error",
            anomalies: [],
            error: action.payload.error,
          },
        },
      };
    case ReducerActions.RUN_ALL_START:
      return {...state, isRunningAll: true};
    case ReducerActions.RUN_ALL_DONE:
      return {...state, isRunningAll: false};
    case ReducerActions.CLEANUP_START:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload]: {
            ...state.results[action.payload],
            cleanupStatus: "running",
          },
        },
      };
    case ReducerActions.CLEANUP_SUCCESS:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload]: {
            ...state.results[action.payload],
            cleanupStatus: "done",
          },
        },
      };
    case ReducerActions.CLEANUP_ERROR:
      return {
        ...state,
        results: {
          ...state.results,
          [action.payload.key]: {
            ...state.results[action.payload.key],
            cleanupStatus: "error",
            cleanupError: action.payload.error,
          },
        },
      };
    case ReducerActions.REMOVE_ANOMALY: {
      const {key, idField, idValue} = action.payload;
      const current = state.results[key];
      return {
        ...state,
        results: {
          ...state.results,
          [key]: {
            ...current,
            anomalies: current.anomalies.filter(
              (anomaly) => String(anomaly[idField]) !== idValue,
            ),
          },
        },
      };
    }
    default:
      throw new Error("Unbekannter ActionType");
  }
};

/* ===================================================================
// ======================== Detail-Dialoge ===========================
// =================================================================== */

/** State für den Rezept-Detail-Dialog. */
type RecipeDetailState = {
  open: boolean;
  loading: boolean;
  domain: RecipeShortDomain | null;
  error?: string;
};

/** State für den Benutzer-Detail-Dialog. */
type UserDetailState = {
  open: boolean;
  loading: boolean;
  user: UserDomain | null;
  error?: string;
};

/**
 * Konvertiert ein RecipeDomain in ein RecipeShortDomain für den Detail-Dialog.
 *
 * @param recipe - Vollständiges Rezept-Domain-Objekt
 * @returns Kurz-Domain für DialogRecipeAdminDetail
 */
const toShortDomain = (recipe: RecipeDomain): RecipeShortDomain => ({
  uid: recipe.uid,
  name: recipe.name,
  source: recipe.source,
  pictureSrc: recipe.pictureSrc,
  tags: recipe.tags,
  menuTypes: recipe.menuTypes,
  dietProperties: recipe.dietProperties,
  outdoorKitchenSuitable: recipe.outdoorKitchenSuitable,
  avgRating: recipe.avgRating,
  noRatings: recipe.noRatings,
  noComments: recipe.noComments ?? 0,
  recipeType: recipe.recipeType,
  variantName: recipe.variantProperties?.variantName ?? null,
  createdAt: recipe.createdAt,
  createdBy: recipe.createdBy,
});

/**
 * Detail-Dialog für einen Benutzer.
 * Verwendet das gleiche Layout wie DialogUser in overviewUsers:
 * Bild-Header mit Namenüberlagerung, FormListItem-Liste für Profildaten.
 *
 * @param state Aktueller Dialog-State.
 * @param onClose Callback zum Schliessen.
 */
const UserDetailDialog = ({
  state,
  onClose,
}: {
  state: UserDetailState;
  onClose: () => void;
}) => {
  const classes = useCustomStyles();
  const user = state.user;

  const imageSrc = user?.pictureSrc
    ? getImageUrl(user.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  return (
    <Dialog open={state.open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={classes.dialogHeaderWithPicture}
        style={{
          backgroundImage: `url(${imageSrc})`,
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
          {user?.displayName ?? "Benutzer-Details"}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{p: 0}}>
        {state.loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {state.error && (
          <Alert severity="error" sx={{m: 2}}>
            {state.error}
          </Alert>
        )}
        {user && !state.loading && (
          <List>
            <FormListItem
              id="displayName"
              value={user.displayName}
              label={TEXT_DISPLAYNAME}
            />
            <FormListItem id="email" value={user.email} label={TEXT_EMAIL} />
            <FormListItem
              id="roles"
              value={user.roles.join(", ") || "–"}
              label="Rollen"
            />
            <FormListItem
              id="memberSince"
              value={user.createdAt ?? "–"}
              label={TEXT_MEMBER_SINCE}
            />
            <FormListItem
              id="uid"
              value={user.uid}
              label={TEXT_UID}
              displayAsCode
              withDivider={false}
            />
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {TEXT_CLOSE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ===================================================================
// ======================== Bestätigungs-Dialog ======================
// =================================================================== */

/** State für den Bestätigungs-Dialog. */
type ConfirmDialogState = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

const CONFIRM_DIALOG_INITIAL: ConfirmDialogState = {
  open: false,
  title: "",
  message: "",
  onConfirm: () => {},
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite für Datenintegritätsprüfungen.
 * Zeigt alle verfügbaren Prüfungen und deren Ergebnisse mit
 * Cleanup-Aktionen und Detail-Dialogen.
 */
const DataIntegrityPage = () => {
  const classes = useCustomStyles();
  const database = useDatabase();
  const firebase = useFirebase();
  const authUser = useAuthUser();
  const [state, dispatch] = useReducer(integrityReducer, initialState);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(
    CONFIRM_DIALOG_INITIAL,
  );

  // Detail-Dialog States
  const [recipeDetail, setRecipeDetail] = useState<RecipeDetailState>({
    open: false,
    loading: false,
    domain: null,
  });

  // RecipeDrawer State
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerRecipe, setDrawerRecipe] = useState<Recipe>(new Recipe());
  const [userDetail, setUserDetail] = useState<UserDetailState>({
    open: false,
    loading: false,
    user: null,
  });

  /** Einzelne Prüfung ausführen. */
  const runCheck = useCallback(async (check: IntegrityCheck) => {
    dispatch({type: ReducerActions.CHECK_START, payload: check.key});
    try {
      const {data, error} = await supabase.rpc(check.rpcName);
      if (error) throw new Error(error.message);
      dispatch({
        type: ReducerActions.CHECK_SUCCESS,
        payload: {
          key: check.key,
          anomalies: (data as Record<string, unknown>[]) ?? [],
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.CHECK_ERROR,
        payload: {
          key: check.key,
          error: TEXT_ERROR_GENERIC,
        },
      });
    }
  }, []);

  /** Alle Prüfungen nacheinander ausführen. */
  const runAllChecks = useCallback(async () => {
    dispatch({type: ReducerActions.RUN_ALL_START});
    for (const check of CHECKS) {
      await runCheck(check);
    }
    dispatch({type: ReducerActions.RUN_ALL_DONE});
  }, [runCheck]);

  /**
   * Einzelnes Element über Cleanup-RPC löschen.
   * Entfernt das Element aus der Anomalie-Liste nach Erfolg.
   */
  const deleteSingleItem = useCallback(
    async (check: IntegrityCheck, itemId: string) => {
      if (!check.cleanupRpcName || !check.idField) return;
      try {
        const {error} = await supabase.rpc(check.cleanupRpcName, {
          [`${check.idField.replace("_id", "")}_ids`]: [itemId],
        });
        if (error) throw new Error(error.message);
        dispatch({
          type: ReducerActions.REMOVE_ANOMALY,
          payload: {key: check.key, idField: check.idField, idValue: itemId},
        });
      } catch (error) {
        Sentry.captureException(error);
        // Fehlermeldung im Cleanup-Status anzeigen
        dispatch({
          type: ReducerActions.CLEANUP_ERROR,
          payload: {
            key: check.key,
            error: TEXT_ERROR_GENERIC,
          },
        });
      }
    },
    [],
  );

  /**
   * Alle Anomalien einer Prüfung über Cleanup-RPC löschen.
   * Führt danach die Prüfung erneut aus, um die Ergebnisse zu aktualisieren.
   */
  const cleanupAll = useCallback(
    async (check: IntegrityCheck) => {
      if (!check.cleanupRpcName || !check.idField) return;
      const anomalies = state.results[check.key]?.anomalies ?? [];
      if (anomalies.length === 0) return;

      dispatch({type: ReducerActions.CLEANUP_START, payload: check.key});
      try {
        const ids = anomalies.map((anomaly) => String(anomaly[check.idField!]));
        const {error} = await supabase.rpc(check.cleanupRpcName, {
          [`${check.idField.replace("_id", "")}_ids`]: ids,
        });
        if (error) throw new Error(error.message);
        dispatch({type: ReducerActions.CLEANUP_SUCCESS, payload: check.key});
        // Prüfung erneut ausführen, um aktualisierte Ergebnisse zu holen
        await runCheck(check);
      } catch (error) {
        Sentry.captureException(error);
        dispatch({
          type: ReducerActions.CLEANUP_ERROR,
          payload: {
            key: check.key,
            error: TEXT_ERROR_GENERIC,
          },
        });
      }
    },
    [state.results, runCheck],
  );

  /** Rezept-Detail-Dialog öffnen und Daten laden. */
  const openRecipeDetail = useCallback(async (recipeId: string) => {
    setRecipeDetail({open: true, loading: true, domain: null});
    try {
      const repo = new RecipeRepository();
      const recipe = await repo.getRecipe(recipeId, true);
      if (!recipe) throw new Error(`Rezept ${recipeId} nicht gefunden.`);
      setRecipeDetail({
        open: true,
        loading: false,
        domain: toShortDomain(recipe),
      });
    } catch (error) {
      Sentry.captureException(error);
      setRecipeDetail({
        open: true,
        loading: false,
        domain: null,
        error: TEXT_ERROR_GENERIC,
      });
    }
  }, []);

  /** Benutzer-Detail-Dialog öffnen und Daten laden. */
  const openUserDetail = useCallback(async (userId: string) => {
    setUserDetail({open: true, loading: true, user: null});
    try {
      const repo = new UserRepository();
      const user = await repo.findById(userId, true);
      if (!user) throw new Error(`Benutzer ${userId} nicht gefunden.`);
      setUserDetail({open: true, loading: false, user});
    } catch (error) {
      Sentry.captureException(error);
      setUserDetail({
        open: true,
        loading: false,
        user: null,
        error: TEXT_ERROR_GENERIC,
      });
    }
  }, []);

  /** Bestätigungs-Dialog für Einzellöschung öffnen. */
  const confirmDeleteSingle = useCallback(
    (check: IntegrityCheck, itemId: string, itemName: string) => {
      setConfirmDialog({
        open: true,
        title: "Eintrag löschen",
        message: `Soll "${itemName}" (${itemId}) wirklich gelöscht werden?`,
        onConfirm: () => {
          setConfirmDialog(CONFIRM_DIALOG_INITIAL);
          deleteSingleItem(check, itemId);
        },
      });
    },
    [deleteSingleItem],
  );

  /** Bestätigungs-Dialog für «Alle löschen» öffnen. */
  const confirmCleanupAll = useCallback(
    (check: IntegrityCheck, count: number) => {
      setConfirmDialog({
        open: true,
        title: "Alle löschen",
        message: `Sollen wirklich alle ${count} Einträge gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`,
        onConfirm: () => {
          setConfirmDialog(CONFIRM_DIALOG_INITIAL);
          cleanupAll(check);
        },
      });
    },
    [cleanupAll],
  );

  /** Rezept aus dem Detail-Dialog heraus löschen. */
  const deleteRecipeFromDialog = useCallback(
    (recipeId: string) => {
      setRecipeDetail((prev) => ({...prev, open: false}));
      // Prüfung finden, die recipesWithoutEvents entspricht
      const check = CHECKS.find(
        (checkItem) => checkItem.key === "recipesWithoutEvents",
      );
      if (check) {
        deleteSingleItem(check, recipeId);
      }
    },
    [deleteSingleItem],
  );

  /**
   * Lädt das vollständige Rezept und öffnet es im RecipeDrawer.
   * Gleiche Logik wie in overviewRecipes — fromRepositoryData benötigt
   * Zutaten, Schritte und Materialien separat.
   *
   * @param domain - Kurz-Rezeptdaten des ausgewählten Rezepts
   */
  const onOpenInDrawer = useCallback(
    async (domain: RecipeShortDomain) => {
      setRecipeDetail((prev) => ({...prev, open: false}));
      try {
        const [header, ingredients, steps, materials] = await Promise.all([
          database.recipes.getRecipe(domain.uid),
          database.recipeIngredients.getIngredientsForRecipe(domain.uid),
          database.recipePreparationSteps.getStepsForRecipe(domain.uid),
          database.recipeMaterials.getMaterialsForRecipe(domain.uid),
        ]);

        if (!header) {
          throw new Error(`Rezept ${domain.uid} nicht gefunden.`);
        }

        const recipe = Recipe.fromRepositoryData(
          header,
          ingredients,
          steps,
          materials,
        );
        setDrawerRecipe(recipe);
        setDrawerOpen(true);
      } catch (error) {
        Sentry.captureException(error);
      }
    },
    [database],
  );

  return (
    <>
      <PageTitle
        title={TEXT_DATA_INTEGRITY}
        subTitle={TEXT_DATA_INTEGRITY_DESCRIPTION}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />
      <Container sx={classes.container} component="main" maxWidth="md">
        <Stack spacing={2}>
          <Button
            variant="contained"
            startIcon={<PlaylistPlayIcon />}
            onClick={runAllChecks}
            disabled={state.isRunningAll}
          >
            Alle Prüfungen ausführen
          </Button>

          {state.isRunningAll && <LinearProgress />}

          {CHECKS.map((check) => {
            const result = state.results[check.key];
            return (
              <Card sx={classes.card} key={check.key}>
                <CardHeader
                  title={check.label}
                  subheader={check.description}
                  action={
                    <IconButton
                      aria-label={`${check.label} ausführen`}
                      onClick={() => runCheck(check)}
                      disabled={result.status === "running"}
                    >
                      <PlayArrowIcon />
                    </IconButton>
                  }
                />
                <CardContent>
                  {result.status === "running" && <LinearProgress />}
                  {result.status === "done" && (
                    <>
                      <Chip
                        icon={
                          result.anomalies.length === 0 ? (
                            <CheckCircleIcon />
                          ) : (
                            <WarningIcon />
                          )
                        }
                        label={
                          result.anomalies.length === 0
                            ? "Keine Anomalien"
                            : `${result.anomalies.length} Anomalie(n) gefunden`
                        }
                        color={
                          result.anomalies.length === 0 ? "success" : "warning"
                        }
                        size="small"
                        sx={{mb: 1}}
                      />
                      {result.anomalies.length > 0 && (
                        <>
                          <List dense>
                            {result.anomalies
                              .slice(0, 50)
                              .map((anomaly, index) => {
                                const itemId = check.idField
                                  ? String(anomaly[check.idField])
                                  : String(index);
                                const itemName = check.nameField
                                  ? String(anomaly[check.nameField])
                                  : JSON.stringify(anomaly, null, 0);

                                return (
                                  <ListItem
                                    key={itemId}
                                    secondaryAction={
                                      <Stack direction="row" spacing={0.5}>
                                        {check.detailType && (
                                          <Tooltip title="Details anzeigen">
                                            <IconButton
                                              edge="end"
                                              size="small"
                                              onClick={() => {
                                                if (
                                                  check.detailType === "recipe"
                                                ) {
                                                  openRecipeDetail(itemId);
                                                } else if (
                                                  check.detailType === "user"
                                                ) {
                                                  openUserDetail(itemId);
                                                }
                                              }}
                                            >
                                              <InfoIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                        {check.cleanupRpcName && (
                                          <Tooltip title="Löschen">
                                            <IconButton
                                              edge="end"
                                              size="small"
                                              onClick={() =>
                                                confirmDeleteSingle(
                                                  check,
                                                  itemId,
                                                  itemName,
                                                )
                                              }
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                      </Stack>
                                    }
                                  >
                                    <ListItemText
                                      primary={itemName}
                                      secondary={
                                        check.idField ? itemId : undefined
                                      }
                                      slotProps={{
                                        primary: {sx: {fontSize: "0.875rem"}},
                                        secondary: {
                                          sx: {
                                            fontFamily: "monospace",
                                            fontSize: "0.75rem",
                                          },
                                        },
                                      }}
                                    />
                                  </ListItem>
                                );
                              })}
                            {result.anomalies.length > 50 && (
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                sx={{pl: 2}}
                              >
                                ... und {result.anomalies.length - 50} weitere
                              </Typography>
                            )}
                          </List>
                          {check.cleanupRpcName && (
                            <>
                              <Divider sx={{my: 1}} />
                              <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={
                                  result.cleanupStatus === "running" ? (
                                    <CircularProgress size={16} />
                                  ) : (
                                    <DeleteSweepIcon />
                                  )
                                }
                                disabled={result.cleanupStatus === "running"}
                                onClick={() =>
                                  confirmCleanupAll(
                                    check,
                                    result.anomalies.length,
                                  )
                                }
                              >
                                Alle {result.anomalies.length} löschen
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      {result.cleanupError && (
                        <Alert severity="error" sx={{mt: 1}}>
                          {result.cleanupError}
                        </Alert>
                      )}
                    </>
                  )}
                  {result.status === "error" && (
                    <Alert severity="error">{result.error}</Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Container>

      {/* Rezept-Detail-Dialog (wiederverwendet aus overviewRecipes) */}
      <DialogRecipeAdminDetail
        open={
          recipeDetail.open &&
          !recipeDetail.loading &&
          recipeDetail.domain !== null
        }
        recipe={recipeDetail.domain}
        creatorName={undefined}
        onClose={() => setRecipeDetail((prev) => ({...prev, open: false}))}
        onOpenInDrawer={onOpenInDrawer}
        extraActions={
          recipeDetail.domain && (
            <Button
              color="error"
              onClick={() => deleteRecipeFromDialog(recipeDetail.domain!.uid)}
              startIcon={<DeleteIcon />}
            >
              Löschen
            </Button>
          )
        }
      />

      {/* Lade-Dialog während Rezeptdaten geladen werden */}
      <Dialog open={recipeDetail.open && recipeDetail.loading} maxWidth="xs">
        <DialogContent>
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Fehler-Dialog wenn Rezept nicht geladen werden konnte */}
      {recipeDetail.open && recipeDetail.error && (
        <Dialog
          open
          onClose={() => setRecipeDetail((prev) => ({...prev, open: false}))}
          maxWidth="sm"
          fullWidth
        >
          <DialogContent>
            <Alert severity="error">{recipeDetail.error}</Alert>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() =>
                setRecipeDetail((prev) => ({...prev, open: false}))
              }
              color="inherit"
            >
              {TEXT_CLOSE}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Rezept-Drawer */}
      {firebase && authUser && (
        <RecipeDrawer
          drawerSettings={{open: drawerOpen, isLoadingData: false}}
          recipe={drawerRecipe}
          mealPlan={[]}
          scaledPortions={0}
          editMode={false}
          disableFunctionality={true}
          firebase={firebase}
          authUser={authUser}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Benutzer-Detail-Dialog */}
      <UserDetailDialog
        state={userDetail}
        onClose={() => setUserDetail((prev) => ({...prev, open: false}))}
      />

      {/* Bestätigungs-Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(CONFIRM_DIALOG_INITIAL)}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(CONFIRM_DIALOG_INITIAL)}>
            Abbrechen
          </Button>
          <Button color="error" onClick={confirmDialog.onConfirm}>
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DataIntegrityPage;
