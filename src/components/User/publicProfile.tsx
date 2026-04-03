import React from "react";
import {useNavigate, useLocation, useParams} from "react-router";

import {
  Container,
  Stack,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  List,
  Typography,
  Box,
} from "@mui/material";

import {
  Today as TodayIcon,
  LocalActivity as LocalActivityIcon,
  HowToReg as HowToRegIcon,
  Fastfood as FastfoodIcon,
  BugReport as BugReportIcon,
  Comment as CommentIcon,
  Star as StarIcon,
  ContentCopy as ContentCopyIcon,
} from "@mui/icons-material";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";

import {useCustomStyles} from "../../constants/styles";

import {User} from "./user.class";
import {
  INTRODUCING_NAME as TEXT_INTRODUCING_NAME,
  EDIT as TEXT_EDIT,
  FOUND_TREASURES as TEXT_FOUND_TREASURES,
  ON_BOARD_SINCE as TEXT_ON_BOARD_SINCE,
  MOTTO as TEXT_MOTTO,
  RECIPES_CREATED_PUBLIC as TEXT_RECIPES_CREATED_PUBLIC,
  RECIPES_CREATED_PRIVATE as TEXT_RECIPES_CREATED_PRIVATE,
  RECIPES_CREATED_VARIANTS as TEXT_RECIPES_CREATED_VARIANTS,
  EVENTS_PARTICIPATED as TEXT_EVENTS_PARTICIPATED,
  COMMENTS_WRITTEN as TEXT_COMMENTS_WRITTEN,
  RATINGS_GIVEN as TEXT_RATINGS_GIVEN,
  FOUND_BUGS as TEXT_FOUND_BUGS,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
} from "../../constants/text";
import {Action} from "../../constants/actions";
import * as ROUTES from "../../constants/routes";
import {ImageRepository} from "../../constants/imageRepository";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import {UserPublicProfile} from "./user.public.profile.class";
import {getImageUrl, ImageSize} from "../Shared/imageUrl";
import {FormListItem} from "../Shared/formListItem";
import {AlertMessage} from "../Shared/AlertMessage";
import {useAuthUser} from "../Session/authUserContext";
/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  SET_IS_LOADING,
  FETCH_PUBLIC_PROFILE,
  FETCH_PUBLIC_PROFILE_SUCCESS,
  GENERIC_ERROR,
}
type State = {
  publicProfile: UserPublicProfile;
  isLoading: boolean;
  error: Error | null;
};

const initialState: State = {
  publicProfile: new UserPublicProfile(),
  isLoading: false,
  error: null,
};

/**
 * Diskriminierte Union für alle Reducer-Aktionen.
 * Jede Aktion hat einen eigenen Payload-Typ (oder keinen).
 */
type DispatchAction =
  | {
      type: ReducerActions.FETCH_PUBLIC_PROFILE;
      payload: {displayName: string; pictureSrc: string};
    }
  | {
      type: ReducerActions.FETCH_PUBLIC_PROFILE_SUCCESS;
      payload: UserPublicProfile;
    }
  | {type: ReducerActions.SET_IS_LOADING; payload: boolean}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};
const publicProfileReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.FETCH_PUBLIC_PROFILE: {
      return {
        ...state,
        isLoading: true,
        publicProfile: {...state.publicProfile, ...action.payload},
      };
    }
    case ReducerActions.FETCH_PUBLIC_PROFILE_SUCCESS: {
      return {
        ...state,
        isLoading: false,
        publicProfile: action.payload,
      };
    }
    case ReducerActions.SET_IS_LOADING:
      return {...state, isLoading: action.payload};
    case ReducerActions.GENERIC_ERROR:
      return {...state, isLoading: false, error: action.payload};
    default:
      throw new Error(`Unbekannter ActionType: ${(action as {type: unknown}).type}`);
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
/**
 * Seite für das öffentliche Benutzerprofil.
 *
 * Zeigt Anzeigename, Profilbild, Motto, Mitglied-seit-Datum und Statistiken
 * (Rezepte, Anlässe, Kommentare, Bewertungen, gefundene Bugs).
 * Bietet einen Bearbeiten-Button, wenn das eigene Profil angeschaut wird.
 */
const PublicProfilePage = () => {
  const _firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const location = useLocation();
  const {id} = useParams();
  const navigate = useNavigate();

  const [state, dispatch] = React.useReducer(
    publicProfileReducer,
    initialState,
  );

  const urlUid = id ?? "";
  /* ------------------------------------------
  // Daten aus DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (
      location.state &&
      location.state.displayName &&
      location.state.pictureSrc
    ) {
      dispatch({
        type: ReducerActions.FETCH_PUBLIC_PROFILE,
        payload: {
          displayName: location.state.displayName,
          pictureSrc: location.state.pictureSrc,
        },
      });
    }

    User.getPublicProfile({database: database, uid: urlUid})
      .then((result) => {
        dispatch({
          type: ReducerActions.FETCH_PUBLIC_PROFILE_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, [urlUid]);

  if (authUser === null) {
    return null;
  }

  /* ------------------------------------------
  // Zu eigenem Profil wechseln
  // ------------------------------------------ */
  const onEditClick = () => {
    navigate(`${ROUTES.USER_PROFILE}/${authUser!.uid}`, {
      state: {action: Action.VIEW},
    });
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_INTRODUCING_NAME(state.publicProfile.displayName)}
      />
      {state.publicProfile.uid === authUser?.uid ? (
        // Nur Anzeigen wenn die Person das eigene Profil anschaut
        <ButtonRow
          key="buttons_view"
          buttons={[
            {
              id: "edit",
              hero: true,
              label: TEXT_EDIT,
              variant: "contained",
              color: "primary",
              visible: authUser.uid === urlUid,
              onClick: onEditClick,
            },
          ]}
        />
      ) : null}
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Stack spacing={2}>
          {state.error && (
            <AlertMessage
              error={state.error}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          )}
          <Card sx={classes.card}>
            <Box component={"div"} style={{position: "relative"}}>
              <React.Fragment>
                <CardMedia
                  sx={classes.cardMedia}
                  image={
                    state.publicProfile.pictureSrc
                      ? getImageUrl(
                          state.publicProfile.pictureSrc,
                          ImageSize.PROFILE_CARD,
                        )
                      : ImageRepository.getEnvironmentRelatedPicture()
                          .CARD_PLACEHOLDER_MEDIA
                  }
                  title={state.publicProfile.displayName}
                />
                <Box component={"div"} sx={classes.textOnCardMediaImage}>
                  <Typography
                    sx={classes.userProfileCardNameOnImage}
                    variant="h2"
                  >
                    {state.publicProfile.displayName}
                  </Typography>
                </Box>
              </React.Fragment>
            </Box>
            <CardContent sx={classes.cardContent}>
              <PublicProfileList userProfile={state.publicProfile} />
            </CardContent>
          </Card>
          <Card>
            <CardContent sx={classes.cardContent}>
              <Typography gutterBottom={true} variant="h5" component="h2">
                {TEXT_FOUND_TREASURES}
              </Typography>
              <AchievedRewardsList userProfile={state.publicProfile} />
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// =================== Liste aller gefundenen Schätze ================
// =================================================================== */
interface PublicProfileListProps {
  userProfile: UserPublicProfile;
}
/**
 * Listenansicht der Profilbasisdaten (Mitglied seit, Motto).
 *
 * @param userProfile - Das öffentliche Benutzerprofil.
 */
export const PublicProfileList = React.memo(({userProfile}: PublicProfileListProps) => {
  return (
    <React.Fragment>
      <List>
        <FormListItem
          id={"memberSince"}
          key={"memberSince"}
          value={
            userProfile.memberSince instanceof Date
              ? userProfile.memberSince.toLocaleString("de-CH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })
              : ""
          }
          label={TEXT_ON_BOARD_SINCE}
          icon={<HowToRegIcon fontSize="small" />}
        />
        <FormListItem
          id={"motto"}
          key={"motto"}
          value={userProfile.motto}
          label={TEXT_MOTTO}
          icon={<LocalActivityIcon fontSize="small" />}
        />
      </List>
    </React.Fragment>
  );
});
PublicProfileList.displayName = "PublicProfileList";
/* ===================================================================
// ========================== Gefunden Schätze =======================
// =================================================================== */
interface AchievedRewardsListProps {
  userProfile: UserPublicProfile;
}
/**
 * Listenansicht der erreichten Belohnungen/Statistiken.
 *
 * @param userProfile - Das öffentliche Benutzerprofil mit Statistiken.
 */
export const AchievedRewardsList = React.memo(({
  userProfile,
}: AchievedRewardsListProps) => {
  return (
    <List>
      <FormListItem
        id={"noRecipesPublic"}
        key={"noRecipesPublic"}
        value={userProfile.stats.noRecipesPublic.toLocaleString("de-CH")}
        label={TEXT_RECIPES_CREATED_PUBLIC}
        icon={<FastfoodIcon fontSize="small" />}
      />
      {userProfile.stats.noRecipesPrivate > 0 && (
        <FormListItem
          id={"noRecipesPrivate"}
          key={"noRecipesPrivate"}
          value={userProfile.stats.noRecipesPrivate.toLocaleString("de-CH")}
          label={TEXT_RECIPES_CREATED_PRIVATE}
          icon={<FastfoodIcon fontSize="small" />}
        />
      )}
      <FormListItem
        id={"noRecipesVariants"}
        key={"noRecipesVariants"}
        value={userProfile.stats.noRecipesVariants.toLocaleString("de-CH")}
        label={TEXT_RECIPES_CREATED_VARIANTS}
        icon={<ContentCopyIcon fontSize="small" />}
      />
      <FormListItem
        id={"noEvents"}
        key={"noEvents"}
        value={userProfile.stats.noEvents.toLocaleString("de-CH")}
        label={TEXT_EVENTS_PARTICIPATED}
        icon={<TodayIcon fontSize="small" />}
      />
      <FormListItem
        id={"noComments"}
        key={"noComments"}
        value={userProfile.stats.noComments.toLocaleString("de-CH")}
        label={TEXT_COMMENTS_WRITTEN}
        icon={<CommentIcon fontSize="small" />}
      />
      <FormListItem
        id={"noRatings"}
        key={"noRatings"}
        value={userProfile.stats.noRatings.toLocaleString("de-CH")}
        label={TEXT_RATINGS_GIVEN}
        icon={<StarIcon fontSize="small" />}
      />
      {userProfile.stats?.noFoundBugs > 0 && (
        <FormListItem
          id={"noFoundBugs"}
          key={"noFoundBugs"}
          value={userProfile.stats.noFoundBugs.toLocaleString("de-CH")}
          label={TEXT_FOUND_BUGS}
          icon={<BugReportIcon fontSize="small" />}
        />
      )}
    </List>
  );
});
AchievedRewardsList.displayName = "AchievedRewardsList";

export {PublicProfilePage};
