import * as Sentry from "@sentry/react";
import React, {useState} from "react";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Skeleton,
  Container,
  Typography,
  Link,
  Stack,
  Grid,
  IconButton,
  Chip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  FormLabel,
  ButtonBase,
  SnackbarCloseReason,
  LinearProgress,
} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {
  EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING,
  EXPENSE_TRACKING_NOT_ACTIVE as TEXT_EXPENSE_TRACKING_NOT_ACTIVE,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK,
  // BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT as TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT,
  // BUDGET_TYPE_FIXED as TEXT_BUDGET_TYPE_FIXED,
  EDIT_BUDGET as TEXT_EDIT_BUDGET,
  BUDGET_PER_PERSON_PER_DAY as TEXT_BUDGET_PER_PERSON_PER_DAY,
  BUDGET_TYPE_FIXED_AMOUNT as TEXT_BUDGET_TYPE_FIXED_AMOUNT,
  BUDGET_TYPE_PER_PERSON_PER_DAY as TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY,
  BUDGET_TARGET_AMOUNT as TEXT_BUDGET_TARGET_AMOUNT,
  BUDGET_TARGET_AMOUNT_MISSING as TEXT_BUDGET_TARGET_AMOUNT_MISSING,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  EXPENSE_TRACKING_OVERVIEW as TEXT_EXPENSE_TRACKING_OVERVIEW,
  EXPENSE_TRACKING_EXPENSES as TEXT_EXPENSE_TRACKING_EXPENSES,
  BUDGET_NAME as TEXT_BUDGET_NAME,
  BUDGET_AMOUNT as TEXT_BUDGET_AMOUNT,
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  BUDGET_CURRENCY as TEXT_BUDGET_CURRENCY,
  BUDGET_ICON as TEXT_BUDGET_ICON,
  PLEASE_PROVIDE_ICON as TEXT_PLEASE_PROVIDE_ICON,
  BUDGET_TYPE as TEXT_BUDGET_TYPE,
  BUDGET_SAVED as TEXT_BUDGET_SAVED,
  SPENT_AMOUNT as TEXT_SPENT_AMOUNT,
  OF_LIMIT as TEXT_OF_LIMIT,
} from "../../../constants/text/expenseTracking";
import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
} from "../../../constants/text";

import {isTransientNetworkError} from "../../../utils/errorUtils";
import {DonationForm} from "../../Donate/DonationForm";
import {useCustomStyles} from "../../../constants/styles";
import {getHelpPageUrl} from "../../Navigation/helpCenter";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import {Action} from "../../../constants/actions";
import {Budget} from "./budget.class";
import {useAuthUser} from "../../Session/authUserContext";
import {
  BudgetWithProgress,
  BudgetDomain,
  BudgetIcon,
  BudgetType,
} from "./budget.types";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {AlertMessage} from "../../Shared/AlertMessage";

import EditIcon from "@mui/icons-material/EditOutlined";
import {
  CabinOutlined,
  CategoryOutlined,
  CelebrationOutlined,
  CleaningServicesOutlined,
  DirectionsBusOutlined,
  HandymanOutlined,
  HealthAndSafetyOutlined,
  LocalBarOutlined,
  LocalGroceryStoreOutlined,
  RestaurantOutlined,
  SportsSoccerOutlined,
  StorefrontOutlined,
  AddOutlined,
} from "@mui/icons-material";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {
  formatAmountFromCents,
  parseAmountToCents,
} from "../../Shared/utils/currencyUtils";
import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
type ExpenseTrackingView = "overview" | "expenses";

export const BUDGET_ICON_MAP: Record<BudgetIcon, React.ElementType> = {
  [BudgetIcon.KITCHEN]: RestaurantOutlined,
  [BudgetIcon.GROCERIES]: LocalGroceryStoreOutlined,
  [BudgetIcon.BEVERAGES]: LocalBarOutlined,
  [BudgetIcon.KIOSK]: StorefrontOutlined,
  [BudgetIcon.THEME]: CelebrationOutlined,
  [BudgetIcon.MATERIAL]: HandymanOutlined,
  [BudgetIcon.TRANSPORT]: DirectionsBusOutlined,
  [BudgetIcon.ACCOMMODATION]: CabinOutlined,
  [BudgetIcon.ACTIVITIES]: SportsSoccerOutlined,
  [BudgetIcon.SAFETY]: HealthAndSafetyOutlined,
  [BudgetIcon.CLEANING]: CleaningServicesOutlined,
  [BudgetIcon.OTHER]: CategoryOutlined,
};

enum ReducerActions {
  BUDGETS_FETCH_SUCCESS,
  BUDGET_CREATED,
  GENERIC_ERROR,
  // SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}
type State = {
  isError: boolean;
  error: Error | null;
  budgetsWithProgress: BudgetWithProgress[] | null;
  snackbar: SnackbarState;
};
type DispatchAction =
  | {type: ReducerActions.BUDGETS_FETCH_SUCCESS; payload: BudgetWithProgress[]}
  | {type: ReducerActions.BUDGET_CREATED; payload: BudgetWithProgress}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  // | {
  //     type: ReducerActions.SNACKBAR_SHOW;
  //     payload: {severity: AlertColor; message: string};
  //   }
  | {type: ReducerActions.SNACKBAR_CLOSE};
const initialState: State = {
  budgetsWithProgress: null,
  isError: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

const expenseTrackingReducer = (
  state: State,
  action: DispatchAction,
): State => {
  switch (action.type) {
    case ReducerActions.BUDGETS_FETCH_SUCCESS:
      return {
        ...state,
        budgetsWithProgress: action.payload,
      };
    case ReducerActions.BUDGET_CREATED:
      return {
        ...state,
        budgetsWithProgress:
          state.budgetsWithProgress?.length == 0 ||
          state.budgetsWithProgress == null
            ? [action.payload]
            : state.budgetsWithProgress?.concat(action.payload),
        snackbar: {open: true, severity: "success", message: TEXT_BUDGET_SAVED},
        isError: false,
        error: null,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        error: action.payload as Error,
      };
    // case ReducerActions.SNACKBAR_SHOW:
    //   return {
    //     ...state,
    //     isLoading: false,
    //     snackbar: {
    //       severity: action.payload.severity,
    //       message: action.payload.message,
    //       open: true,
    //     },
    //   };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }
  }
};

/** Props für die Event-Abrechnungsseite. */
interface EventExpenseTrackingPageProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Gruppenzusammenstellung */
  groupConfiguration: EventGroupConfiguration;
  /** Datenbank-Service für Supabase-Zugriffe. */
  database: DatabaseService;
}

const EventExpenseTrackingPage = ({
  event,
  groupConfiguration,
  database,
}: EventExpenseTrackingPageProps) => {
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);
  const [state, dispatch] = React.useReducer(
    expenseTrackingReducer,
    initialState,
  );
  const [view, setView] = React.useState<ExpenseTrackingView>("overview");
  const [isCreateBudgetDialogOpen, setIsCreateBudgetDialogOpen] =
    React.useState<boolean>(false);

  const classes = useCustomStyles();
  const authUser = useAuthUser();

  /* ------------------------------------------
  // Spende für dieses Event laden
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!event.uid) return;

    database.donations
      .getEventDonations(event.uid)
      .then((donations) => {
        setHasDonation(donations.length > 0);
      })
      .catch((error) => {
        setHasDonation(false);
        if (!isTransientNetworkError(error)) {
          Sentry.captureException(error, {
            extra: {context: "Event-Spende laden"},
          });
        }
      });
  }, [event.uid]);
  /* ------------------------------------------
  // Budget für dieses Event laden
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!event.uid || hasDonation !== true || !authUser) return;

    (async () => {
      const budgetsWithProgress: BudgetWithProgress[] = [];
      try {
        let budgets = await database.budgets.getBudgetsForEvent(event.uid);
        if (budgets.length === 0) {
          const defaultBudget = Budget.createDefaultKitchenBudget(event.uid);
          const newBudget = await database.budgets.createBudget(
            defaultBudget,
            authUser,
          );
          budgets = [newBudget.value];
        }

        const spentAmounts = await database.expenses.getSpentAmountsByBudget(
          event.uid,
        );
        budgets.forEach((budget) => {
          const targetAmountInCents = Budget.getTargetAmountInCents(
            budget,
            groupConfiguration.totalPortions,
            event.numberOfDays,
          );
          const spentAmountInCents = spentAmounts[budget.id] ?? 0;

          budgetsWithProgress.push({
            budget: budget,
            targetAmountInCents: targetAmountInCents,
            spentAmountInCents: spentAmountInCents,
            percentage:
              targetAmountInCents > 0
                ? Math.round((spentAmountInCents / targetAmountInCents) * 100)
                : 0,
          });
        });
        dispatch({
          type: ReducerActions.BUDGETS_FETCH_SUCCESS,
          payload: budgetsWithProgress,
        });
      } catch (error) {
        if (!isTransientNetworkError(error)) {
          Sentry.captureException(error, {
            extra: {context: "Event-Budgets laden"},
          });
        }
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      }
    })();
  }, [hasDonation, event.uid, authUser]);
  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.expenseTracking,
    });
  }, []);

  /* ------------------------------------------
  // View Handler Budget / Ausgaben
  // ------------------------------------------ */
  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    newView: ExpenseTrackingView | null,
  ) => {
    if (newView !== null) {
      setView(newView);
    }
  };
  /* ------------------------------------------
  // Dialog Handling
  // ------------------------------------------ */
  const handleOpenCreateBudgetDialog = () => {
    setIsCreateBudgetDialogOpen(true);
  };
  const handleCreateBudget = (budgetInput: CreateBudgetFormState) => {
    const budget: BudgetDomain = {
      id: "",
      eventId: event.uid,
      name: budgetInput.name,
      budgetType: budgetInput.budgetType,
      amountInCents: parseAmountToCents(budgetInput.amount),
      currency: budgetInput.currency,
      icon: budgetInput.icon!,
    };

    try {
      Budget.checkBudgetData(budget);
    } catch (error) {
      // FieldValidationError = Nutzer-Hinweis (Pflichtfeld fehlt o.ä.) —
      // nur anzeigen, nicht an Sentry melden.
      if (!(error instanceof FieldValidationError)) {
        Sentry.captureException(error, {
          extra: {context: "Budget Save – Budget validieren"},
        });
      }
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
      return;
    }
    database.budgets.createBudget(budget, authUser!).then((budget) => {
      trackEvent(AnalyticsEvent.BUDGET_CREATED);

      const budgetWithProgress: BudgetWithProgress = {
        budget: budget.value,
        targetAmountInCents: Budget.getTargetAmountInCents(
          budget.value,
          groupConfiguration.totalPortions,
          event.numberOfDays,
        ),
        spentAmountInCents: 0,
        percentage: 0,
      };

      dispatch({
        type: ReducerActions.BUDGET_CREATED,
        payload: budgetWithProgress,
      });
    });
  };
  /* ------------------------------------------
  // Snackbar-Handler
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: globalThis.Event | React.SyntheticEvent<Element, globalThis.Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };
  return (
    <React.Fragment>
      <Stack spacing={2}>
        {state.isError && (
          <AlertMessage
            error={state.error!}
            messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
          />
        )}

        <Card sx={classes.card}>
          <CardHeader
            title={
              hasDonation || hasDonation === null
                ? TEXT_EXPENSE_TRACKING
                : TEXT_EXPENSE_TRACKING_NOT_ACTIVE
            }
          />
          <CardContent>
            {hasDonation == null ? (
              <Box data-testid="expense-tracking-loading">
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </Box>
            ) : hasDonation === false ? (
              <React.Fragment>
                <Typography variant="body1" sx={{marginBottom: 2}}>
                  {TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION}{" "}
                  <Link
                    href={getHelpPageUrl("event", "expensetracking")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {
                      TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK
                    }
                  </Link>
                  .
                </Typography>

                <Container
                  data-testid="expense-tracking-locked"
                  maxWidth="sm"
                  sx={classes.container}
                >
                  <DonationForm
                    eventId={event.uid}
                    returnPath={`/event/${event.uid}?tab=expensetracking`}
                    source="expense-tracking"
                  />
                </Container>
              </React.Fragment>
            ) : null}
          </CardContent>
        </Card>
        {hasDonation === true && (
          <Box data-testid="expense-tracking-unlocked">
            <Box sx={classes.budgetToolbar}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={handleViewChange}
                size="small"
                color="primary"
              >
                <ToggleButton value="overview">
                  {TEXT_EXPENSE_TRACKING_OVERVIEW}
                </ToggleButton>
                <ToggleButton value="expenses" disabled>
                  {TEXT_EXPENSE_TRACKING_EXPENSES}
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="contained"
                color="primary"
                startIcon={<AddOutlined />}
                onClick={handleOpenCreateBudgetDialog}
              >
                {TEXT_NEW_BUDGET}
              </Button>
            </Box>

            <Grid container spacing={2}>
              {state.budgetsWithProgress?.map((budget) => (
                <Grid
                  key={`budgeCardGrid_${budget.budget.id}`}
                  size={{xs: 12, md: 4}}
                >
                  <BudgetCard
                    key={`budgetCard_${budget.budget.id}`}
                    budgetWithProgress={budget}
                  />
                </Grid>
              ))}
              <Grid size={{xs: 12, md: 4}}>
                <AddBudgetCard onClick={handleOpenCreateBudgetDialog} />
              </Grid>
            </Grid>
          </Box>
        )}
      </Stack>
      <CreateBudgetDialog
        open={isCreateBudgetDialogOpen}
        onClose={() => setIsCreateBudgetDialogOpen(false)}
        onCreate={handleCreateBudget}
      />
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};
/** Props für die Budget-Karte. */
interface BudgetCardProps {
  budgetWithProgress: BudgetWithProgress;
}

const BudgetCard = ({budgetWithProgress}: BudgetCardProps) => {
  const classes = useCustomStyles();

  const BudgetIconComponent = BUDGET_ICON_MAP[budgetWithProgress.budget.icon];

  const getProgressColor = (
    percentage: number,
  ): "success" | "warning" | "error" => {
    if (percentage >= 100) return "error";
    if (percentage >= 85) return "warning";
    return "success";
  };

  const isPerPersonPerDay =
    budgetWithProgress.budget.budgetType === BudgetType.PER_PERSON_PER_DAY;

  const chipLabel = isPerPersonPerDay
    ? TEXT_BUDGET_PER_PERSON_PER_DAY(
        budgetWithProgress.budget.amountInCents,
        budgetWithProgress.budget.currency,
      )
    : budgetWithProgress.budget.amountInCents
      ? `${TEXT_BUDGET_TYPE_FIXED_AMOUNT}: ${formatAmountFromCents(budgetWithProgress.budget.amountInCents, budgetWithProgress.budget.currency)}`
      : TEXT_BUDGET_TYPE_FIXED_AMOUNT;

  return (
    <Card
      sx={classes.budgetCard}
      elevation={0}
      data-testid={budgetWithProgress.budget.id}
    >
      <Box sx={classes.budgetCardHeader}>
        <Box sx={classes.budgetCardTitleGroup}>
          <BudgetIconComponent fontSize="small" />
          <Typography variant="subtitle1" sx={classes.budgetCardTitle}>
            {budgetWithProgress.budget.name}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={TEXT_EDIT_BUDGET}
          // onClick={handleEditClick}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>

      <Chip
        size="small"
        label={chipLabel}
        sx={
          isPerPersonPerDay
            ? classes.budgetChipVariable
            : classes.budgetChipFixed
        }
      />

      <LinearProgress
        variant="determinate"
        value={Math.min(budgetWithProgress.percentage, 100)}
        color={getProgressColor(budgetWithProgress.percentage)}
        sx={classes.budgetProgressBar}
      />

      <Box sx={classes.budgetAmountRow}>
        <Typography
          variant="body2"
          sx={
            budgetWithProgress.percentage >= 100
              ? classes.budgetAmountOver
              : classes.budgetAmountNormal
          }
        >
          {TEXT_SPENT_AMOUNT(
            budgetWithProgress.spentAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
        <Typography variant="body2" sx={classes.budgetAmountSecondary}>
          {TEXT_OF_LIMIT(
            budgetWithProgress.targetAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
      </Box>

      {/* budget.secondaryCurrencies?.map((currency) => (
         <Box key={currency.currency} sx={classes.budgetSecondaryCurrencyRow}>
           <Typography variant="caption" sx={classes.budgetAmountSecondary}>
             {text.budget.secondaryCurrencyNote(currency.spent, currency.currency)}
           </Typography>
         </Box> */}

      {!isPerPersonPerDay && (
        <Box sx={classes.budgetAmountRow}>
          <Typography variant="body2" sx={classes.budgetAmountSecondary}>
            {budgetWithProgress.budget.amountInCents != null
              ? TEXT_BUDGET_TARGET_AMOUNT(
                  budgetWithProgress.budget.amountInCents,
                  budgetWithProgress.budget.currency,
                )
              : TEXT_BUDGET_TARGET_AMOUNT_MISSING}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

interface AddBudgetCardProps {
  onClick: () => void;
}

export const AddBudgetCard: React.FC<AddBudgetCardProps> = ({onClick}) => {
  const classes = useCustomStyles();

  const handleClick = () => {
    onClick();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <Box
      sx={classes.budgetCardAddNew}
      role="button"
      tabIndex={0}
      aria-label={TEXT_NEW_BUDGET}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <AddOutlined fontSize="medium" />
      <Typography variant="body2">{TEXT_NEW_BUDGET}</Typography>
    </Box>
  );
};

type CreateBudgetFormState = {
  name: string;
  budgetType: BudgetType;
  amount: string;
  currency: string;
  icon: BudgetIcon | null;
};
const INITIAL_FORM_STATE: CreateBudgetFormState = {
  name: "",
  budgetType: BudgetType.FIXED_AMOUNT,
  amount: "",
  currency: "CHF",
  icon: null,
};

interface CreateBudgetDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (budget: CreateBudgetFormState) => void;
}
// Schweizer Franken (Hauptwährung der App) + Euro (häufigste Fremdwährung
// bei grenznahen Lagern) — bei Bedarf um weitere Währungen erweitern.
const AVAILABLE_CURRENCIES = ["CHF", "EUR"];

export const CreateBudgetDialog: React.FC<CreateBudgetDialogProps> = ({
  open,
  onClose,
  onCreate,
}) => {
  const classes = useCustomStyles();
  const [touched, setTouched] = React.useState(false);
  const [formState, setFormState] =
    useState<CreateBudgetFormState>(INITIAL_FORM_STATE);

  const handleClose = () => {
    setTouched(false);
    onClose();
  };
  const amountInCents = parseAmountToCents(formState.amount);
  const isValid =
    formState.name.trim().length > 0 &&
    amountInCents != null &&
    amountInCents > 0 &&
    formState.icon != null;

  const handleSave = () => {
    setTouched(true);
    if (!isValid || formState.icon == null || amountInCents == null) {
      return;
    }

    onCreate(formState);
    handleClose();
  };

  const updateField = <K extends keyof CreateBudgetFormState>(
    field: K,
    value: CreateBudgetFormState[K],
  ) => {
    setFormState((prev) => ({...prev, [field]: value}));
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{TEXT_NEW_BUDGET}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={TEXT_BUDGET_NAME}
          value={formState.name}
          onChange={(event) => updateField("name", event.target.value)}
          error={touched && formState.name.trim().length === 0}
          helperText={
            touched && formState.name.trim().length === 0
              ? TEXT_PLEASE_PROVIDE_NAME
              : undefined
          }
          sx={classes.formControl}
          margin="normal"
        />
        <FormLabel>{TEXT_BUDGET_TYPE}</FormLabel>

        <RadioGroup
          value={formState.budgetType}
          onChange={(event) =>
            updateField("budgetType", event.target.value as BudgetType)
          }
        >
          <FormControlLabel
            value={BudgetType.FIXED_AMOUNT}
            control={<Radio />}
            label={TEXT_BUDGET_TYPE_FIXED_AMOUNT}
          />
          <FormControlLabel
            value={BudgetType.PER_PERSON_PER_DAY}
            control={<Radio />}
            label={TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY}
          />
        </RadioGroup>

        <Box sx={classes.budgetFormAmountRow}>
          <TextField
            label={TEXT_BUDGET_AMOUNT}
            value={formState.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            error={touched && (amountInCents == null || amountInCents <= 0)}
            helperText={
              touched && (amountInCents == null || amountInCents <= 0)
                ? TEXT_PLEASE_PROVIDE_AMOUNT
                : undefined
            }
            margin="normal"
            fullWidth
          />
          <TextField
            select
            label={TEXT_BUDGET_CURRENCY}
            value={formState.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            margin="normal"
            sx={classes.budgetFormCurrencySelect}
          >
            {AVAILABLE_CURRENCIES.map((currencyOption) => (
              <MenuItem key={currencyOption} value={currencyOption}>
                {currencyOption}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Typography variant="body2" sx={classes.formControl}>
          {TEXT_BUDGET_ICON}
        </Typography>
        <Box sx={classes.budgetIconPickerGrid}>
          {Object.values(BudgetIcon).map((iconOption) => {
            const IconComponent = BUDGET_ICON_MAP[iconOption];
            return (
              <ButtonBase
                key={iconOption}
                onClick={() => updateField("icon", iconOption)}
                sx={
                  formState.icon === iconOption
                    ? classes.budgetIconPickerButtonSelected
                    : classes.budgetIconPickerButton
                }
                aria-label={iconOption}
                aria-pressed={formState.icon === iconOption}
              >
                <IconComponent fontSize="small" />
              </ButtonBase>
            );
          })}
        </Box>
        {touched && formState.icon == null && (
          <Typography variant="caption" color="error">
            {TEXT_PLEASE_PROVIDE_ICON}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          {TEXT_CANCEL}
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {TEXT_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export {EventExpenseTrackingPage};
