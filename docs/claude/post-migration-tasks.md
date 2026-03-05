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

## Further tasks

*(Add new items here as they are discovered during ongoing migration work.)*
