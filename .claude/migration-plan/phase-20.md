## Product Quality Assurance Tool — Enhanced Products Page

### Context

~2,300 products in production need quality cleanup: duplicates, wrong categories, misspellings, products that should be materials. Currently, the products page has basic inline editing (checkboxes only) and one-at-a-time dialog editing. The admin needs an efficient way to systematically review and clean up all products.

**Decision:** Enhance the existing products page (admin-only) rather than building a separate page or Excel roundtrip.

**Requirements Summary:**

- **Department review:** Filter by department, review/edit all fields, mark as QA'd
- **Duplicate detection:** Fuzzy matching (`pg_trgm`) + manual synonym pairs (Rüebli/Karotten)
- **Auto-detection:** Department outliers (diet mismatch), missing fields
- **Merge:** Select 2 products → merge dialog → RPC `merge_products`
- **Convert to material:** From grid context menu → RPC `convert_product_to_material`
- **QA tracking:** `qa_checked` boolean + `qa_checked_at` timestamp
- **Bulk actions:** Multi-select → change department/diet/allergens for all selected

---

### Phase 1: Database Migrations

#### Migration 1: QA columns on products

> [!info] File
> `supabase/migrations/20260330000001_product_qa_columns.sql`

```sql
ALTER TABLE public.products
  ADD COLUMN qa_checked    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN qa_checked_at TIMESTAMPTZ;
CREATE INDEX idx_products_qa_checked ON public.products (qa_checked);
```

#### Migration 2: `pg_trgm` extension + index

> [!info] File
> `supabase/migrations/20260330000002_enable_pg_trgm.sql`

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);
```

#### Migration 3: `product_synonyms` table

> [!info] File
> `supabase/migrations/20260330000003_create_product_synonyms.sql`

```sql
CREATE TABLE public.product_synonyms (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name_a TEXT NOT NULL,
  name_b TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (name_a, name_b)
);
-- RLS: SELECT for authenticated, INSERT/UPDATE/DELETE for admins
-- Triggers: update_updated_at, update_updated_by
```

#### Migration 4: `find_similar_products` RPC

> [!info] File
> `supabase/migrations/20260330000004_find_similar_products_rpc.sql`

```sql
CREATE OR REPLACE FUNCTION public.find_similar_products(
  similarity_threshold FLOAT DEFAULT 0.3
) RETURNS JSONB
-- Uses pg_trgm similarity() on self-join of products
-- Returns array of {product_a_id, product_a_name, product_b_id, product_b_name, similarity}
-- Also matches synonym pairs from product_synonyms table
```

---

### Phase 2: Repository & Type Layer

#### Extend Product types

- Add `qaChecked: boolean` and `qaCheckedAt: string | null` to `Product` type
- Add `qa_checked` and `qa_checked_at` to `ProductRow`

#### Extend `ProductRepository`

- Update `toRow()` / `toDomain()` mappings for QA fields
- Add `findSimilarProducts(threshold)` method (calls RPC)

#### New: `ProductSynonymRepository`

- Standard CRUD for `product_synonyms` table
- Register in `DatabaseService` as `database.productSynonyms`

#### Extend `AdminOperationsRepository`

- Add `findSimilarProducts()` RPC wrapper with result type `SimilarProductPair`

**Files:**

| File                                                              | Action                             |
| ----------------------------------------------------------------- | ---------------------------------- |
| `src/components/Product/product.types.ts`                         | **Modify** — extend Product type   |
| `src/components/Database/Repository/ProductRepository.ts`         | **Modify** — QA fields + RPC       |
| `src/components/Database/Repository/ProductSynonymRepository.ts`  | **Create**                         |
| `src/components/Database/Repository/AdminOperationsRepository.ts` | **Modify** — add RPC wrapper       |
| `src/components/Database/DatabaseService.ts`                      | **Modify** — register synonym repo |

---

### Phase 3: Extract State into Custom Hook

The current `products.tsx` is 1,209 lines. Before adding features, extract:

#### New: `useProductsQa.ts`

- Move reducer (`ReducerActions`, `State`, reducer function) out of `products.tsx`
- Move data-fetching logic (products, departments, units, newest UIDs)
- Add new reducer actions: `QA_TOGGLE`, `BULK_DEPARTMENT_CHANGE`, `BULK_DIET_CHANGE`, `DUPLICATES_LOADED`, `SYNONYM_PAIRS_LOADED`, `PRODUCTS_MERGED`
- Add new state: `similarProducts`, `synonymPairs`, `selectedProductUids`, `issueFlags`
- Expose all handlers the UI needs

**Files:**

| File                                      | Action                                |
| ----------------------------------------- | ------------------------------------- |
| `src/components/Product/useProductsQa.ts` | **Create** — custom hook              |
| `src/components/Product/products.tsx`     | **Modify** — refactor to use the hook |

---

### Phase 4: Enhanced Filter Bar

Replace the simple `SearchPanel` with a multi-criteria filter toolbar.

#### New: `productsQaFilterBar.tsx`

- Text search (existing, kept)
- Department dropdown (MUI `Select`) — filter to one department
- QA Status toggle (All / Unchecked / Checked)
- "Has Issues" chip — show only products flagged by auto-detection
- "Newest" chip (existing, adapted)
- Product count display

**Files:**

| File                                             | Action                             |
| ------------------------------------------------ | ---------------------------------- |
| `src/components/Product/productsQaFilterBar.tsx` | **Create**                         |
| `src/components/Product/products.tsx`            | **Modify** — replace `SearchPanel` |

---

### Phase 5: Inline Editing & QA Column

Make all DataGrid columns editable inline (not just checkboxes):

- **Name:** editable text
- **Department:** inline Autocomplete
- **Shopping Unit:** inline Autocomplete
- **Diet:** inline Select dropdown
- **Lactose/Gluten:** checkboxes (already works)
- **Usable:** checkbox (already works)
- **QA Checked:** new checkbox column, auto-sets `qa_checked_at` on toggle
- **Issues:** new column with warning icons (tooltip with details)

**Files:**

| File                                  | Action                                   |
| ------------------------------------- | ---------------------------------------- |
| `src/components/Product/products.tsx` | **Modify** — enhanced column definitions |

---

### Phase 6: Multi-Select & Bulk Actions

#### DataGrid multi-select

- Enable `checkboxSelection` on DataGrid
- Track selected row IDs in state

#### New: `productsQaBulkActions.tsx`

Floating toolbar when rows are selected:

- "N Produkte ausgewählt"
- "Abteilung ändern" → department picker → apply to all selected
- "Diät ändern" → diet picker → apply to all selected
- "QA geprüft" → mark all selected as checked
- "Zusammenführen" (enabled only when exactly 2 selected) → merge dialog

Uses existing save mechanism: bulk changes add UIDs to `changedUids`, existing `onSave()` persists.

**Files:**

| File                                               | Action                         |
| -------------------------------------------------- | ------------------------------ |
| `src/components/Product/productsQaBulkActions.tsx` | **Create**                     |
| `src/components/Product/products.tsx`              | **Modify** — integrate toolbar |

---

### Phase 7: Merge Workflow

#### New: `dialogMergeProducts.tsx`

- Side-by-side comparison of both products
- Reference counts via `where_used` RPC
- Radio buttons to select target (kept) vs source (deleted)
- Calls `merge_products` RPC on confirm
- Result protocol after merge

**Launchable from:**

- Bulk action toolbar (2 selected)
- Duplicate detection panel ("Zusammenführen" button on pair)

**Files:**

| File                                             | Action     |
| ------------------------------------------------ | ---------- |
| `src/components/Product/dialogMergeProducts.tsx` | **Create** |

---

### Phase 8: Auto-Detection

#### New: `productQaUtils.ts`

Pure functions for issue detection:

- **Fuzzy duplicates:** Call `find_similar_products` RPC, display results panel
- **Department outliers:** If product's diet differs from >80% of products in same department → flag
- **Missing fields:** No department, no shopping unit → flag
- **Issue scoring:** Sort products by number of detected issues

#### Duplicate detection panel

When "Duplikate suchen" is clicked → collapsible panel above grid:

- List of similar pairs with similarity score
- "Zusammenführen" button per pair → opens merge dialog pre-filled
- Synonym-matched pairs labeled as "Synonym-Treffer"

#### New: `dialogSynonymPairs.tsx`

CRUD dialog for managing synonym pairs in `product_synonyms`.

**Files:**

| File                                            | Action                             |
| ----------------------------------------------- | ---------------------------------- |
| `src/components/Product/productQaUtils.ts`      | **Create**                         |
| `src/components/Product/dialogSynonymPairs.tsx` | **Create**                         |
| `src/constants/text/productQa.ts`               | **Create** — German text constants |

---

### Key Architectural Decisions

1. **Enhance existing page** — products page is already admin-only, no need for separate QA page
2. **Extract hook** — `useProductsQa.ts` keeps `products.tsx` under control
3. **`pg_trgm` server-side** — O(n²) similarity comparison belongs in Postgres, not JS
4. **Synonym pairs as DB table** — Swiss German has many regional variants, needs to grow over time
5. **QA columns on products table** — simple fields, no separate table needed
6. **Reuse existing save pattern** — bulk actions modify state + `changedUids`, existing save loop handles persistence

---

### Verification

1. **Migration chain:** `supabase db reset` — verify all migrations apply cleanly
2. **Unit tests:** reducer actions, QA utils (outlier detection, missing fields), merge dialog
3. **Integration tests:** filter bar narrowing, bulk selection, QA toggle
4. **Performance:** `find_similar_products` RPC on DEV with full dataset — target <3s
5. **Manual test:** department review workflow, merge workflow, convert workflow, synonym management
6. **Browser check:** responsive behavior on desktop (primary use case for admin)
