## Phase 14: Cron Job Migration to Supabase

### Context

Two Firebase Cloud Functions run as scheduled cron jobs: `dailySummary` (03:00 UTC) and `recipesInMenuplanCounter` (02:00 UTC). Both are monolithic — each does multiple unrelated things. With Supabase/Postgres, much of their logic is either obsolete (denormalized stats already computed by `get_platform_stats()`) or can be replaced by simple SQL queries. This phase splits them into focused, independent jobs, drops what's no longer needed, and adds proper monitoring via Sentry Crons and the `cron_job_log` table.

---

### What Gets Built vs Dropped

| Firebase Logic                        | Decision                             | Rationale                                            |
| ------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| Welcome email (in `dailySummary`)     | **New:** real-time trigger           | Send immediately on user creation, not batched daily |
| Daily activity digest + open requests | **New:** `cron-daily-digest`         | SQL aggregation replaces Firestore reads             |
| Support user cleanup                  | **New:** `cron-support-user-cleanup` | Independent job, no coupling to digest               |
| Recipe usage counter                  | **DROP**                             | `get_platform_stats()` already computes this live    |
| Portion counter                       | **DROP**                             | `get_platform_stats()` already has `noPortions`      |
| Review survey email                   | **New:** `cron-event-review-email`   | Only remaining piece from `recipesInMenuplanCounter` |
| Firebase `_cloudFunctions/log`        | **DROP**                             | Replaced by `cron_job_log` table                     |

**Result:** 3 cron Edge Functions + 1 real-time Edge Function. 3 pieces of logic dropped entirely.

---

### Implementation Steps

#### Step 1 — Shared Cron Helper

> [!info] File
> `supabase/volumes/functions/_shared/cronJobHelper.ts`

New shared module used by all cron Edge Functions:

- `startCronJob(supabaseAdmin, jobName)` → INSERT into `cron_job_log` with `status='running'`, returns log ID
- `completeCronJob(supabaseAdmin, logId, recordsProcessed, details)` → UPDATE to `status='success'`, set `finished_at` + `duration_ms`
- `failCronJob(supabaseAdmin, logId, errorMessage, details)` → UPDATE to `status='error'`
- `sentryCheckIn(monitorSlug, status, checkInId?)` → Sentry Crons HTTP API (Deno-compatible, no SDK needed). Uses `SENTRY_DSN` env var. Parses DSN to extract project ID + public key, POSTs to `https://{host}/api/{projectId}/cron/{monitorSlug}/`

#### Step 2 — Email Templates

> [!info] File
> `supabase/volumes/functions/_shared/templateRenderer.ts`

Add 3 new templates to `BODY_TEMPLATES`:

| Template       | Variables                                                              | Content                                               |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `welcome`      | `displayName`                                                          | Greeting, intro to chuchipirat, app link              |
| `daily-digest` | `recipientName`, `date`, `statsTable` (raw), `openRequestsBlock` (raw) | Activity summary table + open requests section        |
| `event-review` | `cookName`, `eventName`                                                | "Your event ended! Share your feedback" with app link |

#### Step 3 — Welcome Email Trigger

> [!info] File
> `supabase/volumes/functions/send-welcome-email/index.ts`

**Trigger:** Called via `pg_net` from a Postgres trigger on `users` table INSERT (or via Supabase Database Webhook).

**Logic:**

1. Receive payload with `user_id`
2. Query user's email + `display_name` from `users` table
3. Render welcome template, send via `sendEmail()`
4. Log to `mail_log`

**Migration:** `20260322000001_welcome_email_trigger.sql` — create a trigger function on `users` INSERT that calls the Edge Function via `pg_net.http_post()`. Alternative: use Supabase Database Webhooks (configured via dashboard) — document both approaches.

#### Step 4 — `cron-daily-digest`

> [!info] File
> `supabase/volumes/functions/cron-daily-digest/index.ts`

**Schedule:** Daily at 02:15 UTC (03:15/04:15 Zurich)

**Logic:**

1. Start cron job log + Sentry check-in (`in_progress`)
2. Calculate yesterday boundaries in `Europe/Zurich` timezone
3. Query feeds grouped by `feed_type`:
   ```sql
   SELECT feed_type, COUNT(*) FROM feeds
   WHERE created_at >= $yesterday AND created_at < $today
   GROUP BY feed_type
   ```
4. For feed types that have detail data (new users, events, recipes, products, materials): query the actual entities to get names/details for the email
5. Query open/unassigned requests:
   ```sql
   SELECT number, request_type, created_at, author display_name
   FROM requests_view
   WHERE status IN ('created', 'inReview') AND assignee_uid IS NULL
   ```
6. Build digest HTML from stats + requests
7. Query Community Leaders: `SELECT email, display_name FROM users WHERE 'communityLeader' = ANY(roles)`
8. If no activity and no open requests → skip sending, log `records_processed=0`
9. Send digest email to each leader via `sendEmail()`
10. Log to `mail_log` + complete cron job log + Sentry check-in (`ok`)

#### Step 5 — `cron-support-user-cleanup`

> [!info] File
> `supabase/volumes/functions/cron-support-user-cleanup/index.ts`

**Schedule:** Daily at 02:30 UTC

**Logic:**

1. Start cron job log + Sentry check-in
2. Read `SUPPORT_USER_ID` from env var
3. Find events where support user is a cook AND event has ended (`max date_to < today`):
   ```sql
   SELECT ec.id, ec.event_id, e.name
   FROM event_cooks ec
   JOIN events e ON e.id = ec.event_id
   WHERE ec.user_id = $supportUserId
   AND ec.event_id IN (
     SELECT event_id FROM event_dates
     GROUP BY event_id
     HAVING MAX(date_to) < CURRENT_DATE
   )
   ```
4. DELETE those `event_cooks` rows
5. Complete cron job log with removed event names in details
6. Sentry check-in (`ok`)

#### Step 6 — `cron-event-review-email`

> [!info] File
> `supabase/volumes/functions/cron-event-review-email/index.ts`

**Schedule:** Daily at 01:00 UTC (02:00/03:00 Zurich)

**Logic:**

1. Start cron job log + Sentry check-in
2. Find events that ended yesterday (`max date_to = yesterday` in `Europe/Zurich`):
   ```sql
   SELECT DISTINCT ed.event_id, e.name
   FROM event_dates ed
   JOIN events e ON e.id = ed.event_id
   GROUP BY ed.event_id, e.name
   HAVING MAX(ed.date_to) = (CURRENT_DATE - INTERVAL '1 day')::DATE
   ```
3. For each ended event, get cooks:
   ```sql
   SELECT u.email, u.display_name
   FROM event_cooks ec
   JOIN users u ON u.auth_uid = ec.user_id
   WHERE ec.event_id = $eventId AND u.email IS NOT NULL
   ```
4. Send review email to each cook via `sendEmail()` with `event-review` template
5. Log to `mail_log` + complete cron job log + Sentry check-in

#### Step 7 — SQL Migrations

> [!info] Files
>
> - `supabase/migrations/20260322000001_welcome_email_trigger.sql`
> - `supabase/migrations/20260322000002_enable_pg_cron_schedule_jobs.sql`

**`20260322000001`:** Enable `pg_net` extension (if not already). Create trigger function `notify_welcome_email()` on `users` INSERT → calls Edge Function via `pg_net.http_post()`. GRANT INSERT, UPDATE on `cron_job_log` TO `service_role`.

**`20260322000002`:** Enable `pg_cron` extension. Schedule 3 cron jobs via `cron.schedule()` using `pg_net.http_post()` to invoke each Edge Function. Store Supabase URL + service role key as Postgres settings (`app.supabase_url`, `app.service_role_key`) or use env-specific values.

#### Step 8 — Admin CronJobs UI Updates

> [!info] File
> `src/components/Admin/CronJobs/cronJobs.tsx`

1. Remove the Phase 14 placeholder message
2. Add a job name filter dropdown (Select with options: All, `cron-daily-digest`, `cron-support-user-cleanup`, `cron-event-review-email`) — uses existing `getByJobName()` method
3. Add a "Trigger Now" button per job type → calls `supabase.functions.invoke()` directly
4. Make the details column clickable → show JSONB content in a dialog

#### Step 9 — Text Constants

> [!info] File
> `src/constants/text.ts`

Add constants for: cron job names / labels, "Trigger Now" button text, filter labels, details dialog title.

#### Step 10 — Environment Setup

New env vars for Edge Functions:

| Variable          | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `SENTRY_DSN`      | Sentry DSN for cron monitoring check-ins                         |
| `SUPPORT_USER_ID` | Auth UUID of support user (same value as `VITE_SUPPORT_USER_ID`) |

Update `supabase/ENVIRONMENT_SETUP.md` with these new variables.

---

### Files Summary

#### Edge Functions

| File                                                            | Action                                           |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `supabase/volumes/functions/_shared/cronJobHelper.ts`           | **Create** — shared cron logging + Sentry helper |
| `supabase/volumes/functions/_shared/templateRenderer.ts`        | **Modify** — add 3 email templates               |
| `supabase/volumes/functions/send-welcome-email/index.ts`        | **Create** — welcome email Edge Function         |
| `supabase/volumes/functions/cron-daily-digest/index.ts`         | **Create** — daily digest Edge Function          |
| `supabase/volumes/functions/cron-support-user-cleanup/index.ts` | **Create** — support user cleanup Edge Function  |
| `supabase/volumes/functions/cron-event-review-email/index.ts`   | **Create** — event review email Edge Function    |

#### SQL Migrations

| File                                                                  | Action                                          |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| `supabase/migrations/20260322000001_welcome_email_trigger.sql`        | **Create** — `pg_net` trigger for welcome email |
| `supabase/migrations/20260322000002_enable_pg_cron_schedule_jobs.sql` | **Create** — `pg_cron` + job schedules          |

#### UI / Constants

| File                                         | Action                                                  |
| -------------------------------------------- | ------------------------------------------------------- |
| `src/components/Admin/CronJobs/cronJobs.tsx` | **Modify** — job filter, trigger button, details dialog |
| `src/constants/text.ts`                      | **Modify** — new German constants for cron UI           |
| `supabase/ENVIRONMENT_SETUP.md`              | **Modify** — document new env vars                      |

---

### Verification

1. **Local testing:** start Docker, run migrations, manually invoke each Edge Function via curl or Supabase Studio
2. **Check `cron_job_log`:** verify entries appear with correct status, duration, `records_processed`
3. **Check MailPit:** verify welcome, digest, and review emails are sent with correct content
4. **Welcome email trigger:** create a new user → welcome email should arrive immediately
5. **Daily digest:** create feeds for "yesterday", run digest → email to Community Leaders with activity
6. **Support user cleanup:** add support user to an ended event, run cleanup → verify removal
7. **Event review:** create event with `date_to = yesterday`, run job → review email to cooks
8. **Edge cases:** no activity yesterday → digest skips sending (`records_processed=0`). No ended events → review job completes gracefully. Support user not in any events → cleanup completes with 0.
9. **pg_cron:** check `SELECT * FROM cron.job` to verify schedules are registered
10. **Sentry:** check Sentry dashboard for cron monitor entries with correct statuses
11. **Admin UI:** filter by job name, trigger a job manually, inspect details JSON
12. `npx tsc --noEmit` — no new type errors
