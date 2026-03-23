## Phase 12 - Refactoring Plan: `home.tsx`

### Context

`home.tsx` (942 lines) is the landing page after login — the first thing every user sees. It loads 5 data sources in parallel (events, recipes, feed, stats, system messages) and renders 6 sub-components. The file has critical bugs (wrong loading states, broken skeletons, render-body dispatch), no Sentry logging, no error isolation, and events+stats still read from Firebase. This refactoring makes the page robust, performant, and aligned with established patterns — and migrates the last two Firebase data sources on this page to Supabase.

---

### Step 1 — Fix Critical Bugs

**1a: Wrong loading state (line 516)**

`isLoadingRecipes={state.isLoadingEvents}` → `isLoadingRecipes={state.isLoadingNewestRecipes}`

**1b: HomeStats skeleton logic (lines 907–912)**

`stats.map(...)` iterates empty `[]` during loading → use `[...Array(18).keys()].map(...)` for skeleton items (matching 18 KPIs).

**1c: HomeNewestRecipes skeleton logic (lines 752–757)**

`Array(N).map(...)` is sparse array (skips empty slots) → use `[...Array(N).keys()].map(...)`.

**1d: Snackbar dispatch in render body (lines 243–248)**

Move to `useEffect` with `[location.state]` dependency.

**1e:** Fix `inititialState` typo → `initialState`

**1f:** Fix `{} as Snackbar` → `SNACKBAR_INITIAL_STATE_VALUES`

---

### Step 2 — Migrate Events from Firebase to Supabase

Replace `Event.getEventsOfUser({firebase, ...})` with `database.events.getAllEventsForUser()` (exists at `EventRepository.ts:345`).

Load once, split client-side using `getMaxDate()` from `EventRepository`:

```typescript
React.useEffect(() => {
  if (!authUser) return;
  dispatch({type: ReducerActions.EVENTS_FETCH_INIT});
  database.events
    .getAllEventsForUser()
    .then((result) => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const actual = result.filter((event) => getMaxDate(event) >= today);
      const passed = result.filter((event) => getMaxDate(event) < today);
      dispatch({
        type: ReducerActions.EVENTS_FETCH_SUCCESS,
        payload: {actual, passed},
      });
    })
    .catch((error) => {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.EVENTS_FETCH_ERROR,
        payload: error as Error,
      });
    });
}, [authUser]);
```

**Changes:**

- State: `events: Event[]` → `events: EventDomain[]`, same for `passedEvents`
- Remove `isLoadingPassedEvents` — passed events loaded in same call
- Remove `PASSED_EVENTS_FETCH_INIT/SUCCESS` actions
- `onShowPassedEvents` becomes a simple boolean toggle (no separate fetch)
- Remove `Event`, `EventType`, `General`, `firebase`/`useFirebase()` imports (no longer needed after Stats migration in Step 3)
- Sub-components adapt to `EventDomain` (compatible structure — `uid`, `name`, `motto`, `location`, `pictureSrc`, `dates`, `cooks`)

---

### Step 3 — Migrate Stats from Firebase to Supabase

#### 3a: SQL Migration — `SECURITY DEFINER` function

> [!info] File
> `supabase/migrations/20260319000002_create_get_platform_stats.sql`

Create `get_platform_stats()` function that bypasses RLS (needed because events, `event_shopping_lists`, `event_material_lists` have restrictive SELECT policies):

```sql
CREATE FUNCTION public.get_platform_stats()
RETURNS TABLE(field TEXT, value NUMERIC)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  -- Plattform
  SELECT 'noUsers',              COUNT(*)::NUMERIC FROM users
  UNION ALL SELECT 'noCooks',              COUNT(DISTINCT user_id)::NUMERIC FROM event_cooks
  -- Rezepte
  UNION ALL SELECT 'noRecipesPublic',      COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'public'
  UNION ALL SELECT 'noRecipesPrivate',     COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'private'
  UNION ALL SELECT 'noRecipesVariants',    COUNT(*)::NUMERIC FROM recipes WHERE recipe_type = 'variant'
  UNION ALL SELECT 'noRatings',            COUNT(*)::NUMERIC FROM recipe_ratings
  UNION ALL SELECT 'noComments',           COUNT(*)::NUMERIC FROM recipe_comments
  -- Anlässe
  UNION ALL SELECT 'noEvents',             COUNT(*)::NUMERIC FROM events
  UNION ALL SELECT 'noParticipants',       COALESCE(SUM(servings), 0)::NUMERIC FROM event_groupconfiguration_portions
  UNION ALL SELECT 'noPlanedDays',         COALESCE(SUM(date_to - date_from + 1), 0)::NUMERIC FROM event_dates
  UNION ALL SELECT 'noPortions',           COALESCE(SUM(total_portions), 0)::NUMERIC FROM event_menue_recipes
  UNION ALL SELECT 'noShoppingLists',      COUNT(*)::NUMERIC FROM event_shopping_lists
  UNION ALL SELECT 'noMaterialLists',      COUNT(*)::NUMERIC FROM event_material_lists
  -- Durchschnitt pro Anlass
  UNION ALL SELECT 'avgEventDuration',     COALESCE(ROUND(AVG(date_to - date_from + 1), 1), 0) FROM event_dates
  UNION ALL SELECT 'avgCooksPerEvent',     COALESCE(ROUND(AVG(cook_count), 1), 0) FROM (SELECT COUNT(*) AS cook_count FROM event_cooks GROUP BY event_id) sub
  UNION ALL SELECT 'avgRecipesPerEvent',   COALESCE(ROUND(AVG(recipe_count), 1), 0) FROM (SELECT COUNT(*) AS recipe_count FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgPortionsPerEvent',  COALESCE(ROUND(AVG(portion_sum), 1), 0) FROM (SELECT SUM(total_portions) AS portion_sum FROM event_menue_recipes GROUP BY event_id) sub
  UNION ALL SELECT 'avgShoppingListItems', COALESCE(ROUND(AVG(item_count), 1), 0) FROM (SELECT COUNT(*) AS item_count FROM event_shopping_list_items GROUP BY shopping_list_id) sub
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO authenticated;
```

18 KPIs in 4 groups (dropped `noIngredients`/`noMaterials` — admin-only). Return type `NUMERIC` for decimal averages.

**KPI grouping in UI — Stats sidebar with grouped cards and headers:**

```
Plattform
  User                128
  Aktive Köche         42

Rezepte
  Öffentlich           87
  Privat               34
  Varianten            12
  Bewertungen         205
  Kommentare           63

Anlässe
  Anlässe              42
  Teilnehmer         1240
  Geplante Tage       186
  Portionen          8500
  Einkaufslisten       38
  Materiallisten       29

⌀ Durchschnitt pro Anlass
  Dauer            3.5 Tage
  Köche               4.2
  Rezepte             8.1
  Portionen         202.4
  Einkaufsartikel    45.3
```

Each group rendered as a `Typography` header + `List` with `ListItems`, separated by `Divider`.

#### 3b: `StatsRepository`

> [!info] File
> `src/components/Database/Repository/StatsRepository.ts`

- `getStats(): Promise<Kpi[]>` — calls `supabase.rpc('get_platform_stats')`, maps rows to `Kpi[]` using caption constants from `text.ts`
- Reuse existing `Kpi` interface from `stats.class.ts`

#### 3c: Register in `DatabaseService`

Add `stats: StatsRepository` to `DatabaseService.ts`.

#### 3d: Add text constants for new KPIs

Add to `text.ts`: group headers (`STATS_GROUP_PLATFORM`, `STATS_GROUP_RECIPES`, `STATS_GROUP_EVENTS`, `STATS_GROUP_AVERAGES`) and new KPI captions (`STATS_COOKS`, `STATS_RATINGS`, `STATS_COMMENTS`, `STATS_AVG_SHOPPING_LIST_ITEMS`, `STATS_AVG_EVENT_DURATION`, `STATS_AVG_COOKS_PER_EVENT`, `STATS_AVG_RECIPES_PER_EVENT`, `STATS_AVG_PORTIONS_PER_EVENT`).

#### 3e: Update `home.tsx`

Replace `Stats.getStats(firebase)` with `database.stats.getStats()`.

After this step, `useFirebase()` and all Firebase imports can be removed from `home.tsx`.

---

### Step 4 — Discriminated Union for `DispatchAction`

Replace `{type: ReducerActions; payload: {[key: string]: any}}` with strict discriminated union:

```typescript
type DispatchAction =
  | {type: ReducerActions.EVENTS_FETCH_INIT}
  | {
      type: ReducerActions.EVENTS_FETCH_SUCCESS;
      payload: {actual: EventDomain[]; passed: EventDomain[]};
    }
  | {type: ReducerActions.EVENTS_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_INIT}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS; payload: FeedDomain[]}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.FEED_FETCH_INIT}
  | {type: ReducerActions.FEED_FETCH_SUCCESS; payload: FeedDomain[]}
  | {type: ReducerActions.FEED_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.STATS_FETCH_INIT}
  | {type: ReducerActions.STATS_FETCH_SUCCESS; payload: Kpi[]}
  | {type: ReducerActions.STATS_FETCH_ERROR; payload: Error}
  | {
      type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS;
      payload: SystemMessageDomain[];
    }
  | {type: ReducerActions.SNACKBAR_SET; payload: Snackbar}
  | {type: ReducerActions.SNACKBAR_CLOSE};
```

- Remove `GENERIC_ERROR`, `PASSED_EVENTS_*` actions
- Add exhaustive switch default
- No `as` casts in reducer

---

### Step 5 — Per-Section Error Isolation

Replace single `error: Error | null` with per-section errors:

```typescript
type State = {
  events: EventDomain[];
  passedEvents: EventDomain[];
  showPassedEvents: boolean; // simple toggle, no separate fetch
  recipes: FeedDomain[];
  feed: FeedDomain[];
  stats: Kpi[];
  systemMessages: SystemMessageDomain[];
  snackbar: Snackbar;
  isLoadingEvents: boolean;
  isLoadingNewestRecipes: boolean;
  isLoadingFeed: boolean;
  isLoadingStats: boolean;
  eventsError: Error | null;
  recipesError: Error | null;
  feedError: Error | null;
  statsError: Error | null;
};
```

**Render strategy:**

- Events & Recipes errors → `AlertMessage` (critical sections)
- Feed & Stats errors → degrade silently (supplementary)

---

### Step 6 — Sentry Logging

Add `import * as Sentry from "@sentry/browser"` and `Sentry.captureException(error)` in every `.catch()` block (5 data sources).

---

### Step 7 — Data Fetching Guards

Add `if (!authUser) return;` guard to all `useEffect`s (recipes, feed, stats, system messages currently missing it).

---

### Step 8 — Layout Change: 2-Column with Stats Sidebar

Change the bottom section from 3 equal columns to content + sidebar:

```
Desktop:
┌──────────────────────────────────────┐
│  Nächste Anlässe (full width)        │
├──────────────────────────┬───────────┤
│  Neueste Rezepte         │  Stats    │
│  ─────────────────       │  ──────   │
│  Feed                    │  Köche:42 │
│  • User did X            │  Events:15│
│  • User did Y            │  ...      │
└──────────────────────────┴───────────┘

Mobile: stacked vertically
```

- Recipes + Feed: `Grid size={{xs: 12, md: 8}}`
- Stats: `Grid size={{xs: 12, md: 4}}`
- Inside left column: Recipes and Feed stacked vertically
- Stats sidebar stays visible alongside content on desktop

---

### Step 9 — Naming & Code Quality

**9a: Hover state simplification (HomeNewestRecipes)**

`{recipeUid: "", hover: false}` → `hoveredRecipeUid: string | null`

**9b: No single-letter variables**

Replace all single-letter variables (e.g. `e`, `f`, `d`) with descriptive names throughout the file.

**9c: Remove string-based ID parsing**

Use `data-*` attributes instead of `name.split("_")[1]`.

**9d:** Fix `==` → `===`

**9e: Snackbar close handler typing**

Add proper types `(_event: Event | React.SyntheticEvent, reason?: string)`.

---

### Step 10 — UX: Empty States & Skeletons

Verify all sections have proper skeletons during loading (using `EventCardLoading`, `RecipeCardLoading`, and `Skeleton` components).

**Add empty state messages:**

| Section | Message                          |
| ------- | -------------------------------- |
| Events  | Encourage creating first event   |
| Recipes | "Noch keine Rezepte publiziert." |
| Feed    | "Noch keine Aktivitäten."        |
| Stats   | Hide section if empty (unlikely) |

Add ~3 new text constants to `text.ts`.

---

### Step 11 — Performance

- `useCallback` for handlers passed to sub-components (`onEventClick`, `onRecipeClick`, `onFeedEntryClick`, `onCreateNewEvent`, `handleSnackbarClose`)
- `React.memo` for sub-components (`HomeNextEvents`, `HomePassedEvents`, `HomeNewestRecipes`, `HomeFeed`, `HomeStats`)

---

### Step 12 — JSDoc Comments

German JSDoc (per `CLAUDE.md`) on all components, interfaces, reducer, handlers, and state types.

---

### Files Summary

| File                                                               | Action                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `src/components/Home/home.tsx`                                     | **Full refactoring** (Steps 1–12)                               |
| `src/components/Database/Repository/StatsRepository.ts`            | **Create** — `StatsRepository` with `getStats()`                |
| `src/components/Database/DatabaseService.ts`                       | **Modify** — register `StatsRepository`                         |
| `src/constants/text.ts`                                            | **Modify** — ~6 new constants (3 KPI captions + 3 empty states) |
| `supabase/migrations/20260319000002_create_get_platform_stats.sql` | **Create** — `SECURITY DEFINER` function                        |
| `supabase/ENVIRONMENT_SETUP.md`                                    | **Modify** — add migration entry                                |

---

### Verification

1. `npx tsc --noEmit` — no TypeScript errors
2. `npm run test` — existing tests pass
3. Manual: login → Home loads with proper skeletons during loading
4. Manual: Events section shows user's upcoming events (from Supabase)
5. Manual: "Vergangene Anlässe" toggles without a separate fetch
6. Manual: Newest recipes show with correct loading skeleton
7. Manual: Feed loads and displays entries
8. Manual: Stats sidebar shows all 18 KPIs (from Supabase function)
9. Manual: layout — 2-column on desktop (content + stats sidebar), stacked on mobile
10. Manual: empty state — test with new user (no events) → friendly message shown
11. Manual: error simulation — disconnect DB → individual sections show error/degrade gracefully, page stays usable
12. No Firebase imports remain in `home.tsx`
