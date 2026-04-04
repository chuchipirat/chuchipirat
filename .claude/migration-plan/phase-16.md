Refactoring of existing Coding.

---

Plan: Refactor App.css, customTheme.class.ts, privacyPolicy.tsx, termOfUse.tsx + Unit Tests

Context

Following the App.tsx refactoring (Phase 16), the remaining files in src/components/App/
need to be brought up to current conventions. This covers CSS cleanup, theme modernization,
legal pages refactoring, and comprehensive unit tests for the entire /App folder.

Critical bug: During the Phase 16 refactoring, import "./App.css" was accidentally dropped
from App.tsx. The CSS file contains styles used across the app (ribbons, corner tapes,
Quill editor, Sentry feedback, drag-drop). This must be fixed first.

---

Part 1: App.css — Restore Import + Refactoring

File: src/components/App/App.css (478 lines)

Issues Found

1.  Typo: cornerRibon — should be cornerRibbon (consistent English spelling). Used in:
    navigation.tsx, pageTitle.tsx
2.  Dead CSS: Commented-out test environment styles (lines 438-447) — remove
3.  Duplicate colors: Same hex values (#d32f2f, gradient stops) repeated across .ribbon--_,
    .cardRibbon--_ variants
4.  Banner comments: Heavy ASCII art section headers — replace with simple /_ Section _/
    comments
5.  CSS variables not used enough: :root defines 4 variables but hardcoded colors appear
    everywhere else
6.  No dark mode support for ribbons: Ribbons use hardcoded colors that don't adapt

Plan

1.  Restore import "./App.css" in App.tsx (dropped during Phase 16 refactoring — breaks
    ribbons, Quill, Sentry, drag-drop)
2.  Fix the typo: Rename cornerRibon → cornerRibbon everywhere (CSS + all consuming TSX
    files)
3.  Remove dead code: Delete commented-out test environment styles
4.  Replace banner comments with concise section headers
5.  Introduce CSS custom properties for repeated ribbon colors to reduce duplication:
    :root {
    --ribbon-red: #d32f2f;
    --ribbon-orange-start: #e7711b;
    --ribbon-orange-end: #f7981d;
    /_ etc. _/
    }
6.  Leave ribbon structure as-is — these are visual components, restructuring would be
    over-engineering

Files to Modify

┌──────────────────────────────────────────┬───────────────────────────────────────┐
│ File │ Change │
├──────────────────────────────────────────┼───────────────────────────────────────┤
│ src/components/App/App.css │ Rename classes, add CSS vars, cleanup │
├──────────────────────────────────────────┼───────────────────────────────────────┤
│ src/components/Navigation/navigation.tsx │ Update cornerRibon → cornerRibbon │
├──────────────────────────────────────────┼───────────────────────────────────────┤
│ src/components/Shared/pageTitle.tsx │ Update cornerRibon → cornerRibbon │
├──────────────────────────────────────────┼───────────────────────────────────────┤
│ Any other file using the old class name │ Update accordingly │
└──────────────────────────────────────────┴───────────────────────────────────────┘

---

Part 3: customTheme.class.ts Refactoring

File: src/components/App/customTheme.class.ts (84 lines)

Issues Found

1.  Default export — violates convention (must be named export)
2.  No JSDoc — missing on class and getTheme method
3.  Repetitive code — dark/light theme for prod and test are nearly identical; only primary
    color differs
4.  Class with only static method — could be a plain function (simpler, more idiomatic TS)
5.  Imported only in App.tsx — single consumer

Plan

1.  Convert to named function (no class needed for a single static method):
    export const getTheme = (prefersDarkMode: boolean): PaletteOptions => { ... }
2.  Reduce duplication with a helper that builds a palette from primary colors:
    const buildPalette = (mode: "light" | "dark", primary: SimplePaletteColorOptions):
    PaletteOptions => ({
    mode,
    primary,
    secondary: { main: "#c6ff00", light: "#fdff58", dark: "#90cc00", contrastText: "#000" },
    error: red,
    });
3.  Add JSDoc (German) to the exported function
4.  Rename file from customTheme.class.ts to customTheme.ts (no longer a class)
5.  Update import in App.tsx

---

Part 4: privacyPolicy.tsx Refactoring

File: src/components/App/privacyPolicy.tsx (305 lines)

Issues Found

1.  Default export (export default PrivacyPolicyPage) — violates convention
2.  No JSDoc on PrivacyPolicyPage or PrivacyPolicyText
3.  Inline style={{}} on Card (line 63) — should use MUI sx prop
4.  React.Fragment longhand — use <> shorthand
5.  Unused import: useNavigate imported but navigate used only for an internal link (line

285)  — could use <Link component={RouterLink}> instead

6.  Banner comments — remove heavy ASCII art
7.  Outdated content: Section 8 mentions "Google Firebase" — the app is migrated to Supabase
8.  Outdated content: Section 7 mentions "Google Analytics" — Firebase Analytics class is
    empty/commented out, unclear if GA is still active
9.  Commented-out JSX (lines 290-298) — dead code, remove

Plan

1.  Named export only: export {PrivacyPolicyPage} (remove default export)
2.  Add JSDoc to both components
3.  Replace style={{}} with sx on Card
4.  Use <> shorthand instead of React.Fragment
5.  Remove commented-out code (lines 290-298)
6.  Remove banner comments, replace with concise headers
7.  Update routeConfig.ts import (currently uses default import)
8.  Update Section 7 — Replace Google Analytics with Umami Analytics (confirmed text):
    ▎ Nutzung von Umami Analytics
    ▎ Die Webapp chuchipirat verwendet Umami, eine datenschutzfreundliche Webanalyse-Lösung.
    Umami wird auf eigenen Servern von Hetzner in der EU (Deutschland) betrieben. Es werden
    keine Cookies gesetzt und keine personenbezogenen Daten an Dritte übermittelt. Die
    erhobenen Daten dienen ausschliesslich der anonymen Nutzungsanalyse.
9.  Update Section 8 — Replace Google Firebase with Supabase (confirmed text):
    ▎ Nutzung von Supabase
    ▎ Die Webapp chuchipirat verwendet Supabase für Datenbanken und Authentifizierung. Die
    Daten werden auf Servern von Hetzner in der EU (Deutschland) gespeichert. Weitere
    Informationen findest du in der Datenschutzerklärung von Supabase
    (https://supabase.com/privacy).
10. Update "Stand" date from "1. März 2024" to current date (content changed)

---

Part 5: termOfUse.tsx Refactoring

File: src/components/App/termOfUse.tsx (126 lines)

Issues Found

1.  Default export — violates convention
2.  No JSDoc on either component
3.  Inline style={{}} on Card (line 26) — should use sx
4.  React.Fragment longhand — use shorthand
5.  Nested <Typography> inside <Typography> (lines 43-77) — semantically wrong (<p> inside
<p> is invalid HTML), causes React hydration warnings
6.  Excessive <br /> tags (lines 50, 55, 65, etc.) — use sx={{ mb: 2 }} for spacing (MUI
    best practice)
7.  Banner comments — remove
8.  Wrong section comment (line 37): Says "Datenschutzerklärung" but this is Terms of Use

Plan

1.  Named export only: export {TermOfUsePage} (remove default export)
2.  Add JSDoc to both components
3.  Fix invalid HTML: Replace nested <Typography> with proper structure — each paragraph
    gets its own <Typography paragraph> or <Typography sx={{ mb: 2 }}>
4.  Replace <br /> spacing with sx={{ mb: 2 }} on Typography elements
5.  Replace style={{}} with sx on Card
6.  Use <> shorthand
7.  Fix wrong comment ("Datenschutzerklärung" → "Nutzungsbedingungen")
8.  Remove banner comments
9.  Update routeConfig.ts import

UX Suggestion

▎ The Terms of Use page uses a flat structure with bold headings inside Typography.
Consider using <CardHeader> sub-sections or <Typography variant="h6"> for the two main
sections ("Kostenhinweis" and "Haftungsausschluss") to improve scannability. Currently both
sections blend into one wall of text.

---

Part 6: Unit Tests

Test framework: Jest + @testing-library/react + @testing-library/jest-dom
Location: src/components/App/**tests**/
Current state: Only a dummy test (App.test.jsx with expect(true).toBeTruthy())

Test files to create

1.  **tests**/App.test.tsx (replace dummy)

Test the App shell component:

- Renders without crashing (smoke test with all providers mocked)
- Theme: uses dark theme when prefers-color-scheme: dark matches
- Theme: uses light theme when it doesn't match
- Registers beforeunload event listener on mount
- Cleans up beforeunload listener on unmount
- Calls SessionStorageHandler.clearAll() when beforeunload fires

2.  **tests**/routeConfig.test.ts

Test the pure logic (no React rendering needed):

- All routes have a valid path starting with /
- All routes have a component defined
- Guard functions: isAuthenticated returns true/false correctly
- Guard functions: isAdmin checks Role.admin
- Guard functions: isAdminOrCommunityLeader checks both roles
- Guard functions: isCommunityLeader checks Role.communityLeader
- Guard functions: all return false for null authUser
- Every route with guard uses one of the known guard functions
- No duplicate paths in config
- emailVerificationOnly routes have no guard and vice versa

3.  **tests**/AppLayout.test.tsx

Test conditional layout rendering:

- matchesPath: exact match works
- matchesPath: prefix match with / works
- matchesPath: parameter route matching works (:id)
- ConditionalGoBackFab: renders GoBackFab on matching path + mobile viewport
- ConditionalGoBackFab: renders nothing on desktop viewport
- ConditionalGoBackFab: renders nothing on non-matching path
- ConditionalFeedbackFab: renders on matching path
- ConditionalFeedbackFab: renders nothing on non-matching path
- ConditionalFooter: renders on matching path
- ConditionalFooter: renders nothing on non-matching path

4.  **tests**/AppRoutes.test.tsx

Test route rendering:

- Public routes render without guards (e.g., /signin)
- Guarded routes apply GuardedRoute wrapper
- emailVerificationOnly routes apply EmailVerificationGuard only
- Catch-all renders NotFoundPage

5.  **tests**/FeedbackFab.test.tsx

- Renders a Fab with id="custom-feedback-button"
- Has aria-label="Feedback geben"
- Uses secondary color
- Uses small size

6.  **tests**/customTheme.test.ts

Test the pure function (no React needed):

- Returns light mode palette when prefersDarkMode is false
- Returns dark mode palette when prefersDarkMode is true
- Palette includes primary, secondary, error
- Test environment returns purple theme
- Dev/prod environment returns cyan theme

7.  **tests**/privacyPolicy.test.tsx

- PrivacyPolicyPage: Renders title and card
- PrivacyPolicyText: Renders all 10 sections
- PrivacyPolicyText: Contains email link to hallo@chuchipirat.ch
- PrivacyPolicyText: Contains "Stand: 1. März 2024"

8.  **tests**/termOfUse.test.tsx

- TermOfUsePage: Renders title and card
- TermOfUseText: Renders "Kostenhinweis" section
- TermOfUseText: Renders "Haftungsausschluss" section
- TermOfUseText: Contains "Stand, 1. März 2024"

---

Files to Create/Modify

┌──────────────────────────────────────────────────────┬───────────────────────────────┐
│ File │ Action │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/App.tsx │ Add missing import │
│ │ "./App.css" │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ │ Rename cornerRibon → │
│ src/components/App/App.css │ cornerRibbon, add CSS vars, │
│ │ remove dead code │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/customTheme.class.ts → │ Convert to function, named │
│ customTheme.ts │ export, add JSDoc │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/privacyPolicy.tsx │ Named export, JSDoc, sx, │
│ │ remove dead code │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/termOfUse.tsx │ Named export, JSDoc, fix │
│ │ nested <Typography>, sx │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/routeConfig.ts │ Update imports for │
│ │ privacyPolicy + termOfUse │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/Navigation/navigation.tsx │ cornerRibon → cornerRibbon │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/Shared/pageTitle.tsx │ cornerRibon → cornerRibbon │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/App.test.tsx │ Rewrite — real tests │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/routeConfig.test.ts │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/AppLayout.test.tsx │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/AppRoutes.test.tsx │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/FeedbackFab.test.tsx │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/customTheme.test.ts │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/privacyPolicy.test.tsx │ New │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ src/components/App/**tests**/termOfUse.test.tsx │ New │
└──────────────────────────────────────────────────────┴───────────────────────────────┘

---

Commit Strategy

1.  refactor(app): restore App.css import, clean up CSS, fix cornerRibon typo
2.  refactor(app): convert customTheme to function, named export
3.  refactor(app): modernize privacyPolicy — named export, sx, update legal text
4.  refactor(app): modernize termOfUse — fix nested Typography, named export
5.  test(app): add unit tests for App folder

→ Final squash into: Supabase Migration Phase 16.1: Refactor App supporting files + unit
tests

---

Verification

1.  npx tsc --noEmit — no new type errors
2.  npx jest --testPathPattern="src/components/App" — all new tests pass
3.  npx vite build — build succeeds
4.  Manual browser check:

- Ribbons display correctly on recipe cards and navigation
- Corner tapes display on recipe edit page
- Quill editor dark/light mode works
- Drag-drop indicators show correct colors
- Privacy policy page renders all sections
- Terms of use page renders without nested <p> warnings
- Theme switching (dark/light) works

---

    Plan: Refactor AuthServiceHandler — Full Cleanup, Security & Unit Tests

Context

The src/components/AuthServiceHandler/ folder handles auth flows (email verification,
password reset, email change, legacy email recovery). The code is functional and
well-tested (100% component coverage), but has accumulated debt: default exports,
console.log instead of Sentry, a qs dependency only used here, a Firebase Analytics
remnant, timer memory leaks, an as any cast, banner comments, and a text constant typo.

This refactoring brings all 6 components + 6 test files up to current conventions, fixes UX
issues (hardcoded strings, missing loading indicators, improper link semantics), and
improves security (fresh login after password reset).

---

Part 1: Fix Text Constant Typo (HANLDER → HANDLER)

Why: AUTH_SERVICE_HANLDER_NO_MODE is misspelled in 3 constants in text.ts. Referenced in
authServiceHandler.tsx (3x) and authServiceHandler.test.tsx (13x).

┌─────────────────────────────────────────────────────────────────────────┬─────────────┐
│ File │ Change │
├─────────────────────────────────────────────────────────────────────────┼─────────────┤
│ │ Rename 3 │
│ src/constants/text.ts │ constants: │
│ │ _HANLDER_ → │
│ │ _HANDLER_ │
├─────────────────────────────────────────────────────────────────────────┼─────────────┤
│ src/components/AuthServiceHandler/authServiceHandler.tsx │ Update 3 │
│ │ references │
├─────────────────────────────────────────────────────────────────────────┼─────────────┤
│ src/components/AuthServiceHandler/**tests**/authServiceHandler.test.tsx │ Update 13 │
│ │ references │
└─────────────────────────────────────────────────────────────────────────┴─────────────┘

---

Part 2: Replace qs with Native URLSearchParams

Why: qs is imported only in authServiceHandler.tsx for simple mode/oobCode parsing.
URLSearchParams handles this identically and is built-in.

File: src/components/AuthServiceHandler/authServiceHandler.tsx
Change: Remove import qs from "qs", replace qs.parse() block (lines 104-112) with new
URLSearchParams(search)
────────────────────────────────────────
File: package.json
Change: Remove qs from dependencies, remove @types/qs from devDependencies (if present)

After: run npm install to sync lockfile.

---

Part 3: Convert Default Exports → Named Exports

Why: Project convention requires named exports only.

Source files (6 files — same pattern each):

- Add export to const XxxPage declaration
- Remove export default XxxPage at bottom
- Update internal imports within authServiceHandler.tsx (lines 7-10): import
  {VerifyEmailPage} from "./verifyEmail" etc.
- Update JSX in authServiceHandler.tsx to use new names

Consumer:

- src/components/App/routeConfig.ts line 11: change to
  import("../AuthServiceHandler/authServiceHandler").then(m => ({default:
  m.AuthServiceHandlerPage})) (lazy import pattern consistent with privacyPolicy/termOfUse)

Test files (6 files — update imports and mocks):

- Change import XxxPage from "../xxx" → import {XxxPage} from "../xxx"
- Change mock patterns from { \_\_esModule: true, default: () => ... } → { XxxPage: () => ...
  }

---

Part 4: Replace console.log/warn/error with Sentry (7 occurrences)

Why: CLAUDE.md anti-pattern — errors must be logged via Sentry, not console.

┌────────────────────────┬──────────┬──────────────────────────────────────────────────┐
│ File │ Lines │ Change │
├────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ verifyEmail.tsx │ 70, 80, │ console.warn(...) → Sentry.captureException(err) │
│ │ 92 │ │
├────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ confirmEmailChange.tsx │ 82 │ console.error(...) → │
│ │ │ Sentry.captureException(err) │
├────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ passwordReset.tsx │ 145 │ console.error(error) → │
│ │ │ Sentry.captureException(error) │
├────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ resetPassword.tsx │ 108 │ console.error(...) → │
│ │ │ Sentry.captureException(err) │
├────────────────────────┼──────────┼──────────────────────────────────────────────────┤
│ recoverEmail.tsx │ 78 │ console.error(error) → │
│ │ │ Sentry.captureException(error) │
└────────────────────────┴──────────┴──────────────────────────────────────────────────┘

Each file: add import \* as Sentry from "@sentry/react".

Test updates: Tests that spy on console.warn/console.error → mock @sentry/react and assert
Sentry.captureException was called.

---

Part 5: Fix Timer Memory Leaks

Why: verifyEmail.tsx and confirmEmailChange.tsx call setTimeout in useEffect without
returning a cleanup function. If the component unmounts mid-countdown, the callback fires
on an unmounted component.

verifyEmail.tsx (lines 104-110):
React.useEffect(() => {
if (timer === 0) {
const timeout = setTimeout(() => navigate(ROUTES.HOME), 500);
return () => clearTimeout(timeout);
}
const timeout = setTimeout(() => setTimer(timer - 1), 1000);
return () => clearTimeout(timeout);
}, [timer, navigate]);

confirmEmailChange.tsx (lines 95-103) — same pattern with done guard.

Note: resetPassword.tsx already has proper cleanup (line 96) — no change needed.

---

Part 6: Remove Firebase Analytics from confirmEmailChange.tsx

Why: Firebase Analytics is migration debt. The logEvent call is the only reason
useFirebase() is imported here.

┌───────────────────────────────────────────────────────────────────┬─────────┐
│ Remove │ Line(s) │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ import FirebaseAnalyticEvent from "../../constants/firebaseEvent" │ 17 │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ import {useFirebase} from "../Firebase/firebaseContext" │ 19 │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ import {logEvent} from "firebase/analytics" │ 20 │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ const firebase = useFirebase() │ 47 │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ logEvent(firebase.analytics, ...) │ 77 │
├───────────────────────────────────────────────────────────────────┼─────────┤
│ firebase from useEffect deps │ 92 │
└───────────────────────────────────────────────────────────────────┴─────────┘

Test update (confirmEmailChange.test.tsx):

- Remove FirebaseContext.Provider from render wrapper
- Remove mockFirebase/mockAnalytics declarations
- Remove Firebase-related mock and assertion

---

Part 7: Fix as any Cast in verifyEmail.tsx

Why: Line 68 uses as any to pass an object as AuthUser. insertFeed expects AuthUser
instance.

Fix: Construct proper AuthUser:
const feedAuthUser = new AuthUser();
feedAuthUser.uid = user.id;
feedAuthUser.publicProfile = {
displayName: userDomain.displayName,
motto: "",
pictureSrc: userDomain.pictureSrc ?? "",
};

Replace the as any inline object with feedAuthUser.

---

Part 8: Cosmetic Cleanup

All 6 source files:

- Replace <React.Fragment> / </React.Fragment> → <> / </>
- Remove banner comment blocks (/_ === ... _/ ASCII art)
- Add missing JSDoc to updateLocalStorage() in recoverEmail.tsx (line 87)

---

Part 9: Extract Hardcoded "Einen Moment..." String

Why: confirmEmailChange.tsx (line 133) and resetPassword.tsx (line 141) use a hardcoded
German string "Einen Moment...". All other user-facing text comes from text.ts. This
violates the established pattern and makes the string harder to find/update.

┌─────────────────────────────┬─────────────────────────────────────────────────────────┐
│ File │ Change │
├─────────────────────────────┼─────────────────────────────────────────────────────────┤
│ src/constants/text.ts │ Add export const PLEASE_WAIT = "Einen Moment..."; │
├─────────────────────────────┼─────────────────────────────────────────────────────────┤
│ confirmEmailChange.tsx │ Replace hardcoded string with TEXT_PLEASE_WAIT import │
├─────────────────────────────┼─────────────────────────────────────────────────────────┤
│ resetPassword.tsx │ Replace hardcoded string with TEXT_PLEASE_WAIT import │
├─────────────────────────────┼─────────────────────────────────────────────────────────┤
│ confirmEmailChange.test.tsx │ Import and use the constant instead of hardcoded string │
│ │ in assertions │
├─────────────────────────────┼─────────────────────────────────────────────────────────┤
│ resetPassword.test.tsx │ Import and use the constant instead of hardcoded string │
│ │ in assertions │
└─────────────────────────────┴─────────────────────────────────────────────────────────┘

---

Part 10: Add Loading Spinner While Waiting for Session

Why: confirmEmailChange.tsx and resetPassword.tsx show static "Einen Moment..." text while
waiting for the Supabase session to establish. Users don't know if the page is working or
broken. A CircularProgress spinner (already used in passwordReset.tsx) gives clear visual
feedback.

confirmEmailChange.tsx — loading state block (currently lines 131-134):
<Alert severity="info">
<AlertTitle>{TEXT_EMAIL_CHANGE_CONFIRMED_TITLE}</AlertTitle>
<Typography sx={{display: "flex", alignItems: "center", gap: 1}}>
<CircularProgress size={16} />
{TEXT_PLEASE_WAIT}
</Typography>
</Alert>

resetPassword.tsx — waiting state block (currently lines 138-143):
<Alert severity="info">
<AlertTitle>{TEXT_PASSWORD_RESET}</AlertTitle>
<Typography sx={{display: "flex", alignItems: "center", gap: 1}}>
<CircularProgress size={16} />
{TEXT_PLEASE_WAIT}
</Typography>
</Alert>

Add CircularProgress import to both files.

Test updates: Tests that check for "Einen Moment..." text still pass (text is still
rendered, just with a spinner next to it).

---

Part 11: Fix Link Semantics in recoverEmail.tsx

Why: Line 115 uses <Link onClick={() => navigate(ROUTE_SIGN_IN)}> — this renders as a
<button> element, so right-click → "Open in new tab" doesn't work. Proper link semantics
improve accessibility and UX.

Fix:
import {Link as RouterLink} from "react-router";

// Replace:

 <Link onClick={() => navigate(ROUTE_SIGN_IN)}>{TEXT_SIGN_IN}</Link>

// With:

 <Link component={RouterLink} to={ROUTE_SIGN_IN}>{TEXT_SIGN_IN}</Link>

This also removes the need for useNavigate() in this component (check if navigate is used
elsewhere — no, it's only used here). Remove const navigate = useNavigate() and the
useNavigate import.

---

Part 12: Add Loading State to recoverEmail.tsx

Why: When checkActionCode + applyActionCode are running (lines 66-81), the page shows
nothing — just the title and an empty container. Users see a blank page until either error
or success appears. This is confusing.

Fix: Add an isLoading state:
const [isLoading, setIsLoading] = React.useState(true);

Set setIsLoading(false) in both the success path (line 75, before setIsRecovered(true)) and
error path (line 79, before setError(error)). Also add a guard for "no actionCode" (line
63: set setIsLoading(false) before return).

Render loading state:
{isLoading && !error && !isRecovered && (
<Alert severity="info">
<AlertTitle>{TEXT_PLEASE_WAIT}</AlertTitle>
<CircularProgress size={16} />
</Alert>
)}

Add CircularProgress to the MUI imports.

Test updates: Update recoverEmail.test.tsx — existing tests may need to wait for loading
state to resolve via waitFor.

---

Part 13: Redirect to Sign-In After Password Reset (resetPassword.tsx)

Why: After a successful password change, resetPassword.tsx redirects to HOME (line 93,
131). The user is already logged in via the recovery session, but from a security
perspective, a fresh login after changing the password confirms the new credentials work
and is standard practice.

Fix:

- Line 93: Change navigate(ROUTES.HOME) → navigate(ROUTES.SIGN_IN)
- Line 131: Change navigate(ROUTES.HOME) → navigate(ROUTES.SIGN_IN)
- Update text constant reference: TEXT_PASSWORD_RESET_GO_TO_HOME → rename or create
  TEXT_PASSWORD_RESET_GO_TO_SIGN_IN

Check text.ts for the existing constant:

- PASSWORD_RESET_GO_TO_HOME — need to add a new constant or rename it

┌────────────────────────┬──────────────────────────────────────────────────────────────┐
│ File │ Change │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ src/constants/text.ts │ Add export const PASSWORD_RESET_GO_TO_SIGN_IN = "Direkt zur │
│ │ Anmeldung"; │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ resetPassword.tsx │ Replace ROUTES.HOME with ROUTES.SIGN_IN (2 places), use new │
│ │ text constant │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ resetPassword.test.tsx │ Update redirect assertion (expect /signin instead of /home) │
└────────────────────────┴──────────────────────────────────────────────────────────────┘

---

Files Summary

┌────────────────────────┬──────────────────────────────────────────────────────────────┐
│ File │ Changes │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ src/constants/text.ts │ Fix 3 typos (HANLDER → HANDLER), add PLEASE_WAIT, add │
│ │ PASSWORD_RESET_GO_TO_SIGN_IN │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ authServiceHandler.tsx │ Typo refs, remove qs, named export, <>, remove banners, │
│ │ update child imports │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ verifyEmail.tsx │ Named export, Sentry, timer cleanup, fix as any, <>, remove │
│ │ banners │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ confirmEmailChange.tsx │ Named export, Sentry, timer cleanup, remove Firebase │
│ │ Analytics, extract string, add spinner, <>, remove banners │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ passwordReset.tsx │ Named export, Sentry, extract string, add spinner, <>, │
│ │ remove banners │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ recoverEmail.tsx │ Named export, Sentry, add JSDoc, fix link semantics, add │
│ │ loading state, <>, remove banners │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ resetPassword.tsx │ Named export, Sentry, redirect to sign-in, <>, remove │
│ │ banners │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ routeConfig.ts │ Update lazy import (default → named) │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ package.json │ Remove qs + @types/qs │
├────────────────────────┼──────────────────────────────────────────────────────────────┤
│ All 6 test files │ Update imports, mock patterns, Sentry mocks, remove Firebase │
│ │ mocks, update assertions for new UX │
└────────────────────────┴──────────────────────────────────────────────────────────────┘

---

NOT in Scope

- InputProps → slotProps migration (codebase-wide debt, tracked separately)
- Removing recoverEmail.tsx (still needed for legacy Firebase links)
- Restructuring component hierarchy (already clean)
- Changing the reducer pattern in passwordReset.tsx (already well-structured)

---

Verification

1.  npx tsc --noEmit — no new type errors (17 pre-existing, 0 from our changes)
2.  npx jest --testPathPatterns="src/components/AuthServiceHandler" --no-coverage — all 6
    test files pass
3.  npx jest --no-coverage — full suite, no regressions (1 pre-existing failure in
    system.test.tsx)
4.  Manual browser check:

- Password reset flow (request → email → reset form → success)
- Email verification after signup
- Error page for expired/invalid links
- Error page for unknown URLs

---

Plan: Refactor Department Folder — Conventions, Performance, UX & Tests

Context

The src/components/Department/ folder manages shopping departments (masterdata). The code
is functional and already migrated to Supabase, but has accumulated debt: default exports,
console.error instead of Sentry, banner comments, a legacy Firebase class still imported as
a type, missing cancel/snapshot for edit mode, no changed-key tracking (saves ALL
departments even if only 1 changed), and missing tests for 2 of 4 components.

This refactoring brings all files up to current conventions (matching the
already-refactored Units and AuthServiceHandler pages), improves performance, adds UX
improvements, and fills test coverage gaps.

---

Part 1: Convention Cleanup on departments.tsx

Why: Align with project conventions (named exports, Sentry, no banners, <>, German JSDoc).

┌────────────────┬─────────────────────────────────────────────────────────────────────┐
│ Change │ Detail │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Named export │ export default DepartmentsPage → export const DepartmentsPage │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Sentry │ Line 345: console.error(error) → Sentry.captureException(error) + │
│ │ add import │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Banner │ Remove all /_ === ... _/ and /_ --- ... _/ section dividers │
│ comments │ │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Fragment │ <React.Fragment> → <> (line 452/532). Keep keyed <React.Fragment │
│ shorthand │ key={...}> in map (line 583) │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Spacing │ Line 507: Replace <br /> with sx={{mt: 2}} on the Grid item │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ Typo │ TABLE_COLUMS → TABLE_COLUMNS (line 283, 626) │
├────────────────┼─────────────────────────────────────────────────────────────────────┤
│ JSDoc │ Add/fix German JSDoc on all handler functions missing it │
└────────────────┴─────────────────────────────────────────────────────────────────────┘

Consumers to update:

- routeConfig.ts line 22: lazy(() => import("../Department/departments")) → .then(m =>
  ({default: m.DepartmentsPage})) pattern

Files: departments.tsx, routeConfig.ts

---

Part 2: Performance — Changed-Key Tracking + Snapshot/Cancel

Why: Currently onSave() sends ALL departments to the DB, even if only 1 was renamed. The
Units page already solves this with changedKeys: Set<string>. Also, there's no way to
cancel edits — unlike the Units page which has a Cancel button + snapshot restore.

Changes to departments.tsx:

1.  Add to State type: changedKeys: Set<string> with initial value new Set<string>()
2.  Add snapshot ref: const departmentsSnapshot = React.useRef<DepartmentDomain[]>([])
3.  New reducer action: EDIT_CANCELLED — restores snapshot, clears changedKeys
4.  Modify existing actions:

- DEPARTMENT_ON_CHANGE — also adds uid to changedKeys
- SET_NEW_POSITION_FOR_DEPARTMENT — marks ALL uids as changed (reorder affects all)
- DEPARTMENTS_SAVED — resets changedKeys
- NEW_DEPARTMENT_CREATED — resets changedKeys
- DEPARTMENTS_FETCH_SUCCESS — resets changedKeys

5.  Split toggleEditMode into two functions:

- onEditClick() — stores snapshot, sets edit mode true
- onCancelEdit() — dispatches EDIT_CANCELLED with snapshot, sets edit mode false

6.  Refactor onSave: Filter by changedKeys before calling saveAllDepartments. Skip DB call
    if nothing changed.
7.  Add Cancel button to ButtonRow (between Save and Add):
    { id: "cancel", visible: editMode, label: TEXT_CANCEL, variant: "outlined", onClick:
    onCancelEdit }
8.  Import CANCEL as TEXT_CANCEL from text constants.

Reference: src/components/Unit/units.tsx lines 121-132 (state), 383-397 (snapshot/cancel),
363-366 (save filter)

---

Part 3: Convention + UX Fixes on dialogDepartment.tsx

Why: Default export, banner comments, form state not reset on reopen after failed
validation, no duplicate name check.

Change: Named export
Detail: export default DialogDepartment → export const DialogDepartment
────────────────────────────────────────
Change: Banner comments
Detail: Remove all section dividers
────────────────────────────────────────
Change: JSDoc
Detail: Add German JSDoc to DialogDepartmentProps, DialogDepartment,
DEPARTMENT_INITIAL_STATE
────────────────────────────────────────
Change: Validation reset
Detail: Add useEffect on dialogOpen to reset formFields and validation when dialog opens
────────────────────────────────────────
Change: Import fix
Detail: AuthUser import already uses named import — verify and keep
────────────────────────────────────────
Change: Duplicate name check
Detail: Add existingNames: string[] prop. In onOkClick, check if formFields.name.trim()
already exists (case-insensitive) and show a validation error if so. Parent passes
state.departments.map(d => d.name). Add new text constant:
ERROR_DEPARTMENT_WITH_THIS_NAME_ALREADY_EXISTS (pattern: text.ts lines 537-539)

Consumers to update:

- departments.tsx line 58: import DialogDepartment from "./dialogDepartment" → import
  {DialogDepartment} from "./dialogDepartment"
- departments.tsx: Pass existingNames={state.departments.map(d => d.name)} to
  <DialogDepartment>

---

Part 4: Type Migration on departmentAutocomplete.tsx

Why: Imports Department class but only uses it as a shape. DepartmentDomain interface (from
Repository) is identical and avoids the legacy class dependency.

┌───────────┬──────────────────────────────────────────────────────────────────────────┐
│ Change │ Detail │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ Type │ import Department from "./department.class" → import {DepartmentDomain} │
│ import │ from "../Database/Repository/DepartmentRepository" │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ Type refs │ All Department → DepartmentDomain in props and callback signatures │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ Named │ export default DepartmentAutocomplete → export const │
│ export │ DepartmentAutocomplete │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ Banner │ Remove line 30 │
│ comment │ │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ JSDoc │ Replace incomplete @param param0 / @returns with proper German docs │
├───────────┼──────────────────────────────────────────────────────────────────────────┤
│ Unsafe │ Line 67: event as unknown as React.ChangeEvent<HTMLInputElement> — track │
│ cast │ as tech debt (fixing changes public API, affects 2 consumers) │
└───────────┴──────────────────────────────────────────────────────────────────────────┘

Consumers to update (minimal — just import style):

- dialogProduct.tsx line 65: import DepartmentAutocomplete from "..." → import
  {DepartmentAutocomplete} from "..."
- convertItem.tsx line 26: same change
- Both files already use Department class type for the autocomplete values — these stay
  as-is (out of scope, type-compatible)

---

Part 5: Update Mock File and Existing Tests

**mocks**/departments.mock.ts:

- Replace import Department from "../department.class" → import {DepartmentDomain} from
  "../../Database/Repository/DepartmentRepository"
- Change type Department[] → DepartmentDomain[]
- Named export only (remove export default)

**tests**/departments.test.tsx:

- Update import: import DepartmentsPage from "../departments" → import {DepartmentsPage}
  from "../departments"
- Add Sentry mock: jest.mock("@sentry/react", () => ({ captureException: jest.fn() }))
- Remove banner comments
- Add test for Cancel button (Part 2): enter edit mode → change name → cancel → verify
  original restored
- Add test for changed-key filtering: change 1 dept → save → verify saveAllDepartments
  called with only 1 dept

---

Part 6: New Unit Tests

**tests**/dialogDepartment.test.tsx

┌────────────────────────────┬─────────────────────────────────────────────────────────┐
│ Test │ Description │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Renders when open │ Dialog title + input field visible │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Not rendered when closed │ dialogOpen: false → no dialog content │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Validation error on empty │ Click create → error text shown │
│ name │ │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Duplicate name blocked │ Enter existing name → error "Abteilung existiert │
│ │ bereits" shown │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Validation clears on │ Submit empty → close → reopen → no error │
│ reopen │ │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Successful create │ Mock createDepartment → handleCreate called with │
│ │ correct shape │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Error on create │ Mock rejection → handleError called │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Cancel calls handleClose │ Click cancel → handleClose invoked │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│ Form resets on reopen │ Create dept → close → reopen → name field empty │
└────────────────────────────┴─────────────────────────────────────────────────────────┘

Mock setup: DatabaseContext.Provider with mock departments.createDepartment. No
MemoryRouter needed (Dialog doesn't use routing).

**tests**/departmentAutocomplete.test.tsx

┌──────────────────┬───────────────────────────────────────────────────────────────────┐
│ Test │ Description │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ Default label │ Renders with "Abteilung" label │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ Shows selected │ Passed department appears in input │
│ value │ │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ Options in │ All departments listed │
│ dropdown │ │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ onChange │ Select option → onChange called with new value │
│ callback │ │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ Disabled state │ disabled=true → input disabled + helper text "Artikel kann nicht │
│ │ geändert werden" │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ Error state │ error.isError=true → error text shown │
├──────────────────┼───────────────────────────────────────────────────────────────────┤
│ No options text │ Empty array → "Keine Optionen" shown │
└──────────────────┴───────────────────────────────────────────────────────────────────┘

Mock setup: No providers needed — pure presentational component.

---

Part 7: UX — Usable Toggle in Edit Mode

Why: The usable field exists on DepartmentDomain but is not editable in the UI. Departments
can only be added and renamed — never deactivated. If a department is no longer needed
(e.g., a store reorganizes), there's no way to hide it from dropdowns without deleting
data.

Changes to departments.tsx:

1.  Add a Switch/Checkbox column in edit mode — In the DepartmentTable edit-mode Grid, add a
    third column with a Switch (MUI) for each department's usable field.
2.  Update DEPARTMENT*ON_CHANGE handler — The existing onChangeField handler already
    supports arbitrary field names via event.target.id.split("*"). Add the switch's onChange to
    dispatch with field: "usable" and the boolean value. This requires a small handler since
    Switch gives a checked not value:
    const onToggleUsable = (departmentUid: string, checked: boolean) => {
    dispatch({
    type: ReducerActions.DEPARTMENT_ON_CHANGE,
    payload: {field: "usable", key: departmentUid, value: checked},
    });
    };
3.  Note: The reducer's DEPARTMENT_ON_CHANGE uses [action.payload.field]:
    action.payload.value — the payload value type needs to be widened from string to string |
    boolean.
4.  Add column header — "Aktiv" label above the switches.
5.  Mark as changed — The changedKeys tracking from Part 2 will automatically pick this up.
6.  Add text constant to text.ts: export const ACTIVE = "Aktiv"; (doesn't exist yet). Also
    add to departments.tsx text imports.

Files: departments.tsx

---

Part 8: UX — Unsaved Changes Warning

Why: In edit mode, navigating away (browser back, clicking another menu item) loses all
changes silently. The Cancel button (Part 2) helps for intentional cancellation, but
accidental navigation is still a risk.

Changes to departments.tsx:

1.  Add beforeunload listener when in edit mode with unsaved changes:
    React.useEffect(() => {
    if (!editMode || state.changedKeys.size === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
    }, [editMode, state.changedKeys.size]);
1.  This shows the browser's native "Leave site?" dialog when closing/refreshing with
    unsaved changes.
1.  Note: React Router's useBlocker could also block in-app navigation, but this is a more
    invasive change and not used elsewhere in the codebase. The beforeunload approach matches
    App.tsx precedent and covers the most common case (browser close/refresh). In-app
    navigation blocking can be tracked as tech debt.

Files: departments.tsx

---

Part 9: Tech Debt Tracking

Add to docs/claude/tech-debt.md:

Under new category "Firebase Class Removal":

- src/components/Department/department.class.ts — Legacy Firebase class, shape identical to
  DepartmentDomain. Imported as type in ~20 files. Only product.class.ts calls a static
  method (Department.getAllDepartments()). Once Products migration is complete, delete class
  and replace all type imports with DepartmentDomain.
  Priorität: mittel · Komplexität: mittel (20+ files, mechanical find-and-replace)

Under "MUI Deprecated APIs" (existing):

- departmentAutocomplete.tsx line 67: Unsafe cast event as unknown as
  React.ChangeEvent<HTMLInputElement>. Fix requires changing the onChange prop type to
  React.SyntheticEvent and updating 2 consumers (dialogProduct.tsx, convertItem.tsx).
  Priorität: tief · Komplexität: klein

Under new category "Navigation Guards":

- In-app navigation blocking (react-router useBlocker) for pages with unsaved changes.
  Currently only beforeunload covers browser close/refresh. Affected pages: departments.tsx,
  units.tsx, and any other edit-mode pages.
  Priorität: tief · Komplexität: mittel

Under "Naming" (existing):

- dialogDepartment.tsx uses authUser prop typed as AuthUser (Firebase class). Works but
  misleading since the app now uses Supabase auth. All dialog components that accept authUser
  should use a shared Supabase-compatible type.
  Priorität: tief · Komplexität: mittel (codebase-wide, many dialogs)

---

NOT in Scope

- Modifying department.class.ts itself (still needed by ~20 files — tracked as tech debt)
- Migrating department.class.ts consumers to DepartmentDomain (codebase-wide — tracked as
  tech debt)
- Fixing the unsafe type cast in departmentAutocomplete.tsx (changes public API — tracked
  as tech debt)
- Modifying DepartmentRepository.ts (already well-implemented and tested)
- InputProps → slotProps migration (tracked separately)
- In-app navigation blocking via useBlocker (tracked as tech debt)

---

Files Summary

┌───────────────────────────────────────────┬───────────────────────────────────────────┐
│ File │ Changes │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ │ Named export, Sentry, banners, <>, │
│ departments.tsx │ spacing, typo fix, changedKeys, │
│ │ snapshot/cancel, usable toggle, │
│ │ beforeunload, JSDoc │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ │ Named export, banners, JSDoc, validation │
│ dialogDepartment.tsx │ reset, duplicate name check, │
│ │ existingNames prop │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ departmentAutocomplete.tsx │ Named export, Department → │
│ │ DepartmentDomain, banners, JSDoc │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ **mocks**/departments.mock.ts │ Type migration, named export │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ **tests**/departments.test.tsx │ Named import, Sentry mock, banners, new │
│ │ cancel/changedKeys/usable tests │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ **tests**/dialogDepartment.test.tsx │ NEW — 9 test cases │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ **tests**/departmentAutocomplete.test.tsx │ NEW — 7 test cases │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ routeConfig.ts │ Update lazy import for DepartmentsPage │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ dialogProduct.tsx │ Update import (default → named) │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ convertItem.tsx │ Update import (default → named) │
├───────────────────────────────────────────┼───────────────────────────────────────────┤
│ │ Add 4 entries (Firebase class removal, │
│ docs/claude/tech-debt.md │ unsafe cast, navigation guards, authUser │
│ │ typing) │
└───────────────────────────────────────────┴───────────────────────────────────────────┘

---

Execution Order

Part 1: Convention cleanup on departments.tsx
Part 2: Performance + Cancel/Snapshot on departments.tsx (depends on Part 1)
Part 3: Convention + UX on dialogDepartment.tsx
Part 4: Type migration on departmentAutocomplete.tsx
Part 5: Update mock + existing tests (depends on Parts 1, 2, 4)
Part 6: New tests for dialog + autocomplete (depends on Parts 3, 4)
Part 7: Usable toggle on departments.tsx (depends on Part 2)
Part 8: Unsaved changes warning on departments.tsx (depends on Part 2)
Part 9: Tech debt tracking (independent)

Parts 1+3+4 can run in parallel. Part 2 follows Part 1. Parts 7+8 follow Part 2. Parts 5+6
come after their dependencies. Part 9 is independent.

---

Verification

1.  npx tsc --noEmit — no new type errors
2.  npx jest --testPathPatterns="src/components/Department" --no-coverage — all test files
    pass
3.  npx jest --no-coverage — full suite, no regressions
4.  Manual browser check:

- Navigate to /departments
- Verify table loads with departments
- Enter edit mode → change a name → Cancel → verify original restored
- Enter edit mode → change a name → Save → verify snackbar + only changed dept sent
- Toggle "usable" switch in edit mode → Save → verify persisted
- Add new department via dialog → verify it appears
- Try adding dept with duplicate name → see validation error
- Open dialog → submit empty → see validation → close → reopen → validation cleared
- In edit mode with changes: refresh browser → see "Leave site?" prompt

---

Plan: Refactor Event Folder — Conventions, Performance, Security, UX & Tests

Context

The src/components/Event/ folder is the heart of Chuchipirat — managing events (camps) with
sub-features: Menuplan, ShoppingList, MaterialList, UsedRecipes, and GroupConfiguration.
It's 40,065 LOC across 97 files. The folder was partially refactored once but with outdated
guidelines. This refactoring brings it up to current conventions, fixes
security/observability issues, removes dead Firebase code, adds UX improvements, fills test
gaps, and tracks remaining debt.

CRITICAL CONSTRAINT: Do NOT change logic flow. If logic issues are found, add to
tech-debt.md.

Scope Decisions

- Console→Sentry: Replace ALL 41 console calls across 12 files
- Single-letter variables: Fix ALL 43 files
- Firebase cleanup: Remove dead imports/params (safe). Track 3 files with active Firebase
  calls (receipt operations + analytics) as tech debt
- UX improvements: Unified error snackbar, skeleton loading, PDF error boundary
- Execution: All phases in one session, commit after each phase

Key Findings

┌──────────────────────────────────────────┬──────────────────────────────────┬────────┐
│ Issue │ Count │ Action │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Default exports → named │ 35 files │ FIX │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ console.log/error → Sentry │ 41 calls / 12 files │ FIX │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Missing German JSDoc │ ~35 files │ FIX │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Single-letter callback variables │ 43 files │ FIX │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Banner comments (/_ === _/) │ ~10 files │ FIX │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Dead Firebase imports/params │ ~8 files │ REMOVE │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Missing test coverage │ ShoppingList, GroupConfig, + │ FIX │
│ │ others │ │
├──────────────────────────────────────────┼──────────────────────────────────┼────────┤
│ Active Firebase calls (receipt + │ 3 files │ TRACK │
│ analytics) │ │ │
└──────────────────────────────────────────┴──────────────────────────────────┴────────┘

Firebase Analysis

Dead code — safe to remove:

- shoppingList.tsx — useFirebase() already marked TODO by developer
- useMenuplanHandlers.tsx — firebase parameter accepted but never used
- dialogGoods.tsx — firebase prop accepted but never used
- createNewEvent.tsx — useFirebase() called, passed to children, but nobody uses it
- eventInfo.tsx — Firebase in prop interface but not used in file body (dead import)
- dialogEventQuickView.tsx — dead import
- menuplan.page.types.ts — Firebase in type signatures only

Still active — track as tech debt:

- event.tsx — firebase.analytics for event logging (legitimate Firebase Analytics)
- receipt.class.ts — Active Firestore reads/writes for receipts
- eventInfo.tsx — Calls Receipt.getReceipt({firebase, ...})

AuthUser imports — NO CHANGE NEEDED:

- AuthUser class is already Supabase-compatible (uses auth.users.id)
- All 27 files use it only as a type annotation — correct pattern, keep as-is

---

Phasing Strategy

Phase 0: Tech Debt Tracking + UX Infrastructure (documentation + new shared components)
Phase 1: UsedRecipes (8 files)
Phase 2: MaterialList (8 files)
Phase 3: GroupConfiguration (2 files + new tests)
Phase 4: Menuplan — Types, Services, Utilities (10 files)
Phase 5: Menuplan — Dialogs and UI Components (14 files)
Phase 6: Menuplan — Hooks/Page + ShoppingList (19 files + new tests)
Phase 7: Event/Event — Hub Module (18 files + new tests)
Phase 8: Final Verification

---

Phase 0: Tech Debt Tracking + UX Infrastructure

Goal: Document out-of-scope issues and create shared UX components before touching Event
files.

Tech Debt entries for docs/claude/tech-debt.md:

New category "Large Files / Component Splitting":

- event.tsx (2,365 LOC), useShoppingListHandlers.tsx (1,786), useMenuplanHandlers.tsx
  (1,535), shoppingList.tsx (1,329), dialogPlanPortions.tsx (1,301), groupConfiguration.tsx
  (1,017), materialList.tsx (1,006) — Priorität: tief · Komplexität: gross

Firebase Class Removal section (append):

- event.tsx — active firebase.analytics usage for event logging. Migrate to Supabase
  analytics or standalone Firebase Analytics import. Priorität: mittel · Komplexität: klein
- receipt.class.ts + eventInfo.tsx — active Firestore receipt read/write. Needs
  ReceiptRepository migration. Priorität: mittel · Komplexität: mittel

Type Safety section (new):

- any type in test files: eventUsedRecipes.test.tsx, usedRecipesPdf.test.tsx,
  menuplan.menucard.test.ts, menuplanPdf.test.tsx, eventInfo.test.tsx. Priorität: tief ·
  Komplexität: klein

New category "UX/UI Improvements":

- Drag-and-drop keyboard accessibility — useMenuplanDragDrop.ts implements mouse DnD but
  keyboard accessibility isn't evident. Add keyboard drag support for accessibility
  compliance. Priorität: mittel · Komplexität: mittel
- ShoppingList offline mode — During camp (mobile use), network can be unreliable. The
  ShoppingList could benefit from optimistic updates or local-first patterns. Priorität: tief
  · Komplexität: gross

UX Improvement 1: Unified PDF Error Handler

Why: PDF generation across 5+ files (shoppingListPdf, menuplanPdf, materialListPdf,
usedRecipesPdf, eventRecipePdf) uses the same .toBlob().then().catch() pattern with
inconsistent error handling. Some use console.error, some dispatch to reducer, some do
both.

Create: src/components/Shared/pdfUtils.ts
/\*\*

- Generiert ein PDF als Blob und speichert es als Datei.
-
- Zentralisiert die PDF-Generierung und Fehlerbehandlung, damit alle
- PDF-Exporte einheitlich funktionieren und Fehler via Sentry geloggt werden.
-
- @param pdfElement - Das React-Element für @react-pdf/renderer
- @param filename - Der Dateiname für den Download
- @param onError - Optionaler Callback für Fehlerbehandlung in der aufrufenden Komponente
  \*/
  export const generateAndDownloadPdf = async (
  pdfElement: React.ReactElement,
  filename: string,
  onError?: (error: Error) => void,
  ): Promise<void> => { ... }

* Uses pdf(element).toBlob() + fileSaver.saveAs()
* Wraps errors with Sentry.captureException(error)
* Calls onError callback if provided (for reducer dispatch)
* All PDF generation call sites updated to use this utility

UX Improvement 2: Skeleton Loading Components

Why: Pages currently use <Backdrop><CircularProgress /></Backdrop> which blocks the entire
UI. Skeleton loading shows the page structure while data loads, improving perceived
performance. The pattern already exists in EventCardLoading (eventCard.tsx lines 176-194).

Create: src/components/Shared/TableSkeleton.tsx
/\*\*

- Skeleton-Ladeindikator für Tabellen/Listen.
-
- Zeigt eine animierte Platzhalter-Tabelle an, während die echten Daten
- geladen werden. Ersetzt den blockierenden Backdrop/CircularProgress.
-
- @param rows - Anzahl der Platzhalter-Zeilen (Standard: 5)
- @param columns - Anzahl der Spalten (Standard: 3)
  \*/
  export const TableSkeleton = ({rows = 5, columns = 3}: TableSkeletonProps) => { ... }

* Uses MUI <Skeleton animation="wave" /> in a Card/Grid layout
* Matches the existing table structure of Department/Unit/Material pages
* Applied to: GroupConfiguration, MaterialList, ShoppingList pages (replacing Backdrop
  spinners for initial data load)

Note: Pages keep <Backdrop> for save/delete operations (blocking is correct there). Only
the initial data fetch uses skeleton.

UX Improvement 4: Unified Error Snackbar in Handlers

Why: useShoppingListHandlers.tsx has 13 error handling paths with inconsistent feedback.
Some errors show AlertMessage, some show snackbar, some only console.log. The pattern from
departments.tsx (reducer dispatches → snackbar) is cleaner.

Approach: When replacing console→Sentry in handler files, ensure each error path ALSO
dispatches to the reducer's GENERIC_ERROR action (which shows AlertMessage in UI). This is
already the pattern — we just need to verify no error paths are silently swallowed after
replacing console.error.

No new shared component needed — just consistency enforcement during the console→Sentry
migration in each phase.

Verification: npm run typecheck && npm run test (no production code changes in Phase 0,
only docs + new utility files)

---

Phase 1: UsedRecipes — Conventions + Firebase Cleanup (8 files, ~2,030 LOC)

Rationale: Smallest subfolder, fewest consumers, well-tested already.

┌─────────────────┬─────┬─────────────┬──────────┬──────┬─────┬─────────┬──────────────┐
│ File │ LOC │ Default→Nam │ Console→ │ Bann │ JSD │ Single- │ Firebase │
│ │ │ ed │ Sentry │ ers │ oc │ letter │ cleanup │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ usedRecipes.tsx │ 123 │ ✓ → UsedRec │ — │ ✓ │ ✓ │ check │ — │
│ │ │ ipesPage │ │ │ add │ │ │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ eventUsedRecipe │ 91 │ ✓ → EventUs │ — │ chec │ ✓ │ check │ — │
│ s.tsx │ │ edRecipes │ │ k │ add │ │ │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ eventUsedMealRe │ │ ✓ → │ │ chec │ ✓ │ │ │
│ cipe.tsx │ 376 │ EventUsedMe │ — │ k │ add │ ✓ fix │ — │
│ │ │ alRecipe │ │ │ │ │ │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ useUsedRecipesH │ 689 │ ✓ → named │ — │ ✓ │ ✓ │ ✓ fix │ — │
│ andlers.tsx │ │ │ │ │ add │ │ │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ │ │ │ │ │ │ │ Update to │
│ usedRecipesPdf. │ 253 │ ✓ → UsedRec │ — │ chec │ che │ ✓ fix │ use │
│ tsx │ │ ipesPdf │ │ k │ ck │ │ generateAndD │
│ │ │ │ │ │ │ │ ownloadPdf │
├─────────────────┼─────┼─────────────┼──────────┼──────┼─────┼─────────┼──────────────┤
│ usedRecipesRedu │ 124 │ already │ — │ chec │ ✓ │ check │ — │
│ cer.ts │ │ named │ │ k │ add │ │ │
└─────────────────┴─────┴─────────────┴──────────┴──────┴─────┴─────────┴──────────────┘

Test files to clean up: usedRecipesReducer.test.ts, usedRecipes.test.ts — remove banners,
fix single-letter vars

Consumer updates: event.tsx imports EventUsedRecipesPage — update import style

Verification: npm run typecheck && npx jest --testPathPatterns="UsedRecipes" --no-coverage

---

Phase 2: MaterialList — Conventions + Skeleton (8 files, ~2,973 LOC)

File: materialList.tsx
LOC: 1,006
Default→Named: ✓ → MaterialListPage
Console→Sentry: 1 call
Banners: ✓
JSDoc: ✓ add
Single-letter: ✓ fix
Other: Replace initial-load Backdrop with TableSkeleton
────────────────────────────────────────
File: useMaterialListHandlers.tsx
LOC: 1,002
Default→Named: ✓ → named
Console→Sentry: already Sentry
Banners: ✓
JSDoc: ✓ add
Single-letter: ✓ fix
Other: —
────────────────────────────────────────
File: materialList.class.ts
LOC: 544
Default→Named: already named
Console→Sentry: already Sentry
Banners: ✓
JSDoc: check
Single-letter: check
Other: —
────────────────────────────────────────
File: materialListAdapter.ts
LOC: 191
Default→Named: already named
Console→Sentry: —
Banners: ✓
JSDoc: ✓ add
Single-letter: check
Other: —
────────────────────────────────────────
File: materialListPdf.tsx
LOC: 211
Default→Named: ✓ → MaterialListPdf
Console→Sentry: —
Banners: ✓
JSDoc: ✓ add
Single-letter: check
Other: Update to use generateAndDownloadPdf
────────────────────────────────────────
File: materialListHighlightContext.ts
LOC: 19
Default→Named: ✓ → named
Console→Sentry: —
Banners: —
JSDoc: check
Single-letter: —
Other: —

Test files: materialList.class.test.ts, materialListAdapter.test.ts — remove banners, fix
single-letter vars

Consumer updates: event.tsx imports MaterialListPage — update import style

Verification: npm run typecheck && npx jest --testPathPatterns="materialList|MaterialList"
--no-coverage

---

Phase 3: GroupConfiguration — Conventions + New Tests + Skeleton (2 + consumers + 1 new
test file)

File: groupConfiguration.class.ts
LOC: 240
Default→Named: ✓ → named
Console→Sentry: —
Banners: ✓
JSDoc: ✓ add
Single-letter: check
Other: —
────────────────────────────────────────
File: groupConfiguration.tsx
LOC: 1,017
Default→Named: ✓ → GroupConfigurationPage
Console→Sentry: 1 call
Banners: ✓
JSDoc: ✓ add
Single-letter: ✓ fix
Other: Replace initial-load Backdrop with TableSkeleton

Consumer updates:

- recipe.view.tsx, recipe.edit.tsx, RecipeDrawer.tsx — import EventGroupConfiguration from
  ... → import {EventGroupConfiguration} from ...
- EventGroupConfigRepository.ts — verify import style
- event.tsx — update internal import

New test file: GroupConfiguration/**tests**/groupConfiguration.class.test.ts

- Test constructor defaults, addDietGroup, deleteDiet, addIntolerance, deleteIntolerance,
  calculateTotals, portion matrix

Verification: npm run typecheck && npx jest
--testPathPatterns="groupConfiguration|GroupConfiguration" --no-coverage

---

Phase 4: Menuplan — Types, Services, Utilities (10 files)

┌────────────────────────┬───────┬──────────────────────────────────────────────────────┐
│ File │ LOC │ Changes │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ menuplan.types.ts │ 395 │ Add German JSDoc to all exported types/interfaces │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ menuplan.page.types.ts │ 303 │ Add German JSDoc. Remove Firebase from type │
│ │ │ signatures (dead code) │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ menuplanService.ts │ 1,099 │ Remove banners, fix single-letter vars, 1 │
│ │ │ console→Sentry │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ menuplan.constants.tsx │ 219 │ Remove banners, verify JSDoc │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ menuplan.dragdrop.ts │ 121 │ Add German JSDoc on exported functions │
├────────────────────────┼───────┼──────────────────────────────────────────────────────┤
│ highlightContext.ts │ 21 │ Verify only │
└────────────────────────┴───────┴──────────────────────────────────────────────────────┘

Test files: menuplanService.test.ts (1,574 LOC), menuplan.constants.test.ts,
menuplanBridge.test.ts (876 LOC), dialogPlanPortions.test.ts — remove banners, fix
single-letter vars

Verification: npm run typecheck && npx jest --testPathPatterns="menuplan|Menuplan"
--no-coverage

---

Phase 5: Menuplan — Dialogs and UI Components (14+ files)

┌──────────────────────────┬─────┬────────────┬─────┬────────────┬───────────────────┐
│ File │ LOC │ Default→Na │ JSD │ Single-let │ Firebase cleanup │
│ │ │ med │ oc │ ter │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogEditMenue.tsx │ 313 │ check │ ✓ │ ✓ fix │ — │
│ │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogGoods.tsx │ 579 │ check │ ✓ │ ✓ fix │ Remove dead │
│ │ │ │ add │ │ firebase prop │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogMenuplanPdfOptions │ 151 │ ✓ → named │ ✓ │ check │ — │
│ .tsx │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogPlanPortions.tsx │ 1,3 │ ✓ → named │ ✓ │ ✓ fix │ — │
│ │ 01 │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogSelectMeals.tsx │ 184 │ check │ ✓ │ ✓ fix │ — │
│ │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ dialogSelectMenues.tsx │ 567 │ check │ ✓ │ ✓ fix │ — │
│ │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.headerRow.tsx │ 383 │ ✓ → named │ ✓ │ check │ — │
│ │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.mealTypeCard.ts │ 194 │ ✓ → named │ ✓ │ check │ — │
│ x │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.mealTypeRows.ts │ 682 │ check │ ✓ │ check │ — │
│ x │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.menucard.tsx │ 1,0 │ check │ ✓ │ ✓ fix │ — │
│ │ 66 │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.menucard.list.t │ 821 │ check │ ✓ │ ✓ fix │ — │
│ sx │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.emptycontainer. │ 90 │ check │ ✓ │ — │ — │
│ tsx │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ menuplan.recipeSearchDra │ 110 │ ✓ → named │ ✓ │ check │ — │
│ wer.tsx │ │ │ add │ │ │
├──────────────────────────┼─────┼────────────┼─────┼────────────┼───────────────────┤
│ │ │ │ ✓ │ │ Update to use │
│ menuplanPdf.tsx │ 812 │ ✓ → named │ add │ ✓ fix │ generateAndDownlo │
│ │ │ │ │ │ adPdf │
└──────────────────────────┴─────┴────────────┴─────┴────────────┴───────────────────┘

Test files: dialogGoods.test.tsx, dialogMenuplanPdfOptions.test.tsx,
menuplan.headerRow.test.tsx, menuplan.mealTypeCard.test.tsx, menuplan.menucard.test.ts,
menuplan.menucard.list.test.ts

Verification: npm run typecheck && npx jest --testPathPatterns="menuplan|Menuplan"
--no-coverage

---

Phase 6: Menuplan Hooks/Page + ShoppingList + New Tests (19 files + 3 new test files)

Menuplan completion (6 files):

┌─────────────────────────┬───────┬─────────────────────────────────────────────────────┐
│ File │ LOC │ Changes │
├─────────────────────────┼───────┼─────────────────────────────────────────────────────┤
│ useMenuplanDialogs.ts │ 246 │ JSDoc, verify named export │
├─────────────────────────┼───────┼─────────────────────────────────────────────────────┤
│ useMenuplanDragDrop.ts │ 802 │ JSDoc, single-letter vars, 1 console.warn→Sentry │
├─────────────────────────┼───────┼─────────────────────────────────────────────────────┤
│ useMenuplanHandlers.tsx │ 1,535 │ JSDoc, single-letter vars. Remove dead firebase │
│ │ │ param. Do NOT split (tech debt) │
├─────────────────────────┼───────┼─────────────────────────────────────────────────────┤
│ menuplan.tsx │ 393 │ Default→named, JSDoc │
└─────────────────────────┴───────┴─────────────────────────────────────────────────────┘

ShoppingList conventions (10 files):

File: shoppingList.class.ts
LOC: 1,013
Default→Named: check
Console→Sentry: —
JSDoc: check
Single-letter: ✓ fix
Firebase/Other: —
────────────────────────────────────────
File: shoppingListCollection.class.ts
LOC: 407
Default→Named: check
Console→Sentry: —
JSDoc: check
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: shoppingListAdapter.ts
LOC: 250
Default→Named: already named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: —
────────────────────────────────────────
File: shoppingList.tsx
LOC: 1,329
Default→Named: ✓ → ShoppingListPage
Console→Sentry: 2 calls
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: Remove dead useFirebase(). Replace initial-load Backdrop with
TableSkeleton.
Update PDF to use generateAndDownloadPdf
────────────────────────────────────────
File: useShoppingListHandlers.tsx
LOC: 1,786
Default→Named: ✓ → named
Console→Sentry: 13 calls
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: Verify all error paths dispatch to reducer (UX improvement 4)
────────────────────────────────────────
File: shoppingListPdf.tsx
LOC: 560
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: dialogSelectDepartments.tsx
LOC: 209
Default→Named: check
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: itemAutocomplete.tsx
LOC: 371
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: useRecipeDrawer.ts
LOC: 118
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: —
Firebase/Other: —
────────────────────────────────────────
File: shoppingListHighlightContext.ts
LOC: 19
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: check
Single-letter: —
Firebase/Other: —

New ShoppingList test files (3 files — HIGH PRIORITY):

1.  ShoppingList/**tests**/shoppingList.class.test.ts — 1,013 LOC of untested business
    logic. Test: generateShoppingList(), addItem(), removeItem(), toggleCheckbox(), department
    grouping, quantity calculation.
2.  ShoppingList/**tests**/shoppingListCollection.class.test.ts — Test collection
    management, trace tracking.
3.  ShoppingList/**tests**/shoppingListAdapter.test.ts — Test domain↔API transformations.

Consumer updates: whereUsed.tsx imports from itemAutocomplete.tsx. event.tsx imports
ShoppingList components.

Verification: npm run typecheck && npx jest
--testPathPatterns="shoppingList|ShoppingList|menuplan|Menuplan" --no-coverage

---

Phase 7: Event/Event — Hub Module (18 files + 2 new test files)

Rationale: Last because it imports from ALL other subfolders.

Convention changes (12 production files):

File: event.tsx
LOC: 2,365
Default→Named: ✓ → EventPage
Console→Sentry: 14 calls
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: Keep firebase.analytics (active). Remove dead Firebase refs where possible
────────────────────────────────────────
File: events.tsx
LOC: 283
Default→Named: ✓ → EventsPage
Console→Sentry: 1 call
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: —
────────────────────────────────────────
File: createNewEvent.tsx
LOC: 760
Default→Named: ✓ → CreateEventPage
Console→Sentry: 3 calls
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: Remove dead useFirebase() + prop passing
────────────────────────────────────────
File: eventInfo.tsx
LOC: 967
Default→Named: ✓ → EventInfo
Console→Sentry: 2 calls
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: Remove dead Firebase import (keep Receipt.getReceipt — active)
────────────────────────────────────────
File: event.class.ts
LOC: 464
Default→Named: check
Console→Sentry: —
JSDoc: check
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: eventShort.class.ts
LOC: 108
Default→Named: check
Console→Sentry: 1 call
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: —
────────────────────────────────────────
File: receipt.class.ts
LOC: 82
Default→Named: check
Console→Sentry: 1 call
JSDoc: ✓ add
Single-letter: check
Firebase/Other: Keep Firebase (active Firestore calls — tech debt)
────────────────────────────────────────
File: eventCard.tsx
LOC: 197
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: ✓ fix
Firebase/Other: —
────────────────────────────────────────
File: eventRecipePdf.tsx
LOC: 221
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: Update to use generateAndDownloadPdf
────────────────────────────────────────
File: eventSharedComponents.tsx
LOC: 445
Default→Named: already named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: —
────────────────────────────────────────
File: eventMasterDataContext.tsx
LOC: 56
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: —
Firebase/Other: —
────────────────────────────────────────
File: dialogEventQuickView.tsx
LOC: 204
Default→Named: ✓ → named
Console→Sentry: —
JSDoc: ✓ add
Single-letter: check
Firebase/Other: Remove dead Firebase import

Consumer updates (CRITICAL):

┌─────────────────────┬─────────────────────────────────────────┬─────────────────────┐
│ Consumer │ Current Import │ New Import │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ │ lazy(() => │ .then(m => │
│ routeConfig.ts │ import("../Event/Event/event")) │ ({default: │
│ │ │ m.EventPage})) │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ │ lazy(() => │ .then(m => │
│ routeConfig.ts │ import("../Event/Event/events")) │ ({default: │
│ │ │ m.EventsPage})) │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ │ lazy(() => import("../Event/Event/creat │ .then(m => │
│ routeConfig.ts │ eNewEvent")) │ ({default: m.Create │
│ │ │ EventPage})) │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ home.tsx │ import EventCard from ... │ import {EventCard} │
│ │ │ from ... │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ EventRepository.ts │ import Event from ... │ import {Event} from │
│ │ │ ... │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ recipe.class.ts │ import Event from ... │ import {Event} from │
│ │ │ ... │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ recipeShort.class.t │ import Event from ... │ import {Event} from │
│ s │ │ ... │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ │ │ import │
│ overviewEvents.tsx │ import EventReceiptPdf from ... │ {EventReceiptPdf} │
│ │ │ from ... │
├─────────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ overviewEvents.tsx │ import Receipt from ... │ import {Receipt} │
│ │ │ from ... │
└─────────────────────┴─────────────────────────────────────────┴─────────────────────┘

Test file updates:

- createNewEvent.test.tsx, eventInfo.test.tsx, events.test.tsx — update imports, fix
  conventions
- **mocks**/event.mock.ts — update export style

New test files (2 files):

1.  **tests**/event.class.test.ts — Test business logic: validation, date handling, factory
    methods, isEventOwner(), calculateDays() etc.
2.  **tests**/eventSharedComponents.test.tsx — Test shared UI components (EventListCard,
    PositionContextMenu, DialogTraceItem).

Verification: npm run typecheck && npm run test (full suite — touches external consumers)

---

Phase 8: Final Verification

1.  npm run lint && npm run typecheck && npm run test
2.  Verify no remaining default exports: grep -r "export default" src/components/Event/
3.  Verify no remaining banner comments: grep -r "\/\* ===" src/components/Event/
4.  Verify no remaining console calls: grep -rn "console\." src/components/Event/
    --include="_.ts" --include="_.tsx"
5.  Update docs/claude/tech-debt.md with any new items discovered

---

NOT in Scope

- Splitting large files >1,000 LOC (changes logic flow — tracked as tech debt)
- Converting numeric enums to string enums (e.g., EventTabs, ItemType — tracked)
- InputProps → slotProps migration (tracked separately)
- In-app navigation blocking via useBlocker (tracked)
- Migrating active Firebase calls in receipt.class.ts (needs ReceiptRepository — tracked)
- Migrating firebase.analytics in event.tsx (tracked)
- Changing any business logic or data flow

---

Summary

┌───────┬───────────────────────┬────────────┬───────────────────────┬───────┬────────┐
│ Phase │ Subfolder │ Files │ New Files │ New │ Risk │
│ │ │ Modified │ │ Tests │ │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 0 │ Shared + Docs │ 1 │ 2 (pdfUtils.ts, │ 0 │ None │
│ │ │ │ TableSkeleton.tsx) │ │ │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 1 │ UsedRecipes │ 8 │ 0 │ 0 │ Low │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 2 │ MaterialList │ 8 │ 0 │ 0 │ Low │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 3 │ GroupConfiguration │ 2 + │ 0 │ 1 │ Medium │
│ │ │ consumers │ │ │ │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 4 │ Menuplan (types) │ 10 │ 0 │ 0 │ Low │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 5 │ Menuplan (dialogs) │ 14+ │ 0 │ 0 │ Low │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 6 │ Menuplan (hooks) + │ 19 │ 0 │ 3 │ Medium │
│ │ ShoppingList │ │ │ │ │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 7 │ Event/Event │ 18 + │ 0 │ 2 │ High │
│ │ │ consumers │ │ │ │
├───────┼───────────────────────┼────────────┼───────────────────────┼───────┼────────┤
│ 8 │ Final verification │ 0 │ 0 │ 0 │ None │
└───────┴───────────────────────┴────────────┴───────────────────────┴───────┴────────┘

Total: ~80 file modifications, 2 new shared components, 6 new test files, across 9 phases.

---

Footer Component — Full Refactoring Plan

Context

The Footer is a small, static presentation component (~178 LOC) with good test coverage (7
tests). It displays app branding, external links, navigation links, and copyright info. The
refactoring brings it in line with current project conventions, fixes security and
accessibility issues, and improves code quality.

Files to Modify

┌───────────────────────────────────────────────────────────────┬──────────────────────┐
│ File │ Action │
├───────────────────────────────────────────────────────────────┼──────────────────────┤
│ src/components/Footer/footer.tsx → Footer.tsx │ Rename + refactor │
├───────────────────────────────────────────────────────────────┼──────────────────────┤
│ src/components/Footer/**tests**/footer.test.tsx → │ Rename + update + │
│ Footer.test.tsx │ expand │
├───────────────────────────────────────────────────────────────┼──────────────────────┤
│ src/components/App/AppLayout.tsx (line 5) │ Update import │
└───────────────────────────────────────────────────────────────┴──────────────────────┘

Step 1: Rename files (PascalCase convention)

- footer.tsx → Footer.tsx
- **tests**/footer.test.tsx → **tests**/Footer.test.tsx

Step 2: Fix exports (named exports only)

- Change export default Footer to named export: export const Footer =
  React.memo(FooterComponent)
- Update import in AppLayout.tsx: import {Footer} from "../Footer/Footer"
- Update import in test file: import {Footer} from "../Footer"

Step 3: Security — rel="noopener noreferrer" on all external links

5 links with target="\_blank" need fixing:

┌────────────────────────────┬─────────────┬─────────────────────────────────┐
│ Link │ Current rel │ Fix │
├────────────────────────────┼─────────────┼─────────────────────────────────┤
│ jubla.ch │ missing │ add rel="noopener noreferrer" │
├────────────────────────────┼─────────────┼─────────────────────────────────┤
│ GitHub │ missing │ add rel="noopener noreferrer" │
├────────────────────────────┼─────────────┼─────────────────────────────────┤
│ mailto │ missing │ add rel="noopener noreferrer" │
├────────────────────────────┼─────────────┼─────────────────────────────────┤
│ Helpcenter │ "noopener" │ change to "noopener noreferrer" │
├────────────────────────────┼─────────────┼─────────────────────────────────┤
│ chuchipirat.ch (Copyright) │ missing │ add rel="noopener noreferrer" │
└────────────────────────────┴─────────────┴─────────────────────────────────┘

Step 4: Accessibility fixes

4a. Fix aria-label typo: "Instagramm" → "Instagram"

4b. Convert internal navigation links (Terms of Use, Privacy Policy) from onClick +
navigate() to proper <Link component={RouterLink} to={...}> — following the established
pattern in recoverEmail.tsx and privacyPolicy.tsx. This makes them keyboard-navigable <a>
elements with real href. Removes the need for useNavigate().

4c. Convert Instagram IconButton + window.open() to an anchor: <IconButton component="a"
 href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">. Eliminates the
onOpenInstagram handler.

Step 5: Code quality cleanup

- Replace wildcard import import \* as DEFAULT_VALUES → named imports {INSTAGRAM_URL,
  MAILADDRESS, HELPCENTER_URL}
- Organize imports into groups: React → MUI → react-router → project constants
- Remove unnecessary key props on Dividers (not in a list)
- Remove component="p" from Typography body2 (already renders as <p>)
- Simplify Copyright: remove React.Fragment wrapper, just return <Typography>
- Replace <br /> tags with proper MUI spacing (sx margins or separate <Typography>
  elements)

Step 5b: UX/UI improvements

5b-1. Break up the dense "Fragen/Anregungen" section.
Currently, email, helpcenter, and legal links are all crammed into a single <Typography>
block separated by <br /> tags. Restructure into visually distinct sections:

- Contact section: "Fragen oder Anregungen?" title + email link as its own <Typography>
  with gutterBottom
- Helpcenter section: Helpcenter link as its own <Typography> with gutterBottom
- Legal links: Terms of Use | Privacy Policy as a separate <Typography> with sx={{ mt: 2 }}

This improves scannability and gives each section breathing room.

5b-2. Make the Instagram button more prominent.
Change size="small" to size="medium" and add a visible text label next to the icon:
<IconButton component="a" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
 size="medium" aria-label="Instagram">
<IconInstagram />
</IconButton>
Alternatively, use a <Button startIcon={<IconInstagram />} ...>Instagram</Button> if a text
label is desired. Keep it subtle — size="medium" alone is likely sufficient for a footer
context.

5b-3. Make the version link more discoverable.
Add an underline-on-hover style to the version link so it's obviously clickable:

 <Link
   href="https://github.com/chuchipirat/chuchipirat"
   target="_blank"
   rel="noopener noreferrer"
   sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
 >
   {packageJson.version}
 </Link>

Step 6: Performance — React.memo

Wrap Footer and Copyright in React.memo. Both are pure components with no props. Prevents
unnecessary re-renders when parent route changes.

const FooterComponent = () => { ... };
/\*_ Fusszeile der Applikation. _/
export const Footer = React.memo(FooterComponent);

Step 7: Update & expand tests

Updates to existing tests:

- Fix import path and named import
- Fix getByLabelText("Instagramm") → getByLabelText("Instagram")
- Simplify navigation tests (Terms/Privacy) — now real <a> elements with href, use
  getByRole("link") + toHaveAttribute("href")
- Simplify Instagram test — now an anchor, check href instead of mocking window.open

New tests to add:

describe("Externe Links haben rel='noopener noreferrer'")

- jubla.ch
- GitHub
- Helpcenter
- chuchipirat.ch (Copyright)

describe("Copyright")

- Zeigt aktuelles Jahr an
- Zeigt App-Name als Link mit korrektem href
- Link hat rel="noopener noreferrer"

Step 8: Verify

1.  npm run typecheck
2.  npm run test -- --filter "Footer"
3.  npm run lint

---

Home Component — Full Refactoring Plan

Context

The Home page (src/components/Home/home.tsx, 1067 LOC) is the main landing page after
login. It loads 5 data sources in parallel (Events, Recipes, Feed, Stats, System Messages)
and renders them in a 2-column responsive layout. It has good test coverage (24 tests). The
refactoring brings it in line with current project conventions, fixes code quality issues,
removes anti-patterns, improves performance, and adds reducer-level unit tests.

Files to Modify

┌────────────────────────────────────────────────────┬─────────────────────────────────┐
│ File │ Action │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ src/components/Home/home.tsx → Home.tsx │ Rename + refactor │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ src/components/Home/**tests**/home.test.tsx → │ Rename + update imports + │
│ Home.test.tsx │ update UX tests │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ NEW: src/components/Home/homeReducer.ts │ Extract reducer + types │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ NEW: │ Reducer unit tests │
│ src/components/Home/**tests**/homeReducer.test.ts │ │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ src/components/App/routeConfig.ts (line 25) │ Update import │
├────────────────────────────────────────────────────┼─────────────────────────────────┤
│ │ Update EVENT_SHOW_PAST_EVENTS │
│ src/constants/text.ts (lines 333, 760) │ to function, improve │
│ │ HOME_EMPTY_FEED text │
└────────────────────────────────────────────────────┴─────────────────────────────────┘

Decision: File Splitting

Option C — Extract reducer only. The 5 sub-components (HomeHeader, HomeNextEvents,
HomePassedEvents, HomeNewestRecipes, HomeFeed, HomeStats) are all page-specific and not
reused elsewhere. Splitting them into 6 separate files creates unnecessary proliferation.
The reducer (~160 LOC) is pure logic, independently testable, and benefits from extraction.

---

Step 1: Rename files (PascalCase convention)

- home.tsx → Home.tsx (via 2-step git mv for case-insensitive macOS)
- **tests**/home.test.tsx → **tests**/Home.test.tsx

Step 2: Extract reducer into homeReducer.ts

Move from Home.tsx into new src/components/Home/homeReducer.ts:

- ReducerActions enum — convert from numeric to string enum for debuggability
- DispatchAction discriminated union type
- State type
- initialState constant
- homeReducer function

All as named exports. Home.tsx imports them.

// String enum (statt numerischem enum)
enum ReducerActions {
EVENTS_FETCH_INIT = "EVENTS_FETCH_INIT",
EVENTS_FETCH_SUCCESS = "EVENTS_FETCH_SUCCESS",
// ...
}

Step 3: Fix exports (named exports only)

- Home.tsx: export default HomePage → export const HomePage = ...
- routeConfig.ts: Update lazy import:
  const HomePage = lazy(() =>
  import("../Home/Home").then((module) => ({default: module.HomePage}))
  );
- (Matches existing pattern for DepartmentsPage, PrivacyPolicyPage, etc.)
- Home.test.tsx: import HomePage from "../home" → import {HomePage} from "../Home"

Step 4: Remove console.error anti-pattern

Remove all 5 console.error(error) calls (lines 304, 324, 344, 364, 386). Sentry handles
error logging per CLAUDE.md: "Do NOT use console.log for error handling — errors are logged
via Sentry."

Step 5: Replace wildcard import with named imports

// Vorher
import \* as ROUTES from "../../constants/routes";

// Nachher
import {EVENT, CREATE_NEW_EVENT, RECIPE, USER_PUBLIC_PROFILE} from
"../../constants/routes";

Update 5 usages (ROUTES.EVENT → EVENT, etc.).

Step 6: Replace inline style with MUI sx prop

┌───────────────────────┬────────────────────────────────┬────────────────────────────┐
│ Location │ Current │ Fix │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ Divider (line 526) │ style={{marginBottom: "2rem"}} │ sx={{mb: "2rem"}} │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ Typography (line 631) │ style={{marginBottom: "1rem"}} │ sx={{mb: "1rem"}} │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ Typography (line 733) │ style={{marginTop: "1rem"}} │ sx={{mt: "1rem"}} │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ CardActionArea (line │ style={{height: "100%"}} │ sx={{height: "100%"}} │
│ 845) │ │ │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ div (line 848) │ <div style={{overflow:         │ <Box sx={{overflow:        │
 │                       │ "hidden"}}> │ "hidden"}}> │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ CardMedia (lines │ inline transform/transition │ Move to sx │
│ 858-863) │ │ │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ Divider (line 1031) │ style={{mx: "1rem"}} │ sx={{mx: "1rem"}} │
├───────────────────────┼────────────────────────────────┼────────────────────────────┤
│ ListItemText (line │ style={{textAlign: "right"}} │ sx={{textAlign: "right"}} │
│ 1052) │ │ │
└───────────────────────┴────────────────────────────────┴────────────────────────────┘

Step 7: Fix useEffect dependency

Navigation effect (line 274-279) is missing navigationValuesContext in deps:
// Vorher
}, []);

// Nachher
}, [navigationValuesContext]);

Step 8: Remove location.state mutation

Remove delete location.state?.snackbar; from handleSnackbarClose (line 492). The snackbar
effect's guard !state.snackbar.open already prevents re-processing. Mutating React Router
state directly is not recommended.

Step 9: Fix HomePassedEvents rowFiller logic

The current logic has a bug — events.length % columns gives the remainder, but the correct
filler count is columns - remainder:

// Vorher (fehlerhaft — erzeugt zu viele Füller)
let rowFiller: number[] = [];
breakpointIsXs
? (rowFiller = [])
: breakpointIsSm
? (rowFiller = [...Array(events.length % 2).keys()])
: (rowFiller = [...Array(events.length % 3).keys()]);

// Nachher (korrekt, mit useMemo)
const rowFiller = React.useMemo(() => {
if (breakpointIsXs) return [];
const columns = breakpointIsSm ? 2 : 3;
const remainder = events.length % columns;
if (remainder === 0) return [];
return [...Array(columns - remainder).keys()];
}, [breakpointIsXs, breakpointIsSm, events.length]);

Example: 5 events in 3-column layout → remainder=2, need 1 filler (not 2).

Step 10: Performance — useCallback for onShowPassedEvents

const onShowPassedEvents = React.useCallback(() => {
dispatch({type: ReducerActions.TOGGLE_PASSED_EVENTS});
}, []);

Step 11: Performance — CSS-only recipe hover effect

Replace the hoveredRecipeUid state + handleHover/handleMouseOut handlers with pure CSS.
This eliminates React state updates on every hover.

// Vorher: React-State für Hover-Tracking (3 state changes pro Hover)
const [hoveredRecipeUid, setHoveredRecipeUid] = React.useState<string | null>(null);
const handleHover = (recipeUid: string) => { setHoveredRecipeUid(recipeUid); };
const handleMouseOut = () => { setHoveredRecipeUid(null); };

// Nachher: Reines CSS — kein State nötig
<Box sx={{overflow: "hidden"}}>
<CardMedia
sx={{
       ...classes.cardMedia,
       transition: "transform 0.5s ease",
     }}
/>
</Box>
// Hover via CardActionArea's built-in hover:
<CardActionArea
sx={{
     height: "100%",
     "&:hover .MuiCardMedia-root": {
       transform: "scale(1.05)",
     },
   }}

>

Remove hoveredRecipeUid, handleHover, handleMouseOut, and the onMouseOver/onMouseOut props
on Card.

Step 12: UX/UI — Past events count on toggle button

Show event count on toggle button for better discoverability:

// Vorher (text.ts)
export const EVENT_SHOW_PAST_EVENTS = "Zeige vergangene Anlässe";

// Nachher — zu Funktion ändern
export const EVENT_SHOW_PAST_EVENTS = (count: number) =>
`Zeige vergangene Anlässe (${count})`;

Update HomePassedEvents to pass events.length and update all usages/tests.

Step 13: UX/UI — Create Event card redesign

Replace the placeholder-image-above-button card with a cleaner dashed-border "+" pattern:

<Card
sx={{
     ...classes.card,
     border: "2px dashed",
     borderColor: "divider",
     display: "flex",
     alignItems: "center",
     justifyContent: "center",
     minHeight: 200,
   }}

> <CardActionArea onClick={onCreateNewEvent} sx={{height: "100%", display: "flex",
>  flexDirection: "column", justifyContent: "center"}}>

     <AddIcon sx={{fontSize: 48, color: "text.secondary", mb: 1}} />
     <Typography color="text.secondary">{TEXT_CREATE_EVENT}</Typography>

   </CardActionArea>
 </Card>

Remove the CardMedia with placeholder image. Import Add as AddIcon from
@mui/icons-material.

Step 14: UX/UI — Collapsible stats on mobile

Wrap HomeStats content in an MUI Accordion on xs viewports, keeping it open by default on
md+:

const HomeStats = React.memo(({stats, isLoadingStats}: HomeStatsProps) => {
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("md"));

const statsContent = (
<List>
{/_ existing list content _/}
</List>
);

return (
<Grid container spacing={2} justifyContent="center">
<Grid size={12}>
<Typography align="center" gutterBottom variant="h5" component="h2">
{TEXT_STATS}
</Typography>
</Grid>
<Grid size={12}>
{isMobile ? (
<Accordion defaultExpanded={false} sx={classes.card}>
<AccordionSummary expandIcon={<ExpandMoreIcon />}>
<Typography>{TEXT_STATS}</Typography>
</AccordionSummary>
<AccordionDetails sx={{p: 0}}>
{statsContent}
</AccordionDetails>
</Accordion>
) : (
<Card sx={classes.card}>
{statsContent}
</Card>
)}
</Grid>
</Grid>
);
});

On mobile, the heading above becomes redundant (shown in AccordionSummary), so
conditionally hide it.

Step 15: UX/UI — Better feed empty state

Update the empty feed text to guide the user:

// Vorher (text.ts)
export const HOME_EMPTY_FEED = "Noch keine Aktivitäten.";

// Nachher
export const HOME_EMPTY_FEED =
"Noch keine Aktivitäten. Erstelle einen Anlass oder publiziere ein Rezept, um
loszulegen.";

Step 16: Update & expand tests

Updates to existing tests (Home.test.tsx):

- Fix import path and named import
- Import reducer types from ../homeReducer
- Update tests affected by UX changes (toggle button text with count, create event card,
  empty feed text)

New test file: homeReducer.test.ts

- Test all 16 action types produce correct state transitions
- Test initialState has correct defaults
- Test exhaustive check throws on unknown action
- Test EVENTS_FETCH_SUCCESS correctly splits actual/passed
- Test TOGGLE_PASSED_EVENTS toggles boolean
- Test SNACKBAR_CLOSE resets to initial values

Step 17: Verify

1.  npx tsc --noEmit (typecheck)
2.  npx jest --testPathPatterns="Home" (all Home tests)
3.  Lint changed files

---

Landing Page — Full Refactoring Plan

Context

The Landing page (src/components/Landing/landing.tsx, 233 LOC) is the first page
non-authenticated users see. It currently shows a linear Stack of text blocks with static
screenshot images — text-heavy, no animations, no visual hierarchy. The refactoring
transforms it into a modern, animated, interactive landing page while fixing code quality
issues and adding comprehensive tests.

Files to Create / Modify

┌──────────┬─────────────────────────────────────────────┬─────────────────────────────┐
│ Action │ File │ Purpose │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Rename + │ Landing.tsx │ Main orchestrator, named │
│ Rewrite │ │ export, data-driven │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ HeroSection.tsx │ Hero with gradient bg, │
│ │ │ animated text, CTA buttons │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ FeatureSection.tsx │ Reusable scroll-reveal │
│ │ │ feature block │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ │ │ Animated MUI icon │
│ Create │ AnimatedFeatureIcon.tsx │ compositions (for features │
│ │ │ without screenshots) │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ CtaSection.tsx │ Bottom call-to-action │
│ │ │ section │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ landingFeatures.ts │ Feature data array + type │
│ │ │ definition │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ │ │ IntersectionObserver │
│ Create │ src/hooks/useScrollReveal.ts │ scroll-reveal hook │
│ │ │ (reusable) │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Modify │ src/constants/text.ts │ Update landing text │
│ │ │ constants, add CTA text │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Modify │ src/components/App/routeConfig.ts │ Update import to named │
│ │ │ export from new path │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Rename + │ **tests**/Landing.test.tsx │ Expanded from 3 to ~12 │
│ Rewrite │ │ tests │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ **tests**/HeroSection.test.tsx │ Hero section tests │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ **tests**/FeatureSection.test.tsx │ Feature section tests │
├──────────┼─────────────────────────────────────────────┼─────────────────────────────┤
│ Create │ src/hooks/**tests**/useScrollReveal.test.ts │ Hook unit tests │
└──────────┴─────────────────────────────────────────────┴─────────────────────────────┘

All Landing files live under src/components/Landing/.

---

Step 1: File Renames + Export Convention

- landing.tsx → Landing.tsx (2-step git mv for macOS)
- **tests**/landing.test.tsx → **tests**/Landing.test.tsx
- export default LandingPage → export const LandingPage
- Update routeConfig.ts line 8: import LandingPage from "../Landing/landing" → import
  {LandingPage} from "../Landing/Landing" (eagerly loaded, not lazy)

Step 2: Create useScrollReveal Hook

New file: src/hooks/useScrollReveal.ts

Reusable hook wrapping IntersectionObserver — triggers isVisible when element scrolls into
view. One-shot: once visible, stays visible (no flicker on scroll-back). Observer
auto-disconnects on unmount.

const SCROLL_REVEAL_OPTIONS: IntersectionObserverInit = {threshold: 0.15};

export const useScrollReveal = (options = SCROLL_REVEAL_OPTIONS) => {
const elementRef = React.useRef<HTMLDivElement>(null);
const [isVisible, setIsVisible] = React.useState(false);
// IntersectionObserver: fires once, then unobserves
...
return {elementRef, isVisible};
};

Tests: src/hooks/**tests**/useScrollReveal.test.ts — mock IntersectionObserver (jsdom lacks
it), verify initial false, becomes true on intersection, unobserves after first trigger,
disconnects on unmount.

Step 3: Feature Data Model + Text Constants

New file: src/components/Landing/landingFeatures.ts

type LandingFeature = {
id: string;
icon: SvgIconComponent; // MUI Icon for the feature
title: string; // from text.ts constant
description: string; // from text.ts constant
imageKey?: keyof LandingPagePictureRepository; // optional screenshot
slideDirection: "left" | "right"; // alternating reveal direction
};

Array LANDING_FEATURES with all 8 features, each referencing text constants and assigning:

- Icons: MenuBookIcon, TuneIcon, GroupsIcon, CalendarMonthIcon, ScaleIcon,
  ShoppingCartIcon, Diversity3Icon, CloudOffIcon
- imageKey for features with screenshots: recipes, groupconfig, menuplan, scaling,
  shoppinglist
- No imageKey for: GroupSize (text merged into GroupConfig), Social, Offline → these render
  AnimatedFeatureIcon instead

Update text.ts: Keep existing constant names but tighten the copy to be punchier. Add new
constants:

- LANDING_CTA_TITLE = "Bereit fürs nächste Lager?"
- LANDING_CTA_TEXT = "Starte jetzt kostenlos und plane dein nächstes Koch-Abenteuer."

Step 4: Build Sub-Components

4a. HeroSection.tsx

Full-width section replacing the current PageTitle + ButtonRow + logo stack.

Visual design:

- Gradient background using theme.palette.primary (works in light + dark mode)
- App name as h1 (large, centered) with a subtle CSS shimmer animation on the text
- Claim text as h2 (fades in with 300ms delay)
- Two CTA buttons (Sign In / Sign Up) grow in with 600ms delay
- Logo image below, fading in with 800ms delay

Animations: All CSS-only via MUI Fade / Grow transitions controlled by a mount state
(React.useState(true) set in useEffect with staggered setTimeout).

Props: onSignIn: () => void, onSignUp: () => void

4b. FeatureSection.tsx

Reusable component rendering one feature with scroll-triggered reveal.

Props: feature: LandingFeature, index: number

Layout:

- Desktop (md+): Two-column Grid. Even index = image left / text right. Odd = reversed.
- Mobile (< md): Single column, text above image.
- Text column: Large icon (with floating CSS animation) + title (h3) + description
- Image column: ImageCard with loading="lazy", rounded corners, subtle shadow, hover scale
  effect
- If no imageKey: render AnimatedFeatureIcon instead of ImageCard

Animation: Entire section wrapped in a div ref={elementRef}. MUI Fade + Slide (from left or
right depending on slideDirection) controlled by isVisible from useScrollReveal.

4c. AnimatedFeatureIcon.tsx

For features without screenshots (Social, Offline). Renders a composed "illustration" from
MUI icons with CSS animations.

Structure:

- Circular Box with light primary background (theme.palette.primary.light at 10% opacity)
- Central large icon (64px) with pulse animation
- 2-3 smaller decorative icons positioned absolutely, floating with staggered
  animation-delay

CSS keyframes (in sx):
"@keyframes float": {
"0%, 100%": {transform: "translateY(0)"},
"50%": {transform: "translateY(-10px)"},
}
"@keyframes pulse": {
"0%, 100%": {transform: "scale(1)"},
"50%": {transform: "scale(1.08)"},
}

4d. CtaSection.tsx

Bottom call-to-action. Uses useScrollReveal + Fade.

Visual: Box with primary gradient bg (same as hero), white text, centered heading +
description + two buttons. Padding theme.spacing(8, 2).

Props: onSignIn: () => void, onSignUp: () => void

4e. ImageCard (stays internal in FeatureSection.tsx)

Refactored from current:

- Add alt: string prop (accessibility fix — currently missing)
- Add loading="lazy" attribute for below-the-fold images
- Add borderRadius: 2 and boxShadow: 3 for modern look
- Add hover effect: transition: "transform 0.3s ease", "&:hover": {transform:
  "scale(1.02)"}

Step 5: Assemble Landing.tsx

Thin orchestrator:

export const LandingPage = () => {
const authUser = useAuthUser();
const navigate = useNavigate();

React.useEffect(() => {
if (authUser) navigate(ROUTE_HOME);
}, [authUser, navigate]);

const handleSignIn = React.useCallback(() => navigate(ROUTE_SIGN_IN), [navigate]);
const handleSignUp = React.useCallback(() => navigate(ROUTE_SIGN_UP), [navigate]);

return (
<>
<HeroSection onSignIn={handleSignIn} onSignUp={handleSignUp} />
<Container component="main" maxWidth="lg" sx={{py: 8}}>
{LANDING_FEATURES.map((feature, index) => (
<FeatureSection key={feature.id} feature={feature} index={index} />
))}
</Container>
<CtaSection onSignIn={handleSignIn} onSignUp={handleSignUp} />
</>
);
};

Key changes: maxWidth from "sm" → "lg" (allows two-column layout), data-driven .map(),
named export.

Step 6: Code Quality & Performance

Fixes applied across all new files:

- React.memo() on FeatureSection, AnimatedFeatureIcon, HeroSection, CtaSection
- displayName set on all memo'd components
- All text from constants/text.ts (no hardcoded strings)
- All images from ImageRepository (environment-aware)
- No console.log/console.error — errors via Sentry
- All styles via MUI sx prop (no inline style)
- JSDoc comments in German, code in English
- No any — strict TypeScript
- loading="lazy" on all below-fold images
- alt text on all images (accessibility fix)
- Remove commented-out width="350em" on logo
- Remove <br /> elements (use margin/padding via sx instead)

Pre-existing bug found: imageRepository.ts line 114 — PRODUCTION groupconfig URL points to
shoppinglist.png instead of groupconfig.png. Will fix while touching this area.

Step 7: Tests

**tests**/Landing.test.tsx (~12 tests)

Keep existing 3: buttons active, navigation works, auth redirect.

Add new:

- Renders all feature section titles
- Hero section displays app name and claim
- CTA section renders at bottom
- Feature images are present for features with imageKey
- Accessibility: h1 and h2 headings exist in hero
- Empty state: no errors when all images load

Infrastructure updates:

- Named import: import {LandingPage} from "../Landing"
- Remove FirebaseContext.Provider if no longer needed
- Mock IntersectionObserver globally

**tests**/HeroSection.test.tsx (~5 tests)

- Renders app name as heading
- Renders claim text
- Sign In and Sign Up buttons present and clickable
- Logo image renders with descriptive alt text
- Buttons call onSignIn/onSignUp callbacks

**tests**/FeatureSection.test.tsx (~5 tests)

- Renders feature title and description
- Renders ImageCard when imageKey provided
- Renders AnimatedFeatureIcon when no imageKey
- Accepts feature prop and renders correctly

src/hooks/**tests**/useScrollReveal.test.ts (~4 tests)

- isVisible starts false
- Becomes true when IntersectionObserver fires isIntersecting: true
- Observer unobserves after first intersection
- Observer disconnects on unmount

Step 8: Verify

1.  npx tsc --noEmit — typecheck
2.  npx jest --testPathPatterns="Landing|useScrollReveal" — all related tests
3.  npm run lint (if working)
4.  Manual browser check: scroll through landing page, verify animations trigger, test
    responsive layout, test Sign In / Sign Up buttons

---

Navigation Folder — Full Refactoring Plan

Context

The Navigation folder (src/components/Navigation/, 913 LOC) is a monolithic module centered
around navigation.tsx (601 LOC). It contains security issues (sign-out race condition), a
hooks violation, ~120 lines of dead code, missing tests (only helpCenter.test.ts exists),
and multiple convention violations. This refactoring decomposes it into focused, testable
files following project conventions.

Critical Issues

┌─────────────┬──────────────────────────────────────────────────────────────┬──────────┐
│ Category │ Issue │ Severity │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Bug │ useNavigate() called after early return — hooks violation │ High │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Security │ Sign-out uses hardcoded setTimeout(1000) — race condition │ High │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Security │ Menu actions use event.currentTarget.id.split("\_") string │ Medium │
│ │ matching │ │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Dead code │ ~120 lines commented out, UpdateRibbon + Ribbon + │ Medium │
│ │ DialogRefreshApp unused │ │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Performance │ No memoization, list() recreated every render │ Medium │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Conventions │ Default exports, numeric enum, console.info, ==, no JSDoc, │ Medium │
│ │ English aria-labels │ │
├─────────────┼──────────────────────────────────────────────────────────────┼──────────┤
│ Tests │ No tests for Navigation, NavigationAuth, NavigationNoAuth, │ High │
│ │ ScrollToTop, GoBackFab │ │
└─────────────┴──────────────────────────────────────────────────────────────┴──────────┘

Files to Create / Modify

┌────────┬──────────────────────────────────────────┬──────────────────────────────────┐
│ Action │ File │ Purpose │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Delete │ dialogRefreshApp.tsx │ Dead code (trigger commented │
│ │ │ out, dialog never shown) │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Delete │ navigation.tsx │ Replaced by split files below │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ Navigation.tsx │ Thin wrapper: auth check → │
│ │ │ renders Bar or NoAuth │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ NavigationBar.tsx │ AppBar with toolbar, help │
│ │ │ button, user menu │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ NavigationDrawer.tsx │ Side drawer, data-driven from │
│ │ │ menu config │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ NavigationNoAuth.tsx │ Simple AppBar for │
│ │ │ non-authenticated users │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ navigationMenuConfig.ts │ Data-driven menu items with role │
│ │ │ guards │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ useSignOut.ts │ Safe async sign-out hook │
│ │ │ (Supabase + Firebase) │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ TestTenantRibbon.tsx │ Extracted ribbon component │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Rename │ helpCenter.class.ts → helpCenter.ts │ Pure function, fix ==, remove │
│ │ │ console.info │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Rename │ scrollToTop.tsx → ScrollToTop.tsx │ Named export │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Rename │ goBack.tsx → GoBackFab.tsx │ Named export │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Modify │ NavigationContext.tsx (renamed from │ String enum, React.ReactNode, │
│ │ navigationContext.tsx) │ named export │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Modify │ App.tsx │ Update imports │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Modify │ AppLayout.tsx │ Update imports │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Modify │ index.jsx │ Update import for │
│ │ │ NavigationContextProvider │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/Navigation.test.tsx │ Auth routing tests │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/NavigationBar.test.tsx │ Toolbar, help, user menu tests │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/NavigationDrawer.test.tsx │ Menu items, role visibility, │
│ │ │ navigation │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/useSignOut.test.ts │ Sign-out hook tests │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/ScrollToTop.test.tsx │ Scroll behavior test │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Create │ **tests**/GoBackFab.test.tsx │ Back navigation test │
├────────┼──────────────────────────────────────────┼──────────────────────────────────┤
│ Modify │ **tests**/helpCenter.test.ts │ Update imports (class → │
│ │ │ function) │
└────────┴──────────────────────────────────────────┴──────────────────────────────────┘

---

Step 1: Dead Code Removal

Remove from navigation.tsx:

- Lines 62-105: commented-out ScrollTop component
- Lines 133-208: commented-out version checking + FIXME block
- Lines 285-287: commented-out onClickUpdateRibon
- showDialogRefreshApp state + onUpdateAppOk + onUpdateAppCancel functions
- DialogRefreshApp import and JSX usage
- UpdateRibbon component (exported but never imported)
- Ribbon component (exported but never imported outside this file)
- Anchor type (only "left" ever used)
- Unused imports: LocalStorageKey (if only used by dead code), FirebaseAnalyticEvent,
  logEvent

Delete dialogRefreshApp.tsx entirely.

Step 2: Hooks Violation Fix

Move const navigate = useNavigate() (line 236) up above if (!authUser) return null (line
210). All hooks must be called unconditionally before any early return.

Step 3: Sign-Out Fix — useSignOut.ts

New file: src/components/Navigation/useSignOut.ts

Replace the fragile pattern:
database.auth.signOut().catch(() => {});
firebase.signOut();
await new Promise(resolve => setTimeout(resolve, 1000));
navigate(ROUTES.LANDING);

With a proper async hook:
export const useSignOut = () => {
const database = useDatabase();
const firebase = useFirebase();
const navigate = useNavigate();

return useCallback(async () => {
await Promise.allSettled([
database.auth.signOut(),
firebase.signOut(),
]);
localStorage.removeItem(LocalStorageKey.AUTH_USER);
navigate(ROUTES.LANDING);
}, [database, firebase, navigate]);
};

- Promise.allSettled waits for both without swallowing errors
- No arbitrary timeout
- Extracted as reusable hook

Step 4: Data-Driven Menu — navigationMenuConfig.ts

New file: src/components/Navigation/navigationMenuConfig.ts

Follows routeConfig.ts pattern. Reuse guard functions from there or duplicate the simple
ones:

type NavigationMenuItem = {
key: string;
label: string;
icon: SvgIconComponent;
route: string;
guard?: (authUser: AuthUser) => boolean;
dividerBefore?: boolean;
};

Config array with all menu items, role guards inline. This eliminates:

- Duplicated authUser.roles?.includes(Role.communityLeader) checks
- The Departments onClick-on-ListItemText bug (line 392)
- Hard-coded JSX menu structure

Step 5: File Split

Navigation.tsx (~15 LOC)

Thin wrapper — named export export const Navigation. Checks useAuthUser(), renders
NavigationBar or NavigationNoAuth.

NavigationBar.tsx (~100 LOC)

Replaces NavigationAuth. Contains:

- AppBar + Toolbar with menu icon, title link, TestTenantRibbon, help button, user menu
- Uses useSignOut() hook
- Direct callbacks on MenuItem instead of id-based string matching:
<MenuItem onClick={handleNavigateToProfile}>{TEXT.NAVIGATION_USER_PROFILE}</MenuItem>
<MenuItem onClick={signOut}>{TEXT.SIGN_OUT}</MenuItem>
- useCallback on toggleDrawer, handleHelp, handleMenu, handleClose

NavigationDrawer.tsx (~50 LOC)

Props: open: boolean, onClose: () => void

- Filters navigationMenuConfig by guard
- Maps to ListItemButton components
- aria-label="Hauptnavigation" for accessibility

NavigationNoAuth.tsx (~40 LOC)

Simple AppBar for non-authenticated users. Extracted from the bottom of navigation.tsx.

TestTenantRibbon.tsx (~10 LOC)

Extracted, only ribbon component still in use.

Step 6: Convention Compliance

All files:

- Named exports everywhere (export const X)
- File names match primary export (PascalCase)
- German JSDoc on all public functions/components
- No any — strict TypeScript
- Specific imports (no import \* as TEXT)

NavigationContext.tsx (renamed from navigationContext.tsx):

- NavigationObject enum → string values:
  export enum NavigationObject {
  none = "none",
  home = "home",
  menueplan = "menueplan",
  // ... etc
  }
- All 12+ consumer files use NavigationObject.memberName — no raw number comparisons found,
  so this is safe.
- children: JSX.Element → children: React.ReactNode

helpCenter.ts (renamed from helpCenter.class.ts):

- Class with static method → exported pure function getMatchingHelpPage
- == → === (3 occurrences)
- console.info → remove (informational logging of unmatched routes, not needed)
- German JSDoc

Aria labels (German):

- "go to Helppage" → "Hilfe-Seite aufrufen"
- "account of current user" → "Benutzerkonto"
- aria-label="Hauptnavigation" on Drawer

Update consumer imports:

- App.tsx: import {Navigation} from "../Navigation/Navigation"
- App.tsx: import {ScrollToTop} from "../Navigation/ScrollToTop"
- AppLayout.tsx: import {GoBackFab} from "../Navigation/GoBackFab"
- index.jsx: import {NavigationContextProvider} from
  "./components/Navigation/NavigationContext"

Step 7: Tests

**tests**/Navigation.test.tsx (~3 tests)

- Renders NavigationBar when user authenticated
- Renders NavigationNoAuth when user is null
- Doesn't crash during render

**tests**/NavigationBar.test.tsx (~8 tests)

- Renders app title "chuchipirat"
- Shows TestTenantRibbon in test environment
- Opens drawer on menu icon click
- Opens user menu on account icon click
- Navigates to profile on "Mein Profil" click
- Calls signOut on "Abmelden" click
- Help button calls window.open with correct URL
- Menu button disabled when email not verified

**tests**/NavigationDrawer.test.tsx (~5 tests)

- Renders all base menu items for basic user
- Hides community leader items for basic role
- Shows community leader items for community leader
- Shows admin items for admin
- Navigates to route and closes drawer on click

**tests**/useSignOut.test.ts (~3 tests)

- Calls both database and firebase signOut
- Removes auth user from localStorage
- Navigates to landing page

**tests**/ScrollToTop.test.tsx (~1 test)

- Calls window.scrollTo on route change

**tests**/GoBackFab.test.tsx (~2 tests)

- Renders back button
- Calls navigate(-1) on click

Update **tests**/helpCenter.test.ts

- Change import from HelpCenter.getMatchingHelpPage to getMatchingHelpPage
- Tests remain the same

Step 8: UX Suggestion

NavigationNoAuth sign-in: Currently renders a plain text <Link> for "Anmelden". Consider
changing to a <Button variant="outlined" color="inherit"> for better discoverability — the
sign-in action is the primary CTA for non-authenticated users and should be more prominent.

Step 9: Verify

1.  npx tsc --noEmit — typecheck
2.  npx jest --testPathPatterns="Navigation|helpCenter|ScrollToTop|GoBackFab|useSignOut" —
    all tests
3.  Manual browser check:

- Log in → verify drawer, help button, user menu, sign-out
- Log out → verify NavigationNoAuth with sign-in
- Test environment → verify yellow ribbon
- Check all role-based menu items (basic, communityLeader, admin)
- Verify help button opens correct URLs for different pages

---

│ Material Folder — Full Refactoring Plan │
│ │
│ Context │
│ │
│ The Material folder (src/components/Material/, 1,935 LOC across 6 files) manages material │
│ master data (kitchen supplies like pots, plates, napkins). It is already well-structured │
│ with a good reducer pattern and decent test coverage, but contains a dead │
│ Firebase-dependent class file, correctness bugs (loose equality, duplicate enum/const), │
│ missing error logging, performance issues, and convention violations. The Material class │
│ and MaterialType enum are imported by 30 files across the codebase, making type │
│ extraction the highest-risk change. │
│ │
│ Issues Summary │
│ │
│ ┌─────┬───────────┬────────────────────────────┬─────────┬─────────────────────────────┐ │
│ │ # │ Category │ Issue │ Severit │ File │ │
│ │ │ │ │ y │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 1 │ Correctne │ == instead of === (2 │ High │ dialogMaterial.tsx:221,366 │ │
│ │ │ ss │ occurrences) │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ │ Redundant │ │ │ │
│ │ 2 │ Correctne │ MATERIAL_DIALOG_TYPE const │ Medium │ dialogMaterial.tsx:60-67 │ │
│ │ │ ss │ alongside MaterialDialog │ │ │ │
│ │ │ │ enum — code mixes both │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ │ event.target.id.split("-") │ │ │ │
│ │ 3 │ Security │ [0] for field routing │ Medium │ dialogMaterial.tsx:146 │ │
│ │ │ │ (unnecessary switch with │ │ │ │
│ │ │ │ only "name") │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ Error │ console.warn/console.error │ │ dialogMaterial.tsx:271,274, │ │
│ │ 4 │ handling │ instead of Sentry (3 │ Medium │ materials.tsx:223 │ │
│ │ │ │ occurrences) │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ │ material.class.ts static │ │ │ │
│ │ 5 │ Dead code │ methods (Firebase) are │ Medium │ material.class.ts │ │
│ │ │ │ unused — only type+enum │ │ │ │
│ │ │ │ needed │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 6 │ Conventio │ All 4 files use export │ Medium │ All files │ │
│ │ │ n │ default │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 7 │ Conventio │ Missing/incomplete JSDoc │ Low │ materialAutocomplete.tsx:42 │ │
│ │ │ n │ on MaterialAutocomplete │ │ -46 │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ Conventio │ English aria-label, │ │ │ │
│ │ 8 │ n │ Firebase import for typing │ Low │ dialogMaterial.tsx:47,306 │ │
│ │ │ │ only │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ Performan │ createFilterOptions() │ │ │ │
│ │ 9 │ ce │ called every render (not │ Medium │ materialAutocomplete.tsx:59 │ │
│ │ │ │ memoized) │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 10 │ Performan │ TABLE_COLUMNS array │ Low │ materials.tsx:447-489 │ │
│ │ │ ce │ recreated every render │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 11 │ Performan │ useMemo eslint-disable │ Low │ materials.tsx:503-506 │ │
│ │ │ ce │ with missing deps │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 12 │ Performan │ Inline style={{}} instead │ Low │ materials.tsx:586 │ │
│ │ │ ce │ of MUI sx prop │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ 13 │ Tests │ No tests for │ High │ — │ │
│ │ │ │ MaterialAutocomplete │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ │ No tests for │ │ │ │
│ │ 14 │ Tests │ materialsReducer (pure │ Medium │ — │ │
│ │ │ │ function) │ │ │ │
│ ├─────┼───────────┼────────────────────────────┼─────────┼─────────────────────────────┤ │
│ │ │ │ ESC key does nothing in │ │ │ │
│ │ 15 │ UX │ dialog (unusual, blocks │ Low │ dialogMaterial.tsx:296-300 │ │
│ │ │ │ standard close) │ │ │ │
│ └─────┴───────────┴────────────────────────────┴─────────┴─────────────────────────────┘ │
│ │
│ NOT in scope (tracked as tech debt): │
│ - MaterialType numeric→string enum conversion — affects 30+ files and Repository mapping. │
│ Separate PR. │
│ - ReducerActions numeric enum — internal, no DB mapping, low priority. │
│ │
│ --- │
│ Step 1: Extract types from material.class.ts → material.types.ts │
│ │
│ Goal: Remove the dead Firebase class, keep only what 30 files actually use. │
│ │
│ Create src/components/Material/material.types.ts │
│ │
│ - Export MaterialType enum (keep numeric values — string conversion is separate tech │
│ debt) │
│ - Export type Material = { uid: string; name: string; type: MaterialType; usable: boolean │
│ } │
│ - Export createEmptyMaterial(): Material factory function (replaces new Material()) │
│ - Named exports, German JSDoc │
│ │
│ Update 30 importing files │
│ │
│ - import Material, {MaterialType} from "./material.class" → import {Material, │
│ MaterialType} from "./material.types" │
│ - new Material() (12 occurrences in 8 files) → createEmptyMaterial() │
│ - dialogMaterial.tsx:249,278 — replace new Material() + property assignment with object │
│ literal │
│ - materialAutocomplete.tsx:87 — use createEmptyMaterial() │
│ - materialList.tsx:900 — use createEmptyMaterial() │
│ - event.tsx:1259,1885 — use createEmptyMaterial() │
│ - convertItem.tsx:385 — use createEmptyMaterial() │
│ - mergeItems.tsx:324 — use createEmptyMaterial() │
│ - itemAutocomplete.tsx:316 — spread createEmptyMaterial() │
│ - Test files (2 files) — use createEmptyMaterial() │
│ │
│ Update MaterialRepository.ts │
│ │
│ - Import Material type from material.types.ts instead of keeping separate MaterialDomain │
│ - Re-export Material as MaterialDomain for backward compatibility, or alias in the import │
│ │
│ Update lazy import in routeConfig.ts │
│ │
│ - lazy(() => import("../Material/materials")) — will need update after named export │
│ change (Step 5) │
│ │
│ Delete material.class.ts │
│ │
│ Files touched: ~35 files (30 importers + new types file + deleted class + repository) │
│ │
│ --- │
│ Step 2: Fix correctness issues in dialogMaterial.tsx │
│ │
│ 1. Line 221: == → === (name comparison) │
│ 2. Line 366: == → === (dialogType comparison) │
│ 3. Lines 64-67: Delete MATERIAL_DIALOG_TYPE const. Update all references (lines 236, 277, │
│ 309, 366, 385) to use MaterialDialog.CREATE / MaterialDialog.EDIT │
│ 4. Line 47: Remove import {ValueObject} from "../Firebase/Db/firebase.db.super.class". │
│ Change onClose param (line 296) to (\_event: object, reason: string) │
│ 5. Line 306: Fix aria-labelledby="dialog Add Material" → aria-labelledby="dialogMaterial" │
│ and align DialogTitle id │
│ 6. Lines 145-158: Simplify onChangeField — remove split("-") and switch (only "name" │
│ field exists): │
│ const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => { │
│ setMaterialPopUpValues({...materialPopUpValues, name: event.target.value, clear: │
│ false}); │
│ }; │
│ │
│ Files touched: dialogMaterial.tsx, dialogMaterial.test.tsx (update MATERIAL_DIALOG_TYPE │
│ refs if any) │
│ │
│ --- │
│ Step 3: Replace console.error/console.warn with Sentry │
│ │
│ 1. dialogMaterial.tsx:271 — console.warn(...) → Sentry.captureException(err, {extra: │
│ {context: "Material erstellen: Feed-Eintrag"}}) │
│ 2. dialogMaterial.tsx:274 — console.error(...) → Sentry.captureException(error, {extra: │
│ {context: "Material erstellen"}}) │
│ 3. materials.tsx:223 — console.error(error) → Sentry.captureException(error, {extra: │
│ {context: "Materialien laden"}}) │
│ 4. Update dialogMaterial.test.tsx:352-353 — mock Sentry instead of console.error │
│ │
│ Files touched: dialogMaterial.tsx, materials.tsx, dialogMaterial.test.tsx │
│ │
│ --- │
│ Step 4: Performance fixes │
│ │
│ 1. materialAutocomplete.tsx:59 — Move createFilterOptions<Material>() to module level │
│ (before component). It's stateless, no need to recreate. │
│ 2. materials.tsx:447-489 — Extract TABLE_COLUMNS as a pure function │
│ getTableColumns(editMode: boolean) outside the component. Wrap call in useMemo: │
│ const tableColumns = React.useMemo(() => getTableColumns(editMode), [editMode]); │
│ 3. materials.tsx:503-506 — Fix useMemo dependency chain: │
│ - Wrap handleRadioButtonChange and handleCheckBoxChange in useCallback with deps │
│ [materials, onMaterialChange] │
│ - Add them to the useMemo deps, remove eslint-disable-next-line │
│ 4. materials.tsx:586 — style={{marginTop: "0.5em", marginBottom: "2em"}} → sx={{mt:       │
│ "0.5em", mb: "2em"}} │
│ │
│ Files touched: materialAutocomplete.tsx, materials.tsx │
│ │
│ --- │
│ Step 5: Convention fixes (named exports, JSDoc) │
│ │
│ Named exports (all 4 files → update all importers) │
│ │
│ - materials.tsx: export const MaterialPage = ... (+ export reducer, actions, initialState │
│ for testing) │
│ - dialogMaterial.tsx: export const DialogMaterial = ... │
│ - materialAutocomplete.tsx: export const MaterialAutocomplete = ... │
│ - Update routeConfig.ts lazy import: lazy(() => import("../Material/materials").then(m => │
│ ({default: m.MaterialPage}))) │
│ - Update all direct importers to use {MaterialPage}, {DialogMaterial}, │
│ {MaterialAutocomplete} │
│ │
│ JSDoc │
│ │
│ - materialAutocomplete.tsx:42-46: Complete JSDoc with proper German description, @param, │
│ @returns │
│ │
│ Files touched: materials.tsx, dialogMaterial.tsx, materialAutocomplete.tsx, │
│ routeConfig.ts, + all files importing these │
│ │
│ --- │
│ Step 6: Add missing tests │
│ │
│ **tests**/materialsReducer.test.ts (~7 tests) │
│ │
│ Pure function tests — no rendering needed: │
│ - MATERIALS_FETCH_INIT → sets loading, clears error │
│ - MATERIALS_FETCH_SUCCESS → replaces materials, clears changedUids, clears loading │
│ - MATERIAL_UPDATED → replaces correct material, adds uid to changedUids │
│ - MATERIALS_SAVED → clears changedUids, shows success snackbar │
│ - MATERIALS_EDIT_CANCELLED → restores snapshot │
│ - SNACKBAR_CLOSE → closes snackbar │
│ - GENERIC_ERROR → sets error, clears loading │
│ │
│ **tests**/MaterialAutocomplete.test.tsx (~6 tests) │
│ │
│ - Renders with a selected material value │
│ - Shows "add" option when allowCreateNewMaterial=true and input doesn't match │
│ - Does NOT show "add" option when allowCreateNewMaterial=false │
│ - Calls onChange with correct parameters on selection │
│ - Shows disabled state with helper text "Wert kann nicht geändert werden" │
│ - Shows error state with error text │
│ │
│ Files touched: **tests**/materialsReducer.test.ts (new), │
│ **tests**/MaterialAutocomplete.test.tsx (new), materials.tsx (export reducer + types for │
│ testing) │
│ │
│ --- │
│ Step 7: UX improvement — ESC closes dialog │
│ │
│ Change onClose handler in dialogMaterial.tsx to allow ESC to close (same as Cancel). Keep │
│ backdrop click blocked (prevents accidental data loss): │
│ const onClose = (\_event: object, reason: string) => { │
│ if (reason === "backdropClick") return; │
│ onCancelClick(); │
│ }; │
│ │
│ Files touched: dialogMaterial.tsx │
│ │
│ --- │
│ UX Suggestion │
│ │
│ Count text formatting: The current count display "X von Y Materialien" works but could be │
│ slightly improved. When unfiltered, showing just "12 Materialien" is clean. When │
│ filtered, "3 von 12 Materialien" is clear. This is already what the code does — no change │
│ needed. │
│ │
│ --- │
│ Execution Order │
│ │
│ Step 1 (types extraction) ← Foundation, must be first (highest risk, 35 files) │
│ ↓ │
│ Steps 2, 3, 4 ← Independent, any order (correctness, Sentry, perf) │
│ ↓ │
│ Step 5 (named exports) ← After Step 1 (both change imports) │
│ ↓ │
│ Step 6 (tests) ← After Step 5 (needs exported reducer) │
│ ↓ │
│ Step 7 (UX) ← Last (behavior change) │
│ │
│ Verification │
│ │
│ After each step: │
│ 1. npm run typecheck — zero new errors │
│ 2. npm run test -- --testPathPatterns="Material" — all Material tests pass │
│ 3. After Step 1: npm run test — full suite (30 files changed) │
│ 4. After Step 6: verify new test coverage │
│ 5. After all steps: manual browser check │
│ - Navigate to /materials │
│ - Edit mode → change type/usable → Save → verify only changed items saved │
│ - Cancel → verify snapshot restore │
│ - Create dialog → validate empty name, missing type, duplicate name │
│ - ESC on dialog → verify it closes (Step 7)

---

PasswordChange Folder — Full Refactoring Plan

Context

The PasswordChange folder (src/components/PasswordChange/, 559 LOC + 380 LOC tests) handles
two flows: password reset (via recovery link with oobCode) and standard login changes
(email + password) for authenticated users. It already has a good reducer pattern and
decent test coverage, but contains correctness bugs, security concerns, convention
violations, and missing test coverage for the email change flow.

The DialogReauthenticate component (src/components/SignIn/dialogReauthenticate.tsx, 254
LOC) is tightly coupled and shares several issues — I'm including it in scope since it's a
direct dependency with no other consumers.

---

Issues Summary

#: 1
Category: Security
Issue: No password confirmation field — users can set a password with a typo and lock
themselves out
Severity: High
File: passwordChange.tsx:506-530
────────────────────────────────────────
#: 2
Category: Security
Issue: console.error instead of Sentry (3 occurrences)
Severity: Medium
File: passwordChange.tsx:239,253, dialogReauthenticate.tsx:136
────────────────────────────────────────
#: 3
Category: Security
Issue: Email field in reauthenticate dialog uses id="email" — collides with the main page's

    email field, could cause autocomplete confusion

Severity: Medium
File: dialogReauthenticate.tsx:204
────────────────────────────────────────
#: 4
Category: Correctness
Issue: Dead code: if (oobCode && !resetCode) is always false because resetCode = oobCode on

    line 174

Severity: Medium
File: passwordChange.tsx:183-185
────────────────────────────────────────
#: 5
Category: Correctness
Issue: Typo in state variable: reauthenticattion (triple t) — used in 4 places
Severity: Low
File: passwordChange.tsx:214,215,277,312-313
────────────────────────────────────────
#: 6
Category: Correctness
Issue: Typo in initial state: inititialState (triple i) — in both files
Severity: Low
File: passwordChange.tsx:94, dialogReauthenticate.tsx:59
────────────────────────────────────────
#: 7
Category: Correctness
Issue: DispatchAction uses payload: any — loses type safety
Severity: Medium
File: passwordChange.tsx:89-92
────────────────────────────────────────
#: 8
Category: Correctness
Issue: passwordChangeReducer default case uses console.error instead of exhaustive check
Severity: Medium
File: passwordChange.tsx:147-149
────────────────────────────────────────
#: 9
Category: Convention
Issue: export default on both files
Severity: Medium
File: passwordChange.tsx:559, dialogReauthenticate.tsx:253
────────────────────────────────────────
#: 10
Category: Convention
Issue: FirebaseError type used for Supabase errors — misleading type name
Severity: Low
File: Multiple locations
────────────────────────────────────────
#: 11
Category: Convention
Issue: Missing JSDoc on DialogReauthenticate component
Severity: Low
File: dialogReauthenticate.tsx:97
────────────────────────────────────────
#: 12
Category: Convention
Issue: Deprecated InputProps instead of slotProps in PasswordChangeCard
Severity: Low
File: passwordChange.tsx:516
────────────────────────────────────────
#: 13
Category: Performance
Issue: ImageRepository.getEnvironmentRelatedPicture() called on every render (not memoized)
Severity: Low
File: passwordChange.tsx:372,477
────────────────────────────────────────
#: 14
Category: Performance
Issue: showPassword toggle handlers not memoized with useCallback
Severity: Low
File: passwordChange.tsx:464-469
────────────────────────────────────────
#: 15
Category: Tests
Issue: No tests for email change flow (success + error + same-email validation)
Severity: High
File: —
────────────────────────────────────────
#: 16
Category: Tests
Issue: No tests for passwordChangeReducer as pure function
Severity: Medium
File: —
────────────────────────────────────────
#: 17
Category: Tests
Issue: No tests for DialogReauthenticate component
Severity: Medium
File: —
────────────────────────────────────────
#: 18
Category: UX
Issue: No "Confirm password" field — easy to mistype new password
Severity: High
File: passwordChange.tsx
────────────────────────────────────────
#: 19
Category: UX
Issue: After successful password change, user sees success alert but has no clear next step

    (no "Go to login" button in reset flow)

Severity: Medium
File: passwordChange.tsx:499-504
────────────────────────────────────────
#: 20
Category: UX
Issue: Email validation message shows immediately on load before user types anything
Severity: Low
File: passwordChange.tsx:403-405
────────────────────────────────────────
#: 21
Category: UX
Issue: Error and success alerts can show simultaneously for password card (both error and
successPwChange can be truthy)
Severity: Low
File: passwordChange.tsx:490-505
────────────────────────────────────────
#: 22
Category: UX
Issue: No password requirements hint — users don't know the minimum until they try to
submit
Severity: Low
File: passwordChange.tsx
────────────────────────────────────────
#: 23
Category: UX
Issue: Form stays active after success — user can double-submit or edit a completed change
Severity: Low
File: passwordChange.tsx
────────────────────────────────────────
#: 24
Category: UX
Issue: No loading state on submit button — no visual feedback during API call
Severity: Medium
File: passwordChange.tsx

NOT in scope (tracked as tech debt):

- FirebaseError → custom error type migration (affects many files across the codebase)
- DialogReauthenticate should eventually use useDatabase() hook instead of receiving
  database as prop — but changing the interface now would require updating the caller too

---

Step 1: Fix correctness bugs and dead code

Goal: Eliminate dead code, fix typos, add type safety to the reducer.

passwordChange.tsx

1. Delete dead code (lines 183-185): Remove if (oobCode && !resetCode) block — it's
   unreachable
2. Fix typo inititialState → initialState
3. Fix typo reauthenticattion → reauthentication (4 occurrences)
4. Replace DispatchAction with discriminated union (like dialogReauthenticate.tsx already
   does):
   type DispatchAction =
   | {type: ReducerActions.UPDATE_FIELD; payload: {field: string; value: string}}
   | {type: ReducerActions.EMAIL_ERROR; payload: FirebaseError}
   | {type: ReducerActions.PASSWORD_ERROR; payload: FirebaseError}
   | {type: ReducerActions.SUCCESS_MAIL_CHANGE}
   | {type: ReducerActions.SUCCESS_PW_CHANGE}
   | {type: ReducerActions.SUCCESS_REAUTHENTICATION}
   | {type: ReducerActions.SNACKBAR_CLOSE};
5. Replace console.error in default case with exhaustive check pattern (const
   \_exhaustiveCheck: never = action)
6. Export reducer, actions, initialState for testing (like materials.tsx)

dialogReauthenticate.tsx

1. Fix typo inititialState → initialState

Files touched: passwordChange.tsx, dialogReauthenticate.tsx, passwordChange.test.tsx
(update import)

---

Step 2: Replace console.error with Sentry

1. passwordChange.tsx:239 — console.error(error) → Sentry.captureException(error, {extra:
   {context: "E-Mail ändern"}})
2. passwordChange.tsx:253 — console.error(error) → Sentry.captureException(error, {extra:
   {context: "Passwort ändern"}})
3. dialogReauthenticate.tsx:136 — console.error(error) → Sentry.captureException(error,
   {extra: {context: "Reauthentifizierung"}})

Files touched: passwordChange.tsx, dialogReauthenticate.tsx

---

Step 3: Add password confirmation field (Security + UX)

Goal: Prevent users from locking themselves out with a mistyped password.

Changes to passwordChange.tsx

1. Add passwordConfirm field to PasswordChangeData type and initial state
2. Add UPDATE_FIELD handling (already generic, works automatically)
3. In PasswordChangeCard:
   - Add second TextField for password confirmation (same show/hide toggle applies)
   - Add validation: passwords must match before enabling submit button
   - Show inline error when passwords don't match (only after user has typed in both fields)

4. Update button disabled logic:
   disabled={
   password === "" ||
   password.length < 6 ||
   password !== passwordConfirm
   }
5. Add text constant PASSWORDS_DONT_MATCH to text.ts (German: "Die Passwörter stimmen nicht
   überein")
6. Add text constant PASSWORD_REQUIREMENTS_HINT to text.ts (German: "Mindestens 6 Zeichen")
7. Show password requirements hint below the password field as FormHelperText:
   <FormHelperText>{TEXT_PASSWORD_REQUIREMENTS_HINT}</FormHelperText>

Files touched: passwordChange.tsx, constants/text.ts, passwordChange.test.tsx (update
tests)

---

Step 4: UX improvements

4a: Add "Go to login" button after successful password reset

In PasswordChangeCard, when successPwChange && resetCode:
<Button
fullWidth
variant="outlined"
color="primary"
sx={{mt: 2}}
onClick={() => navigate(ROUTES.SIGN_IN)}

>

    {TEXT_SIGN_IN}

  </Button>
  Requires passing navigate and resetCode context to PasswordChangeCard — or elevating the
  button to the parent and rendering it conditionally there.

4b: Fix email validation showing on load

Only show the "Bitte gültige E-Mail eingeben" message when the email field has been
touched:

- Add emailTouched state (or track via onBlur)
- Show validation message only when emailTouched && !isValidEmail

4c: Prevent simultaneous error and success alerts

- In PASSWORD_ERROR reducer case, also set successPwChange: false
- In EMAIL_ERROR reducer case, also set successEmailChange: false

4d: Disable form after success

After successful password/email change, disable the input fields and submit button to
prevent double submission:

- EmailChangeCard: when successEmailChange is true, disable the email field and button
- PasswordChangeCard: when successPwChange is true, disable the password field(s) and
  button

4e: Loading state on submit buttons

Add loading state to show a spinner during API calls:

1. Add isSubmittingEmail and isSubmittingPassword to reducer state (or use local useState)
2. Add SUBMIT_EMAIL_START / SUBMIT_PASSWORD_START actions (set loading = true)
3. On success/error, set loading = false
4. Replace <Button> with MUI <LoadingButton> from @mui/lab (or use disabled +
   CircularProgress in the button if @mui/lab isn't available):
   <Button
   disabled={...}
   startIcon={isSubmitting ? <CircularProgress size={20} /> : undefined}
   onClick={onPwChange}
   > {TEXT_CHANGE_PASSWORD}
   > </Button>
5. Also disable the button while submitting to prevent double-click

Files touched: passwordChange.tsx, passwordChange.test.tsx

---

Step 5: Convention fixes (named exports, deprecated API)

Named exports

- passwordChange.tsx: export {PasswordChangePage} (keep PasswordChangeLink as named export
  already)
- dialogReauthenticate.tsx: export {DialogReauthenticate}
- Update routeConfig.ts lazy import:
  const PasswordChange = lazy(() =>
  import("../PasswordChange/passwordChange").then((m) => ({default: m.PasswordChangePage}))
  );
- Update all importers to use named imports

Fix deprecated InputProps

In PasswordChangeCard, replace:
InputProps={{endAdornment: ...}}
with:
slotProps={{input: {endAdornment: ...}}}
(matching what dialogReauthenticate.tsx already uses)

Fix colliding id in reauthenticate dialog

Change id="email" → id="reauth-email" and id="password" → id="reauth-password" in
dialogReauthenticate.tsx to avoid DOM collisions with the main page fields.

Files touched: passwordChange.tsx, dialogReauthenticate.tsx, routeConfig.ts,
passwordChange.test.tsx

---

Step 6: Add missing tests

passwordChange.test.tsx — Email change tests (~5 new tests)

- updateEmail called with correct email on button click
- Success message shown after email change
- Same-email validation shows error
- Error message shown on API failure
- Email validation disables button for invalid email

passwordChange.test.tsx — Password confirmation tests (~3 new tests)

- Button disabled when passwords don't match
- Mismatch error shown after typing in both fields
- Button enabled when passwords match

passwordChange.test.tsx — Loading & disable-after-success tests (~3 new tests)

- Submit button shows loading state during API call
- Form fields disabled after successful change
- "Go to login" button appears after successful reset-flow password change

**tests**/passwordChangeReducer.test.ts (new file, ~8 tests)

Pure function tests for all reducer actions:

- UPDATE_FIELD — updates correct field
- EMAIL_ERROR — sets emailError, clears successEmailChange
- PASSWORD_ERROR — sets passwordError, clears successPwChange
- SUCCESS_MAIL_CHANGE — sets success, clears error
- SUCCESS_PW_CHANGE — sets success, clears error
- SUCCESS_REAUTHENTICATION — opens snackbar
- SNACKBAR_CLOSE — closes snackbar
- Unknown action throws error

**tests**/DialogReauthenticate.test.tsx (new file, ~6 tests)

- Renders with dialog open, shows title
- Pre-fills email from authUser
- Email field is disabled when authUser provided
- Successful sign-in calls handleOk
- Failed sign-in shows error message
- Cancel calls handleClose

Files touched: passwordChange.test.tsx (additions), passwordChangeReducer.test.ts (new),
DialogReauthenticate.test.tsx (new)

---

Execution Order

Step 1 (correctness fixes) ← Foundation, type safety first
↓
Step 2 (Sentry) ← Quick, independent
↓
Step 3 (password confirmation + hint) ← Security improvement
↓
Step 4 (UX improvements) ← After Step 3 (changes same UI)
↓
Step 5 (conventions) ← After Steps 1-4 (changes exports/imports)
↓
Step 6 (tests) ← Last (tests the final state)

Verification

After each step:

1. npx tsc --noEmit | grep -i password — zero new type errors
2. npx jest --testPathPatterns="PasswordChange" --watchAll=false — all tests pass
3. After Step 3: manual browser check — try password change with mismatched confirmation
4. After Step 4: verify loading spinner appears, form disables after success, "Go to login"
   appears in reset flow
5. After Step 6: verify new test coverage

Ready to implement when you are.

---

Product Folder — Full Refactoring Plan

Context

The Product folder (src/components/Product/, 2,892 LOC across 7 files) manages
product/ingredient master data (food items used in recipes and shopping lists). It follows
the same legacy patterns that the Material folder had before its recent refactoring: a dead
Firebase class file used only for types/enums, new Product() constructors across ~24
importing files, duplicate dialog type const/enum, console.error instead of Sentry, missing
tests, and convention violations. The Product class and its enums (Allergen, Diet,
DietProperties) are imported by ~24 files across the codebase, making type extraction the
highest-risk change — identical in scope to the Material refactoring.

Issues Summary

┌─────┬──────────┬───────────────────────────────────┬────────┬────────────────────────┐
│ # │ Category │ Issue │ Severi │ File │
│ │ │ │ ty │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ │ product.class.ts static methods │ │ │
│ 1 │ Dead │ (Firebase) unused — only types, │ High │ product.class.ts │
│ │ code │ enums, findSimilarProducts, │ │ │
│ │ │ createEmptyDietProperty needed │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ │ Redundant PRODUCT_DIALOG_TYPE │ │ │
│ 2 │ Correctn │ const alongside ProductDialog │ Medium │ dialogProduct.tsx:105- │
│ │ ess │ enum — code mixes both (8 │ │ 108 │
│ │ │ references to const, 3 to enum) │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 3 │ Correctn │ parseInt(event.target.value) │ Low │ dialogProduct.tsx:313 │
│ │ ess │ without radix │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 4 │ Correctn │ newValue?: any parameter — loses │ Medium │ dialogProduct.tsx:232 │
│ │ ess │ type safety │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 5 │ Correctn │ onClose uses Firebase ValueObject │ Low │ dialogProduct.tsx:458 │
│ │ ess │ type for event parameter │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ Correctn │ Dead variable: const product = │ │ │
│ 6 │ ess │ new Product() created before │ Low │ dialogProduct.tsx:379 │
│ │ │ switch, only used in EDIT branch │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 7 │ Correctn │ Empty console.info("") in unused │ Low │ products.tsx:1101 │
│ │ ess │ handler │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 8 │ Correctn │ Deprecated DataGrid hide: true │ Medium │ products.tsx:894 │
│ │ ess │ prop │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ Correctn │ Deprecated DataGrid pageSize/onPa │ │ │
│ 9 │ ess │ geSizeChange/rowsPerPageOptions │ Medium │ products.tsx:1138-1140 │
│ │ │ (v5 API) │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 10 │ Correctn │ Unsafe product as ProductDomain │ Medium │ products.tsx:490 │
│ │ ess │ cast │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ Error │ console.warn / console.error │ │ dialogProduct.tsx:426, │
│ 11 │ handling │ instead of Sentry (5 occurrences) │ Medium │ 429, products.tsx:393, │
│ │ │ │ │ 414,440 │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 12 │ Conventi │ All 3 component files use export │ Medium │ All files │
│ │ on │ default │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ Conventi │ Missing/incomplete JSDoc on │ │ productAutocomplete.ts │
│ 13 │ on │ ProductAutocomplete (@param │ Low │ x:44-48 │
│ │ │ param0) │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ │ Conventi │ Hardcoded German text "Zu │ │ │
│ 14 │ on │ Material umwandeln" instead of │ Low │ products.tsx:1169 │
│ │ │ text constant │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 15 │ Performa │ createFilterOptions<Product>() │ Medium │ productAutocomplete.ts │
│ │ nce │ called every render │ │ x:59 │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 16 │ Performa │ DATA_GRID_COLUMNS array recreated │ Medium │ products.tsx:869-990 │
│ │ nce │ every render │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 17 │ Performa │ useMemo eslint-disable with │ Low │ products.tsx:865-866 │
│ │ nce │ missing deps │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 18 │ Performa │ Inline style={{}} instead of MUI │ Low │ products.tsx:880,979,1 │
│ │ nce │ sx prop (3 occurrences) │ │ 115 │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 19 │ UX │ ESC key does nothing in dialog — │ Low │ dialogProduct.tsx:458- │
│ │ │ blocks standard close │ │ 462 │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 20 │ Tests │ No tests for ProductAutocomplete │ High │ — │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 21 │ Tests │ No tests for productsReducer │ Medium │ — │
│ │ │ (pure function) │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 22 │ Tests │ No tests for findSimilarProducts │ Medium │ — │
│ │ │ (pure function) │ │ │
├─────┼──────────┼───────────────────────────────────┼────────┼────────────────────────┤
│ 23 │ Tests │ No tests for DialogProduct CREATE │ Medium │ — │
│ │ │ mode │ │ │
└─────┴──────────┴───────────────────────────────────┴────────┴────────────────────────┘

NOT in scope (tracked as tech debt):

- Allergen and Diet numeric→string enum conversion — affects 20+ files and Repository
  mapping. Separate PR.
- ReducerActions numeric enum — internal, no DB mapping.
- Full ProductDomain ↔ Product type unification — requires Repository changes.
- productAutocomplete.tsx:67 unsafe double type-cast for MUI Autocomplete onChange — this
  is a codebase-wide pattern shared with materialAutocomplete.tsx and itemAutocomplete.tsx.
  Fixing it requires changing the onChange prop signature and all call sites. Track as tech
  debt.

---

Step 1: Extract types from product.class.ts → product.types.ts + productUtils.ts

Goal: Remove the dead Firebase class, keep only what ~24 files actually use. Mirror the
Material refactoring pattern.

Create src/components/Product/product.types.ts

- Export Allergen enum (keep numeric values — string conversion is separate tech debt)
- Export Diet enum (keep numeric values)
- Export type DietProperties = { allergens: Allergen[]; diet: Diet }
- Export type ProductDepartment = { uid: string; name: string }
- Export type Product = { uid: string; name: string; department: ProductDepartment;
  shoppingUnit: string; dietProperties: DietProperties; usable: boolean }
- Export createEmptyProduct(): Product factory function (replaces new Product())
- Export createEmptyDietProperty(): DietProperties factory function (replaces
  Product.createEmptyDietProperty())
- Named exports, German JSDoc

Create src/components/Product/productUtils.ts

- Move findSimilarProducts() here (pure business logic, no UI/DB dependency)
- Import Product type from product.types.ts
- German JSDoc

Update ~24 importing files

- import Product, {Allergen, Diet, DietProperties} from "./product.class" → import
  {Product, Allergen, Diet, DietProperties} from "./product.types"
- new Product() → object literal or createEmptyProduct()
- Product.createEmptyDietProperty() → createEmptyDietProperty()
- Product.findSimilarProducts(...) → findSimilarProducts(...) (import from productUtils.ts)

Update ProductRepository.ts

- Import Product type from product.types.ts
- Make ProductDomain a type alias for Product (same as Material pattern), adding
  nameSingular to Product type

Update lazy import in routeConfig.ts

- Update after named export change (Step 4)

Delete product.class.ts

Files touched: ~30 files (24 importers + new types file + new utils file + deleted class +
repository)

---

Step 2: Fix dialogProduct.tsx correctness + error handling + UX

1.  Delete PRODUCT_DIALOG_TYPE const (issue 2). Replace all 8 references with
    ProductDialog.CREATE / ProductDialog.EDIT
2.  Fix parseInt without radix (issue 3): parseInt(event.target.value, 10)
3.  Replace any parameter (issue 4): newValue?: string | Product | Department | Unit | null
4.  Fix ValueObject import (issue 5): Remove Firebase import, change \_event: ValueObject →
    \_event: object
5.  Fix dead variable (issue 6): Move product creation inside EDIT case only, use object
    literal
6.  Replace console.warn/console.error with Sentry (issue 11)
7.  Fix ESC key blocking (issue 19): Allow escapeKeyDown, block only backdropClick
8.  Named export (issue 12): export {DialogProduct}
9.  Update all importers of DialogProduct to use named import

Files touched: dialogProduct.tsx, dialogProduct.test.tsx, + 3 importers (recipe.edit.tsx,
shoppingList.tsx, dialogGoods.tsx)

---

Step 3: Fix productAutocomplete.tsx — performance, JSDoc, named export

1.  Move createFilterOptions<Product>() to module level (issue 15)
2.  Fix incomplete JSDoc (issue 13): Full German JSDoc with @param descriptions
3.  Named export (issue 12): export {ProductAutocomplete}
4.  Replace new Product() with createEmptyProduct() (already done in Step 1)
5.  Update all importers to use named import

Files touched: productAutocomplete.tsx, + 4 importers (convertItem.tsx, mergeItems.tsx,
recipe.edit.tsx, dialogGoods.tsx)

---

Step 4: Fix products.tsx — deprecated API, error handling, performance, conventions

1.  Remove empty console.info("") (issue 7): Replace with empty function body or remove
    handler
2.  Fix deprecated hide: true (issue 8): Use columnVisibilityModel={{ uid: false }}
3.  Fix deprecated DataGrid pagination (issue 9): Replace
    pageSize/onPageSizeChange/rowsPerPageOptions with
    paginationModel/onPaginationModelChange/pageSizeOptions
4.  Fix unsafe cast (issue 10): Map product to ProductDomain properly: { ...product,
    nameSingular: product.name }
5.  Replace 3x console.error with Sentry (issue 11)
6.  Named export (issue 12): export {ProductsPage}
7.  Add text constant CONVERT_TO_MATERIAL (issue 14): German: "Zu Material umwandeln"
8.  Replace 3x inline style with sx (issue 18)
9.  Memoize DATA_GRID_COLUMNS (issue 16): React.useMemo(() => [...], [editMode, theme])
10. Fix useMemo deps (issue 17): Add proper deps, remove eslint-disable
11. Export reducer, actions, initialState, types for testing
12. Update routeConfig.ts lazy import for named export

Files touched: products.tsx, routeConfig.ts, constants/text.ts, products.test.tsx

---

Step 5: Add missing tests

**tests**/productUtils.test.ts (new, ~8 tests)

Pure function tests for findSimilarProducts:

- Returns empty for no matches
- Returns similar products above threshold
- Sorts by descending similarity
- Excludes filtered words ("glutenfrei", "laktosefrei", "aha")
- Handles single-word product names
- Handles multi-word product names
- createEmptyDietProperty returns correct defaults
- createEmptyProduct returns correct defaults

**tests**/productsReducer.test.ts (new, ~10 tests)

Pure function tests for all reducer actions:

- PRODUCTS_FETCH_INIT → sets loading
- PRODUCTS_FETCH_SUCCESS → replaces products, clears changedUids
- PRODUCT_UPDATED → replaces correct product, adds uid
- PRODUCTS_SAVED → clears changedUids, shows snackbar
- PRODUCTS_EDIT_CANCELLED → restores snapshot
- NEWEST_PRODUCTS_FETCH_SUCCESS → sets UIDs
- NEWEST_PRODUCTS_CLEAR → clears UIDs
- PRODUCT_CONVERTED_TO_MATERIAL → removes product
- SNACKBAR_CLOSE → closes snackbar
- GENERIC_ERROR → sets error

**tests**/ProductAutocomplete.test.tsx (new, ~5 tests)

- Renders with a selected product value
- Shows "add" option when allowCreateNewProduct=true
- Does NOT show "add" option when allowCreateNewProduct=false
- Calls onChange with correct parameters
- Renders with custom label

Extend **tests**/dialogProduct.test.tsx (~3 new tests)

- CREATE mode: insertProduct called with correct args
- CREATE mode: similar products dialog appears for matching names
- CREATE mode: choosing existing product calls handleChooseExisting

Files touched: 3 new test files, 1 extended test file, products.tsx (export reducer +
types)

---

Step 6: Update tech-debt.md

Add the following entries that are out of scope for this refactoring:

1.  Type Safety section — Add: ProductDomain ↔ Product type unification. ProductRepository
    uses ProductDomain with nameSingular field, app uses Product without it. Causes unsafe cast
    at products.tsx:490. Unification requires Repository changes + all consumers.
    Priorität: mittel · Komplexität: mittel
2.  MUI Deprecated APIs section — Add: productAutocomplete.tsx line 67,
    materialAutocomplete.tsx line 67, itemAutocomplete.tsx — same unsafe double type-cast
    pattern (event as unknown as React.ChangeEvent<HTMLInputElement>). All Autocomplete
    onChange handlers share this issue. Fix requires changing onChange prop signature to
    React.SyntheticEvent across all Autocomplete components and their 10+ consumers.
    Priorität: tief · Komplexität: mittel
3.  Fix existing entry — Update MaterialType enum entry (line 14): change file reference
    from material.class.ts to material.types.ts (file was deleted during Material refactoring).

Files touched: docs/claude/tech-debt.md

---

Execution Order

Step 1 (types extraction) ← Foundation, must be first (highest risk, ~30 files)
↓
Steps 2, 3 ← Independent (dialogProduct, autocomplete fixes)
↓
Step 4 (products.tsx) ← After Step 1 (both change imports + named exports)
↓
Step 5 (tests) ← After Step 4 (tests the final state)
↓
Step 6 (tech-debt.md) ← Any time (documentation only)

Verification

After each step:

1.  npx tsc --noEmit | grep -i product — zero new type errors
2.  npx jest --testPathPatterns="Product" --watchAll=false — all Product tests pass
3.  After Step 1: npx jest --watchAll=false — full suite (30 files changed)
4.  After Step 4: verify DataGrid pagination still works (no runtime warnings about
    deprecated props)
5.  After Step 5: verify new test coverage
6.  After all steps: manual browser check

- Navigate to /products
- Edit mode → change usable/allergen checkboxes → Save → verify only changed products
  saved
- Cancel → verify snapshot restore
- Create dialog → validate empty name, missing department, duplicate name
- Similar products popup → verify choosing existing works
- Context menu → "Zu Material umwandeln" → verify conversion
- ESC on dialog → verify it closes (Step 2)
- DataGrid pagination → verify page size dropdown works (Step 4)

---

Recipe Folder — Full Refactoring Plan

Context

The Recipe folder (src/components/Recipe/, ~11,846 LOC across 18 files) is a core pillar of
the app — managing recipe creation, viewing, editing, scaling, commenting, and rating. It
has already been partially refactored (Supabase migration done for repositories), but many
convention violations remain: 15 files use export default, 38 console.error/warn/info calls
instead of Sentry, 63 inline style={{}} instead of MUI sx, missing JSDoc, missing tests,
dead Firebase code in 3 class files, and type safety issues.

Key constraint: Logic flow must NOT change. Improvements to state management, component
splitting, or architecture go to tech-debt.md.

Issues Summary

┌─────┬────────────┬───────────────────────────────┬───────┬──────────────────────────┐
│ # │ Category │ Issue │ Count │ Files │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ │ │ Firebase static methods in │ │ │
│ 1 │ Dead code │ recipeShort.class.ts (7 │ 7 │ recipeShort.class.ts │
│ │ │ methods, 0 callers) │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ │ │ Firebase methods in │ │ │
│ 2 │ Dead code │ recipe.comment.class.ts (2 │ 2 │ recipe.comment.class.ts │
│ │ │ methods, 0 callers) │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ │ │ Firebase methods in │ │ │
│ 3 │ Dead code │ recipe.rating.class.ts (2 │ 2 │ recipe.rating.class.ts │
│ │ │ methods, 0 callers) │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 4 │ Convention │ export default instead of │ 15 │ All except │
│ │ │ named exports │ files │ RecipeDrawer.tsx │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 5 │ Error │ console.error/warn/info │ 38 │ 7 files │
│ │ handling │ instead of Sentry │ total │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 6 │ Convention │ Inline style={{}} instead of │ 63 │ 7 files (excl. │
│ │ │ MUI sx │ total │ recipePdf.tsx) │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 7 │ Convention │ Missing JSDoc on components │ ~10 │ Most UI components │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 8 │ Type │ any type in DispatchAction │ 1 │ recipe.tsx:54 │
│ │ safety │ payload │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 9 │ Type │ Untyped (event) parameter │ 1 │ recipeCard.tsx:125 │
│ │ safety │ │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 10 │ Naming │ Typo RecipeIndetifier → │ 6 │ recipe.class.ts, │
│ │ │ RecipeIdentifier │ refs │ usedRecipes.class.ts │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 11 │ Convention │ Firebase ValueObject import │ 1 │ recipe.tsx:13 │
│ │ │ still used │ │ │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 12 │ Dead code │ Commented-out code │ 1 │ recipeCard.tsx:63 │
├─────┼────────────┼───────────────────────────────┼───────┼──────────────────────────┤
│ 13 │ Tests │ No tests for 12 of 15 │ 12 │ See table below │
│ │ │ component files │ │ │
└─────┴────────────┴───────────────────────────────┴───────┴──────────────────────────┘

NOT in scope (tracked as tech debt):

- Splitting recipe.edit.tsx (3,602 LOC) or recipe.view.tsx (2,648 LOC) — changes logic flow
- MenuType numeric → string enum conversion — affects DB mapping + ~15 files
- Firebase auth (AuthUser class) replacement — codebase-wide concern
- Deleting dead Firebase class files entirely — needs migration verification
- recipe.class.ts → named export conversion — 62 files blast radius, separate PR

---

Step 1: Extract types from dead class files → recipe.types.ts

Goal: Extract the types/interfaces and pure functions that are still used from the 3
Firebase-coupled class files, so they can eventually be deleted. Mirror the
material.types.ts / product.types.ts pattern.

Create src/components/Recipe/recipe.types.ts

From recipe.rating.class.ts:

- Export type Rating = { avgRating: number; noRatings: number; myRating: number }

From recipeShort.class.ts:

- Export type RecipeShort (all fields: uid, name, pictureSrc, tags, linkedRecipes,
  dietProperties, menuTypes, outdoorKitchenSuitable, created, source, type, rating,
  noComments?, variantName?)
- Export createEmptyRecipeShort(): RecipeShort factory (replaces new RecipeShort())
- Export createShortRecipeFromRecipe(recipe: Recipe): RecipeShort (move the pure in-memory
  conversion)

From recipe.comment.class.ts:

- Export type RecipeComment = { uid: string; user: UserShort; createdAt: Date; comment:
  string }

Fix typo

- Rename RecipeIndetifier → RecipeIdentifier in recipe.class.ts (line 148) and all 5 usages
  in usedRecipes.class.ts

Update imports (~20 files)

- Files importing RecipeShort type → import from ./recipe.types instead of
  ./recipeShort.class
- Files calling RecipeShort.createShortRecipeFromRecipe() → import standalone function from
  ./recipe.types
- Files using new RecipeShort() → use createEmptyRecipeShort()
- Files importing {Rating} → import from ./recipe.types
- recipe.class.ts → import Rating, RecipeShort from ./recipe.types

Keep re-exports temporarily

Add export {RecipeShort} from "./recipe.types" to recipeShort.class.ts and export {Rating}
from "./recipe.types" to recipe.rating.class.ts — so any missed importers still work.
Remove in a follow-up commit within the same step.

Files touched: ~22 files (18 RecipeShort importers + recipe.class.ts + recipe.types.ts new

- usedRecipes.class.ts typo fix)

Verification: npm run typecheck && npm run test

---

Step 2: Named exports + fixes for small dialog files

Convert 4 dialog files and recipePdf.tsx from export default to named exports. These have
1-2 importers each (all within Recipe folder).

dialogPublishRecipe.tsx

1.  Named export: export {DialogPublishRecipe}
2.  Add JSDoc to component

dialogScaleRecipe.tsx

1.  Named export: export {DialogScaleRecipe}
2.  Convert 2x inline style={{}} → sx
3.  Add JSDoc to component

dialogRecipeQuickView.tsx

1.  Named export: export {DialogRecipeQuickView}
2.  Convert 1x inline style={{}} → sx
3.  Add JSDoc to component

dialogReportError.tsx

1.  Named export: export {DialogReportError}
2.  Add JSDoc to component

recipePdf.tsx

1.  Named export: export {RecipePdf}
2.  Note: inline styles here are PDF-specific (@react-pdf/renderer), NOT MUI violations —
    leave as-is

Update importers

- Each dialog is imported by 1-2 files in the Recipe folder (recipe.view.tsx,
  recipe.edit.tsx)
- recipePdf.tsx is imported by recipe.view.tsx

Files touched: 5 dialog/PDF files + 2 importers (recipe.view.tsx, recipe.edit.tsx)

Verification: npm run typecheck + dialogs render correctly in browser

---

Step 3: Named exports + fixes for recipeCard.tsx and recipes.tsx

recipeCard.tsx (307 LOC)

1.  Named export: export {RecipeCard} (also RecipeCardLoading, CardRibbon — already named
    exports)
2.  Fix untyped param line 125: (event) → (event: React.MouseEvent<HTMLButtonElement>)
3.  Remove commented-out code (line 63)
4.  Convert 3x inline style={{}} → sx (lines 144, 147, 164)
5.  Add JSDoc to RecipeCard component

recipes.tsx (1,243 LOC)

1.  Named export: export {RecipesPage}
2.  Convert remaining inline style={{}} → sx
3.  Add JSDoc to main component
4.  Update routeConfig.ts lazy import

Update importers

- RecipeCard is imported by recipes.tsx and dialogRecipeQuickView.tsx
- recipes.tsx is imported by routeConfig.ts

Files touched: 2 main files + routeConfig.ts + 1-2 importers

Verification: npm run typecheck + recipe list page renders correctly

---

Step 4: Fix recipe.tsx — conventions + error handling

1.  Named export: export {RecipePage}
2.  Remove Firebase ValueObject import (line 13) — replace style?: ValueObject in
    RecipeDividerProps with style?: React.CSSProperties
3.  Fix any type (line 54): Replace payload: {[key: string]: any} with discriminated union
    ReducerAction type (same pattern as products.tsx)
4.  Replace 3x console.error with Sentry.captureException
5.  Add JSDoc to component
6.  Update lazy import for RecipeEdit to handle named export: lazy(() =>
    import("./recipe.edit").then(m => ({default: m.RecipeEdit})))
7.  Update routeConfig.ts lazy import for RecipePage

Files touched: recipe.tsx, routeConfig.ts

Verification: npm run typecheck + recipe detail page loads

---

Step 5: Fix recipe.edit.tsx — error handling + conventions

This file is 3,602 LOC. We do NOT split it. Convention fixes only.

1.  Named export: export {RecipeEdit}
2.  Add import \* as Sentry from "@sentry/react"
3.  Replace 8x console.error with Sentry.captureException (with {extra: {context: "..."}})
4.  Convert 20x inline style={{}} → sx (do in batches, verify after each)
5.  Add JSDoc to main component and exported types/interfaces
6.  Fix any single-letter variable names in .map() callbacks

Files touched: recipe.edit.tsx

Verification: npm run typecheck + recipe edit page renders, form interactions work

---

Step 6: Fix recipe.view.tsx — error handling + conventions

Same approach for the 2,648 LOC view file.

1.  Named export: export {RecipeView}
2.  Add import \* as Sentry from "@sentry/react"
3.  Replace 14x console.error/warn with Sentry.captureException (use captureMessage for
    warn-level non-errors)
4.  Convert 31x inline style={{}} → sx (do in batches)
5.  Fix single-letter variable names (e.g. c → comment in .map())
6.  Add JSDoc to main component
7.  Update recipe.tsx lazy import if needed

Files touched: recipe.view.tsx, possibly recipe.tsx

Verification: npm run typecheck + recipe view page renders, comments and ratings work

---

Step 7: Add missing tests

**tests**/recipe.types.test.ts (new, ~8 tests)

- createEmptyRecipeShort() returns correct defaults
- createShortRecipeFromRecipe() converts correctly (use mock recipe from recipe.mock.ts)
- Rating type has correct shape
- RecipeComment type has correct shape

**tests**/recipeCard.test.tsx (new, ~5 tests)

- Renders with recipe data (name, image)
- Shows ribbon when provided
- Calls onClick when card is clicked
- RecipeCardLoading renders skeleton
- Calls onFabButtonClick when fab is clicked

**tests**/dialogScaleRecipe.test.tsx (new, ~4 tests)

- Renders with initial portions
- Shows unit conversion switch
- OK button returns scaled values
- Cancel calls onClose

**tests**/dialogPublishRecipe.test.tsx (new, ~3 tests)

- Renders dialog title
- OK calls onPublish
- Cancel calls onClose

**tests**/dialogReportError.test.tsx (new, ~3 tests)

- Renders dialog
- Submit calls onReport with text
- Cancel calls onClose

Files touched: 5 new test files

Verification: npm run test -- --testPathPatterns="Recipe"

---

Step 8: Update tech-debt.md

Add the following entries:

Enums

- MenuType in recipe.class.ts — numeric enum, needs string conversion to match Postgres
  ENUM. Affects ~15 files + Repository mapping.
  Priorität: mittel · Komplexität: mittel

Dead Code / Firebase Remnants

- recipeShort.class.ts — 7 static Firebase methods have zero callers (getShortRecipes*,
  delete*, deleteOverview). File can be deleted once types are extracted (Step 1 of this
  plan) and Firebase DB files are removed.
  Priorität: mittel · Komplexität: klein
- recipe.comment.class.ts — getComments() and save() have zero callers.
  RecipeCommentRepository handles all persistence. File can be deleted after type extraction.
  Priorität: mittel · Komplexität: klein
- recipe.rating.class.ts — getUserRating() and updateUserRating() have zero callers.
  RecipeRatingRepository handles all persistence. File can be deleted after type extraction.
  Priorität: mittel · Komplexität: klein

Large Files / Component Splitting

- recipe.edit.tsx (3,602 LOC) — should extract RecipeIngredients, RecipePreparationSteps,
  RecipeMaterials into separate files.
  Priorität: tief · Komplexität: gross
- recipe.view.tsx (2,648 LOC) — should extract comments, ratings, scaling sections.
  Priorität: tief · Komplexität: gross

Convention

- recipe.class.ts default → named export — 62 files import this class. Conversion should be
  a standalone commit/PR due to massive blast radius.
  Priorität: mittel · Komplexität: mittel (mechanical, but high blast radius)

Files touched: docs/claude/tech-debt.md

---

Execution Order

Step 1 (types extraction) ← Foundation, must be first
↓
Steps 2, 3 ← Independent of each other, after Step 1
↓
Step 4 (recipe.tsx) ← After Step 5 (lazy import coordination for RecipeEdit)
↓
Steps 5, 6 ← Independent (recipe.edit, recipe.view), after Step 2 (dialog
imports)
↓
Step 7 (tests) ← After Steps 1-6 (tests the final state)
↓
Step 8 (tech-debt.md) ← Any time

Verification

After each step:

1.  npm run typecheck — zero new type errors
2.  npm run test — all tests pass
3.  After Step 1: full test suite (20+ files changed)
4.  After Steps 5-6: manual browser check

- Navigate to /recipes → recipe list renders with cards
- Open a recipe → view page renders (comments, ratings, scaling)
- Edit a recipe → edit page renders (ingredients, steps, materials)
- Scale recipe → dialog works
- Publish recipe → dialog works
- Report error → dialog works

5.  After Step 7: verify new test coverage

Key Reference Files

- src/components/Material/material.types.ts — pattern for recipe.types.ts
- src/components/Material/materials.tsx — Sentry error handling pattern
- src/components/Product/products.tsx — discriminated union reducer pattern
- src/components/Recipe/RecipeDrawer.tsx — exemplary code within same folder

---

Request Folder — Full Refactoring Plan

Context

The Request folder (src/components/Request/, ~2,112 LOC across 4 files) manages the
request/approval workflow for recipe publishing and error reporting. It's already
well-migrated to Supabase with good architecture (3-layer pattern), proper RLS, and mostly
good JSDoc. However, convention violations remain: 2 files use export default, 5
console.error calls alongside Sentry, 16 inline style={{}} in the dialog, a
setState-during-render anti-pattern, dead code, single-letter variables, and zero tests.

Key constraint: Logic flow must NOT change. Convention fixes, performance improvements,
Firebase decoupling, UX improvements, and test additions.

Issues Summary

┌─────┬─────────────┬────────────────────────┬───────┬─────────────────────────────────┐
│ # │ Category │ Issue │ Count │ Files │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ 1 │ Convention │ export default instead │ 2 │ requestOverview.tsx, │
│ │ │ of named exports │ │ dialogRequest.tsx │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ Error │ console.error │ │ requestService.ts (4), │
│ 2 │ handling │ alongside Sentry │ 5 │ RequestCommentRepository.ts (1) │
│ │ │ (redundant) │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ 3 │ Convention │ Inline style={{}} │ 16 │ dialogRequest.tsx │
│ │ │ instead of MUI sx │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ 4 │ Performance │ setState during render │ 1 │ requestOverview.tsx:762-773 │
│ │ │ body (anti-pattern) │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ useNavigate │ │ │
│ 5 │ Dead code │ imported+declared but │ 1 │ requestOverview.tsx:9,257 │
│ │ │ never called │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ recipes state field + │ │ │
│ 6 │ Dead code │ FETCH*RECIPE*\* reducer │ ~20 │ requestOverview.tsx │
│ │ │ actions never │ LOC │ │
│ │ │ dispatched │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ ReducerActions enum │ │ │
│ 7 │ Convention │ uses implicit numeric │ 1 │ requestOverview.tsx:80-91 │
│ │ │ values │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ Single-letter │ │ request.class.ts (1), │
│ 8 │ Naming │ variables in │ 6 │ requestOverview.tsx (4), │
│ │ │ .filter()/.map() │ │ dialogRequest.tsx (1+3 event) │
│ │ │ callbacks │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ Empty comment can be │ │ │
│ 9 │ Security │ submitted (no │ 1 │ dialogRequest.tsx:292-294 │
│ │ │ validation) │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ AuthUser import path │ │ │
│ 10 │ Naming │ points to Firebase/ │ 2 │ dialogRequest.tsx:82, │
│ │ │ folder despite being │ │ requestService.ts:17 │
│ │ │ fully Supabase-wired │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ │ │ resolveDate stored in │ │ │
│ 11 │ UX │ DB but never displayed │ 1 │ dialogRequest.tsx │
│ │ │ in dialog │ │ │
├─────┼─────────────┼────────────────────────┼───────┼─────────────────────────────────┤
│ 12 │ Tests │ No tests for any file │ 4 │ All │
│ │ │ │ files │ │
└─────┴─────────────┴────────────────────────┴───────┴─────────────────────────────────┘

NOT in scope (tracked as tech debt):

- Converting Request class to standalone functions — works fine as static class
- Moving/renaming AuthUser class out of Firebase/ folder — codebase-wide (50+ files), needs
  own PR

Clarification on AuthUser: The AuthUser class is already fully Supabase-wired. The auth
context (authUserContext.tsx) populates it from UserRepository (Supabase public.users
table) + Supabase Auth session. The Firebase fallback is only a migration bridge. The class
is a plain data container with a misleading import path. Since 50+ files import it and
there is no alternative type yet, the Request folder will keep using it. The file path
rename is tracked as tech-debt.

---

Step 1: Fix request.class.ts + requestService.ts — quick wins

Goal: Fix single-letter variable and remove redundant console.error calls.

request.class.ts

- Line 171: rename (t) → (transition) in .filter() callback

requestService.ts

- Remove 4x console.error calls (lines 62, 92, 115, 192-195) — Sentry already captures
  alongside each one

RequestCommentRepository.ts (outside Request folder, but directly related)

- Line 224: remove console.error(...) — add Sentry.captureException(err) (Sentry is already
  imported in this file)

Files touched: 3

Verification: npx tsc --noEmit + npx jest --testPathPatterns="Request" --no-coverage
--watchAll=false

---

Step 2: Fix requestOverview.tsx — dead code, convention, named export

Dead code removal

1.  Remove useNavigate import (line 9) and const navigate = useNavigate() (line 257) — never
    called
2.  Remove Recipe, {Recipes} import (line 74) — Recipes type used in state but
    FETCH*RECIPE*\* is never dispatched
3.  Remove recipes: Recipes from State type and initialState
4.  Remove FETCH_RECIPE_INIT and FETCH_RECIPE_SUCCESS from ReducerActions, DispatchAction,
    and requestReducer

Convention fixes

5.  ReducerActions enum → string values: FETCH_INIT = "FETCH_INIT", etc.
6.  Named export: export const RequestOverviewPage = ... — remove export default at bottom
7.  Single-letter variables: (r) → (request) at lines 309, 341, 740, 750

Update importer

8.  routeConfig.ts line 30: lazy(() => import("../Request/requestOverview").then((module) =>
    ({default: module.RequestOverviewPage})))

Files touched: requestOverview.tsx, routeConfig.ts

Verification: npx tsc --noEmit + manual: navigate to /requestoverview, confirm page loads

---

Step 3: Fix requestOverview.tsx — Performance: setState-during-render → useMemo

Problem: Lines 762-773 call setRequestsUi(...) directly in the RequestTable render body.
This triggers an extra re-render cycle every time props change — a React anti-pattern.

Solution: Replace requestsUi state + render-body setState with useMemo:

const requestsUi = React.useMemo(
() => createRequestsForUi(requests, searchString),
[requests, searchString],
);

This eliminates:

- const [requestsUi, setRequestsUi] = React.useState<RequestUi[]>([]) (line 718)
- The entire conditional block at lines 762-773
- The setRequestsUi(...) call inside updateSearchString (line 728) — useMemo recalculates
  automatically

Also extract createRequestsForUi to module scope (it's a pure function).

Files touched: requestOverview.tsx

Verification: npx tsc --noEmit + manual: open Request overview, verify table displays,
search works, Active/All toggle works

---

Step 4: Fix dialogRequest.tsx — named export, inline styles, variables, validation,
Firebase decoupling, resolveDate

Named export

1.  export const DialogRequest = ... — remove export default at bottom
2.  Update import in requestOverview.tsx line 65: import {DialogRequest} from
    "./dialogRequest"

Inline styles → sx (16 occurrences)

All on MUI components. Key conversions:

- <Dialog style={{zIndex: 500}}> → sx={{zIndex: 500}}
- <DialogTitle sx={classes.xxx} style={{backgroundImage...}}> → merge into single
  sx={{...classes.xxx, backgroundImage: ...}}
- <Typography sx={classes.xxx} style={{paddingLeft: "2ex"}}> → merge: sx={{...classes.xxx,
  pl: "2ex"}}
- <DialogContent style={{overflow: "unset"}}> → sx={{overflow: "unset"}}
- <TextField style={{marginBottom: "8px"}}> → sx={{mb: 1}} (×3)
- <Button style={{marginRight: "8px"}}> → sx={{mr: 1}} (×3)
- <Link style={{cursor: "pointer"}}> → sx={{cursor: "pointer"}} (×3)
- <Typography style={{marginTop: "4ex"}}> → sx={{mt: "4ex"}}
- <Typography style={{marginTop: "1ex", marginBottom: "2ex"}}> → sx={{mt: "1ex", mb:
  "2ex"}}

Variable renames

- Line 663: (c, counter) → (requestComment, commentIndex)
- Lines 484, 527, 561: (e) → (event) in onChange handlers

Empty comment validation (security/UX fix)

Add guard in saveComment:
const saveComment = () => {
if (!comment.trim()) return;
handleAddComment(comment.trim());
setComment("");
};
Disable the "Add Comment" button when empty:
<Button size="small" onClick={saveComment} disabled={!comment.trim()}>

UX: Display resolveDate for closed requests

RequestDomain.resolveDate (Date | null) is stored but never shown. Display it in the dialog
for closed requests (done/declined), directly after the creation date.

1.  Add text constant in src/constants/text.ts:
    export const REQUEST_RESOLVE_DATE = "Abschlussdatum";
2.  Import it in dialogRequest.tsx
3.  Add a FormListItem after the creation date, conditionally shown when resolveDate is not
    null:
    {request.resolveDate && (
    <FormListItem
    key={"RequestResolveDate"}
    id={"RequestResolveDate"}
    value={request.resolveDate.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    })}
    label={TEXT_REQUEST_RESOLVE_DATE}
    />
    )}

Files touched: dialogRequest.tsx, requestOverview.tsx (import only), src/constants/text.ts
(1 new constant)

Verification: npx tsc --noEmit + manual: open request dialog, verify layout identical, try
empty comment (blocked), test decline/done/backToAuthor inline forms, verify resolveDate
shows for closed requests

---

Step 5: Extract reducer → requestOverviewReducer.ts

Goal: Separate pure logic (~140 LOC) from UI for testability. Follows productsReducer
pattern.

Create src/components/Request/requestOverviewReducer.ts

Move from requestOverview.tsx:

- ReducerActions enum
- DispatchAction type
- State type
- initialState
- requestReducer function
- RequestStateFilter enum

Export all as named exports.

Update requestOverview.tsx

- Import from ./requestOverviewReducer
- Remove moved code

Files touched: requestOverviewReducer.ts (new), requestOverview.tsx

Verification: npx tsc --noEmit + manual: request overview page works as before

---

Step 6: Create tests

**tests**/request.class.test.ts (~12 tests)

Pure function tests — no mocking needed:

- getNextPossibleTransitions(): valid combos for recipePublish and reportError, wildcard
  handling, unknown type returns empty, empty status returns empty
- translateStatus(): all 5 enum values + unknown fallback
- translateType(): both enum values + unknown fallback
- createChangeLogEntry(): correct structure, prepends entry, doesn't mutate original array
- isClosedStatus(): done/declined → true, all others → false

**tests**/requestOverviewReducer.test.ts (~8 tests)

Follow productsReducer.test.ts pattern:

- FETCH_INIT → isLoading true
- FETCH_SUCCESS → populates requests + activeRequests, isLoading false
- FETCH_CLOSED_REQUESTS → merges with active, sets closedRequestsFetched
- UPDATE_REQUEST_SELECTION → Active vs All filter
- UPDATE_SINGLE_REQUEST → updates correct item by uid
- SNACKBAR_SHOW / SNACKBAR_CLOSE → snackbar state toggles
- GENERIC_ERROR → sets error, isLoading false

**tests**/requestService.test.ts (~6 tests)

Mock supabase.functions.invoke, database.recipes.patch, database.feeds.insertFeed:

- executePostAction with recipePublish + done → calls patch, triggers notification, creates
  feed
- executePostAction with recipePublish + declined → triggers declined notification
- executePostAction with reportError + done → triggers fixed notification
- executePostAction error → catches, calls Sentry, doesn't throw
- triggerNotification → calls supabase.functions.invoke with correct params
- triggerNewRequestNotification → maps type to correct scenario string

**tests**/dialogRequest.test.tsx (~8 tests)

UI tests with mocked handlers:

- Renders request number in title
- Shows stepper with correct active step for each status
- Calls handleRecipeOpen when recipe link clicked
- Calls handleAddComment with trimmed text
- Disables "Add Comment" button when comment is empty
- Shows decline reason form when decline link clicked
- Calls handleUpdateStatus with reason when decline confirmed
- Shows "Assign to me" button for community leaders who are not assignee/author

Files touched: 4 new test files

Verification: npx jest --testPathPatterns="Request" --no-coverage --watchAll=false

---

Step 7: Update tech-debt.md

Convention

- Request class → standalone functions — Static utility class with no instance state. Could
  be converted to plain exported functions for consistency with modern patterns. Low urgency
  since it works correctly.
  Priorität: tief · Komplexität: klein

Firebase Folder Cleanup

- Move AuthUser class out of Firebase/ folder — AuthUser is fully Supabase-wired (populated
  from UserRepository + Supabase Auth session), but lives at
  src/components/Firebase/Authentication/authUser.class.ts. The import path misleads into
  thinking Firebase is involved. Move to src/components/Session/ or src/components/Auth/ and
  update 50+ importers. Consider converting from class to type/interface at the same time.
  Priorität: hoch · Komplexität: mittel (mechanical find-and-replace, but 50+ files)

Files touched: docs/claude/tech-debt.md

---

Execution Order

Step 1 (quick wins) ← Foundation, low risk
↓
Step 2 (dead code + export) ← Must be before Step 3 (cleaner state)
↓
Step 3 (useMemo performance) ← Depends on Step 2 (dead state removed)
↓
Step 4 (dialog: styles + UX) ← Independent of Steps 2-3
↓
Step 5 (reducer extraction) ← After Steps 2-3 (reducer is clean)
↓
Step 6 (tests) ← After Steps 1-5 (tests final state)
↓
Step 7 (tech-debt.md) ← Any time

Verification

After each step:

1.  npx tsc --noEmit — zero new type errors
2.  After Steps 2-4: manual browser check

- Navigate to /requestoverview → page loads with table
- Click a request → dialog opens, shows details
- Search → table filters correctly
- Toggle Active/All → works, loads closed requests
- Add comment → works (empty comment blocked)
- Status transitions → inline forms render, confirm/cancel work
- Closed requests show resolveDate in dialog

3.  After Step 6: all new tests pass

Key Reference Files

- src/components/Product/**tests**/productsReducer.test.ts — pattern for reducer tests
- src/components/Material/materials.tsx — Sentry-only error handling pattern
- src/components/Recipe/RecipeDrawer.tsx — exemplary named export pattern
- src/components/App/routeConfig.ts:30 — lazy import to update

---

Session Folder — Full Refactoring Plan

Context

The Session folder (src/components/Session/, 4 source files + 1 test file, ~444 LOC)
manages authentication context, route guards, email verification, and unauthorized access
pages. The architecture is sound — proper React Context for auth state, guard composition
pattern, and Supabase integration. However, there's an architecture/performance bug in
AuthorizationGuard (creates N subscriptions per guarded route), convention violations (2
default exports, 2 console.error, 1 any type, hardcoded strings), missing error handling,
and 3 files with zero tests.

Key constraint: Logic flow must NOT change for AuthUserProvider (the auth state machine is
critical). The AuthorizationGuard subscription model will be replaced with context-reactive
logic — same behavior, better architecture.

---

Issues Summary

#: 1
Category: Architecture/Perf
Issue: AuthorizationGuard creates own onAuthStateChange subscription per mount — N
subscriptions for N guarded routes
Files: authUserContext.tsx:204-215
────────────────────────────────────────
#: 2
Category: Convention
Issue: export default instead of named exports
Files: emailVerificationGuard.tsx:112, noAuth.tsx:73
────────────────────────────────────────
#: 3
Category: Error handling
Issue: console.error instead of Sentry
Files: authUserContext.tsx:114,147
────────────────────────────────────────
#: 4
Category: Type safety
Issue: (picSrc as any)?.normalSize
Files: authUserContext.tsx:72
────────────────────────────────────────
#: 5
Category: Security
Issue: JSON.parse(cachedString) as AuthUser — no validation of localStorage data
Files: authUserContext.tsx:62
────────────────────────────────────────
#: 6
Category: Error handling
Issue: No .catch() on resendConfirmationEmail promise
Files: emailVerificationGuard.tsx:67-69
────────────────────────────────────────
#: 7
Category: Convention
Issue: Hardcoded string instead of text constant
Files: emailVerificationGuard.tsx:94
────────────────────────────────────────
#: 8
Category: Code quality
Issue: Overly nested if/else in needsEmailVerification
Files: emailVerificationGuard.tsx:27-43
────────────────────────────────────────
#: 9
Category: Convention
Issue: <br /> instead of MUI spacing
Files: emailVerificationGuard.tsx:80
────────────────────────────────────────
#: 10
Category: Performance
Issue: Timer with [timer] dependency, not using functional update
Files: noAuth.tsx:37
────────────────────────────────────────
#: 11
Category: Convention
Issue: Magic number 20 for countdown
Files: noAuth.tsx:23
────────────────────────────────────────
#: 12
Category: DRY
Issue: Duplicated navigation logic
Files: noAuth.tsx:31-33,57-59
────────────────────────────────────────
#: 13
Category: Convention
Issue: Missing JSDoc on 4+ public exports
Files: Multiple files
────────────────────────────────────────
#: 14
Category: Tests
Issue: No tests for authUserContext.tsx, noAuth.tsx, GuardedRoute.tsx
Files: —
────────────────────────────────────────
#: 15
Category: Tests
Issue: Existing test uses as any, default import, missing error test
Files: emailVerificationGuard.test.tsx

NOT in scope (tracked as tech debt):

- Moving AuthUser class out of Firebase/ folder — 50+ importers, needs own PR
- Admin client bypass in authUserContext.tsx:85 — already tracked in tech-debt.md
- Firebase fallback listener removal — depends on full migration completion

---

Step 1: Fix authUserContext.tsx — Architecture fix + convention fixes

Goal: Fix the AuthorizationGuard subscription leak, replace any + console.error, add
localStorage validation, add JSDoc.

1a. AuthorizationGuard: Replace subscription with context-reactive logic (lines 196-224)

Problem: Every guarded route creates its own onAuthStateChange subscription. With ~20
guarded routes, that's 20 concurrent Supabase listeners for the same event — a performance
waste and architectural smell.

Solution: React to authUser context changes directly. Use a one-time getSession() check to
distinguish "loading" from "signed out" when authUser is null.

export const AuthorizationGuard: React.FC<AuthorizationGuardProps> = ({
condition,
children,
}) => {
const authUser = useAuthUser();
const database = useDatabase();
const navigate = useNavigate();

useEffect(() => {
if (authUser === null) {
// authUser null = entweder noch am Laden oder abgemeldet.
// Einmalige Session-Prüfung, um die beiden Fälle zu unterscheiden.
database.auth.getSession().then((session) => {
if (!session) {
navigate(ROUTE_SIGN_IN);
}
// Wenn Session vorhanden, warten bis AuthUserProvider den authUser setzt.
});
} else if (!condition(authUser)) {
navigate(ROUTE_NO_AUTH);
}
}, [authUser, condition, navigate]);

return condition(authUser) ? <>{children}</> : null;
};

This eliminates the onAuthStateChange subscription entirely. The AuthUserProvider remains
the single source of truth for auth state.

1b. Fix any type (line 72)

Replace (picSrc as any)?.normalSize with a typed cast:

// Kompatibilitäts-Shim: Im Cache kann pictureSrc noch als altes
// Picture-Objekt vorliegen (vor der Storage-Migration)
type LegacyPictureSrc = {normalSize?: string};
const picSrc: unknown = cached.publicProfile.pictureSrc;
if (typeof picSrc !== "string") {
cached.publicProfile.pictureSrc =
(picSrc as LegacyPictureSrc)?.normalSize ?? "";
}

1c. Replace console.error with Sentry (lines 114, 147)

Add import \* as Sentry from "@sentry/react" and replace:
// Line 114
Sentry.captureException(err);
// Line 147
Sentry.captureException(err);

1d. Add localStorage validation (line 62)

Add a type guard to validate parsed localStorage content:

/\*_ Prüft, ob der geparste localStorage-Wert ein gültiges AuthUser-Objekt ist. _/
const isValidCachedAuthUser = (value: unknown): value is AuthUser => {
if (typeof value !== "object" || value === null) return false;
const obj = value as Record<string, unknown>;
return (
typeof obj.uid === "string" &&
typeof obj.email === "string" &&
typeof obj.publicProfile === "object" &&
obj.publicProfile !== null
);
};

Use it where JSON.parse is called:
const parsed: unknown = JSON.parse(cachedString);
if (!isValidCachedAuthUser(parsed)) {
localStorage.removeItem(LocalStorageKey.AUTH_USER);
// Fall-Through zum DB-Fetch
} else if (parsed.uid === session.user.id) {
// ... use cached
}

1e. Add JSDoc

Add German JSDoc to:

- AuthUserContext (the context itself)
- useAuthUser() hook
- updateAuthUser() internal function

Files touched: authUserContext.tsx

Verification: npx tsc --noEmit + manual: sign in, verify auth state loads, navigate between
guarded routes, verify no console errors

---

Step 2: Fix emailVerificationGuard.tsx — Convention fixes

2a. Remove default export (line 112)

Delete export default EmailVerificationGuard. Named export on line 57 remains.

2b. Replace hardcoded string (line 94)

Import RESEND_CONFIRMATION_EMAIL from ../../constants/text (already exported at
text.ts:778).
Replace "Bestätigungs-E-Mail erneut senden" with the constant.

2c. Add error handling on resend (lines 67-69)

database.auth
.resendConfirmationEmail(authUser.email)
.then(() => setIsSent(true))
.catch((error) => {
Sentry.captureException(error);
});
Add import \* as Sentry from "@sentry/react".

2d. Replace <br /> with MUI spacing (line 80)

Remove <br />, add sx={{pt: 2}} to the Stack component (or increase existing spacing).

2e. Simplify needsEmailVerification with early returns + type safety

const needsEmailVerification = (authUser: {emailVerified: boolean} | null): boolean => {
if (!authUser || authUser.emailVerified) return false;

const storageContent = localStorage.getItem(LocalStorageKey.AUTH_USER);
if (!storageContent) return false;

try {
const parsed: unknown = JSON.parse(storageContent);
if (
typeof parsed === "object" &&
parsed !== null &&
(parsed as {emailVerified?: boolean}).emailVerified
) {
return false;
}
} catch {
return false;
}

return true;
};

Files touched: emailVerificationGuard.tsx

Verification: npx tsc --noEmit + manual: log in with unverified email, verify guard shows,
click resend, verify success state

---

Step 3: Fix noAuth.tsx — Convention fixes

3a. Named export

Change export default NoAuthPage → export const NoAuthPage = ...

3b. Update importer

In routeConfig.ts: change import NoAuthPage from "../Session/noAuth" → import {NoAuthPage}
from "../Session/noAuth"

3c. Extract magic number + reduce countdown + redirect target

/\*_ Countdown-Dauer in Sekunden bis zur automatischen Weiterleitung. _/
const REDIRECT_COUNTDOWN_SECONDS = 10;
Reduced from 20s to 10s — the message is ~2 sentences and takes about 4 seconds to read.
10s is comfortable.
And extract duplicate nav target:
const redirectTarget = authUser !== null ? ROUTE_HOME : ROUTE_SIGN_IN;

3d. Fix timer pattern

Use functional update + cleanup:
React.useEffect(() => {
if (timer === 0) {
const timeoutId = setTimeout(() => navigate(redirectTarget), 500);
return () => clearTimeout(timeoutId);
}
const timeoutId = setTimeout(() => setTimer((previous) => previous - 1), 1000);
return () => clearTimeout(timeoutId);
}, [timer]);

3e. Add JSDoc

Add German JSDoc to NoAuthPage.

Files touched: noAuth.tsx, routeConfig.ts (import only)

Verification: npx tsc --noEmit + manual: navigate to /noauth, verify countdown works,
verify redirect

---

Step 4: GuardedRoute.tsx — No changes needed

Already clean: good JSDoc, named exports, proper structure. The AuthUser import path from
Firebase/ is tracked as codebase-wide tech debt.

---

Step 5: Update existing emailVerificationGuard.test.tsx

5a. Fix as any (line 36)

Change as any → as unknown as DatabaseService (import the DatabaseService type).

5b. Switch to named import (line 50)

Change import EmailVerificationGuard from "../emailVerificationGuard" → import
{EmailVerificationGuard} from "../emailVerificationGuard"

5c. Add Sentry mock + error handling test

Mock @sentry/react at the top, then add:
test("Fehlerbehandlung wenn resendConfirmationEmail fehlschlaegt", async () => {
mockResendConfirmationEmail.mockRejectedValueOnce(new Error("Network error"));
// ... render guard with unverified email
// ... click resend button
// ... verify Sentry.captureException was called
// ... verify button stays enabled (isSent should still be false)
});

Files touched: **tests**/emailVerificationGuard.test.tsx

Verification: npx jest --testPathPatterns="emailVerificationGuard" --no-coverage
--watchAll=false

---

Step 6: New tests — authUserContext.test.tsx

Create src/components/Session/**tests**/authUserContext.test.tsx

AuthUserProvider tests (~7 tests):

1.  Renders children and provides null authUser when no Supabase session
2.  Sets authUser from Supabase session when user profile is found
3.  Uses localStorage cache when uid matches session user
4.  Invalidates localStorage cache when uid differs from session user
5.  Handles corrupt/invalid localStorage gracefully (validation rejects, falls through to
    DB)
6.  Calls Sentry.captureException on profile load failure (not console.error)
7.  Clears authUser and localStorage on SIGNED_OUT event

useAuthUser tests (~2 tests):

1.  Returns null outside provider
2.  Returns authUser value from context

AuthorizationGuard tests (~4 tests):

1.  Renders children when condition returns true
2.  Returns null when authUser is null (loading)
3.  Navigates to SIGN_IN when session is null (signed out)
4.  Navigates to NO_AUTH when condition fails

Mocks needed: database.auth (onAuthStateChange, getSession),
database.users/database.admin.users (findById, findByEmail, findFullProfile),
firebase.onAuthUserListener, @sentry/react, localStorage.

Files touched: **tests**/authUserContext.test.tsx (new)

---

Step 7: New tests — noAuth.test.tsx

Create src/components/Session/**tests**/noAuth.test.tsx

Tests (~5 tests):

1.  Renders countdown starting at 10 (REDIRECT_COUNTDOWN_SECONDS)
2.  Timer decrements (use jest.advanceTimersByTime)
3.  Navigates to HOME when timer reaches 0 and authUser is present
4.  Navigates to SIGN_IN when timer reaches 0 and authUser is null
5.  Manual link click navigates to correct destination

Mocks needed: useAuthUser, react-router (useNavigate), constants/styles,
constants/imageRepository, jest fake timers.

Files touched: **tests**/noAuth.test.tsx (new)

---

Step 8: New tests — GuardedRoute.test.tsx (minimal)

Create src/components/Session/**tests**/GuardedRoute.test.tsx

Tests (~2 tests):

1.  Renders children when auth condition is met and email is verified
2.  Blocks children when auth condition fails (renders null)

This is a pure composition component, so testing is lightweight. The individual guards are
tested separately.

Mocks needed: authUserContext (mock AuthorizationGuard + useAuthUser),
emailVerificationGuard (mock EmailVerificationGuard).

Files touched: **tests**/GuardedRoute.test.tsx (new)

---

Step 9: Update tech-debt.md

Append entries:

Naming

- AuthUser class import path — GuardedRoute.tsx and 50+ other files import AuthUser from
  Firebase/Authentication/authUser.class.ts. The class is fully Supabase-wired but the path
  misleads. Move to src/components/Session/ or src/components/Auth/. Consider converting from
  class to type/interface.
  Priorität: hoch · Komplexität: mittel (mechanical, but 50+ files)

Note: check if this entry already exists (it was added in the Request refactoring) — if so,
skip.

Security / Auth

- Admin client bypass in authUserContext.tsx — verify the existing tech-debt entry covers
  this (database.admin?.users ?? database.users on line 85).

Firebase Class Removal

- Firebase auth listener in authUserContext.tsx — The secondary Firebase onAuthUserListener
  (lines 157-168) is a migration bridge for users not yet migrated to Supabase. Once all
  users are migrated, remove this listener and the useFirebase() import. Also remove the
  firebaseContext dependency entirely from the Session folder.
  Priorität: mittel · Komplexität: klein (remove ~15 lines + import, but must verify all
  users are migrated first)

---

Execution Order

Step 1 (authUserContext.tsx) ← Highest impact, architecture fix
↓
Step 2 (emailVerificationGuard.tsx) ← Convention fixes
↓
Step 3 (noAuth.tsx + routeConfig.ts) ← Convention fixes
↓
Step 4 (GuardedRoute.tsx — no changes)
↓
Step 5 (update existing test) ← Depends on Step 2
↓
Steps 6-8 (new tests) ← After all source changes
↓
Step 9 (tech-debt.md) ← Any time

Verification

After each step:

1.  npx tsc --noEmit — zero new type errors
2.  After Steps 1-3: manual browser check

- Sign in → verify auth state loads correctly
- Navigate between guarded routes → no extra network calls for auth subscriptions
- Sign out → verify redirect to sign-in
- Navigate to /noauth → countdown works, redirect works
- Unverified email flow → guard shows, resend works

3.  After Steps 5-8: npx jest --testPathPatterns="Session" --no-coverage --watchAll=false

UX Suggestion

noAuth.tsx countdown: The 20-second countdown before auto-redirect is quite long. The
actual message is just ~2 sentences ("Meuterei auf hoher See... Für die angeforderte Seite
hast du keine Berechtigung. Du wirst automatisch umgeleitet. Oder klicke hier, falls du
ungeduldig bist.") — that's 3-4 seconds to read. Reducing to 10 seconds would still give
plenty of reading time while feeling more responsive. The manual "click here" link is
always there as an instant out.

Key Reference Files

- src/components/Database/AuthService.ts — getSession(), onAuthStateChange(),
  resendConfirmationEmail() signatures
- src/components/Session/**tests**/emailVerificationGuard.test.tsx — existing test patterns
  to follow
- src/components/Material/materials.tsx — Sentry-only error handling pattern
- src/constants/text.ts:778 — RESEND_CONFIRMATION_EMAIL constant
- src/components/App/routeConfig.ts — NoAuthPage import to update

---

Shared Folder — Full Refactoring Plan

Context

The Shared folder (src/components/Shared/, ~26 source files, ~3,600 LOC) provides reusable
UI components and utility classes. A full audit found: 12 default exports, bugs in
customDialog.tsx (setState in render, duplicate state, loose equality), untyped global
callback in customDialogContext.tsx, side effect in render in pageTitle.tsx, any types,
console.error instead of Sentry, missing JSDoc, deprecated APIs, <br /> tags, and zero
tests for 8+ files with testable logic. Two files are confirmed dead code (0 importers).

Intended outcome: All Shared files follow current conventions, bugs are fixed, dead code is
removed, out-of-scope issues are tracked in tech-debt.md, and all files with testable
logic have unit tests.

---

Issues Summary

#: 1
Category: Dead code
Issue: 0 importers — unused files
File(s): searchInputWithButton.tsx, loadingIndicator.tsx
────────────────────────────────────────
#: 2
Category: Bug
Issue: setState called in render body (not in useEffect)
File(s): customDialog.tsx:59-69
────────────────────────────────────────
#: 3
Category: Bug
Issue: Duplicate/dead state confirmDeletionValidation never properly used
File(s): customDialog.tsx:46-50,243,257
────────────────────────────────────────
#: 4
Category: Bug
Issue: Loose equality == everywhere
File(s): customDialog.tsx, customDialogContext.tsx, fieldValidation.error.class.ts
────────────────────────────────────────
#: 5
Category: Bug
Issue: setTimeout without cleanup
File(s): customDialog.tsx:106
────────────────────────────────────────
#: 6
Category: Type safety
Issue: Untyped module-level let resolveCallback;
File(s): customDialogContext.tsx:130
────────────────────────────────────────
#: 7
Category: Type safety
Issue: dispatch: (value: any) in context
File(s): customDialogContext.tsx:29
────────────────────────────────────────
#: 8
Category: Type safety
Issue: onConfirm(input?) / onCancel(input?) implicit any
File(s): customDialogContext.tsx:134,143
────────────────────────────────────────
#: 9
Category: Type safety
Issue: onClick: () => any on CustomButton
File(s): buttonRow.tsx:31
────────────────────────────────────────
#: 10
Category: Type safety
Issue: getPasswordLabel(result) — implicit any
File(s): passwordStrengthMeter.tsx:11
────────────────────────────────────────
#: 11
Category: Type safety
Issue: Inline CustomAlert component with untyped props
File(s): customSnackbar.tsx:49
────────────────────────────────────────
#: 12
Category: Performance
Issue: Side effect in render (window.document.title = ...)
File(s): pageTitle.tsx:55-61
────────────────────────────────────────
#: 13
Category: Performance
Issue: CustomAlert component recreated every render
File(s): customSnackbar.tsx:49-51
────────────────────────────────────────
#: 14
Category: Performance
Issue: Mutates function parameter buttons = buttons.slice(...)
File(s): buttonRow.tsx:120
────────────────────────────────────────
#: 15
Category: Convention
Issue: 12× default exports
File(s): AlertMessage, ButtonRow, customDialog, customDialogContext, customSnackbar,
enhancedTable, FieldValidationError, fallbackLoading, pageTitle, passwordStrengthMeter,
searchPanel, TwintButton
────────────────────────────────────────
#: 16
Category: Convention
Issue: Missing JSDoc on 15+ public exports
File(s): Multiple files
────────────────────────────────────────
#: 17
Category: Convention
Issue: <br /> instead of MUI spacing
File(s): passwordStrengthMeter.tsx:58
────────────────────────────────────────
#: 18
Category: Convention
Issue: Snackbar interface name clashes with MUI Snackbar
File(s): customSnackbar.tsx:22
────────────────────────────────────────
#: 19
Category: Convention
Issue: Deprecated InputProps → should use slotProps
File(s): FormListItem.tsx:59
────────────────────────────────────────
#: 20
Category: Convention
Issue: Commented-out code
File(s): buttonRow.tsx:124,137-138
────────────────────────────────────────
#: 21
Category: Convention
Issue: Misleading comment ("24 Stunden" but threshold is 1 hour)
File(s): localStorageHandler.class.ts:66
────────────────────────────────────────
#: 22
Category: Convention
Issue: DialogType enum inconsistent casing (selectOptions)
File(s): customDialogContext.tsx:13
────────────────────────────────────────
#: 23
Category: Convention
Issue: Firebase ValueObject import for ribbon prop
File(s): pageTitle.tsx:6
────────────────────────────────────────
#: 24
Category: Convention
Issue: Malformed JSDoc comment block
File(s): pageTitle.tsx:39-44
────────────────────────────────────────
#: 25
Category: Convention
Issue: Unnecessary double Fragment nesting
File(s): AlertMessage.tsx:32-41
────────────────────────────────────────
#: 26
Category: Convention
Issue: portalElement! non-null assertion, no fallback
File(s): customDialog.tsx:305
────────────────────────────────────────
#: 27
Category: Tests
Issue: 0 tests for 8+ files with testable logic
File(s): See Phase 6
────────────────────────────────────────
#: 28
Category: UX
Issue: Deeply nested ternary for color — hard to read/maintain
File(s): passwordStrengthMeter.tsx:42-55
────────────────────────────────────────
#: 29
Category: UX
Issue: Snackbar interface name confusing in imports — looks like MUI component
File(s): customSnackbar.tsx + 15 consumers
────────────────────────────────────────
#: 30
Category: UX
Issue: Monolithic 307-line ternary chain mixing 4 dialog types — hard to maintain
File(s): customDialog.tsx:147-303

NOT in scope (tracked as tech debt):

- enviroment.class.ts — entirely Firebase-dependent, filename typo. Needs full migration.
- stats.class.ts — entirely Firebase-dependent, multiple console.error. Needs full
  migration.
- localStorageHandler.class.ts — Firebase ValueObject import. Needs migration.
- customDialogContext.tsx architecture — module-level resolveCallback is fragile for
  concurrent dialogs but works in practice (app shows one dialog at a time). Full
  useRef-based rewrite would touch 26 consumers.
- pdfFontRegistration.ts — console.error for font load failure is acceptable (side-effect
  module, non-critical).

---

Phase 0: Dead Code Removal + Tech Debt Logging

Goal: Remove dead files, log out-of-scope issues.

Step 0.1: Delete dead files

- Delete src/components/Shared/searchInputWithButton.tsx (0 importers, duplicated by
  searchPanel.tsx)
- Delete src/components/Shared/loadingIndicator.tsx (0 importers, fallbackLoading.tsx
  exists)

Step 0.2: Log to tech-debt.md

Append entries for:

- enviroment.class.ts — Firebase-dependent, filename typo, console.error. Priorität: mittel
  · Komplexität: klein
- stats.class.ts — Firebase-dependent, 4× console.error. Priorität: mittel · Komplexität:
  mittel
- localStorageHandler.class.ts — Firebase ValueObject import, values: any, no localStorage
  validation. Priorität: tief · Komplexität: klein
- customDialogContext.tsx — module-level resolveCallback fragile for concurrent dialogs.
  Priorität: tief · Komplexität: gross

Verification: npx tsc --noEmit passes (no new errors), grep -r
"searchInputWithButton\|loadingIndicator" src/ returns nothing.

---

Phase 1: customDialog + customDialogContext Bug Fixes

Goal: Fix actual bugs before any structural/convention changes.

Step 1.1: customDialogContext.tsx — type safety + strict equality

File: src/components/Shared/customDialogContext.tsx

1.  Type resolveCallback (line 130): let resolveCallback: ((value: boolean |
    SingleTextInputResult | string | number) => void) | undefined;
2.  Type context dispatch (line 29): dispatch: (\_value: DispatchAction) => void (change any)
3.  Type onConfirm(input?) → onConfirm(input?: string | number) (line 134)
4.  Type onCancel(input?) → onCancel(input?: string | number) (line 143)
5.  Replace all == with === (lines 136, 145)
6.  Rename DialogType.selectOptions → DialogType.SelectOptions (PascalCase consistency)
7.  Add JSDoc to useCustomDialog, CustomDialogContextProvider, DialogType,
    SingleTextInputResult

- Consumer impact for enum rename: Update all DialogType.selectOptions usages across
  codebase

Step 1.2: customDialog.tsx — bug fixes

File: src/components/Shared/customDialog.tsx

1.  Remove duplicate state: Delete confirmDeletionValidation state (lines 46-50). Update
    line 243 (error={confirmDeletionValidation...}) and line 257
    (helperText={confirmDeletionValidation...}) to use validation state instead.
2.  Move setState to useEffect: Wrap lines 59-69 (formFields initialization from
    dialogState) in useEffect with [dialogState.singleTextInputProperties?.initialValue]
    dependency.
3.  Replace all == with === (lines 102, 148, 170, 173, 211, 274).
4.  Add setTimeout cleanup (line 106): Use useRef for timeout ID, clear in cleanup.
5.  Portal fallback: Replace portalElement! (line 305) with portalElement ?? document.body.
6.  Add JSDoc.

Verification: npx tsc --noEmit + manually test all 4 dialog types: Confirm,
SingleTextInput, ConfirmSecure, SelectOptions.

---

Phase 2: Convention Fixes (Type Safety, Spacing, Deprecated APIs)

Goal: Fix type safety, <br />, deprecated APIs, parameter mutation, commented-out code
across all files. No import changes yet (exports stay as-is).

Step 2.1: buttonRow.tsx

1.  Fix onClick: () => any → onClick: (event?: React.MouseEvent<HTMLButtonElement>) => void
    (line 31)
2.  Remove commented-out code (lines 124, 137-138)
3.  Fix parameter mutation: const visibleButtons = buttons.slice(0, noOfVisibleButtons);
    const overflowItems = buttons.slice(noOfVisibleButtons); — use these in JSX instead of
    reassigning buttons/menuItems
4.  Add JSDoc

Step 2.2: customSnackbar.tsx

1.  Extract CustomAlert to module-level with typed AlertProps: const CustomAlert =
    React.forwardRef<HTMLDivElement, AlertProps>((props, ref) => <Alert elevation={6} ref={ref}
    {...props} />);
2.  Rename Snackbar interface → SnackbarState (MUI name clash). Update
    SNACKBAR_INITIAL_STATE_VALUES type.
3.  Add JSDoc

- Consumer impact: Update {Snackbar} named imports to {SnackbarState} in ~15 consumer files

Step 2.3: passwordStrengthMeter.tsx

1.  Type result parameter: getPasswordLabel(result: {score: number}): string
2.  Extract deeply nested color ternary to helper: getProgressColor(score: number,
    hasPassword: boolean): LinearProgressProps["color"]
3.  Replace <br /> (line 58) with <Box sx={{ mt: 1 }} />
4.  Add JSDoc

Step 2.4: FormListItem.tsx

1.  Replace deprecated InputProps (line 59) with slotProps: { input: { endAdornment,
    inputProps: { min: 0 } } }
2.  Add JSDoc

Step 2.5: pageTitle.tsx

1.  Wrap window.document.title = ... (lines 55-61) in useEffect with [windowTitle, title,
    smallTitle] deps
2.  Replace ValueObject import (line 6) with local type: type RibbonData = { text: string;
    class: string }
3.  Fix malformed JSDoc at line 39-44
4.  Add proper JSDoc

Step 2.6: fieldValidation.error.class.ts

1.  Replace == with === (lines 22, 31)
2.  Add JSDoc to FieldValidationError, FormValidatorUtil, methods

Step 2.7: localStorageHandler.class.ts

1.  Fix misleading comment (line 66): "24 Stunden" → "1 Stunde" (3600s = 1h)
2.  Add missing JSDoc

Step 2.8: AlertMessage.tsx

1.  Remove outer <React.Fragment> wrapper (lines 32, 41) — Alert is already a single root
    element
2.  Add JSDoc

Verification: npx tsc --noEmit + npx jest --testPathPatterns="Shared" --no-coverage
--watchAll=false

---

Phase 3: Default-to-Named Export Conversions

Goal: Convert all 12 default exports to named exports. Grouped by importer count.

Step 3.1: Low-importer files (0-5 importers each)

Convert in one batch, update all consumers:

┌────────────────────────────────┬──────────────────────────────────────┬──────────────┐
│ File │ Default → Named │ Consumer │
│ │ │ count │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ customDialog.tsx │ export {CustomDialog} │ 1 (App.tsx) │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ customDialogContext.tsx │ remove export default │ 0 │
│ │ CustomDialogContext │ │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ fallbackLoading.tsx │ export const FallbackLoading │ 2 │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ TwintButton.tsx │ export const TwintButton │ 2 │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ passwordStrengthMeter.tsx │ export const PasswordStrengthMeter │ 4 │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ fieldValidation.error.class.ts │ export class FieldValidationError │ 5 │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ enhancedTable.tsx │ export const EnhancedTable │ 5 │
├────────────────────────────────┼──────────────────────────────────────┼──────────────┤
│ searchPanel.tsx │ export const SearchPanel │ 8 │
└────────────────────────────────┴──────────────────────────────────────┴──────────────┘

Step 3.2: ButtonRow (11 importers)

- Convert export default ButtonRow → export const ButtonRow
- Update 11 consumer files

Step 3.3: CustomSnackbar (18 default importers)

- Convert export default CustomSnackbar → export const CustomSnackbar
- Update 18 consumer files (combined with SnackbarState rename from Phase 2.2)

Step 3.4: AlertMessage (39 importers)

- Convert export default AlertMessage → export const AlertMessage
- Update 39 consumer files

Step 3.5: PageTitle (44 importers)

- Convert export default PageTitle → export const PageTitle
- Update 44 consumer files

Step 3.6: Utils (48 importers)

- Convert export default class Utils → export class Utils
- Update 48 consumer files

Verification: npx tsc --noEmit after each step. npx jest --no-coverage --watchAll=false
after entire phase.

---

Phase 4: customDialog Decomposition

Goal: Split the monolithic 307-line customDialog.tsx into focused sub-components.

Step 4.1: Extract dialog variants

Create src/components/Shared/dialogs/ folder with:

- ConfirmDialog.tsx — simple confirm dialog (current lines 148-168)
- SingleTextInputDialog.tsx — text input dialog (current lines 170-209)
- ConfirmSecureDialog.tsx — type-to-delete dialog (current lines 211-272)
- SelectOptionsDialog.tsx — option selection dialog (current lines 274-302)

Step 4.2: Simplify customDialog.tsx

Replace the massive ternary chain with a switch statement rendering the sub-components.
Main file becomes ~50-60 lines: state management + component dispatch.

Verification: npx tsc --noEmit + manually test all 4 dialog types.

---

Phase 5: New Unit Tests

Goal: Add tests for files with testable logic that currently lack coverage.

┌─────┬─────────────────────────────────────┬───────────────────────────────────────────┐
│ # │ Test file │ What to test │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ │ │ isFieldErroneous with match/miss, │
│ 1 │ fieldValidation.error.class.test.ts │ getHelperText with found/default, │
│ │ │ constructor │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 2 │ passwordStrengthMeter.test.tsx │ Score→label mapping (all 5 scores), │
│ │ │ score→color mapping, empty password │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 3 │ customSnackbar.test.tsx │ Renders message+severity, close callback │
│ │ │ fires │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 4 │ searchPanel.test.tsx │ Renders input with value, clear button │
│ │ │ calls handler, update fires on change │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 5 │ pageTitle.test.tsx │ Breadcrumbs render, document.title set │
│ │ │ via useEffect, ribbon renders │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 6 │ buttonRow.test.tsx │ Renders visible buttons, overflow menu at │
│ │ │ breakpoint, split button group │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ │ │ customDialog() returns Promise, │
│ 7 │ customDialogContext.test.tsx │ onConfirm/onCancel resolve correctly, │
│ │ │ SingleTextInput result │
├─────┼─────────────────────────────────────┼───────────────────────────────────────────┤
│ 8 │ FormListItem.test.tsx │ Edit mode renders TextField, view mode │
│ │ │ renders ListItemText, date formatting │
└─────┴─────────────────────────────────────┴───────────────────────────────────────────┘

Files NOT needing tests (no logic): fallbackLoading.tsx, TableSkeleton.tsx, icons.tsx,
TwintButton.tsx, pdfComponents.tsx, pdfFontRegistration.ts

Verification: npx jest --testPathPatterns="Shared" --no-coverage --watchAll=false — all
pass.

---

Phase 6: Update Existing Tests

Goal: Fix convention violations in existing test files.

Check existing tests for:

- as any → as unknown as Type
- Default imports → named imports (after Phase 3)
- Missing error path tests

Files: AlertMessage.test.tsx, enhancedTable.test.tsx, feed.class.test.ts,
imageResize.test.ts, imageUrl.test.ts, utils.class.test.ts

Verification: All existing tests still pass.

---

Execution Order

Phase 0 (dead code + tech debt) ← Low risk, immediate cleanup
↓
Phase 1 (bug fixes: customDialog\*) ← Highest impact, fix real bugs
↓
Phase 2 (convention fixes across files) ← Type safety, deprecated APIs
↓
Phase 3 (default → named exports) ← High volume, mechanical
↓
Phase 4 (customDialog decomposition) ← Structural, depends on Phase 1
↓
Phase 5 (new tests) ← After all source changes
↓
Phase 6 (update existing tests) ← Final cleanup

UX / Code Quality Improvements (integrated into phases)

The following improvements are integrated into the implementation steps above:

1.  customSnackbar.tsx — Rename Snackbar interface → SnackbarState (Phase 2, Step 2.2): The
    current name clashes with MUI's Snackbar component, causing confusion in imports like
    import {Snackbar} from "../../Shared/customSnackbar". Renaming to SnackbarState makes it
    immediately clear this is a state interface, not a UI component.
2.  passwordStrengthMeter.tsx — Extract color mapping helper (Phase 2, Step 2.3): The
    current 13-line nested ternary for progress bar color is hard to read and maintain.
    Extracting to a getProgressColor helper makes the score→color mapping readable at a glance,
    self-documenting, and independently testable.
3.  customDialog.tsx — Decompose into sub-components (Phase 4): The monolithic 307-line
    ternary chain mixing 4 dialog types violates single responsibility and makes each type
    harder to understand, test, and modify independently. Splitting into focused components
    improves maintainability and makes each dialog type's UI/logic scannable.

Key Reference Files

- src/components/Shared/customDialog.tsx — Most severe bugs, needs Phase 1 fixes then Phase
  4 decomposition
- src/components/Shared/customDialogContext.tsx — Untyped globals, any types, foundation
  for 26 consumers
- src/components/Shared/pageTitle.tsx — 44 importers, side effect in render, Firebase type
  dep
- src/components/Shared/buttonRow.tsx — Parameter mutation, any return type, 11 importers
- src/components/Shared/AlertMessage.tsx — 39 importers, highest-volume default→named
  conversion
- src/components/Shared/customSnackbar.tsx — Interface name clash, inline component, 28
  consumer files
- docs/claude/tech-debt.md — Append out-of-scope entries
- docs/claude/refactoring-guidelines.md — Convention reference

---

SignIn Folder — Full Refactoring Plan

Context

The SignIn folder (src/components/SignIn/, 3 source files, ~1,184 LOC) implements a hybrid
auth flow: Supabase primary → Firebase fallback → password migration dialog. With the
Firebase Auth → Supabase Auth bulk import (migration.md Steps 1-7) proven in dev and
planned for all environments, all users will have Supabase Auth accounts before deployment.
This means:

- The Firebase fallback flow (lines 302-381) is never reached
- The PasswordMigrationDialog becomes dead code
- The parallel Firebase sign-in (lines 286-297) is unnecessary since all data is in
  Supabase

However, the admin user still needs a Firebase session for the migration cockpit. The plan
moves the Firebase sign-in into the migration page itself.

Intended outcome: SignIn stripped of all Firebase dependencies (pure Supabase auth),
migration cockpit gets its own Firebase sign-in form, bugs and security issues fixed,
conventions aligned, tests updated.

---

Issues Summary

┌─────┬───────────┬────────────────────────────┬──────────────────────────────────────┐
│ # │ Category │ Issue │ File(s) │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ │ Firebase fallback auth │ │
│ 1 │ Dead code │ flow (120 lines) — │ signIn.tsx:286-381 │
│ │ │ unreachable after bulk │ │
│ │ │ import │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ │ PasswordMigrationDialog — │ passwordMigrationDialog.tsx (entire │
│ 2 │ Dead code │ never shown after bulk │ file) │
│ │ │ import │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ │ Migration-related state + │ signIn.tsx │
│ 3 │ Dead code │ reducer actions │ (SHOW/HIDE_MIGRATION_DIALOG, │
│ │ │ │ migrationDialog state) │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 4 │ Bug │ Dispatch in component body │ dialogReauthenticate.tsx:128-133 │
│ │ │ (setState during render) │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 5 │ Bug │ authUser! non-null │ dialogReauthenticate.tsx:167 │
│ │ │ assertion — unsafe │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ │ autoComplete="new-password │ signIn.tsx:564, │
│ 6 │ Security │ " on sign-in fields — │ dialogReauthenticate.tsx:240 │
│ │ │ should be current-password │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 7 │ UX │ No <form> wrapper — Enter │ signIn.tsx:530-601 │
│ │ │ key doesn't submit │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 8 │ Logging │ 4× console.warn/error │ signIn.tsx:283,337,362,375 │
│ │ │ instead of Sentry │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 9 │ Conventio │ Default export │ signIn.tsx:675 │
│ │ n │ │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 10 │ Conventio │ FirebaseError type import │ dialogReauthenticate.tsx:30,49,58,15 │
│ │ n │ (should be generic Error) │ 9 │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 11 │ Conventio │ Missing JSDoc on multiple │ All files │
│ │ n │ functions/handlers │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ Conventio │ Misleading copy-paste │ │
│ 12 │ n │ comment "Pop Up Abteilung │ dialogReauthenticate.tsx:89 │
│ │ │ hinzufügen" │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 13 │ Conventio │ disabled={authUser ? true │ dialogReauthenticate.tsx:219 │
│ │ n │ : false} verbose │ │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ 14 │ Tests │ as any mock types │ signIn.test.tsx:54,65, │
│ │ │ │ dialogReauthenticate.test.tsx:30 │
├─────┼───────────┼────────────────────────────┼──────────────────────────────────────┤
│ │ │ Migration cockpit has no │ │
│ 15 │ Missing │ Firebase sign-in — relies │ Admin/migration.tsx │
│ │ │ on global session │ │
└─────┴───────────┴────────────────────────────┴──────────────────────────────────────┘

NOT in scope (track as tech debt):

- AuthUser class imported from Firebase/Authentication/ (needs full migration)
- database.admin?.users bypass in signIn.tsx (already tracked)
- setTimeout delay for auth context propagation (requires auth context refactor)
- User.registerSignIn static method call in dialogReauthenticate.tsx
- migration.tsx default export (separate task)

---

Phase 1: Strip Firebase from SignIn + Delete Dead Code

Goal: Remove all Firebase dependencies from signIn.tsx and delete
passwordMigrationDialog.tsx.

Step 1.1: Simplify onSignIn — pure Supabase flow

File: signIn.tsx

Replace the entire onSignIn function (lines 264-383) with a clean Supabase-only flow:

const onSignIn = async () => {
dispatch({type: ReducerActions.SIGN_IN});
try {
const session = await database.auth.signInWithPassword(
state.signInData.email,
state.signInData.password,
);
// User-Daten laden und Login registrieren
const usersRepo = database.admin?.users ?? database.users;
try {
const user = await usersRepo.findById(session.user.id);
if (user) await usersRepo.registerSignIn(session.user.id);
} catch (profileError) {
Sentry.captureException(profileError, {extra: {context: "SignIn - Profil laden"}});
}
// Kurz warten, damit der Auth-Context nachziehen kann
await new Promise((resolve) => setTimeout(resolve, 2000));
navigate(ROUTE_HOME);
} catch (error) {
dispatch({
type: ReducerActions.GENERIC_ERROR,
payload: error as AuthErrorLike,
});
}
};

This removes:

- Firebase fallback (lines 302-381)
- Parallel Firebase sign-in (lines 286-297)
- Silent migration logic
- console.warn/error calls (replaced with Sentry for profileError)

Step 1.2: Remove migration-related state & reducer actions

File: signIn.tsx

- Delete MigrationDialogState type
- Remove migrationDialog from State type and initialState
- Delete ReducerActions.SHOW_MIGRATION_DIALOG and HIDE_MIGRATION_DIALOG
- Delete onMigrationSuccess and onMigrationClose functions
- Remove PasswordMigrationDialog component usage from JSX (lines 474-483)

Step 1.3: Remove Firebase imports

File: signIn.tsx

- Delete import {useFirebase} from "../Firebase/firebaseContext";
- Delete import PasswordMigrationDialog from "./passwordMigrationDialog";
- Delete import AuthUser from "../Firebase/Authentication/authUser.class";
- Delete import {AuthMessages} from "../../constants/firebaseMessages";
- Delete const firebase = useFirebase(); (line 215)
- Replace AuthMessages.EMAIL_NOT_CONFIRMED and AuthMessages.WRONG_PASSWORD /
  AuthMessages.INVALID_CREDENTIALS with Supabase-equivalent error codes

Consumer check: Need to verify Supabase error codes for email-not-confirmed and
wrong-password scenarios. Check AuthService or supabaseMessageHandler for the correct
codes.

Step 1.4: Delete passwordMigrationDialog.tsx

This file is dead code after removing the Firebase fallback flow. Delete entirely.

Step 1.5: Clean up AuthErrorLike type

With pure Supabase auth, AuthErrorLike = Error & {code?: string} can potentially be
simplified. Check what Supabase auth errors look like (AuthApiError from
@supabase/supabase-js).

Verification: npm run typecheck passes. Grep for firebase in signIn.tsx returns nothing.
Login flow works in browser with Supabase-only auth.

---

Phase 2: Add Firebase Sign-In to Migration Cockpit

Goal: The migration page gets its own Firebase sign-in form so the admin can run migration
jobs without needing the global Firebase session.

Step 2.1: Add Firebase auth state tracking

File: Admin/migration.tsx

Add state to track whether the admin is signed into Firebase:

const [firebaseSignedIn, setFirebaseSignedIn] = React.useState(false);
const [firebaseEmail, setFirebaseEmail] = React.useState("");
const [firebasePassword, setFirebasePassword] = React.useState("");
const [firebaseError, setFirebaseError] = React.useState<Error | null>(null);
const [firebaseLoading, setFirebaseLoading] = React.useState(false);

Step 2.2: Add Firebase sign-in handler

const handleFirebaseSignIn = async () => {
setFirebaseLoading(true);
setFirebaseError(null);
try {
await firebase.signInWithEmailAndPassword({
email: firebaseEmail,
password: firebasePassword,
});
setFirebaseSignedIn(true);
setFirebasePassword(""); // Passwort nach Login leeren
} catch (error) {
setFirebaseError(error as Error);
} finally {
setFirebaseLoading(false);
}
};

Step 2.3: Add inline Firebase sign-in card at top of page

File: Admin/migration.tsx

Add a Card at the top of the Stack (before the Job-Auswahl card) that shows when
!firebaseSignedIn:

{!firebaseSignedIn && (
<Card sx={classes.card}>
<CardHeader title="Firebase-Anmeldung" subheader="Für den Zugriff auf Firebase-Daten
 wird eine separate Anmeldung benötigt." />
<CardContent>
<Stack spacing={2}>
{firebaseError && <AlertMessage error={firebaseError} />}
<TextField label="E-Mail" type="email" value={firebaseEmail} onChange={...} 
 disabled={firebaseLoading} fullWidth />
<TextField label="Passwort" type="password" value={firebasePassword} onChange={...}
  disabled={firebaseLoading} fullWidth />
<Button variant="contained" onClick={handleFirebaseSignIn}
disabled={firebaseLoading || !firebaseEmail || !firebasePassword}>
Firebase anmelden
</Button>
</Stack>
</CardContent>
</Card>
)}

Disable the "Start Migration" button when !firebaseSignedIn:

- Line 163: change disabled={!selectedJob || isRunning} → disabled={!selectedJob ||
  isRunning || !firebaseSignedIn}

Show a success Chip when signed in: {firebaseSignedIn && <Chip label="Firebase verbunden"
 color="success" />}

Note: Use text constants where appropriate. Add new constants to text.ts if needed.

Verification: Migration cockpit shows Firebase sign-in form → after sign-in, migration
controls become usable. Migration jobs execute successfully.

---

Phase 3: Bugs & Security Fixes

Goal: Fix remaining bugs and security issues in the surviving files.

Step 3.1: Wrap SignInForm in <form> element

File: signIn.tsx:530-601

- Replace <React.Fragment> wrapper with <form onSubmit={(event) => {
  event.preventDefault(); onSignIn(); }} noValidate>
- Enables Enter-key submission

Step 3.2: Fix autoComplete attributes

- signIn.tsx:564 — autoComplete="new-password" → autoComplete="current-password"
- dialogReauthenticate.tsx:240 — autoComplete="new-password" →
  autoComplete="current-password"

Step 3.3: Fix dispatch-during-render in dialogReauthenticate.tsx

File: dialogReauthenticate.tsx:128-133

Replace inline dispatch with lazy initializer:
const getInitialState = (authUser: AuthUser | null): State => ({
reAuthData: { email: authUser?.email ?? "", password: "" },
error: null,
});
Use: useReducer(reAuthenticateReducer, authUser, (au) => getInitialState(au))
Delete lines 128-133.

Step 3.4: Remove authUser! non-null assertion

File: dialogReauthenticate.tsx:167
if (authUser) {
User.registerSignIn({ database, authUser });
}

Step 3.5: Simplify verbose boolean

File: dialogReauthenticate.tsx:219

- disabled={authUser ? true : false} → disabled={!!authUser}

Verification: npm run typecheck + existing tests pass + Enter-key works in browser.

---

Phase 4: Convention Fixes

Goal: Align with project conventions.

Step 4.1: Default → named export for signIn.tsx

- export default SignInPage → export {SignInPage}
- Update routeConfig.ts:9: import SignInPage from → import {SignInPage} from
- Update test file import

Step 4.2: Remove FirebaseError type from dialogReauthenticate.tsx

- Delete import {FirebaseError} from "@firebase/util"
- error: FirebaseError | null → error: Error | null
- payload: FirebaseError → payload: Error
- error as FirebaseError → error as Error

Step 4.3: Fix misleading comment

- dialogReauthenticate.tsx:89 — "Pop Up Abteilung hinzufügen" →
  "Reauthentifizierungs-Dialog"

Step 4.4: Add missing JSDoc (German)

signIn.tsx: onFieldChange, onSignIn, onResendConfirmationEmail
dialogReauthenticate.tsx: reAuthenticateReducer, onChangeField, onSignIn, handleClose

Step 4.5: Add Sentry import to signIn.tsx

Add import \* as Sentry from "@sentry/react"; (for the profileError capture in Step 1.1)

Verification: npm run typecheck + all tests pass.

---

Phase 5: Tests

Goal: Update existing tests for the new code, fix as any.

Step 5.1: Update signIn.test.tsx

- Remove all Firebase-related test cases (Firebase fallback, migration dialog, migration
  success/close)
- Remove PasswordMigrationDialog mock
- Remove mockFirebase entirely
- Update SignInPage import to named import
- Fix mockDatabase typing — replace as any with proper partial type
- Add test for Enter-key form submission
- Add test for autoComplete="current-password"
- Verify error handling shows Supabase errors correctly

Step 5.2: Fix as any in dialogReauthenticate.test.tsx

- mockDatabase at line 30 — replace as any with proper partial type
- Update any tests affected by the FirebaseError → Error change

Step 5.3: Delete passwordMigrationDialog.test.tsx references

No test file existed for the deleted file, so nothing to delete. But verify no test imports
reference it.

Verification: npx jest --testPathPatterns="SignIn" --no-coverage --watchAll=false — all
pass.

---

Phase 6: Tech Debt Logging

Goal: Document out-of-scope items.

Append to docs/claude/tech-debt.md:

Firebase Class Removal

- signIn.tsx setTimeout delay — 1× hardcoded setTimeout(resolve, 2000) waiting for auth
  context propagation. Proper fix requires auth context to expose a "ready" signal or use
  onAuthStateChange subscription.
  Priorität: mittel · Komplexität: mittel

Convention

- dialogReauthenticate.tsx User.registerSignIn static method — Called as static class
  method instead of going through repository pattern. Should use
  UserRepository.registerSignIn() directly.
  Priorität: tief · Komplexität: klein
- Admin/migration.tsx default export — Uses export default MigrationPage. Should be
  converted to named export as part of a broader admin folder refactoring.
  Priorität: tief · Komplexität: klein

---

Execution Order

Phase 1 (strip Firebase from SignIn) ← Biggest impact, removes 200+ lines
↓
Phase 2 (Firebase sign-in on migration) ← Prerequisite: admin still needs Firebase
↓
Phase 3 (bugs & security fixes) ← Fix remaining issues
↓
Phase 4 (convention fixes) ← Exports, types, JSDoc
↓
Phase 5 (tests) ← After all source changes
↓
Phase 6 (tech debt logging) ← Document out-of-scope

Key Reference Files

- src/components/SignIn/signIn.tsx — Main refactoring target: strip Firebase, simplify
  onSignIn
- src/components/SignIn/dialogReauthenticate.tsx — Bug fixes, FirebaseError removal
- src/components/SignIn/passwordMigrationDialog.tsx — DELETE (dead code after bulk import)
- src/components/Admin/migration.tsx — Add Firebase sign-in form
- src/components/SignIn/**tests**/signIn.test.tsx — Update tests, remove Firebase cases
- src/components/SignIn/**tests**/dialogReauthenticate.test.tsx — Fix as any
- src/components/App/routeConfig.ts — Update SignInPage import
- src/components/Firebase/firebase.class.ts — signInWithEmailAndPassword method (reused by
  migration page)
- src/constants/text.ts — Text constants for migration cockpit Firebase form
- docs/claude/tech-debt.md — Append out-of-scope entries

Verification (End-to-End)

1.  npm run typecheck — zero new errors
2.  npx jest --testPathPatterns="SignIn" --no-coverage --watchAll=false — all pass
3.  grep -r "firebase\|Firebase" src/components/SignIn/ — only dialogReauthenticate.tsx
    (AuthUser import, tracked as tech debt)
4.  Browser: Sign in with Supabase credentials → lands on home page
5.  Browser: Enter key submits the form
6.  Browser: Migration cockpit → Firebase sign-in form appears → after sign-in, can run
    migration jobs

---

SignUp Folder — Full Refactoring Plan

Context

The SignUp folder (src/components/SignUp/, 1 source file ~610 LOC, 1 test file ~441 LOC)
handles user registration via Supabase Auth. It still has leftover Firebase dependencies,
security issues matching those we fixed in SignIn, convention violations, and UX gaps. The
file was last touched during migration Phase 16 but wasn't fully cleaned up.

Intended outcome: SignUp stripped of Firebase dependencies, security/convention issues
fixed, UX polished, tests improved — following the same patterns successfully applied to
SignIn.

---

Issues Summary

┌─────┬────────────┬───────────────────────────────────────┬────────────────────────────┐
│ # │ Category │ Issue │ Location │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 1 │ Dead code │ useFirebase() — passed to │ signUp.tsx:34,179,233 │
│ │ │ User.createUser() which ignores it │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ │ │ AuthMessages import from │ │
│ 2 │ Dead code │ firebaseMessages — Firebase error │ signUp.tsx:38,514 │
│ │ │ code dead │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 3 │ Security │ autoComplete="firstname"/"lastname" — │ signUp.tsx:391,405 │
│ │ │ invalid HTML values │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 4 │ Logging │ console.error(error) in onSignUp — │ signUp.tsx:244 │
│ │ │ should use Sentry │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 5 │ UX │ No <form> wrapper — Enter key doesn't │ signUp.tsx:355-526 │
│ │ │ submit │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 6 │ UX bug │ Heading says "Anmelden" │ signUp.tsx:370 │
│ │ │ (TEXT_SIGN_IN) on the sign-up page │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 7 │ Convention │ Default export │ signUp.tsx:610 │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 8 │ Convention │ Missing JSDoc on 6 functions │ signUp.tsx │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 9 │ Convention │ Inline German strings (not in │ signUp.tsx:466-491,570,600 │
│ │ │ text.ts) │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 10 │ Tests │ as any mock types │ signUp.test.tsx:28,52,61 │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 11 │ UX │ No loading indicator during │ signUp.tsx │
│ │ │ registration │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 12 │ UX │ Success screen has no action (no "Go │ signUp.tsx:272-276 │
│ │ │ to Sign In" button) │ │
├─────┼────────────┼───────────────────────────────────────┼────────────────────────────┤
│ 13 │ UX │ Email validation error shows │ signUp.tsx:424-428 │
│ │ │ immediately on first keystroke │ │
└─────┴────────────┴───────────────────────────────────────┴────────────────────────────┘

NOT in scope (track as tech debt):

- AuthUser class import path from Firebase/Authentication/ (same as SignIn, already
  tracked)
- database.admin?.users bypass in User.createUser (already tracked)

---

Phase 1: Firebase Cleanup + Dead Code Removal

Goal: Remove all Firebase dependencies from signUp.tsx.

Step 1.1: Remove firebase from CreateUser interface

File: src/components/User/user.class.ts

- Remove firebase: Firebase; from CreateUser interface (line 52-53)
- Remove import Firebase from "../Firebase/firebase.class"; if no other usage remains
  (check first — other methods use it)

File: src/components/User/**tests**/user.class.test.ts

- Remove firebase: mockFirebase as any from both createUser() test calls (lines 141, 171)

Step 1.2: Remove Firebase from signUp.tsx

File: src/components/SignUp/signUp.tsx

- Delete import {useFirebase} from "../Firebase/firebaseContext"; (line 34)
- Delete const firebase = useFirebase(); (line 179)
- Remove firebase: firebase, from User.createUser() call (line 234)

Step 1.3: Replace AuthMessages with Supabase constant

File: src/components/SignUp/signUp.tsx

- Delete import {AuthMessages} from "../../constants/firebaseMessages"; (line 38)
- Add local constant: const SUPABASE_ERROR_USER_ALREADY_EXISTS = "user_already_exists";
- Line 514-515: Replace error.code === AuthMessages.EMAIL_ALREADY_IN_USE || error.code ===
  AuthMessages.USER_ALREADY_EXISTS with error.code === SUPABASE_ERROR_USER_ALREADY_EXISTS

Step 1.4: Update test

File: src/components/SignUp/**tests**/signUp.test.tsx

- Remove FirebaseContext import and provider wrapper from renderSignUpPage()
- Remove mockFirebase constant
- Update error test (line 316): use "user_already_exists" instead of
  "auth/email-already-in-use"

Verification: npx tsc --noEmit, npx jest --testPathPatterns="SignUp|user.class"
--no-coverage

---

Phase 2: Security Fixes

Goal: Fix autocomplete, error logging, and form submission.

Step 2.1: Fix autocomplete values

- Line 391: autoComplete="firstname" → autoComplete="given-name"
- Line 405: autoComplete="lastname" → autoComplete="family-name"

Step 2.2: Replace console.error with Sentry

- Add import \* as Sentry from "@sentry/react";
- Line 244: console.error(error) → Sentry.captureException(error, {extra: {context: "SignUp
- Registrierung fehlgeschlagen"}})

Step 2.3: Wrap form in <form> element

- In SignUpForm, replace outer <React.Fragment> → <Card> wrapping with <form
  onSubmit={(event) => { event.preventDefault(); onSignUp(); }} noValidate> around the card
  content
- Remove onClick={onSignUp} from the submit Button (keep type="submit")

Verification: npx tsc --noEmit, tests pass, Enter key submits in browser

---

Phase 3: Convention Fixes

Goal: Named export, correct heading, JSDoc, text constants.

Step 3.1: Named export

- export default SignUpPage; → export {SignUpPage};
- Update routeConfig.ts:10: import SignUpPage from "../SignUp/signUp" → import {SignUpPage}
  from "../SignUp/signUp"
- Update test import

Step 3.2: Fix heading text (UX bug)

- Line 370: {TEXT_SIGN_IN} → {TEXT_CREATE_ACCOUNT} (already imported)
- The sign-up page currently says "Anmelden" — it should say "Account erstellen"

Step 3.3: Extract inline strings to text.ts

File: src/constants/text.ts — add:
export const SIGN_UP_ACCEPT_TERMS_INTRO = "Indem du fortfährst, akzeptierst du:";
export const SIGN_UP_TERM_OF_USE_PREFIX = "die";
export const SIGN_UP_TERM_OF_USE_SUFFIX = "für den chuchipirat.";
export const SIGN_UP_PRIVACY_POLICY_SUFFIX = "des chuchipirats.";
export const PRIVACY_POLICY_DIALOG_TITLE = "Datenschutzerklärung für die Webapp
chuchipirat";
Use existing TERM_OF_USE and PRIVACY_POLICY from text.ts for the link text and dialog title
"Nutzungsbedingungen".

Step 3.4: Add JSDoc (German) to all handlers

onFieldChange, onSignUp, onSmallPrintDialogOpen, onSmallPrintDialogClose,
handleClickShowPassword, handleMouseDownPassword

Verification: npx tsc --noEmit, all tests pass

---

Phase 4: UX Improvements

Goal: Loading state, success actions, email validation timing.

Step 4.1: Add loading indicator during registration

- Add isSigningUp: boolean to State and initialState (false)
- Add ReducerActions.SIGN_UP_START action → sets isSigningUp: true
- SIGN_UP_SUCCESS and GENERIC_ERROR reset isSigningUp: false
- Dispatch SIGN_UP_START at beginning of onSignUp
- Add Backdrop + CircularProgress (matching SignIn pattern)
- Disable form fields and button while isSigningUp

Step 4.2: Add "Go to Sign In" button after success

After the success <Alert>, add:
<Button onClick={() => navigate(ROUTE_SIGN_IN)} fullWidth variant="outlined" sx={{mt: 2}}>
{TEXT_SIGN_IN}
</Button>
Import SIGN_IN as ROUTE_SIGN_IN from routes.

Step 4.3: Defer email validation to blur

- Add emailTouched boolean to reducer state
- Add ReducerActions.EMAIL_TOUCHED action
- Show email validation error only when emailTouched && !Utils.isEmail(email)
- Add onBlur handler to email field that dispatches EMAIL_TOUCHED

Step 4.4: Update tests

- Add test: loading indicator appears during registration
- Add test: "Zur Anmeldung" button appears after success
- Add test: email validation not shown before blur
- Add test: email validation shown after blur with invalid email

Verification: npx tsc --noEmit, npx jest --testPathPatterns="SignUp" --no-coverage, browser
check

---

Phase 5: Test Quality + Type Safety

Goal: Fix as any, improve mock typing.

Step 5.1: Fix mock types

- mockDatabase (line 52): as any → as unknown as DatabaseService
- mockAuthUser (line 28): any → {uid: string; email: string} | null

Step 5.2: Add Sentry mock

- jest.mock("@sentry/react", () => ({ captureException: jest.fn() }));

Verification: npx jest --testPathPatterns="SignUp" --no-coverage — all pass

---

Phase 6: Tech Debt Logging

Append to docs/claude/tech-debt.md:

Firebase Class Removal

- user.class.ts console.error in createUser — console.error(error) at line 285 should use
  Sentry. Part of broader user.class.ts cleanup.
  Priorität: tief · Komplexität: klein

---

Key Reference Files

- src/components/SignUp/signUp.tsx — Primary refactoring target
- src/components/SignUp/**tests**/signUp.test.tsx — Test updates
- src/components/User/user.class.ts — Remove firebase from CreateUser interface
- src/components/User/**tests**/user.class.test.ts — Remove firebase from test calls
- src/components/App/routeConfig.ts — Update import (named export)
- src/constants/text.ts — Add text constants
- src/components/SignIn/signIn.tsx — Reference pattern (form wrapping, Sentry, constants)

Verification (End-to-End)

1.  npx tsc --noEmit — zero new errors
2.  npx jest --testPathPatterns="SignUp|user.class" --no-coverage — all pass
3.  grep -r "firebase\|Firebase" src/components/SignUp/ — zero results
4.  Browser: Registration with valid data → loading spinner → success message → "Zur
    Anmeldung" link
5.  Browser: Enter key submits the form
6.  Browser: Email validation only shows after leaving the field
7.  Browser: Heading says "Account erstellen", not "Anmelden"

---

Unit Folder — Full Refactoring Plan

Context

The Unit folder (src/components/Unit/, 7 source files, 3 mocks, 2 test files) manages units
(kg, l, etc.) and unit conversions for camp kitchen planning. The UI pages already use
Supabase, but the .class.ts files still have dead Firebase methods. The largest file
(unitConversion.tsx, 1272 LOC) has significant duplication. There are bugs, security
issues, convention violations, and missing tests.

Intended outcome: Dead Firebase code removed, bugs fixed, conventions aligned, tests added,
UX polished, duplication reduced.

---

Issues Summary

#: 1
Category: Dead code
Issue: unit.class.ts Firebase methods (getAllUnits, saveUnits, createUnit) — UI uses
database.units._
Location: unit.class.ts:48-90
────────────────────────────────────────
#: 2
Category: Dead code
Issue: unitConversion.class.ts Firebase methods (getAllConversionBasic,
getAllConversionProducts, saveUnitConversions)
Location: unitConversion.class.ts:98-191
────────────────────────────────────────
#: 3
Category: Dead code
Issue: Commented-out import and code blocks
Location: unitConversion.class.ts:2, dialogCreateUnitConversion.tsx:151-186
────────────────────────────────────────
#: 4
Category: Dead code
Issue: handleError prop accepted but never used
Location: dialogCreateUnitConversion.tsx:85,94
────────────────────────────────────────
#: 5
Category: Bug
Issue: dialogCreateUnit.tsx validation overwrite — if both fields empty, only last error
shows
Location: dialogCreateUnit.tsx:70-85
────────────────────────────────────────
#: 6
Category: Bug
Issue: convertQuantity uses == instead of ===
Location: unitConversion.class.ts:229
────────────────────────────────────────
#: 7
Category: Security
Issue: convertQuantity recursive with no depth guard — infinite loop risk with cyclic rules
Location: unitConversion.class.ts:276
────────────────────────────────────────
#: 8
Category: Security
Issue: Missing .catch() on initial fetch — silent failures
Location: unitConversion.tsx:502-514
────────────────────────────────────────
#: 9
Category: Logging
Issue: console.error(error) instead of Sentry
Location: units.tsx:427, unitConversion.tsx:533
────────────────────────────────────────
#: 10
Category: Convention
Issue: Default exports in all 7 files
Location: All files
────────────────────────────────────────
#: 11
Category: Convention
Issue: any types (6 locations)
Location: units.tsx:471, unitConversion.tsx:594,761, dialogCreateUnitConversion.tsx:107,135
────────────────────────────────────────
#: 12
Category: Convention
Issue: Numeric enums: ConversionType, UnitConversionType
Location: unitConversion.class.ts:69-72, dialogCreateUnitConversion.tsx:65-69
────────────────────────────────────────
#: 13
Category: Convention
Issue: Typo: TABLE_COLUMS → TABLE_COLUMNS
Location: units.tsx:256, unitConversion.tsx:357,399
────────────────────────────────────────
#: 14
Category: Convention
Issue: Missing JSDoc on ~20+ functions
Location: All files
────────────────────────────────────────
#: 15
Category: Convention
Issue: Variable shadowing in deleteUnitConversion filter callback
Location: unitConversion.class.ts:136
────────────────────────────────────────
#: 16
Category: Convention
Issue: Wrong comment on createUnitConversionProduct
Location: unitConversion.class.ts:193
────────────────────────────────────────
#: 17
Category: Convention
Issue: parseInt without radix
Location: dialogCreateUnitConversion.tsx:145,146,164,165
────────────────────────────────────────
#: 18
Category: UX
Issue: No <form> wrapper in dialogs — Enter key doesn't submit
Location: dialogCreateUnit.tsx, dialogCreateUnitConversion.tsx
────────────────────────────────────────
#: 19
Category: UX
Issue: disableEscapeKeyDown on conversion dialog — Escape should close
Location: dialogCreateUnitConversion.tsx:293
────────────────────────────────────────
#: 20
Category: UX
Issue: <br /> for spacing instead of MUI
Location: unitConversion.tsx:903,914
────────────────────────────────────────
#: 21
Category: UX
Issue: Duplicate Grid key
Location: unitConversion.tsx:902,913
────────────────────────────────────────
#: 22
Category: UX
Issue: Hardcoded aria-label
Location: units.tsx:661
────────────────────────────────────────
#: 23
Category: Performance
Issue: Deprecated inputProps instead of slotProps.htmlInput
Location: unitConversion.tsx:1039,1055,1211,1237
────────────────────────────────────────
#: 24
Category: Structure
Issue: BasicConversionEditRow / ProductConversionEditRow nearly identical
Location: unitConversion.tsx:1024-1078,1182-1269
────────────────────────────────────────
#: 25
Category: Structure
Issue: BasicConversionPanel / ProductConversionPanel nearly identical
Location: unitConversion.tsx:953-1015,1088-1173
────────────────────────────────────────
#: 26
Category: Structure
Issue: unitConversion.tsx at 1272 LOC — reducer should be extracted
Location: unitConversion.tsx
────────────────────────────────────────
#: 27
Category: Tests
Issue: No tests for getDimensionOfUnit, convertQuantity, createUnitConversion_,
deleteUnitConversion
Location: class files
────────────────────────────────────────
#: 28
Category: Tests
Issue: No tests for dialogCreateUnit.tsx, dialogCreateUnitConversion.tsx,
unitAutocomplete.tsx
Location: UI files
────────────────────────────────────────
#: 29
Category: Tests
Issue: as any mock types in existing tests
Location: units.test.tsx:53, unitConversion.test.tsx:70
────────────────────────────────────────
#: 30
Category: UX
Issue: Form not reset on dialog close (only on successful create)
Location: dialogCreateUnit.tsx
────────────────────────────────────────
#: 31
Category: Convention
Issue: UNIT_ADD_INITIAL_STATE exported but only used internally
Location: dialogCreateUnit.tsx:27
────────────────────────────────────────
#: 32
Category: UX
Issue: Unnecessary component="span" on IconButtons
Location: unitConversion.tsx:1064,1256
────────────────────────────────────────
#: 33
Category: Convention
Issue: Incomplete JSDoc (@param param0 placeholder)
Location: unitAutocomplete.tsx:31-35

---

Phase 1: Dead Code Removal + Firebase Cleanup

Goal: Remove all Firebase methods and imports from class files.

Step 1.1: Clean unit.class.ts

- Delete Firebase imports (lines 2-4): Firebase, AuthUser, ValueObject
- Delete Firebase-only interfaces: GetAllUnits, CreateUnit, SaveUnits (lines 17-30)
- Delete dead static methods: getAllUnits, saveUnits, createUnit (lines 48-90)
- Keep class shape, Constructor interface, constructor, UnitDimension enum,
  getDimensionOfUnit
- Keep as class Unit (28 importers + 3 new Unit() call sites — full type conversion tracked
  as tech debt)
- Convert to named export: export class Unit instead of export default class Unit
- Add JSDoc (German) to getDimensionOfUnit and UnitDimension

Step 1.2: Clean unitConversion.class.ts

- Delete commented-out import (line 2)
- Delete Firebase/AuthUser imports (lines 3, 6)
- Delete Firebase interfaces: GetAllConversionBasic, GetAllConversionProducts,
  SaveUnitConversions
- Delete Firebase methods: getAllConversionBasic, getAllConversionProducts,
  saveUnitConversions
- Fix wrong comment on createUnitConversionProduct (line 193)
- Fix variable shadowing in deleteUnitConversion filter (line 136): unitConversion →
  conversion
- Convert ConversionType from numeric to string enum: { basic = "basic", product =
  "product" }
- Delete commented-out code in dialogCreateUnitConversion.tsx (lines 151-186)
- Keep as class UnitConversion (9+ importers — full type conversion tracked as tech debt)
- Convert to named export: export class UnitConversion
- Remove handleError prop from dialogCreateUnitConversion.tsx (unused)

Verification: npm run typecheck, npm run test

---

Phase 2: Bug Fixes + Security

Step 2.1: Fix convertQuantity safety

- Fix == to === (line 229)
- Add depth guard parameter (maxDepth = 10) to prevent infinite recursion with cyclic rules

Step 2.2: Fix dialog validation overwrite bug

File: dialogCreateUnit.tsx

- Build a single validation object, then call setValidation once (currently second call
  overwrites first)

Step 2.3: Fix dialog form reset on close

File: dialogCreateUnit.tsx

- Reset formFields and validation in onCancelClick (currently only handleClose is called)

Step 2.4: Add missing error handling

File: unitConversion.tsx

- Add .catch() to both initial fetch calls (lines 502-514) that currently silently swallow
  errors

Step 2.5: Replace console.error with Sentry

- units.tsx:427 and unitConversion.tsx:533

Step 2.6: Fix parseInt without radix

File: dialogCreateUnitConversion.tsx

- Add radix 10 to all 4 parseInt calls

Verification: npm run typecheck, targeted tests for validation bug, manual browser test

---

Phase 3: Convention Fixes

Step 3.1: Named exports

Convert all 7 files from default to named exports. Update all import sites:

- units.tsx → export {UnitsPage} (+ routeConfig.ts lazy import)
- unitConversion.tsx → export {UnitConversionPage} (+ routeConfig.ts lazy import)
- dialogCreateUnit.tsx → export {DialogCreateUnit}
- dialogCreateUnitConversion.tsx → export {DialogCreateUnitConversion}
- unitAutocomplete.tsx → export {UnitAutocomplete} (+ 5 consumer files)

Step 3.2: Fix any types

┌──────────────────────────────────────────────────────┬───────────────────────────────┐
│ Location │ Fix │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ units.tsx:471 SyntheticEvent<any> │ SyntheticEvent<Element, │
│ │ Event> │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ unitConversion.tsx:594 value: any │ value: number │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ unitConversion.tsx:761 SyntheticEvent<any> │ SyntheticEvent<Element, │
│ │ Event> │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ dialogCreateUnitConversion.tsx:107 newValue?: any │ Proper union type │
├──────────────────────────────────────────────────────┼───────────────────────────────┤
│ dialogCreateUnitConversion.tsx:135 {} as │ Proper initialization │
│ UnitConversion │ │
└──────────────────────────────────────────────────────┴───────────────────────────────┘

Step 3.3: Fix typos

- TABLE_COLUMS → TABLE_COLUMNS (3 locations)

Step 3.4: Convert numeric enums to string

- UnitConversionType in dialogCreateUnitConversion.tsx

Step 3.5: Add JSDoc (German) to all public functions

All handlers, components, and utility functions across all 7 files.

Step 3.6: Fix incomplete JSDoc

- unitAutocomplete.tsx:31-35 — replace @param param0 placeholder

Step 3.7: Remove unnecessary exports

- UNIT_ADD_INITIAL_STATE in dialogCreateUnit.tsx — make it module-private

Step 3.8: Fix as any in existing tests

- units.test.tsx:53 and unitConversion.test.tsx:70 — use as unknown as DatabaseService

Verification: npm run typecheck, npm run lint

---

Phase 4: UX Improvements

Step 4.1: <form> wrappers in dialogs

Both dialogCreateUnit.tsx and dialogCreateUnitConversion.tsx — wrap in <form onSubmit> so
Enter submits.

Step 4.2: Remove disableEscapeKeyDown

dialogCreateUnitConversion.tsx:293 — let Escape close the dialog (standard UX). Ensure
onClose resets state.

Step 4.3: Replace <br /> with MUI spacing

unitConversion.tsx:903,914 — use sx={{ mt: 2 }} instead.

Step 4.4: Fix duplicate Grid key

unitConversion.tsx:913 — change to key={"ProductConversionPanel"}.

Step 4.5: Move hardcoded aria-label to text constant

units.tsx:661 — extract to text.ts.

Step 4.6: Simplify unitCreateValues state

units.tsx:307-309 — replace {popUpOpen: boolean} object with a simple boolean.

Step 4.7: Replace deprecated inputProps with slotProps.htmlInput

4 locations in unitConversion.tsx.

Step 4.8: Remove unnecessary component="span" from IconButtons

2 locations in unitConversion.tsx.

Step 4.9: Tab magic numbers → constants

unitConversion.tsx — unify existing TAB_QUERY_PARAM_MAP with switch statements.

Verification: Browser testing (desktop + mobile), dialog keyboard behavior

---

Phase 5: Structural Refactoring

Step 5.1: Extract shared ConversionEditRow

Merge BasicConversionEditRow and ProductConversionEditRow into a single parameterized
component with optional showProductName prop.

Step 5.2: Extract shared ConversionPanel

Merge BasicConversionPanel and ProductConversionPanel into one component parameterized by
title, columns, and whether to show product names.

Step 5.3: Extract reducer from unitConversion.tsx

Move the reducer, types, and initial state into unitConversionReducer.ts (matching pattern
of homeReducer.ts, requestOverviewReducer.ts).

Verification: npm run typecheck, existing tests pass, visual check

---

Phase 6: New Tests

6.1: unit.class.test.ts — getDimensionOfUnit

- Returns correct dimension for known unit
- Returns dimensionless when unit not found
- Returns dimensionless for empty array

  6.2: unitConversion.class.test.ts — Pure functions

convertQuantity:

- Same unit → returns unchanged
- Basic conversion applies numerator/denominator correctly
- Product-specific takes priority over basic
- No conversion found → returns original
- Multi-step recursive conversion
- Depth guard prevents infinite loop (cyclic rules)

createUnitConversionBasic / createUnitConversionProduct:

- Returns correct fields with valid UUID

deleteUnitConversion:

- Removes correct item, returns unchanged if not found

  6.3: dialogCreateUnit.test.tsx

- Renders when open, not when closed
- Validation errors when both fields empty (regression for bug #5)
- Calls handleCreate with correct data
- Resets form after create and on cancel
- Enter key submits

  6.4: dialogCreateUnitConversion.test.tsx

- Renders for BASIC type (no product field)
- Renders for PRODUCT type (shows product autocomplete)
- Validation errors for empty/invalid fields
- Calls handleCreate with correct object

  6.5: unitAutocomplete.test.tsx

- Renders with correct label
- Shows options, calls onChange on selection

Verification: npm run test -- --filter "Unit"

---

Phase 7: Performance

Goal: Prevent unnecessary re-renders in edit mode when individual fields change.

Step 7.1: Memoize child components

- Wrap TablePanel in units.tsx with React.memo
- Wrap ConversionEditRow (merged component from Phase 5) with React.memo
- Wrap ConversionPanel (merged component from Phase 5) with React.memo

Step 7.2: Stabilize handler references with useCallback

- units.tsx: wrap onChangeField, onDeleteUnit in useCallback (passed to memoized
  TablePanel)
- unitConversion.tsx: wrap onChangeEditTableField, onTableRowDelete in useCallback (passed
  to memoized panels)

Verification: React DevTools Profiler — confirm only changed rows re-render in edit mode,
npm run typecheck

---

Tech Debt Items (out of scope, append to tech-debt.md)

1.  unit.class.ts class-to-type conversion — Converting the Unit class to a plain type +
    standalone getDimensionOfUnit function would be cleaner (convention: type over class for
    data shapes). Requires updating 28 import sites + 3 new Unit() call sites outside the Unit
    folder. Separate small PR. Priorität: mittel · Komplexität: mittel
2.  unitConversion.class.ts class-to-functions conversion — Convert static methods to
    standalone exported functions. Requires updating 9+ import sites including recipe.class.ts.
    Do together with #1. Priorität: mittel · Komplexität: mittel
3.  unitConversion.tsx DOM id encoding pattern — event.target.id.split("_") is fragile
    (breaks if uid contains _). Better to use data-\* attributes. Priorität: tief · Komplexität:
    mittel
4.  Mock files use default exports and interface — update after main refactoring. Priorität:
    tief · Komplexität: klein

---

Key Reference Files

- src/components/Unit/unit.class.ts — Types + dead Firebase methods
- src/components/Unit/unitConversion.class.ts — Business logic + dead Firebase methods
- src/components/Unit/units.tsx — Units page (687 LOC)
- src/components/Unit/unitConversion.tsx — Unit conversion page (1272 LOC, largest)
- src/components/Unit/dialogCreateUnit.tsx — Create unit dialog (validation bug)
- src/components/Unit/dialogCreateUnitConversion.tsx — Create conversion dialog (multiple
  issues)
- src/components/Unit/unitAutocomplete.tsx — Autocomplete component
- src/components/Unit/**tests**/ — Existing tests
- src/components/App/routeConfig.ts — Update lazy imports for named exports

Verification (End-to-End)

1.  npm run typecheck — zero new errors
2.  npm run test — all pass (existing + new)
3.  grep -r "firebase\|Firebase" src/components/Unit/ — zero results (except mock files if
    any)
4.  grep -r "console\.error\|console\.log" src/components/Unit/ — zero results
5.  grep -r "export default" src/components/Unit/ — zero results (except mocks)
6.  Browser: Units page — edit, save, cancel, add, delete all work
7.  Browser: Unit conversion page — both tabs, edit mode, add/delete conversions
8.  Browser: Dialogs — Enter submits, Escape closes, validation works for all error states
9.  Browser: Mobile viewport — responsive layout intact

---

User Folder — Full Refactoring Plan

Context

The User folder (src/components/User/, 7 source files, 3 test files) manages user profiles,
public profiles, and user-related dialogs. Most files already use Supabase, but there is
dead Firebase code, security issues, convention violations, missing tests, and performance
opportunities. Two domain class files are completely unused.

Intended outcome: Dead code removed, security fixed, conventions aligned, Sentry for
errors, tests added for dialogAddUser, performance optimized, UX polished.

---

Issues Summary

┌─────┬─────────────┬───────────────────────────────────────┬──────────────────────────┐
│ # │ Category │ Issue │ Location │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 1 │ Dead code │ user.public.class.ts — abstract │ entire file (8 LOC) │
│ │ │ class, zero live consumers │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 2 │ Dead code │ user.public.searchFields.class.ts — │ entire file (16 LOC) │
│ │ │ only imported by #1 │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ user.public.profile.class.ts — │ │
│ 3 │ Dead code │ incrementField() calls Firebase, │ lines 58-72 │
│ │ │ unused, /_ istanbul ignore next _/ │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 4 │ Dead code │ user.public.profile.class.ts — │ lines 32-34 │
│ │ │ commented-out properties │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ user.public.profile.class.ts — │ │
│ 5 │ Dead code │ Firebase import only needed for │ line 1 │
│ │ │ deleted incrementField() │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 6 │ Security │ == instead of === in email comparison │ dialogAddUser.tsx:66 │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 7 │ Security │ error.toString() exposed directly to │ dialogAddUser.tsx:81 │
│ │ │ user — could leak internal details │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 8 │ Logging │ console.error(error) in getAllUsers() │ user.class.ts:238 │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 9 │ Logging │ console.error(error) in createUser() │ user.class.ts:283 │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 10 │ Logging │ console.error(...) in reducer default │ publicProfile.tsx:117 │
│ │ │ (should throw) │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 11 │ Logging │ console.error(...) in reducer default │ userProfile.tsx:233 │
│ │ │ (should throw) │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 12 │ Logging │ console.error(error) in useEffect │ userProfile.tsx:276 │
│ │ │ fetch │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 13 │ Logging │ console.error(error) in onSaveClick │ userProfile.tsx:297 │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 14 │ Logging │ console.warn(...) in feed insert │ userProfile.tsx:377 │
│ │ │ catch │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 15 │ Convention │ export default in all 7 source files │ all files │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ Missing JSDoc on │ publicProfile.tsx, │
│ 16 │ Convention │ components/sub-components │ userProfile.tsx, │
│ │ │ │ dialogAddUser.tsx │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ Wrong import path: │ │
│ 17 │ Convention │ "../User/user.class" (goes up and │ dialogAddUser.tsx:15 │
│ │ │ back down) │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ No <form> wrapper in │ │
│ 18 │ UX │ dialogAddUser.tsx — Enter key doesn't │ dialogAddUser.tsx │
│ │ │ submit │ │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ │ │ Sub-components not memoized in │ PageHeader, ProfileCard, │
│ 19 │ Performance │ userProfile.tsx │ PublicProfileCard, │
│ │ │ │ AchievedRewardsCard │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 20 │ Performance │ Handlers not wrapped in useCallback │ onChangeField, │
│ │ │ in userProfile.tsx │ onPictureUpload, etc. │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 21 │ Performance │ Sub-components not memoized in │ PublicProfileList, │
│ │ │ publicProfile.tsx │ AchievedRewardsList │
├─────┼─────────────┼───────────────────────────────────────┼──────────────────────────┤
│ 22 │ Tests │ No test file for dialogAddUser.tsx │ missing │
└─────┴─────────────┴───────────────────────────────────────┴──────────────────────────┘

---

Phase 1: Dead Code Removal

Goal: Remove unused files and dead Firebase methods.

Step 1.1: Delete dead files

- Delete user.public.class.ts (8 LOC) — abstract class with zero live consumers outside
  Firebase DB mirror layer
- Delete user.public.searchFields.class.ts (16 LOC) — only imported by user.public.class.ts

Step 1.2: Clean user.public.profile.class.ts

- Delete Firebase import and IncrementField interface (needed only for deleted method)
- Delete incrementField() static method (lines 58-72, calls Firebase directly, unused, /_
  istanbul ignore next _/)
- Delete commented-out property declarations (lines 32-34)
- Convert to named export: export class UserPublicProfile (remove export default)
- Add JSDoc (German) to class and constructor

Step 1.3: Update import sites for UserPublicProfile

6 files import UserPublicProfile as default — change all to named imports:

- src/components/User/user.class.ts
- src/components/User/publicProfile.tsx
- src/components/User/userProfile.tsx
- src/components/Database/Repository/UserRepository.ts
- src/components/User/**tests**/user.class.test.ts
- src/components/User/**tests**/publicProfile.test.tsx

Verification: npx tsc --noEmit (zero Unit/User errors), npx jest -- "User/**tests**" (all
pass)

---

Phase 2: Security & Bug Fixes

Step 2.1: Fix strict equality in dialogAddUser.tsx

- Line 66: == → ===
- Also normalize both sides: userEmail.toLowerCase() === authUser.email.toLowerCase()

Step 2.2: Fix error exposure in dialogAddUser.tsx

- Line 81: Replace error.toString() with safe message:
  const message = error instanceof Error ? error.message : TEXT_GIVE_VALID_EMAIL;

Step 2.3: Fix import path in dialogAddUser.tsx

- Line 15: Change "../User/user.class" → "./user.class" (file is inside User folder)

Verification: npx tsc --noEmit, manual test of dialog scenarios

---

Phase 3: Error Handling — console.error → Sentry

Step 3.1: user.class.ts

- Add import \* as Sentry from "@sentry/browser";
- Line 238: console.error(error) → Sentry.captureException(error);
- Line 283: console.error(error) → Sentry.captureException(error);

Step 3.2: publicProfile.tsx

- Line 117: Replace console.error("Unbekannter ActionType: ", action.type) with just throw
  new Error(...) (exhaustive check pattern — console.error before throw is redundant)

Step 3.3: userProfile.tsx

- Add import \* as Sentry from "@sentry/browser";
- Line 233: Replace console.error(...) with just throw new Error(...) (reducer exhaustive
  check)
- Line 276: console.error(error) → Sentry.captureException(error);
- Line 297: console.error(error) → Sentry.captureException(error);
- Line 377: console.warn(...) → Sentry.captureException(err, {level: "warning"});

Verification: npx tsc --noEmit, grep -r "console\." src/components/User/ --include="_.ts"
--include="_.tsx" returns zero hits (excluding tests/mocks)

---

Phase 4: Convention Fixes (Named Exports, JSDoc, Form Wrapper)

Step 4.1: Named exports — user.class.ts

Convert export default class User → export class User. Update 10 import sites:

- src/components/User/dialogAddUser.tsx (also fix path to "./user.class")
- src/components/SignUp/signUp.tsx
- src/components/SignIn/dialogReauthenticate.tsx
- src/components/Event/Event/eventInfo.tsx
- src/components/Admin/Overview/overviewUsers.tsx (mixed: default + named)
- src/components/Admin/Overview/overviewEvents.tsx
- src/components/Firebase/firebase.class.ts
- src/components/SignIn/**tests**/dialogReauthenticate.test.tsx
- src/components/User/**tests**/user.class.test.ts
- src/components/User/**tests**/publicProfile.test.tsx (if it imports User)

Note: {UserShort} and {UserOverviewStructure} named imports in recipe.types.ts,
recipe.comment.class.ts, UserRepository.ts need no change — they already use named imports.

Step 4.2: Named exports — UI components

File: publicProfile.tsx
New export: Remove export default, keep existing named exports (PublicProfileList,
AchievedRewardsList, add PublicProfilePage)
Import sites to update: routeConfig.ts:13 — change eagerly loaded import PublicProfile from

... to import {PublicProfilePage} from ...
────────────────────────────────────────
File: userProfile.tsx
New export: export {UserProfilePage} instead of export default
Import sites to update: routeConfig.ts:40 — change lazy import to .then(m => ({default:
m.UserProfilePage}))
────────────────────────────────────────
File: dialogAddUser.tsx
New export: export {DialogAddUser} instead of export default
Import sites to update: eventInfo.tsx:72 — change to import {DialogAddUser} from ...

Step 4.3: JSDoc (German) on all components

Add JSDoc blocks to:

- PublicProfilePage, PublicProfileList, AchievedRewardsList in publicProfile.tsx
- UserProfilePage, PageHeader, ProfileCard, PublicProfileCard, AchievedRewardsCard in
  userProfile.tsx
- DialogAddUser and DialogAddUserProps in dialogAddUser.tsx

Step 4.4: Form wrapper in dialogAddUser.tsx

- Wrap dialog content in <form onSubmit={...}> so Enter key submits
- Add event.preventDefault() in submit handler
- Set cancel button type="button", submit button type="submit"

Verification: npx tsc --noEmit, npx jest -- "User/**tests**", grep -r "export default"
src/components/User/ --include="_.ts" --include="_.tsx" returns zero hits

---

Phase 5: Performance — Memoization

Step 5.1: userProfile.tsx — Memo sub-components

Wrap with React.memo:

- PageHeader
- ProfileCard
- PublicProfileCard
- AchievedRewardsCard

Step 5.2: userProfile.tsx — useCallback for handlers

Wrap handlers passed to memoized sub-components:

- onChangeField (deps: [] — uses dispatch which is stable)
- onPictureUpload (deps: [authUser, database])
- onPictureDelete (deps: [authUser, database, customDialog])
- handleSnackbarClose (deps: [])

Step 5.3: publicProfile.tsx — Memo sub-components

Wrap with React.memo:

- PublicProfileList
- AchievedRewardsList

Verification: npx tsc --noEmit, npx jest -- "User/**tests**", visual check in browser

---

Phase 6: New Tests — dialogAddUser.test.tsx

File: src/components/User/**tests**/dialogAddUser.test.tsx

Test cases:

1.  Renders dialog content when dialogOpen=true
2.  Does not render when dialogOpen=false
3.  Shows validation error for invalid email format
4.  Shows "cannot add yourself" warning when own email is entered
5.  Calls handleAddUser with UID on successful email lookup
6.  Shows error message when user not found
7.  Calls handleClose on cancel
8.  Enter key submits the form

Mock setup:

- Mock User.getUidByEmail() (returns UID or throws)
- Mock Utils.isEmail() (returns boolean)
- Provide authUser and database via props
- Use userEvent for interactions

Verification: npx jest -- "dialogAddUser" — all 8 tests pass

---

Tech Debt Items (out of scope → append to docs/claude/tech-debt.md)

1.  Firebase getAllUsers() migration (user.class.ts:230) — Still calls
    firebase.user.readCollection(). Requires data migration to Supabase, not a refactoring
    task.
    Priorität: hoch · Komplexität: mittel
2.  Firebase DB mirror files — firebase.db.user.public.class.ts,
    firebase.db.user.public.searchFields.class.ts reference deleted domain classes after Phase
3.  Clean up when Firebase is fully removed.
    Priorität: tief · Komplexität: klein
4.  User class to standalone functions — user.class.ts uses static methods on a class.
    Modern convention: standalone exported functions. Affects 13+ import sites.
    Priorität: tief · Komplexität: gross
5.  Admin client bypass — user.class.ts methods use database.admin?.users ?? database.users
    to bypass RLS during migration transition. Switch to regular client after migration
    complete.
    Priorität: mittel · Komplexität: klein

---

Key Reference Files

- src/components/User/user.class.ts — User service class (585 LOC)
- src/components/User/userProfile.tsx — User profile page (750 LOC, largest)
- src/components/User/publicProfile.tsx — Public profile view (366 LOC)
- src/components/User/dialogAddUser.tsx — Add user dialog (137 LOC, security fixes)
- src/components/User/user.public.profile.class.ts — Public profile domain (75 LOC)
- src/components/User/user.public.class.ts — Dead code, DELETE
- src/components/User/user.public.searchFields.class.ts — Dead code, DELETE
- src/components/App/routeConfig.ts — Update lazy imports
- src/components/Event/Event/eventInfo.tsx — Update DialogAddUser import

Verification (End-to-End)

1.  npx tsc --noEmit — zero new errors
2.  npx jest -- "User/**tests**" — all pass (existing + new)
3.  grep -r "console\." src/components/User/ --include="_.ts" --include="_.tsx" — zero
    results (excluding tests)
4.  grep -r "export default" src/components/User/ --include="_.ts" --include="_.tsx" — zero
    results
5.  Browser: Public profile page — loads, shows stats, edit button works for own profile
6.  Browser: User profile page — edit mode, save, picture upload/delete, password change
    link
7.  Browser: Add user dialog — email validation, self-check, user lookup, Enter submits,
    Escape closes
8.  Browser: Mobile viewport — responsive layout intact on all pages

---

Constants Folder — Full Refactoring Plan

Context

The src/constants/ folder (21 files) contains application-wide constants: UI strings,
routes, styles, enums, PDF tokens, and configuration values. Analysis revealed 153 unused
text exports (15% of text.ts), 2 entirely dead files, 4 enums with export default
convention violations, a 662-line styles.ts with default export, and missing JSDoc across
most files. No unit tests exist for any constants file.

Intended outcome: Dead code removed, conventions aligned (named exports, JSDoc), styles.ts
restructured with named export, text.ts cleaned of 153 unused exports + commented-out
lines, unit tests added for files with logic, tech debt documented for out-of-scope items.

---

Issues Summary

┌─────┬────────────┬────────────────────────────────────────────┬──────────────────────┐
│ # │ Category │ Issue │ Location │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 1 │ Dead file │ buttonText.ts — zero imports anywhere in │ entire file (9 LOC) │
│ │ │ codebase │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 2 │ Dead file │ mailTemplates.ts — zero imports, │ entire file (13 LOC) │
│ │ │ references Firestore │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 3 │ Dead code │ 153 unused exports in text.ts │ scattered across │
│ │ │ │ 1,644 LOC │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 4 │ Dead code │ Commented-out exports in text.ts (lines │ ~14 lines │
│ │ │ 45-46, others) │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 5 │ Dead code │ Commented-out routes in routes.ts (lines │ 6 lines │
│ │ │ 52-62) │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ │ │ Empty string exports in text.ts │ │
│ 6 │ Dead code │ (BUTTON_SIGN_IN="", BUTTON_SIGN_UP="", │ lines 34, 36, 43, 47 │
│ │ │ BUTTON_SHOW_PASSWORD="", │ │
│ │ │ BUTTON_REGISTER="") │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 7 │ Convention │ export default in actions.ts │ 34 import sites │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 8 │ Convention │ export default in localStorage.ts │ 9 import sites │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 9 │ Convention │ export default + export enum in roles.ts │ 24 default + 3 named │
│ │ │ │ imports │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 10 │ Convention │ export default + export enum in │ 5 import sites │
│ │ │ firebaseEvent.ts │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 11 │ Convention │ export default in styles.ts │ 82 import sites │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ │ │ │ all except │
│ 12 │ Convention │ Missing JSDoc on most files │ pdfTokens.ts, │
│ │ │ │ enumMappings.ts, PDF │
│ │ │ │ style files │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 13 │ Convention │ imageRepository.ts missing JSDoc │ class + method │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 14 │ Convention │ defaultValues.ts missing JSDoc on │ line 45 │
│ │ │ getSupportUserUid() │ │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 15 │ TypeScript │ as any in pdfTokens.ts line 52 │ display: "table" as │
│ │ │ │ any │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 16 │ TypeScript │ as any in stylesRecipePdf.ts line 86 │ same pattern │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 17 │ Naming │ Typo in text.ts: │ unused, will be │
│ │ │ PANEL_COMMEINTRODUCE_YOURSELFNTS │ deleted │
├─────┼────────────┼────────────────────────────────────────────┼──────────────────────┤
│ 18 │ Tests │ No test files for any constants file │ entire folder │
└─────┴────────────┴────────────────────────────────────────────┴──────────────────────┘

---

Phase 1: Dead Code Removal

Goal: Remove unused files, exports, and commented-out code.

Step 1.1: Delete dead files

- Delete buttonText.ts (9 LOC) — zero imports in codebase
- Delete mailTemplates.ts (13 LOC) — zero imports, Firestore-only

Step 1.2: Clean text.ts — remove 153 unused exports

Remove these exports (verified as having zero import sites):

ADD_INTOLERANCE, ALERT_TEXT_IMAGE_SAVE_FIRST, ALERT_TEXT_IMAGE_SOURCE,
BUTTON_ADD_NOTE, BUTTON_ADD_PERSON, BUTTON_ADD_PRODUCT, BUTTON_ADD_RECIPE,
BUTTON_CHANGE, BUTTON_CHOOSE_RECIPE, BUTTON_EVENT_CREATE, BUTTON_GENERATE,
BUTTON_LINK_RECIPE, BUTTON_LOAD_MORE_RECIPES, BUTTON_MENUPLAN,
BUTTON_MY_EVENTS, BUTTON_POS_DOWN, BUTTON_POS_UP, BUTTON_QUANTITY_CALCULATION,
BUTTON_REGISTER, BUTTON_SETTINGS, BUTTON_SHOW, BUTTON_SHOW_PASSWORD,
BUTTON_SIGN_IN, BUTTON_SIGN_UP, BUTTON_TRACE, BUTTON_UPLOAD,
COMMENTS_LEFT, CONFIRM_DIET_SWITCH, CREATE_NEW_LIST, CREATE_SYSTEM_MESSAGE,
DELETE_CHECKED_FEEDS, DELETE_FEED_BY_DAYS, DELETE_FEED_DESCRIPTION,
DELETE_FEED_SELECTIV, DIALOG_ALERT_TEXT_ADD_PRODUCT,
DIALOG_ALERT_TITLE_ADD_PRODUCT, ENTRY_DELETED,
ERROR_NO_MATCHING_UNIT_FOUND, ERROR_PRODUCT_WIHTOUT_UID,
ERROR_RECIPE_UNKNOWN, ERROR_UNIT_CONVERSION_NOT_FOUND,
EVENT_COOK_ADDED_SUCCES, EVENT_COOK_ALLREADY_ADDED, EVENT_COOK_DELETED,
EVENT_NOTHING_UP_TO, EVENT_PLAN_A_NEW_ONE,
EXPORTED_FROM, EXPORTED_ON,
FIELD_AVG_RATING, FIELD_CONVERT_UNITS, FIELD_DAY, FIELD_DAY_FROM,
FIELD_DAY_TO, FIELD_EMAIL, FIELD_FEED_DELETE_AFTER_DAYS,
FIELD_FIRSTNAME, FIELD_HEAD_NOTE, FIELD_INGREDIENT, FIELD_LASTNAME,
FIELD_LOCATION, FIELD_MEAL, FIELD_MEAL_FROM, FIELD_MEAL_TO,
FIELD_MOTTO, FIELD_NOTE, FIELD_NOTE_TYPE, FIELD_NO_OF_COLUMNS,
FIELD_PARTICIPANTS, FIELD_PASSWORD, FIELD_POSITION, FIELD_PRIVATE,
FIELD_PRIVATE_RECIPE, FIELD_PRIVATE_RECIPE_TOOLTIP,
FIXED_REPLACES_GROUP, FORM_DATE_TO_LOWER_THAN_DATE_FROM,
FORM_MEAL_TO_LOWER_THAN_MEAL_TO, GET_FEEDS, GROUP_REPLACES_FIXED,
INVOKED, INVOLVED_EVENTS, LAST_LOGIN,
LOGIN_CHANGE_ARE_YOU_READY, MAIL_HEADER_PICTURE_SRC,
MAIL_SENT_TO_RECIPIENTS, MENUPLAN_DIALOG_ADD_RECIPE,
MENUPLAN_DRAWER_SEARCH_RECIPE_TITLE,
MENUPLAN_NOTE_TYPE_BIRTHDAY, MENUPLAN_NOTE_TYPE_HINT,
MENUPLAN_NOTE_TYPE_IDEA, MENUPLAN_NOTE_TYPE_PREPARE,
MENUPLAN_NOTE_TYPE_SHOPPING, MENUPLAN_SETTINGS_SHOW_RECIPE_PICTURE,
MERGE_PRODUCT_A, MERGE_PRODUCT_B,
NAVIGATION_ADMIN, NAVIGATION_HELP, NAVIGATION_USERS,
NO_LINKED_RECIPES, NO_OF_FEED_ENTRIES, NO_OPEN_REQUESTS_FOUND,
ORIGINAL_QUANTITIES, OVERVIEW_DIFFERENT_ELEMENTS,
PAGE_SUBTITLE_QUANTITY_CALCULATION, PAGE_SUBTITLE_SHOPPING_LIST,
PAGE_SUBTITLE_USERS, PAGE_TITLE_EVENTS, PAGE_TITLE_MENUPLAN,
PAGE_TITLE_QUANTITY_CALCULATION, PAGE_TITLE_VERIFY_EMAIL,
PANEL_COMMEINTRODUCE_YOURSELFNTS, PANEL_COOKS, PANEL_IMAGE,
PANEL_INFO, PANEL_INFOS, PANEL_LINKED_RECIPES, PANEL_NEXT_EVENTS,
PANEL_PRODUCTS, PANEL_RECIPE, PANEL_SIGN_IN, PANEL_STATS,
PANEL_TAGS, PANEL_UNITS_BASIC, PANEL_UNITS_PRODUCTS,
PASSWORD_MIGRATION_CONFIRM, PASSWORD_MIGRATION_DESCRIPTION,
PASSWORD_MIGRATION_NEW_PASSWORD, PASSWORD_MIGRATION_SUCCESS,
PASSWORD_MIGRATION_TITLE, PASSWORD_RESET_GO_TO_HOME,
PROCESSED_DOCUMENTS, PRODUCT_EDITED, PROFILE_PICTURE_UPLOAD_SUCCESS,
QUANTITY_CALCULATION_ERROR_NO_RECIPES,
RECIPE_SAVE_BEFORE_UPLOAD_PICTURE,
RECORD_INGREDIENT_WITH_NECCESSARY_INFO,
REFRESH_APP_TEXT, REFRESH_APP_TILE,
REQUEST_NEXT_POSSIBLES_TRANSITIONS_LABEL,
SCALED_QUANTITIES, SCALED_RECIPE_ORIGINAL_IS, SELECT_MENUES,
SENDT_MAIL_TO_RECIPIENTS, SORT_ITEMS, SYSTEM_GLOBAL_DESCRIPTION,
TEST_MAIL_SENT, TOOLTIP_DEL_POS, TRACE_RESULT,
UNIT_CONVERSION_BASIC_CREATED, UNIT_CONVERSION_PRODUCT_CREATED,
USER_NOT_IDENTIFIED_BY_EMAIL, UX_PRIVATE_RECIPE,
WE_NEED_THIS_VALUE, WHERE_IS_THIS_PRODUCT_USE

Step 1.3: Clean text.ts — remove commented-out exports

Delete all // export const ... lines (approx. 14 lines).

Step 1.4: Clean text.ts — remove empty string exports

Delete BUTTON_SIGN_IN = "", BUTTON_SIGN_UP = "", BUTTON_SHOW_PASSWORD = "", BUTTON_REGISTER
= "" — these are empty placeholders that are never displayed.

Step 1.5: Clean routes.ts — remove commented-out routes

Delete the 6 commented-out route lines (MENUPLAN, QUANTITY_CALCULATION, SHOPPINGLIST).

Verification: npx tsc --noEmit — zero new errors. grep -r "buttonText" src/
--include="_.ts" --include="_.tsx" — zero hits. Same for mailTemplates.

---

Phase 2: Named Export Conversion

Goal: Convert all export default to named exports per CLAUDE.md convention.

Step 2.1: actions.ts (34 import sites)

- Add export to enum declaration: export enum Action
- Remove export default Action;
- Update 34 import sites: import Action from → import {Action} from

Step 2.2: localStorage.ts (9 import sites)

- Add export to enum declaration: export enum LocalStorageKey
- Remove export default LocalStorageKey;
- Update 9 import sites: import LocalStorageKey from → import {LocalStorageKey} from

Step 2.3: roles.ts (24 default import sites)

- Remove export default Role; line (the enum already has export enum Role)
- Update 24 default import sites: import Role from → import {Role} from
- 3 existing named imports need no change

Step 2.4: firebaseEvent.ts (5 import sites)

- Remove export default FirebaseAnalyticEvent;
- Update 5 import sites: import FirebaseAnalyticEvent from → import {FirebaseAnalyticEvent}
  from

Step 2.5: styles.ts (82 import sites)

- Change export default useCustomStyles; → export {useCustomStyles};
- Update 82 import sites: import useCustomStyles from → import {useCustomStyles} from

Verification: npx tsc --noEmit, grep -r "export default" src/constants/ --include="\*.ts" —
zero results.

---

Phase 3: JSDoc & Convention Fixes

Goal: Add German JSDoc to all public exports, fix TypeScript strictness issues.

Step 3.1: actions.ts — Add JSDoc

/\*\*

- Aktionstypen für UI-Operationen (Anzeigen, Bearbeiten, Erstellen, Löschen etc.).
  \*/
  export enum Action { ... }

Step 3.2: localStorage.ts — Add JSDoc

/\*\*

- Schlüssel für den Browser-LocalStorage.
  \*/
  export enum LocalStorageKey { ... }

Step 3.3: roles.ts — Add JSDoc

/\*\*

- Benutzerrollen für die Zugriffskontrolle.
  \*/
  export enum Role { ... }

Step 3.4: firebaseEvent.ts — Add JSDoc

/\*\*

- Analytics-Event-Namen für Firebase Analytics Tracking.
  \*/
  export enum FirebaseAnalyticEvent { ... }

Step 3.5: firebaseMessages.ts — Add JSDoc

/\*\*

- Auth-Fehlercodes von Firebase/Supabase für die Fehlerbehandlung.
  \*/
  export enum AuthMessages { ... }

/\*\*

- Allgemeine Firebase/Supabase-Fehlercodes.
  \*/
  export enum General { ... }

Step 3.6: defaultValues.ts — Add JSDoc to getSupportUserUid()

/\*\*

- Gibt die UID des Support-Users für die aktuelle Umgebung zurück.
-
- @returns UID des Support-Users (DEV/TEST/PROD).
  \*/
  export const getSupportUserUid = () => { ... }

Step 3.7: imageRepository.ts — Add JSDoc

/\*\*

- Stellt umgebungsabhängige Bilder (Landing, Sign-In, PDF-Footer etc.) bereit.
-
- Gibt je nach Umgebungsvariable VITE_ENVIRONMENT die passenden
- Firebase-Storage-URLs für DEV, TEST oder PROD zurück.
  \*/
  export class ImageRepository { ... }

Step 3.8: styles.ts — Add JSDoc

/\*\*

- Zentrale MUI-Styles für die gesamte App.
-
- Verwendet `useTheme()` für dynamische Farbwerte.
- Wird in 82 Komponenten importiert.
-
- @returns Objekt mit allen Style-Definitionen.
  \*/
  export const useCustomStyles = () => { ... }

Step 3.9: Fix as any in PDF tokens

- pdfTokens.ts line 52: display: "table" as any → display: "table" as const
  (Note: @react-pdf/renderer types may not accept "table" — if this causes a TS error, keep
  as any and document in tech-debt)
- stylesRecipePdf.ts: same fix for display: "table" as any

Step 3.10: Clean styles.ts — remove dead commented-out code

Remove // import {makeStyles} (line 1) and other commented-out style rules.

Verification: npx tsc --noEmit, visual check that JSDoc renders in IDE hover.

---

Phase 4: Unit Tests

Goal: Add tests for files that contain logic (not pure value constants).

Step 4.1: defaultValues.test.ts

File: src/constants/**tests**/defaultValues.test.ts

Test cases:

1.  getSupportUserUid() returns a non-empty string for each environment
2.  MENUPLAN_MEALS has exactly 3 entries with name and uid
3.  INTOLERANCES array is non-empty
4.  DIETS array is non-empty
5.  TextFieldSize enum has small and medium values

Step 4.2: imageRepository.test.ts

File: src/constants/**tests**/imageRepository.test.ts

Test cases:

1.  Returns DEV images when VITE_ENVIRONMENT is "DEV"
2.  Returns TEST images when VITE_ENVIRONMENT is "TST"
3.  Returns PROD images when VITE_ENVIRONMENT is "PRD"
4.  Falls back to PROD images for unknown environment
5.  All returned URLs are non-empty strings
6.  PictureRepository interface shape: all 7 keys present

Step 4.3: routes.test.ts

File: src/constants/**tests**/routes.test.ts

Test cases:

1.  All routes start with /
2.  No duplicate route values
3.  UID routes contain :id parameter
4.  Key routes exist (LANDING, HOME, SIGN_IN, etc.)

Step 4.4: firebaseMessages.test.ts

File: src/constants/**tests**/firebaseMessages.test.ts

Test cases:

1.  AuthMessages enum has expected auth error codes
2.  General enum has expected error codes
3.  Supabase-specific codes are present (user_already_exists, invalid_credentials,
    email_not_confirmed)

Step 4.5: enumMappings.test.ts

File: src/constants/**tests**/enumMappings.test.ts

Test cases:

1.  ALLERGEN_FROM_DB and ALLERGEN_TO_DB are inverse mappings
2.  DIET_FROM_DB and DIET_TO_DB are inverse mappings
3.  All expected values are present (lactose, gluten, meat, vegetarian, vegan)

Verification: npx jest -- "constants/**tests**" — all tests pass.

---

Phase 5: styles.ts Restructuring Proposal

Goal: Improve the organization of the 662-line styles.ts without breaking existing
consumers.

Current State

The file is a single function returning one large object with ~100 style definitions
organized by comment sections:

- Global Steuerung, Global Components, Navigation, Forms, Recipe, Mail, Menuplan, etc.

Proposal: Keep as single file but improve organization

Rather than splitting into multiple files (which would break 82 imports and create import
complexity), I propose:

1.  Named export (done in Phase 2)
2.  JSDoc on the hook (done in Phase 3)
3.  Remove commented-out code (done in Phase 3)
4.  Add section-level JSDoc comments for each style group
5.  Type the return value — extract a CustomStyles type for IDE support

This keeps the file as-is for consumers while improving readability and type safety.

/\*_ Typ-Definition für alle Custom-Styles der App. _/
type CustomStyles = ReturnType<typeof useCustomStyles>;

export {useCustomStyles};
export type {CustomStyles};

Verification: npx tsc --noEmit, all 82 consuming components still work.

---

Tech Debt Items (out of scope → append to docs/claude/tech-debt.md)

1.  imageRepository.ts URLs still point to Firebase Storage — All environment images use
    Firebase Storage URLs. When migrating to Supabase Storage, update these URLs.
    Priorität: mittel · Komplexität: klein
2.  firebaseEvent.ts — Firebase Analytics dependency — This enum is used for Firebase
    Analytics logging. When Firebase is fully removed, this file either gets deleted or
    replaced with a Supabase/PostHog analytics equivalent.
    Priorität: tief · Komplexität: mittel
3.  styles.ts — 662 LOC single file — Could benefit from splitting into domain-specific
    style modules (eventStyles, recipeStyles, etc.) when a larger refactoring effort is
    planned. Currently 82 consumers make this risky to split.
    Priorität: tief · Komplexität: gross
4.  text.ts — no i18n framework — All UI strings are hardcoded German constants. If
    internationalization is ever needed, migrate to react-intl or i18next. Currently fine for a
    Swiss-German-only app.
    Priorität: tief · Komplexität: gross
5.  defaultValues.ts — hardcoded Support User UIDs — UIDs are hardcoded per environment.
    Should be moved to env variables or a database config table.
    Priorität: tief · Komplexität: klein
6.  enumMappings.ts — numeric enum bridge — These mappings exist because Allergen and Diet
    enums are numeric. Once those enums are migrated to string enums (see existing tech-debt
    entry), this entire file can be deleted.
    Priorität: mittel · Komplexität: klein (delete after enum migration)

---

Key Reference Files

┌─────────────────────┬──────────────┬─────────────────────────────────────────────────┐
│ File │ LOC │ Action │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ text.ts │ 1,644 → │ Remove 153 unused exports + commented-out lines │
│ │ ~1,200 │ │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ styles.ts │ 662 │ Named export, JSDoc, type extraction, clean │
│ │ │ comments │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ routes.ts │ 71 │ Clean commented-out routes │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ defaultValues.ts │ 59 │ Add JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ imageRepository.ts │ 78 │ Add JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ actions.ts │ 16 │ Named export (34 import sites), JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ roles.ts │ 7 │ Remove export default (24 import sites), JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ localStorage.ts │ 6 │ Named export (9 import sites), JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ firebaseEvent.ts │ 43 │ Remove export default (5 import sites), JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ firebaseMessages.ts │ 23 │ Add JSDoc │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ pdfTokens.ts │ 99 │ Fix as any │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ enumMappings.ts │ 42 │ Already good — add tests │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ dragAndDrop.ts │ 31 │ Already good — no changes needed │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ buttonText.ts │ 9 │ DELETE │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ mailTemplates.ts │ 13 │ DELETE │
├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
│ All 6 styles\*Pdf.ts │ ~670 total │ Fix as any in stylesRecipePdf.ts │
└─────────────────────┴──────────────┴─────────────────────────────────────────────────┘

Import Site Update Summary

┌──────────────────┬───────────────────────────┐
│ File │ Default imports to update │
├──────────────────┼───────────────────────────┤
│ styles.ts │ 82 (largest batch) │
├──────────────────┼───────────────────────────┤
│ actions.ts │ 34 │
├──────────────────┼───────────────────────────┤
│ roles.ts │ 24 │
├──────────────────┼───────────────────────────┤
│ localStorage.ts │ 9 │
├──────────────────┼───────────────────────────┤
│ firebaseEvent.ts │ 5 │
├──────────────────┼───────────────────────────┤
│ Total │ 154 import site changes │
└──────────────────┴───────────────────────────┘

---

Verification (End-to-End)

1.  npx tsc --noEmit — zero new errors
2.  npx jest -- "constants/**tests**" — all new tests pass
3.  npx jest — full test suite passes (no regressions from import changes)
4.  grep -r "export default" src/constants/ --include="\*.ts" — zero results
5.  grep -r "buttonText" src/ --include="_.ts" --include="_.tsx" — zero results
6.  grep -r "mailTemplates" src/ --include="_.ts" --include="_.tsx" — zero results
7.  grep -r "console\." src/constants/ --include="\*.ts" — zero results
8.  Browser: spot-check that routes, styles, and text strings render correctly

---

Project Root Cleanup — Folder & File Structure

Context

The project root has 45 items — a mix of required tooling configs, generated output, legacy
Firebase artifacts, and developer docs that have accumulated over time. The goal is to
identify what must stay at root (tooling requires it), what can be deleted, and what can be
reorganized for a cleaner structure.

Scope: Top-level only. /src and /supabase are excluded.

---

Step 1: Delete dead/duplicate files (zero risk)

┌────────────────────────────┬──────────────────────────────────────────────────────────┐
│ File │ Why │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ babel.config.js │ Dead — Jest uses ts-jest, Vite uses esbuild. Nothing │
│ │ reads this file. │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ favicon.ico (root) │ Duplicate of public/favicon.ico. Vite serves from │
│ │ public/, not root. │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ chuchipirat.code-workspace │ Empty single-folder workspace │
│ │ ({"folders":[{"path":"."}]}). Gitignored. No value. │
├────────────────────────────┼──────────────────────────────────────────────────────────┤
│ ui-debug.log │ Supabase runtime artifact. Already gitignored via \*.log. │
└────────────────────────────┴──────────────────────────────────────────────────────────┘

---

Step 2: Consolidate docs & planning under .claude/

Currently scattered:

- docs/claude/\*.md — Claude reference docs (architecture, conventions, etc.)
- tasks/todo.md, tasks/lessons.md — Claude workflow files
- MigrationPlan/\*.md — 16 migration phase documents
- .claude/ — already exists with commands/ and settings.local.json

CLAUDE.md references .claude/docs/ but the files are actually at docs/claude/ — an
inconsistency.

Proposed structure:
.claude/
├── commands/
│ └── generate-testcases.md (exists)
├── docs/ (move from docs/claude/)
│ ├── architecture.md
│ ├── conventions.md
│ ├── database-and-supabase.md
│ ├── migration.md
│ ├── refactoring-guidelines.md
│ ├── security-guidelines.md
│ ├── tech-debt.md
│ └── manual-testcases.md
├── plans/ (exists — plan files)
├── projects/ (exists — memory)
├── settings.local.json (exists)
└── migration-plan/ (move from MigrationPlan/)
├── phase-01.md
├── ...
└── phase-16.md

Actions:

1.  mv docs/claude/\*.md .claude/docs/ — align with what CLAUDE.md already says
2.  rm -r docs/ — empty after move
3.  mv MigrationPlan/ .claude/migration-plan/ — developer planning docs, not user-facing
4.  mv tasks/ .claude/tasks/ — Claude workflow files belong with Claude config
5.  Update CLAUDE.md table: paths already say .claude/docs/ so no change needed there
6.  Update .gitignore if needed for new paths

---

Step 3: Clean up Firebase stale references in index.html

index.html has two <link rel="preconnect"> tags for Firebase domains. The app runs on
Supabase now — these are dead weight and add unnecessary DNS lookups on page load. Remove
them.

---

Step 4: Verify patches/ version

patches/@react-pdf+renderer+1.6.17.patch targets version 1.6.17, but package.json has
^4.3.2. Run patch-package to confirm the patch still applies (or is silently skipped). If
skipped, the patch file is dead and should be removed.

---

Step 5: Update .gitignore

- Add MigrationPlan/ removal (it was tracked, moved to .claude/migration-plan/)
- Ensure tasks/ entries (if any) are updated to .claude/tasks/
- Verify docs/ is no longer referenced

---

NOT doing (intentionally deferred)

┌───────────────────────────────────┬───────────────────────────────────────────────────┐
│ Item │ Why deferred │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ firebase.json, .firebaserc, │ Still needed while Cloud Functions migration is │
│ .firebase/ │ in progress │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ functions/ │ Active Firebase Functions code, remove when fully │
│ │ migrated │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ cors/ │ Gitignored, harmless, remove with Firebase │
│ │ cleanup │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ README.md update │ Out of scope for this structural cleanup │
│ │ (separate task) │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ Rename build/ → dist/ │ Works fine, cosmetic change with CI impact │
├───────────────────────────────────┼───────────────────────────────────────────────────┤
│ tsconfig.json include for │ Remove when functions/ is deleted │
│ functions/ │ │
└───────────────────────────────────┴───────────────────────────────────────────────────┘

---

Result: Before → After

Before (45 items at root):
.DS_Store .claude/ .env.\* .eslintrc.js .firebase/ .firebaserc
.git/ .gitignore .nvmrc .vscode/ CLAUDE.md LICENSE.MD
MigrationPlan/ README.md babel.config.js build/ chuchipirat.code-workspace
cors/ coverage/ docs/ favicon.ico firebase.json functions/
html-report/ index.html jest.config.json node_modules/ package-lock.json
package.json patches/ public/ src/ supabase/ tasks/
tsconfig.json tsconfig.test.json ui-debug.log vite.config.ts

After (38 items, -7):
Deleted: babel.config.js, favicon.ico (root), chuchipirat.code-workspace, ui-debug.log
Moved into .claude/: MigrationPlan/ → .claude/migration-plan/
docs/claude/ → .claude/docs/
tasks/ → .claude/tasks/
Removed: docs/ (empty after move)

Root becomes: only tooling configs, env files, generated output dirs, and legacy Firebase
(to be cleaned up separately).

---

Verification

1.  npm run build — Vite build succeeds (no babel.config.js dependency)
2.  npm run test — Jest still works without babel.config.js
3.  npm run lint — ESLint passes
4.  Check all CLAUDE.md path references still resolve
5.  Verify patch-package output on npm install

---

Key files to modify

┌────────────────────────────┬──────────────────────────────────────────────┐
│ File │ Change │
├────────────────────────────┼──────────────────────────────────────────────┤
│ babel.config.js │ Delete │
├────────────────────────────┼──────────────────────────────────────────────┤
│ favicon.ico (root) │ Delete │
├────────────────────────────┼──────────────────────────────────────────────┤
│ chuchipirat.code-workspace │ Delete │
├────────────────────────────┼──────────────────────────────────────────────┤
│ ui-debug.log │ Delete │
├────────────────────────────┼──────────────────────────────────────────────┤
│ index.html │ Remove Firebase <link rel="preconnect"> tags │
├────────────────────────────┼──────────────────────────────────────────────┤
│ .gitignore │ Update paths for moved directories │
├────────────────────────────┼──────────────────────────────────────────────┤
│ CLAUDE.md │ Verify/update doc path references if needed │
└────────────────────────────┴──────────────────────────────────────────────┘
