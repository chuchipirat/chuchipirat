## Phase 10: Requests — Supabase Migration & Full Refactoring

### Context

The Request system manages user-initiated workflows for public content changes (recipe publish, error reports). Currently on Firebase with 760-line abstract class + subclasses, Firebase Cloud Functions for recipe publish (100+ document updates), and 5 email notification types via Firebase sendMail. This plan migrates to Supabase, simplifies the architecture (drop polymorphism), adds proper email via Edge Function (Brevo/SMTP), and eliminates all Cloud Functions.

**Decisions (confirmed):**

- **Recipe publish** = single `UPDATE recipes SET recipe_type = 'public', is_in_review = false`. No Cloud Function needed — Supabase normalization means RLS propagates automatically.
- **Email delivery:** New Edge Function `notify-request` following the `notify-recipe-comment` pattern (Brevo primary, SMTP/MailPit fallback)
- **Feed entries:** Implemented in Phase 11 (Feed migration)
- **Request numbering:** Postgres SEQUENCE (atomic, no race conditions)
- **Single table:** Merge active/closed into one `requests` table with `status` column
- **Drop polymorphism:** Replace abstract class + 2 subclasses with a single service + transition constants. The subclasses add minimal value (different transition maps + post-actions).
- **Comments:** Separate `request_comments` table (normalized) — enables independent email triggers, unbounded growth, cleaner audit
- **Changelog:** JSONB column on `requests` — small, bounded (max ~5 entries), never queried independently

---

### Phase 10-pre: Email Infrastructure (shared across all Edge Functions)

Goal: Extract email sending logic and HTML templates into shared modules so every Edge Function reuses them instead of duplicating code.

#### Shared email service module

> [!info] File
> `supabase/volumes/functions/_shared/emailService.ts`

Extracts from `notify-recipe-comment`:

- `sendEmail(to, subject, htmlContent, textContent)` — decides Brevo vs SMTP based on env vars
- `sendViaBrevo(to, subject, html, text, apiKey)` — Brevo API call
- `sendViaSmtp(to, subject, html, text, smtpConfig)` — SMTP/MailPit fallback
- `escapeHtml(text)` — XSS prevention
- `errorResponse(message, statusCode)` — standardized error response
- Constants: `CORS_HEADERS`, `SENDER_EMAIL`, `SENDER_NAME`

#### Shared HTML templates

> [!info] Directory
> `supabase/volumes/functions/_shared/templates/`

- `header.html` — teal header (#006064) with logo, opening `<body>`, outer table
- `footer.html` — footer with hallo@chuchipirat.ch contact, closing tags
- `renderTemplate(bodyHtml, { subject })` — wraps body content with header + footer, returns complete HTML

Each email template file contains only the body content with `{{variable}}` placeholders:

| Template                   | Purpose                            |
| -------------------------- | ---------------------------------- |
| `recipe-comment.html`      | Recipe comment notification body   |
| `request-new.html`         | New request notification body      |
| `request-comment.html`     | Request comment body               |
| `request-published.html`   | Recipe published confirmation body |
| `request-error-fixed.html` | Error fixed confirmation body      |

Template rendering: simple `{{variable}}` replacement with `escapeHtml()` applied to all values.

#### Refactor `notify-recipe-comment`

> [!info] File
> `supabase/volumes/functions/notify-recipe-comment/index.ts`

- Remove inline `buildEmailHtml()`, `sendViaBrevo()`, `sendViaSmtp()`, `escapeHtml()`, `errorResponse()`, constants
- Import from `../_shared/emailService.ts` and `../_shared/templates/`
- Load template: `recipe-comment.html`, render with variables, wrap with header/footer
- Use `sendEmail()` for delivery

This makes `notify-recipe-comment` a thin orchestrator (~80 lines instead of 447).

---

### Phase 10a: SQL Schema

> [!info] File
> `supabase/migrations/20260317000001_create_requests.sql`

#### ENUMs

```sql
CREATE TYPE request_status_type AS ENUM ('created', 'inReview', 'declined', 'backToAuthor', 'done');
CREATE TYPE request_type_enum AS ENUM ('recipePublish', 'reportError');
```

#### SEQUENCE

```sql
CREATE SEQUENCE request_number_seq START WITH 1;
```

> [!warning] Post-migration sync
> After running `RequestMigrationJob`, reset sequence to continue from highest migrated number:
> `SELECT setval('request_number_seq', (SELECT COALESCE(MAX(number), 0) FROM requests));`
> Production is currently at ~1480, so next new request will get ~1481.

#### Table: `requests`

```sql
CREATE TABLE public.requests (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid       TEXT,
  number             INT NOT NULL DEFAULT nextval('request_number_seq'),
  status             request_status_type NOT NULL DEFAULT 'created',
  request_type       request_type_enum NOT NULL,
  author_uid         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_uid       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_object_uid TEXT NOT NULL,  -- FK → recipes(id), the recipe being acted on
  change_log         JSONB DEFAULT '[]',  -- [{date, userUid, action, newValue}]
  resolve_date       TIMESTAMPTZ,  -- NULL until resolved
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Normalized: author/assignee display data joined via `users` table at query time. Recipe name/picture joined via `recipes` table. Edge Function looks up email at send time (always current).

**RLS:** `author_uid = auth.uid() OR is_community_leader()` for SELECT/UPDATE. INSERT: `author_uid = auth.uid()`. No DELETE (requests are never deleted).

**Indexes:** `idx_requests_status`, `idx_requests_author`, `idx_requests_number`.

#### VIEW: `requests_view`

Joins `requests` → `users` (author), `users` (assignee), `recipes` (name, picture):

- `author_display_name`, `author_picture_src` from users via `author_uid`
- `assignee_display_name`, `assignee_picture_src` from users via `assignee_uid`
- `recipe_name`, `recipe_picture_src` from recipes via `request_object_uid`

#### Table: `request_comments`

```sql
CREATE TABLE public.request_comments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  request_id  TEXT NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  comment     TEXT NOT NULL,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Normalized: comment author data joined via `users` table using `created_by`. No denormalized user fields.

**VIEW:** `request_comments_view` — joins `request_comments` → `users` (`display_name`, `picture_src`) via `created_by`.

**RLS:** `EXISTS` subquery on parent request (same visibility rule).

**Index:** `idx_request_comments_request`. Audit triggers on both tables. `GRANT` to authenticated.

---

### Phase 10b: `RequestRepository` + `RequestCommentRepository`

#### `RequestRepository`

> [!info] File
> `src/components/Database/Repository/RequestRepository.ts`

**Domain types** (resolved via VIEWs):

- `RequestDomain` — `uid`, `number`, `status`, `requestType`, `authorUid`, `authorDisplayName`, `authorPictureSrc`, `assigneeUid`, `assigneeDisplayName`, `assigneePictureSrc`, `recipeUid`, `recipeName`, `recipePictureSrc`, `changeLog`, `resolveDate`, `createdAt`
- `RequestCommentDomain` — `uid`, `requestId`, `comment`, `userUid`, `userDisplayName`, `userPictureSrc`, `createdAt`

**Methods:**

| Method                                              | Description                                                                |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `getActiveRequests()`                               | `WHERE status NOT IN ('done', 'declined')`, ordered by `created_at DESC`   |
| `getClosedRequests()`                               | `WHERE status IN ('done', 'declined')`                                     |
| `getRequestByUid(uid)`                              | Single request                                                             |
| `createRequest(domain)`                             | INSERT (number auto-assigned by SEQUENCE), returns created row with number |
| `updateStatus(id, status, changeLog, resolveDate?)` | Partial update                                                             |
| `assignRequest(id, assignee, changeLog)`            | Partial update                                                             |
| `deleteRequest(id)`                                 | For admin cleanup only                                                     |

All error paths: `Sentry.captureException`.

#### `RequestCommentRepository`

> [!info] File
> `src/components/Database/Repository/RequestCommentRepository.ts`

| Method                                        | Description                                             |
| --------------------------------------------- | ------------------------------------------------------- |
| `getCommentsForRequest(requestId)`            | Ordered by `created_at ASC`                             |
| `insertComment(requestId, comment, authUser)` | INSERT + fire-and-forget `notify-request` Edge Function |

Register in `DatabaseService`: `requests`, `requestComments` (regular + admin). Add `STORAGE_OBJECT_PROPERTY.REQUESTS` + `REQUEST_COMMENTS` to `sessionStorageHandler` (`excludeFromCaching: true`).

**Add to `RecipeRepository`:** `patchRecipeFields(id, fields)` — partial update for `recipe_type`, `is_in_review` without needing a full `RecipeDomain`.

---

### Phase 10c: Domain Class Refactoring

#### `request.class.ts`

> [!info] File
> `src/components/Request/request.class.ts`

Strip all Firebase persistence. Keep as a static utility class (not abstract):

**Keep:**

- ENUMs: `RequestStatus`, `RequestType`, `RequestAction`
- Interfaces: `RequestAuthor`, `RequestAssignee`, `Comment`, `ChangeLog`, `RequestTransition`
- Constants: `TRANSITIONS` map per request type (move from subclasses)
- Static methods: `getNextPossibleTransitions(status, requestType)`, `translateStatus(status)` / `translateType(type)`, `createChangeLogEntry(...)`, `prepareRequestData(authUser, recipe, messageForReview, requestType)`

#### `requestService.ts` (new)

> [!info] File
> `src/components/Request/requestService.ts`

Handles post-actions after status transitions:

- `executePostAction(request, newStatus, database)` → switch on `requestType` + `status`:
  - publish + done: `database.recipes.patchRecipeFields(recipeId, {recipe_type: 'public', is_in_review: false})` + trigger email via Edge Function + feed entry (Phase 11)
  - publish + declined: `database.recipes.patchRecipeFields(recipeId, {is_in_review: false})`
  - error + done: trigger email via Edge Function
  - error + declined: no action currently
- `triggerNotification(scenario, requestId, commentId?)` → fire-and-forget Edge Function call

#### Files to delete

| File                                                    | Reason                             |
| ------------------------------------------------------- | ---------------------------------- |
| `src/components/Request/request.publishRecipe.class.ts` | Logic moves to constants + service |
| `src/components/Request/request.reportError.class.ts`   | Same                               |
| `src/components/Request/internal.ts`                    | No longer needed                   |
| All 4 Firebase DB classes for requests                  | Firebase persistence removed       |
| Firebase Cloud Function trigger classes                 | No longer needed                   |

---

### Phase 10d: Edge Function — `notify-request`

> [!info] File
> `supabase/volumes/functions/notify-request/index.ts`

Thin orchestrator using shared email infrastructure from Phase 10-pre. No inline HTML, no inline send logic.

**Payload:** `{ scenario, requestId, commentId? }`

**5 scenarios:**

| Scenario                  | Recipients                                                  | Template                   | Subject                                        |
| ------------------------- | ----------------------------------------------------------- | -------------------------- | ---------------------------------------------- |
| `newRecipePublishRequest` | All community leaders                                       | `request-new.html`         | "Neuer Antrag #{number}: {recipeName}"         |
| `newReportErrorRequest`   | All community leaders                                       | `request-new.html`         | "Neue Fehlermeldung #{number}: {recipeName}"   |
| `requestRecipePublished`  | Request author                                              | `request-published.html`   | "Dein Rezept «{name}» wurde veröffentlicht"    |
| `requestReportErrorFixed` | Request author                                              | `request-error-fixed.html` | "Die Fehlermeldung #{number} wurde bearbeitet" |
| `requestNewComment`       | Opposite party (commenter=author → assignee, else → author) | `request-comment.html`     | "Neuer Kommentar zu Antrag #{number}"          |

Each scenario: load request from DB via admin client, resolve recipient email from users table, load + render template, send via `sendEmail()` from shared module.

Register in main dispatcher: `supabase/volumes/functions/main/index.ts`.

---

### Phase 10e: UI Refactoring

#### `requestOverview.tsx`

> [!info] File
> `src/components/Request/requestOverview.tsx`

| Before                                  | After                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `useFirebase()`                         | `useDatabase()`                                                                 |
| `Request.getActiveRequests({firebase})` | `database.requests.getActiveRequests()`                                         |
| `Request.getClosedRequests({firebase})` | `database.requests.getClosedRequests()`                                         |
| `Request.updateStatus(...)`             | `database.requests.updateStatus(...)` + `RequestService.executePostAction(...)` |
| `Request.assignToMe(...)`               | `database.requests.assignRequest(...)`                                          |
| `Request.addComment(...)`               | `database.requestComments.insertComment(...)`                                   |

Add Sentry logging in all catch blocks. Full refactoring per guidelines (naming, types, JSDoc).

#### `dialogRequest.tsx`

> [!info] File
> `src/components/Request/dialogRequest.tsx`

Minor prop type adjustments (domain types instead of Firebase types). Refactoring per guidelines.

#### `recipe.view.tsx`

> [!info] File
> `src/components/Recipe/recipe.view.tsx`

| Before                                                      | After                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `new RequestPublishRecipe().createRequest({firebase, ...})` | `database.requests.createRequest({requestType: 'recipePublish', ...})` |
| `new RequestReportError().createRequest({firebase, ...})`   | `database.requests.createRequest({requestType: 'reportError', ...})`   |

Keep existing `database.recipes.patch({is_in_review: true})` (already Supabase).

---

### Phase 10f: Migration Job

> [!info] File
> `src/components/Admin/MigrationJobs/RequestMigrationJob.ts`

**Source:** Firebase `requests/active/requests/*` + `requests/closed/requests/*`

1. `fetchSourceRecords()` — read from both active/closed collections
2. `buildLookupMaps()` — user Firebase UID → Supabase `auth_uid`
3. `migrateRecord()` — insert request with explicit `number` (from Firebase data, overriding SEQUENCE DEFAULT) + comments, resolve user UIDs
4. **Critical post-migration step:** reset sequence to continue from highest migrated number: `SELECT setval('request_number_seq', (SELECT COALESCE(MAX(number), 0) FROM requests));`

Register in `migrationJobRegistry.ts`.

---

### Phase 10g: Tests + Cleanup

- **Unit tests:** `RequestRepository`, `RequestCommentRepository`, `request.class.ts` (transitions, changeLog)
- **Manual testcases:** Obsidian vault (prefix RQ)
- Remove debug `console.log`s
- Update `ENVIRONMENT_SETUP.md` with new migration

---

### Files Summary

#### SQL Migration

| File                                                     | Action     |
| -------------------------------------------------------- | ---------- |
| `supabase/migrations/20260317000001_create_requests.sql` | **Create** |

#### Shared Email Infrastructure

| File                                                                    | Action                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------- |
| `supabase/volumes/functions/_shared/emailService.ts`                    | **Create** — shared Brevo/SMTP send logic           |
| `supabase/volumes/functions/_shared/templates/header.html`              | **Create** — shared email header                    |
| `supabase/volumes/functions/_shared/templates/footer.html`              | **Create** — shared email footer                    |
| `supabase/volumes/functions/_shared/templates/recipe-comment.html`      | **Create** — extracted from `notify-recipe-comment` |
| `supabase/volumes/functions/_shared/templates/request-new.html`         | **Create**                                          |
| `supabase/volumes/functions/_shared/templates/request-comment.html`     | **Create**                                          |
| `supabase/volumes/functions/_shared/templates/request-published.html`   | **Create**                                          |
| `supabase/volumes/functions/_shared/templates/request-error-fixed.html` | **Create**                                          |

#### Edge Functions

| File                                                        | Action                                 |
| ----------------------------------------------------------- | -------------------------------------- |
| `supabase/volumes/functions/notify-recipe-comment/index.ts` | **Modify** — use shared modules        |
| `supabase/volumes/functions/notify-request/index.ts`        | **Create** — thin orchestrator         |
| `supabase/volumes/functions/main/index.ts`                  | **Modify** — register `notify-request` |

#### Repositories

| File                                                             | Action                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `src/components/Database/Repository/RequestRepository.ts`        | **Create**                                     |
| `src/components/Database/Repository/RequestCommentRepository.ts` | **Create**                                     |
| `src/components/Database/Repository/RecipeRepository.ts`         | **Modify** — add `patchRecipeFields`           |
| `src/components/Database/DatabaseService.ts`                     | **Modify** — add `requests`, `requestComments` |

#### Domain / Service

| File                                       | Action                                              |
| ------------------------------------------ | --------------------------------------------------- |
| `src/components/Request/request.class.ts`  | **Modify** — strip Firebase, keep types/transitions |
| `src/components/Request/requestService.ts` | **Create** — post-action dispatch                   |

#### UI Components

| File                                         | Action                                       |
| -------------------------------------------- | -------------------------------------------- |
| `src/components/Request/requestOverview.tsx` | **Modify** — full refactoring                |
| `src/components/Request/dialogRequest.tsx`   | **Modify** — refactoring                     |
| `src/components/Recipe/recipe.view.tsx`      | **Modify** — replace `createRequest` callers |

#### Migration Job

| File                                                         | Action     |
| ------------------------------------------------------------ | ---------- |
| `src/components/Admin/MigrationJobs/RequestMigrationJob.ts`  | **Create** |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts` | **Modify** |

#### Other

| File                                                        | Action                      |
| ----------------------------------------------------------- | --------------------------- |
| `src/components/Firebase/Db/sessionStorageHandler.class.ts` | **Modify** — add cache keys |
| `supabase/ENVIRONMENT_SETUP.md`                             | **Modify**                  |

#### Files to delete

| File                                                    | Reason                             |
| ------------------------------------------------------- | ---------------------------------- |
| `src/components/Request/request.publishRecipe.class.ts` | Logic moves to constants + service |
| `src/components/Request/request.reportError.class.ts`   | Same                               |
| `src/components/Request/internal.ts`                    | No longer needed                   |

---

### Verification

1. `npx tsc --noEmit` — zero new errors
2. `npx jest` — all tests pass
3. Manual: create recipe publish request → email sent to community leaders
4. Manual: community leader assigns request → assignee visible
5. Manual: add comment → email sent to opposite party
6. Manual: transition to "done" (publish) → `recipe_type` changes to `'public'`, email to author
7. Manual: transition to "declined" (publish) → `is_in_review` set to false
8. Manual: report error → done → email to author
9. Manual: basic user sees only own requests, community leader sees all
10. Manual: request numbering is sequential and unique
11. Migration: run `RequestMigrationJob` → Firebase data correctly in Supabase
