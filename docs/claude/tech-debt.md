# Tech Debt

This file tracks code that violates current conventions but is not urgent enough to fix immediately. Claude Code appends new entries here automatically when encountered during work. Items are grouped by category, with priority and complexity to help with planning.

**Priority:** hoch (every release), mittel (when area is touched), tief (when time allows)
**Complexity:** klein (< 30 min, isolated change), mittel (1–3h, multiple files), gross (half day+, cross-cutting, needs thorough testing)

---

## Enums

Numeric TypeScript enums that need conversion to string enums matching PostgreSQL ENUM labels. See `database-and-supabase.md` for the target convention.

- **`MaterialType`** in `src/components/Material/material.class.ts` / `MaterialRepository.ts` — Uses numeric values (`none = 0, consumable = 1, usage = 2`). Convert to string enum, delete `MATERIAL_TYPE_TO_DB` / `MATERIAL_TYPE_FROM_DB` lookup maps, simplify `toRow()` / `toDomain()` to direct pass-through. Update `MaterialRow.type` and `MaterialDomain.type` types.
  **Priorität:** mittel · **Komplexität:** mittel

- **`Allergen` + `Diet`** in `src/components/Product/product.class.ts` / `ProductRepository.ts` — Uses numeric values. Convert to string enums, delete lookup maps, simplify `toRow()` / `toDomain()`, update `ProductRow` and `ProductDomain` types. Note: `Allergen.None` was a sentinel for "empty array" — after conversion, rely on empty array instead.
  **Priorität:** mittel · **Komplexität:** mittel

- **`EventTabs`** in `src/components/Event/Event/event.tsx` — Uses implicit numeric values (`menuplan = 0, quantityCalculation = 1, …`). Convert to string enum per project conventions. Currently used as MUI `<Tabs>` value and in multiple `useEffect` comparisons.
  **Priorität:** tief · **Komplexität:** mittel

## Missing DB Functions

- **`increment_field` RPC** — `BaseRepository.increment()` calls `rpc("increment_field", {...})` but no migration creates this function. Any code path calling `BaseRepository.increment()` will fail at runtime. Create migration with allowlist guard (see `security-guidelines.md` for pattern). Add tables to allowlist as needed.
  **Priorität:** hoch · **Komplexität:** klein

## Security / Auth

- **Admin-client bypass in profile picture uploads** — `User.uploadPicture()` and `User.deletePicture()` in `user.class.ts` use `database.admin?.storage.users ?? database.storage.users`, bypassing Storage RLS. Switch to regular client (`database.storage.users`), verify authenticated user has active Supabase session, remove `database.admin?.storage` fallback.
  **Priorität:** mittel · **Komplexität:** klein

## Performance

- **Recipe loading: 5 parallel queries** — `recipe.tsx` and `recipe.edit.tsx` load a recipe via 4–5 separate parallel Supabase queries, plus a full products list just for name resolution. Refactor to use PostgREST embedded resources (single query with joins). Add `RecipeFullRow` interface, `getRecipeFull(id)` to `RecipeRepository`, `Recipe.fromFullRow()` factory method. Remove `getAllProducts()` workaround. See `database-and-supabase.md` for PostgREST embedded resource syntax.
  **Priorität:** mittel · **Komplexität:** gross

## Naming

_(Claude Code: append entries here when you encounter single-letter variables, cryptic abbreviations, or misleading names during work.)_

## Error Handling

_(Claude Code: append entries here when you encounter `console.log` / `console.error` used instead of Sentry, missing error boundaries, or swallowed errors.)_

## Comments / Documentation

_(Claude Code: append entries here when you encounter English comments that should be German, missing JSDoc, or outdated/misleading comments.)_

## Other

_(Claude Code: append entries here for anything that doesn't fit the categories above. If a pattern repeats, create a new category.)_
