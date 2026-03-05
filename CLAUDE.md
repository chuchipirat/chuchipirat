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
- **Supabase Auth** (primary) with Firebase Auth fallback during migration
- **Supabase/Postgres** for auth, users, masterdata (departments, units, products, materials, unit conversions, global settings, system messages). **Firebase Firestore** still handles events, recipes, requests, feeds, stats.
- **Firebase v10** — Storage, Analytics, Cloud Functions (Firestore for remaining entities above)
- **@react-pdf/renderer** for PDF export (menu plans, recipes, shopping/material lists)
- **@atlaskit/pragmatic-drag-and-drop** for drag-and-drop reordering
- **Fuse.js** for fuzzy search, **date-fns** for dates, **Sentry** for error monitoring
- **Supabase** (local dev via Docker Compose, **not** Supabase CLI) — configuration lives in `supabase/.env` and `supabase/docker-compose.yml`. Do **not** edit `supabase/config.toml` for local config — it is only used by the Supabase CLI which is not in use.

## Architecture

### State Management

React Context API only (no Redux). Five contexts:

- `FirebaseContext` — singleton Firebase instance
- `AuthUserContext` — authenticated user state (Supabase Auth primary)
- `DatabaseContext` — Supabase `DatabaseService` singleton, accessed via `useDatabase()` hook
- `CustomDialogContext` — dialog management with Promise-based confirmation API
- `NavigationValuesContext` — navigation state

HOCs (`withAuthentication`, `withAuthorization`, `withFirebase`) wrap components to inject context.

### Service Layer

Two persistence layers coexist during migration:

- **Supabase** (`src/components/Database/`): `DatabaseService` bundles 12 repositories (via `BaseRepository`). UI accesses them via `useDatabase()`.
- **Firebase** (`src/components/Firebase/`): `firebase.class.ts` + `Db/firebase.db.*.class.ts` for remaining entities (events, recipes, etc.), plus Storage, Authentication fallback, and Analytics.

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

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Belanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fizing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons-md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimat Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Detailed Instructions

Topic-specific guidelines are in `docs/claude/`. Consult them when working on the relevant area:

- **Database & Supabase**: `docs/claude/database-and-supabase.md` — Table conventions (audit columns, triggers, RLS, singleton tables), Repository pattern, BaseRepository, DatabaseService, app-level access
- **Migration Guide**: `docs/claude/migration-guide.md` — 3-layer pattern (UI → Domain Service → Repository), migration workflow, current progress
- **Refactoring**: `docs/claude/refactoring-guidelines.md` — Code organization, naming, type safety, performance, state management, error handling, React best practices
- **Email Templates**: `docs/claude/email-templates.md` — Font, colors, logo, footer conventions for Supabase auth emails
- **Post-Migration Tasks**: `docs/claude/post-migration-tasks.md` — Cleanup tasks to complete once Firebase is fully removed (enum type changes, lookup map removal, etc.)
- **Security Guidelines**: `docs/claude/security-guidelines.md` — Input validation conventions, SQL injection protection, XSS, file uploads, RLS checklist. Consult when implementing forms, repositories, or file uploads.
