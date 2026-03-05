# Database & Supabase Conventions

Consult this file when creating/modifying Postgres tables, writing Repository code, or working with the Supabase layer.

## Repository Architecture

The Supabase persistence layer follows this structure:

```
DatabaseContext (useDatabase() hook)
  └── DatabaseService (singleton, bundles all repositories)
        └── BaseRepository (abstract CRUD with caching)
              └── Concrete Repository (toRow/toDomain mapping)
                    └── Supabase client → Postgres
```

**Key files:**

- `src/components/Database/DatabaseContext.tsx` — React Context + `useDatabase()` hook
- `src/components/Database/DatabaseService.ts` — Central entry point, exposes all repositories
- `src/components/Database/Repository/BaseRepository.ts` — Abstract base with `insert`, `findById`, `findMany`, `update`, `patch`, `upsert`, `increment`, `remove`, `subscribe`

**Existing repositories** (12):

| Repository | Entity | Phase |
|---|---|---|
| `UserRepository` | User profiles | 2 |
| `UserStorageRepository` | User file uploads | 2 |
| `GlobalSettingsRepository` | Global settings (singleton) | 3 |
| `SystemMessageRepository` | System messages (singleton) | 3 |
| `DepartmentRepository` | Departments | 4 |
| `UnitRepository` | Units | 4 |
| `MaterialRepository` | Materials | 4 |
| `ProductRepository` | Products | 4 |
| `UnitConversionBasicRepository` | Standard unit conversions | 4 |
| `UnitConversionProductRepository` | Product-specific unit conversions | 4 |

The `DatabaseService` also exposes an `admin` namespace with service-role client instances (bypasses RLS), used only for data migration. It is `null` if `REACT_APP_SUPABASE_SERVICE_ROLE_KEY` is not configured.

## Column Naming

- Use **snake_case** for all column and table names (e.g. `allow_sign_up`, `updated_at`)
- Domain models in TypeScript use **camelCase** — the Repository's `toRow()`/`toDomain()` handles the mapping

## Audit Columns

Every table **must** have these 4 audit columns:

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
```

- `created_at` — auto-set by DB default on INSERT; never changes
- `created_by` — auto-set by DB default (`auth.uid()`) on INSERT; never changes; FK to `auth.users(id)`
- `updated_at` — auto-updated by trigger `update_updated_at()` on every UPDATE
- `updated_by` — auto-updated by trigger `update_updated_by()` on every INSERT/UPDATE; FK to `auth.users(id)`
- Type is **UUID** (not TEXT) — matches `auth.users.id`
- `created_by` and `updated_by` are nullable — `auth.uid()` returns NULL for service-role / dashboard access (no JWT)
- `ON DELETE SET NULL` — if an auth account is deleted, the audit reference is cleared
- For singleton tables, `created_by` will be NULL (row is inserted during migration without JWT) — this is correct and expected

## Triggers

Every table needs these two triggers:

```sql
CREATE TRIGGER trg_<table>_updated_at
  BEFORE UPDATE ON public.<table>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_<table>_updated_by
  BEFORE INSERT OR UPDATE ON public.<table>
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();
```

- `update_updated_at()` — sets `updated_at = NOW()` on UPDATE
- `update_updated_by()` — sets `updated_by = auth.uid()` on INSERT/UPDATE

The trigger functions are shared across all tables (created in the first migration that needs them).

## Row Level Security (RLS)

- **Always** enable RLS: `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
- Create explicit policies for SELECT, INSERT, UPDATE, DELETE as needed
- Use `is_admin()` for admin-only write access
- Use `auth.uid()` for user-scoped access (e.g. `USING (auth_uid = auth.uid())`)
- Grant minimal permissions: `GRANT SELECT ON public.<table> TO anon, authenticated;`

## Singleton Tables

For configuration tables with exactly one row (e.g. `global_settings`, `system_messages`):

```sql
id TEXT PRIMARY KEY DEFAULT 'default',
-- ... columns ...
CONSTRAINT single_row CHECK (id = 'default')
```

Insert the default row at the end of the migration: `INSERT INTO public.<table> (id) VALUES ('default');`

## Enum Columns

Use **native PostgreSQL ENUM types** instead of `INTEGER` with a `CHECK` constraint whenever a column has a fixed set of named values. ENUMs are self-documenting in Supabase Studio, psql, and query results, and they reject invalid values at the DB level.

### Defining an enum type

```sql
-- Immer im public-Schema, immer vor CREATE TABLE
CREATE TYPE public.material_type AS ENUM ('none', 'consumable', 'usage');
```

Then reference it in the table:

```sql
type  public.material_type NOT NULL DEFAULT 'consumable',
```

For **arrays** of enum values (e.g. a multi-select like allergens):

```sql
CREATE TYPE public.allergen_type AS ENUM ('lactose', 'gluten');
-- ...
allergens  public.allergen_type[] NOT NULL DEFAULT '{}',
```

### Enum label conventions

- Use **lowercase English** labels that match the TypeScript enum key name lowercased (e.g. `Diet.Meat` → `'meat'`).
- Omit sentinel values that map to an empty array (e.g. `Allergen.None = 0` → not in the DB ENUM; an empty array expresses "no allergens").
- Document the mapping in a comment above the `CREATE TYPE`:

```sql
-- Enum fuer Materialtypen. Werte entsprechen MaterialType in material.class.ts
-- (none=0, consumable=1, usage=2).
CREATE TYPE public.material_type AS ENUM ('none', 'consumable', 'usage');
```

### Repository mapping

The TypeScript domain model keeps using the **existing numeric enum values** (e.g. `MaterialType`, `Diet`, `Allergen`). The Repository translates between DB strings and numeric values in `toRow()` / `toDomain()` — nothing else in the app changes.

Add two lookup objects at the top of the Repository file (outside the class):

```typescript
/** Zuordnung DB-ENUM-String → numerischer MaterialType-Wert. */
const MATERIAL_TYPE_FROM_DB: Record<string, number> = {
  none: 0,
  consumable: 1,
  usage: 2,
};

/** Zuordnung numerischer MaterialType-Wert → DB-ENUM-String. */
const MATERIAL_TYPE_TO_DB: Record<number, string> = {
  0: "none",
  1: "consumable",
  2: "usage",
};
```

Use them in `toRow()` and `toDomain()`:

```typescript
// toRow — numeric → DB string
type: MATERIAL_TYPE_TO_DB[domain.type] ?? "none",

// toDomain — DB string → numeric
type: MATERIAL_TYPE_FROM_DB[row.type] ?? 0,
```

For **enum arrays**, filter out any sentinel "none" value before writing and use a type guard when reading:

```typescript
// toRow — filter None (0), then map to strings
allergens: (domain.dietProperties.allergens ?? [])
  .filter((a) => a !== 0)
  .map((a) => ALLERGEN_TO_DB[a])
  .filter(Boolean),

// toDomain — map strings back to numbers, drop unknown values
allergens: (row.allergens ?? [])
  .map((a) => ALLERGEN_FROM_DB[a])
  .filter((a): a is number => a !== undefined),
```

The `ProductRow.allergens` type is `string[]` and `ProductRow.diet` is `string` — matching what Postgres returns. The domain types (`DietProperties.allergens: number[]`, `DietProperties.diet: number`) remain unchanged.

### Post-migration cleanup

The numeric↔string conversion in the Repository is **migration debt**. It exists only because Firebase stored enum values as integers and the Firebase code path is still active in parallel.

Once the Firebase migration is complete for a given entity:

1. Change the TypeScript enum to string values matching the DB labels:
   ```typescript
   // Vorher (Firebase-Ära)
   export enum MaterialType { none = 0, consumable = 1, usage = 2 }
   // Nachher (post-migration)
   export enum MaterialType { none = 'none', consumable = 'consumable', usage = 'usage' }
   ```
2. Delete the lookup maps from the Repository.
3. Simplify `toRow()` / `toDomain()` to pass the value directly — no conversion needed.
4. `MaterialRow.type` and the domain type both become `string` (or the enum type itself).

### When to use which approach

| Situation | Approach |
|---|---|
| Fixed named values (status, type, category) | PostgreSQL ENUM |
| Multi-value flags (allergens, tags) | PostgreSQL ENUM array |
| Numeric range without names (e.g. a score 1–10) | `INTEGER` with `CHECK` |
| Runtime-configurable values (admin can add/remove) | Lookup table with FK |

### Adding a new enum value later

PostgreSQL allows adding values to an existing ENUM without a table rewrite:

```sql
ALTER TYPE public.material_type ADD VALUE 'rental';
```

Renaming or removing values requires more work (create new type, migrate data, drop old type). Design your enum labels carefully upfront.

## App-Level Access

- Use the **regular Supabase client** (not service-role/admin) for reads and writes from authenticated users — this ensures `auth.uid()` is available in defaults and triggers
- Only use the **admin client** (service-role) for operations that genuinely need to bypass RLS (e.g. data migration, cross-user operations)
- The `BaseRepository` accepts `authUser` in CRUD methods for API consistency, but audit columns are populated **automatically by the database** via defaults and triggers — the app does **not** set them manually
