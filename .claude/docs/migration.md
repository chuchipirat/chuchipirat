# Migration (Firebase → Supabase)

Consult this file when working on the Firebase → Supabase migration. This file consolidates the migration guide, Firebase Auth import playbook, and post-migration tasks.

**Note:** This file will be archived once the migration is complete.

---

## Migration Workflow

When migrating a domain entity, follow the 3-layer pattern described in `architecture.md`.

### Steps for a `.class.ts` File

1. **Create Repository** (`<Entity>Repository.ts`): Define `Row` interface, `Domain` interface, `toRow()`/`toDomain()`, CRUD methods
2. **Strip DB code from `.class.ts`**: Remove all Firebase/Supabase calls, keep pure business logic
3. **Update UI**: Replace `Entity.save({firebase, ...})` with `database.<entity>.save(...)` and keep `EntityService.validate(...)` calls
4. **If `.class.ts` becomes empty** (no business logic remains): Delete it, use `Domain` interface from Repository instead

## Migration Progress

| Phase     | Scope                                                                 | Status                       |
| --------- | --------------------------------------------------------------------- | ---------------------------- |
| Phase 1   | Supabase infrastructure, storage, environment setup                   | Done                         |
| Phase 2   | Auth, user profiles, image storage                                    | Done                         |
| Phase 3   | GlobalSettings, SystemMessages, Admin UI                              | Done                         |
| Phase 4   | Masterdata: Departments, Units, Materials, Products, Unit Conversions | Done                         |
| Phase 5   | Recipes                                                               | Done                         |
| Phase 6   | Events, Group Config, Menuplan                                        | Done                         |
| Phase 7   | Used Recipes                                                          | Done                         |
| Phase 8   | Shopping Lists                                                        | Done                         |
| Phase 9   | Material Lists                                                        | Done                         |
| Phase 10  | Requests                                                              | Done                         |
| Phase 11  | Feeds                                                                 | Done (in progress on branch) |
| Remaining | Cloud Functions migration, UI page cleanup, Firebase removal          | Pending                      |

## Migration Jobs

Firebase → Supabase data migration is handled by dedicated job classes in `src/components/Admin/MigrationJobs/`.

Each `MigrationJob` fetches Firebase records and writes them to Supabase via the corresponding Repository's `insert()` or `upsert()` using `database.admin.*` (service-role, bypasses RLS).

**Jobs in dependency order:**

1. `UserMigrationJob` — User profiles (Phase 2)
2. `ImageMigrationJob` — File uploads (Phase 2)
3. `DepartmentMigrationJob` — Departments (Phase 4)
4. `UnitMigrationJob` — Units (Phase 4)
5. `MaterialMigrationJob` — Materials (Phase 4)
6. `ProductMigrationJob` — Products (Phase 4, depends on departments/units)
7. `UnitConversionBasicMigrationJob` — Standard unit conversions (Phase 4)
8. `UnitConversionProductMigrationJob` — Product-specific unit conversions (Phase 4)
9. `RecipeMigrationJob` — Recipes (Phase 5)
10. `EventMigrationJob` — Events (Phase 6)
11. `GroupConfigMigrationJob` — Group Config (Phase 6)
12. `MenuplanMigrationJob` — Menuplans (Phase 6)
13. `EventPictureMigrationJob` — Event pictures (Phase 6)
14. `ShoppingListMigrationJob` — Shopping Lists (Phase 8)
15. `MaterialListMigrationJob` — Material Lists (Phase 9)
16. `RequestMigrationJob` — Requests (Phase 10)
17. `FeedMigrationJob` — Feeds (Phase 11)

---

## Firebase Auth → Supabase Auth: User Import

### Overview

Firebase-Firestore user data was migrated to `public.users` in Phase 2, but **no** Supabase Auth accounts were created. Users who haven't logged in since have `auth_uid = NULL` and no `auth.users` entry. This blocks FK references (e.g. `requests.author_uid → auth.users(id)`).

**Solution:** Export Firebase Auth users with password hashes → generate SQL → import into `auth.users` → link `public.users.auth_uid`.

> Users keep their existing passwords. GoTrue natively supports Firebase's Modified Scrypt (PR #1768).

### Execution Order

```
Firebase Auth Export  →  Import Script  →  auth-import.sql
                                                  ↓
UserMigrationJob (Admin-UI)  →  public.users exist
                                                  ↓
                            auth-import.sql (auth.users + identities + auth_uid linking)
```

### Step 1: Get Firebase Password Hash Parameters

Firebase Console → Authentication → Users → ⋯ → «Password hash parameters»

| Parameter               | `$fbscrypt$` param | Typical value      |
| ----------------------- | ------------------ | ------------------ |
| `base64_signer_key`     | `sk`               | Long Base64 string |
| `base64_salt_separator` | `ss`               | Often `Bw==`       |
| `rounds`                | `r`                | `8`                |
| `mem_cost`              | `n`                | `14`               |

### Step 2: Export Firebase Auth Users

```bash
firebase use <project-id>
firebase auth:export firebase-auth-users.json --format=json
```

### Step 3: The `$fbscrypt$` Format

```
$fbscrypt$v=1,n=<mem_cost>,r=<rounds>,p=1,ss=<salt_separator>,sk=<signer_key>$<user_salt>$<user_hash>
```

GoTrue recognizes the prefix and verifies natively. After a password change, GoTrue stores as bcrypt automatically.

### Step 4: Generate Import SQL

Script: `scripts/generate-auth-import.mjs`

- Reads Firebase export JSON
- Skips users without email, password hash, or unverified email
- Generates `INSERT INTO auth.users` with `$fbscrypt$` password strings
- Generates `INSERT INTO auth.identities` for login provider linking
- Generates `UPDATE public.users SET auth_uid` via email matching
- All wrapped in a transaction

```bash
# 1. Set HASH_CONFIG in script (from Step 1)
# 2. Place firebase-auth-users.json (from Step 2)
node scripts/generate-auth-import.mjs
# 3. Review generated SQL
less auth-import.sql
```

### Step 5: Run UserMigrationJob

**Before** the SQL import: Admin → Migration → migrate Users (creates `public.users` rows from Firebase Firestore).

### Step 6: Execute SQL Import

```bash
psql postgresql://supabase_admin:<password>@localhost:5432/postgres < auth-import.sql
```

### Step 7: Verify

```sql
-- All public.users should have auth_uid
SELECT COUNT(*) AS total, COUNT(auth_uid) AS linked, COUNT(*) - COUNT(auth_uid) AS missing
FROM public.users;

-- Should be empty
SELECT id, email FROM public.users WHERE auth_uid IS NULL;

-- Every auth_uid points to valid auth.users entry
SELECT pu.id, pu.email FROM public.users pu
LEFT JOIN auth.users au ON pu.auth_uid = au.id
WHERE pu.auth_uid IS NOT NULL AND au.id IS NULL;
```

### Step 8: Reset Sequences

After data migration, reset auto-increment sequences:

```sql
SELECT setval('public.request_number_seq', COALESCE((SELECT MAX(number) FROM public.requests), 0));
```

### Users Without Password Hash

Users without `passwordHash` (OAuth-only, never set password) are skipped. Options:

- **Option A:** Import with empty password → user must use «Passwort vergessen»
- **Option B:** Don't import (likely inactive)

### Environment-Specific Notes

|                  | Dev                      | Test              | Prod                 |
| ---------------- | ------------------------ | ----------------- | -------------------- |
| Firebase project | `chuchipirat-dev`        | `chuchipirat-tst` | `chuchipirat`        |
| SQL execution    | psql or Supabase Studio  | psql              | psql (after backup!) |
| SMTP             | MailPit (localhost:8025) | Configured        | Brevo                |

### Auth Import Checklist

| Step                                     | Dev | Test | Prod |
| ---------------------------------------- | --- | ---- | ---- |
| Firebase hash params noted               | [ ] | [ ]  | [ ]  |
| Firebase Auth export created             | [ ] | [ ]  | [ ]  |
| Import script configured and run         | [ ] | [ ]  | [ ]  |
| Generated SQL reviewed                   | [ ] | [ ]  | [ ]  |
| SQL executed in database                 | [ ] | [ ]  | [ ]  |
| Verification passed (0 missing auth_uid) | [ ] | [ ]  | [ ]  |
| Login tested with existing password      | [ ] | [ ]  | [ ]  |
| Sequences reset                          | [ ] | [ ]  | [ ]  |
| Users without hash handled (Option A/B)  | [ ] | [ ]  | [ ]  |

---

## Post-Migration Tasks

Post-migration cleanup items (enum conversions, missing DB functions, security fixes, performance refactors) are tracked in `tech-debt.md`. This file (`migration.md`) covers only the migration process itself and will be archived once complete.
