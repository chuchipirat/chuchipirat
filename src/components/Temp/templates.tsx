import React from "react";
// Navigation Context

import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/navigationContext";
import Action from "../../constants/actions";

const navigationValuesContext = React.useContext(NavigationValuesContext);

/* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
React.useEffect(() => {
  navigationValuesContext?.setNavigationValues({
    action: Action.NONE,
    object: NavigationObject.usedRecipes,
  });
}, []);
