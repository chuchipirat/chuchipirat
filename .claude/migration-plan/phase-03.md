## Phase 3: Migrate GlobalSettings & SystemMessage to Supabase/Postgres

### Context

Phase 1 (users table) and Phase 2 (auth) are complete. Phase 3 migrates the two singleton configuration documents from Firestore (`_configuration/globalSettings` and `_configuration/systemMessage`) to Postgres tables. No automated migration job — the user migrates data manually. This plan also removes the unused `allowUserCreatePassword` setting and replaces the Firebase `signOutAllUsers` Cloud Function with a Supabase Edge Function.

### Table Design Decision: Wide Table (one column per setting)

For `global_settings` (2 boolean fields after removing `allowUserCreatePassword`), a wide table wins over key-value (EAV): type-safe, maps cleanly to `BaseRepository<TDomain, TRow>`, trivial queries.

---

### Audit Columns Convention

All Supabase tables must have these 4 audit columns:

| Column              | Type                   | Default | Set by                   |
| ------------------- | ---------------------- | ------- | ------------------------ |
| `created_at`        | `TIMESTAMPTZ NOT NULL` | `NOW()` | DB (auto)                |
| `created_from`      | `TEXT NOT NULL`        | `''`    | App (`authUser.authUid`) |
| `last_change_at`    | `TIMESTAMPTZ NOT NULL` | `NOW()` | DB (trigger)             |
| `last_changed_from` | `TEXT NOT NULL`        | `''`    | App (`authUser.authUid`) |

The existing `users` table is missing the `_from` columns — a separate migration will add them later.

---

### Implementation Steps

#### Step 0a — Add `authUid` to `AuthUser` class

> [!info] Files
>
> - `src/components/Firebase/Authentication/authUser.class.ts` — add `authUid: string` property
> - `src/components/Session/authUserContext.tsx` — populate `authUid` from `session.user.id`

**Why:** Currently `authUser.uid` holds the Firebase UID (`users.id`), not the Supabase auth UUID (`auth.users.id` / `users.auth_uid`). The audit columns must store the Supabase auth UUID since Firebase UIDs will be deleted after migration. The Supabase auth UUID is available as `session.user.id` in the auth state listener (line 55 of `authUserContext.tsx`) and as `userDomain.authUid` from the users repo.

#### Step 0b — Update `BaseRepository` to populate audit user columns

> [!info] File
> `src/components/Database/Repository/BaseRepository.ts`

Currently `authUser` is accepted but unused (`_authUser`). Update:

- `insert()`: add `created_from` and `last_changed_from` to the row with `authUser.authUid`
- `update()`: add `last_changed_from` to the row with `authUser.authUid`
- `upsert()`: add `created_from` and `last_changed_from` to the row with `authUser.authUid`
- `patch()`: if `authUser` is provided, add `last_changed_from` to fields

Uses `authUser.authUid` (Supabase auth UUID) — **NOT** `authUser.uid` (Firebase UID).

#### Step 1 — SQL Migration: `global_settings`

> [!info] File
> `supabase/migrations/20260301000001_create_global_settings.sql`

```sql
CREATE TABLE public.global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  allow_sign_up BOOLEAN NOT NULL DEFAULT false,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_from TEXT NOT NULL DEFAULT '',
  last_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_from TEXT NOT NULL DEFAULT '',
  CONSTRAINT single_row CHECK (id = 'default')
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read (SignIn page needs maintenanceMode before auth)
CREATE POLICY global_settings_select ON public.global_settings
  FOR SELECT USING (true);

-- Only admins can write
CREATE POLICY global_settings_update ON public.global_settings
  FOR UPDATE USING (is_admin());

GRANT SELECT ON public.global_settings TO anon, authenticated;
GRANT UPDATE ON public.global_settings TO authenticated;

CREATE TRIGGER trg_global_settings_last_change
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_last_change_at();

INSERT INTO public.global_settings (id) VALUES ('default');
```

No `allow_user_create_password` column — setting is removed.

#### Step 2 — SQL Migration: `system_messages`

> [!info] File
> `supabase/migrations/20260301000002_create_system_messages.sql`

```sql
CREATE TABLE public.system_messages (
  id TEXT PRIMARY KEY DEFAULT 'default',
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('success','info','warning','error')),
  valid_to TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_from TEXT NOT NULL DEFAULT '',
  last_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_changed_from TEXT NOT NULL DEFAULT '',
  CONSTRAINT single_row CHECK (id = 'default')
);

ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_messages_select ON public.system_messages
  FOR SELECT USING (true);

CREATE POLICY system_messages_update ON public.system_messages
  FOR UPDATE USING (is_admin());

GRANT SELECT ON public.system_messages TO anon, authenticated;
GRANT UPDATE ON public.system_messages TO authenticated;

CREATE TRIGGER trg_system_messages_last_change
  BEFORE UPDATE ON public.system_messages
  FOR EACH ROW EXECUTE FUNCTION update_last_change_at();

INSERT INTO public.system_messages (id) VALUES ('default');
```

#### Step 3 — `GlobalSettingsRepository`

> [!info] File
> `src/components/Database/Repository/GlobalSettingsRepository.ts`

| Aspect                      | Detail                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Row type** (snake_case)   | `id`, `allow_sign_up`, `maintenance_mode`, `created_at`, `created_from`, `last_change_at`, `last_changed_from` |
| **Domain type** (camelCase) | `allowSignUp: boolean`, `maintenanceMode: boolean`                                                             |
| **Extends**                 | `BaseRepository<GlobalSettingsDomain, GlobalSettingsRow>`                                                      |
| **tableName**               | `"global_settings"`                                                                                            |
| **getCacheConfig()**        | `STORAGE_OBJECT_PROPERTY.GLOBAL_SETTINGS` (`excludeFromCaching: true`)                                         |

**Convenience methods:**

- `getSettings()` → `findById("default")` — loads the singleton
- `saveSettings(settings, authUser)` → `update({id: "default", value, authUser})`

#### Step 4 — `SystemMessageRepository`

> [!info] File
> `src/components/Database/Repository/SystemMessageRepository.ts`

| Aspect                      | Detail                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Row type** (snake_case)   | `id`, `title`, `text`, `type`, `valid_to`, `created_at`, `created_from`, `last_change_at`, `last_changed_from` |
| **Domain type** (camelCase) | `title: string`, `text: string`, `type: "success"\|"info"\|"warning"\|"error"`, `validTo: Date`                |
| **Extends**                 | `BaseRepository<SystemMessageDomain, SystemMessageRow>`                                                        |
| **tableName**               | `"system_messages"`                                                                                            |
| **getCacheConfig()**        | `STORAGE_OBJECT_PROPERTY.SYSTEM_MESSAGE` (360s cache)                                                          |

**Convenience methods:**

- `getMessage()` → `findById("default")`
- `getValidMessage()` → loads, checks `validTo >= today 23:59:59`, returns `null` if expired
- `saveMessage(message, authUser)` → normalizes `validTo` to 23:59:59, calls `update()`

#### Step 5 — Tests for both repositories

> [!info] Files
>
> - `src/components/Database/Repository/__tests__/GlobalSettingsRepository.test.ts`
> - `src/components/Database/Repository/__tests__/SystemMessageRepository.test.ts`

Uses existing `supabaseMock.ts` pattern. Tests cover: `tableName`, `toRow()`/`toDomain()` roundtrip, convenience methods, validity check, `validTo` normalization, error cases.

#### Step 6 — Register repos in `DatabaseService`

> [!info] File
> `src/components/Database/DatabaseService.ts` (Modify)

Add:

- `globalSettings: GlobalSettingsRepository`
- `systemMessages: SystemMessageRepository`
- Same for `admin` object (inject `supabaseAdmin`)

#### Step 7 — Supabase Edge Function: `sign-out-all-users`

> [!info] File
> `supabase/volumes/functions/sign-out-all-users/index.ts`

Replaces Firebase Cloud Function `signOutAllUsers`.

**Logic:**

1. Verify caller is admin (check JWT claims or query `public.users` for admin role)
2. Fetch all users with `auth_uid` from `public.users`
3. For each non-admin user: call `supabaseAdmin.auth.admin.signOut(authUid)` to revoke sessions
4. Return JSON with `signedOutUsers` array and count

**Pattern follows `notify-vestaboard` Edge Function:**

- `Deno.serve()` based
- CORS preflight handling
- POST only
- Uses `createClient` with service role key from `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`

**Frontend invocation:** `supabase.functions.invoke("sign-out-all-users")` (same pattern as `notify-vestaboard` in `verifyEmail.tsx`)

#### Step 8 — Update consumer components

| Component                  | Current Call                                                    | New Call                                                             |
| -------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `signIn.tsx`               | `GlobalSettings.getGlobalSettings({firebase})`                  | `database.globalSettings.getSettings()`                              |
| `signUp.tsx`               | `GlobalSettings.getGlobalSettings({firebase})`                  | `database.globalSettings.getSettings()`                              |
| `admin/globalSettings.tsx` | `GlobalSettings.getGlobalSettings/save({firebase...})`          | `database.globalSettings.getSettings()` + `adminRepo.saveSettings()` |
| `admin/globalSettings.tsx` | `GlobalSettings.signOutAllUsers({firebase...})`                 | `supabase.functions.invoke("sign-out-all-users")`                    |
| `admin/systemMessage.tsx`  | `SystemMessage.getSystemMessage/save({firebase...})`            | `database.systemMessages.getMessage()` + `adminRepo.saveMessage()`   |
| `home.tsx`                 | `SystemMessage.getSystemMessage({firebase, mustBeValid: true})` | `database.systemMessages.getValidMessage()`                          |

**Details:**

- `signIn.tsx` already has `useDatabase()` — just swap the call
- `signUp.tsx` already has `useDatabase()` — swap the call
- `home.tsx` needs `useDatabase()` added
- `admin/globalSettings.tsx` needs `useDatabase()` added; can drop `useFirebase()` once `signOutAllUsers` is migrated
- `admin/systemMessage.tsx` can drop `useFirebase()` entirely
- Admin writes use `database.admin?.globalSettings ?? database.globalSettings`

#### Step 9 — Remove `allowUserCreatePassword`

| File                                              | What to remove                                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/components/Admin/globalSettings.class.ts`    | Property `allowUserCreatePassword`, constructor init                                                              |
| `src/components/SignUp/signUp.tsx`                | State property, initial state, reducer line (161), test-environment code dialog (lines 224–243), JSDoc references |
| `src/components/SignUp/__tests__/signUp.test.tsx` | Mock values for `allowUserCreatePassword`                                                                         |
| `src/components/SignIn/__tests__/signIn.test.tsx` | Mock value for `allowUserCreatePassword`                                                                          |

The entire test-environment code check block in `signUp.tsx` (lines 224–243) can be removed — it prompts for a code word, compares with `btoa()`, and shows an error on mismatch.

#### Step 10 — Update model classes (cleanup)

The static methods on `globalSettings.class.ts` (`getGlobalSettings`, `save`, `signOutAllUsers`) and `systemMessage.class.ts` (`getSystemMessage`, `save`) that take `{firebase}` become dead code. Remove them and keep the classes only as type definitions (or switch reducers to use domain interfaces directly).

---

### Files Summary

| File                                                                            | Action                                                                           |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `supabase/migrations/20260301000001_create_global_settings.sql`                 | **New**                                                                          |
| `supabase/migrations/20260301000002_create_system_messages.sql`                 | **New**                                                                          |
| `src/components/Database/Repository/GlobalSettingsRepository.ts`                | **New**                                                                          |
| `src/components/Database/Repository/SystemMessageRepository.ts`                 | **New**                                                                          |
| `src/components/Database/Repository/__tests__/GlobalSettingsRepository.test.ts` | **New**                                                                          |
| `src/components/Database/Repository/__tests__/SystemMessageRepository.test.ts`  | **New**                                                                          |
| `supabase/volumes/functions/sign-out-all-users/index.ts`                        | **New**                                                                          |
| `src/components/Firebase/Authentication/authUser.class.ts`                      | **Modify** — add `authUid` property                                              |
| `src/components/Session/authUserContext.tsx`                                    | **Modify** — populate `authUid` from `session.user.id`                           |
| `src/components/Database/Repository/BaseRepository.ts`                          | **Modify** — populate `created_from`/`last_changed_from` from `authUser.authUid` |
| `src/components/Database/Repository/__tests__/BaseRepository.test.ts`           | **Modify** — update tests for audit columns                                      |
| `src/components/Database/DatabaseService.ts`                                    | **Modify** — add repos                                                           |
| `src/components/SignIn/signIn.tsx`                                              | **Modify** — use `database.globalSettings`                                       |
| `src/components/SignUp/signUp.tsx`                                              | **Modify** — use `database.globalSettings`, remove `allowUserCreatePassword`     |
| `src/components/Home/home.tsx`                                                  | **Modify** — use `database.systemMessages`                                       |
| `src/components/Admin/globalSettings.tsx`                                       | **Modify** — use database + Edge Function                                        |
| `src/components/Admin/globalSettings.class.ts`                                  | **Modify** — remove `allowUserCreatePassword`, remove Firebase static methods    |
| `src/components/Admin/systemMessage.tsx`                                        | **Modify** — use database                                                        |
| `src/components/Admin/systemMessage.class.ts`                                   | **Modify** — remove Firebase static methods                                      |
| `src/components/SignUp/__tests__/signUp.test.tsx`                               | **Modify** — remove `allowUserCreatePassword` mocks                              |
| `src/components/SignIn/__tests__/signIn.test.tsx`                               | **Modify** — remove `allowUserCreatePassword` mocks                              |

### Key Reference Files

- `src/components/Database/Repository/BaseRepository.ts` — abstract base class
- `src/components/Database/Repository/UserRepository.ts` — reference for `toRow`/`toDomain` pattern
- `src/components/Database/Repository/__mocks__/supabaseMock.ts` — test mock pattern
- `src/components/Firebase/Db/sessionStorageHandler.class.ts` — `STORAGE_OBJECT_PROPERTY` definitions
- `supabase/migrations/20260226000001_add_auth_uid.sql` — `is_admin()`, RLS policy patterns
- `supabase/volumes/functions/notify-vestaboard/index.ts` — Edge Function pattern
- `src/components/AuthServiceHandler/verifyEmail.tsx:56` — `supabase.functions.invoke()` usage pattern

### Verification

1. Apply migrations: restart Supabase Docker containers
2. `npx tsc --noEmit` — no type errors
3. `npx jest --testPathPatterns="GlobalSettings|SystemMessage|signIn|signUp"` — all tests pass
4. Manual: sign-in page respects `maintenance_mode`, sign-up works without code word prompt
5. Manual: admin page reads/saves GlobalSettings and SystemMessage via Supabase
6. Manual: admin "Sign Out All Users" triggers Edge Function successfully
