## Phase 5: Recipe Migration (Firebase → Supabase/Postgres)

### Context

Phase 4 (masterdata) is complete. Phase 5 migrates all recipe data from Firestore to normalized Postgres tables. In Firebase, recipes are stored as single documents in separate collections (`public`, `private`, `variant`). In Supabase, they all live in one `recipes` table distinguished by a `type` column.

This phase also introduces a new **comments** feature (users can comment on public recipes) and replaces the Firebase `RecipeObjectStructure<T>` pattern (with `order[]` + `entries{}`) with flat sorted arrays using a `sort_order` column.

**Key findings from the codebase:**

- `products.id` and `materials.id` are `TEXT` (not UUID) — recipe FK columns must match
- Existing Postgres enums `allergen_type` and `diet_type` already exist — reuse them
- `users.id` = Firebase push-ID (`TEXT`); `users.auth_uid` = Supabase UUID — migration maps through this
- TypeScript `Allergen` enum only has `None`, `Lactose`, `Gluten` — aligns with the existing `allergen_type` Postgres enum
- The `RecipeObjectStructure<T>` pattern is a Firebase limitation — replaced with a flat `sort_order INT` column

**Key decisions:**

- `recipe_ratings` keeps a surrogate `id UUID` PK + `UNIQUE (recipe_id, user_id)` constraint, so `RecipeRatingRepository` can extend `BaseRepository` like all other repos
- Denormalized columns (`product_name`, `material_name`, `user_display_name`, etc.) are **not** stored — all resolved via JOINs
- `linked_recipes` is **not** included in this phase — will come in a later phase
- Firebase side effects (Feed entries, product/material change propagation) remain as-is for now; marked with TODO comments
- No one-letter variables anywhere — all lambdas use descriptive names (e.g. `recipes.filter(recipe => recipe.type === 'public')`)

---

### 1. New Postgres Enums

```sql
CREATE TYPE recipe_type AS ENUM ('public', 'private', 'variant');

CREATE TYPE menu_type AS ENUM (
  'none', 'main_course', 'side_dish', 'appetizer',
  'dessert', 'breakfast', 'snack', 'apero', 'beverage'
);

-- Shared by ingredients and preparation steps (sections appear in both)
CREATE TYPE recipe_ingredient_pos_type AS ENUM ('ingredient', 'section');
CREATE TYPE recipe_step_pos_type      AS ENUM ('step',       'section');
```

---

### 2. Table Design

#### 2.1 `recipes` — header table

> [!info] File
> `supabase/migrations/20260305000001_create_recipes.sql`

```sql
CREATE TABLE recipes (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE,                    -- migration only
  type recipe_type NOT NULL DEFAULT 'private',

  -- Core
  name     TEXT NOT NULL,
  portions INT  NOT NULL DEFAULT 1 CHECK (portions > 0),
  source   TEXT,
  picture_src TEXT,
  note     TEXT,
  tags     TEXT[] NOT NULL DEFAULT '{}',

  -- Times (minutes)
  time_preparation INT NOT NULL DEFAULT 0,
  time_rest        INT NOT NULL DEFAULT 0,
  time_cooking     INT NOT NULL DEFAULT 0,

  -- Categorisation & filtering
  menu_types               menu_type[]     NOT NULL DEFAULT '{}',
  outdoor_kitchen_suitable BOOLEAN         NOT NULL DEFAULT FALSE,
  diet                     diet_type       NOT NULL DEFAULT 'meat',
  allergens                allergen_type[] NOT NULL DEFAULT '{}',

  -- Rating aggregate (kept in sync by trigger)
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  no_ratings INT          NOT NULL DEFAULT 0,

  -- Status
  is_in_review BOOLEAN NOT NULL DEFAULT FALSE,

  -- Variant-specific (NULL for public/private)
  variant_name TEXT,
  variant_note TEXT,
  variant_event_id      TEXT,          -- FK to events.id added after event migration
  original_recipe_id    UUID REFERENCES recipes(id) ON DELETE SET NULL,
  original_recipe_type  recipe_type,
  original_recipe_creator_display_name TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_recipes_type       ON recipes(type);
CREATE INDEX idx_recipes_created_by ON recipes(created_by);
CREATE INDEX idx_recipes_tags       ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_menu_types ON recipes USING GIN(menu_types);

-- Full-text search vector
ALTER TABLE recipes ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('german', name || ' ' || array_to_string(tags, ' '))) STORED;
CREATE INDEX idx_recipes_fts ON recipes USING GIN(search_vector);
```

Creator display info (name, picture) is resolved via `JOIN public.users ON auth_uid = recipes.created_by`.

#### 2.2 `recipe_ingredients`

> [!info] File
> `supabase/migrations/20260305000002_create_recipe_ingredients.sql`

Replaces `ingredients: RecipeObjectStructure<Ingredient | Section>`. Sections are rows with `pos_type = 'section'`; they participate in ordering through `sort_order` just like ingredient rows.

```sql
CREATE TABLE recipe_ingredients (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  sort_order INT  NOT NULL,
  pos_type   recipe_ingredient_pos_type NOT NULL DEFAULT 'ingredient',

  -- Ingredient-specific (NULL when pos_type = 'section')
  product_id   TEXT REFERENCES products(id) ON DELETE SET NULL,
  quantity     NUMERIC,
  unit         TEXT,           -- unit key e.g. 'kg', 'dl'
  detail       TEXT,
  scaling_factor NUMERIC NOT NULL DEFAULT 1,

  -- Section-specific (NULL when pos_type = 'ingredient')
  section_name TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT chk_ingredient_requires_product
    CHECK (pos_type <> 'ingredient' OR product_id IS NOT NULL),
  CONSTRAINT chk_section_requires_name
    CHECK (pos_type <> 'section' OR section_name IS NOT NULL)
);

CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id, sort_order);
```

Product name resolved via `LEFT JOIN products ON id = product_id`. If a product was deleted (`product_id` becomes `NULL` via `ON DELETE SET NULL`), the UI shows a fallback label ("Unbekanntes Produkt").

#### 2.3 `recipe_preparation_steps`

> [!info] File
> `supabase/migrations/20260305000003_create_recipe_preparation_steps.sql`

```sql
CREATE TABLE recipe_preparation_steps (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  sort_order INT  NOT NULL,
  pos_type   recipe_step_pos_type NOT NULL DEFAULT 'step',

  step_text    TEXT,   -- NULL when pos_type = 'section'
  section_name TEXT,   -- NULL when pos_type = 'step'

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_recipe_steps_recipe ON recipe_preparation_steps(recipe_id, sort_order);
```

#### 2.4 `recipe_materials`

> [!info] File
> `supabase/migrations/20260305000004_create_recipe_materials.sql`

Materials don't use sections in the current TypeScript model, so this table stays flat.

```sql
CREATE TABLE recipe_materials (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  sort_order INT  NOT NULL,

  material_id   TEXT REFERENCES materials(id) ON DELETE SET NULL,
  quantity      NUMERIC NOT NULL DEFAULT 1,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_recipe_materials_recipe ON recipe_materials(recipe_id, sort_order);
```

Material name resolved via `LEFT JOIN materials ON id = material_id`. Same NULL-fallback pattern as ingredients.

#### 2.5 `recipe_ratings`

> [!info] File
> `supabase/migrations/20260305000005_create_recipe_ratings.sql`

```sql
CREATE TABLE recipe_ratings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating    SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),

  UNIQUE (recipe_id, user_id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Keeps surrogate `id` PK so `RecipeRatingRepository` can extend `BaseRepository`. The `UNIQUE (recipe_id, user_id)` constraint enforces one rating per user per recipe. Upsert uses `onConflict: 'recipe_id,user_id'`.

#### 2.6 `recipe_comments` (new feature)

> [!info] File
> `supabase/migrations/20260305000006_create_recipe_comments.sql`

```sql
CREATE TABLE recipe_comments (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  comment TEXT NOT NULL CHECK (LENGTH(TRIM(comment)) > 0),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_recipe_comments_recipe ON recipe_comments(recipe_id, created_at DESC);
```

User display info (name, avatar) resolved via `LEFT JOIN public.users ON auth_uid = user_id`. If user is deleted, UI shows "Gelöschter Nutzer". Comments are write-once (no edit — delete and re-post if needed).

---

### 3. Rating Aggregate Trigger

> [!info] File
> Part of `supabase/migrations/20260305000005_create_recipe_ratings.sql`

Keeps `recipes.avg_rating` and `recipes.no_ratings` up to date automatically — no app-level recalculation needed.

```sql
CREATE OR REPLACE FUNCTION update_recipe_rating_aggregate()
RETURNS TRIGGER AS $$
DECLARE target_recipe_id UUID;
BEGIN
  target_recipe_id := COALESCE(NEW.recipe_id, OLD.recipe_id);
  UPDATE recipes
  SET
    avg_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::NUMERIC, 2)
       FROM recipe_ratings WHERE recipe_id = target_recipe_id), 0),
    no_ratings = (SELECT COUNT(*)
       FROM recipe_ratings WHERE recipe_id = target_recipe_id)
  WHERE id = target_recipe_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recipe_rating_aggregate
AFTER INSERT OR UPDATE OR DELETE ON recipe_ratings
FOR EACH ROW EXECUTE FUNCTION update_recipe_rating_aggregate();
```

---

### 4. Ordering: `sort_order` replaces `RecipeObjectStructure`

The Firebase `{ entries: {uid: obj}, order: [uid, uid] }` pattern was needed because Firestore can't sort. In Postgres this is just a column.

**Storage:** Sequential integers with gaps of 10 (10, 20, 30…) so inserts between existing rows only update `sort_order` of the new row, not all subsequent ones. Occasional re-numbering only needed when the gaps fill up.

**Drag-and-drop reorder:** On `dragEnd`, the UI sends an ordered array of IDs → single `UPDATE recipe_ingredients SET sort_order = CASE id WHEN ... END WHERE recipe_id = ?`. Cheap for the typical ingredient count (<30 rows).

**Sections:** Simply a row with `pos_type = 'section'` and a `sort_order` between its ingredients. No special handling needed.

---

### 5. RLS Policies

| Table                                        | SELECT                                                               | INSERT                       | UPDATE                 | DELETE                          |
| -------------------------------------------- | -------------------------------------------------------------------- | ---------------------------- | ---------------------- | ------------------------------- |
| `recipes`                                    | public: all auth; private: own only; variant: own (event team later) | any auth user                | own OR communityLeader | own OR admin                    |
| `recipe_ingredients` / `steps` / `materials` | follows parent recipe via `EXISTS`                                   | own recipe only              | own recipe only        | own recipe only                 |
| `recipe_ratings`                             | all auth (public recipes)                                            | own (`user_id = auth.uid()`) | own only               | own only                        |
| `recipe_comments`                            | all auth (public recipes)                                            | any auth user                | own only               | own OR communityLeader OR admin |

---

### 6. Repository Classes

All in `src/components/Database/Repository/`.

#### 6.1 `RecipeRepository.ts`

**Key methods:**

- `getRecipeById(id, authUser)` — full recipe with all child rows (JOIN)
- `getAllPublicRecipes()` — header columns only, for list view
- `getUserRecipes(authUser)` — public + private for the authenticated user
- `getVariantsForEvent(eventId)` — for event context
- `insertRecipe(recipe, authUser)` — recipe + all child rows in a single transaction
- `updateRecipe(recipe, authUser)` — header + replace child rows in transaction
- `deleteRecipe(id, authUser)`

#### 6.2 Child Repositories

`RecipeIngredientRepository.ts`, `RecipePreparationStepRepository.ts`, `RecipeMaterialRepository.ts` — each has:

- `replaceAll(recipeId, items, authUser)` — delete + re-insert; used on recipe save
- `reorder(recipeId, orderedIds)` — update `sort_order` only; used on drag-end

#### 6.3 `RecipeRatingRepository.ts`

- `upsertRating(recipeId, rating, authUser)` → aggregate updated by trigger
- `getUserRating(recipeId, userId)` → `number | null`

#### 6.4 `RecipeCommentRepository.ts`

- `getComments(recipeId)` → `RecipeCommentDomain[]` ordered by `created_at DESC`
- `addComment(recipeId, comment, authUser)` — after successful insert, fire-and-forget call to `notify-recipe-comment` Edge Function
- `deleteComment(id, authUser)` — enforces own/communityLeader/admin via RLS

All registered in `DatabaseService` and exposed via `useDatabase()`.

---

### 7. Domain Object Changes (`recipe.class.ts`)

Replace `RecipeObjectStructure<T>` throughout with flat sorted arrays:

```typescript
// Before (Firebase pattern)
ingredients: RecipeObjectStructure<Ingredient | Section>;
// { entries: {uid: obj, …}, order: [uid, uid, …] }

// After (Supabase pattern)
ingredients: Array<Ingredient | Section>; // sorted by sort_order, already ordered
```

**Keep** (pure business logic, no Firebase): `checkRecipeData()`, `defineDietProperties()`, `scaleIngredients()`, `scaleMaterials()`, `createRecipeVariant()`, `deleteEmpty*()`, tag management helpers, `createEmpty*()` factory methods.

**Remove:** All static `save*()`, `delete*()`, `get*()` Firebase persistence methods.

**New domain interfaces** in the repository files:

- `RecipeDomain` — `id`, `type`, `name`, `portions`, `source`, `pictureSrc`, `note`, `tags`, time fields, categorisation fields, rating aggregates, variant fields, audit fields
- `RecipeIngredientDomain` — `id`, `recipeId`, `sortOrder`, `posType`, `productId?`, `quantity?`, `unit?`, `detail?`, `scalingFactor`, `sectionName?`
- `RecipeCommentDomain` — `id`, `recipeId`, `userId`, `comment`, `createdAt`

---

### 8. Migration Job

Three phases matching the requirement:

#### Phase 5a+5b: Public + Private Recipes (`RecipeMigrationJob.ts`)

**1. Build lookup maps:**

- products: `{ firebase_uid → supabase_id }` from `SELECT firebase_uid, id FROM products`
- materials: `{ firebase_uid → supabase_id }` from `SELECT firebase_uid, id FROM materials`
- users: `{ firebase_push_id → auth_uid }` from `SELECT id, auth_uid FROM public.users`

**2. For each recipe:**

1. Skip if already migrated (check `firebase_uid` in recipes table)
2. Map ingredient product UIDs via products lookup
3. Map material UIDs via materials lookup
4. Map `created.fromUid` → `auth_uid` via users lookup
5. Convert `RecipeObjectStructure` → flat array with `sort_order` (`order[]` gives the sequence; `entries{}` gives the data)
6. INSERT into `recipes`
7. INSERT `recipe_ingredients` with `sort_order = index * 10`
8. INSERT `recipe_preparation_steps` with `sort_order = index * 10`
9. INSERT `recipe_materials` with `sort_order = index * 10`
10. Read ratings subcollection → map user UIDs → INSERT `recipe_ratings`
11. Read comments subcollection → INSERT `recipe_comments`

**3. Order:** Public recipes first, then private recipes.

#### Phase 5e: Variant Recipes (deferred until after event migration)

- Read event Firebase→Supabase mapping from migrated events table
- Map `variantProperties.eventUid` → Supabase event UUID
- Map `variantProperties.originalRecipeUid` → Supabase recipe UUID (from phases 5a+5b)
- INSERT variant recipes with `variant_event_id` populated

---

### 9. Edge Function: `notify-recipe-comment`

> [!info] File
> `supabase/volumes/functions/notify-recipe-comment/index.ts`

**Trigger:** `RecipeCommentRepository.addComment()` calls `supabase.functions.invoke('notify-recipe-comment', { body: { commentId, recipeId } })` after successful insert. Fire-and-forget — a failed notification never blocks the comment being saved.

**Logic:**

1. Receive `{ commentId, recipeId }` via POST
2. Load comment from `recipe_comments` (get `comment`, `user_id`, `created_at`)
3. Load recipe from `recipes` (get `name`, `picture_src`, `created_by`)
4. Skip if commenter = recipe creator (no self-notification)
5. Load commenter display name from `public.users` via `auth_uid`
6. Load creator email from `auth.users` via `supabase.auth.admin.getUserById(created_by)` (service role)
7. Send email via SMTP

**Email design:**

- Teal header with chuchipirat logo (consistent branding)
- Recipe image as full-width card image below header (only if `picture_src` is set, otherwise a teal accent band)
- Comment text in a quoted block
- Single CTA button ("Rezept ansehen") linking to the recipe
- Footer with explanation and contact

**Pattern follows `notify-vestaboard` Edge Function:** `Deno.serve()` based, CORS preflight, POST only, service role key from `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.

---

### 10. UI Changes

#### 10.1 `recipes.tsx`

Replace `RecipeShort.getShortRecipes({firebase})` with `database.recipes.getAllPublicRecipes()`. Move diet/allergen/menuType filtering to SQL (server-side). Keep search UI. Drop firebase prop.

#### 10.2 `recipe.tsx`

Route to view/edit. Replace Firebase-based recipe fetch.

#### 10.3 `recipe.view.tsx`

Load via `database.recipes.getRecipeById()`. Add **Comments section** at the bottom (public recipes only): comment list + add form. Rating component stays. Drop Firebase deps.

**Comments UI:**

- Comment list with user avatar, display name, date, comment text
- Delete button (icon) visible to comment owner + communityLeader + admin
- Add comment form: single TextField + submit button (authenticated users only)
- No edit — comments are write-once

#### 10.4 `recipe.edit.tsx`

Use flat arrays instead of `RecipeObjectStructure`. Save via `database.recipes.insertRecipe()` / `updateRecipe()`. Drag-end handler calls `reorder()` instead of updating `order[]` array. Drop Firebase deps.

#### 10.5 `recipeCard.tsx`

Adapt to new `RecipeDomain` shape. Minor field renames.

#### 10.6 `recipePdf.tsx`

Iterate flat arrays instead of `order.map(uid => entries[uid])`.

> [!warning] Disabled with TODO (Firebase side effects, reimplemented in later phase)
>
> - `Feed.getNewestFeeds()` → "Newest Products" button: keep but disable
> - `Material.createMaterialFromProduct()` → "Convert to Material" context menu: keep but disable
> - Cloud Function triggers (change propagation) → skip, add TODO comment
> - Feed entries (`recipeCreated`, `recipePublished`, `recipeRated`) still write to Firebase Feed for now

---

### 11. Unit Tests

#### Repository Tests

| File                                      | Tests                                             |
| ----------------------------------------- | ------------------------------------------------- |
| `RecipeRepository.test.ts`                | Insert/get/update/delete; visibility by type      |
| `RecipeIngredientRepository.test.ts`      | `replaceAll`, `reorder`, `sort_order` correctness |
| `RecipePreparationStepRepository.test.ts` | Same pattern                                      |
| `RecipeMaterialRepository.test.ts`        | Same pattern                                      |
| `RecipeRatingRepository.test.ts`          | Upsert, aggregate trigger fires correctly         |
| `RecipeCommentRepository.test.ts`         | Add/delete, RLS for communityLeader               |

#### Domain / UI Tests

| File                                     | Tests                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `recipe.class.test.ts` (update existing) | Remove Firebase test paths, add tests for flat-array versions of `scaleIngredients`, `defineDietProperties` |
| `recipes.test.tsx`                       | List renders, filter panel, search                                                                          |
| `recipe.view.test.tsx`                   | Renders ingredients/steps/materials, comments section visibility, add/delete comment                        |
| `recipe.edit.test.tsx`                   | Save triggers correct repository calls, drag-reorder updates `sort_order`                                   |

---

### 12. Implementation Order

Execute in this sequence to keep the codebase compilable at each step:

1. SQL migrations (enums + 6 tables + rating trigger)
2. Repository classes (all 6) + DatabaseService update
3. Repository tests
4. Migration job (public recipes first, then private)
5. Domain class updates (strip Firebase methods, switch to flat arrays)
6. UI refactor (`recipes.tsx`, `recipe.view.tsx`, `recipe.edit.tsx`, `recipeCard.tsx`, `recipePdf.tsx`)
7. Comments UI + Edge Function `notify-recipe-comment`
8. UI tests
9. Final verification

> [!note] Phase 5e (variant recipe migration) is deferred until after Phase 6 (Events), as variant recipes require the new event IDs.

---

### 13. Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. `npx jest` — all tests pass (existing + new)
3. `npm start` — app loads
4. Run migration job via admin panel — public + private recipes migrate from Firebase to Postgres
5. Navigate to recipe list → recipes load, filtering works server-side
6. Open a public recipe → ingredients, steps, materials, ratings render correctly
7. Add a comment → comment appears, email notification sent to recipe creator
8. Edit a recipe → drag-reorder works, save persists correctly
9. Check PDF export → flat arrays render correctly

---

### Future Ideas / Improvements

- **Server-side search & filtering:** The `tsvector` column on recipes (already included in the migration) enables `WHERE search_vector @@ plainto_tsquery('german', ?)`. Replaces client-side Fuse.js. Diet/allergen/menuType filtering also moves to SQL `WHERE` clauses. The recipe list page stops loading all recipes into the client.
- **Eliminate `RecipeShort`:** The `000_allRecipes` pattern was a Firestore performance hack. A simple `SELECT` with header columns replaces it. No separate class needed.
- **`linked_recipes` junction table:** After all recipe types are migrated, normalize to a proper `recipe_linked_recipes(recipe_id, linked_recipe_id)` table.
- **Daily comment digest for community leaders:** Send all comments created that day to community leaders at the end of the day (separate Edge Function with a cron trigger).
- **Feed migration:** `recipeCreated`, `recipePublished`, `recipeRated` feed entries still write to Firebase Feed. After the Feed migration (later phase), they switch to `database.feeds.createEntry()`.
