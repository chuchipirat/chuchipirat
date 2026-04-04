/**
 * Statistik-Felder für das öffentliche Benutzerprofil.
 * Entspricht den `stats.*`-Spalten in der users-Tabelle.
 */
export enum UserPublicProfileStatsFields {
  noComments = "noComments",
  noRatings = "noRatings",
  noEvents = "noEvents",
  noRecipesPublic = "noRecipesPublic",
  noRecipesPrivate = "noRecipesPrivate",
  noRecipesVariants = "noRecipesVariants",
  noFoundBugs = "noFoundBugs",
}
type Stats = {[key in UserPublicProfileStatsFields]: number};

/**
 * Öffentliches Benutzerprofil — für alle einsehbare Daten eines Users.
 *
 * Enthält Anzeigename, Motto, Profilbild und Statistiken.
 * Wird u.a. auf der öffentlichen Profilseite und in der Admin-Übersicht verwendet.
 *
 * @example
 * const profile = new UserPublicProfile();
 * profile.displayName = "ScoutMaster";
 */
export class UserPublicProfile {
  uid: string;
  displayName: string;
  memberSince: Date;
  memberId: number;
  motto: string;
  pictureSrc: string;
  stats: Stats;
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
      noRatings: 0,
      noEvents: 0,
      noRecipesPublic: 0,
      noRecipesPrivate: 0,
      noRecipesVariants: 0,
      noFoundBugs: 0,
    };
  }
}
