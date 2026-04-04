import Firebase from "../firebase.class";
import FirebaseDbCloudFunction from "./firebase.db.cloudfunction.class";

import FirebaseDbEvent from "./firebase.db.event.class";
import FirebaseDbRecipe from "./firebase.db.recipe.class";
import FirebaseDbStatsCounter from "./firebase.db.stats.counter.class";
import FirebaseDbUser from "./firebase.db.user.class";
export class FirebaseDb {
  event: FirebaseDbEvent;
  recipe: FirebaseDbRecipe;
  user: FirebaseDbUser;
  stats: FirebaseDbStatsCounter;
  cloudFunction: FirebaseDbCloudFunction;

  // recipe:FirebaseRecipe
  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    this.recipe = new FirebaseDbRecipe(firebase);
    //RECIPESHORT
    this.event = new FirebaseDbEvent(firebase);
    this.user = new FirebaseDbUser(firebase);
    this.stats = new FirebaseDbStatsCounter(firebase);
    this.cloudFunction = new FirebaseDbCloudFunction(firebase);
  }
}
export default FirebaseDb;
