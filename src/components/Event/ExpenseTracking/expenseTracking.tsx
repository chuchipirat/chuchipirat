import * as Sentry from "@sentry/react";
import React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Skeleton,
  Container,
  Typography,
  Link,
  // AlertColor,
  Stack,
} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {
  EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING,
  EXPENSE_TRACKING_NOT_ACTIVE as TEXT_EXPENSE_TRACKING_NOT_ACTIVE,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK,
} from "../../../constants/text/expenseTracking";
import {ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE} from "../../../constants/text";

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
import {BudgetDomain} from "./budget.types";
import {SnackbarState} from "../../Shared/customSnackbar";
import {AlertMessage} from "../../Shared/AlertMessage";

enum ReducerActions {
  BUDGET_FETCH_SUCCESS,
  GENERIC_ERROR,
  // SNACKBAR_SHOW,
  // SNACKBAR_CLOSE,
}
type State = {
  isError: boolean;
  error: Error | null;
  budget: BudgetDomain[] | null;
  snackbar: SnackbarState;
};
type DispatchAction =
  | {type: ReducerActions.BUDGET_FETCH_SUCCESS; payload: BudgetDomain[]}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};
// | {
//     type: ReducerActions.SNACKBAR_SHOW;
//     payload: {severity: AlertColor; message: string};
//   }
// | {type: ReducerActions.SNACKBAR_CLOSE};
const initialState: State = {
  budget: null,
  isError: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

const expenseTrackingReducer = (
  state: State,
  action: DispatchAction,
): State => {
  switch (action.type) {
    case ReducerActions.BUDGET_FETCH_SUCCESS:
      return {
        ...state,
        budget: action.payload,
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
    // case ReducerActions.SNACKBAR_CLOSE:
    //   return {
    //     ...state,
    //     snackbar: {
    //       severity: "success",
    //       message: "",
    //       open: false,
    //     },
    //   };
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
  /** Datenbank-Service für Supabase-Zugriffe. */
  database: DatabaseService;
}

const EventExpenseTrackingPage = ({
  event,
  database,
}: EventExpenseTrackingPageProps) => {
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);
  const [state, dispatch] = React.useReducer(
    expenseTrackingReducer,
    initialState,
  );

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
        dispatch({type: ReducerActions.BUDGET_FETCH_SUCCESS, payload: budgets});
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

  return (
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
                  {TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK}
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
          ) : (
            <Box data-testid="expense-tracking-unlocked">
              {state.budget?.map((budget) => (
                <Typography key={budget.id}>{budget.budgetType}</Typography>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export {EventExpenseTrackingPage};
