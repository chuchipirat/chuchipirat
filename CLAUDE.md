# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chuchipirat is a German-language event and recipe management web application. It allows users to plan events with menus, generate shopping lists, manage recipes, and export documents as PDFs.

## Commands

- **Dev server**: `npm start` (port 3000)
- **Build**: `npm run build` (production), `npm run build:dev`, `npm run build:test`
- **Lint**: `npm run lint`
- **Test**: `npm run test` (Jest with watch mode)
- **Bundle analysis**: `npm run analyze`

Environment-specific builds use `env-cmd` with `.env.development`, `.env.test`, `.env.production`.

## Tech Stack

- **React 17** with **TypeScript 4.5**, bootstrapped with CRA (react-scripts 4)
- **MUI v5** (@mui/material) with Emotion for styling
- **React Router v5** with lazy-loaded routes and role-based authorization
- **Firebase v10** — Firestore, Authentication, Storage, Analytics, Cloud Functions
- **@react-pdf/renderer** for PDF export (menu plans, recipes, shopping/material lists)
- **@atlaskit/pragmatic-drag-and-drop** for drag-and-drop reordering
- **Fuse.js** for fuzzy search, **date-fns** for dates, **Sentry** for error monitoring
- **Supabase** (local dev via Docker Compose, **not** Supabase CLI) — configuration lives in `supabase/.env` and `supabase/docker-compose.yml`. Do **not** edit `supabase/config.toml` for local config — it is only used by the Supabase CLI which is not in use.

## Architecture

### State Management

React Context API only (no Redux). Four contexts:

- `FirebaseContext` — singleton Firebase instance
- `AuthUserContext` — authenticated user state
- `CustomDialogContext` — dialog management with Promise-based confirmation API
- `NavigationValuesContext` — navigation state

HOCs (`withAuthentication`, `withAuthorization`, `withFirebase`) wrap components to inject context.

### Service Layer

`src/components/Firebase/` contains the entire Firebase abstraction:

- `firebase.class.ts` — main Firebase wrapper, single entry point
- `Db/firebase.db.*.class.ts` — ~77 specialized database operation classes (events, recipes, users, products, etc.)
- `Storage/` — file upload/download
- `Authentication/` — auth state management
- `Analytics/` — event tracking

### Component Pattern

- **Feature-based folders**: `Event/`, `Recipe/`, `User/`, `Admin/`, etc.
- **Class-based models** (`.class.ts`) for business logic — `Recipe`, `Event`, `Menuplan`, `ShoppingListCollection`, `User`, `Product`, `Material`, `Unit`, `Department`
- **Functional React components** with hooks for UI
- Shared utilities in `src/components/Shared/utils.class.ts`

### Migration Architecture: 3-Layer Pattern

The codebase is being migrated from Firebase to Supabase/Postgres. When migrating domain entities, follow this 3-layer architecture:

```
UI Component  →  Domain Service (.class.ts)  →  Repository
   (tsx)         (pure business logic)           (persistence/CRUD)
```

**The UI never calls the Repository directly.** It accesses data through the `DatabaseContext` (`useDatabase()`) which exposes Repository methods, and calls Domain Service classes for business logic (validation, transformations, scaling).

#### Layer responsibilities

| Layer | Location | Responsibility | DB Access? |
|-------|----------|---------------|------------|
| **Repository** | `src/components/Database/Repository/` | CRUD, `toRow()`/`toDomain()` mapping, query filters | Yes |
| **Domain Service** | `src/components/<Feature>/<entity>.class.ts` | Validation, transformations, computed values, factories | **No** |
| **UI Component** | `src/components/<Feature>/<component>.tsx` | Rendering, user interaction, state management | Via `useDatabase()` |

#### When to keep a Domain Service class vs. use only a Domain Interface

- **Keep `.class.ts`** if the entity has **business logic** (validation, scaling, transformations, factory methods). Strip all DB/Firebase code during migration — it becomes a **pure logic service**.
  - Examples: `Recipe` (~19 business logic methods), `Product` (merging, conversion), `Event`, `Material`
- **Use only a Domain Interface** (defined in the Repository file) if the entity is a **simple data structure** with no business logic beyond what the Repository handles.
  - Examples: `GlobalSettings` (just two booleans), `SystemMessage` (only validTo normalization, handled in Repository)

#### Migration workflow for a `.class.ts` file

1. **Create Repository** (`<Entity>Repository.ts`): Define `Row` interface, `Domain` interface, `toRow()`/`toDomain()`, CRUD methods
2. **Strip DB code from `.class.ts`**: Remove all Firebase/Supabase calls, keep pure business logic (validation, transformations, factories)
3. **Update UI**: Replace `Entity.save({firebase, ...})` with `database.<entity>.save(...)` and keep `EntityService.validate(...)` calls
4. **If `.class.ts` becomes empty** (no business logic methods remain): Delete it, use `Domain` interface from Repository instead

### Constants

All in `src/constants/`:

- `text.ts` — German UI text (all `TEXT_*` constants)
- `routes.ts` — route path definitions
- `styles.ts` — theme/styling constants
- `defaultValues.ts` — default configuration
- `firebaseEvent.ts` — analytics event names
- `styles*Pdf.ts` — PDF-specific styling

### PDF Generation

React-PDF renderer creates exportable documents: menu plans, scaled recipes, shopping lists, material lists, event receipts. Each has dedicated style constants.

## Conventions

- **File naming**: `.class.ts` for model/logic classes, `.tsx` for components, `firebase.db.*.class.ts` for DB operations
- **All UI text is German** — centralized in `text.ts` as exported constants
- **Git branches**: `<issue-number>-<description>`, commits reference GitHub issues
- **TypeScript strict mode** enabled with `strictNullChecks`
- **Three Firebase environments**: dev (`chuchipirat-dev`), test (`chuchipirat-tst`), prod (`chuchipirat`)
- **Clean Code**: use clean-code principles.

## Email Templates

When creating or editing email templates (e.g. in `supabase/volumes/auth/templates/`):

- **Font**: Use `'Roboto', 'Helvetica Neue', Arial, sans-serif` as the font-family
- **Primary color**: `#006064` (teal) for header background, buttons, and accent links
- **Header image**: Always include the chuchipirat logo in the header:
  ```
  https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/mailTemplates%2FMail%20Header%20weiss.png?alt=media&token=61c6aa52-d611-4921-ad8c-3c9ecb26f85d
  ```
  Use `width="220"` and `max-width: 220px` for proper sizing
- **Language**: All email text in German
- **Footer**: Include `hallo@chuchipirat.ch` as contact

## Supabase/Postgres Table Conventions

When creating or modifying Postgres tables, follow these rules:

### Column Naming

- Use **snake_case** for all column and table names (e.g. `allow_sign_up`, `updated_at`)
- Domain models in TypeScript use **camelCase** — the Repository's `toRow()`/`toDomain()` handles the mapping

### Audit Columns

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

### Triggers

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

### Row Level Security (RLS)

- **Always** enable RLS: `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;`
- Create explicit policies for SELECT, INSERT, UPDATE, DELETE as needed
- Use `is_admin()` for admin-only write access
- Use `auth.uid()` for user-scoped access (e.g. `USING (auth_uid = auth.uid())`)
- Grant minimal permissions: `GRANT SELECT ON public.<table> TO anon, authenticated;`

### Singleton Tables

For configuration tables with exactly one row (e.g. `global_settings`, `system_messages`):

```sql
id TEXT PRIMARY KEY DEFAULT 'default',
-- ... columns ...
CONSTRAINT single_row CHECK (id = 'default')
```

Insert the default row at the end of the migration: `INSERT INTO public.<table> (id) VALUES ('default');`

### App-Level Access

- Use the **regular Supabase client** (not service-role/admin) for reads and writes from authenticated users — this ensures `auth.uid()` is available in defaults and triggers
- Only use the **admin client** (service-role) for operations that genuinely need to bypass RLS (e.g. data migration, cross-user operations)
- The `BaseRepository` accepts `authUser` in CRUD methods for API consistency, but audit columns are populated **automatically by the database** via defaults and triggers — the app does **not** set them manually

## Refactoring Guidelines

When asked to refactor a file or component, apply these checks:

### Code Organization & Structure

- Component size and single responsibility — are components doing too much?
- Proper separation of concerns (UI vs logic vs data fetching)
- File/folder structure and naming conventions
- Functions should do **one thing** — if you can extract a sub-function with a name that isn't just a restatement of the implementation, the function does too much
- Keep functions small — they should read like a short narrative, not a wall of logic
- Maintain consistent abstraction levels within a function — don't mix high-level orchestration with low-level details

### Naming

- Use intention-revealing names — a name should explain _why_ it exists and _what_ it does without needing a comment
- No misleading names — a name must not promise something the code doesn't deliver
- Make distinctions meaningful — if two things have different names, they must have different purposes (avoid `data`/`info` or `handler1`/`handler2`)
- Use pronounceable, searchable names — name length should match scope size
- Avoid mental mapping — no cryptic abbreviations; the reader should never have to translate

### Type Safety

- Proper TypeScript usage — avoid `any`, prefer `unknown` when the type is truly unknown
- Props interfaces well-defined and documented
- Generic types used appropriately
- Type inference vs explicit typing balance

### Functions & Arguments

- Prefer fewer arguments (0–1 ideal, 2 acceptable, 3+ should be wrapped into an object)
- Each argument should serve a clear purpose: asking a question, transforming data, or handling an event
- Data flows **in** through arguments and **out** through return values — avoid output arguments that mutate inputs
- Respect **Command-Query Separation** — a function either changes state or returns data, never both

### Performance

- Unnecessary re-renders (missing memoization with `useMemo`, `useCallback`, `React.memo`)
- Heavy computations that should be memoized

### State Management

- Is state at the right level? (avoiding prop drilling vs over-centralization)
- Could `useReducer` replace complex `useState` logic?
- Are derived values computed instead of stored?
- Proper use of refs vs state

### Side Effects & Data Flow

- `useEffect` dependencies correct and minimal
- No missing cleanup functions
- Async operations handled properly
- Clear data flow (unidirectional)
- **No hidden side effects** — if a function does more than its name promises, rename it or split it

### Error Handling

- Prefer exceptions/error boundaries over error codes or silent failures
- Extract error handling logic into separate functions — it's its own responsibility
- Async error paths explicitly handled (try/catch, `.catch()`, error states in UI)

### React Best Practices

- Key props on lists
- Controlled vs uncontrolled components used appropriately
- Custom hooks to extract reusable logic
- Proper error boundaries
- Prefer early returns to reduce nesting
- Prefer polymorphism/component composition over complex conditional rendering (`switch`/`if`-chains in JSX)

### Code Quality

- **DRY** — every piece of logic should have a single, authoritative representation; extract reusable components/hooks
- Readable variable/function names (see Naming section above)
- Comments explain **why**, not **what** — if the code already says it, the comment is noise
- Remove outdated or misleading comments — a wrong comment is worse than none
- Consistent code style

### Testability

- The code must be testable by unit tests
- If unit tests are missing, create them for the refactored code
- Database access and API calls must be mocked
