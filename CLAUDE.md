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
