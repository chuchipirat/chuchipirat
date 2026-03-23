import {DepartmentDomain} from "../../Database/Repository/DepartmentRepository";

export const departments: DepartmentDomain[] = [
  {uid: "vegetable", name: "Gemüse", pos: 2, usable: true},
  {uid: "molk", name: "Molkerei", pos: 4, usable: true},
  {uid: "convenience", name: "Convenience", pos: 5, usable: true},
  {uid: "breakfast", name: "Frühstück", pos: 14, usable: true},
  {uid: "tk", name: "Tiefkühl", pos: 19, usable: true},
  {uid: "orient", name: "Fremdländische Spezialitäten", pos: 20, usable: true},
];
