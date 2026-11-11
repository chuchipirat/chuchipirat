import {
  INTOLERANCES as DEFAULT_INTOLERANCES,
  DIETS as DEFAULT_DIETS,
} from "../../../constants/defaultValues";
import {ChangeRecord} from "../../Shared/global.interface";

interface GroupConfigObjectStructure<T> {
  entries: {[key: string]: T};
  order: string[];
}

export interface Diet {
  uid: string;
  name: string;
  totalPortions: number;
}

export interface Intolerance {
  uid: string;
  name: string;
  totalPortions: number;
}
interface DeleteIntoleranceProps {
  groupConfig: EventGroupConfiguration;
  intoleranceUidToDelete: Intolerance["uid"];
}
interface DeleteDietProps {
  groupConfig: EventGroupConfiguration;
  dietUidToDelete: Diet["uid"];
}
interface AddDietGroupProps {
  groupConfig: EventGroupConfiguration;
  dietGroupName: Diet["name"];
}
interface AddIntoleranceProps {
  groupConfig: EventGroupConfiguration;
  intoleranceName: Intolerance["name"];
}
interface CalculateTotals {
  groupConfig: EventGroupConfiguration;
}

interface IntolerancePortions {
  [key: Intolerance["uid"]]: number;
}
export interface Portions {
  [key: Diet["uid"]]: IntolerancePortions;
}

export class EventGroupConfiguration {
  uid: string;
  diets: GroupConfigObjectStructure<Diet>;
  intolerances: GroupConfigObjectStructure<Intolerance>;
  portions: Portions;
  totalPortions: number;
  created: ChangeRecord;
  lastChange: ChangeRecord;

  constructor() {
    this.uid = "";
    this.diets = {
      entries: {} as GroupConfigObjectStructure<Diet>["entries"],
      order: [],
    };
    this.intolerances = {
      entries: {} as GroupConfigObjectStructure<Intolerance>["entries"],
      order: [],
    };
    this.portions = {} as Portions;
    this.totalPortions = 0;
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
  }
  /**
   * Factory-Methode
   * erzeugt ein fix-fertigs Objekt vom Typ Group-Config
   * @returns Group-Config
   */
  static factory() {
    const groupConfig = new EventGroupConfiguration();

    DEFAULT_DIETS.forEach((diet) => {
      const dietUid = crypto.randomUUID();
      groupConfig.diets.entries[dietUid] = {
        uid: dietUid,
        name: diet,
        totalPortions: 0,
      };
      groupConfig.diets.order.push(dietUid);
    });

    DEFAULT_INTOLERANCES.forEach((intolerance) => {
      const intoleranceUid = crypto.randomUUID();
      groupConfig.intolerances.entries[intoleranceUid] = {
        uid: intoleranceUid,
        name: intolerance,
        totalPortions: 0,
      };
      groupConfig.intolerances.order.push(intoleranceUid);
    });
    // Portionen aufbauen
    groupConfig.diets.order.forEach((dietUid) => {
      const intolerancePortions = {} as IntolerancePortions;
      groupConfig.intolerances.order.forEach((intoleranceUid) => {
        intolerancePortions[intoleranceUid] = 0;
      });
      groupConfig.portions[dietUid] = intolerancePortions;
    });
    groupConfig.totalPortions = 0;

    return groupConfig;
  }
  /**
   * Fügt eine neue Unverträglichkeit mit 0 Portionen für alle Diäten hinzu.
   *
   * Die übergebene Konfiguration bleibt unverändert, weil sie in der Regel
   * der aktuelle React-State ist.
   *
   * @param props.groupConfig Bestehende Gruppenkonfiguration.
   * @param props.intoleranceName Name der neuen Unverträglichkeit.
   * @returns Neue Gruppenkonfiguration inklusive der Unverträglichkeit.
   * @example
   * const updated = EventGroupConfiguration.addIntolerance({groupConfig, intoleranceName: "Laktose"});
   */
  static addIntolerance({groupConfig, intoleranceName}: AddIntoleranceProps) {
    const updatedGroupConfig = structuredClone(groupConfig);
    const newIntolerance: Intolerance = {
      uid: crypto.randomUUID(),
      name: intoleranceName,
      totalPortions: 0,
    };
    updatedGroupConfig.intolerances.entries[newIntolerance.uid] = newIntolerance;
    updatedGroupConfig.intolerances.order.push(newIntolerance.uid);

    updatedGroupConfig.diets.order.forEach((dietUid) => {
      updatedGroupConfig.portions[dietUid][newIntolerance.uid] = 0;
    });

    return updatedGroupConfig;
  }
  /**
   * Entfernt eine Unverträglichkeit samt ihrer Portionen und berechnet die Totale neu.
   *
   * Die übergebene Konfiguration bleibt unverändert.
   *
   * @param props.groupConfig Bestehende Gruppenkonfiguration.
   * @param props.intoleranceUidToDelete UID der zu entfernenden Unverträglichkeit.
   * @returns Neue Gruppenkonfiguration ohne die Unverträglichkeit.
   * @example
   * const updated = EventGroupConfiguration.deleteIntolerance({groupConfig, intoleranceUidToDelete: "intol-1"});
   */
  static deleteIntolerance({
    groupConfig,
    intoleranceUidToDelete,
  }: DeleteIntoleranceProps) {
    const updatedGroupConfig = structuredClone(groupConfig);
    delete updatedGroupConfig.intolerances.entries[intoleranceUidToDelete];
    updatedGroupConfig.intolerances.order =
      updatedGroupConfig.intolerances.order.filter(
        (intoleranceUid) => intoleranceUid != intoleranceUidToDelete
      );

    Object.values(updatedGroupConfig.portions).forEach((intolerancePortions) => {
      delete intolerancePortions[intoleranceUidToDelete];
    });

    return EventGroupConfiguration.calculateTotals({
      groupConfig: updatedGroupConfig,
    });
  }
  /**
   * Fügt eine neue Diätgruppe mit 0 Portionen für alle Unverträglichkeiten hinzu.
   *
   * Die übergebene Konfiguration bleibt unverändert.
   *
   * @param props.groupConfig Bestehende Gruppenkonfiguration.
   * @param props.dietGroupName Name der neuen Diätgruppe.
   * @returns Neue Gruppenkonfiguration inklusive der Diätgruppe.
   * @example
   * const updated = EventGroupConfiguration.addDietGroup({groupConfig, dietGroupName: "Vegan"});
   */
  static addDietGroup({groupConfig, dietGroupName}: AddDietGroupProps) {
    const updatedGroupConfig = structuredClone(groupConfig);
    const newDiet: Diet = {
      uid: crypto.randomUUID(),
      name: dietGroupName,
      totalPortions: 0,
    };

    updatedGroupConfig.diets.entries[newDiet.uid] = newDiet;
    updatedGroupConfig.diets.order.push(newDiet.uid);

    const intolerancePortions = {} as IntolerancePortions;
    updatedGroupConfig.intolerances.order.forEach((intoleranceUid) => {
      intolerancePortions[intoleranceUid] = 0;
    });
    updatedGroupConfig.portions[newDiet.uid] = intolerancePortions;

    return updatedGroupConfig;
  }
  /**
   * Entfernt eine Diätgruppe samt ihrer Portionen und berechnet die Totale neu.
   *
   * Die übergebene Konfiguration bleibt unverändert.
   *
   * @param props.groupConfig Bestehende Gruppenkonfiguration.
   * @param props.dietUidToDelete UID der zu entfernenden Diätgruppe.
   * @returns Neue Gruppenkonfiguration ohne die Diätgruppe.
   * @example
   * const updated = EventGroupConfiguration.deleteDiet({groupConfig, dietUidToDelete: "diet-1"});
   */
  static deleteDiet({groupConfig, dietUidToDelete}: DeleteDietProps) {
    const updatedGroupConfig = structuredClone(groupConfig);
    delete updatedGroupConfig.diets.entries[dietUidToDelete];
    updatedGroupConfig.diets.order = updatedGroupConfig.diets.order.filter(
      (dietUid) => dietUid != dietUidToDelete
    );

    delete updatedGroupConfig.portions[dietUidToDelete];

    return EventGroupConfiguration.calculateTotals({
      groupConfig: updatedGroupConfig,
    });
  }
  /**
   * Berechnet die Totale pro Diät, pro Unverträglichkeit und gesamthaft neu.
   *
   * Die übergebene Konfiguration bleibt unverändert.
   *
   * @param props.groupConfig Gruppenkonfiguration mit aktueller Portionenmatrix.
   * @returns Neue Gruppenkonfiguration mit neu berechneten Totalen.
   * @example
   * const withTotals = EventGroupConfiguration.calculateTotals({groupConfig});
   */
  static calculateTotals({groupConfig}: CalculateTotals) {
    const updatedGroupConfig = structuredClone(groupConfig);
    updatedGroupConfig.totalPortions = 0;

    updatedGroupConfig.diets.order.forEach((dietUid) => {
      const dietTotal = Object.values(updatedGroupConfig.portions[dietUid]).reduce(
        (runningSum, portion) => runningSum + portion,
        0
      );
      updatedGroupConfig.diets.entries[dietUid].totalPortions = dietTotal;
      updatedGroupConfig.totalPortions += dietTotal;
    });

    updatedGroupConfig.intolerances.order.forEach((intoleranceUid) => {
      updatedGroupConfig.intolerances.entries[intoleranceUid].totalPortions =
        updatedGroupConfig.diets.order.reduce(
          (runningSum, dietUid) =>
            runningSum + updatedGroupConfig.portions[dietUid][intoleranceUid],
          0
        );
    });

    return updatedGroupConfig;
  }
}
