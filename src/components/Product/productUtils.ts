/**
 * Hilfsfunktionen fuer Produkte (reine Business-Logik ohne UI/DB-Abhaengigkeit).
 */
import {Utils} from "../Shared/utils.class";
import {Product} from "./product.types";

/**
 * Parameter fuer die Suche nach aehnlichen Produkten.
 *
 * @param productName - Name des neuen Produkts.
 * @param existingProducts - Liste aller bestehenden Produkte.
 */
interface FindSimilarProductsArgs {
  productName: Product["name"];
  existingProducts: Product[];
}

/**
 * Produkte finden, mit dem aehnlichen Namen — die Liste mit aehnlichen
 * Namen soll helfen, dass nicht gleiche Produkte erfasst werden.
 *
 * @param args - Objekt mit Namen des Produktes und der Liste aller Produkte.
 * @returns Array mit Produkten, die aehnlich sind, sortiert nach absteigender Aehnlichkeit.
 * @example
 * findSimilarProducts({productName: "Tomatem", existingProducts: products});
 */
export function findSimilarProducts({
  productName,
  existingProducts,
}: FindSimilarProductsArgs): Product[] {
  const threshold = 0.8;
  // Woerter, die ausgeschlossen werden sollen
  const excludedWords = ["glutenfrei", "laktosefrei", "aha"];

  const similarProducts: {product: Product; similarity: number}[] = [];

  let newProductWords = productName.toLowerCase().split(" ");
  newProductWords = newProductWords.filter(
    (word) => !excludedWords.includes(word),
  );

  for (const product of existingProducts) {
    const productWords = product.name.toLowerCase().split(" ");

    // Berechne die durchschnittliche Aehnlichkeit der einzelnen Woerter
    const wordSimilaritySum = newProductWords.reduce((sum, word) => {
      word.replace(",", "");

      if (excludedWords.includes(word)) {
        return sum;
      }

      const wordSimilarities = productWords.map((productWord) =>
        Utils.jaccardIndex(word, productWord),
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

  // Sortieren der aehnlichen Produkte nach absteigender Aehnlichkeit
  similarProducts.sort((sortA, sortB) => sortB.similarity - sortA.similarity);
  return similarProducts.map((entry) => entry.product);
}
