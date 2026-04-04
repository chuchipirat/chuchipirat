## Shopping List Migration (Firebase → Supabase)

### Context

The Shopping List feature uses Firebase Firestore with two document types: `ShoppingListCollection` (single doc per event with all list headers, traces, metadata) and `ShoppingList` (individual docs with items grouped by department).

The business logic lives in two complex class files (~1,600 lines combined) that mix persistence with computation, have deeply nested methods (252-line `createNewList`, 194-line `refreshList`), duplicated patterns, and hardcoded magic values.

**Goals:**

1. Migrate to normalized Supabase schema (2 tables + VIEW, no trace table)
2. Simplify data model (no collection wrapper, no manual trace fields, no `noOfLists`, trace computed on the fly)
3. Refactor domain logic (break up megamethods, extract shared patterns)
4. Unify approach with UsedRecipes (switch UsedRecipes junction tables → `TEXT[]`)
5. Add Sentry logging, Realtime highlight, unit tests
6. Full UI refactoring

**Key simplifications over Firebase:**

1. No `ShoppingListCollection` wrapper — header table + items table replace it
2. No manual `noOfLists` — derived from query/array length
3. No `ChangeRecord` trace fields — replaced by audit columns
4. No trace table — computed on the fly from menuplan + recipes (maximum normalization)
5. No `generated`/`generated_from_display_name` — audit columns cover this
6. `selected_menues`, `selected_meals`, `selected_departments` as `TEXT[]` (not junction tables)
7. Unified `edit_source` enum replaces manual `manual_add`/`manual_edit` boolean flags

---

### Phase 0: UsedRecipes — Junction Tables → `TEXT[]`

Shopping List will use `TEXT[]` for `selected_menues`/`selected_meals`/`selected_departments`. For consistency, UsedRecipes should use the same approach. This also simplifies `save_menuplan` by ~75 lines (no more temp table backup/restore of junction rows).

> [!info] File
> `supabase/migrations/20260316000001_usedrecipes_arrays.sql`

#### 0a. Add `TEXT[]` columns to `event_used_recipe_lists`

```sql
ALTER TABLE event_used_recipe_lists
  ADD COLUMN selected_menue_ids TEXT[] DEFAULT '{}',
  ADD COLUMN selected_meal_ids TEXT[] DEFAULT '{}';
```

#### 0b. Backfill from junction tables

```sql
UPDATE event_used_recipe_lists ul SET
  selected_menue_ids = COALESCE((
    SELECT array_agg(ulm.menue_id) FROM event_used_recipe_list_menues ulm
    WHERE ulm.list_id = ul.id
  ), '{}'),
  selected_meal_ids = COALESCE((
    SELECT array_agg(ulml.meal_id) FROM event_used_recipe_list_meals ulml
    WHERE ulml.list_id = ul.id
  ), '{}');
```

#### 0c. Drop junction tables

```sql
DROP TABLE event_used_recipe_list_menues;
DROP TABLE event_used_recipe_list_meals;
```

#### 0d. Simplify `save_menuplan` RPC

Remove ~75 lines of temp table backup/restore for junction rows. `TEXT[]` columns on the header are NOT affected by CASCADE delete of `event_menues`. Stale menue IDs in arrays are handled by app-level drift detection (same as current behavior).

#### 0e. Update `UsedRecipeListRepository`

- Remove junction table queries from `getListsForEvent()` — read arrays directly from header
- Remove junction inserts from `createList()` — pass arrays in header INSERT
- Replace `updateListMenues()`/`updateListMenuesAndMeals()` with simple header UPDATEs
- Remove `touchListUpdatedAt()` (UPDATE auto-triggers `updated_at`)
- Remove junction row interfaces (`UsedRecipeListMenueRow`, `UsedRecipeListMealRow`)

#### 0f. Update tests + migration job

Remove junction row test data, junction query mocks. Write arrays directly to header.

---

### Phase 1: SQL Migration — Shopping List Tables

> [!info] File
> `supabase/migrations/20260316000002_create_shopping_lists.sql`

#### Enum type

```sql
CREATE TYPE public.shopping_list_edit_source AS ENUM ('generated', 'manual_add', 'manual_edit');
```

#### Table 1: `event_shopping_lists` (header)

```sql
CREATE TABLE public.event_shopping_lists (
  id                       TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id                 TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  selected_menues          TEXT[]      DEFAULT '{}',
  selected_meals           TEXT[]      DEFAULT '{}',
  selected_departments     TEXT[]      DEFAULT '{}',
  has_manually_added_items BOOLEAN     DEFAULT false,
  firebase_uid             TEXT,
  -- Audit
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by               UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
```

RLS: `is_event_cook(event_id)` for SELECT, INSERT, UPDATE, DELETE. Triggers: `update_updated_at()`, `update_updated_by()`. Index on `event_id`. `REPLICA IDENTITY FULL` for Realtime.

#### Table 2: `event_shopping_list_items` (normalized)

```sql
CREATE TABLE public.event_shopping_list_items (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id         TEXT        NOT NULL REFERENCES public.event_shopping_lists(id) ON DELETE CASCADE,
  product_id      TEXT        REFERENCES public.products(id) ON DELETE SET NULL,
  material_id     TEXT        REFERENCES public.materials(id) ON DELETE SET NULL,
  department_id   TEXT        REFERENCES public.departments(id) ON DELETE SET NULL,
  free_text_name  TEXT,
  quantity        NUMERIC     NOT NULL DEFAULT 0,
  unit            TEXT        REFERENCES public.units(key) ON DELETE SET NULL,
  checked         BOOLEAN     DEFAULT false,
  edit_source     public.shopping_list_edit_source NOT NULL DEFAULT 'generated',
  sort_order      INT         DEFAULT 0,
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID        DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
```

**Normalization rules:**

- No `item_type` column — derivable from which FK is set (`product_id` → food, `material_id` → material, `free_text_name` → custom)
- `department_id`: only stored for free-text items. For product items, department is derived via `products.department_id` JOIN. For material items, always "NON FOOD" (handled in VIEW/app)
- `unit` FK to `units(key)` — same pattern as `recipe_ingredients.unit`
- `edit_source` enum replaces separate `manual_add`/`manual_edit` booleans

**CHECK constraint** ensures exactly one item source:

```sql
ALTER TABLE event_shopping_list_items ADD CONSTRAINT chk_item_source CHECK (
  (product_id IS NOT NULL AND material_id IS NULL AND free_text_name IS NULL) OR
  (product_id IS NULL AND material_id IS NOT NULL AND free_text_name IS NULL) OR
  (product_id IS NULL AND material_id IS NULL AND free_text_name IS NOT NULL)
);
```

RLS via parent join: `EXISTS (SELECT 1 FROM event_shopping_lists h WHERE h.id = list_id AND is_event_cook(h.event_id))`. Triggers, index on `list_id`, `REPLICA IDENTITY FULL`.

#### No trace table

Trace is computed on the fly from menuplan data. The information "how is this item's quantity composed?" is fully derivable: which menues contribute (from `header.selected_menues` + menuplan), which recipes (via JOINs), portions (from `event_menue_recipes.total_portions`), quantity (via recipe scaling + unit conversion), manual items (from `edit_source` on the item itself).

#### VIEW: `event_shopping_list_items_view`

```sql
CREATE VIEW public.event_shopping_list_items_view AS
SELECT
  i.id, i.list_id, i.product_id, i.material_id, i.free_text_name,
  i.quantity, i.unit, i.checked, i.edit_source, i.sort_order,
  i.created_at, i.created_by, i.updated_at, i.updated_by,
  -- Derived item name
  COALESCE(p.name, m.name, i.free_text_name) AS item_name,
  -- Derived department
  COALESCE(i.department_id, p.department_id) AS resolved_department_id,
  d.name AS department_name,
  d.pos AS department_pos,
  -- Unit display name
  u.name AS unit_name
FROM event_shopping_list_items i
LEFT JOIN products p ON p.id = i.product_id
LEFT JOIN materials m ON m.id = i.material_id
LEFT JOIN departments d ON d.id = COALESCE(i.department_id, p.department_id)
LEFT JOIN units u ON u.key = i.unit;
```

Repository reads from this VIEW; writes go to the base table.

---

### Phase 2: `ShoppingListRepository`

> [!info] File
> `src/components/Database/Repository/ShoppingListRepository.ts`

Extends `BaseRepository`. Reads from VIEW, writes to base tables.

| Method                                   | Description                                   |
| ---------------------------------------- | --------------------------------------------- |
| `getListsForEvent(eventId)`              | Load all list headers for an event            |
| `getListItems(listId)`                   | Read from VIEW, grouped by department         |
| `createList(eventId, header, items)`     | Insert header + items. Returns created header |
| `saveListItems(listId, items)`           | Delete-all + re-insert items                  |
| `updateListHeader(listId, updates)`      | Partial update of header fields               |
| `updateItemChecked(itemId, checked)`     | Single-item checkbox toggle                   |
| `updateItem(itemId, updates)`            | Single-item update (quantity, unit, etc.)     |
| `deleteList(listId)`                     | CASCADE handles items                         |
| `subscribeToLists(eventId, callback)`    | Realtime on headers filtered by `event_id`    |
| `subscribeToListItems(listId, callback)` | Realtime on items filtered by `list_id`       |

**Domain interfaces:**

```typescript
interface ShoppingListHeaderDomain {
  id: string;
  eventId: string;
  name: string;
  selectedMenues: string[];
  selectedMeals: string[];
  selectedDepartments: string[];
  hasManuallyAddedItems: boolean;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
}

interface ShoppingListItemDomain {
  id: string;
  listId: string;
  productId: string | null;
  materialId: string | null;
  freeTextName: string | null;
  quantity: number;
  unit: string | null;
  checked: boolean;
  editSource: "generated" | "manual_add" | "manual_edit";
  sortOrder: number;
  // From VIEW:
  itemName: string;
  resolvedDepartmentId: string | null;
  departmentName: string | null;
  departmentPos: number | null;
  unitName: string | null;
}
```

Wire into `DatabaseService`: add `shoppingLists: ShoppingListRepository` to both regular and admin client.

---

### Phase 3: Domain Service Refactoring

#### `shoppingList.class.ts` — Break up `createNewList()` (252 lines → ~4 methods)

**Remove** (persistence): `save()`, `getShoppingListListener()`, `getShoppingList()`, `delete()`

**Refactor `createNewList()` into:**

1. `addIngredientsFromRecipes(menueplan, selectedMenues, recipes, ...)` — scales recipe ingredients, adds to list
2. `addProductsFromMenuplan(menueplan, selectedMenues, ...)` — adds menue-level products
3. `addMaterialsFromMenuplan(menueplan, selectedMenues, ...)` — adds menue-level materials
4. `createNewList()` — orchestrator calling the 3 above (~30 lines)

**Extract shared add-item pattern** (currently duplicated 4 times):

```typescript
private static addItemWithAccumulation(params: {
  shoppingList, item, department, quantity, unit, editSource
}): void
```

**Accept pre-loaded recipes** (no more `Recipe.getMultipleRecipes({firebase})`):

```typescript
interface CreateNewList {
  selectedMenues: Menue["uid"][];
  selectedDepartments: Department["uid"][];
  menueplan: MenuplanData;
  recipes: Record<string, Recipe>; // pre-loaded by caller
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts: UnitConversionProducts;
}
```

**Formalize constants:** Replace hardcoded `{uid: "NotIdetifiable", name: "Keine Zuordnung möglich", pos: 99}` — items without a department simply have `department_id = NULL`. Replace hardcoded `"NON FOOD"` string (appears 3 times) with a constant.

#### `shoppingListCollection.class.ts` — Simplify

**Remove** (persistence): `save()`, `getShoppingListCollection()`, `getShoppingListCollectionListener()`, `deleteCollection()`, `deleteList()`, all firebase params, `Stats.incrementStat`, `logEvent`

**Remove** (trace management): all trace-related methods (`addTraceEntry`, `deleteTraceEntry`). Traces are now computed on the fly.

**Refactor `refreshList()` (194 lines):**

1. Extract `preserveManualItems(list)` — returns items with `edit_source = 'manual_add'` or `'manual_edit'`
2. Extract `mergeManualItems(newList, preservedItems)` — handles the 3-branch merge logic
3. `refreshList()` becomes orchestrator: preserve → regenerate → merge → return

#### New: Trace computation utility

New function (in `shoppingList.class.ts` or separate file):

```typescript
static computeTraceForItem(params: {
  itemProductId: string | null;
  itemMaterialId: string | null;
  selectedMenues: string[];
  menueplan: MenuplanData;
  recipes: Record<string, Recipe>;
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts: UnitConversionProducts;
}): TraceEntry[]
```

Returns an array of `{menueId, menueName, recipeId, recipeName, plannedPortions, quantity, unit}` showing how the item's total is composed. Uses the same scaling + unit conversion logic as `createNewList()`.

---

### Phase 4: UI Refactoring

#### New hook: `useShoppingListHandlers.tsx`

Replaces both `useShoppingListDialogs.ts` (1,050 lines) and `useShoppingListOperations.ts` (496 lines).

**Key changes:**

1. Uses `useDatabase()` instead of firebase
2. All catch blocks use `Sentry.captureException(error, {extra: {...}})`
3. Recipe loading: pre-load before calling domain logic
4. Granular checkbox saves via `updateItemChecked()` (single row UPDATE)
5. `onChangeItem()` — split into clearer sub-handlers instead of 235-line callback with 6 branches
6. Trace dialog: calls `computeTraceForItem()` on demand (no DB read needed)

**Handlers** (consolidated from both current hooks): List CRUD (`onCreateList`, `onListElementSelect`, `onListElementDelete`, `onListElementEdit`, `onRefreshLists`), Menue/Department dialogs, Context menu, Item operations (`onCheckboxClick`, `onChangeItem` split into sub-handlers), Item/Trace dialogs, PDF generation.

#### `shoppingList.tsx` refactoring

- Remove firebase prop
- Remove `shoppingListCollection` prop → replaced with `shoppingListHeaders: ShoppingListHeaderDomain[]`
- Use `useShoppingListHandlers` hook
- Wrap with `HighlightedShoppingListItemContext`
- Apply glow CSS to highlighted items

#### `event.tsx` changes

- Replace Firebase listener with `database.shoppingLists.subscribeToLists(eventId, ...)`
- Replace `ShoppingList.getShoppingListListener` with `database.shoppingLists.subscribeToListItems(listId, ...)`
- Simplify reducer: replace `SHOPPING_LIST_COLLECTION_FETCH_*` and `SHOPPING_LIST_FETCH_*` with `SHOPPING_LIST_HEADERS_LOADED`
- Item loading moves to handler hook

---

### Phase 5: Realtime & Highlight

> [!info] File
> `src/components/Event/ShoppingList/shoppingListHighlightContext.ts`

Same pattern as `src/components/Event/Menuplan/highlightContext.ts`:

```typescript
export const HighlightedShoppingListItemContext = React.createContext<
  Set<string>
>(new Set());
```

**Mechanism:**

1. Realtime delivers updated items → diff against current state
2. Identify items where `checked`, `quantity`, or `unit` changed
3. Store changed item IDs in `Set<string>`, provide via context
4. Auto-clear after 2000ms
5. Apply CSS glow class in list rendering

---

### Phase 6: Migration Job

> [!info] File
> `src/components/Admin/MigrationJobs/ShoppingListMigrationJob.ts`

Follows `UsedRecipesMigrationJob.ts` pattern.

**`fetchSourceRecords`:** Build lookup maps (`eventId`, `menueId`, `mealId`, `departmentId`, `productId`, `materialId`). Read collection doc + individual list docs from Firebase.

**`migrateRecord`:** For each list:

1. Insert header with arrays (`selected_menues`, `selected_meals`, `selected_departments` — resolved to Supabase IDs)
2. Insert items: resolve `product_id`/`material_id` from Firebase UIDs. Map `manualAdd`/`manualEdit` → `edit_source` enum. Set `department_id` only for free-text items.
3. No trace migration needed (computed on the fly)

Register in `migrationJobRegistry.ts` after `usedRecipes`.

---

### Phase 7: Sentry Integration

Replace all `console.error(error)` with:

```typescript
Sentry.captureException(error, {
  extra: {component: "ShoppingList", action: "...", eventId, listId},
});
```

Apply across: Repository, handler hook, component, domain classes.

---

### Phase 8: Unit Tests

#### Repository tests (`ShoppingListRepository.test.ts`)

Follow `UsedRecipeListRepository.test.ts` pattern. Test: `getListsForEvent`, `createList`, `saveListItems`, `deleteList`, `updateItemChecked`. Mock Supabase client responses.

#### Domain logic tests

- `shoppingList.class.ts`: test `createNewList()` with pre-loaded recipes. Verify quantity accumulation, unit conversion, department assignment. Test each extracted sub-method independently.
- `shoppingListCollection.class.ts`: test `refreshList()` — verify manual item preservation, merge logic, drift detection.
- `computeTraceForItem()`: test trace computation against known menuplan + recipe data.

#### Handler hook tests (if applicable)

Test key flows: create list → items generated, delete list → cleanup, checkbox toggle → state update.

---

### Files Summary

#### SQL Migrations

| File                                                           | Action                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| `supabase/migrations/20260316000001_usedrecipes_arrays.sql`    | **New** — switch UsedRecipes junction tables to `TEXT[]` |
| `supabase/migrations/20260316000002_create_shopping_lists.sql` | **New** — enum + 2 tables + VIEW, RLS, triggers          |

#### Repositories

| File                                                             | Action                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `src/components/Database/Repository/ShoppingListRepository.ts`   | **New** — CRUD, Realtime, reads from VIEW      |
| `src/components/Database/Repository/UsedRecipeListRepository.ts` | **Modify** — remove junction logic, use arrays |
| `src/components/Database/databaseService.ts`                     | **Modify** — add `shoppingLists`               |

#### Domain Classes

| File                                                                | Action                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/components/Event/ShoppingList/shoppingListCollection.class.ts` | **Modify** — strip Firebase + trace, refactor                                |
| `src/components/Event/ShoppingList/shoppingList.class.ts`           | **Modify** — strip Firebase, break up megamethods, add `computeTraceForItem` |

#### UI Components

| File                                                                | Action                                              |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| `src/components/Event/ShoppingList/useShoppingListHandlers.tsx`     | **New** — consolidated handler hook                 |
| `src/components/Event/ShoppingList/shoppingList.tsx`                | **Modify** — refactor for Supabase                  |
| `src/components/Event/ShoppingList/shoppingListHighlightContext.ts` | **New** — highlight context                         |
| `src/components/Event/Event/event.tsx`                              | **Modify** — Supabase listeners, simplified reducer |

#### Migration Jobs

| File                                                             | Action                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `src/components/Admin/MigrationJobs/ShoppingListMigrationJob.ts` | **New**                                        |
| `src/components/Admin/MigrationJobs/UsedRecipesMigrationJob.ts`  | **Modify** — write arrays instead of junctions |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts`     | **Modify** — register new job                  |

#### Tests

| File                                                                            | Action                         |
| ------------------------------------------------------------------------------- | ------------------------------ |
| `src/components/Database/Repository/__tests__/ShoppingListRepository.test.ts`   | **New**                        |
| `src/components/Database/Repository/__tests__/UsedRecipeListRepository.test.ts` | **Modify** — update for arrays |
| `src/components/Event/ShoppingList/__tests__/shoppingList.test.ts`              | **New** — domain logic tests   |

#### Other

| File                            | Action                             |
| ------------------------------- | ---------------------------------- |
| `supabase/ENVIRONMENT_SETUP.md` | **Modify** — add migration entries |

#### Files to delete (after migration complete)

| File                                                                           | Reason                                |
| ------------------------------------------------------------------------------ | ------------------------------------- |
| `src/components/Event/ShoppingList/useShoppingListDialogs.ts`                  | Replaced by `useShoppingListHandlers` |
| `src/components/Event/ShoppingList/useShoppingListOperations.ts`               | Merged into `useShoppingListHandlers` |
| `src/components/Firebase/Db/firebase.db.shoppingList.class.ts`                 | Firebase persistence removed          |
| `src/components/Firebase/Db/firebase.db.event.shoppingListCollection.class.ts` | Firebase persistence removed          |

#### Reference implementations

| File                                | Pattern                            |
| ----------------------------------- | ---------------------------------- |
| `UsedRecipeListRepository.ts`       | Repository structure               |
| `useUsedRecipesHandlers.tsx`        | Handler hook pattern               |
| `highlightContext.ts`               | Highlight/glow pattern             |
| `UsedRecipesMigrationJob.ts`        | Migration job pattern              |
| `20260304000001_create_recipes.sql` | Enum type pattern, unit FK pattern |

---

### Execution Order

1. **Phase 0** (UsedRecipes `TEXT[]` migration) → standalone prerequisite
2. **Phase 1** (Shopping List SQL) → after Phase 0
3. **Phase 2** (Repository) → depends on Phase 1
4. **Phase 3** (Domain refactoring) → can parallel with Phase 2
5. **Phase 4** (UI) → depends on Phase 2 + 3
6. **Phase 5** (Highlight) → depends on Phase 2
7. **Phase 6** (Migration Job) → depends on Phase 1 + 2
8. **Phase 7** (Sentry) → integrated during Phases 2–4
9. **Phase 8** (Unit tests) → after Phase 2 + 3
10. **Phase 9** (Improvements) → integrated during Phase 4 + 5

**Recommended commit sequence:** Phase 0 (UsedRecipes arrays) → SQL → Repository + DatabaseService → Domain refactoring + tests → UI handlers + components → Highlight → Migration Job → cleanup

---

### Verification

1. `npx tsc --noEmit` — zero new errors
2. `npx jest` — all tests pass (including new tests)
3. SQL: run migrations locally, verify tables + VIEW created, RLS works, CHECK constraint enforced
4. Manual: UsedRecipes still works after `TEXT[]` migration (create list, drift detection, save menuplan)
5. Manual: create shopping list → verify items in Supabase (check VIEW returns correct names/departments)
6. Manual: refresh list → verify manual items preserved, checked state preserved
7. Manual: "Show trace" dialog → verify trace computed correctly from menuplan data
8. Manual: two browser tabs → modify list in one → verify highlight glow in other
9. Manual: run migration job → verify Firebase data correctly in Supabase
10. Manual: generate PDF → compare with Firebase-generated PDF
11. Manual: drift detection → move menue in menuplan → verify shopping list detects change

---

### Future Ideas / Improvements

- **Real-time collaborative editing** — multiple cooks see checkbox changes instantly via Realtime subscriptions (covered by Phase 5 highlight mechanism)
- **Granular item saves** — checkbox clicks persist via `updateItemChecked()` (single row UPDATE, instant feedback); quantity/unit changes use `updateItem()`
