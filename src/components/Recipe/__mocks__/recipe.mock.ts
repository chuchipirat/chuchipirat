import {Diet} from "../../Product/product.class";
import Recipe, {PositionType, RecipeType} from "../recipe.class";

export const recipe: Recipe = {
  uid: "HWEvHBnRM56GDapkWtsd",
  name: "Test Rezept",
  portions: 4,
  source: "https://jestjs.io",
  times: {
    preparation: 20,
    rest: 10,
    cooking: 0,
  },
  pictureSrc: "https://jestjs.io/img/opengraph.png",
  created: {
    date: new Date(),
    fromUid: "adminUID",
    fromDisplayName: "Jest Test",
  },
  note: "nichts besonderes",
  tags: ["klassiker", "testfall"],
  type: RecipeType.public,
  linkedRecipes: [],
  ingredients: {
    entries: {
      abc: {
        uid: "abc",
        product: {uid: "okt0", name: "Oktopus"},
        posType: PositionType.ingredient,
        quantity: 42,
        unit: "",
        detail: "Bitte Bio",
        scalingFactor: 1,
      },
      def: {
        uid: "def",
        posType: PositionType.ingredient,
        product: {uid: "mozza", name: "Mozzarella"},
        quantity: 120,
        unit: "g",
        detail: "",
        scalingFactor: 1,
      },
      ghi: {
        uid: "ghi",
        posType: PositionType.ingredient,
        product: {uid: "n0r!", name: "Nori"},
        quantity: 2,
        unit: "",
        detail: "",
        scalingFactor: 0.5,
      },
      jkl: {
        uid: "jkl",
        posType: PositionType.ingredient,
        product: {uid: "g1ng3", name: "Ingwer"},
        quantity: 100,
        unit: "g",
        detail: "eingelegt",
        scalingFactor: 2.5,
      },
      mno: {
        uid: "mno",
        posType: PositionType.ingredient,
        product: {uid: "soys0ce", name: "Sojasauce"},
        quantity: 3,
        unit: "EL",
        detail: "",
        scalingFactor: 1,
      },
      pqr: {
        uid: "pqr",
        posType: PositionType.ingredient,
        product: {uid: "t4hini", name: "Tahini"},
        quantity: 2,
        unit: "EL",
        detail: "",
        scalingFactor: 1,
      },
      stu: {
        uid: "stu",
        posType: PositionType.ingredient,
        product: {uid: "h0n3y", name: "Honig"},
        quantity: 3,
        unit: "TL",
        detail: "",
        scalingFactor: 1,
      },
      xyz: {
        uid: "xyz",
        posType: PositionType.ingredient,
        product: {uid: "", name: ""},
        quantity: 0,
        unit: "",
        detail: "",
        scalingFactor: 1,
      },
    },
    order: ["abc", "def", "ghi", "jkl", "mno", "pqr", "stu", "xyz"],
  },

  preparationSteps: {
    entries: {
      abcdef: {
        uid: "abcdef",
        posType: PositionType.preparationStep,
        step: "Schneiden",
      },
      ghijkl: {uid: "ghijkl", posType: PositionType.preparationStep, step: ""},
      mnopqr: {
        uid: "mnopqr",
        posType: PositionType.preparationStep,
        step: "Hacken",
      },
      stuvwx: {
        uid: "stuvwx",
        posType: PositionType.preparationStep,
        step: "rösten",
      },
      z: {
        uid: "z",
        posType: PositionType.preparationStep,
        step: "",
      },
    },
    order: ["abcdef", "ghijkl", "mnopqr", "stuvwx", "z"],
  },
  materials: {
    entries: {
      xxx: {
        uid: "xxx",
        material: {name: "Schwingbesen", uid: "öjökasdölfkj"},
        quantity: 1,
      },
      yyy: {
        uid: "yyy",
        material: {name: "Wallholz", uid: "qwerad"},
        quantity: 0,
      },
      zzz: {
        uid: "zzz",
        material: {name: "", uid: ""},
        quantity: 0,
      },
    },
    order: ["xxx", "yyy", "zzz"],
  },
  dietProperties: {allergens: [], diet: Diet.Meat},
  menuTypes: [],
  outdoorKitchenSuitable: false,
  usable: true,
  rating: {avgRating: 5, noRatings: 1, myRating: 0},
  usedProducts: [],
  lastChange: {
    date: new Date(0),
    fromDisplayName: "string",
    fromUid: "string",
  },
};

export default recipe;
