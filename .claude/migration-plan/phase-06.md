## Phase 6: Event Migration (Firebase → Supabase/Postgres)

### Context

Events are the central entity in chuchipirat. They live entirely in Firebase Firestore as deeply nested JSON documents. This phase migrates the core event, group configuration, and menuplan to Supabase/Postgres. Shopping list, material list, used-recipes, and receipt are deferred to a later phase.

The goal: establish the schema + repositories first, then switch the four UI files to consume Supabase data. UI redesign/refactoring is explicitly deferred.

---

### Design Decisions

#### Why normalized plan tables instead of JSONB

The `PortionPlan[]` arrays on meal recipes, products, and materials were proposed as JSONB. After analysis, normalized tables are the right choice:

1. **CASCADE deletes work automatically.** When a diet or intolerance is deleted from group config, all plan rows referencing it are automatically removed via `ON DELETE CASCADE`. With JSONB, you'd need a trigger to scan and patch embedded JSON across potentially hundreds of rows.
2. **Multiple group links** is naturally "one row per group link." Adding or removing group links means INSERT/DELETE rows, not updating embedded JSON arrays.
3. **Proper FKs for diet/intolerance.** `diet_id` and `intolerance_id` can reference actual rows. The `ALL` and `FIX` sentinels are handled cleanly via the `plan_scope_type` ENUM rather than raw strings embedded in JSON.
4. **Queryable.** "Total servings planned for diet X across all recipes" is a plain SQL `GROUP BY`, not a JSON walk.

JSONB would be justified if (a) the data is always read/written atomically and never filtered independently, AND (b) no FKs are needed. Here, condition (b) fails.

#### Why one plan table instead of three

The three item types (`menue_recipe`, `menue_product`, `menue_material`) all have identical plan structure: `diet_scope`, `diet_id`, `intolerance_scope`, `intolerance_id`, `factor`, `servings`. A single table `event_menuplan_item_plans` with three nullable FK columns and a CHECK constraint is cleaner than three duplicate tables:

- 14 total tables instead of 16
- 1 RLS policy instead of 3 identical ones
- 1 Realtime channel instead of 3
- 1 repository method handles all plan operations
- The CHECK constraint (`one_nonnull_count = 1`) enforces data integrity equivalent to separate tables

The downside (nullable "polymorphic" FKs) is acceptable here because the intent is clear and the CHECK constraint prevents inconsistent states.

#### `deleted_recipe_name` instead of live `recipe_name` snapshot

A live `recipe_name` snapshot creates a dual-write problem: any recipe rename must update two tables, and they can drift out of sync.

**Adopted approach:**

- Remove the live `recipe_name` snapshot entirely
- Add `deleted_recipe_name TEXT` (nullable) — populated only when the recipe is deleted
- Normal state: `recipe_id IS NOT NULL`, `deleted_recipe_name IS NULL` → JOIN recipes for the name
- Deleted state: `recipe_id IS NULL`, `deleted_recipe_name = 'Original Name'` → display `[DELETED] {deleted_recipe_name}`

**Edge function sequence at recipe deletion:**

1. Read recipe name from `recipes` table
2. `UPDATE event_menue_recipes SET deleted_recipe_name = $name, recipe_id = NULL WHERE recipe_id = $id`
3. `DELETE FROM recipes WHERE id = $id` (FK `ON DELETE RESTRICT` is now satisfied — no references remain)

This eliminates the dual-write problem completely.

#### Naming conventions

- `event_meal_recipes` → `event_menue_recipes` (a recipe belongs to a menue, not directly to a meal)
- Plan tables → consolidated into `event_menuplan_item_plans`
- `menue` used consistently for domain names (DB tables, TypeScript, variables)
- No single-letter variable names anywhere
- `crypto.randomUUID()` replaces all `Utils.generateUID()` calls when touching files

---

### Architecture Decisions

#### GroupConfiguration → 3 normalized tables

Diets and intolerances are custom per event. The 2D portions matrix maps to `event_groupconfiguration_portions(event_id, diet_id, intolerance_id, servings)` with UNIQUE constraint. Computed totals are `SUM(servings)` in the app layer — no stored columns.

#### RLS — new `is_event_cook()` function

A `SECURITY DEFINER` helper function avoids circular RLS dependency. Special INSERT rule for `event_cooks` allows the event creator to add the first cook immediately after creating the event row.

#### Real-time (menuplan)

Subscribe to all menuplan tables with Supabase Realtime, filtered by `event_id`. On any change: reload full menuplan.

#### Redundant Firebase fields eliminated

| Firebase Field                       | Replacement                                              |
| ------------------------------------ | -------------------------------------------------------- |
| `Event.numberOfDays`                 | `SUM(date_to - date_from + 1)` from `event_dates`        |
| `Event.maxDate`                      | `MAX(date_to)` from `event_dates`                        |
| `Event.authUsers`                    | `SELECT user_id FROM event_cooks WHERE event_id = ?`     |
| `Event.refDocuments[]`               | Query sub-tables directly                                |
| `GroupConfig.totalPortions` (all 3)  | `SUM(servings)` from `event_groupconfiguration_portions` |
| `Diet.totalPortions`                 | `SUM(servings) WHERE diet_id = ?`                        |
| `Intolerance.totalPortions`          | `SUM(servings) WHERE intolerance_id = ?`                 |
| All order arrays (`menuOrder`, etc.) | `ORDER BY sort_order`                                    |
| `Meal.mealTypeName` (cached)         | JOIN `event_meal_types`                                  |
| `MealRecipe.recipe.type`             | JOIN `recipes` table                                     |
| `MealRecipe.recipe.createdFromUid`   | No longer needed (recipes in Supabase)                   |
| `EventShort` denormalized document   | Query `events` + `event_dates` + `event_cooks`           |

---

### Sub-phases

- **6a** — SQL schema (1 migration file, 14 tables + 2 ENUMs + helper function)
- **6b** — Repositories + DatabaseService wiring
- **6c** — Migration jobs (data + pictures), including all FK lookup maps
- **6d** — UI: `events.tsx`, `createNewEvent.tsx`, `event.tsx`, `eventInfo.tsx`

---

### Phase 6a: SQL Migration

> [!info] File
> `supabase/migrations/20260308000001_create_events.sql`

#### New ENUMs

```sql
CREATE TYPE public.plan_scope_type AS ENUM ('ALL', 'FIX', 'group');
CREATE TYPE public.plan_mode_type  AS ENUM ('total', 'per_portion');
```

#### New helper function

```sql
-- Checks if the current user is a cook of the given event.
-- SECURITY DEFINER avoids circular RLS dependency in event_cooks.
CREATE OR REPLACE FUNCTION is_event_cook(p_event_id TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_cooks
    WHERE event_id = p_event_id AND user_id = auth.uid()
  );
$$;
```

#### Standard RLS for all event child tables (unless noted)

```
FOR SELECT USING (is_event_cook(event_id) OR is_admin())
FOR INSERT WITH CHECK (is_event_cook(event_id) OR is_admin())
FOR UPDATE USING (is_event_cook(event_id) OR is_admin())
FOR DELETE USING (is_event_cook(event_id) OR is_admin())
```

All tables get: `REPLICA IDENTITY FULL`, `firebase_uid TEXT`, standard audit columns (`created_at`, `created_by`, `updated_at`, `updated_by`), audit triggers, index on `(event_id)`.

---

#### Table 1: `events`

```sql
CREATE TABLE public.events (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  name         TEXT NOT NULL DEFAULT '',
  motto        TEXT NOT NULL DEFAULT '',
  location     TEXT NOT NULL DEFAULT '',
  picture_src  TEXT NOT NULL DEFAULT '',
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

**RLS:** SELECT: `is_event_cook(id) OR is_admin()`. INSERT: any authenticated user. UPDATE/DELETE: `is_event_cook(id) OR is_admin()`.

#### Table 2: `event_cooks`

Membership only — profile fetched at runtime via `database.users.getUserDisplayInfo(userIds)`.

```sql
CREATE TABLE public.event_cooks (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, user_id)
);
```

**Special INSERT — bootstrap window for event creator:**

```sql
CREATE POLICY event_cooks_insert ON public.event_cooks FOR INSERT TO authenticated
  WITH CHECK (
    is_event_cook(event_id)
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_id AND created_by = auth.uid())
    OR is_community_leader()
  );
```

#### Table 3: `event_dates`

```sql
CREATE TABLE public.event_dates (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  date_from    DATE NOT NULL,
  date_to      DATE NOT NULL,
  CHECK(date_from <= date_to),
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

#### Table 4: `event_groupconfiguration_diets`

```sql
CREATE TABLE public.event_groupconfiguration_diets (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

#### Table 5: `event_groupconfiguration_intolerances`

Same shape as diets.

#### Table 6: `event_groupconfiguration_portions`

```sql
CREATE TABLE public.event_groupconfiguration_portions (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid     TEXT,
  event_id         TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  diet_id          TEXT NOT NULL REFERENCES public.event_groupconfiguration_diets(id) ON DELETE CASCADE,
  intolerance_id   TEXT NOT NULL REFERENCES public.event_groupconfiguration_intolerances(id) ON DELETE CASCADE,
  servings         INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, diet_id, intolerance_id)
);
```

#### Table 7: `event_meal_types`

```sql
CREATE TABLE public.event_meal_types (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

#### Table 8: `event_meals` — grid slot: date × meal_type

```sql
CREATE TABLE public.event_meals (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  meal_date    DATE NOT NULL,
  meal_type_id TEXT NOT NULL REFERENCES public.event_meal_types(id) ON DELETE CASCADE,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, meal_date, meal_type_id)
);
```

#### Table 9: `event_menues` — menu containers within a meal

```sql
CREATE TABLE public.event_menues (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  meal_id      TEXT NOT NULL REFERENCES public.event_meals(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

#### Table 10: `event_menue_recipes`

```sql
CREATE TABLE public.event_menue_recipes (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid          TEXT,
  event_id              TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id              TEXT NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  recipe_id             TEXT REFERENCES public.recipes(id) ON DELETE RESTRICT,
  deleted_recipe_name   TEXT,          -- only set when recipe is deleted (edge function populates)
  variant_name          TEXT,
  total_portions        INTEGER NOT NULL DEFAULT 0,  -- cached SUM(servings) from plan rows
  sort_order            INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Recipe type and creator info resolved via JOIN `recipes`. No snapshot columns.

#### Table 11: `event_menue_products`

```sql
CREATE TABLE public.event_menue_products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid    TEXT,
  event_id        TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id        TEXT NOT NULL REFERENCES public.event_menues(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity        NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit            TEXT REFERENCES public.units(key) ON DELETE SET NULL,
  plan_mode       plan_mode_type NOT NULL DEFAULT 'total',
  total_quantity  NUMERIC(12,4) NOT NULL DEFAULT 0,  -- cached
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Product name resolved via JOIN `products`. No snapshot column.

#### Table 12: `event_menue_materials`

Same shape as `event_menue_products`, with `material_id TEXT REFERENCES public.materials(id)` instead of `product_id`. Material name resolved via JOIN `materials`.

#### Table 13: `event_notes`

```sql
CREATE TABLE public.event_notes (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid TEXT,
  event_id     TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menue_id     TEXT REFERENCES public.event_menues(id) ON DELETE CASCADE,
  note_date    DATE NOT NULL,
  text         TEXT NOT NULL DEFAULT '',
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

#### Table 14: `event_menuplan_item_plans` — single plan table for all item types

```sql
CREATE TABLE public.event_menuplan_item_plans (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id          TEXT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- Exactly one of these three FKs is non-null (enforced by CHECK):
  menue_recipe_id   TEXT REFERENCES public.event_menue_recipes(id) ON DELETE CASCADE,
  menue_product_id  TEXT REFERENCES public.event_menue_products(id) ON DELETE CASCADE,
  menue_material_id TEXT REFERENCES public.event_menue_materials(id) ON DELETE CASCADE,
  -- Group config link:
  diet_scope        plan_scope_type NOT NULL DEFAULT 'ALL',
  diet_id           TEXT REFERENCES public.event_groupconfiguration_diets(id) ON DELETE CASCADE,
  intolerance_scope plan_scope_type NOT NULL DEFAULT 'ALL',
  intolerance_id    TEXT REFERENCES public.event_groupconfiguration_intolerances(id) ON DELETE CASCADE,
  factor            NUMERIC(10,4) NOT NULL DEFAULT 1,
  servings          INTEGER NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Constraints
  CHECK (diet_scope != 'group' OR diet_id IS NOT NULL),
  CHECK (intolerance_scope != 'group' OR intolerance_id IS NOT NULL),
  CHECK (
    (menue_recipe_id IS NOT NULL)::int +
    (menue_product_id IS NOT NULL)::int +
    (menue_material_id IS NOT NULL)::int = 1
  )
);
```

---

### Phase 6b: Repositories

#### `EventRepository.ts`

> [!info] File
> `src/components/Database/Repository/EventRepository.ts`

Manages `events`, `event_cooks`, `event_dates` as a unit.

**Domain types:**

```typescript
interface EventDomain {
  uid: string;
  name: string;
  motto: string;
  location: string;
  pictureSrc: string;
  cooks: EventCookDomain[];
  dates: EventDateDomain[];
  created: {at: Date; byUid: string | null};
  lastChange: {at: Date; byUid: string | null};
}
interface EventCookDomain {
  uid: string;
  userId: string;
}
interface EventDateDomain {
  uid: string;
  sortOrder: number;
  dateFrom: Date;
  dateTo: Date;
}
```

**Key methods:**

- `getEvent(eventId)` → `EventDomain`
- `getAllEventsForUser()` → `EventDomain[]` (via `event_cooks WHERE user_id = auth.uid()`)
- `createEvent(eventData, authUser)` → `EventDomain`
- `updateEvent(eventData, authUser)` → `EventDomain`
- `deleteEvent(eventId)` → `void`
- `addCook(eventId, userId, authUser)` → `EventCookDomain`
- `removeCook(cookId)` → `void`
- `saveDates(eventId, dates, authUser)` → `void`
- `subscribeToEvent(eventId, onData)` → unsubscribe function

#### `EventGroupConfigRepository.ts`

> [!info] File
> `src/components/Database/Repository/EventGroupConfigRepository.ts`

**Domain types:**

```typescript
interface GroupConfigDomain {
  eventId: string;
  diets: GroupConfigItemDomain[];
  intolerances: GroupConfigItemDomain[];
  portions: PortionEntryDomain[];
}
interface GroupConfigItemDomain {
  uid: string;
  name: string;
  sortOrder: number;
}
interface PortionEntryDomain {
  uid: string;
  dietId: string;
  intoleranceId: string;
  servings: number;
}
```

**Save strategy:** upsert diets → upsert intolerances → DELETE removed items (CASCADE removes their portions) → upsert portions.

#### `MenuplanRepository.ts`

> [!info] File
> `src/components/Database/Repository/MenuplanRepository.ts`

Manages all 6 menuplan tables + `event_menuplan_item_plans`.

**Domain types:**

```typescript
interface MenuplanDomain {
  eventId: string;
  mealTypes: MealTypeDomain[];
  meals: MealDomain[];
  menues: MenueDomain[];
  menueRecipes: MenueRecipeDomain[];
  menueProducts: MenueProductDomain[];
  menueMaterials: MenueMaterialDomain[];
  notes: NoteDomain[];
}
interface MenueRecipeDomain {
  uid: string;
  menueId: string;
  recipeId: string | null; // null when recipe deleted
  deletedRecipeName: string | null; // populated when recipe deleted
  variantName: string | null;
  totalPortions: number;
  sortOrder: number;
  plans: ItemPlanDomain[];
}
interface ItemPlanDomain {
  uid: string;
  dietScope: "ALL" | "FIX" | "group";
  dietId: string | null;
  intoleranceScope: "ALL" | "FIX" | "group";
  intoleranceId: string | null;
  factor: number;
  servings: number;
}
```

**Real-time subscription:**

```typescript
subscribeToMenuplan(
  eventId: string,
  onAnyChange: () => void,
  onError: (error: Error) => void
): () => void
// Creates 7 Supabase Realtime channels, all filtered event_id=eq.{eventId}
// Any change triggers onAnyChange() → caller calls getMenuplan() to reload
```

#### DatabaseService additions

```typescript
events: EventRepository;
eventGroupConfig: EventGroupConfigRepository;
menuplan: MenuplanRepository;
```

---

### Phase 6c: Migration Jobs

#### Lookup maps (required for FK resolution)

Each migration job builds lookup maps at `fetchSourceRecords` time using the admin client to access `firebase_uid` columns:

| Map                          | Used by                                           | Query                                                         |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| `eventIdByFirebaseUid`       | GroupConfig + Menuplan jobs                       | `SELECT id, firebase_uid FROM events`                         |
| `userAuthUidByFirebaseUid`   | EventMigrationJob (cooks)                         | `SELECT auth_uid, firebase_uid FROM users`                    |
| `productIdByFirebaseUid`     | MenuplanMigrationJob                              | `SELECT id, firebase_uid FROM products`                       |
| `materialIdByFirebaseUid`    | MenuplanMigrationJob                              | `SELECT id, firebase_uid FROM materials`                      |
| `dietIdByFirebaseUid`        | MenuplanMigrationJob (plans)                      | `SELECT id, firebase_uid FROM event_groupconfiguration_diets` |
| `intoleranceIdByFirebaseUid` | MenuplanMigrationJob (plans)                      | Same for intolerances                                         |
| `menueIdByFirebaseUid`       | MenuplanMigrationJob (recipes/products/materials) | Built during same job run                                     |

#### `EventMigrationJob.ts`

- `fetchSourceRecords`: all Firebase events docs (skip `000_allEvents`)
- `migrateRecord`:
  1. Insert `events` row
  2. For each `event.cooks[]`: resolve `user_id` via `userAuthUidByFirebaseUid[cook.uid]` → insert `event_cooks`
  3. For each `event.dates[]`: insert `event_dates` with `sort_order = index * 10`

#### `GroupConfigMigrationJob.ts`

- `fetchSourceRecords`: `events/{uid}/docs/groupConfiguration` sub-documents
- `migrateRecord`:
  1. Resolve `event_id` via `eventIdByFirebaseUid`
  2. Insert `event_groupconfiguration_diets` (`sort_order = order[] index * 10`)
  3. Insert `event_groupconfiguration_intolerances`
  4. Insert `event_groupconfiguration_portions`: iterate `portions[dietFirebaseUid][intoleranceFirebaseUid]` → resolve both FKs → insert row

#### `MenuplanMigrationJob.ts`

- `fetchSourceRecords`: `events/{uid}/docs/menuplan` sub-documents
- `migrateRecord` (in order):
  1. Insert `event_meal_types` (`sort_order = mealTypes.order[] index * 10`)
  2. Insert `event_meals` (`sort_order = menuOrder[] index * 10`; `meal_date` from key string)
  3. Insert `event_menues` (`sort_order = position in meal.menuOrder[]`)
  4. Build `menueIdByFirebaseUid` map within this record
  5. Insert `event_menue_recipes`: `recipe_id` = resolve from recipes table if possible; if recipe deleted → `NULL`, `deleted_recipe_name = '[DELETED] ' + recipe.name`. `sort_order = position in menue.mealRecipeOrder[]`
  6. Insert `event_menue_products`: `product_id = productIdByFirebaseUid[product.productUid]`. `sort_order = position in menue.productOrder[]`
  7. Insert `event_menue_materials`: `material_id = materialIdByFirebaseUid[material.materialUid]`
  8. For each recipe/product/material: insert `event_menuplan_item_plans` rows from `plan[]` array. Convert Firebase `"ALL"`/`"FIX"` sentinels → `plan_scope_type` ENUM values. Resolve `diet_id` via `dietIdByFirebaseUid[plan.diet]` (if `plan_scope_type = 'group'`). Resolve `intolerance_id` similarly.
  9. Insert `event_notes`

#### `EventPictureMigrationJob.ts`

- `fetchSourceRecords`: all events with non-empty `picture_src` (Firebase Storage URL)
- `migrateRecord`: copy from Firebase Storage → Supabase Storage; update `events.picture_src`

---

### Phase 6d: UI Migration

#### `events.tsx`

- Replace `Event.getAllEventsOfUser({firebase})` → `database.events.getAllEventsForUser()`
- Enrich with `database.users.getUserDisplayInfo(cookUserIds)` for cook avatars
- Remove Firebase prop drilling

#### `createNewEvent.tsx`

- `database.events.createEvent()` + `database.events.addCook()` (creator as first cook)
- `database.menuplan.initializeMenuplan()` (creates default meal types)
- Firebase Storage stays for picture upload (migrated by `EventPictureMigrationJob`)
- Replace `Utils.generateUID()` → `crypto.randomUUID()`

#### `event.tsx`

- Replace Firebase `onSnapshot` → `database.events.subscribeToEvent()` + `database.menuplan.subscribeToMenuplan()`

#### `eventInfo.tsx`

- Replace `Event.getEvent()` → `database.events.getEvent()`
- `database.events.addCook()`, `removeCook()`, `saveDates()`

#### Business logic preserved in `.class.ts` (strip DB code only)

- `event.class.ts`: `validateDates()`, `defineEventDuration()`, `checkEventData()`
- `menuplan.class.ts`: `fixMenuplan()`, `recalculatePortions()`, `sortSelectedMenues()`, `getEventDateList()`, `adjustMenuplanWithNewDays()`

---

### Files Summary

#### SQL Migration

| File                                                   | Action                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| `supabase/migrations/20260308000001_create_events.sql` | **New** — 14 tables, 2 ENUMs, helper function, RLS |

#### Repositories

| File                                                               | Action                          |
| ------------------------------------------------------------------ | ------------------------------- |
| `src/components/Database/Repository/EventRepository.ts`            | **New**                         |
| `src/components/Database/Repository/EventGroupConfigRepository.ts` | **New**                         |
| `src/components/Database/Repository/MenuplanRepository.ts`         | **New**                         |
| `src/components/Database/DatabaseService.ts`                       | **Update** — add 3 repositories |

#### Migration Jobs

| File                                                             | Action                  |
| ---------------------------------------------------------------- | ----------------------- |
| `src/components/Admin/MigrationJobs/EventMigrationJob.ts`        | **New**                 |
| `src/components/Admin/MigrationJobs/GroupConfigMigrationJob.ts`  | **New**                 |
| `src/components/Admin/MigrationJobs/MenuplanMigrationJob.ts`     | **New**                 |
| `src/components/Admin/MigrationJobs/EventPictureMigrationJob.ts` | **New**                 |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts`     | **Update** — add 4 jobs |

#### Domain Classes

| File                                              | Action                                          |
| ------------------------------------------------- | ----------------------------------------------- |
| `src/components/Event/Event/event.class.ts`       | **Update** — strip DB code, keep business logic |
| `src/components/Event/Menuplan/menuplan.class.ts` | **Update** — strip DB code, keep business logic |

#### UI Components

| File                                      | Action                               |
| ----------------------------------------- | ------------------------------------ |
| `src/components/Event/events.tsx`         | **Update** — switch to Supabase      |
| `src/components/Event/createNewEvent.tsx` | **Update** — switch to Supabase      |
| `src/components/Event/event.tsx`          | **Update** — switch to subscriptions |
| `src/components/Event/eventInfo.tsx`      | **Update** — switch to Supabase      |

#### Reference Implementations

- `src/components/Database/Repository/RecipeRepository.ts` — Row/Domain/mapping pattern
- `src/components/Admin/MigrationJobs/RecipeMigrationJob.ts` — lookup maps, multi-table migration pattern
- `supabase/migrations/20260304000001_create_recipes.sql` — full migration convention reference

---

### Tests

| File                                 | Tests                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `EventRepository.test.ts`            | `getEvent`, `getAllEventsForUser`, `addCook` (INSERT RLS special case) |
| `EventGroupConfigRepository.test.ts` | `getGroupConfig`, `saveGroupConfig`                                    |
| `MenuplanRepository.test.ts`         | `getMenuplan` (parallel load), `subscribeToMenuplan` (mock channels)   |

---

### Verification

1. Apply migration: `docker compose -f supabase/docker-compose.yml exec db psql -U postgres -d postgres -f /path/to/20260308000001_create_events.sql`
2. `npx tsc --noEmit` — no TypeScript errors
3. `npx jest "EventRepository|GroupConfig|MenuplanRepository" --watchAll=false --no-coverage` — all tests pass
4. Manual: create event → DB has event + cook + date rows; Firebase NOT written
5. Manual: non-cook cannot INSERT into `event_cooks` (RLS); creator can add first cook
6. Manual: delete a diet from group config → its portions rows cascade-deleted automatically
7. Manual: two browser tabs — edit menuplan in one → other tab updates within ~1s
8. Run migration jobs in Admin cockpit in order: events → groupConfig → menuplan → pictures
9. Deleted recipe in menuplan → `recipe_id NULL`, `deleted_recipe_name` shows `[DELETED] ...`

---

### Deferred / Future

- **Shopping list** — generation from menuplan data, deferred to a later phase
- **Material list** — aggregation of materials across menues, deferred
- **Used-recipes** — tracking which recipes are used in events, deferred
- **Receipt** — event cost tracking and receipt management, deferred
- **UI redesign/refactoring** — the 4 UI files (`events.tsx`, `createNewEvent.tsx`, `event.tsx`, `eventInfo.tsx`) are migrated to Supabase data sources only; visual/UX redesign is explicitly out of scope for this phase
- **Recipe variant migration** — Phase 5e (variant recipes) can now proceed, as event IDs are established after this phase
