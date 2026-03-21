import Utils from "../Shared/utils.class";
import Stats, {StatsField} from "../Shared/stats.class";
import Department from "../Department/department.class";
import Unit from "../Unit/unit.class";
import Firebase from "../Firebase/firebase.class";
import AuthUser from "../Firebase/Authentication/authUser.class";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";
import {logEvent} from "firebase/analytics";

interface GetAllProducts {
  firebase: Firebase;
  onlyUsable?: boolean;
  withDepartmentName?: boolean;
}

interface CreateProduct {
  firebase: Firebase;
  name: string;
  departmentUid: string;
  shoppingUnit: string;
  authUser: AuthUser;
  dietProperties: DietProperties;
}
interface SaveAllProducts {
  firebase: Firebase;
  products: Product[];
  authUser: AuthUser;
}

interface FindSimilarProducts {
  productName: Product["name"];
  existingProducts: Product[];
}

// ATTENTION:
// wird dies erweitert, muss auch im Cloud-Function File index
// die Beschreibung angepasst werden. Sonst funktioniert der
// Feed-Recap-Newsletter nicht.
export enum Allergen {
  None,
  Lactose = 1,
  Gluten,
}

export enum Diet {
  Meat = 1,
  Vegetarian,
  Vegan,
}

export interface DietProperties {
  allergens: Allergen[];
  diet: Diet;
}

type ProductDepartment = {
  uid: Department["uid"];
  name: Department["name"];
};

export default class Product {
  // HINT: Änderungen müssen auch im Cloud-FX-Type nachgeführt werden
  uid: string;
  name: string;
  department: ProductDepartment;
  departmentUid?: Department["uid"];
  // department: ProductDepartment;
  shoppingUnit: Unit["key"];
  dietProperties: DietProperties;
  usable: boolean;

  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.name = "";
    this.department = {uid: "", name: ""};
    this.shoppingUnit = "";
    this.dietProperties = Product.createEmptyDietProperty();
    this.usable = false;
  }
  /* =====================================================================
  // Leere Diät-Eigenschaft
  // ===================================================================== */
  static createEmptyDietProperty() {
    return {
      allergens: [] as Allergen[],
      diet: Diet.Meat,
    };
  }
  // =====================================================================
  /**
   * Alle Produkte aus der DB holen -->
   * Möglichkeit mit onlyUsable die nicht nutzbaren Produkte
   * auszufiltern.
   * @param Objekt nach Interface GetAllProducts
   * @returns Liste der Produkte
   */
  static async getAllProducts({
    firebase,
    onlyUsable,
    withDepartmentName,
  }: GetAllProducts) {
    let products: Product[] = [];
    let departments: Department[] = [];
    let department: ProductDepartment = {uid: "", name: ""};

    if (withDepartmentName) {
      await Department.getAllDepartments({firebase: firebase})
        .then((result) => {
          departments = result;
        })
        .catch((error) => {
          throw error;
        });
    }

    // Produkte holen
    await firebase.masterdata.products
      .read<ValueObject>({uids: []})
      .then((result) => {
        Object.entries(result).forEach(([key, value]) => {
          if (onlyUsable === true && value.usable === false) {
            // Nächster Datensatz
            return;
          }
          // Department dazulesen....
          department = {uid: value.departmentUid, name: ""};
          if (withDepartmentName) {
            const lookUpDepartment = departments.find(
              (department) => department.uid === value.departmentUid
            );

            if (lookUpDepartment !== undefined) {
              department.name = lookUpDepartment.name;
            }
          }

          let dietProperties = {} as DietProperties;

          if (value.dietProperties) {
            dietProperties = value.dietProperties;
            if (!value.dietProperties?.allergens) {
              dietProperties.allergens = [];
            }
            if (!dietProperties.diet) {
              dietProperties.diet = Diet.Meat;
            }
          } else {
            dietProperties = Product.createEmptyDietProperty();
          }

          products.push({
            uid: key,
            name: value.name,
            department: department,
            shoppingUnit: value.shoppingUnit,
            dietProperties: dietProperties,
            usable: value.usable,
          });
        });
        products = Utils.sortArray({array: products, attributeName: "name"});
      })
      .catch((error) => {
        throw error;
      });
    return products;
  }
  /* =====================================================================
  // Produkt anlegen
  // ===================================================================== */
  static createProduct = async ({
    firebase,
    name,
    departmentUid,
    shoppingUnit,
    dietProperties,
    authUser,
  }: CreateProduct) => {
    const product = new Product();
    const department = new Department();

    department.uid = departmentUid;

    product.uid = crypto.randomUUID();
    product.name = name.trim();
    product.department = department;
    product.shoppingUnit = shoppingUnit ? shoppingUnit : "";
    product.dietProperties = dietProperties;
    product.usable = true;

    // Dokument updaten mit neuem Produkt
    firebase.masterdata.products.update<Array<Product>>({
      uids: [""], // Wird in der Klasse bestimmt
      value: [product],
      authUser: authUser,
    });

    // Event auslösen
    logEvent(firebase.analytics, FirebaseAnalyticEvent.ingredientCreated);

    // Statistik
    Stats.incrementStat({
      firebase: firebase,
      field: StatsField.noIngredients,
      value: 1,
    });

    return product;
  };
  /* =====================================================================
  // Produkt anlegen
  // ===================================================================== */
  static saveAllProducts = async ({
    firebase,
    products,
    authUser,
  }: SaveAllProducts) => {
    // Dokument updaten mit neuem Produkt
    await firebase.masterdata.products.set<Array<Product>>({
      uids: [""], // Wird in der Klasse bestimmt
      value: products,
      authUser: authUser,
    });

    return products;
  };
  // =====================================================================
  /**
   * Produkte finden, mit dem ähnlichen Namen - die Liste mit ähnlichen
   * Namen soll helfen, dass nicht gleiche Produkte erfasst werden
   * @param Objekt mit Namen des Produktes und der Liste aller Produkte
   * @returns Array mit Produkten, die ähnlich sind
   */
  static findSimilarProducts = ({
    productName,
    existingProducts,
  }: FindSimilarProducts) => {
    const threshold = 0.8;
    const excludedWords = ["glutenfrei", "laktosefrei", "aha"]; // Wörter, die ausgeschlossen werden sollen

    const similarProducts: {product: Product; similarity: number}[] = [];

    let newProductWords = productName.toLowerCase().split(" ");
    newProductWords = newProductWords.filter(
      (word) => !excludedWords.includes(word)
    );

    for (const product of existingProducts) {
      const productWords = product.name.toLowerCase().split(" ");

      // Berechne die durchschnittliche Ähnlichkeit der einzelnen Wörter
      const wordSimilaritySum = newProductWords.reduce((sum, word) => {
        word.replace(",", "");

        if (excludedWords.includes(word)) {
          return sum;
        }

        const wordSimilarities = productWords.map((productWord) =>
          Utils.jaccardIndex(word, productWord)
        );
        const maxSimilarity = Math.max(...wordSimilarities);
        return sum + maxSimilarity;
      }, 0);

      const averageWordSimilarity = wordSimilaritySum / newProductWords.length;
      if (averageWordSimilarity >= threshold) {
        similarProducts.push({
          product: product,
          similarity: averageWordSimilarity,
        });
      }
    }

    // Sortieren der ähnlichen Produkte nach absteigender Ähnlichkeit
    similarProducts.sort((a, b) => b.similarity - a.similarity);
    return similarProducts.map((entry) => entry.product);
  };
}
