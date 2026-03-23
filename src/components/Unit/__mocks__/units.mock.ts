import {Unit, UnitDimension} from "../unit.class";

export const units: Unit[] = [
  {key: "Blatt", name: "Blatt", dimension: UnitDimension.dimensionless},
  {key: "Bund", name: "Bund", dimension: UnitDimension.dimensionless},
  {key: "dl", name: "Deziliter", dimension: UnitDimension.volume},
  {key: "EL", name: "Esslöffer", dimension: UnitDimension.volume},
  {key: "g", name: "Gramm", dimension: UnitDimension.mass},
  {key: "kg", name: "Kilogramm", dimension: UnitDimension.mass},
  {key: "l", name: "Liter", dimension: UnitDimension.volume},
  {key: "ml", name: "Milliliter", dimension: UnitDimension.volume},
  {key: "TL", name: "Teelöffel", dimension: UnitDimension.volume},
  {key: "Würfel", name: "Würfel", dimension: UnitDimension.dimensionless},
  {key: "cl", name: "Zentiliter", dimension: UnitDimension.volume},
];

export default units;
