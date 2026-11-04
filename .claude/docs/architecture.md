# Application Architecture

Consult this file when creating new features, components, or repositories.

## 3-Layer Pattern

```
UI Component  →  Domain Service (.class.ts)  →  Repository
   (tsx)         (pure business logic)           (persistence/CRUD)
```

**The UI never calls the Repository directly.** It accesses data through the `DatabaseContext` (`useDatabase()`) which exposes Repository methods, and calls Domain Service classes for business logic (validation, transformations, scaling).

### Layer Responsibilities

| Layer              | Location                                     | Responsibility                                          | DB Access?          |
| ------------------ | -------------------------------------------- | ------------------------------------------------------- | ------------------- |
| **Repository**     | `src/components/Database/Repository/`        | CRUD, `toRow()`/`toDomain()` mapping, query filters     | Yes                 |
| **Domain Service** | `src/components/<Feature>/<entity>.class.ts` | Validation, transformations, computed values, factories | **No**              |
| **UI Component**   | `src/components/<Feature>/<component>.tsx`   | Rendering, user interaction, state management           | Via `useDatabase()` |

## Large Feature Folders

When a feature folder grows beyond roughly 15 files, split it **by sub-topic, not by file type** (no `types/`, `classes/`, `ui/` folders): files that change together live together, and the suffix (`.class.ts`, `.types.ts`, `.tsx`) already shows the kind of file. `__tests__/` and `__mocks__/` move into the sub-folder with their files. The page component, its reducer and its data hook stay at the top level.

Example (`src/components/Event/ExpenseTracking/`, split before Epic 7 of the expense tracking):

```
ExpenseTracking/
  expenseTracking.tsx, expenseTracking.reducer.ts, useExpenseTrackingData.ts
  Budget/      budget.class.ts, budget.types.ts, budgetCard.tsx, …
  Expense/     expense.class.ts, expense.types.ts, expenseList.tsx, …
  Evaluation/  expenseStatistics.class.ts, expenseEvaluation.tsx, charts, …
```

Do the split as a pure move (`git mv` + updated imports, no behaviour change) in its own commit.

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

## When to Keep a Domain Service vs. Domain Interface

- **Keep `.class.ts`** if the entity has **business logic** (validation, scaling, transformations, factory methods). Strip all DB/Firebase code — it becomes a **pure logic service**.
  - Examples: `Recipe` (~19 business logic methods), `Product` (merging, conversion), `Event`, `Material`
- **Use only a Domain Interface** (defined in the Repository file) if the entity is a **simple data structure** with no business logic beyond what the Repository handles.
  - Examples: `GlobalSettings` (just two booleans), `SystemMessage` (only validTo normalization, handled in Repository)

## Admin Client

The `DatabaseService` exposes an `admin` namespace with service-role client instances (bypasses RLS), used only for data migration. It is `null` if `REACT_APP_SUPABASE_SERVICE_ROLE_KEY` is not configured.

- Use the **regular Supabase client** for reads and writes from authenticated users — ensures `auth.uid()` is available in defaults and triggers
- Only use the **admin client** for operations that genuinely need to bypass RLS (e.g. data migration, cross-user operations)
- `BaseRepository` accepts `authUser` in CRUD methods for API consistency, but audit columns are populated **automatically by the database** via defaults and triggers — the app does **not** set them manually
