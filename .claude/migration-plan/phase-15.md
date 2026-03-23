## Phase 15: Firebase Cloud Functions Audit & Migration

### Context

All core data (users, recipes, products, materials, events, feeds, requests) is already in Supabase/Postgres with proper relational design. Firebase Cloud Functions were originally needed to propagate denormalized data across Firestore documents (e.g., when a product name changes, update it in every recipe, menuplan, and shopping list that references it). In Postgres, this is handled by FKs + JOINs — no denormalization needed.

**Goal:** Determine which Cloud Functions are obsolete (Postgres handles it), which need an Edge Function replacement, and which are dead code to delete.

---

### Audit Results

#### Already Obsolete (Postgres handles it natively)

These Cloud Functions exist solely to cascade denormalized data across Firestore documents. In Supabase, names are resolved via JOINs/views — no cascading needed.

| Function                      | Why obsolete                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateProduct`               | `recipe_ingredients.product_id` is a FK — name resolved via JOIN. No denormalized name to cascade.                                                               |
| `updateMaterial`              | `recipe_materials.material_id` is a FK — same reasoning.                                                                                                         |
| `updateRecipe`                | `event_menue_recipes.recipe_id` is a FK — recipe name resolved at query time.                                                                                    |
| `updateUserDisplayName`       | `event_cooks.user_id` is a FK — display name resolved via `get_event_cook_profiles()` or views. No denormalized copy anywhere.                                   |
| `updateUserPictureSrc`        | Same — picture resolved via JOIN, not stored denormally.                                                                                                         |
| `updateUserMotto`             | Same — motto resolved via JOIN.                                                                                                                                  |
| `createUserPublicData`        | Already replaced by `User.createUser()` which writes directly to Postgres. The method `createUserPublicData()` is never called from any UI component. Dead code. |
| `mergeProducts`               | Already replaced by `merge_products()` RPC function in Postgres.                                                                                                 |
| `mergeMaterials`              | Already replaced by `merge_materials()` RPC function in Postgres.                                                                                                |
| `convertProductToMaterial`    | Already replaced by `convert_product_to_material()` RPC.                                                                                                         |
| `convertMaterialToProduct`    | Already replaced by `convert_material_to_product()` RPC.                                                                                                         |
| `publishRecipeRequest`        | Recipe publishing now uses the `requests` table. Recipe type is changed directly in Postgres.                                                                    |
| `declineRecipeRequest`        | Same — handled via request status updates in Postgres.                                                                                                           |
| `rebuildStats`                | Already replaced by `get_platform_stats()` RPC which computes stats on-demand via SQL.                                                                           |
| `sendMail`                    | Already replaced by Supabase `send-mail` Edge Function.                                                                                                          |
| `signOutAllUsers`             | Already replaced by Supabase `sign-out-all-users` Edge Function.                                                                                                 |
| `dailySummary`                | Already replaced by `cron-daily-digest` Edge Function.                                                                                                           |
| `recipesInMenuplanCounter`    | Already replaced by `cron-event-review-email` Edge Function.                                                                                                     |
| `traceObject`                 | Can be done with simple SQL JOINs — query which tables reference a given product/material/recipe.                                                                |
| `deleteFeed`                  | Feeds have `created_at` — a simple `DELETE WHERE created_at < ...` handles cleanup.                                                                              |
| `activateSupportUserForEvent` | Simple INSERT into `event_cooks` — no Cloud Function needed.                                                                                                     |

#### Needs Migration: `deleteRecipe`

This is the one function that genuinely needs a Supabase replacement.

**Problem:** `event_menue_recipes.recipe_id` has `ON DELETE RESTRICT`. When a recipe is deleted while referenced by a menuplan, the DELETE fails. The FK is intentionally RESTRICT (not CASCADE) because the menuplan should keep a record of what recipe was there — via the `deleted_recipe_name` column.

**Current behavior (Firebase):** The Cloud Function finds all `event_menue_recipes` rows referencing this recipe, sets `deleted_recipe_name` to the recipe's name, sets `recipe_id` to NULL, then deletes the recipe.

**Solution:** Create a Postgres RPC function `delete_recipe(p_recipe_id TEXT)` that does the same in a single transaction:

```sql
CREATE OR REPLACE FUNCTION public.delete_recipe(p_recipe_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Rezeptname in Menuplan-Referenzen sichern, bevor das Rezept gelöscht wird
  UPDATE event_menue_recipes
  SET deleted_recipe_name = (SELECT name FROM recipes WHERE id = p_recipe_id),
      recipe_id = NULL
  WHERE recipe_id = p_recipe_id;

  -- Rezept löschen (CASCADE entfernt Zutaten, Schritte, Materialien, Bewertungen, Kommentare)
  DELETE FROM recipes WHERE id = p_recipe_id;
END;
$$;
```

No Edge Function needed — a simple RPC function handles it atomically.

---

### Implementation Plan

#### Phase 1 — Create `delete_recipe` RPC function

> [!info] File
> `supabase/migrations/20260322000004_create_delete_recipe_function.sql`

- Create `delete_recipe(p_recipe_id TEXT)` function as shown above
- Grant EXECUTE to authenticated

#### Phase 2 — Update `RecipeRepository.deleteRecipe()`

> [!info] File
> `src/components/Database/Repository/RecipeRepository.ts`

Change from `this.remove(recipeId)` to:

```typescript
async deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await this.client.rpc("delete_recipe", {
    p_recipe_id: recipeId,
  });
  if (error) throw error;
}
```

#### Phase 3 — Remove Firebase Cloud Function calls

**`src/components/Product/product.class.ts`:**

- Remove `firebase.cloudFunction.updateProduct.triggerCloudFunction(...)` call (lines 264–268)
- Remove `triggerCloudFx` parameter if it only gates the cloud function

**`src/components/Material/material.class.ts`:**

- Remove `firebase.cloudFunction.updateMaterial.triggerCloudFunction(...)` call (lines 170–175)
- Remove `triggerCloudFx` parameter if it only gates the cloud function

**`src/components/User/user.class.ts`:**

- Remove `createUserPublicData()` method entirely (dead code — never called from UI)
- Remove `firebase.cloudFunction.updateUserDisplayName.triggerCloudFunction(...)` call in `saveFullProfile()`
- Remove `firebase.cloudFunction.updateUserMotto.triggerCloudFunction(...)` call in `saveFullProfile()`
- Remove `firebase.cloudFunction.updateUserPictureSrc.triggerCloudFunction(...)` call in `deletePicture()`

**`src/components/Shared/stats.class.ts`:**

- Remove `rebuildStats()` method or rewire to use `get_platform_stats()` RPC directly

#### Phase 4 — Clean up Cloud Function infrastructure

**`src/components/Firebase/Db/firebase.db.cloudfunction.class.ts`:**

- Remove all Cloud Function class imports and registrations that are no longer used

**`src/components/Firebase/firebase.class.ts`:**

- Remove `cloudFunction` property if all functions are removed

**Files to delete** (Cloud Function class files): `firebase.db.cloudfunction.createUserPublicData.class.ts`, `firebase.db.cloudfunction.updateProduct.class.ts`, `firebase.db.cloudfunction.updateMaterial.class.ts`, `firebase.db.cloudfunction.updateRecipe.class.ts`, `firebase.db.cloudfunction.deleteRecipe.class.ts`, and any other `firebase.db.cloudfunction.*.class.ts` files no longer referenced.

#### Phase 5 — Update tests

- Remove Cloud Function mock setups from test files
- Update `RecipeRepository.test.ts` to test the new RPC-based `deleteRecipe()`
- Update `user.class.test.ts` — remove `createUserPublicData` tests, remove cloud function mock assertions from `saveFullProfile` tests

---

### Files Summary

#### SQL Migration

| File                                                                   | Action     |
| ---------------------------------------------------------------------- | ---------- |
| `supabase/migrations/20260322000004_create_delete_recipe_function.sql` | **Create** |

#### Repository

| File                                                     | Action                          |
| -------------------------------------------------------- | ------------------------------- |
| `src/components/Database/Repository/RecipeRepository.ts` | **Modify** — use RPC for delete |

#### Domain Classes (remove CF calls)

| File                                        | Action                                                   |
| ------------------------------------------- | -------------------------------------------------------- |
| `src/components/Product/product.class.ts`   | **Modify** — remove cloud function call                  |
| `src/components/Material/material.class.ts` | **Modify** — remove cloud function call                  |
| `src/components/User/user.class.ts`         | **Modify** — remove 4 cloud function calls + dead method |
| `src/components/Shared/stats.class.ts`      | **Modify** — remove/rewire `rebuildStats`                |

#### Firebase Infrastructure

| File                                                              | Action                            |
| ----------------------------------------------------------------- | --------------------------------- |
| `src/components/Firebase/Db/firebase.db.cloudfunction.class.ts`   | **Modify** — remove registrations |
| `src/components/Firebase/Db/firebase.db.cloudfunction.*.class.ts` | **Delete** — unused classes       |

#### Tests

| File                       | Action                                 |
| -------------------------- | -------------------------------------- |
| `RecipeRepository.test.ts` | **Modify** — test RPC-based delete     |
| `user.class.test.ts`       | **Modify** — remove CF mock assertions |
| Other test files           | **Modify** — remove CF mock setups     |

---

### Verification

1. `supabase db reset` — migration chain passes
2. `npx tsc --noEmit` — zero new errors
3. `npx jest --watchAll=false` — all tests pass
4. Manual: delete a recipe that's used in a menuplan → menuplan shows "deleted recipe name" instead of broken reference
5. Manual: edit a product name → recipes still show correct name (via JOIN, no cloud function)
6. Manual: edit user display name → profile updates, events show correct name (via JOIN)
