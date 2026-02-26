import Firebase from "../Firebase/firebase.class";

interface IncrementField {
  firebase: Firebase;
  uid: string;
  field: UserPublicProfileStatsFields;
  step: number;
}

export enum UserPublicProfileStatsFields {
  // noRecipes = "noRecipes",
  noComments = "noComments",
  noEvents = "noEvents",
  noRecipesPublic = "noRecipesPublic",
  noRecipesPrivate = "noRecipesPrivate",
  noFoundBugs = "noFoundBugs",
}
type Stats = {[key in UserPublicProfileStatsFields]: number};

/**
 * Öffentliches Profile, wie von jedem*r einsehbar
 */
export class UserPublicProfile {
  uid: string;
  displayName: string;
  memberSince: Date;
  memberId: number;
  motto: string;
  pictureSrc: string;
  stats: Stats;
  // noComments: number;
  // noEvents: number;
  // noRecipes: number;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.displayName = "";
    this.memberSince = new Date(0);
    this.memberId = 0;
    this.motto = "";
    this.pictureSrc = "";
    this.stats = {
      noComments: 0,
      noEvents: 0,
      noRecipesPublic: 0,
      noRecipesPrivate: 0,
      noFoundBugs: 0,
    };
  }
  /* =====================================================================
  // Zähler für öffentliches Profil hochzählen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static incrementField = async ({
    firebase,
    uid,
    field,
    step,
  }: IncrementField) => {
    // TEST ME!
    firebase.user.public.profile.incrementField({
      uids: [uid],
      field: `stats.${field}`,
      value: step,
    });
  };
}

export default UserPublicProfile;
