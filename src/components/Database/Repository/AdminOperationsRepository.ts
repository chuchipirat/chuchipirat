/**
 * AdminOperationsRepository — Repository für administrative Datenoperationen.
 *
 * Kapselt die Postgres-RPC-Aufrufe für Zusammenführen (Merge),
 * Konvertierung und Verwendungsnachweis (Where-Used) von Produkten
 * und Materialien.
 *
 * @example
 * const result = await adminOps.mergeProducts("source-id", "target-id");
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";
import {SimilarProductPair} from "./ProductRepository";

/* ===================================================================
// ======================== Ergebnis-Typen ===========================
// =================================================================== */

/**
 * Ergebnis einer Produkt-Zusammenführung.
 *
 * @param recipe_ingredients Anzahl aktualisierter Rezeptzutaten.
 * @param shopping_list_items Anzahl aktualisierter Einkaufslisteneinträge.
 * @param menue_products Anzahl aktualisierter Menüplan-Produkte.
 * @param unit_conversions Anzahl aktualisierter Einheitenumrechnungen.
 */
export type MergeProductsResult = {
  recipe_ingredients: number;
  shopping_list_items: number;
  menue_products: number;
  unit_conversions: number;
};

/**
 * Ergebnis einer Material-Zusammenführung.
 *
 * @param recipe_materials Anzahl aktualisierter Rezeptmaterialien.
 * @param material_list_items Anzahl aktualisierter Materiallisten-Einträge.
 * @param menue_materials Anzahl aktualisierter Menüplan-Materialien.
 * @param shopping_list_items Anzahl aktualisierter Einkaufslisteneinträge.
 */
export type MergeMaterialsResult = {
  recipe_materials: number;
  material_list_items: number;
  menue_materials: number;
  shopping_list_items: number;
};

/**
 * Ergebnis einer Produkt-zu-Material-Konvertierung.
 *
 * @param new_material_id ID des neu erstellten Materials.
 * @param recipe_ingredients Anzahl verschobener Rezeptzutaten.
 * @param shopping_list_items Anzahl aktualisierter Einkaufslisteneinträge.
 * @param menue_items Anzahl verschobener Menüplan-Einträge.
 */
export type ConvertProductToMaterialResult = {
  new_material_id: string;
  recipe_ingredients: number;
  shopping_list_items: number;
  menue_items: number;
};

/**
 * Ergebnis einer Material-zu-Produkt-Konvertierung.
 *
 * @param new_product_id ID des neu erstellten Produkts.
 * @param recipe_materials Anzahl verschobener Rezeptmaterialien.
 * @param material_list_items Anzahl aktualisierter Materiallisten-Einträge.
 * @param shopping_list_items Anzahl aktualisierter Einkaufslisteneinträge.
 * @param menue_items Anzahl verschobener Menüplan-Einträge.
 */
export type ConvertMaterialToProductResult = {
  new_product_id: string;
  recipe_materials: number;
  material_list_items: number;
  shopping_list_items: number;
  menue_items: number;
};

/**
 * Einzelner Fundstelleneintrag des Verwendungsnachweises.
 *
 * @param table_name Name der Tabelle, in der die Referenz gefunden wurde.
 * @param column_name Name der Spalte mit der Referenz.
 * @param record_id ID des betroffenen Datensatzes (Junction-Zeile).
 * @param parent_id ID der übergeordneten Entität (Rezept-ID oder Event-ID) für Navigation.
 * @param parent_type Typ der übergeordneten Entität ('recipe', 'event', 'product').
 * @param context Beschreibender Kontext (z.B. Rezeptname, Eventname).
 */
export type WhereUsedEntry = {
  table_name: string;
  column_name: string;
  record_id: string;
  parent_id: string;
  parent_type: "recipe" | "event" | "product";
  context: string;
  /** ID der Einkaufsliste — nur bei `event_shopping_list_items`-Einträgen vorhanden. */
  list_id?: string;
};

/* ===================================================================
// ======================== Repository ===============================
// =================================================================== */

/**
 * Repository für administrative Datenoperationen (Merge, Convert, Where-Used).
 *
 * Alle Methoden rufen Postgres-RPC-Funktionen auf, die in einer
 * Transaktion laufen und atomare Konsistenz sicherstellen.
 */
export class AdminOperationsRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Führt zwei Produkte zusammen: Alle Referenzen vom Quellprodukt
   * werden auf das Zielprodukt aktualisiert, das Quellprodukt wird gelöscht.
   *
   * @param sourceProductId ID des Produkts, das ersetzt werden soll.
   * @param targetProductId ID des Produkts, das bestehen bleibt.
   * @returns Anzahl betroffener Zeilen pro Tabelle.
   * @throws {Error} Wenn das RPC fehlschlägt.
   */
  async mergeProducts(
    sourceProductId: string,
    targetProductId: string
  ): Promise<MergeProductsResult> {
    const {data, error} = await this.client.rpc("merge_products", {
      source_product_id: sourceProductId,
      target_product_id: targetProductId,
    });
    if (error) throw new Error(error.message);
    return data as MergeProductsResult;
  }

  /**
   * Führt zwei Materialien zusammen: Alle Referenzen vom Quellmaterial
   * werden auf das Zielmaterial aktualisiert, das Quellmaterial wird gelöscht.
   *
   * @param sourceMaterialId ID des Materials, das ersetzt werden soll.
   * @param targetMaterialId ID des Materials, das bestehen bleibt.
   * @returns Anzahl betroffener Zeilen pro Tabelle.
   * @throws {Error} Wenn das RPC fehlschlägt.
   */
  async mergeMaterials(
    sourceMaterialId: string,
    targetMaterialId: string
  ): Promise<MergeMaterialsResult> {
    const {data, error} = await this.client.rpc("merge_materials", {
      source_material_id: sourceMaterialId,
      target_material_id: targetMaterialId,
    });
    if (error) throw new Error(error.message);
    return data as MergeMaterialsResult;
  }

  /**
   * Konvertiert ein Produkt in ein Material: Erstellt ein neues Material,
   * verschiebt alle Referenzen und löscht das Produkt.
   *
   * @param productId ID des zu konvertierenden Produkts.
   * @param materialType Typ des neuen Materials (consumable, usage).
   * @returns Neue Material-ID und Anzahl betroffener Zeilen.
   * @throws {Error} Wenn das RPC fehlschlägt.
   */
  async convertProductToMaterial(
    productId: string,
    materialType: string = "consumable"
  ): Promise<ConvertProductToMaterialResult> {
    const {data, error} = await this.client.rpc("convert_product_to_material", {
      product_id_param: productId,
      material_type_param: materialType,
    });
    if (error) throw new Error(error.message);
    return data as ConvertProductToMaterialResult;
  }

  /**
   * Konvertiert ein Material in ein Produkt: Erstellt ein neues Produkt,
   * verschiebt alle Referenzen und löscht das Material.
   *
   * @param materialId ID des zu konvertierenden Materials.
   * @param departmentId Abteilung für das neue Produkt.
   * @param shoppingUnit Einkaufseinheit für das neue Produkt.
   * @returns Neue Produkt-ID und Anzahl betroffener Zeilen.
   * @throws {Error} Wenn das RPC fehlschlägt.
   */
  async convertMaterialToProduct(
    materialId: string,
    departmentId?: string,
    shoppingUnit?: string
  ): Promise<ConvertMaterialToProductResult> {
    const {data, error} = await this.client.rpc("convert_material_to_product", {
      material_id_param: materialId,
      department_id_param: departmentId ?? null,
      shopping_unit_param: shoppingUnit ?? null,
    });
    if (error) throw new Error(error.message);
    return data as ConvertMaterialToProductResult;
  }

  /**
   * Ermittelt alle Stellen, an denen ein Produkt, Material oder Rezept
   * referenziert wird.
   *
   * @param itemId ID des gesuchten Elements.
   * @param itemType Typ des Elements: 'product', 'material' oder 'recipe'.
   * @returns Array mit Fundstelleneinträgen.
   * @throws {Error} Wenn das RPC fehlschlägt.
   */
  /**
   * Sucht ähnliche Produkte mittels pg_trgm und Synonym-Tabelle.
   *
   * @param threshold - Minimaler Ähnlichkeitswert (0..1, Standard: 0.3)
   * @returns Array ähnlicher Produktpaare
   */
  async findSimilarProducts(
    threshold: number = 0.3,
  ): Promise<SimilarProductPair[]> {
    const {data, error} = await this.client.rpc("find_similar_products", {
      similarity_threshold: threshold,
    });
    if (error) throw new Error(error.message);
    return (data as SimilarProductPair[]) ?? [];
  }

  /**
   * Markiert ein Duplikat-Paar als bestätigt (kein echtes Duplikat).
   * Das Paar wird bei zukünftigen Suchen nicht mehr angezeigt.
   * Die IDs werden normalisiert (LEAST/GREATEST), damit die Reihenfolge egal ist.
   *
   * @param productIdA ID des ersten Produkts.
   * @param productIdB ID des zweiten Produkts.
   */
  async dismissDuplicatePair(
    productIdA: string,
    productIdB: string,
  ): Promise<void> {
    // Normalisieren: kleinere ID zuerst (CHECK-Constraint in DB)
    const normalizedA = productIdA < productIdB ? productIdA : productIdB;
    const normalizedB = productIdA < productIdB ? productIdB : productIdA;

    const {error} = await this.client
      .from("product_duplicate_dismissals")
      .upsert(
        {product_a_id: normalizedA, product_b_id: normalizedB},
        {onConflict: "product_a_id,product_b_id"},
      );
    if (error) throw new Error(error.message);
  }

  /**
   * Hebt die Bestätigung eines Duplikat-Paars auf.
   * Das Paar wird bei zukünftigen Suchen wieder angezeigt.
   *
   * @param productIdA ID des ersten Produkts.
   * @param productIdB ID des zweiten Produkts.
   */
  async undismissDuplicatePair(
    productIdA: string,
    productIdB: string,
  ): Promise<void> {
    const normalizedA = productIdA < productIdB ? productIdA : productIdB;
    const normalizedB = productIdA < productIdB ? productIdB : productIdA;

    const {error} = await this.client
      .from("product_duplicate_dismissals")
      .delete()
      .eq("product_a_id", normalizedA)
      .eq("product_b_id", normalizedB);
    if (error) throw new Error(error.message);
  }

  async whereUsed(
    itemId: string,
    itemType: "product" | "material" | "recipe"
  ): Promise<WhereUsedEntry[]> {
    const {data, error} = await this.client.rpc("where_used", {
      item_id: itemId,
      item_type: itemType,
    });
    if (error) throw new Error(error.message);
    return (data as WhereUsedEntry[]) ?? [];
  }
}
