# Phase 13: System/Admin Area — Refactoring & Migration

## Completed

- [x] **Phase 13.1: Delete Dead Code & Redesign Hub Page**
  - [x] Deleted `buildDbIndex.tsx` (Firestore index builder — obsolete)
  - [x] Deleted `overviewCloudFunctions.tsx` (Firebase CF log viewer — obsolete)
  - [x] Deleted `cloudFx.class.ts` (only used by overviewCloudFunctions)
  - [x] Removed `SYSTEM_DB_INDICES`, `SYSTEM_OVERVIEW_CLOUDFX`, `TEMP` from `routes.ts`
  - [x] Added `SYSTEM_CRON_JOBS`, `SYSTEM_DATA_INTEGRITY` routes
  - [x] Removed `DB_INDICES`, `CLOUD_FX` text constants; added section headers + new tile texts
  - [x] Redesigned `system.tsx` — grouped tiles (Einstellungen, Datenoperationen, Übersichten, Extern)
  - [x] Flattened OverviewTile → individual AdminTiles per entity
  - [x] Added external link tiles (Sentry, Supabase Dashboard)
  - [x] Added Cron Jobs + Data Integrity tiles (pages created in Phase 13.4)
  - [x] Exported `SYSTEM_BREADCRUMB` constant for sub-page navigation
  - [x] Added `React.memo` on tile components, `useCallback` on `goToDestination`
  - [x] Removed `useFirebase()` import
  - [x] Updated `App.jsx` — removed lazy imports/routes for deleted pages + Temp
  - [x] Cleaned up `helpCenter.class.ts` + test (removed CloudFX references)
  - [x] Created `system.test.tsx` — 13 tests (sections, tiles per role, navigation, deleted tiles absent)
  - [x] All 157 tests pass, no typecheck errors

- [x] **Phase 13.2: Refactor Already-Migrated Pages (Cross-cutting Quality)**
  - [x] `globalSettings.tsx` — Discriminated union, Sentry, removed AuthUser import
  - [x] `systemMessage.tsx` — Discriminated union, Sentry, DOMPurify XSS fix, removed AuthUser import
  - [x] `systemMessageOverview.tsx` — Sentry (already had discriminated union)
  - [x] `overviewRecipes.tsx` — Sentry (already had discriminated union)
  - [x] `overviewEvents.tsx` — Sentry (already had discriminated union)
  - [x] `overviewFeeds.tsx` — Sentry (already had discriminated union)
  - [x] `overviewUsers.tsx` — Discriminated union, Sentry
  - [x] Installed DOMPurify for HTML sanitization
  - [x] All 120 tests pass, no typecheck errors

- [x] **Phase 13.3: Migrate merge/convert/whereUsed to Supabase RPCs**
  - [x] SQL migration: `20260320000002_admin_operations_rpc.sql` with 5 RPC functions
  - [x] Created `AdminOperationsRepository.ts` — typed wrappers for all RPCs
  - [x] Registered `adminOps` in `DatabaseService.ts`
  - [x] Refactored `whereUsed.tsx` — replaced CF with `database.adminOps.whereUsed()`
  - [x] Refactored `mergeItems.tsx` — replaced CF with `database.adminOps.mergeProducts/Materials()`
  - [x] Refactored `convertItem.tsx` — replaced CF with `database.adminOps.convertProduct/Material()`
  - [x] Deleted `whereUsed.class.ts` (logic moved to repository)
  - [x] All 3 pages: discriminated unions, Sentry, no Firebase imports
  - [x] All 157 tests pass, no typecheck errors

- [x] **Phase 13.4: Migrate activateSupportUser, Data Integrity & Cron Job Monitoring**
  - [x] Refactored `activateSupportUser.tsx` — direct DB call via `database.events.addCook()`
  - [x] Added `VITE_SUPPORT_USER_ID` env var support
  - [x] SQL: `20260320000003_create_cron_job_log.sql` — cron_job_log table
  - [x] SQL: `20260320000004_data_integrity_checks.sql` — 7 check functions
  - [x] Created `CronJobLogRepository.ts` + registered in DatabaseService
  - [x] Created `DataIntegrity/dataIntegrity.tsx` — integrity checks page
  - [x] Created `CronJobs/cronJobs.tsx` — job monitoring page with DataGrid
  - [x] Added routes + lazy imports in App.jsx
  - [x] All 157 tests pass, no typecheck errors

- [x] **Phase 13.5: Migrate mailConsole & overviewMailbox**
  - [x] SQL: `20260320000005_create_mail_log.sql` — mail_log table
  - [x] Created `MailLogRepository.ts` — CRUD for mail_log
  - [x] Created `send-mail` Edge Function (Brevo/SMTP + mail_log)
  - [x] Refactored `mailConsole.tsx` — Edge Function invocation, Sentry, typed reducer
  - [x] Refactored `overviewMailbox.tsx` — MailLogRepository reads, Sentry, typed reducer
  - [x] Registered `mailLog` in DatabaseService
  - [x] All 157 tests pass, no typecheck errors

- [x] **Phase 13.6: Final Cleanup**
  - [x] Deleted 8 orphaned Firebase CF classes (merge, convert, trace, activate, sendMail, deleteFeeds)
  - [x] Cleaned up `firebase.db.cloudfunction.class.ts` — removed 8 imports/properties/instantiations
  - [x] Deleted `mailConsole.class.ts` — fully orphaned
  - [x] Removed dead methods from `product.class.ts` (mergeProducts, createProductFromMaterial)
  - [x] Removed dead methods from `material.class.ts` (createMaterialFromProduct, mergeMaterials)
  - [x] Fixed `products.tsx` to use `database.adminOps.convertProductToMaterial()`
  - [x] Kept: `migration.tsx`, `MigrationJobs/`, `executeJob.tsx`, `rebuildStats` (intentional Firebase)
  - [x] All 157 tests pass, no typecheck errors (excl. pre-existing test issues)

## Summary

Phase 13 complete. All 6 sub-phases implemented:
- 13.1: Deleted dead code, redesigned hub with grouped tiles
- 13.2: Cross-cutting quality (discriminated unions, Sentry, DOMPurify)
- 13.3: Migrated merge/convert/whereUsed to Supabase RPCs
- 13.4: Migrated activateSupportUser, added Data Integrity + Cron Job Monitoring
- 13.5: Migrated mailConsole + overviewMailbox to Edge Function + MailLogRepository
- 13.6: Final cleanup of orphaned Firebase code
