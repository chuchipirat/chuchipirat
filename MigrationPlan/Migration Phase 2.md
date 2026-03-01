## Phase 2 — Supabase Auth Integration with Hybrid Login

> [!info] Context  
> Phase 1 created the `users` table, `UserRepository`, `DatabaseService`, and the admin migration page.  
> Core user data already lives in Postgres, but Firebase Auth is still the only auth provider.
>
> Phase 2 switches authentication to Supabase Auth. Since Firebase password hashes cannot be exported, existing users need a controlled way to move their password into the new system.

### Strategy: Hybrid Login with Parallel Operation

- New users → Supabase Auth directly
- Existing users → try Supabase login → on error Firebase fallback → password migration dialog → create Supabase Auth account
- Firebase Auth stays active until all users are migrated

---

### Schema Changes

**SQL migration:** `20260226000001_add_auth_uid.sql`

```sql
-- 1. Enlarge id column (Firebase UIDs ~28 chars, Supabase UUIDs 36 chars)
ALTER TABLE public.users ALTER COLUMN id TYPE TEXT;

-- 2. auth_uid for linking to Supabase Auth
ALTER TABLE public.users ADD COLUMN auth_uid UUID UNIQUE;
CREATE INDEX idx_users_auth_uid ON public.users(auth_uid);

-- 3. Helper function: checks whether the current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid() AND 'admin' = ANY(roles)
  );
$$;

-- 4. Helper function: checks whether the current user is communityLeader or admin
CREATE OR REPLACE FUNCTION is_community_leader()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_uid = auth.uid()
      AND ('admin' = ANY(roles) OR 'communityLeader' = ANY(roles))
  );
$$;

-- 5. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Policies
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (auth_uid = auth.uid());

CREATE POLICY users_select_leader ON public.users
  FOR SELECT USING (is_community_leader());

CREATE POLICY users_insert_self ON public.users
  FOR INSERT WITH CHECK (auth_uid = auth.uid());

CREATE POLICY users_insert_admin ON public.users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (auth_uid = auth.uid())
  WITH CHECK (
    auth_uid = auth.uid()
    AND roles = (SELECT roles FROM public.users WHERE auth_uid = auth.uid())
  );

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE USING (is_admin());

-- 7. Update view (use auth_uid instead of id for RLS compatibility)
CREATE OR REPLACE VIEW public.user_profiles AS
  SELECT id, auth_uid, display_name, member_since, member_id, motto,
    picture_src_small, picture_src_normal, picture_src_full
  FROM public.users;

-- 8. Service-role bypass (for migrations and admin operations)
-- In Supabase, service_role automatically bypasses RLS
```

**Files:**

- `supabase/migrations/20260226000001_add_auth_uid.sql` (new)
- `supabase/migrations/20260225000001_create_users.sql` — remove prepared RLS comments (cleanup)

---

### New Files

#### 1. `src/components/Database/AuthService.ts`

Wraps all Supabase Auth methods:

```ts
class AuthService {
  // Sign-in with email/password (Supabase Auth)
  signInWithPassword(email, password) → Session

  // Register a new account
  signUp(email, password) → Session

  // Sign out (Supabase + optional Firebase)
  signOut()

  // Reset password (sends email via Supabase)
  resetPassword(email)

  // Set a new password (via reset token or while logged in)
  updatePassword(password)

  // Auth state listener (similar to Firebase onAuthStateChanged)
  onAuthStateChange(callback) → Unsubscribe

  // Get current user
  getUser() → User | null

  // Get session
  getSession() → Session | null
}
```

Uses the existing Supabase client from `supabaseClient.ts`.

#### 2.`src/components/SignIn/passwordMigrationDialog.tsx`

Dialog for existing users logging in via Supabase Auth for the first time:

- Shown after successful Firebase login if no Supabase Auth account exists
- Fields: New password + confirmation + `PasswordStrengthMeter` (existing component)
- Flow:
  - a. Call `authService.signUp(email, password)`
  - b. Read the Supabase Auth UUID from the session
  - c. Update `auth_uid` in the `users` table via `database.users.patch()`
  - d. Firebase sign-out
  - e. Redirect into the app

#### 3.`src/components/Database/Repository/UserRepository.ts` — New method

```ts
// Links an existing user to a Supabase Auth account
async linkAuthUid(userId: string, authUid: string): Promise<void>
```

---

### Changed Files

#### 4.`src/components/Database/DatabaseService.ts`

- New property: `auth: AuthService`

#### 5.`src/components/Database/DatabaseContext.tsx

- `useDatabase()` still returns `DatabaseService` (now includes `auth`)

#### 6.`src/components/Database/Repository/UserRepository.ts`

- `UserRow`: add `auth_uid?: string`
- `toRow()`: map `auth_uid`
- `toDomain()`: map `auth_uid` (optional)
- `UserDomain`: add `authUid?: string`
- New method `linkAuthUid(userId, authUid)`
- New method `findByAuthUid(authUid)` — used by auth state listener

#### 7. `src/components/SignIn/signIn.tsx`

Hybrid login flow:

1. `authService.signInWithPassword(email, password)`
2. → success: `User.registerSignIn()` → `navigate(HOME)`
3. → error: `firebase.signInWithEmailAndPassword(email, password)`
4. → success: open `passwordMigrationDialog`
5. → error: show error message

#### 8. `src/components/SignUp/signUp.tsx`

Switch fully to Supabase Auth:

1. `authService.signUp(email, password)` → session with UUID
2. `User.createUser({ database, uid: session.user.id, ... })`
3. `auth_uid = session.user.id`, `id = session.user.id`
4. `navigate(HOME)`

Remove Firebase `createUserWithEmailAndPassword` and `sendEmailVerification`.

#### 9. `src/components/Session/authUserContext.tsx`

Switch `AuthUserProvider`:

- Primary: `authService.onAuthStateChange()` instead of `firebase.onAuthStateChanged()`
- With Supabase session: load user profile via `database.users.findByAuthUid(session.user.id)`
- If no Supabase user found: legacy check via `findByEmail()`
- `emailVerified`: derive from Supabase `user.email_confirmed_at`

Adjust `AuthorizationGuard` accordingly.

#### 10. `src/components/AuthServiceHandler/authServiceHandler.tsx`

- resetPassword mode: Supabase token-based password update instead of Firebase `oobCode`
- Supabase sends links with `type=recovery&token_hash=...`
- verifyEmail mode: Supabase email confirmation (if enabled)

#### 11. `src/components/PasswordChange/passwordChange.tsx`

- Logged-in user: `authService.updatePassword(newPassword)`
- Via reset link: `authService.updatePassword(newPassword)` after token verification by Supabase

#### 12. `src/components/AuthServiceHandler/passwordReset.tsx`

- Use `authService.resetPassword(email)` instead of `firebase.passwordReset(email)`

#### 13) `src/constants/text.ts`

New text constants:

- `PASSWORD_MIGRATION_TITLE` — "Passwort aktualisieren"
- `PASSWORD_MIGRATION_DESCRIPTION` — "Wir haben unser Anmeldesystem aktualisiert..."
- `PASSWORD_MIGRATION_NEW_PASSWORD` — "Neues Passwort setzen"
- `PASSWORD_MIGRATION_CONFIRM` — "Passwort bestätigen"
- `PASSWORD_MIGRATION_SUCCESS` — "Dein Account wurde erfolgreich migriert."
- `PASSWORDS_DONT_MATCH` — "Passwörter stimmen nicht überein"

#### 14. `src/components/Admin/MigrationJobs/UserMigrationJob.ts`

- Adjust migration mapping: `auth_uid` is `null` for migrated users (set on first Supabase login)

#### 15. `src/components/Firebase/firebase.class.ts`

- Mark auth methods with `@deprecated`
- Keep `onAuthUserListener` for now (used in parallel by `AuthorizationGuard`)
- Can be removed in Phase 3 once Firebase Auth is turned off

---

### Implementation Order

|   # | What                                                        | Dependencies        |
| --: | ----------------------------------------------------------- | ------------------- |
|   1 | SQL migration (auth_uid, RLS)                               | —                   |
|   2 | Extend UserRepository (authUid, linkAuthUid, findByAuthUid) | #1                  |
|   3 | Create AuthService                                          | `supabaseClient.ts` |
|   4 | Extend DatabaseService (.auth)                              | #3                  |
|   5 | `text.ts` — new constants                                   | —                   |
|   6 | Create `passwordMigrationDialog.tsx`                        | #2, #3, #5          |
|   7 | Update `signUp.tsx` (Supabase Auth)                         | #3, #4              |
|   8 | Update `signIn.tsx` (Hybrid login)                          | #3, #6              |
|   9 | Update `authUserContext.tsx` (Supabase primary)             | #3, #2              |
|  10 | Update `passwordReset.tsx`                                  | #3                  |
|  11 | Update `passwordChange.tsx`                                 | #3                  |
|  12 | Adjust `authServiceHandler.tsx`                             | #3                  |
|  13 | `firebase.class.ts` — deprecated markers                    | —                   |

---

### Verification

1. New user sign-up: `/signup` → account created in Supabase Auth → `auth_uid` set in `users` table → login works
2. Existing user sign-in (first login):
   - Enter email/password → Supabase fails → Firebase fallback → password migration dialog → set new password
   - Supabase Auth account created → `auth_uid` set → redirect to Home
3. Existing user sign-in (after migration): Supabase Auth login works directly
4. Password reset: via Supabase email → set new password → login works
5. RLS: user can only read/change own data → admin can see all
6. Supabase Studio (`http://127.0.0.1:54323`): `auth.users` has entries, `public.users.auth_uid` is linked
7. Firebase Auth: stays active in parallel, used only for fallback login

---

### Not in Scope (Phase 3+)

- Remove Firebase Auth completely (after transition)
- Firebase Storage → Supabase Storage
- Migrate events/recipes/products to Postgres
- Configure email templates in Supabase
