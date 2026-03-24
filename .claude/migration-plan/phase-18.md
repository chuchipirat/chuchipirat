## Phase 18: Replace Google Analytics with Umami

### Context

The app currently uses Google Analytics via Firebase SDK (`firebase/analytics`). GA is loaded implicitly through the Firebase config's `measurementId`. 45 events are defined in an enum but only 8 are actually tracked. The analytics calls are scattered across business logic files with no centralized service.

**Goal:** Completely remove Google Analytics / Firebase Analytics and replace with Umami — a privacy-friendly, cookie-free analytics tool. Cloud Umami for DEV, self-hosted (Coolify) for TEST/PROD.

**Why Umami?**

- No cookies → no cookie banner needed (Swiss nDSG / GDPR compliant)
- No personal data collection (IPs hashed and discarded)
- Self-hosted = full data sovereignty on Hetzner
- Automatic SPA page view tracking (detects `history.pushState`)
- Free and open source

---

### Step 1 — Infrastructure Setup (outside codebase — manual)

1. Sign up for Umami Cloud, create a "chuchipirat-dev" website → note the Website ID
2. Deploy self-hosted Umami on Coolify for TEST (use Coolify's Umami marketplace template, `ghcr.io/umami-software/umami:postgresql-latest` with its own PostgreSQL) → note the Website ID and host URL
3. Deploy self-hosted Umami on Coolify for PROD (same) → note the Website ID and host URL

---

### Step 2 — Add Umami + Analytics Service (new files)

#### 2a. Environment Variables

Add to each `.env.*` file, remove `VITE_FIREBASE_MEASUREMENT_ID`:

| Env file           | `VITE_UMAMI_HOST`                   | `VITE_UMAMI_WEBSITE_ID` |
| ------------------ | ----------------------------------- | ----------------------- |
| `.env.development` | `https://cloud.umami.is`            | (from Cloud dashboard)  |
| `.env.test`        | `https://umami.test.chuchipirat.ch` | (from self-hosted)      |
| `.env.production`  | `https://umami.chuchipirat.ch`      | (from self-hosted)      |

#### 2b. New Files

| File                                           | Purpose                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/components/Analytics/analyticsService.ts` | `initAnalytics()` — injects `<script>` at runtime; `trackEvent()` — calls `window.umami.track()` |
| `src/components/Analytics/analyticsEvents.ts`  | `const AnalyticsEvent = { ... } as const` — all event name constants                             |
| `src/components/Analytics/useAnalytics.ts`     | Thin hook returning `{ trackEvent }` for components                                              |

**Design rationale:** No React Context needed — unlike `DatabaseService`, analytics is stateless. A plain module with exported functions can be called from anywhere (components, class files, hooks). The hook is a thin convenience wrapper.

**Script injection approach:** Dynamic `<script>` creation at runtime in `initAnalytics()` — this works natively with Vite env vars (`import.meta.env.VITE_*`) and avoids adding build-time HTML plugins. Set `data-domains` on PROD to prevent accidental tracking from local prod builds.

#### 2c. Initialize in `src/index.jsx`

Call `initAnalytics()` after Sentry init, before React render.

---

### Step 3 — Migrate Existing `logEvent` Calls → `trackEvent`

Replace the 8 `logEvent(firebase.analytics, ...)` calls across 5 files:

| File                                              | Event(s)                                     | Action                                                                                                            |
| ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `firebase.class.ts` (L374, L395)                  | `userChangedPassword`, `userResetetPassword` | → `trackEvent(AnalyticsEvent.PASSWORD_CHANGED)`, `trackEvent(AnalyticsEvent.PASSWORD_RESET)`                      |
| `department.class.ts` (L96)                       | `departmentCreated`                          | Remove entirely (low-value admin action)                                                                          |
| `firebase.storage.super.class.ts` (L76, L199)     | `uploadPicture`, `deletePicture`             | → `trackEvent(AnalyticsEvent.PICTURE_UPLOADED, {folder})`, `trackEvent(AnalyticsEvent.PICTURE_DELETED, {folder})` |
| `firebase.db.cloudfunction.super.class.ts` (L192) | `cloudFunctionExecuted`                      | Remove entirely (infrastructure metric, not user behavior; irrelevant after CF→Edge migration)                    |
| `event.tsx` (L1688, L1700)                        | `menuplanConsistencyCheck*`                  | Keep errors → `trackEvent(AnalyticsEvent.MENUPLAN_CONSISTENCY_ERRORS)`. Remove no-errors (inferred).              |

Remove all `import {logEvent} from "firebase/analytics"` and `import {FirebaseAnalyticEvent}` from these files.

---

### Step 4 — Remove Firebase Analytics

| File                                                  | Change                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/Firebase/firebase.class.ts`           | Remove `import {Analytics, getAnalytics, logEvent}`, `analytics` property, `this.analytics = getAnalytics(...)`, `measurementId` from config |
| `src/constants/firebaseEvent.ts`                      | Delete entirely                                                                                                                              |
| All `.env.*` files                                    | Remove `VITE_FIREBASE_MEASUREMENT_ID`                                                                                                        |
| Test mocks (if any `jest.mock("firebase/analytics")`) | Remove                                                                                                                                       |

---

### Step 5 — Add New Custom Events

#### Event Constants (`analyticsEvents.ts`)

```typescript
export const AnalyticsEvent = {
  // ── Auth ──
  EMAIL_CHANGED: "email_changed",
  PASSWORD_CHANGED: "password_changed",
  PASSWORD_RESET: "password_reset",

  // ── Rezepte ──
  RECIPE_CREATED: "recipe_created",
  RECIPE_VARIANT_CREATED: "recipe_variant_created",
  RECIPE_SCALED: "recipe_scaled",
  RECIPE_SEARCH: "recipe_search",
  RECIPE_DRAWER_SEARCH: "recipe_drawer_search",
  RECIPE_FILTER_APPLIED: "recipe_filter_applied",
  RECIPE_COMMENT_CREATED: "recipe_comment_created",
  RECIPE_RATING_SET: "recipe_rating_set",

  // ── Events (Lager/Kurse) ──
  EVENT_CREATED: "event_created",
  EVENT_DELETED: "event_deleted",
  EVENT_COOK_ADDED: "event_cook_added",
  EVENT_COOK_REMOVED: "event_cook_removed",
  GROUP_CONFIG_CHANGED: "group_config_changed",

  // ── Menuplan ──
  MENUPLAN_CREATED: "menuplan_created",
  MENUPLAN_RECIPE_ADDED: "menuplan_recipe_added",
  MENUPLAN_RECIPE_MOVED: "menuplan_recipe_moved",
  MENUPLAN_CONSISTENCY_ERRORS: "menuplan_consistency_errors",

  // ── Listen ──
  USED_RECIPES_GENERATED: "used_recipes_generated",
  USED_RECIPES_REFRESHED: "used_recipes_refreshed",
  USED_RECIPES_DELETED: "used_recipes_deleted",
  SHOPPING_LIST_GENERATED: "shopping_list_generated",
  SHOPPING_LIST_REFRESHED: "shopping_list_refreshed",
  SHOPPING_LIST_DELETED: "shopping_list_deleted",
  MATERIAL_LIST_GENERATED: "material_list_generated",
  MATERIAL_LIST_REFRESHED: "material_list_refreshed",
  MATERIAL_LIST_DELETED: "material_list_deleted",

  // ── Masterdata ──
  PRODUCT_CREATED: "product_created",
  MATERIAL_CREATED: "material_created",

  // ── Medien ──
  PICTURE_UPLOADED: "picture_uploaded",
  PICTURE_DELETED: "picture_deleted",

  // ── PDF / Export ──
  PDF_EXPORTED: "pdf_exported",

  // ── Spenden ──
  DONATION_STARTED: "donation_started",
  DONATION_COMPLETED: "donation_completed",

  // ── Fehler / UX ──
  SEARCH_NO_RESULTS: "search_no_results",
} as const;
```

#### Event Properties

| Event                                  | Properties                                                       | Notes                          |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| `RECIPE_SCALED`                        | `scaleFactor`, `servings`                                        | How users scale portions       |
| `RECIPE_SEARCH`                        | `query`, `resultCount`                                           | What users search for          |
| `RECIPE_DRAWER_SEARCH`                 | `query`, `resultCount`                                           | Search in recipe-select drawer |
| `RECIPE_FILTER_APPLIED`                | `filterType` (diet, menutype, outdoor, etc.)                     | Which filters are popular      |
| `GROUP_CONFIG_CHANGED`                 | `numberOfGroups`                                                 | How complex are event setups   |
| `PICTURE_UPLOADED` / `PICTURE_DELETED` | `folder` (recipe/event/profile)                                  | Where are images used          |
| `PDF_EXPORTED`                         | `type` (shopping_list, material_list, menuplan, recipe, receipt) | Which exports matter           |
| `DONATION_STARTED`                     | `amount`                                                         | Donation funnel                |
| `DONATION_COMPLETED`                   | `amount`                                                         | Conversion tracking            |
| `SEARCH_NO_RESULTS`                    | `query`, `context` (recipe/product/material)                     | Content gaps                   |
| All list events                        | `eventUid`                                                       | Per-event tracking             |

#### Where to Wire Events

| Event                                     | Where to add `trackEvent(...)`                               |
| ----------------------------------------- | ------------------------------------------------------------ |
| `EMAIL_CHANGED`                           | `firebase.class.ts` — email update handler                   |
| `PASSWORD_CHANGED`                        | `firebase.class.ts` (L374) — existing, migrate               |
| `PASSWORD_RESET`                          | `firebase.class.ts` (L395) — existing, migrate               |
| `RECIPE_CREATED`                          | Recipe creation flow (after successful save)                 |
| `RECIPE_VARIANT_CREATED`                  | Recipe variant creation handler                              |
| `RECIPE_SCALED`                           | Recipe scaling handler (portion change)                      |
| `RECIPE_SEARCH`                           | Recipe search component — on search submit                   |
| `RECIPE_DRAWER_SEARCH`                    | Recipe search drawer — on search submit                      |
| `RECIPE_FILTER_APPLIED`                   | Recipe filter change handler                                 |
| `RECIPE_COMMENT_CREATED`                  | Comment submission handler                                   |
| `RECIPE_RATING_SET`                       | Rating handler                                               |
| `EVENT_CREATED`                           | `createNewEvent.tsx` — after successful creation             |
| `EVENT_DELETED`                           | Event deletion handler                                       |
| `EVENT_COOK_ADDED` / `EVENT_COOK_REMOVED` | Cook management handlers                                     |
| `GROUP_CONFIG_CHANGED`                    | Group config save/recalculate handler                        |
| `MENUPLAN_CREATED`                        | Menuplan creation flow                                       |
| `MENUPLAN_RECIPE_ADDED`                   | Menuplan recipe-add handler                                  |
| `MENUPLAN_RECIPE_MOVED`                   | Menuplan drag-and-drop handler                               |
| `MENUPLAN_CONSISTENCY_ERRORS`             | `event.tsx` (L1688) — existing, migrate                      |
| `USED_RECIPES_*`                          | Used recipes generate/refresh/delete handlers                |
| `SHOPPING_LIST_*`                         | Shopping list generate/refresh/delete handlers               |
| `MATERIAL_LIST_*`                         | Material list generate/refresh/delete handlers               |
| `PRODUCT_CREATED`                         | Product creation handler                                     |
| `MATERIAL_CREATED`                        | Material creation handler                                    |
| `PICTURE_UPLOADED`                        | `firebase.storage.super.class.ts` (L76) — existing, migrate  |
| `PICTURE_DELETED`                         | `firebase.storage.super.class.ts` (L199) — existing, migrate |
| `PDF_EXPORTED`                            | `generateAndDownloadPdf()` calls — with type property        |
| `DONATION_STARTED`                        | `DonationForm.tsx` — on form submit                          |
| `DONATION_COMPLETED`                      | Success page or webhook callback                             |
| `SEARCH_NO_RESULTS`                       | All search components — when `resultCount === 0`             |

#### Umami Data Attributes (zero-JS tracking)

For simple CTA buttons, use `data-umami-event` attributes instead of `trackEvent()`:

```tsx
<Button data-umami-event="shopping_list_generated" onClick={handleGenerate}>
  Einkaufsliste generieren
</Button>
```

Good candidates: PDF export buttons, donation button, create-event button, list generate/refresh/delete buttons.

#### What NOT to Track (noise)

- Individual ingredient add/remove (too granular)
- Page navigation (Umami tracks automatically)
- Unit/department CRUD (rare admin actions)
- `menuplan_get` / `event_get_actual` (just page views)
- `app_force_refresh` / `exception` (use Sentry instead)

---

### Step 6 — Update Privacy Policy

> [!info] File
> `src/components/App/privacyPolicy.tsx`

- Remove Google Analytics references
- Add short Umami section: "Wir verwenden Umami für anonyme Nutzungsstatistiken. Es werden keine Cookies gesetzt und keine personenbezogenen Daten erhoben."

---

### Umami Tips

1. **Automatic page views** — Umami detects SPA route changes via `history.pushState`. Zero config needed for page tracking with React Router.
2. **`data-umami-event` attributes** — Add to any HTML element for automatic click tracking without JavaScript. Supports properties via `data-umami-event-*` attributes.
3. **Goals** — In the Umami dashboard, you can set up Goals (e.g., "event_created count > 10/week") for monitoring feature adoption.
4. **UTM tracking** — Umami automatically captures UTM parameters. Useful if you ever share links on social media.
5. **Realtime dashboard** — Shows live visitors. Helpful during camps to see concurrent usage.
6. **API access** — Both Cloud and self-hosted expose a REST API for programmatic access to analytics data.
7. **Teams** — You can invite collaborators to view the dashboard without giving them admin access.

---

### Files Summary

#### Create

| File                                           | Purpose                  |
| ---------------------------------------------- | ------------------------ |
| `src/components/Analytics/analyticsService.ts` | Init + `trackEvent()`    |
| `src/components/Analytics/analyticsEvents.ts`  | Event name constants     |
| `src/components/Analytics/useAnalytics.ts`     | Thin hook for components |

#### Modify

| File                                                                  | Change                    |
| --------------------------------------------------------------------- | ------------------------- |
| `src/index.jsx`                                                       | Add `initAnalytics()`     |
| `src/components/Firebase/firebase.class.ts`                           | Remove analytics          |
| `src/components/Event/Event/event.tsx`                                | Migrate `logEvent`        |
| `src/components/Firebase/Storage/firebase.storage.super.class.ts`     | Migrate `logEvent`        |
| `src/components/Department/department.class.ts`                       | Remove `logEvent`         |
| `src/components/Firebase/Db/firebase.db.cloudfunction.super.class.ts` | Remove `logEvent`         |
| `.env.development`, `.env.test`, `.env.production`                    | Add Umami vars, remove GA |
| `src/components/App/privacyPolicy.tsx`                                | Update text               |

#### Delete

| File                             | Reason                           |
| -------------------------------- | -------------------------------- |
| `src/constants/firebaseEvent.ts` | Replaced by `analyticsEvents.ts` |

---

### Verification

1. `npx tsc --noEmit` — no type errors
2. `npm run test` — all tests pass
3. `grep -r "firebase/analytics" src/` — no results
4. `grep -r "FirebaseAnalyticEvent" src/` — no results
5. `grep -r "MEASUREMENT_ID" .env*` — no results
6. Manual: open app in DEV → check Umami Cloud dashboard shows page views
7. Manual: trigger a tracked action (e.g., upload picture) → verify custom event appears in dashboard
8. Manual: deploy to TEST → verify self-hosted Umami dashboard shows data
