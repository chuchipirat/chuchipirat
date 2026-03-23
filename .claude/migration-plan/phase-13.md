## Phase 13: System/Admin Area — Refactoring & Migration

### Context

The System page (`system.tsx`, 424 lines) is the admin hub linking to ~18 sub-pages for maintenance, monitoring, and data operations. Data migration to Supabase is complete (Phases 1–11), but many admin pages still depend on Firebase Cloud Functions for operations like merge, convert, trace, mail, and rebuild jobs. Several pages are now obsolete (Firestore index builder, Cloud Function log viewer). Cross-cutting issues: no Sentry integration, loose reducer typing, 10 pages without tests, inconsistent error handling, missing performance optimizations.

**Goal:** Delete dead code, refactor already-migrated pages to established patterns, replace Firebase Cloud Functions with Supabase RPC/Edge Functions, add data integrity checks, prepare cron job monitoring infrastructure, improve hub UX — packaged in independently committable sub-phases.

> [!note] Cron jobs deferred
> Cron jobs (`dailySummary`, `recipesInMenuplanCounter`): migration deferred to Phase 14. This plan adds the monitoring infrastructure only.

---

### Inventory & Status

| Page                                              | Lines | Status               | Firebase deps                 | Tests         |
| ------------------------------------------------- | ----- | -------------------- | ----------------------------- | ------------- |
| `system.tsx` (hub)                                | 424   | needs refactoring    | `useFirebase()` (unused)      | ❌            |
| `globalSettings.tsx`                              | 425   | ✅ Supabase          | Edge Function only            | ✅            |
| `systemMessage.tsx`                               | 410   | ✅ Supabase          | none                          | ✅            |
| `systemMessageOverview.tsx`                       | 381   | ✅ Supabase          | none                          | ✅            |
| `overviewRecipes.tsx`                             | —     | ✅ Supabase          | none                          | ✅            |
| `overviewEvents.tsx`                              | —     | ✅ Supabase          | none                          | ✅            |
| `overviewFeeds.tsx`                               | 830   | ✅ Supabase          | none                          | ✅            |
| `overviewUsers.tsx`                               | 944   | ✅ Supabase          | none                          | ✅            |
| `migration.tsx`                                   | 348   | ✅ Supabase+Firebase | `useFirebase()` — intentional | ❌ (excluded) |
| `mergeItems.tsx`                                  | 822   | 🔶 Cloud Functions   | merge CF (trigger+poll)       | ❌            |
| `convertItem.tsx`                                 | 957   | 🔶 Cloud Functions   | convert CF (trigger+poll)     | ❌            |
| `whereUsed.tsx` + `.class.ts`                     | 540   | 🔶 Cloud Functions   | trace CF (trigger+poll)       | ❌            |
| `activateSupportUser.tsx`                         | 226   | 🔶 Cloud Functions   | activate CF                   | ❌            |
| `executeJob.tsx`                                  | 277   | 🔶 Cloud Functions   | rebuild CFs                   | ❌            |
| `mailConsole.tsx` + `.class.ts`                   | 909   | ❌ Firebase          | sendMail CF + mailbox         | ❌            |
| `overviewMailbox.tsx`                             | 710   | ❌ Firebase          | mailbox collections           | ❌            |
| `overviewCloudFunctions.tsx` + `cloudFx.class.ts` | 930   | **OBSOLETE**         | CF trigger logs               | ❌            |
| `buildDbIndex.tsx`                                | 770   | **OBSOLETE**         | Firestore indices             | ❌            |

---

### Phase 13.1: Delete Dead Code & Redesign Hub Page

#### Delete (obsolete — Firestore-only, no Supabase equivalent needed)

- `src/components/Admin/buildDbIndex.tsx` — builds Firestore composite indices. Postgres uses standard SQL indices.
- `src/components/Admin/overviewCloudFunctions.tsx` — displays Firebase CF trigger docs. Supabase Edge Functions have their own logging (Supabase Dashboard / Logflare).
- `src/components/Admin/cloudFx.class.ts` — only used by `overviewCloudFunctions`.

#### Redesign `system.tsx` — Hub Page

Layout redesign — group tiles by category with section headers:

```
┌─────────────────────────────────────────────────┐
│  Einstellungen (admin only)                     │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Glob.Settings│  │ Systemmeld.  │             │
│  └──────────────┘  └──────────────┘             │
├─────────────────────────────────────────────────┤
│  Datenoperationen                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ WhereUsed│ │ Merge    │ │ Convert  │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Support  │ │ Jobs     │ │ MailCons.│        │
│  └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────┤
│  Übersichten                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Rezepte  │ │ Anlässe  │ │ Feeds    │        │
│  └──────────┘ └──────────┘ └──────────┘        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ User     │ │ Mailbox  │ │ Cron Jobs│        │
│  └──────────┘ └──────────┘ └──────────┘        │
├─────────────────────────────────────────────────┤
│  Extern (Links)                                 │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ 🔗 Sentry    │  │ 🔗 Supabase  │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

**Changes:**

- Remove "Temp" tile (dead code), "DB Indices" tile, "Cloud FX" from overview
- Remove `useFirebase()` import
- Replace flat tile list with section headers (`Typography` variant h6): "Einstellungen", "Datenoperationen", "Übersichten", "Extern"
- Each section as a Grid row with consistent breakpoints: `size={{xs: 12, sm: 6, md: 4}}`
- Flatten `OverviewTile` — instead of a nested list inside a card, each overview entity becomes its own tile (same as `AdminTile`). Eliminates inconsistent UX where some destinations are tiles and others are list items inside a tile.
- Add external link tiles for Sentry Dashboard and Supabase Dashboard (configurable URLs via env vars or constants)
- Add Cron Jobs tile (links to new cron job monitoring page, Phase 13.4)
- Keep Migration tile (admin only) — data migration cockpit still needed until Firebase is fully decommissioned
- Fix a11y: move `onClick` from `ListItemText` to `ListItemButton`
- Add `React.memo` on tile components, `useCallback` on `goToDestination`
- Add breadcrumb support: export a `SYSTEM_BREADCRUMB` constant that sub-pages can use to show "System > [Page Name]" navigation
- German JSDoc on all components/interfaces

#### Route & App cleanup

- Remove `SYSTEM_DB_INDICES`, `SYSTEM_OVERVIEW_CLOUDFX`, `TEMP` from `routes.ts`
- Remove lazy imports + Routes for deleted pages in `App.jsx`
- Remove unused text constants (`DB_INDICES`, `DB_INDICES_DESCRIPTION`, `CLOUD_FX`)
- Add route for cron job monitoring page

#### New test

`src/components/Admin/__tests__/system.test.tsx` — verify: section headers render, tiles render per role, navigation, deleted tiles absent.

#### Verification

- `npx tsc --noEmit` — no errors
- `npm run test` — all pass
- Manual: `/system` loads with grouped sections, deleted tiles gone, external links work

---

### Phase 13.2: Refactor Already-Migrated Pages (Cross-cutting Quality)

Apply same pattern to each page:

1. Discriminated union for `DispatchAction` (replace `{[key: string]: any}`)
2. `Sentry.captureException` in all `.catch()` blocks
3. `useCallback` for handlers passed to sub-components
4. `React.memo` on sub-components where appropriate
5. German JSDoc on components, interfaces, state types
6. Remove unused Firebase imports if present
7. Add breadcrumb to page header (back-link to `/system`)

**Pages to refactor (order):**

1. `globalSettings.tsx` — fix reducer typing (already has tests)
2. `systemMessage.tsx` — fix reducer typing + sanitize HTML output (XSS risk with `dangerouslySetInnerHTML`)
3. `systemMessageOverview.tsx` — fix reducer typing
4. `overviewRecipes.tsx` — add Sentry, JSDoc
5. `overviewEvents.tsx` — add Sentry, JSDoc
6. `overviewFeeds.tsx` — add Sentry, JSDoc
7. `overviewUsers.tsx` — add Sentry, JSDoc
8. `migration.tsx` — **excluded from refactoring.** One-time migration code that intentionally needs both Firebase (source) and Supabase (target). No unit tests needed.

#### Verification

- All existing tests still pass
- `npx tsc --noEmit` — no errors
- Manual: test each page loads and basic operations work
- Grep: no `{[key: string]: any}` in modified files

---

### Phase 13.3: Migrate merge/convert/whereUsed to Supabase RPCs

#### SQL migrations (new)

Use descriptive parameter names (not abbreviated):

- `merge_products(source_product_id TEXT, target_product_id TEXT)` — transaction: update all FK references in `recipe_ingredients`, `event_shopping_list_items`, `event_menue_products`, `unit_conversion_products`, then delete source product. Returns affected row counts per table.
- `merge_materials(source_material_id TEXT, target_material_id TEXT)` — same pattern for materials across `recipe_materials`, `event_material_list_items`.
- `convert_product_to_material(product_id TEXT)` — create material from product data, update all references, delete product. Returns new material ID.
- `convert_material_to_product(material_id TEXT, department_id TEXT)` — inverse (needs department since materials have no department).
- `where_used(item_id TEXT, item_type TEXT)` — returns all references across tables as `(table_name TEXT, column_name TEXT, record_id TEXT, context TEXT)` result set. `item_type` is `'product'`, `'material'`, or `'recipe'`.

#### New repository

> [!info] File
> `src/components/Database/Repository/AdminOperationsRepository.ts`

Wraps the RPC calls with typed interfaces. Register in `DatabaseService.ts`.

#### Refactor UI pages

For each of `mergeItems.tsx`, `convertItem.tsx`, `whereUsed.tsx`:

- Replace CF trigger-and-poll with `await database.adminOps.mergeProducts(...)` (synchronous from UI perspective)
- Remove `SessionStorageHandler` and Firebase-related imports
- Fix reducer typing (discriminated unions)
- Add Sentry, `useCallback`, JSDoc, breadcrumb
- Create unit test

#### Delete

- `src/components/Admin/whereUsed.class.ts` — logic moves to repository

#### Verification

- New tests pass
- Manual: merge two products → all recipe references updated
- Manual: convert product to material → new material visible, old product gone
- Manual: WhereUsed for a product → all occurrences listed
- No `firebase.cloudFunction` imports in these files

---

### Phase 13.4: Migrate activateSupportUser, replace executeJob & add Cron Job Monitoring

#### `activateSupportUser.tsx`

- **Current:** triggers Firebase CF that adds support user to event's cook list
- **New:** direct insert into `event_cooks` via `database.events.addCook(eventId, supportUserId)`
- Support user ID from environment: add `VITE_SUPPORT_USER_ID` to `.env` files. The page reads this value instead of requiring manual input of a user ID. The admin only enters the event UID — the support user is preconfigured.
- Fix reducer typing, remove `useFirebase()`, add Sentry, JSDoc, breadcrumb
- Create test

#### `executeJob.tsx` → Data Integrity & Maintenance Jobs

**Delete entirely:** all Firebase rebuild jobs (`rebuildFile000AllRecipes`, `rebuildFile000AllUsers`, `rebuildFile000AllEvents`, `rebuildFile000AllFeeds`, `rebuildStatsCounter`). These are Firebase denormalization maintenance — unnecessary in Postgres.

**Replace with:** `src/components/Admin/DataIntegrity/dataIntegrity.tsx` — a new page for data consistency verification.

**Data integrity checks** (each as a Postgres function returning anomalies):

| Check                 | SQL function                   | What it verifies                                                                      |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| Orphaned recipes      | `check_orphaned_recipes()`     | Recipes where `created_by` references no existing `auth.users` entry                  |
| Orphaned event cooks  | `check_orphaned_event_cooks()` | `event_cooks` rows where `event_id` references no existing event                      |
| Missing event dates   | `check_events_without_dates()` | Events that have no rows in `event_dates`                                             |
| Unused products       | `check_unused_products()`      | Products referenced by zero `recipe_ingredients` and zero `event_shopping_list_items` |
| Unused materials      | `check_unused_materials()`     | Materials referenced by zero `recipe_materials` and zero `event_material_list_items`  |
| Duplicate user emails | `check_duplicate_emails()`     | Users with same email (case-insensitive)                                              |
| Auth/users sync       | `check_auth_users_sync()`      | `public.users` rows where `auth_uid` references no `auth.users` entry, or vice versa  |

**UI:** List of checks with "Run" button per check + "Run All" button. Results displayed in a DataGrid per check. JSDoc, Sentry, test.

#### Cron Job Monitoring Infrastructure

**Monitoring approach:** hybrid — `cron_job_log` table for in-app history + Sentry Crons for alerting.

**SQL migration:** `cron_job_log` table:

```sql
CREATE TABLE public.cron_job_log (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  job_name            TEXT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at         TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'running',  -- 'running', 'success', 'error'
  duration_ms         INTEGER,
  records_processed   INTEGER DEFAULT 0,
  error_message       TEXT,
  details             JSONB
);
```

**New repository:** `src/components/Database/Repository/CronJobLogRepository.ts`

**New page:** `src/components/Admin/CronJobs/cronJobs.tsx` — displays cron job history from `cron_job_log` in a DataGrid. Columns: Job Name, Started, Duration, Status, Records, Error. Filter by job name, date range. Link to Sentry Crons dashboard for alerting config. This page is the target for the "Cron Jobs" tile on the hub (Phase 13.1).

Register in `DatabaseService.ts`, add route, add hub tile.

#### Verification

- Tests pass
- Manual: activate support user for a test event → user appears as cook
- Manual: run data integrity checks → results shown in DataGrid
- Manual: cron job log page loads (empty initially — populated when Phase 14 adds cron jobs)

---

### Phase 13.5: Migrate mailConsole & overviewMailbox

#### New infrastructure

- **SQL migration:** `mail_log` table (`id`, `recipients JSONB`, `subject`, `body`, `template_name`, `sent_at`, `sent_by UUID`, `delivery_status`, `error_message`)
- **Supabase Edge Function:** `send-mail` — accepts recipients, subject, body; sends via SMTP; logs to `mail_log`
- `src/components/Database/Repository/MailLogRepository.ts` — CRUD on `mail_log`

#### Refactor UI

- `mailConsole.tsx` — replace `firebase.cloudFunction.sendMail` with Edge Function invocation. Fix reducer, add Sentry, JSDoc, breadcrumb, test.
- `overviewMailbox.tsx` — replace Firebase reads with `MailLogRepository`. Fix reducer, add Sentry, JSDoc, breadcrumb, test.

#### Delete

- `mailConsole.class.ts` — logic moves to repository + edge function

#### Verification

- Tests pass
- Manual: send test mail → mail arrives + appears in mail log
- Manual: view mail log → all sent mails visible with delivery status

---

### Phase 13.6: Final Cleanup

> [!warning] Important
> `migration.tsx` and its `MigrationJobs/` folder are NOT deleted in this phase. They remain functional until Firebase is fully decommissioned (separate future effort).

#### Tasks

- Remove orphaned Firebase CF classes (no longer referenced after 13.3–13.5): `firebase.db.cloudfunction.mergeProducts.class.ts`, `firebase.db.cloudfunction.mergeMaterials.class.ts`, `firebase.db.cloudfunction.convertProductToMaterial.class.ts`, `firebase.db.cloudfunction.convertMaterialToProduct.class copy.ts`, `firebase.db.cloudfunction.traceObject.class.ts`, `firebase.db.cloudfunction.activateSupportUser.class.ts`, `firebase.db.cloudfunction.rebuildStats.class.ts`, `firebase.db.cloudfunction.sendMail.class.ts`, `firebase.db.cloudfunction.deleteFeeds.class.ts`
- Verify each deletion: grep for imports before removing — only delete if truly unreferenced
- Remove unused route/text constants (for deleted pages only)
- Clean `CloudFunctionType` enum (remove types whose CF classes were deleted)
- Update `ENVIRONMENT_SETUP.md` with all new migrations
- Full regression test

**NOT deleted (still needed):**

| File                       | Reason                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `migration.tsx` (348)      | Migration cockpit — reads from Firebase, writes to Supabase. Only exception where Firebase usage is intentional. |
| `MigrationJobs/*.ts` (all) | Migration job implementations — one-time code, referenced by `migration.tsx`                                     |

#### Verification

- `npx tsc --noEmit` — clean
- `npm run test` — all pass
- `npm run build` — succeeds
- Grep `useFirebase` in `Admin/` — expected in `migration.tsx` and `MigrationJobs/` only (intentional)
- Manual: navigate every admin page, verify no broken links
- Manual: migration cockpit still loads and shows job list

---

### UX Improvements (integrated into phases above)

| Improvement                 | Phase     | Details                                                               |
| --------------------------- | --------- | --------------------------------------------------------------------- |
| Grouped tiles by category   | 13.1      | Section headers: Einstellungen, Datenoperationen, Übersichten, Extern |
| Flat tile layout            | 13.1      | Replace nested `OverviewTile` list with individual tiles per entity   |
| External link tiles         | 13.1      | Sentry Dashboard + Supabase Dashboard links on hub                    |
| Breadcrumbs                 | 13.1–13.5 | All sub-pages get "System > Page Name" breadcrumb                     |
| Consistent grid breakpoints | 13.1      | All tiles use `size={{xs: 12, sm: 6, md: 4}}`                         |
| Cron Jobs monitoring page   | 13.4      | DataGrid with job history + Sentry link                               |
| Data Integrity checks page  | 13.4      | Replaces obsolete Firebase rebuild jobs                               |

---

### Files Summary

#### Delete (~3,000+ lines)

| File                               | Reason                                                           |
| ---------------------------------- | ---------------------------------------------------------------- |
| `buildDbIndex.tsx` (770)           | Firestore indices — irrelevant for Postgres                      |
| `overviewCloudFunctions.tsx` (790) | Firebase CF logs — replaced by Supabase Dashboard                |
| `cloudFx.class.ts` (140)           | Only used by `overviewCloudFunctions`                            |
| `whereUsed.class.ts` (81)          | Logic moves to `AdminOperationsRepository`                       |
| `mailConsole.class.ts` (232)       | Logic moves to `MailLogRepository` + Edge Function               |
| `executeJob.tsx` (277)             | Replaced by DataIntegrity page                                   |
| ~9 Firebase CF classes (~500)      | Orphaned after migration (verify each with grep before deleting) |

#### Create

| File                           | Purpose                      | Phase     |
| ------------------------------ | ---------------------------- | --------- |
| `AdminOperationsRepository.ts` | merge/convert/whereUsed RPCs | 13.3      |
| `CronJobLogRepository.ts`      | Cron job history CRUD        | 13.4      |
| `MailLogRepository.ts`         | Mail log CRUD                | 13.5      |
| `cronJobs.tsx`                 | Cron job monitoring page     | 13.4      |
| `dataIntegrity.tsx`            | Data consistency checks page | 13.4      |
| `send-mail` Edge Function      | Email sending                | 13.5      |
| ~8 SQL migrations              | Postgres functions + tables  | 13.3–13.5 |
| ~10 test files                 | Coverage for all pages       | 13.1–13.5 |

#### Modify

| File                              | Changes                                                                 | Phase     |
| --------------------------------- | ----------------------------------------------------------------------- | --------- |
| `system.tsx`                      | Full redesign: grouped sections, flat tiles, external links, breadcrumb | 13.1      |
| 8 already-migrated pages          | Discriminated unions, Sentry, `useCallback`, JSDoc, breadcrumb          | 13.2      |
| `mergeItems.tsx`                  | Replace CF with Supabase RPC                                            | 13.3      |
| `convertItem.tsx`                 | Replace CF with Supabase RPC                                            | 13.3      |
| `whereUsed.tsx`                   | Replace CF with Supabase RPC                                            | 13.3      |
| `activateSupportUser.tsx`         | Replace CF with direct DB call + env var for support user ID            | 13.4      |
| `mailConsole.tsx`                 | Replace CF with Edge Function                                           | 13.5      |
| `overviewMailbox.tsx`             | Replace Firebase reads with repository                                  | 13.5      |
| `DatabaseService.ts`              | Register new repositories                                               | 13.3–13.5 |
| `routes.ts`, `text.ts`, `App.jsx` | Remove dead references, add new routes                                  | 13.1+     |
| `.env.*` files                    | Add `VITE_SUPPORT_USER_ID`                                              | 13.4      |

---

### Future: Phase 14 — Cron Job Migration (deferred)

Migrate the two Firebase scheduled functions to Supabase:

1. **`dailySummary`** (03:00 UTC) — activity summary email to Community Leaders → Supabase Edge Function + `pg_cron`
2. **`recipesInMenuplanCounter`** (02:00 UTC) — recipe usage stats + review survey emails → Supabase Edge Function + `pg_cron`

Both will write to `cron_job_log` (created in Phase 13.4) and integrate with Sentry Crons for alerting.
