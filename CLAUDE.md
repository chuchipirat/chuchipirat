# Chuchipirat – CLAUDE.md

## Project

Chuchipirat is a free, open-source web app for Swiss youth organizations (scouts, guides) to plan camp kitchens. React/TypeScript frontend with Material UI, Supabase/Postgres backend. Non-profit, volunteer-run.

The app is **multi-user**: multiple cooks collaborate on the same camp (event). This affects every architectural decision — RLS policies, Realtime subscriptions, and state management must account for concurrent access by different users on the same data.

The app is used on **desktop/tablet** during camp preparation and on **mobile** during the camp itself. All UI must be responsive and functional on both.

## Core Principles

1. **Plan first, code second.** Always create a plan before writing code. Discuss the approach, outline the steps, get confirmation. Never jump straight into implementation. **If something goes sideways during implementation, STOP immediately.** Don't push forward with workarounds — switch back to planning and re-plan including verification steps.
2. **Prove it works.** No task is complete without verification. Run tests, check the browser, validate the migration chain. If you can't prove it works, it's not done.
3. **Use subagents for complex tasks.** Offload heavy subtasks (research, testing, refactoring) to subagents to keep the main context clean and focused.
4. **Fix bugs autonomously.** If you encounter a bug during work — fix it. Don't stop to ask, don't wait for instructions. Fix it, test it, move on.
5. **Learn from mistakes.** When something goes wrong, add it to the Anti-Patterns section below so future sessions don't repeat the same error.
6. **Track tech debt.** When you encounter code that violates current conventions during work — don't fix it unless it's part of the current task. Instead, append it to `.claude/docs/tech-debt.md` under the matching category. Include the file path, a short description of the violation, priority (hoch/mittel/tief), and complexity (klein/mittel/gross). If no matching category exists, create one.
7. **Demand elegance, not over-engineering.** For non-trivial changes, pause and ask: "Is there a simpler, more elegant way?" If a fix feels hacky, step back and implement the clean solution. But skip this for obvious, isolated fixes — don't over-engineer simple things.
8. **Minimal impact.** Only touch what's necessary for the current task. No side effects, no "while I'm here" refactors that introduce new bugs. Find root causes instead of temporary fixes.

## Development Workflow

1. Make changes
2. Typecheck: `npm run typecheck`
3. Run tests: `npm run test -- --filter "test name"`
4. Lint: `npm run lint`
5. Before PR: `npm run lint && npm run test`

## Environments

Three environments: **DEV / TEST / PROD** (Coolify on Hetzner).

**NEVER work directly against the PROD environment.** No migrations, no queries, no data changes in production. All work happens in DEV or TEST first.

## TypeScript / React

- Strict mode, no `any` — use `unknown` and narrow
- Prefer `type` over `interface`
- New enums **must** use string values matching the PostgreSQL ENUM labels (e.g. `enum Diet { meat = 'meat', vegetarian = 'vegetarian' }`). Never create numeric enums. Existing numeric enums are migration debt (see `migration.md`).
- Functions: max 20 lines, single responsibility, descriptive names
- Named exports only, no default exports
- JSDoc/TSDoc on all public functions — **in German**
- Data Access Layer (DAL): all Supabase calls go through Repository/DAL functions, never direct in components
- **Material UI only** — do not introduce other UI frameworks (no Tailwind, Chakra, Ant Design, etc.)

## Naming

- Components: PascalCase (`MenuPlanCard.tsx`)
- Hooks: camelCase with `use` prefix (`useMenuPlan.ts`)
- Utilities: camelCase (`formatQuantity.ts`)
- Constants: UPPER_SNAKE_CASE
- Files match their primary export name
- **No single-letter or cryptic variable names** — not even in arrow functions, lambdas, or short callbacks. Use descriptive names (e.g. `material` not `m`, `recipe` not `r`).

## Anti-Patterns (Fehler, die nicht wiederholt werden dürfen)

- This project uses `npm`. Do NOT suggest switching to bun, yarn, or pnpm.
- Do NOT create Firestore references — all new code targets Supabase/Postgres
- Do NOT skip RLS policies on any new table
- Do NOT use `console.log` for error handling — errors are logged via Sentry. Use proper error boundaries and Sentry captures.
- Do NOT modify migration files that have already been applied
- Do NOT hardcode environment-specific values — use env variables
- Do NOT write English comments in code — comments and JSDoc/TSDoc are in **German**. Code (variable names, function names) is in English. UI strings are in German (Swiss).
- Do NOT use single-letter variable names. Use Clean Code naming conventions. Name things properly and descriptively.
- Do NOT introduce UI libraries other than Material UI
- Do NOT run any operation against the PROD environment
- Do NOT use `new Date("YYYY-MM-DD")` for Postgres `date` columns — it parses as UTC midnight, which in CET/CEST becomes the previous day. Use `parseLocalDate()` from `src/utils/dateUtils.ts` instead.
- Do NOT use `.toISOString().split("T")[0]` to format dates for Postgres — it converts to UTC, shifting the day in CET/CEST. Use `formatLocalDate()` from `src/utils/dateUtils.ts` instead.

## Git

- Branch naming: `feature/`, `fix/`, `refactor/`, `migration/`
- Commit messages: conventional commits (feat, fix, refactor, docs, chore)
- One logical change per commit
- Always rebase on main before PR

## Database Migrations

### Baseline Structure

The database schema is defined in 7 baseline files organized by object type:

| File                                  | Contains                                              |
| ------------------------------------- | ----------------------------------------------------- |
| `20260401000001_extensions_enums.sql` | Extensions, ENUMs, sequences                          |
| `20260401000002_tables.sql`           | All tables with FKs, constraints, RLS enabled         |
| `20260401000003_functions.sql`        | All functions (trigger, RLS helper, API, admin)       |
| `20260401000004_views.sql`            | All views                                             |
| `20260401000005_triggers.sql`         | All triggers                                          |
| `20260401000006_rls_policies.sql`     | All RLS policies                                      |
| `20260401000007_grants_indexes.sql`   | Grants, default privileges, indexes, storage policies |

Within each file, objects are grouped by domain (users, masterdata, recipes, events, etc.) using comment section headers.

### Adding New Migrations

- **New changes** after the baseline go into individual timestamped migration files (e.g. `20260405000001_add_foo_column.sql`)
- **Never modify baseline files** once deployed to any environment
- Each migration file should be self-contained (include table changes + related RLS + grants + indexes)
- Follow the existing pattern: `YYYYMMDDNNNNNN_descriptive_name.sql`

### Running Locally

- `supabase db reset` (via CLI) or `docker compose down -v && docker compose up` to rebuild from scratch
- Migrations must run as `supabase_admin` (the Supabase CLI default)
- `postgres` is NOT a superuser in Supabase — never test migrations manually as `postgres`

## Verification

- After schema changes: run `supabase db reset` and verify migration chain
- After UI changes: check in browser, test responsive behavior on **desktop and mobile viewports**
- After DAL changes: run related integration tests
- After RLS changes: test with different user roles

## Detailed Docs

For deeper context, see `.claude/docs/`:

| File                        | When to consult                                                   |
| --------------------------- | ----------------------------------------------------------------- |
| `architecture.md`           | Creating new features, understanding the 3-layer pattern          |
| `conventions.md`            | Email templates, language rules, error logging                    |
| `database-and-supabase.md`  | Creating/modifying tables, writing Repositories, RLS, enums       |
| `migration.md`              | Firebase → Supabase migration work (temporary)                    |
| `tech-debt.md`              | Tracking and reviewing convention violations and cleanup tasks    |
| `manual-testcases.md`       | Writing or generating integration test cases                      |
| `refactoring-guidelines.md` | Refactoring code (naming, functions, performance, React patterns) |
| `security-guidelines.md`    | Forms, auth flows, file uploads, RLS, input validation            |
| `git-workflow.md`           | Creating, Branches, Working with Git and commintg                 |

## Commands

Reusable workflows live in `.claude/commands/`. Check there before building new ones.
