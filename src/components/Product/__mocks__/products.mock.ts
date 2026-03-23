import {Product, Allergen, Diet} from "../product.types";

export const products: Product[] = [
  {
    uid: "okt0",
    name: "Oktopus",
    department: {uid: "tk", name: "Tiefkühl"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: Diet.Meat},
    usable: true,
  },
  {
    uid: "mozza",
    name: "Mozzarella",
    department: {uid: "molk", name: "Molkerei"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [Allergen.Lactose], diet: Diet.Vegetarian},
    usable: true,
  },
  {
    uid: "n0r!",
    name: "Nori",
    department: {uid: "arigato", name: "Fremdländische Spezialitäten"},
    shoppingUnit: "g",
    dietProperties: {allergens: [], diet: Diet.Vegan},
    usable: true,
  },
  {
    uid: "g1ng3",
    name: "Ingwer",
    department: {uid: "vegetable", name: "Gemüse"},
    shoppingUnit: "g",
    dietProperties: {allergens: [], diet: Diet.Vegan},
    usable: true,
  },
  {
    uid: "soys0ce",
    name: "Sojasauce",
    department: {uid: "orient", name: "Fremdländische Spezialitäten"},
    shoppingUnit: "l",
    dietProperties: {allergens: [Allergen.Gluten], diet: Diet.Vegan},
    usable: true,
  },
  {
    uid: "t4hini",
    name: "Tahini",
    department: {uid: "convenience", name: "Convenience"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: Diet.Vegan},
    usable: true,
  },
  {
    uid: "h0n3y",
    name: "Honig",
    department: {uid: "breakfast", name: "Frühstück"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: Diet.Vegetarian},
    usable: true,
  },
];
export default products;
