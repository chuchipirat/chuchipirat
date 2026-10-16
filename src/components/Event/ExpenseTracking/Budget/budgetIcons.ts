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
} from "@mui/icons-material";

import {BudgetIcon} from "./budget.types";

/**
 * Ordnet jedem {@link BudgetIcon} die passende MUI-Icon-Komponente zu.
 * Als `Record` typisiert, damit der Compiler eine fehlende Zuordnung meldet,
 * sobald dem Enum (und der DB) ein neues Icon hinzugefügt wird.
 */
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
