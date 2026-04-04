# Database & Supabase Conventions

Consult this file when creating/modifying Postgres tables, writing Repository code, or working with the Supabase layer. For the overall app architecture (3-layer pattern, Repository hierarchy), see `architecture.md`.

## Existing Repositories

| Repository                        | Entity                            | Phase |
| --------------------------------- | --------------------------------- | ----- |
| `UserRepository`                  | User profiles                     | 2     |
| `UserStorageRepository`           | User file uploads                 | 2     |
| `GlobalSettingsRepository`        | Global settings (singleton)       | 3     |
| `SystemMessageRepository`         | System messages (singleton)       | 3     |
| `DepartmentRepository`            | Departments                       | 4     |
| `UnitRepository`                  | Units                             | 4     |
| `MaterialRepository`              | Materials                         | 4     |
| `ProductRepository`               | Products                          | 4     |
| `UnitConversionBasicRepository`   | Standard unit conversions         | 4     |
| `UnitConversionProductRepository` | Product-specific unit conversions | 4     |

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

The trigger functions are shared across all tables (created in the first migration that needs them).

## Row Level Security (RLS)

- **Always** enable RLS: `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
- Create explicit policies for SELECT, INSERT, UPDATE, DELETE as needed
- Use `is_admin()` for admin-only write access
- Use `auth.uid()` for user-scoped access (e.g. `USING (auth_uid = auth.uid())`)
- Grant minimal permissions: `GRANT SELECT ON public.<table> TO anon, authenticated;`
- Remember: this is a **multi-user app** — multiple cooks share the same event. RLS policies must allow access for all authorized team members, not just the row creator.

## Singleton Tables

For configuration tables with exactly one row (e.g. `global_settings`, `system_messages`):

```sql
id TEXT PRIMARY KEY DEFAULT 'default',
-- ... columns ...
CONSTRAINT single_row CHECK (id = 'default')
```

Insert the default row at the end of the migration: `INSERT INTO public.<table> (id) VALUES ('default');`

## Enum Columns

Use **native PostgreSQL ENUM types** instead of `INTEGER` with a `CHECK` constraint whenever a column has a fixed set of named values.

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
allergens  public.allergen_type[] NOT NULL DEFAULT '{}',
```

### Enum label conventions

- Use **lowercase English** labels that match the TypeScript enum key name lowercased (e.g. `Diet.Meat` → `'meat'`)
- Omit sentinel values that map to an empty array (e.g. `Allergen.None = 0` → not in the DB ENUM)
- Document the mapping in a comment above the `CREATE TYPE`

### TypeScript ↔ DB alignment

New TypeScript enums **must** use string values that match the PostgreSQL ENUM labels exactly:

```typescript
// ✅ Korrekt — Werte stimmen mit DB ENUM überein
export enum Diet {
  meat = "meat",
  vegetarian = "vegetarian",
  vegan = "vegan",
}

// ❌ Falsch — numerische Werte erzeugen unnötigen Mapping-Overhead
export enum Diet {
  meat = 0,
  vegetarian = 1,
  vegan = 2,
}
```

This eliminates the need for lookup maps in Repositories — values pass through `toRow()` / `toDomain()` directly.

Existing numeric enums are **migration debt**. When you encounter one, don't fix it on the spot — add it to `.claude/docs/tech-debt.md` so it's tracked for cleanup.

### When to use which approach

| Situation                                          | Approach                                       |
| -------------------------------------------------- | ---------------------------------------------- |
| Fixed named values (status, type, category)        | PostgreSQL ENUM + string TypeScript enum       |
| Multi-value flags (allergens, tags)                | PostgreSQL ENUM array + string TypeScript enum |
| Numeric range without names (e.g. score 1–10)      | `INTEGER` with `CHECK`                         |
| Runtime-configurable values (admin can add/remove) | Lookup table with FK                           |

### Adding a new enum value later

```sql
ALTER TYPE public.material_type ADD VALUE 'rental';
```

Renaming or removing values requires more work (create new type, migrate data, drop old type). Design labels carefully upfront.

## Supabase Environments

- Three environments: **DEV / TEST / PROD** (hosted via Coolify on Hetzner)
- **NEVER work against PROD** — all development and testing in DEV or TEST only
- Migrations via Supabase CLI: `supabase migration new <n>`
- Always test RLS policies with both authenticated and anon roles
- Use `supabase db reset` to validate migration chain locally
