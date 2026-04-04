## Phase 0 — Firebase Codebase Inventory

### Firestore Data Model

**Collection Hierarchy**

```
  Root Collections:
  ├── events/
  │   ├── 000_allEvents                     (aggregate cache document)
  │   └── {eventId}/
  │       ├── docs/                         (subcollection)
  │       │   ├── groupConfiguration
  │       │   ├── menuplan
  │       │   ├── usedRecipes
  │       │   ├── shoppingListCollection
  │       │   ├── materialList
  │       │   └── receipt
  │       └── shoppingLists/                (subcollection)
  │           └── {listId}
  │
  ├── users/
  │   ├── 000_allUsers                      (aggregate cache document)
  │   └── {userId}/
  │       └── public/                       (subcollection)
  │           ├── profile
  │           └── searchFields
  │
  ├── recipes/
  │   ├── public/                           (container document)
  │   │   └── recipes/                      (subcollection)
  │   │       └── {recipeId}/
  │   │           ├── ratings/{userId}
  │   │           └── comments/{commentId}
  │   ├── private/                          (container document)
  │   │   └── users/{userId}/recipes/       (nested subcollection)
  │   │       └── {recipeId}/
  │   │           ├── ratings/{userId}
  │   │           └── comments/{commentId}
  │   └── variants/                         (container document)
  │       └── events/{eventId}/recipes/     (nested subcollection)
  │           └── {variantId}
  │
  ├── masterData/                           (single-document maps)
  │   ├── departments       {uid → {name, pos, usable}}
  │   ├── products          {uid → {name, departmentUid, shoppingUnit, dietProperties, usable}}
  │   ├── units             {key → {name, dimension}}
  │   ├── materials         {uid → {name, type, usable}}
  │   ├── unitConversionBasic    {uid → {fromUnit, toUnit, numerator,
   denominator}}
  │   └── unitConversionProducts {uid → {fromUnit, toUnit, numerator,
   denominator, productUid, productName}}
  │
  ├── feeds/
  │   ├── 000_log                                (aggregate index)
  │   └── {feedId}
  │
  ├── requests/
  │   ├── active/requests/{requestId}
  │   ├── closed/requests/{requestId}
  │   └── numberStorage
  │
  ├── stats/
  │   ├── counter
  │   ├── recipeVariants
  │   └── recipesInMenuplan
  │
  ├── _configuration/                            (system collection)
  │   ├── globalSettings
  │   ├── version
  │   └── systemMessage
  │
  ├── _mailbox/                                  (email queue)
  │   ├── 000_log
  │   └── {mailId}
  │
  └── _cloudFunctions/                           (trigger documents)
      └── functions/{functionName}/{documentId}
```

#### Key Patterns

**Pattern:** Aggregate Cache
**Description:** Special 000\_\* documents store denormalized summaries
**Example:** `000_allEvents`, `000_allUsers`, `000_log`
────────────────────────────────────────
**Pattern:** Embedding (single-doc maps)
**Description:** Master data stored as key-value maps in one document
**Example:** `masterData/products = {uid: {name, ...}}`
────────────────────────────────────────
**Pattern:** Subcollection
**Description:** Hierarchical data
**Example:** `events/{id}/docs/menuplan`
────────────────────────────────────────
**Pattern:** Indexed Arrays
**Description:** `usedProducts[]`, `usedMaterials[]`, `usedRecipes[]` arrays for Firestore `array-contains` queries
**Example**: `Menuplan`, `ShoppingListCollection`
────────────────────────────────────────
**Pattern:** Type Segregation
**Description:** Recipes split into `public/`, `private/`, `variants/` branches with different access rules
**Example:** `recipes/public/recipes/{id}`
────────────────────────────────────────
**Pattern:** Cloud Function Trigger
**Description:** Client writes document → triggers server function
**Example:** `_cloudFunctions/functions/sendMail/{id}`
────────────────────────────────────────

### Domain Model Classes (27 total)

**Class:** Recipe
**File:** src/components/Recipe/recipe.class.ts
**Key Properties:** uid, name, portions, ingredients, preparationSteps, materials, dietProperties, menuTypes, rating, type (public/private/variant)
────────────────────────────────────────
**Class:** RecipeShort
**File**: recipe/recipeShort.class.ts
**Key Properties:** Denormalized: uid, name, pictureSrc, tags, dietProperties, rating
────────────────────────────────────────
**Class:** RecipeRating
**File:** recipe/recipe.rating.class.ts
**Key Properties:** rating (number)
────────────────────────────────────────
**Class:** RecipeComment
**File:** recipe/recipe.comment.class.ts
**Key Properties:** uid, user, createdAt, comment
────────────────────────────────────────
**Class:** Event
**File:** Event/Event/event.class.ts
**Key Properties:** uid, name, motto, location, cooks[], dates[], authUsers[], pictureSrc
────────────────────────────────────────
**Class:** EventShort
**File:** Event/Event/eventShort.class.ts
**Key Properties:** Denormalized: uid, name, motto, startDate, endDate
────────────────────────────────────────
**Class:** Menuplan
**File:** Event/Menuplan/menuplan.class.ts
**Key Properties:** mealTypes, menues, meals, notes, mealRecipes, materials, products
────────────────────────────────────────
**Class:** EventGroupConfiguration
**File:** Event/GroupConfiguration/groupConfiguration.class.ts
**Key Properties:** diets, intolerances, portions, totalPortions
────────────────────────────────────────
**Class:** ShoppingListCollection
**File:** Event/ShoppingList/shoppingListCollection.class.ts
**Key Properties:** noOfLists, lists{}, lastChange
────────────────────────────────────────
**Class:** ShoppingList
**File:** Event/ShoppingList/shoppingList.class.ts
**Key Properties:** uid, list (ShoppingListDepartment[])
────────────────────────────────────────
**Class:** MaterialList
**File:** Event/MaterialList/materialList.class.ts
**Key Properties:** uid, noOfLists, lists{}
────────────────────────────────────────
**Class:** UsedRecipes
**File:** Event/UsedRecipes/usedRecipes.class.ts
**Key Properties:** uid, noOfLists, lists{}
────────────────────────────────────────
**Class:** Receipt
**File:** Event/Event/receipt.class.ts
**Key Properties:** eventUid, payDate, amount, donorName
────────────────────────────────────────
**Class:** Product
**File:** Product/product.class.ts
**Key Properties:** uid, name, department, shoppingUnit, dietProperties, usable
────────────────────────────────────────
**Class:** Material
**File:** Material/material.class.ts
**Key Properties:** uid, name, type (consumable/usage), usable
────────────────────────────────────────
**Class:** Unit
**File:** Unit/unit.class.ts
**Key Properties:** key, name, dimension (volume/mass/dimensionless)
────────────────────────────────────────
**Class:** UnitConversion
**File:** Unit/unitConversion.class.ts
**Key Properties:** fromUnit, toUnit, numerator, denominator
────────────────────────────────────────
**Class:** Department
**File:** Department/department.class.ts
**Key Properties:** uid, name, pos, usable
────────────────────────────────────────
**Class:** User
**File:** User/user.class.ts
**Key Properties:** uid, firstName, lastName, email, lastLogin, noLogins, roles[]
────────────────────────────────────────
**Class:** UserPublicProfile
**File:** User/user.public.profile.class.ts
**Key Properties:** displayName, memberSince, memberId, motto, pictureSrc, stats
────────────────────────────────────────
**Class:** AuthUser
**File:** Firebase/Authentication/authUser.class.ts
**Key Properties:** uid, email, emailVerified, firstName, lastName, roles[], publicProfile
────────────────────────────────────────
**Class:** Request (abstract)
**File:** Request/request.class.ts
**Key Properties:** uid, number, status, author, assignee, comments[], changeLog[]
────────────────────────────────────────
**Class:** RequestPublishRecipe
**File:** Request/request.publishRecipe.class.ts
**Key Properties:** extends Request — recipe publish workflow
────────────────────────────────────────
**Class:** RequestReportError
**File:** Request/request.reportError.class.ts
**Key Properties:** extends Request — error reporting workflow
────────────────────────────────────────
**Class:** Feed
**File:** Shared/feed.class.ts
**Key Properties:** uid, title, text, type (FeedType), visibility (Role), sourceObject, user
────────────────────────────────────────
**Class:** GlobalSettings
**File:** Admin/globalSettings.class.ts
**Key Properties:** allowSignUp, maintenanceMode, allowUserCreatePassword
────────────────────────────────────────

### Cloud Functions Inventory (23 total)

#### Firestore Document Created Triggers (20)

All triggered via
`onDocumentCreated("_cloudFunctions/functions/{name}/{documentId}")`.

#: 1
**Function:** userCreatePublicData
**Input:** `{email}`
**What It Does:** Creates public profile, search fields, updates user overview, creates feed, increments stats
**Collections Touched:** users, users/public, feeds, stats, \_cloudFunctions
────────────────────────────────────────
#: 2
**Function:** deleteFeed
**Input:** `{daysOffset}`
**What It Does:** Deletes old feed entries (min 30 days)
**Collections Touched:** feeds, \_cloudFunctions
────────────────────────────────────────
#: 3
**Function:** updateUserDisplayName
**Input:** `{uid, newDisplayName}`
**What It Does:** Propagates name change to recipes, events, feeds
**Collections Touched:** recipes (collectionGroup), events, feeds
────────────────────────────────────────
#: 4
**Function:** updateUserPictureSrc
**Input:** `{uid, newPicture}`
**What It Does:** Updates picture refs in events and feeds
**Collections Touched:** events, feeds
────────────────────────────────────────
#: 5
**Function:** updateUserMotto
**Input:** `{uid, newValue}`
**What It Does:** Updates motto in events
**Collections Touched:** events
────────────────────────────────────────
#: 6
**Function:** traceObject
**Input:** `{objectType, objectUid}`
**What It Does:** Traces where product/material/recipe is used
**Collections Touched:** recipes, docs (collectionGroup)
────────────────────────────────────────
#: 7
**Function:** updateProduct
**Input:** `{changedProducts[]}`
**What It Does:** Updates product name/dietProperties across all recipes, menus, shopping lists
**Collections Touched:** recipes, docs, shoppingLists, masterData
────────────────────────────────────────
#: 8
**Function:** updateMaterial
**Input:** `{changedMaterials[]}`
**What It Does:** Updates material name/type across recipes, menus, material lists
**Collections Touched:** recipes, docs, masterData
────────────────────────────────────────
#: 9
**Function:** updateRecipe
**Input:** `{uid, type, newName}`
**What It Does:** Updates recipe name in feeds, menus
**Collections Touched:** feeds, docs
────────────────────────────────────────
#: 10
**Function:** deleteRecipe
**Input:** `{uid, name}`
**What It Does:** Marks recipe as deleted in menus, updates variants
**Collections Touched:** docs, recipes (variants)
────────────────────────────────────────
#: 11
**Function:** publishRecipeRequest
**Input:** `{recipeAuthorUid, recipeName, recipeUid, recipeShort}`
**What It Does:** Moves recipe from private→public, updates indices, stats, menus
**Collections Touched:** recipes (private/public), stats, users, docs
────────────────────────────────────────
#: 12
**Function:** declineRecipeRequest
**Input:** `{recipeAuthorUid, recipeUid}`
**What It Does:** Sets isInReview=false on private recipe
**Collections Touched:** recipes (private)
────────────────────────────────────────
#: 13
**Function:** sendMail
**Input:** `{mailTemplate, recipientType, recipients, templateData}`
**What It Does:** Sends emails via Firebase email extension
**Collections Touched:** users, \_mailbox
────────────────────────────────────────
#: 14
**Function:** mergeProducts
**Input:** `{productToReplace, productToReplaceWith}`
**What It Does:** Merges two products across all recipes, menus, shopping lists
**Collections Touched:** recipes, docs, shoppingLists, masterData, stats
────────────────────────────────────────
#: 15
**Function:** mergeMaterials
**Input:** `{materialToReplace, materialToReplaceWith}`
**What It Does:** Merges two materials across all recipes, menus
**Collections Touched:** recipes, docs, masterData, stats
────────────────────────────────────────
#: 16
**Function:** convertProductToMaterial
**Input:** `{product, materialType}`
**What It Does:** Converts ingredient→material across all references
**Collections Touched:** recipes, docs, masterData, stats
────────────────────────────────────────
#: 17
**Function:** convertMaterialToProduct
**Input:** `{material, department, dietProperties, shoppingUnit}`
**What It Does:** Converts material→ingredient across all references
**Collections Touched:** recipes, docs, masterData, stats
────────────────────────────────────────
#: 18
**Function:** activateSupportUser
**Input:** `{eventUid, supportUserUid}`
**What It Does:** Adds support user to event's authUsers and cooks
**Collections Touched:** users, events
────────────────────────────────────────
#: 19
**Function:** signOutAllUsers
**Input:** (trigger only)
**What It Does:** Revokes refresh tokens for all non-admin users
**Collections Touched:** users, Firebase Auth
────────────────────────────────────────
#: 20
**Function:** rebuildStats
**Input:** (trigger only)
**What It Does:** Rebuilds all statistics counters from scratch (full DB scan)
**Collections Touched:** events, masterData, docs, recipes, users, stats
──────────────────────────────────────

#### Scheduled Triggers (2)

#: 21
**Function:** dailySummary
**Schedule:** Every day 03:00 UTC
**What It Does:** Generates daily newsletter for community leaders: new users/events/recipes/products, open requests.
Also removes support user from expired events and sends welcome emails.
────────────────────────────────────────
#: 22
**Function:** recipesInMenuplanCounter
**Schedule:** Every day 02:00 UTC
**What It Does:** For events that ended yesterday: counts recipes used in menus, updates stats, sends review request emails to cooks.
────────────────────────────────────────

#### HTTP Endpoint (1)

#: 23
**Function:** newPizzaInTheOven
**Type**: HTTP POST
**What It Does:** Updates Vestaboard display with custom messages

#### Configuration

- Region: europe-west6 (Switzerland)
- Runtime: Node 22
- Dependencies: firebase-admin ^12.7.0, firebase-functions ^6.1.0, node-fetch, moment-timezone
- External services: Vestaboard API, Firebase email extension

---

### Firebase Storage Inventory

#### Buckets (3 environments)

| Environment | Bucket                      |
| ----------- | --------------------------- |
| DEV         | chuchipirat-dev.appspot.com |
| TEST        | chuchipirat-tst.appspot.com |
| PROD        | chuchipirat.appspot.com     |

#### Folder Structure

**Folder:** users/
**Content:** User profile pictures
**Naming:** `{userId}.{ext}`
**Resized Variants:** 50x50, 200x200, 300x300, 500x500, 600x600,
1000x1000
────────────────────────────────────────
**Folder:** events/
**Content:** Event cover images
**Naming:** {eventId}.{ext}
**Resized Variants:** Same 6 variants
────────────────────────────────────────
**Folder:** defaults/
**Content:** Static UI assets
**Naming:** Fixed names
**Resized Variants:** None
────────────────────────────────────────
**Folder:** landing/
**Content:** Landing page images
**Naming:** Fixed names
**Resized Variants:** None

**Static Files in defaults/**
placeholder.png, landing_logo.svg, logo_16_9.png, pdfFooterImage.png, divider_icon.svg, twint-qr-code.svg, Quittung.png

#### Image Flow

1. Upload via uploadBytesResumable() → Firebase Storage
2. External Cloud Function (separate repo) resizes to 6 variants
3. Client polls for resized variants via getPictureVariants()
4. Download URLs stored in Firestore (pictureSrc fields)

#### Firestore References

- User profile: `users/{uid}/public/profile.pictureSrc = {smallSize,
normalSize, fullSize}` (3 URLs)
  Event: `events/{eventId}.pictureSrc` = single URL string
  Static images: Hardcoded URLs in `src/constants/imageRepository.ts`

#### Notes

- Only images (JPEG, PNG, SVG) — no PDFs or other files
- PDFs generated client-side via @react-pdf/renderer, never stored
- Content type hardcoded to image/jpeg for uploads
- No storage security rules in repo — configured only in Firebase
  Console
- Image resizing Cloud Function is in a separate private repository

---

### Role Model & Security Rules

#### Roles

**Role:** admin
**Defined In:** Client + Cloud Functions
**Description:** Full access
─────────────────────────────────────
**Role:** subAdmin
**Defined In:** Cloud Functions only
**Description:** Not used in client app
─────────────────────────────────────
**Role:** basic
**Defined In:** Client + Cloud Functions
**Description:** Default role for new users
─────────────────────────────────────
**Role:** communityLeader
**Defined In:** Client + Cloud Functions
**Description:** Can manage recipes, events, requests
─────────────────────────────────────

- Roles stored as `string[]` in Firestore `users/{uid}.roles`
- No Firebase custom claims — roles fetched from Firestore and cached in localStorage
- Default: all new users get \[Role.basic]
- Only admins can change roles via `User.updateRoles()`

### Route Protection Summary

**Access Level:** Public
**Routes:** /, /signin, /signup, /privacypolicy, /termofuse
─────────────────────────────────────
**Access Level:** Authenticated
**Routes:** /home, /events, /recipes, /profile, /donate, etc.
─────────────────────────────────────
**Access Level:** Admin OR CommunityLeader
**Routes:** /products, /materials, /departments, /system/\*
─────────────────────────────────────
**Access Level:** Admin only
**Routes:** /system/globalsettings, /system/jobs, /system/overview/users, /system/overview/mailbox

### Firestore Security Rules (from Firebase-Securityrules.md)

#### Key helper functions:

`isAdmin()` → "admin" in users/{uid}.roles
`isCommunityLeader()` → "admin" OR "subAdmin" OR "communityLeader" in roles
`isEventMember(uid)` → request.auth.uid in events/{uid}.authUsers

**Collection:** `events/{id}`
**Read:** Member OR communityLeader
**Write:** Member OR communityLeader
**Notes:** Delete: member only
─────────────────────────────────────
**Collection:** `events/{id}/docs/**`
**Read:** Member OR communityLeader
**Write:** Member OR communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `events/{id}/shoppingLists/**`
**Read:** Member OR communityLeader
**Write:** Member OR communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `recipes/public/recipes/**`
**Read:** All authenticated
**Write:** communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `recipes/private/users/{uid}/**`
**Read:** Owner OR communityLeader
**Write:** Owner OR communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `recipes/variants/events/{uid}/**`
**Read:** Event member OR communityLeader
**Write:** Event member OR communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `recipes/**/ratings/{uid}`
**Read:** Self only
**Write:** Self only
**Notes:**
─────────────────────────────────────
**Collection:** `recipes/**/comments/**`
**Read:** All authenticated
**Write:** All authenticated
**Notes:**
─────────────────────────────────────
**Collection:** `users/{uid}`
**Read:** Self OR communityLeader
**Write:** Self (no roles!) OR admin
**Notes:** Roles: admin only
─────────────────────────────────────
**Collection:** `users/{uid}/public/**`
**Read:** All authenticated
**Write:** Self OR admin
**Notes:**
─────────────────────────────────────
**Collection:** `masterData/**`
**Read:** All authenticated
**Write:** admin
**Notes:**
─────────────────────────────────────
**Collection:** `feeds/**`
**Read:** All authenticated
**Write:** admin
**Notes:**
─────────────────────────────────────
**Collection:** `requests/**`
**Read:** Author OR communityLeader
**Write:** communityLeader
**Notes:**
─────────────────────────────────────
**Collection:** `_configuration/**`
**Read:** All authenticated
**Write:** admin
**Notes:**
─────────────────────────────────────
**Collection:** `_mailbox/**`
**Read:** admin
**Write:** admin
**Notes:**
─────────────────────────────────────
**Collection:** `_cloudFunctions/**`
**Read:** All authenticated
**Write:** All authenticated
**Notes:** Trigger mechanism
─────────────────────────────────────
**Collection:** `stats/**`
**Read:** All authenticated
**Write:** admin
**Notes:**
─────────────────────────────────────

### Open Questions

1. Image resizing: The Cloud Function for image resizing lives in a separate private repo. Do you have access to it, or should we replicate this with a Supabase Edge Function / external service?

> No I don't have access. It's a Firebase-Function. Is there a easy way to rebuild this with an Edge Function?

2. subAdmin role: Defined in Cloud Functions but not in the client. Is this a legacy role that can be dropped, or should it be preserved?

> It's a legacy role and can be dropped.

3. Vestaboard integration (newPizzaInTheOven): Should this be migrated to a Supabase Edge Function, or can it be dropped/deferred?

> It's not essential and can be moved to a different project.

4. Email sending: Currently uses Firebase email extension via \_mailbox collection. What email service should Supabase use? (e.g., Resend, SendGrid, Supabase's built-in email?)

> at the moment I am working with sendinblue. If you have a good idea how to handle sending e-mails I am open for suggestions. How good is the built-in email of supabase?
> Claude: Supabase built-in email is limited — it only handles auth-related emails (signup confirmation, password reset, magic links). It's not designed for transactional/newsletter emails like your dailySummary or sendMail function.
>
> Recommended approach: Keep Sendinblue (now Brevo). Call its API from Supabase Edge Functions. This is straightforward — just an HTTP POST with your API key. No need to change providers.

4. 000_allEvents / 000_allUsers aggregate caches: These are Firestore-specific denormalization patterns. In Postgres, these would be replaced by simple SQL queries or views. Should we drop these entirely?

> Yes. These were made to reduce the reading-operations.

5. Storage security rules: Not in the repo. Do you have the current Firebase Storage security rules, or should we design new ones from scratch for Supabase?

> Design new ones from scratch.

6. Support user UIDs: Hardcoded per environment in Cloud Functions.
   Should these be moved to configuration/env vars in Supabase?

   > Yes would make sense. 7. Three environments: Do you want the same DEV/TEST/PROD split in Supabase, or a different environment strategy?

   > Yes I want a 3 Tier environment.

#### Answers Summary (for the record)

#: 1  
 **Question:** Image resizing
**Decision:** Rebuild with Edge Function (Supabase has sharp support in Deno) ─────────────────────────────────────
#: 2
**Question:** subAdmin role
**Decision:** Drop it
─────────────────────────────────────  
 #: 3
**Question:** Vestaboard
**Decision:** Move to separate project, not part of migration
─────────────────────────────────────  
 #: 4
**Question:** Email service
**Decision:** Keep Brevo/Sendinblue, call via Edge Functions
─────────────────────────────────────
#: 5
**Question:** 000\_\* aggregate caches
**Decision:** Drop — use SQL queries/views instead
─────────────────────────────────────
#: 6
**Question:** Storage security rules
Decision: Design from scratch for Supabase
─────────────────────────────────────
#: 7
**Question:** Support user UIDs
**Decision:** Move to env vars / configuration table
─────────────────────────────────────
#: 8
**Question:** Environments
**Decision:** Keep 3-tier (DEV/TEST/PROD)

---

## Pre-Deployment Checklist

Tasks to complete before going to production. Items are checked off as they are resolved.

### Workarounds to Remove

- [ ] **Remove Firebase sign-in workaround in `signIn.tsx`** — After successful Supabase login, the code also signs in to Firebase (`firebase.signInWithEmailAndPassword`) so that Firestore reads still work. Once all data reads are migrated from Firestore to Supabase/Postgres, remove this block (search for comment: _"Parallel Firebase-Session aufbauen"_).

### Data Migration

- [ ] **Migrate all Firestore collections to Postgres** — events, recipes, feeds, stats, masterData, requests, configuration, mailbox
- [ ] **Migrate Firebase Storage to Supabase Storage** — user/event images, defaults, landing assets
- [ ] **Migrate Cloud Functions to Supabase Edge Functions** — all 22 triggers + scheduled jobs (except Vestaboard)

### Auth Migration

- [ ] **Ensure all users have Supabase Auth accounts** — run password migration for remaining Firebase-only users
- [ ] **Remove Firebase Auth fallback in `AuthUserProvider`** (`authUserContext.tsx`) — drop the secondary `firebase.onAuthUserListener` once all users are on Supabase
- [ ] **Remove Firebase sign-in fallback in `signIn.tsx`** — the `catch` block that tries `firebase.signInWithEmailAndPassword` and shows the migration dialog
- [ ] **Remove `PasswordMigrationDialog`** (`passwordMigrationDialog.tsx`) — no longer needed once all users migrated

### Code Cleanup

- [ ] **Remove Firebase SDK dependency** — once all reads/writes go through Supabase, remove `firebase` package and all `Firebase/Db/` classes
- [ ] **Remove `FirebaseContext`** — replace all `useFirebase()` usages with `useDatabase()`
- [ ] **Remove `firebase.class.ts`** and all `firebase.db.*.class.ts` files
- [ ] **Remove dual-context pattern in `index.jsx`** — drop `FirebaseContext.Provider` wrapper
- [ ] **Remove `enviroment.class.ts`** — unused (version check is commented out in `navigation.tsx`)
- [ ] **Clean up `.env` files** — remove `VITE_FIREBASE_*` variables once Firebase is fully decommissioned
