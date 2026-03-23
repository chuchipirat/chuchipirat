# Security Guidelines

Consult this file when implementing any form input, authentication flow, file upload, or database access. These conventions were established during a security review of the auth and profile components (SignUp, SignIn, PasswordChange, UserProfile) and the Supabase persistence layer.

---

## Security Review Summary (Phase 2–4 Migration)

### What was reviewed

- `signUp.tsx`, `signIn.tsx`, `passwordChange.tsx`, `userProfile.tsx`
- `BaseRepository.ts` (all CRUD + Realtime paths)
- Supabase migrations (RLS policies, DB functions)

### Findings

| Area                        | Status     | Notes                                                     |
| --------------------------- | ---------- | --------------------------------------------------------- |
| SQL injection               | ✅ Safe    | PostgREST parameterized client used throughout            |
| XSS                         | ✅ Safe    | React auto-escapes; no `dangerouslySetInnerHTML`          |
| CSRF                        | ✅ Safe    | SPA with JWT auth; no cookie-based sessions               |
| Auth brute-force            | ✅ Safe    | Supabase rate-limits auth endpoints                       |
| Input validation (email)    | ⚠️ Fixed   | signUp.tsx was missing `Utils.isEmail()` check            |
| Input validation (password) | ⚠️ Fixed   | signUp.tsx was missing minimum length check               |
| Row Level Security          | ✅ Safe    | Enabled on all Postgres tables                            |
| File upload MIME type       | ⚠️ Partial | Only client-side `accept="image/*"`; needs storage policy |
| `increment_field` RPC       | ⚠️ Missing | DB function not created yet — calls will fail at runtime  |

---

## SQL Injection

**Not a risk with the current architecture.** The Supabase PostgREST client never
constructs raw SQL strings. All values are passed as typed JavaScript parameters:

```typescript
// ✅ Safe — parameterized via PostgREST client
.from("products").select("*").eq("usable", true)
.rpc("increment_field", {table_name: "users", row_id: id, field_name: "no_logins", amount: 1})
```

**Rules:**

- Never concatenate user input into a query string.
- Never use `.rpc()` with a function that executes `EXECUTE format(...)` from unvalidated parameters.
- If a DB function takes `table_name` or `field_name` as a `TEXT` argument and uses dynamic SQL, add an allowlist guard inside the function (see `increment_field` below).

---

## XSS

React's JSX auto-escapes all interpolated values. **Do not** use `dangerouslySetInnerHTML` with any value derived from user input or DB data.

---

## Input Validation

### Client-side validation

Client-side checks provide immediate UX feedback. They are **not** the security boundary — the server always validates independently.

**Mandatory checks before submitting auth forms:**

| Field                    | Validation             | Utility                                |
| ------------------------ | ---------------------- | -------------------------------------- |
| Email                    | `Utils.isEmail(email)` | `src/components/Shared/utils.class.ts` |
| Password (create/change) | `password.length >= 6` | Inline                                 |
| Required text fields     | `value !== ""`         | Inline                                 |

**Button disabled pattern (matches signIn.tsx and passwordChange.tsx):**

```tsx
<Button
  disabled={
    !Utils.isEmail(formData.email) ||
    formData.password.length < 6
  }
  ...
>
```

**Validation hint pattern (matches passwordChange.tsx):**

```tsx
{
  formData.email && !Utils.isEmail(formData.email) && (
    <Typography color="error" variant="body2">
      {TEXT_GIVE_VALID_EMAIL}
    </Typography>
  );
}
```

### What has been fixed

`signUp.tsx` previously accepted non-empty but malformed email addresses and
passwords shorter than 6 characters. Both checks have been added for consistency
with `signIn.tsx` and `passwordChange.tsx`.

---

## Authentication

- **Re-authentication before sensitive changes**: `passwordChange.tsx` shows a
  `DialogReauthenticate` dialog before the user can change their email or password.
  Follow this pattern for any similarly sensitive operation.
- **Password reset flow**: Uses Supabase's built-in OTP/recovery token — the
  `oobCode` is validated server-side.
- **Maintenance mode**: The client-side Ctrl+Alt+Shift+C shortcut resets `maintenanceMode`
  in local state only. This is intentional (developer escape hatch). The server enforces
  all real access controls independently.

---

## File Uploads

`userProfile.tsx` uses `accept="image/*"` on the file input. This is a browser hint
only — a malicious user can bypass it.

**What is enforced server-side (bucket `media`):**

- MIME types: `image/jpeg`, `image/png`, `image/webp` — set on the bucket via
  `allowed_mime_types` (migration `20260227000002`).
- Max file size: **2 MB** — set on the bucket via `file_size_limit` (migration
  `20260303000007`). Profile pictures are client-side resized to max 1200 px before
  upload, so a high-quality JPEG rarely exceeds 500 KB. 2 MB is the server-side ceiling.
- User-scoped write path: RLS policies (migration `20260303000007`) enforce
  `users/{auth.uid()}.jpg` — a user can only write or delete their own file.

**Required pattern for every new file upload:**

1. Set `allowed_mime_types` and `file_size_limit` on the bucket (or in a migration).
2. Add RLS policies scoping write/delete to `auth.uid()` within the path.
3. Use the **regular Supabase client**, not the admin/service-role client, so that
   `auth.uid()` resolves correctly in the policies.

**Note — admin bypass during migration:** `User.uploadPicture()` currently uses
`database.admin?.storage.users ?? database.storage.users`, which bypasses RLS.
This is intentional for the transition period. Once the migration is complete,
switch to the regular client so RLS is enforced. See `docs/claude/post-migration-tasks.md`.

**Policy template for user-scoped uploads:**

```sql
-- INSERT: only allow writing to users/{auth.uid()}.jpg
CREATE POLICY <bucket>_users_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = '<bucket>'
    AND (storage.foldername(name))[1] = 'users'
    AND storage.filename(name) = auth.uid()::TEXT || '.jpg'
  );
```

---

## Row Level Security

All Postgres tables must have RLS enabled and explicit policies. See
`docs/claude/database-and-supabase.md` for the full convention. Key points:

- `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;` — always.
- Use `is_admin()` for admin-only writes.
- Use `auth.uid()` for user-scoped access.
- Prefer minimal grants: `GRANT SELECT ON ... TO authenticated` rather than `ALL`.

---

## DB Functions with Dynamic SQL

If a DB function accepts `table_name` or `field_name` parameters and builds
dynamic SQL, add an allowlist check to prevent privilege escalation:

```sql
-- Example for increment_field (function not yet created — see post-migration-tasks.md)
CREATE OR REPLACE FUNCTION public.increment_field(
  table_name TEXT,
  row_id TEXT,
  field_name TEXT,
  amount INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Allowlist guard: only allow known tables and fields
  IF table_name NOT IN ('users', 'events', 'recipes') THEN
    RAISE EXCEPTION 'increment_field: table not allowed: %', table_name;
  END IF;
  EXECUTE format(
    'UPDATE public.%I SET %I = %I + $1 WHERE id = $2',
    table_name, field_name, field_name
  ) USING amount, row_id;
END;
$$;
```

---

## Checklist for New Features

When implementing a new form, repository, or upload:

- [ ] All user-facing text inputs validated client-side (format + required)
- [ ] DB access via `BaseRepository` or Supabase client — never raw SQL strings
- [ ] RLS enabled on any new table
- [ ] File uploads restricted by MIME type and size in Supabase Storage policy
- [ ] Re-authentication required before sensitive changes (email/password)
- [ ] No `dangerouslySetInnerHTML` with user-controlled content
- [ ] DB functions using dynamic SQL have an allowlist guard
