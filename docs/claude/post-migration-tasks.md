# Post-Migration Tasks

Tasks to complete once the Firebase → Supabase migration is fully done.
Add new items here as they are discovered during migration work.

---

## Enum Cleanup — Replace numeric with string enum values

**Context:** During migration, Repository files contain lookup maps that convert between the numeric TypeScript enum values (from Firebase's JSON storage) and the Postgres ENUM strings in Supabase. These maps are migration debt and should be removed once the Firebase path is gone.

**Per-entity checklist:**

### `MaterialType` (`material.class.ts` / `MaterialRepository.ts`)

- [ ] Change TypeScript enum to string values:
  ```typescript
  export enum MaterialType {
    none = 'none',
    consumable = 'consumable',
    usage = 'usage',
  }
  ```
- [ ] Delete `MATERIAL_TYPE_TO_DB` and `MATERIAL_TYPE_FROM_DB` from `MaterialRepository.ts`
- [ ] Simplify `toRow()`: `type: domain.type` (direct pass-through)
- [ ] Simplify `toDomain()`: `type: row.type` (direct pass-through)
- [ ] Update `MaterialRow.type` from `string` to `MaterialType`
- [ ] Update `MaterialDomain.type` from `number` to `MaterialType`

### `Allergen` + `Diet` (`product.class.ts` / `ProductRepository.ts`)

- [ ] Change TypeScript enums to string values:
  ```typescript
  export enum Allergen { none = 'none', lactose = 'lactose', gluten = 'gluten' }
  export enum Diet    { meat = 'meat', vegetarian = 'vegetarian', vegan = 'vegan' }
  ```
  > Note: `Allergen.None` was a sentinel for "empty array". After this change,
  > filter by `a !== Allergen.none` (or just rely on the empty array being correct).
- [ ] Delete `ALLERGEN_TO_DB`, `ALLERGEN_FROM_DB`, `DIET_TO_DB`, `DIET_FROM_DB` from `ProductRepository.ts`
- [ ] Simplify `toRow()`: pass allergens and diet directly
- [ ] Simplify `toDomain()`: pass allergens and diet directly
- [ ] Update `ProductRow.allergens` from `string[]` to `Allergen[]`
- [ ] Update `ProductRow.diet` from `string` to `Diet`
- [ ] Update `ProductDomain.dietProperties` types accordingly

---

## Create `increment_field` DB function

**Context:** `BaseRepository.increment()` calls `rpc("increment_field", {...})` but no migration creates this function. Any code path calling `BaseRepository.increment()` will fail at runtime with "function not found".

- [ ] Create a new migration `supabase/migrations/<date>_create_increment_field.sql`
- [ ] Implement the function with an **allowlist guard** on `table_name` to prevent dynamic SQL abuse:
  ```sql
  CREATE OR REPLACE FUNCTION public.increment_field(
    table_name TEXT,
    row_id TEXT,
    field_name TEXT,
    amount INTEGER
  ) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    IF table_name NOT IN ('users', 'events', 'recipes' /*, add tables as needed */) THEN
      RAISE EXCEPTION 'increment_field: table not allowed: %', table_name;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET %I = %I + $1 WHERE id = $2',
      table_name, field_name, field_name
    ) USING amount, row_id;
  END;
  $$;
  GRANT EXECUTE ON FUNCTION public.increment_field(TEXT, TEXT, TEXT, INTEGER) TO authenticated;
  ```
- [ ] Extend the allowlist as new tables that use `increment()` are added

---

## Remove admin-client bypass from profile picture uploads

**Context:** `User.uploadPicture()` and `User.deletePicture()` in `user.class.ts` use
`database.admin?.storage.users ?? database.storage.users`, which bypasses Storage RLS.
The RLS policies in `20260303000007` scope writes to `users/{auth.uid()}.jpg`, but they
are not enforced while the admin client is used.

- [ ] Switch `User.uploadPicture()` and `User.deletePicture()` to `database.storage.users`
  (regular client, no admin bypass)
- [ ] Verify that the authenticated user has an active Supabase session when these methods
  are called (so `auth.uid()` resolves correctly in RLS)
- [ ] Remove `database.admin?.storage` fallback once the regular-client path is confirmed working

---

## Refactor recipe loading to use PostgREST embedded resources

**Context:** `recipe.tsx` and `recipe.edit.tsx` currently load a recipe via 4–5 separate parallel
Supabase queries (recipe header, ingredients, preparation steps, materials, and a full products
list to resolve ingredient product names). This works correctly but has two drawbacks:

1. **5 HTTP round trips** per recipe open — even in parallel, each is an independent PostgREST
   request through Kong.
2. **Awkward product-name workaround:** `Recipe.fromRepositoryData()` sets
   `ingredient.product.name = ""` because the ingredients table only stores `product_id`
   (a Postgres UUID). A separate `database.products.getAllProducts()` call is made just to
   populate names, which loads the entire products catalogue for every recipe view.

**Preferred solution: PostgREST embedded resources**

Supabase/PostgREST supports embedding related rows via foreign key relationships in a single
request. The query would look like:

```typescript
const {data, error} = await supabase
  .from("recipes")
  .select(`
    *,
    recipe_ingredients(
      *,
      products ( name )
    ),
    recipe_preparation_steps(*),
    recipe_materials(
      *,
      materials ( name )
    )
  `)
  .eq("id", recipeUid)
  .single();
```

PostgREST resolves the `products(name)` and `materials(name)` joins via the FK relationships
declared in the schema — no extra query needed. RLS is enforced on every underlying table as
normal.

The response shape will be:

```json
{
  "id": "...",
  "name": "Spaghetti Bolognese",
  "recipe_ingredients": [
    {
      "id": "...",
      "sort_order": 10,
      "pos_type": "ingredient",
      "product_id": "4e374b6a-...",
      "products": { "name": "Hackfleisch" },
      "quantity": 500,
      "unit": "g",
      "detail": "",
      "scaling_factor": 1
    }
  ],
  "recipe_preparation_steps": [ { "sort_order": 10, "step": "Zwiebeln andünsten", ... } ],
  "recipe_materials": [
    {
      "material_id": "...",
      "materials": { "name": "Bratpfanne" },
      "quantity": 1
    }
  ]
}
```

**Implementation steps:**

### 1. Add `RecipeRepository.getRecipeFull(id)` method

Add a new method to `RecipeRepository` that performs the embedded-resource query and returns a
typed result object (a new interface `RecipeFullRow` or similar). Keep `getRecipe()` as-is — it
is still used for recipe list enrichment and other narrow reads.

```typescript
/**
 * Lädt ein Rezept inklusive aller Kindtabellen (Zutaten, Zubereitungsschritte,
 * Materialpositionen) sowie Produkt- und Materialnamen per Embedded-Resource-Query.
 * Ersetzt die bisherigen 4–5 parallelen Einzelabfragen in recipe.tsx / recipe.edit.tsx.
 *
 * @param id - Postgres-UUID des Rezepts
 * @returns Das vollständige Rezept-Datenobjekt oder null
 */
async getRecipeFull(id: string): Promise<RecipeFullRow | null> { ... }
```

### 2. Add `RecipeFullRow` interface

Define the shape of the embedded response, mirroring the PostgREST output:

```typescript
export interface RecipeFullRow extends RecipeRow {
  recipe_ingredients: (RecipeIngredientRow & { products: { name: string } | null })[];
  recipe_preparation_steps: RecipePreparationStepRow[];
  recipe_materials: (RecipeMaterialRow & { materials: { name: string } | null })[];
}
```

### 3. Add `Recipe.fromFullRow(row: RecipeFullRow): Recipe` static method

Add a new factory method to `recipe.class.ts` (or extend `fromRepositoryData`) that accepts the
full embedded row and populates ingredient and material names directly:

```typescript
static fromFullRow(row: RecipeFullRow): Recipe {
  // Build header domain from row (reuse existing toDomain logic)
  // Build ingredient list: sort by sort_order, set product.name from row.products?.name
  // Build preparation step list
  // Build material list: set material.name from row.materials?.name
}
```

This eliminates `ingredient.product.name = ""` as a structural problem — names are always
available.

### 4. Update `recipe.tsx` and `recipe.edit.tsx`

Replace:
```typescript
Promise.all([
  database.recipes.getRecipe(recipeUid),
  database.recipeIngredients.getIngredientsForRecipe(recipeUid),
  database.recipePreparationSteps.getStepsForRecipe(recipeUid),
  database.recipeMaterials.getMaterialsForRecipe(recipeUid),
  database.products.getAllProducts(),   // ← only needed for name resolution
])
  .then(([header, ingredients, steps, materials, products]) => {
    const recipe = Recipe.fromRepositoryData(header, ingredients, steps, materials);
    // ... populate product names manually ...
  })
```

With:
```typescript
database.recipes
  .getRecipeFull(recipeUid)
  .then((row) => {
    if (!row) throw new Error(`Rezept ${recipeUid} nicht gefunden.`);
    const recipe = Recipe.fromFullRow(row);
    dispatch({ type: ReducerActions.RECIPE_FETCH_SUCCESS, payload: {recipe} });
  })
```

### 5. Remove workaround code

Once `fromFullRow` is in place, remove:
- The `database.products.getAllProducts()` call in `recipe.tsx`
- The product-name population loop in `recipe.tsx`
- The product-name population logic in the `PRODUCTS_FETCH_SUCCESS` reducer case
  in `recipe.edit.tsx` (that loop was only needed because names were `""`)

**Write path stays unchanged.** `saveAllForRecipe()` in `RecipeIngredientRepository`,
`RecipePreparationStepRepository`, and `RecipeMaterialRepository` continues to use the
individual repositories — the refactor only affects the read path.

**Files to change:**
| File | Change |
|------|--------|
| `src/components/Database/Repository/RecipeRepository.ts` | Add `RecipeFullRow`, `getRecipeFull()` |
| `src/components/Recipe/recipe.class.ts` | Add `Recipe.fromFullRow()` |
| `src/components/Recipe/recipe.tsx` | Replace Promise.all with `getRecipeFull()` |
| `src/components/Recipe/recipe.edit.tsx` | Replace Promise.all with `getRecipeFull()`; simplify `PRODUCTS_FETCH_SUCCESS` reducer |

---

## Further tasks

*(Add new items here as they are discovered during ongoing migration work.)*
