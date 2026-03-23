## Phase 11: Feed System — Supabase Migration

### Context

The Feed system shows activity on the `/home` screen (new users, published recipes, ratings, events, etc.). It's currently 100% Firebase — `feeds` collection + `feeds/000_log` audit document. This phase migrates everything to Supabase, redesigns the schema to avoid unnecessary denormalization, wires up all feed creation points, implements housekeeping, and writes proper unit tests.

**Design Decisions:**

1. **Drop the `000_log` document.** Firebase workaround. In Postgres we query the `feeds` table directly.
2. **No denormalization for user or source object.** Store only `user_uid` and `source_object_uid` + `source_object_type`. A VIEW resolves names/pictures via JOINs. This avoids stale data and simplifies the table.
3. **Feed creation:** app-side via `FeedRepository.insertFeed()`. Consistent with the 3-layer pattern.
4. **Housekeeping:** admin UI with direct DELETE query. No Cloud Function needed.
5. **Drop `FeedType.recipeCreated`** — never used, `recipePublished` covers the use case.
6. **Drop `FeedType.menuplanCreated`** — merged into `eventCreated`.
7. **Drop `FeedType.none`** — constructor-only default, never persisted.
8. **Add `FeedType.recipeCommented`** — when a user comments on a public recipe.
9. **Add `FeedType.profilePictureChanged`** — when a user uploads a profile picture.
10. **User signup feed** — insert in VerifyEmail component during the 10-second countdown (only `type=signup`, not `type=email_change`).
11. **Navigation** — `recipePublished`, `recipeRated`, `recipeCommented` → recipe page. All others → user profile.
12. **Remove TODO markers** — clean up all `// TODO.*[Ff]eed` comments after implementation.

---

### Final FeedType Enum (10 types)

| FeedType                | Visibility      | Triggered When                    | source_object_type | Navigation     |
| ----------------------- | --------------- | --------------------------------- | ------------------ | -------------- |
| `userCreated`           | basic           | Email verification (VerifyEmail)  | `user`             | → user profile |
| `recipePublished`       | basic           | Request approved (RequestService) | `recipe`           | → recipe page  |
| `recipeRated`           | basic           | User rates a recipe               | `recipe`           | → recipe page  |
| `recipeCommented`       | basic           | User comments on a public recipe  | `recipe`           | → recipe page  |
| `eventCreated`          | basic           | Event is created                  | `event`            | → user profile |
| `eventCookAdded`        | basic           | Cook joins an event               | `event`            | → user profile |
| `shoppingListCreated`   | basic           | Shopping list generated           | `event`            | → user profile |
| `productCreated`        | communityLeader | Product created                   | `product`          | → user profile |
| `materialCreated`       | communityLeader | Material created                  | `material`         | → user profile |
| `profilePictureChanged` | basic           | User uploads profile picture      | `user`             | → user profile |

---

### Schema Design (no denormalization)

#### Table: `feeds`

Only stores references, not copies of names/pictures:

```sql
CREATE TABLE public.feeds (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  firebase_uid        TEXT,
  feed_type           public.feed_type NOT NULL,
  visibility          public.feed_visibility NOT NULL DEFAULT 'basic',
  title               TEXT NOT NULL,           -- pre-computed from getFeedTitle()
  text                TEXT NOT NULL,           -- pre-computed from getFeedText()
  user_uid            TEXT NOT NULL,           -- person displayed in feed → JOIN users
  source_object_type  TEXT NOT NULL,           -- 'recipe','event','product','material','user'
  source_object_uid   TEXT NOT NULL,           -- UID in the source table
  source_object_data  JSONB,                   -- optional extra data (e.g. rating value)
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
```

Removed vs. old Firebase design: `source_object_name`, `source_object_picture_src`, `user_display_name`, `user_picture_src` — all resolved by VIEW.

#### VIEW: `feeds_view`

Resolves user and source object data via conditional JOINs:

```sql
CREATE VIEW public.feeds_view WITH (security_invoker = true) AS
SELECT
  f.*,
  -- User displayed in feed
  u.display_name       AS user_display_name,
  u.picture_src_normal AS user_picture_src,
  -- Source object (conditional based on type)
  COALESCE(r.name, e.name, p.name, m.name, u2.display_name, '') AS source_object_name,
  COALESCE(r.picture_src, e.picture_src, u2.picture_src_normal, '') AS source_object_picture_src
FROM public.feeds f
LEFT JOIN public.users u    ON u.id = f.user_uid
LEFT JOIN public.recipes r  ON r.id = f.source_object_uid AND f.source_object_type = 'recipe'
LEFT JOIN public.events e   ON e.id = f.source_object_uid AND f.source_object_type = 'event'
LEFT JOIN public.products p ON p.id = f.source_object_uid AND f.source_object_type = 'product'
LEFT JOIN public.materials m ON m.id = f.source_object_uid AND f.source_object_type = 'material'
LEFT JOIN public.users u2   ON u2.id = f.source_object_uid AND f.source_object_type = 'user';
```

Benefits: always fresh data (user renames, recipe name changes reflect immediately), simpler table, no stale copies. Only 10 feeds loaded at a time — JOIN performance is negligible.

---

### Implementation Steps

#### Step 1 — SQL Migration

> [!info] File
> `supabase/migrations/20260318000001_create_feeds.sql`

- ENUMs: `feed_type` (10 values), `feed_visibility` (`basic`, `communityLeader`, `admin`)
- Table: `feeds` (as shown above — no denormalized name/picture columns)
- VIEW: `feeds_view` with conditional JOINs
- Triggers: `update_updated_at()`, `update_updated_by()`
- Indexes: `feed_type`, `visibility`, `created_at DESC`, `firebase_uid`
- RLS: SELECT (visibility-based), INSERT (all authenticated), DELETE (community leaders only), no UPDATE
- GRANT SELECT, INSERT, DELETE

#### Step 2 — `FeedRepository`

> [!info] File
> `src/components/Database/Repository/FeedRepository.ts`

Pattern follows `RequestRepository`.

**Interfaces:**

- `FeedRow` — snake_case, includes VIEW columns (`user_display_name`, `user_picture_src`, `source_object_name`, `source_object_picture_src`)
- `FeedDomain` — camelCase app model: `uid`, `feedType`, `visibility`, `title`, `text`, `createdAt`, `user: { uid, displayName, pictureSrc }`, `sourceObject: { type, uid, name, pictureSrc, data? }`
- `CreateFeedParams` — `feedType`, `visibility?`, `userUid?`, `userDisplayName?`, `userPictureSrc?`, `sourceObjectType`, `sourceObjectUid`, `sourceObjectData?`, `textElements?`

**Methods:**

| Method                                          | Description                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `getNewestFeeds(limit, visibility?, feedType?)` | Reads from `feeds_view`, ordered by `created_at DESC`                                                               |
| `getFeedById(uid)`                              | Single feed from `feeds_view`                                                                                       |
| `getAllFeeds()`                                 | Admin overview from `feeds_view`                                                                                    |
| `insertFeed(params, authUser)`                  | Pre-computes title/text via `getFeedTitle()`/`getFeedText()`, writes to `feeds` table, reads back from `feeds_view` |
| `deleteFeed(uid)`                               | Via `this.remove(id)`                                                                                               |
| `deleteFeedsByAge(daysOffset)`                  | Direct DELETE, returns count                                                                                        |

#### Step 3 — Register in `DatabaseService`

Add `feeds: FeedRepository` (regular + admin client).

#### Step 4 — Refactor `feed.class.ts`

> [!info] File
> `src/components/Shared/feed.class.ts`

**Keep:**

- `FeedType` enum — 10 values (add `recipeCommented`, `profilePictureChanged`; remove `recipeCreated`, `menuplanCreated`, `none`)
- Export standalone `getFeedTitle(feedType, textElements)` function
- Export standalone `getFeedText(feedType, textElements)` function

**Delete:** `Feed` class, all static methods, all Firebase interfaces, `FeedLogEntry`

**Update `text.ts`:**

- Add `FEED_TITLE.RECIPE_COMMENTED`, `FEED_TEXT.RECIPE_COMMENTED`
- Add `FEED_TITLE.PROFILE_PICTURE_CHANGED`, `FEED_TEXT.PROFILE_PICTURE_CHANGED`
- Remove `FEED_TITLE.MENUPLAN_CREATED`, `FEED_TEXT.MENUPLAN_CREATED`

#### Step 5 — Update Home Page

> [!info] File
> `src/components/Home/home.tsx`

- Replace `Feed.getNewestFeeds()` → `database.feeds.getNewestFeeds()`
- State types: `Feed[]` → `FeedDomain[]`
- Fix typo: `onFeedEntryCllick` → `onFeedEntryClick`
- Navigation: add `recipeRated` and `recipeCommented` → recipe page (alongside `recipePublished`)

#### Step 6 — Update Admin Feed Overview

> [!info] File
> `src/components/Admin/overviewFeeds.tsx`

- Replace all Firebase calls with repository methods
- `deleteFeedsByAge()` returns count directly — no Cloud Function callback

#### Step 7 — Wire Up All Feed Callers

| Caller            | File                                           | FeedType                | source_object_type |
| ----------------- | ---------------------------------------------- | ----------------------- | ------------------ |
| User signup       | `verifyEmail.tsx`                              | `userCreated`           | `user`             |
| Recipe publish    | `requestService.ts`                            | `recipePublished`       | `recipe`           |
| Recipe rating     | `recipe.rating.class.ts`                       | `recipeRated`           | `recipe`           |
| Recipe comment    | `RecipeCommentRepository.ts` or view component | `recipeCommented`       | `recipe`           |
| Profile picture   | `user.class.ts` or `userProfile.tsx`           | `profilePictureChanged` | `user`             |
| Product creation  | `product.class.ts`                             | `productCreated`        | `product`          |
| Material creation | `material.class.ts`                            | `materialCreated`       | `material`         |
| Event creation    | Event code (TBD exact file)                    | `eventCreated`          | `event`            |
| Cook added        | Event code (TBD)                               | `eventCookAdded`        | `event`            |
| Shopping list     | Shopping list code (TBD)                       | `shoppingListCreated`   | `event`            |

#### Step 8 — Remove TODO Markers

Known locations:

- `src/components/Request/requestService.ts:87` — `// TODO: Feed-Eintrag erstellen`
- `MigrationPlan/Migration Phase 10.md:11` and `:223` — TODO references to feed

#### Step 9 — Migration Job

> [!info] File
> `src/components/Admin/MigrationJobs/FeedMigrationJob.ts`

- Read all Firebase feeds documents (exclude `000_log`)
- Map: `menuplanCreated` → `eventCreated`, skip `recipeCreated`/`none`
- Flatten: `sourceObject.uid` → `source_object_uid`, determine `source_object_type` from context
- Resolve `created.fromUid` → `auth.users.id` for `created_by`
- Denormalized fields (`sourceObject.name`, `user.displayName`) are NOT migrated — the VIEW resolves them

#### Step 10 — Unit Tests

> [!info] File
> `src/components/Shared/__test__/feed.class.test.ts`

- `getFeedTitle()` — all 10 FeedType values
- `getFeedText()` — all 10 FeedType values including rating edge cases (0–5 stars)
- Edge cases: empty `textElements`, unknown `feedType` → `"?"`
- `FeedRepository.toDomain()` / `toRow()` mapping

#### Step 11 — Firebase Cleanup

- Delete `firebase.db.feed.class.ts`, `firebase.db.feed.log.class.ts`
- Remove `feed` property from `firebase.class.ts`
- Remove Cloud Function `deleteFeeds` references

---

### Files Summary

#### SQL Migration

| File                                                  | Action                                         |
| ----------------------------------------------------- | ---------------------------------------------- |
| `supabase/migrations/20260318000001_create_feeds.sql` | **Create** — schema, ENUMs, VIEW, RLS, indexes |

#### Repository

| File                                                   | Action                                 |
| ------------------------------------------------------ | -------------------------------------- |
| `src/components/Database/Repository/FeedRepository.ts` | **Create**                             |
| `src/components/Database/DatabaseService.ts`           | **Modify** — register `FeedRepository` |

#### Domain

| File                                  | Action                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/Shared/feed.class.ts` | **Refactor** — strip DB methods, keep `FeedType` + title/text functions |
| `src/constants/text.ts`               | **Modify** — add new feed text constants, remove `MENUPLAN_CREATED`     |

#### UI Components

| File                                     | Action                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| `src/components/Home/home.tsx`           | **Modify** — replace Firebase reads, add recipe navigation |
| `src/components/Admin/overviewFeeds.tsx` | **Modify** — replace Firebase log/delete with repository   |

#### Feed Callers

| File                                                      | Action                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/components/AuthServiceHandler/verifyEmail.tsx`       | **Modify** — insert `userCreated` feed entry                                |
| `src/components/Request/requestService.ts`                | **Modify** — insert `recipePublished` feed, remove TODO                     |
| `src/components/Recipe/recipe.rating.class.ts`            | **Modify** — use `database.feeds`                                           |
| `src/components/Recipe/recipe.view.tsx` (or comment file) | **Modify** — insert `recipeCommented` feed entry                            |
| `src/components/User/user.class.ts` or `userProfile.tsx`  | **Modify** — insert `profilePictureChanged` feed entry                      |
| `src/components/Product/product.class.ts`                 | **Modify** — use `database.feeds`                                           |
| `src/components/Material/material.class.ts`               | **Modify** — use `database.feeds`                                           |
| Event/ShoppingList files (TBD)                            | **Modify** — insert `eventCreated`, `eventCookAdded`, `shoppingListCreated` |

#### Migration Job

| File                                                         | Action                                   |
| ------------------------------------------------------------ | ---------------------------------------- |
| `src/components/Admin/MigrationJobs/FeedMigrationJob.ts`     | **Create**                               |
| `src/components/Admin/MigrationJobs/migrationJobRegistry.ts` | **Modify** — register `FeedMigrationJob` |

#### Tests

| File                                                | Action                                               |
| --------------------------------------------------- | ---------------------------------------------------- |
| `src/components/Shared/__test__/feed.class.test.ts` | **Rewrite** — tests for `getFeedTitle`/`getFeedText` |

#### Documentation

| File                                  | Action                                      |
| ------------------------------------- | ------------------------------------------- |
| `MigrationPlan/Migration Phase 10.md` | **Modify** — remove TODO references to feed |

---

### Verification

1. `npx tsc --noEmit` — no new type errors
2. `npm start` — dev server runs
3. Home page: feed list + recipe cards load from Supabase (VIEW resolves names/pictures)
4. Click recipe/rated/commented feed → recipe page
5. Click user/event/other feed → user profile
6. Admin: feed list loads, single delete works, bulk delete by age returns count
7. Rate a recipe → `recipeRated` feed appears
8. Comment on a recipe → `recipeCommented` feed appears
9. Upload profile picture → `profilePictureChanged` feed appears
10. Publish a recipe → `recipePublished` feed appears
11. Create product/material → feed appears (community leaders only)
12. Create event, add cook, generate shopping list → respective feeds appear
13. Sign up new user → `userCreated` feed after verification
14. Change email → NO feed entry
15. Run migration job → Firebase data in Supabase, `menuplanCreated` mapped to `eventCreated`
16. `npm test` — feed tests pass
17. No remaining `// TODO.*[Ff]eed` markers in codebase
