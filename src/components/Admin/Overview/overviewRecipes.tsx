/**
 * OverviewRecipePage — Admin-Übersichtsseite für alle Rezepte.
 *
 * Ermöglicht die Suche nach Rezepten nach 4 Modi:
 * - Rezeptname (ilike)
 * - Rezept-UUID (exakte Suche)
 * - Ersteller-Auth-UUID (exakte Suche)
 * - Ersteller-Display-Name (zweistufige Suche via UserRepository)
 *
 * Die Suche erfolgt on-demand (kein automatischer Load beim Seitenaufruf).
 * Verwendet den Admin-Supabase-Client (Service Role Key), der RLS umgeht.
 *
 * @example
 * // In App.jsx (lazy-loaded)
 * const OverviewRecipes = lazy(() => import("../Admin/Overview/overviewRecipes"));
 */
import React from "react";

import {
  Container,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Grid,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Button,
  Chip,
  Typography,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormLabel,
  FormControl,
  Box,
  List,
} from "@mui/material";
import {
  Lock as LockIcon,
  Public as PublicIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
} from "@mui/icons-material";

import {PageTitle} from "../../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "../system";
import {AlertMessage} from "../../Shared/AlertMessage";
import {useDatabase} from "../../Database/DatabaseContext";
import {useFirebase} from "../../Firebase/firebaseContext";
import {useAuthUser} from "../../Session/authUserContext";
import type {RecipeShortDomain} from "../../Database/Repository/RecipeRepository";
import Recipe from "../../Recipe/recipe.class";
import {RecipeDrawer} from "../../Recipe/RecipeDrawer";
import {CardRibbon} from "../../Recipe/recipeCard";
import {FormListItem} from "../../Shared/formListItem";
import {ImageRepository} from "../../../constants/imageRepository";
import {getImageUrl, ImageSize} from "../../Shared/imageUrl";

import * as Sentry from "@sentry/react";
import {useCustomStyles} from "../../../constants/styles";

import {
  RECIPES as TEXT_RECIPES,
  OVERVIEW_RECIPES_DESCRIPTION as TEXT_OVERVIEW_RECIPES_DESCRIPTION,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  RECIPE_OPEN as TEXT_RECIPE_OPEN,
  CLOSE as TEXT_CLOSE,
  SEARCH_STRING as TEXT_SEARCH_STRING,
  UID as TEXT_UID,
  SOURCE as TEXT_SOURCE,
  CREATED_AT as TEXT_CREATED_AT,
  CREATED_FROM as TEXT_CREATED_FROM,
  PUBLIC_RECIPES as TEXT_PUBLIC_RECIPES,
  PRIVATE_RECIPES as TEXT_PRIVATE_RECIPES,
  ALL_RECIPES as TEXT_ALL_RECIPES,
  BUTTON_SEARCH as TEXT_BUTTON_SEARCH,
  RECIPETYPE as TEXT_RECIPETYPE,
  PRIVATE_RECIPE as TEXT_PRIVATE_RECIPE,
  VARIANT_RECIPE as TEXT_VARIANT_RECIPE,
} from "../../../constants/text";

/* =====================================================================
// Enums & Typen
// ===================================================================== */

/** Suchmodus für die Admin-Rezeptsuche. */
enum SearchMode {
  name = "name",
  recipeId = "recipeId",
  creatorId = "creatorId",
  creatorName = "creatorName",
}

/** Rezepttyp-Filter für die Admin-Suche. */
enum TypeFilter {
  all = "all",
  public = "public",
  private = "private",
}

/** Aktionen für den Reducer. */
enum ReducerActions {
  FETCH_INIT = "FETCH_INIT",
  FETCH_SUCCESS = "FETCH_SUCCESS",
  GENERIC_ERROR = "GENERIC_ERROR",
}

/** Interner Zustand der Seite. */
type State = {
  recipes: RecipeShortDomain[];
  /** Zuordnung user_id → display_name für Ersteller-Anzeige auf Karten. */
  creatorNames: Map<string, string>;
  isLoading: boolean;
  hasSearched: boolean;
  error: Error | null;
};

type DispatchAction =
  | {type: ReducerActions.FETCH_INIT}
  | {
      type: ReducerActions.FETCH_SUCCESS;
      payload: {
        recipes: RecipeShortDomain[];
        creatorNames: Map<string, string>;
      };
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

const initialState: State = {
  recipes: [],
  creatorNames: new Map(),
  isLoading: false,
  hasSearched: false,
  error: null,
};

/**
 * Reducer für den Seitenzustand.
 *
 * @param state - Aktueller Zustand
 * @param action - Dispatched Action
 * @returns Neuer Zustand
 */
const overviewReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {...state, isLoading: true, error: null};
    case ReducerActions.FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        hasSearched: true,
        recipes: action.payload.recipes,
        creatorNames: action.payload.creatorNames,
        error: null,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        hasSearched: true,
        error: action.payload,
      };
    default:
      return state;
  }
};

/* =====================================================================
// RecipeCardAdmin
// ===================================================================== */

/**
 * Props für die Admin-Rezeptkarte.
 *
 * @param domain - Kurz-Rezeptdaten
 * @param creatorName - Anzeigename des Erstellers (optional)
 * @param onClick - Callback beim Klick
 */
interface RecipeCardAdminProps {
  recipe: RecipeShortDomain;
  creatorName: string | undefined;
  onClick: (domain: RecipeShortDomain) => void;
}

/**
 * Kompakte Admin-Karte für ein Rezept.
 *
 * Zeigt: Rezeptbild (16:9), Ribbon (rot = privat, lila = Variante),
 * Rezeptname, UID als Chip, Typ-Icon und Ersteller-Name.
 */
const RecipeCardAdmin = ({
  recipe,
  creatorName,
  onClick,
}: RecipeCardAdminProps) => {
  const classes = useCustomStyles();
  const isPublic = recipe.recipeType === "public";
  const isVariant = recipe.variantName !== null;

  const imageSrc = recipe.pictureSrc
    ? getImageUrl(recipe.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  const ribbon = isVariant
    ? {
        cssProperty: "cardRibbon  cardRibbon--purple",
        icon: <CategoryIcon fontSize="small" />,
        tooltip: TEXT_VARIANT_RECIPE,
      }
    : !isPublic
      ? {
          cssProperty: "cardRibbon  cardRibbon--red",
          icon: <LockIcon fontSize="small" />,
          tooltip: TEXT_PRIVATE_RECIPE,
        }
      : undefined;

  return (
    <Card>
      <CardActionArea onClick={() => onClick(recipe)}>
        <Box sx={{overflow: "hidden", position: "relative"}}>
          {ribbon && <CardRibbon {...ribbon} />}
          <CardMedia
            sx={classes.cardMedia}
            image={imageSrc}
            title={recipe.name}
          />
        </Box>
        <CardContent sx={{pb: "8px !important"}}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap>
            {recipe.name}
          </Typography>
          <Chip
            label={recipe.uid}
            size="small"
            sx={{
              fontFamily: "monospace",
              fontSize: "0.65rem",
              mb: 0.5,
              maxWidth: "100%",
            }}
          />
          <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
            {isPublic ? (
              <PublicIcon
                fontSize="small"
                color="action"
                titleAccess="öffentlich"
              />
            ) : (
              <LockIcon fontSize="small" color="action" titleAccess="privat" />
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {creatorName ?? recipe.createdBy}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

/* =====================================================================
// DialogRecipeAdminDetail
// ===================================================================== */

/**
 * Props für den Admin-Detail-Dialog eines Rezepts.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param recipe - Kurz-Rezeptdaten (null wenn kein Rezept ausgewählt)
 * @param creatorName - Anzeigename des Erstellers
 * @param onClose - Callback zum Schliessen
 * @param onOpenInDrawer - Callback: Rezept im Drawer öffnen (optional — Button wird ausgeblendet wenn nicht gesetzt)
 * @param extraActions - Zusätzliche Aktions-Buttons im Dialog-Footer (optional)
 */
interface DialogRecipeAdminDetailProps {
  open: boolean;
  recipe: RecipeShortDomain | null;
  creatorName: string | undefined;
  onClose: () => void;
  onOpenInDrawer?: (domain: RecipeShortDomain) => void;
  extraActions?: React.ReactNode;
}

/**
 * Detail-Dialog mit Admin-Metadatenfeldern eines Rezepts.
 *
 * Zeigt ein Bild-Header mit dem Rezeptnamen als Überlagerung sowie
 * alle Metadaten (UUID, Typ, Quelle, Erstelldatum, Ersteller) in
 * einem kompakten label-links / wert-rechts Layout via FormListItem.
 */
export const DialogRecipeAdminDetail = ({
  open,
  recipe,
  creatorName,
  onClose,
  onOpenInDrawer,
  extraActions,
}: DialogRecipeAdminDetailProps) => {
  const classes = useCustomStyles();

  if (!recipe) return null;

  const isPublic = recipe.recipeType === "public";
  const isVariant = recipe.variantName !== null;

  const imageSrc = recipe.pictureSrc
    ? getImageUrl(recipe.pictureSrc, ImageSize.PROFILE_CARD)
    : ImageRepository.getEnvironmentRelatedPicture().CARD_PLACEHOLDER_MEDIA;

  // Typ-Wert als JSX mit Icon
  const recipeTypeValue = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {isVariant ? (
        <CategoryIcon fontSize="small" sx={{color: "purple"}} />
      ) : isPublic ? (
        <PublicIcon fontSize="small" />
      ) : (
        <LockIcon fontSize="small" />
      )}
      <Typography variant="body2">
        {isVariant
          ? `${TEXT_VARIANT_RECIPE}${recipe.variantName ? `: ${recipe.variantName}` : ""}`
          : isPublic
            ? TEXT_PUBLIC_RECIPES
            : TEXT_PRIVATE_RECIPES}
      </Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {/* Bild-Header mit Rezeptname-Überlagerung */}
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
          {recipe.name}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{p: 0}}>
        <List>
          <FormListItem
            key="uid"
            id="uid"
            value={recipe.uid}
            label={TEXT_UID}
            displayAsCode
          />
          <FormListItem
            key="recipeType"
            id="recipeType"
            value={recipeTypeValue}
            label={TEXT_RECIPETYPE}
          />
          <FormListItem
            key="source"
            id="source"
            value={recipe.source || "–"}
            label={TEXT_SOURCE}
          />
          <FormListItem
            key="createdAt"
            id="createdAt"
            value={recipe.createdAt}
            label={TEXT_CREATED_AT}
          />
          <FormListItem
            key="createdBy"
            id="createdBy"
            value={recipe.createdBy || "–"}
            label={`${TEXT_CREATED_FROM} ${TEXT_UID}`}
            displayAsCode
          />
          <FormListItem
            key="creatorName"
            id="creatorName"
            value={creatorName ?? recipe.createdBy ?? "–"}
            label={TEXT_CREATED_FROM}
            withDivider={false}
          />
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {TEXT_CLOSE}
        </Button>
        {extraActions}
        {onOpenInDrawer && (
          <Button
            onClick={() => onOpenInDrawer(recipe)}
            variant="outlined"
            color="primary"
          >
            {TEXT_RECIPE_OPEN}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

/* =====================================================================
// Hauptseite
// ===================================================================== */

/**
 * Admin-Übersichtsseite für alle Rezepte.
 *
 * Sucht Rezepte on-demand via regulärem Supabase-Client.
 * Nach der RLS-Korrektur (20260306000001_fix_recipes_rls.sql) können alle
 * authentifizierten Benutzer alle Rezepte lesen — kein Service-Role-Bypass nötig.
 * Ersteller-Namen werden über das UserRepository geladen; Community-Leader und
 * Admins haben via RLS bereits Lesezugriff auf die users-Tabelle.
 *
 * Zeigt Ergebnisse als RecipeCardAdmin-Karten an.
 * Beim Klick öffnet sich ein Detail-Dialog; von dort aus
 * kann das vollständige Rezept im RecipeDrawer geöffnet werden.
 */
const OverviewRecipePage = () => {
  const database = useDatabase();
  const firebase = useFirebase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  const [state, dispatch] = React.useReducer(overviewReducer, initialState);

  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [searchMode, setSearchMode] = React.useState<SearchMode>(
    SearchMode.name,
  );
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(
    TypeFilter.all,
  );

  const [selectedDomain, setSelectedDomain] =
    React.useState<RecipeShortDomain | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);

  const [drawerOpen, setDrawerOpen] = React.useState<boolean>(false);
  const [drawerRecipe, setDrawerRecipe] = React.useState<Recipe>(new Recipe());

  /* ------------------------------------------
  // Suche ausführen
  // ------------------------------------------ */
  /**
   * Führt die Rezeptsuche anhand des gewählten Modus aus.
   * Verwendet den regulären Supabase-Client (RLS aktiv).
   * Lädt nach der Suche die Ersteller-Displaynamen für alle Treffer.
   */
  const onSearch = async () => {
    if (!searchTerm.trim()) return;

    dispatch({type: ReducerActions.FETCH_INIT});

    try {
      let domains: RecipeShortDomain[] = [];

      switch (searchMode) {
        case SearchMode.name:
          domains = await database.recipes.searchByName(
            searchTerm.trim(),
            typeFilter,
          );
          break;
        case SearchMode.recipeId:
          domains = await database.recipes.searchByRecipeId(searchTerm.trim());
          break;
        case SearchMode.creatorId:
          domains = await database.recipes.searchByCreatorId(
            searchTerm.trim(),
            typeFilter,
          );
          break;
        case SearchMode.creatorName: {
          // Zweistufige Suche: zuerst Auth-UUIDs via Display-Name, dann Rezepte
          // database.users ist für Community-Leader und Admins via RLS zugänglich.
          const uids = await database.users.findIdsByDisplayName(
            searchTerm.trim(),
          );
          domains =
            uids.length > 0
              ? await database.recipes.searchByCreatorIds(uids, typeFilter)
              : [];
          break;
        }
      }

      // Ersteller-Namen für alle Treffer nachladen
      const creatorUids = [
        ...new Set(domains.map((d) => d.createdBy).filter(Boolean)),
      ];
      const nameMap =
        creatorUids.length > 0
          ? await database.users.findDisplayNamesByIds(creatorUids)
          : new Map<string, string>();

      dispatch({
        type: ReducerActions.FETCH_SUCCESS,
        payload: {recipes: domains, creatorNames: nameMap},
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  /* ------------------------------------------
  // Enter-Taste auslöst Suche
  // ------------------------------------------ */
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  /* ------------------------------------------
  // Karte angeklickt → Detail-Dialog öffnen
  // ------------------------------------------ */
  const onCardClick = (domain: RecipeShortDomain) => {
    setSelectedDomain(domain);
    setDialogOpen(true);
  };

  /* ------------------------------------------
  // Rezept im Drawer öffnen
  // ------------------------------------------ */
  /**
   * Lädt das vollständige Rezept (inkl. Produkt- und Materialnamen) und
   * öffnet es im RecipeDrawer.
   *
   * fromRepositoryData setzt name="" für Produkte/Materialien —
   * die Namen müssen nachträglich aus den Master-Tabellen aufgelöst werden.
   *
   * @param domain - Kurz-Rezeptdaten des ausgewählten Rezepts
   */
  const onOpenInDrawer = async (domain: RecipeShortDomain) => {
    setDialogOpen(false);
    try {
      const [header, ingredients, steps, materials, _products, _allMaterials] =
        await Promise.all([
          database.recipes.getRecipe(domain.uid),
          database.recipeIngredients.getIngredientsForRecipe(domain.uid),
          database.recipePreparationSteps.getStepsForRecipe(domain.uid),
          database.recipeMaterials.getMaterialsForRecipe(domain.uid),
          database.products.getAllProducts(),
          database.materials.getAllMaterials(),
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
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  if (!authUser) return null;

  /* ------------------------------------------
  // TypeFilter-Radios (disabled wenn Rezept-ID-Suche)
  // ------------------------------------------ */
  const typeFilterDisabled = searchMode === SearchMode.recipeId;

  return (
    <React.Fragment>
      {/* ===== HEADER ===== */}
      <PageTitle
        title={TEXT_RECIPES}
        subTitle={TEXT_OVERVIEW_RECIPES_DESCRIPTION}
        breadcrumbs={[SYSTEM_BREADCRUMB]}
      />

      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_UUPS}
            />
          )}

          {/* Suchkarte */}
          <Card sx={classes.card}>
            <CardContent>
              <Stack spacing={2}>
                <TextField
                  label={TEXT_SEARCH_STRING}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  fullWidth
                  variant="outlined"
                  size="small"
                />

                <FormControl component="fieldset">
                  <FormLabel
                    component="legend"
                    sx={{mb: 0.5, fontSize: "0.875rem"}}
                  >
                    Suche nach:
                  </FormLabel>
                  <RadioGroup
                    row
                    value={searchMode}
                    onChange={(e) =>
                      setSearchMode(e.target.value as SearchMode)
                    }
                  >
                    <FormControlLabel
                      value={SearchMode.name}
                      control={<Radio size="small" />}
                      label="Rezeptname"
                    />
                    <FormControlLabel
                      value={SearchMode.recipeId}
                      control={<Radio size="small" />}
                      label="Rezept-ID"
                    />
                    <FormControlLabel
                      value={SearchMode.creatorId}
                      control={<Radio size="small" />}
                      label="Ersteller-ID"
                    />
                    <FormControlLabel
                      value={SearchMode.creatorName}
                      control={<Radio size="small" />}
                      label="Ersteller-Name"
                    />
                  </RadioGroup>
                </FormControl>

                <FormControl component="fieldset" disabled={typeFilterDisabled}>
                  <FormLabel
                    component="legend"
                    sx={{mb: 0.5, fontSize: "0.875rem"}}
                  >
                    {TEXT_RECIPETYPE}:
                  </FormLabel>
                  <RadioGroup
                    row
                    value={typeFilter}
                    onChange={(e) =>
                      setTypeFilter(e.target.value as TypeFilter)
                    }
                  >
                    <FormControlLabel
                      value={TypeFilter.all}
                      control={<Radio size="small" />}
                      label={TEXT_ALL_RECIPES}
                    />
                    <FormControlLabel
                      value={TypeFilter.public}
                      control={<Radio size="small" />}
                      label={TEXT_PUBLIC_RECIPES}
                    />
                    <FormControlLabel
                      value={TypeFilter.private}
                      control={<Radio size="small" />}
                      label={TEXT_PRIVATE_RECIPES}
                    />
                  </RadioGroup>
                </FormControl>

                <Box display="flex" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onSearch}
                    disabled={!searchTerm.trim() || state.isLoading}
                  >
                    {TEXT_BUTTON_SEARCH}
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Ergebnisse */}
          {!state.hasSearched && !state.isLoading && (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              Suchbegriff eingeben und auf «{TEXT_BUTTON_SEARCH}» klicken…
            </Typography>
          )}

          {state.hasSearched && !state.isLoading && (
            <>
              <Typography variant="subtitle2" color="text.secondary">
                {state.recipes.length} {TEXT_RECIPES}
              </Typography>

              {state.recipes.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  Keine Rezepte gefunden.
                </Typography>
              )}

              <Grid container spacing={2}>
                {state.recipes.map((recipe) => (
                  <Grid key={recipe.uid} size={{xs: 12, sm: 6, md: 4, lg: 3}}>
                    <RecipeCardAdmin
                      recipe={recipe}
                      creatorName={state.creatorNames.get(recipe.createdBy)}
                      onClick={onCardClick}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </Stack>
      </Container>

      {/* Detail-Dialog */}
      <DialogRecipeAdminDetail
        open={dialogOpen}
        recipe={selectedDomain}
        creatorName={
          selectedDomain
            ? state.creatorNames.get(selectedDomain.createdBy)
            : undefined
        }
        onClose={() => setDialogOpen(false)}
        onOpenInDrawer={onOpenInDrawer}
      />

      {/* Rezept-Drawer */}
      {firebase && (
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
    </React.Fragment>
  );
};

export default OverviewRecipePage;
