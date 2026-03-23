## Phase 9: Material List — Supabase Migration & Full Refactoring

### Context

The Material List manages event-level equipment/tool tracking (`MaterialType.usage` items). It shares ~80% of its architecture with the Shopping List but is simpler (no departments, no units, flat item list). The current code uses Firebase for persistence, has a monolithic 1468-line UI component, and lacks Realtime highlighting, Sentry logging, and the "responsible cook" assignment feature. This plan migrates to Supabase, refactors for quality/performance, and adds the cook assignment.

**Decisions (confirmed):**

- **Cook assignment:** Add as new feature in this phase (low-effort since we're rebuilding anyway)
- **Cook input:** Cooks + free-text — dropdown with event cooks as suggestions, also allows typing a custom name. Store free-text in `assigned_cook_name` column when not a known cook.
- **PDF cook column:** Yes — show assigned cook name as a 3rd column in the PDF

---

### Phase 9a: SQL Schema

> [!info] File
> `supabase/migrations/20260316000006_create_material_lists.sql`

#### Table: `event_material_lists` (header)

```sql
CREATE TABLE public.event_material_lists (
  id                       TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id                 TEXT        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  selected_menues          TEXT[]      DEFAULT '{}',
  selected_meals           TEXT[]      DEFAULT '{}',
  has_manually_added_items BOOLEAN     DEFAULT false,
  firebase_uid             TEXT,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
```

RLS: `is_event_cook(event_id)` for all CRUD. Index on `event_id`. Audit triggers. `REPLICA IDENTITY FULL`.

#### Table: `event_material_list_items` (child)

```sql
CREATE TABLE public.event_material_list_items (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  list_id             TEXT        NOT NULL REFERENCES public.event_material_lists(id) ON DELETE CASCADE,
  material_id         TEXT        REFERENCES public.materials(id) ON DELETE SET NULL,
  free_text_name      TEXT,
  quantity            NUMERIC     NOT NULL DEFAULT 0,
  checked             BOOLEAN     NOT NULL DEFAULT false,
  edit_source         public.shopping_list_edit_source NOT NULL DEFAULT 'generated',  -- reuse existing ENUM
  sort_order          INT         NOT NULL DEFAULT 0,
  assigned_cook_id    TEXT        REFERENCES public.event_cooks(id) ON DELETE SET NULL,  -- new feature
  assigned_cook_name  TEXT,       -- free-text cook name when not a registered cook (new feature)
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
```

**CHECK:** exactly one of `material_id` / `free_text_name` must be non-null.

`assigned_cook_id` and `assigned_cook_name` are both nullable — at most one should be set. If `assigned_cook_id` is set, use the cook's `display_name` from the VIEW. If `assigned_cook_name` is set, use that free-text value directly.

RLS: `EXISTS` subquery on parent + `is_event_cook`. Index on `list_id`. Audit triggers. `REPLICA IDENTITY FULL`.

#### VIEW: `event_material_list_items_view`

Joins: `materials` (name), `event_cooks` → `users` (`display_name` for cook).

Computes:

- `item_name` = `COALESCE(materials.name, free_text_name)`
- `resolved_cook_name` = `COALESCE(users.display_name, assigned_cook_name)` — prefers registered cook, falls back to free-text
- `assigned_cook_user_id` = `event_cooks.user_id` (nullable)

#### Differences from Shopping List schema

- No `selected_departments`, no `department_id`, no `unit`, no `product_id`
- Added `assigned_cook_id` / `assigned_cook_name` (new feature)
- Simpler CHECK constraint (2 options vs 3)
- Simpler VIEW (no department/unit resolution)

#### Realtime

> [!info] File
> `supabase/migrations/20260316000007_enable_realtime_material_lists.sql`

Add both tables to `supabase_realtime` publication.

---

### Phase 9b: `MaterialListRepository`

> [!info] File
> `src/components/Database/Repository/MaterialListRepository.ts`

Follow `ShoppingListRepository` pattern exactly.

**Domain types:**

- `MaterialListHeaderDomain` — `id`, `eventId`, `name`, `selectedMenues`, `selectedMeals`, `hasManuallyAddedItems`, `updatedAt`
- `MaterialListItemDomain` — `id`, `listId`, `materialId`, `freeTextName`, `quantity`, `checked`, `editSource`, `sortOrder`, `itemName`, `assignedCookId`, `assignedCookName`, `resolvedCookName`

**Methods** (mirror `ShoppingListRepository`):

| Method                                          | Description                            |
| ----------------------------------------------- | -------------------------------------- |
| `getListsForEvent(eventId)`                     | Headers sorted by `created_at`         |
| `getListItems(listId)`                          | Items from VIEW sorted by `sort_order` |
| `createList(eventId, header, items)`            | Insert header + bulk items             |
| `saveListItems(listId, items)`                  | DELETE + re-INSERT                     |
| `updateListHeader(listId, updates)`             | Partial header update                  |
| `updateItemChecked(itemId, checked)`            | Granular checkbox toggle               |
| `updateItem(itemId, updates)`                   | Includes `assigned_cook_id`            |
| `deleteList(listId)`                            | CASCADE handles items                  |
| `subscribeToLists(eventId, onData, onError)`    | Realtime with backoff retry            |
| `subscribeToListItems(listId, onData, onError)` | Realtime                               |

All error paths: `Sentry.captureException` + `Sentry.addBreadcrumb`.

Register in `DatabaseService`: add `materialLists` property (regular + admin). Add `STORAGE_OBJECT_PROPERTY.MATERIAL_LISTS` to `sessionStorageHandler`.

---

### Phase 9c: `materialListAdapter`

> [!info] File
> `src/components/Event/MaterialList/materialListAdapter.ts`

Bidirectional conversion between Supabase domain and legacy UI types:

- `headersDomainToMaterialList(headers, eventId)` → `MaterialList`
- `itemsDomainToMaterialListItems(items)` → `MaterialListMaterial[]`
- `materialListItemsToInsertRows(items, listId)` → `InsertRow[]`
- `deriveEditSource(item)` → `'generated' | 'manual_add' | 'manual_edit'`

Simpler than shopping list adapter (no department grouping, no unit resolution).

---

### Phase 9d: `materialList.class.ts` Refactoring

> [!info] File
> `src/components/Event/MaterialList/materialList.class.ts`

1. **Strip Firebase:** remove Firebase, AuthUser, Stats, logEvent imports + all Firebase persistence methods (`save`, `delete`, `getMaterialListListener`)
2. **Make `createNewList` synchronous:** accept pre-loaded recipes `{[key: string]: Recipe}` instead of firebase. Remove async, remove `Recipe.getMultipleRecipes` call, remove Stats/analytics. Return `MaterialListEntry` synchronously.
3. **Make `refreshList` synchronous:** same treatment — accept recipes param, remove async.
4. **Fix typos:** `manuelAdd` → `manualAdd`
5. **Remove `noOfLists`** (derived), **remove `lastChange`** (DB audit handles)
6. **Add `computeTrace()`** static method (on-demand trace calculation, matching ShoppingList pattern)
7. **Add `preserveManualItems()` and `mergeManualItems()`** (matching ShoppingList pattern for cleaner refresh logic)
8. **Add `countItems()`** helper
9. **Add Sentry breadcrumbs** in error paths
10. **German JSDoc** on all public methods

---

### Phase 9e: `useMaterialListHandlers` Hook

> [!info] File
> `src/components/Event/MaterialList/useMaterialListHandlers.tsx`

Extract all handler logic from `materialList.tsx` into a consolidated hook (pattern: `useShoppingListHandlers.tsx`).

Returns: all dialog state + handlers for create, refresh, checkbox, inline edit, context menu, trace, PDF, list CRUD. All persistence via `database.materialLists.*`.

Key change from current code: checkbox uses granular `updateItemChecked()`, inline edits use `updateItem()`, create/refresh use `createList()`/`saveListItems()`.

---

### Phase 9f: `materialList.tsx` UI Refactoring

> [!info] File
> `src/components/Event/MaterialList/materialList.tsx`

1. Remove Firebase prop and all Firebase usage
2. Add `useDatabase()` hook
3. Replace inline handlers with `useMaterialListHandlers(...)` call
4. Add `HighlightedMaterialListItemContext` support (highlight glow on Realtime changes)
5. Add **assigned cook dropdown** per item row (new feature — Autocomplete with event cooks, supports free-text)
6. Keep `QuantityField` and `EventMaterialListList` as memoized sub-components
7. Target: ~400–500 lines (down from 1468)

---

### Phase 9g: `event.tsx` Integration

> [!info] File
> `src/components/Event/Event/event.tsx`

1. Replace `MaterialList.getMaterialListListener` (Firebase) with `database.materialLists.subscribeToLists` + `subscribeToListItems`
2. Add `HighlightedMaterialListItemContext.Provider`
3. Remove `onMaterialListUpdate` callback (persistence in handlers now)

---

### Phase 9h: `materialListPdf.tsx` Refactoring

> [!info] File
> `src/components/Event/MaterialList/materialListPdf.tsx`

1. Extract `checkedCellStyle` helper (same as shopping list PDF)
2. Move `const styles = pdfStyles` to top
3. Add item count in subtitle: `"Name: Zeitraum (X Positionen)"`
4. Add assigned cook column if any item has an assigned cook
5. German JSDoc

---

### Phase 9i: `MaterialListMigrationJob`

> [!info] File
> `src/components/Admin/MigrationJobs/MaterialListMigrationJob.ts`

Follow `ShoppingListMigrationJob` pattern:

1. `fetchSourceRecords`: read `events/{uid}/docs/materialList` from Firestore
2. `buildLookupMaps`: events, materials, menues, meals (simpler than shopping list — no products, departments, units)
3. `migrateRecord`: insert headers + items with resolved FKs. Fallback to `free_text_name` if material UID not found.
4. Trace data NOT migrated (computed on-the-fly)

Register in `migrationJobRegistry.ts`.

---

### Phase 9j: `materialListHighlightContext`

> [!info] File
> `src/components/Event/MaterialList/materialListHighlightContext.ts`

```typescript
export const HighlightedMaterialListItemContext = React.createContext<
  Set<string>
>(new Set());
```

---

### Simplifications Identified

- Remove `noOfLists` — derived from `Object.keys(lists).length`
- Remove `lastChange` — DB audit columns handle this
- Remove inline trace storage — compute on-demand (saves DB space, simplifies item model)
- `Math.max` aggregation is correct — materials (tools/equipment) use the peak requirement, not the sum
- Fix `manuelAdd` typo → `manualAdd`
- `MaterialType.usage` filter is correct — consumable → shopping list, usage → material list

---

### Files Summary

#### SQL Migrations

| File                                                                    | Action     |
| ----------------------------------------------------------------------- | ---------- |
| `supabase/migrations/20260316000006_create_material_lists.sql`          | **Create** |
| `supabase/migrations/20260316000007_enable_realtime_material_lists.sql` | **Create** |

#### Repositories

| File                                                           | Action                           |
| -------------------------------------------------------------- | -------------------------------- |
| `src/components/Database/Repository/MaterialListRepository.ts` | **Create**                       |
| `src/components/Database/DatabaseService.ts`                   | **Modify** — add `materialLists` |
| `src/components/Firebase/Db/sessionStorageHandler.class.ts`    | **Modify** — add cache key       |

#### Domain / Adapter

| File                                                       | Action                                |
| ---------------------------------------------------------- | ------------------------------------- |
| `src/components/Event/MaterialList/materialListAdapter.ts` | **Create**                            |
| `src/components/Event/MaterialList/materialList.class.ts`  | **Modify** — strip Firebase, refactor |

#### UI Components

| File                                                                | Action                                   |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `src/components/Event/MaterialList/useMaterialListHandlers.tsx`     | **Create**                               |
| `src/components/Event/MaterialList/materialList.tsx`                | **Modify** — full refactoring            |
| `src/components/Event/MaterialList/materialListPdf.tsx`             | **Modify** — quality fixes + cook column |
| `src/components/Event/MaterialList/materialListHighlightContext.ts` | **Create**                               |
| `src/components/Event/Event/event.tsx`                              | **Modify** — Supabase subscription       |

#### Migration Jobs

| File                                                             | Action                    |
| ---------------------------------------------------------------- | ------------------------- |
| `src/components/Admin/MigrationJobs/MaterialListMigrationJob.ts` | **Create**                |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts`     | **Modify** — register job |

---

### Verification

1. `npx tsc --noEmit` — zero new errors
2. `npx jest` — all tests pass
3. Manual: create material list from menuplan → items appear correctly
4. Manual: checkbox toggle → persisted, visible to other users in real-time
5. Manual: add manual item (freetext) → preserved on refresh when "keep" selected
6. Manual: assign cook to item → visible in list and PDF
7. Manual: delete list → items cascade-deleted
8. Manual: PDF export → correct layout with item count
9. Manual: trace dialog → shows recipe/menu sourcing
10. Manual: drift detection → warning shown after menuplan changes
11. Migration: run `MaterialListMigrationJob` → Firebase data correctly in Supabase

---

### Future Ideas / Improvements

- **Cook assignment** (new feature in this phase) — allows distributing material responsibility across team
- **Sentry structured logging** — capture all error/warning paths for observability
- **Realtime highlights** — show other users' changes in real-time (currently missing, added in this phase)
- **On-demand trace** — eliminates trace data bloat in DB, always up-to-date
