# Shopping List Migration (Firebase → Supabase)

## Completed

- [x] **Phase 0: UsedRecipes TEXT[] migration**
  - [x] SQL migration: junction tables → TEXT[] arrays (`20260316000001_usedrecipes_arrays.sql`)
  - [x] Updated `UsedRecipeListRepository` — removed junction queries, uses arrays directly
  - [x] Updated tests — 16/16 pass
  - [x] Updated `UsedRecipesMigrationJob` — writes arrays to header
  - [x] Updated `useUsedRecipesHandlers` — removed `touchListUpdatedAt`
  - [x] Updated `save_menuplan` RPC — removed ~75 lines of temp table backup/restore
  - [x] Updated `get_used_recipe_list_recipes` RPC — uses `unnest()` instead of junction JOIN

- [x] **Phase 1: Shopping List SQL migration** (`20260316000002_create_shopping_lists.sql`)
  - [x] `shopping_list_edit_source` ENUM
  - [x] `event_shopping_lists` header table with TEXT[] arrays
  - [x] `event_shopping_list_items` table with CHECK constraint
  - [x] `event_shopping_list_items_view` VIEW with resolved names/departments
  - [x] RLS, triggers, indexes, REPLICA IDENTITY FULL

- [x] **Phase 2: ShoppingListRepository**
  - [x] Created `ShoppingListRepository.ts` — full CRUD, Realtime subscriptions
  - [x] Added `SHOPPING_LISTS` to SessionStorageHandler
  - [x] Wired into `DatabaseService` (both regular and admin client)

- [x] **Phase 3: Domain service refactoring**
  - [x] `shoppingList.class.ts` — stripped Firebase, broke up `createNewList()` into 3 sub-methods
  - [x] Extracted `addIngredientsFromRecipes`, `addProductsFromMenuplan`, `addMaterialsFromMenuplan`
  - [x] Added `preserveManualItems()`, `mergeManualItems()`, `mergeManualTraceEntries()`
  - [x] Moved trace methods (`addTraceEntry`, `deleteTraceEntry`) to ShoppingList class
  - [x] `shoppingListCollection.class.ts` — stripped Firebase, `refreshList()` now synchronous
  - [x] Added deprecated Firebase compatibility methods for old UI code

- [x] **Phase 4: UI compatibility**
  - [x] Updated `useShoppingListDialogs.ts` to use legacy methods
  - [x] Old UI code compiles and works on Firebase path

- [x] **Phase 5: Highlight context**
  - [x] Created `shoppingListHighlightContext.ts`

- [x] **Phase 6: Migration job**
  - [x] Created `ShoppingListMigrationJob.ts` — migrates headers + items
  - [x] Registered in `migrationJobRegistry.ts`

## Verification

- [x] `npx tsc --noEmit` — zero new errors
- [x] `npx jest` — 82 suites, 1219 tests pass
- [x] UsedRecipeListRepository tests — 16/16 pass

## Remaining (follow-up)

- [ ] **Full UI migration**: Create `useShoppingListHandlers.tsx`, update `shoppingList.tsx` and `event.tsx` to use Supabase repository instead of Firebase
- [ ] **Unit tests**: ShoppingListRepository tests, domain logic tests
- [ ] **Delete old files**: `useShoppingListDialogs.ts`, `useShoppingListOperations.ts`, `firebase.db.shoppingList.class.ts`, `firebase.db.event.shoppingListCollection.class.ts`
- [ ] **Remove deprecated methods**: After UI migration, remove Firebase compat methods from domain classes
- [ ] **Manual testing**: Per verification checklist in migration plan
