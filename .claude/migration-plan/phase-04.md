## Phase 4: Masterdata Migration (Firebase → Supabase/Postgres)

### Context

All masterdata entities (departments, units, products, materials, unit conversions) are currently stored as single Firestore documents under `masterData/<entity>`. Each document is a flat object map `{[uid]: {fields...}}`. This phase migrates them to properly normalized Postgres tables with FK relationships, creates Repositories, migration jobs, updates UIs to use `useDatabase()`, and writes unit tests.

**Key decisions:**

- New UUIDs for all entities, old Firebase UID/key stored in `firebase_uid` column for later mapping
- Units referenced by key (`TEXT`, e.g. `"kg"`) as FK in other tables — avoids massive domain model changes since the entire codebase references units by key
- Two separate tables for unit conversions (basic + products) as they are separate Firestore documents
- Firebase side effects disabled with TODO: Features that rely on Firebase Cloud Functions or Firestore-specific data (Newest Products via Feed, Convert to Material, product/material change propagation) will be kept in the UI but disabled (grayed out) with TODO comments marking them for reimplementation with Supabase Edge Functions in a later phase
- Products get `name_singular` column (existing `name` is plural)

---

### 1. SQL Migrations

Migration order respects FK dependencies: departments + units first, then products + materials, then unit conversions.

#### 1.1 `departments`

> [!info] File
> `supabase/migrations/20260303000001_create_departments.sql`

```sql
CREATE TABLE public.departments (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,                          -- old Firebase UID for migration mapping
  name          TEXT NOT NULL DEFAULT '',
  pos           INTEGER NOT NULL DEFAULT 0,    -- sort position
  usable        BOOLEAN NOT NULL DEFAULT true,
  -- audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
-- RLS, policies (SELECT all, INSERT/UPDATE/DELETE admin only), grants, triggers
```

#### 1.2 `units`

> [!info] File
> `supabase/migrations/20260303000002_create_units.sql`

```sql
CREATE TABLE public.units (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,                          -- old Firebase key (e.g., "kg") for mapping
  key           TEXT UNIQUE NOT NULL,           -- abbreviation: "kg", "l", "stk"
  name          TEXT NOT NULL DEFAULT '',
  dimension     TEXT NOT NULL DEFAULT 'DLS' CHECK (dimension IN ('VOL','MAS','DLS')),
  -- audit columns
  ...
);
```

#### 1.3 `materials`

> [!info] File
> `supabase/migrations/20260303000003_create_materials.sql`

```sql
CREATE TABLE public.materials (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  name          TEXT NOT NULL DEFAULT '',
  type          INTEGER NOT NULL DEFAULT 0 CHECK (type IN (0, 1, 2)),  -- 0=none, 1=consumable, 2=usage
  usable        BOOLEAN NOT NULL DEFAULT true,
  -- audit columns
  ...
);
```

#### 1.4 `products`

> [!info] File
> `supabase/migrations/20260303000004_create_products.sql`

```sql
CREATE TABLE public.products (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid    TEXT,
  name            TEXT NOT NULL DEFAULT '',
  name_singular   TEXT NOT NULL DEFAULT '',      -- NEW: singular form of product name
  department_id   TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
  shopping_unit   TEXT REFERENCES public.units(key) ON DELETE SET NULL,  -- FK to units.key
  allergens       INTEGER[] NOT NULL DEFAULT '{}',  -- array of Allergen enum values
  diet            INTEGER NOT NULL DEFAULT 1 CHECK (diet IN (1, 2, 3)),  -- 1=Meat, 2=Vegetarian, 3=Vegan
  usable          BOOLEAN NOT NULL DEFAULT true,
  -- audit columns
  ...
);
```

#### 1.5 `unit_conversion_basic`

> [!info] File
> `supabase/migrations/20260303000005_create_unit_conversion_basic.sql`

```sql
CREATE TABLE public.unit_conversion_basic (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  from_unit     TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  to_unit       TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  numerator     INTEGER NOT NULL DEFAULT 1,
  denominator   INTEGER NOT NULL DEFAULT 1,
  -- audit columns
  ...
);
```

#### 1.6 `unit_conversion_products`

> [!info] File
> `supabase/migrations/20260303000006_create_unit_conversion_products.sql`

```sql
CREATE TABLE public.unit_conversion_products (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid  TEXT,
  from_unit     TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  to_unit       TEXT NOT NULL REFERENCES public.units(key) ON DELETE CASCADE,
  numerator     INTEGER NOT NULL DEFAULT 1,
  denominator   INTEGER NOT NULL DEFAULT 1,
  product_id    TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- audit columns
  ...
);
```

#### RLS Policy Summary

All tables include: RLS enabled, triggers for `updated_at`/`updated_by`.

| Table                      | SELECT            | INSERT            | UPDATE     | DELETE     |
| -------------------------- | ----------------- | ----------------- | ---------- | ---------- |
| `departments`              | all authenticated | admin only        | admin only | admin only |
| `units`                    | all authenticated | admin only        | admin only | admin only |
| `materials`                | all authenticated | all authenticated | admin only | admin only |
| `products`                 | all authenticated | all authenticated | admin only | admin only |
| `unit_conversion_basic`    | all authenticated | admin only        | admin only | admin only |
| `unit_conversion_products` | all authenticated | admin only        | admin only | admin only |

Products and materials allow INSERT by any authenticated user (users can create new products/materials), but only admins can UPDATE or DELETE.

---

### 2. Repositories

All in `src/components/Database/Repository/`. Follow existing pattern from `SystemMessageRepository`.

#### 2.1 `DepartmentRepository.ts`

| Aspect     | Detail                                                       |
| ---------- | ------------------------------------------------------------ |
| **Row**    | `id`, `firebase_uid`, `name`, `pos`, `usable`, audit columns |
| **Domain** | `uid`, `name`, `pos`, `usable`                               |

**Methods:**

- `getAllDepartments()` → `findMany({ orderBy: { field: "name", direction: "asc" } })`
- `createDepartment(name, pos, authUser)` → generates UID, calls `insert()`
- `saveAllDepartments(departments, authUser)` → upserts each department

**Mapping:** `toRow()` maps `{name, pos, usable}` (id auto-generated). `toDomain()` maps `row.id → uid`, rest 1:1.

#### 2.2 `UnitRepository.ts`

| Aspect     | Detail                                                          |
| ---------- | --------------------------------------------------------------- |
| **Row**    | `id`, `firebase_uid`, `key`, `name`, `dimension`, audit columns |
| **Domain** | `uid`, `key`, `name`, `dimension`                               |

**Methods:**

- `getAllUnits()` → `findMany({ orderBy: { field: "name", direction: "asc" } })`
- `createUnit(unit, authUser)` → inserts new row
- `saveAllUnits(units, authUser)` → upserts each unit

#### 2.3 `MaterialRepository.ts`

| Aspect     | Detail                                                        |
| ---------- | ------------------------------------------------------------- |
| **Row**    | `id`, `firebase_uid`, `name`, `type`, `usable`, audit columns |
| **Domain** | `uid`, `name`, `type`, `usable`                               |

**Methods:**

- `getAllMaterials(onlyUsable?)` → adds filter `{field: "usable", operator: "eq", value: true}` if `onlyUsable`
- `saveAllMaterials(materials, authUser)` → upserts each material

#### 2.4 `ProductRepository.ts`

| Aspect     | Detail                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Row**    | `id`, `firebase_uid`, `name`, `name_singular`, `department_id`, `shopping_unit`, `allergens`, `diet`, `usable`, audit columns |
| **Domain** | `uid`, `name`, `nameSingular`, `department: {uid, name}`, `shoppingUnit`, `dietProperties: {allergens, diet}`, `usable`       |

**Methods:**

- `getAllProducts(options)` → custom Supabase query: `.select('*, departments(name)')` for the JOIN
- `saveAllProducts(products, authUser)` → upserts each product

**Mapping:** `toRow()` flattens `department` to `department_id`, flattens `dietProperties` to separate `allergens` (`INTEGER[]`) + `diet` (`INTEGER`) columns. `toDomain()` reassembles `dietProperties: {allergens, diet}` from flat columns; uses `.select('*, departments(name)')` JOIN to populate `department.name`.

#### 2.5 `UnitConversionBasicRepository.ts`

| Aspect     | Detail                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| **Row**    | `id`, `firebase_uid`, `from_unit`, `to_unit`, `numerator`, `denominator`, audit columns |
| **Domain** | `uid`, `fromUnit`, `toUnit`, `numerator`, `denominator`                                 |

**Methods:**

- `getAllConversions()` → `findMany()`
- `saveAllConversions(conversions, authUser)` → fetches existing IDs, upserts present ones, deletes removed ones
- `deleteConversion(uid)` → calls `remove(uid)`

#### 2.6 `UnitConversionProductRepository.ts`

| Aspect     | Detail                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Row**    | `id`, `firebase_uid`, `from_unit`, `to_unit`, `numerator`, `denominator`, `product_id`, audit columns |
| **Domain** | `uid`, `fromUnit`, `toUnit`, `numerator`, `denominator`, `productUid`, `productName`                  |

**Methods:**

- `getAllConversions()` → custom query: `.select('*, products(name)')` for JOIN
- `saveAllConversions(conversions, authUser)` → same save/delete pattern as `BasicRepository`
- `deleteConversion(uid)` → calls `remove(uid)`

---

### 3. DatabaseService Updates

> [!info] File
> `src/components/Database/DatabaseService.ts`

Add 6 new repository properties:

```typescript
departments: DepartmentRepository;
units: UnitRepository;
materials: MaterialRepository;
products: ProductRepository;
unitConversionBasic: UnitConversionBasicRepository;
unitConversionProducts: UnitConversionProductRepository;
```

Same pattern for `admin` object (with admin client). Update `DatabaseService.test.ts` accordingly.

---

### 4. Migration Jobs

All in `src/components/Admin/MigrationJobs/`. Follow `UserMigrationJob` pattern.

**Migration order** (documented in registry):

1. `departments` + `units` (no dependencies)
2. `products` (needs departments migrated first for FK resolution)
3. `materials` (no dependencies)
4. `unit_conversion_basic` (needs units)
5. `unit_conversion_products` (needs units + products)

#### 4.1 `DepartmentMigrationJob.ts`

- `fetchSourceRecords()`: reads `masterData/departments` doc, converts each `{[uid]: {name, pos, usable}}` entry to `SourceRecord`
- `checkExists()`: `database.admin.departments.findMany({ filters: [{field: "firebase_uid", operator: "eq", value: record.id}] })`
- `migrateRecord()`: `database.admin.departments.insert({ value: {name, pos, usable}, authUser })` — then patch `firebase_uid`

#### 4.2 `UnitMigrationJob.ts`

- `fetchSourceRecords()`: reads `masterData/units` doc, converts each `{[key]: {name, dimension}}`
- `checkExists()`: checks by `firebase_uid` (= key)
- `migrateRecord()`: inserts with `key`, `name`, `dimension` + sets `firebase_uid = key`

#### 4.3 `ProductMigrationJob.ts`

- `fetchSourceRecords()`: reads `masterData/products` doc
- `migrateRecord()`: resolves department FK — looks up department by `firebase_uid` to get Postgres ID. Shopping unit stays as key (TEXT FK).

#### 4.4 `MaterialMigrationJob.ts`

- Simple 1:1 mapping: `uid`, `name`, `type`, `usable`

#### 4.5 `UnitConversionBasicMigrationJob.ts`

- Maps `fromUnit`/`toUnit` directly (they're already unit keys which match `units.key`)

#### 4.6 `UnitConversionProductMigrationJob.ts`

- Resolves product FK: looks up product by `firebase_uid` to get Postgres ID
- Maps `fromUnit`/`toUnit` directly as keys

#### Registry Update

> [!info] File
> `src/components/Admin/MigrationJobs/migrationJobRegistry.ts`

```typescript
export const migrationJobRegistry: Record<string, MigrationJob> = {
  users: new UserMigrationJob(),
  images: new ImageMigrationJob(),
  departments: new DepartmentMigrationJob(),
  units: new UnitMigrationJob(),
  products: new ProductMigrationJob(),
  materials: new MaterialMigrationJob(),
  unitConversionBasic: new UnitConversionBasicMigrationJob(),
  unitConversionProducts: new UnitConversionProductMigrationJob(),
};
```

---

### 5. Domain Class Updates (strip DB code)

Each `.class.ts` file: remove all Firebase DB methods, keep pure business logic.

#### 5.1 `department.class.ts`

|            | Methods                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Remove** | `getAllDepartments()`, `createDepartment()`, `saveAllDepartments()` → moved to `DepartmentRepository` |
| **Keep**   | `setPositionForDepartment()`, `_sortListByPos()` (pure logic)                                         |

#### 5.2 `unit.class.ts`

|            | Methods                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| **Remove** | `getAllUnits()`, `createUnit()`, `saveUnits()` → moved to `UnitRepository` |
| **Keep**   | `getDimensionOfUnit()` (pure logic), `UnitDimension` enum, constructor     |

#### 5.3 `unitConversion.class.ts`

|            | Methods                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remove** | `getAllConversionBasic()`, `getAllConversionProducts()`, `saveUnitConversions()` → moved to Repositories                                                |
| **Keep**   | `createUnitConversionBasic()`, `createUnitConversionProduct()`, `deleteUnitConversion()`, `convertQuantity()` (pure factory/logic methods, no DB calls) |

#### 5.4 `product.class.ts`

|            | Methods                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remove** | `getAllProducts()`, `createProduct()`, `saveAllProducts()`, `mergeProducts()`, `createProductFromMaterial()` → moved to Repository + deferred Cloud Functions |
| **Keep**   | `createEmptyDietProperty()`, `findSimilarProducts()` (pure logic), `Allergen`/`Diet`/`DietProperties` types                                                   |

#### 5.5 `material.class.ts`

|            | Methods                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Remove** | `getAllMaterials()`, `createMaterial()`, `saveAllMaterials()`, `createMaterialFromProduct()`, `mergeMaterials()` → moved to Repository + deferred |
| **Keep**   | `MaterialType` enum, constructor                                                                                                                  |

---

### 6. UI Updates

Replace `useFirebase()` with `useDatabase()` for all data operations. Remove Firebase imports.

#### 6.1 `departments.tsx`

| Before                                                             | After                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `const firebase = useFirebase()`                                   | `const database = useDatabase()`                                 |
| `Department.getAllDepartments({firebase})`                         | `database.departments.getAllDepartments()`                       |
| `Department.saveAllDepartments({firebase, departments, authUser})` | `database.departments.saveAllDepartments(departments, authUser)` |
| `import {useFirebase}`                                             | `import {useDatabase}`                                           |

Keep: `Department.setPositionForDepartment()` (pure logic, no Firebase).

#### 6.2 `dialogDepartment.tsx`

| Before                                                         | After                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Receives `firebase: Firebase` prop                             | Use `useDatabase()` hook                                     |
| `Department.createDepartment({firebase, name, pos, authUser})` | `database.departments.createDepartment(name, pos, authUser)` |

Remove `firebase` prop from interface and parent call site in `departments.tsx`.

#### 6.3 `units.tsx`

| Before                                        | After                                          |
| --------------------------------------------- | ---------------------------------------------- |
| `Unit.getAllUnits({firebase})`                | `database.units.getAllUnits()`                 |
| `Unit.saveUnits({firebase, units, authUser})` | `database.units.saveAllUnits(units, authUser)` |
| `Unit.createUnit({firebase, unit, authUser})` | `database.units.createUnit(unit, authUser)`    |

#### 6.4 `unitConversion.tsx`

| Before                                                                      | After                                                                                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `UnitConversion.getAllConversionBasic({firebase})`                          | `database.unitConversionBasic.getAllConversions()`                                                                                            |
| `UnitConversion.getAllConversionProducts({firebase})`                       | `database.unitConversionProducts.getAllConversions()`                                                                                         |
| `UnitConversion.saveUnitConversions({firebase, basic, products, authUser})` | `database.unitConversionBasic.saveAllConversions(basic, authUser)` + `database.unitConversionProducts.saveAllConversions(products, authUser)` |
| `Product.getAllProducts({firebase, onlyUsable: true})`                      | `database.products.getAllProducts({onlyUsable: true})`                                                                                        |
| `Unit.getAllUnits({firebase})`                                              | `database.units.getAllUnits()`                                                                                                                |

> [!note] Notes
>
> - `UnitConversion.createUnitConversionBasic/Product()` are pure factory methods (no DB call) — keep as-is.
> - `Utils.convertObjectToArray()` no longer needed (data comes as arrays from Postgres).

#### 6.5 `products.tsx`

| Before                                                               | After                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `Product.getAllProducts({firebase, onlyUsable, withDepartmentName})` | `database.products.getAllProducts({onlyUsable, withDepartmentName})` |
| `Product.saveAllProducts({firebase, products, authUser})`            | `database.products.saveAllProducts(products, authUser)`              |
| `Department.getAllDepartments({firebase})`                           | `database.departments.getAllDepartments()`                           |
| `Unit.getAllUnits({firebase})`                                       | `database.units.getAllUnits()`                                       |

> [!warning] Disabled with TODO (Firebase side effects, reimplemented in later phase)
>
> - `Feed.getNewestFeeds()` → "Newest Products" button: keep but disable, add `// TODO: Reimplement with Supabase`
> - `Material.createMaterialFromProduct()` → "Convert to Material" context menu: keep but disable
> - Cloud Function triggers in `saveAllProducts` (change propagation) → skip, add TODO comment

#### 6.6 `materials.tsx`

| Before                                                       | After                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `Material.getAllMaterials({firebase, onlyUsable})`           | `database.materials.getAllMaterials(onlyUsable)`           |
| `Material.saveAllMaterials({firebase, materials, authUser})` | `database.materials.saveAllMaterials(materials, authUser)` |

#### 6.7 Dialog files

- `dialogDepartment.tsx`: Remove `firebase` prop, use `useDatabase()`, call repository
- `dialogCreateUnit.tsx`: No changes needed (no Firebase dependency — parent handles persistence)
- `dialogCreateUnitConversion.tsx`: Remove `firebase` prop (unused for DB calls)
- `dialogProduct.tsx`: Check for Firebase usage, update if needed
- `dialogMaterial.tsx`: Check for Firebase usage, update if needed

---

### 7. Unit Tests

#### 7.1 Repository tests (6 files)

Each in `src/components/Database/Repository/__tests__/`:

- `DepartmentRepository.test.ts`
- `UnitRepository.test.ts`
- `MaterialRepository.test.ts`
- `ProductRepository.test.ts`
- `UnitConversionBasicRepository.test.ts`
- `UnitConversionProductRepository.test.ts`

Follow existing `SystemMessageRepository.test.ts` pattern: mock Supabase client, test `toRow`/`toDomain` mapping, test convenience methods.

#### 7.2 UI component tests (5 files)

Each in the component's `__tests__/` folder:

- `Department/__tests__/departments.test.tsx`
- `Unit/__tests__/units.test.tsx`
- `Unit/__tests__/unitConversion.test.tsx`
- `Product/__tests__/products.test.tsx`
- `Material/__tests__/materials.test.tsx`

Follow existing `systemMessageOverview.test.tsx` pattern: mock `DatabaseContext`, `useAuthUser`, render with providers, test data loading, edit mode, save, error handling.

No tests for migration jobs — they are one-time-use tools and not worth the test investment.

#### 7.3 DatabaseService test update

Update `DatabaseService.test.ts` to verify 6 new repository properties are instantiated.

---

### 8. Files Summary

#### SQL Migrations

| File                                                                     | Action     |
| ------------------------------------------------------------------------ | ---------- |
| `supabase/migrations/20260303000001_create_departments.sql`              | **Create** |
| `supabase/migrations/20260303000002_create_units.sql`                    | **Create** |
| `supabase/migrations/20260303000003_create_materials.sql`                | **Create** |
| `supabase/migrations/20260303000004_create_products.sql`                 | **Create** |
| `supabase/migrations/20260303000005_create_unit_conversion_basic.sql`    | **Create** |
| `supabase/migrations/20260303000006_create_unit_conversion_products.sql` | **Create** |

#### Repositories

| File                                                                    | Action     |
| ----------------------------------------------------------------------- | ---------- |
| `src/components/Database/Repository/DepartmentRepository.ts`            | **Create** |
| `src/components/Database/Repository/UnitRepository.ts`                  | **Create** |
| `src/components/Database/Repository/MaterialRepository.ts`              | **Create** |
| `src/components/Database/Repository/ProductRepository.ts`               | **Create** |
| `src/components/Database/Repository/UnitConversionBasicRepository.ts`   | **Create** |
| `src/components/Database/Repository/UnitConversionProductRepository.ts` | **Create** |

#### DatabaseService

| File                                                        | Action                        |
| ----------------------------------------------------------- | ----------------------------- |
| `src/components/Database/DatabaseService.ts`                | **Update** — add 6 repos      |
| `src/components/Database/__tests__/DatabaseService.test.ts` | **Update** — test 6 new repos |

#### Migration Jobs

| File                                                                      | Action                       |
| ------------------------------------------------------------------------- | ---------------------------- |
| `src/components/Admin/MigrationJobs/DepartmentMigrationJob.ts`            | **Create**                   |
| `src/components/Admin/MigrationJobs/UnitMigrationJob.ts`                  | **Create**                   |
| `src/components/Admin/MigrationJobs/MaterialMigrationJob.ts`              | **Create**                   |
| `src/components/Admin/MigrationJobs/ProductMigrationJob.ts`               | **Create**                   |
| `src/components/Admin/MigrationJobs/UnitConversionBasicMigrationJob.ts`   | **Create**                   |
| `src/components/Admin/MigrationJobs/UnitConversionProductMigrationJob.ts` | **Create**                   |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts`              | **Update** — register 6 jobs |

#### Domain Classes

| File                                            | Action                        |
| ----------------------------------------------- | ----------------------------- |
| `src/components/Department/department.class.ts` | **Update** — strip DB methods |
| `src/components/Unit/unit.class.ts`             | **Update** — strip DB methods |
| `src/components/Unit/unitConversion.class.ts`   | **Update** — strip DB methods |
| `src/components/Product/product.class.ts`       | **Update** — strip DB methods |
| `src/components/Material/material.class.ts`     | **Update** — strip DB methods |

#### UI Components

| File                                                 | Action                              |
| ---------------------------------------------------- | ----------------------------------- |
| `src/components/Department/departments.tsx`          | **Update** — `useDatabase`          |
| `src/components/Department/dialogDepartment.tsx`     | **Update** — remove `firebase` prop |
| `src/components/Unit/units.tsx`                      | **Update** — `useDatabase`          |
| `src/components/Unit/unitConversion.tsx`             | **Update** — `useDatabase`          |
| `src/components/Unit/dialogCreateUnitConversion.tsx` | **Update** — remove `firebase` prop |
| `src/components/Product/products.tsx`                | **Update** — `useDatabase`          |
| `src/components/Material/materials.tsx`              | **Update** — `useDatabase`          |

#### Tests

| File                                                                                   | Action     |
| -------------------------------------------------------------------------------------- | ---------- |
| `src/components/Database/Repository/__tests__/DepartmentRepository.test.ts`            | **Create** |
| `src/components/Database/Repository/__tests__/UnitRepository.test.ts`                  | **Create** |
| `src/components/Database/Repository/__tests__/MaterialRepository.test.ts`              | **Create** |
| `src/components/Database/Repository/__tests__/ProductRepository.test.ts`               | **Create** |
| `src/components/Database/Repository/__tests__/UnitConversionBasicRepository.test.ts`   | **Create** |
| `src/components/Database/Repository/__tests__/UnitConversionProductRepository.test.ts` | **Create** |
| `src/components/Department/__tests__/departments.test.tsx`                             | **Create** |
| `src/components/Unit/__tests__/units.test.tsx`                                         | **Create** |
| `src/components/Unit/__tests__/unitConversion.test.tsx`                                | **Create** |
| `src/components/Product/__tests__/products.test.tsx`                                   | **Create** |
| `src/components/Material/__tests__/materials.test.tsx`                                 | **Create** |

> [!summary] Total
> ~44 files (6 SQL + 6 repos + 6 migration jobs + 5 class updates + 7 UI updates + 1 service update + ~13 test files)

---

### 9. Implementation Order

Execute in this sequence to keep the codebase compilable at each step:

1. SQL migrations (all 6 tables)
2. Repositories (all 6) + DatabaseService update
3. DatabaseService test update
4. Repository tests (all 6)
5. Migration jobs (all 6) + registry update (no tests — one-time-use)
6. Class updates (strip DB code from all 5 `.class.ts` files)
7. UI updates (all 7 component files)
8. UI tests (all 5)
9. Final verification

---

### 10. Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. `npx jest` — all tests pass (existing + new)
3. `npm start` — app loads
4. Navigate to each masterdata page (Departments, Units, Unit Conversion, Products, Materials) — pages render, data loads (once migration jobs have been run)
5. Test edit/save flow on each page
6. Run migration jobs via admin panel — data migrates from Firebase to Postgres
