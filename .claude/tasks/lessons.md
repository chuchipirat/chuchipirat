# Lessons Learned

## 2026-03-20: Always plan before coding — no exceptions (repeated mistake)

**What happened (1st time)**: User asked for changes to the where-used result display (grouping, navigation, different info). I immediately started coding (SQL migration, type changes, UI rewrite) without presenting a plan or getting confirmation.

**What happened (2nd time)**: Same session, different task. User asked to add unit conversion navigation and a recipe autocomplete. I again jumped straight into research + implementation without presenting a plan first. Even after being corrected once already.

**Rule**: CLAUDE.md says "Plan first, code second. Always create a plan before writing code. Discuss the approach, outline the steps, get confirmation. Never jump straight into implementation." This is a HARD rule, not a guideline. It applies to EVERY non-trivial change — including follow-up requests in the same conversation.

**How to apply**: When the user asks for a change: (1) Research/read code to understand the problem. (2) Enter plan mode and present the approach. (3) Wait for confirmation. (4) THEN implement. The only exception is truly trivial single-line fixes. If in doubt, plan first. Being corrected twice in the same session means this pattern is deeply ingrained — be extra vigilant.

## 2026-10-10: Never run `npx prettier --write` on whole files

**What happened**: To format my own additions I ran `npx prettier --write` on seven files. The repo has no prettier config — the style (`bracketSpacing: false`) lives only in the user's VS Code settings — so prettier reformatted every import (`{App}` → `{ App }`) and rewrapped existing lines, including files with the user's uncommitted work. Caught it in `git diff`, restored with `--no-bracket-spacing` and `git checkout` of a clean file.

**Rule**: Write new code already in the project style instead of formatting afterwards. If formatting is needed, use `npx prettier --no-bracket-spacing` and only on files where the diff afterwards shows nothing but my own lines.

**How to apply**: After any formatter run, check `git diff --stat` and the removed lines (`git diff | grep "^-"`) before going on. Untracked files can't be restored from git — never format those blind.

## 2026-10-11: UI wording is "Anlass", never "Lager"

**What happened**: My Epic 6 plans and JSDoc used "Lagertag", "Lagerende", "vor dem Lager". In review I even asked the user to change their correct "Anlasstage" to "Lagertage". The app uses "Anlass" consistently (~35× in `src/constants/text`).

**Rule**: User-facing texts, plans and German comments say "Anlass", "Anlasstag", "Anlassende". English identifiers (`campDays`) may stay.

**How to apply**: Before proposing UI wording, grep `src/constants/text` for the existing term instead of using my own vocabulary.

## 2026-10-15: Expense-Tracking plans go into the story file, not todo.md

**What happened**: For package 6.2c I prepended the plan to `.claude/tasks/todo.md`, following the global "write plan to todo.md" rule. The user wants feature work on expense tracking tracked only in `.claude/tasks/Expense Tracking.md`.

**Rule**: For the expense-tracking feature, plans, checklists, deviations and review notes go into the matching package section of `Expense Tracking.md`. Do not touch `todo.md` for this feature.

**How to apply**: Before writing a plan, check whether the feature has its own story/task file in `.claude/tasks/`; if so, plan there.

## 2026-10-16: Identifiers say "event", never "camp"

**What happened**: The 6.1–6.3 plans and my code sketches used `campDays`, `campDayKeys`, `elapsedCampDays`, `cumulativeByCampDay` etc. The user had these renamed throughout: the code always talks about the *event*, never about a camp.

**Rule**: English identifiers use `event` (`eventDays`, `eventDayCount`, `getEventDayIndex`), matching the German "Anlass" in UI and comments. Never `camp`, also not in plan sketches or test fixtures.

**How to apply**: Before naming anything, grep for the existing term (`grep -rn "eventDay" src`). Also my comments in code sketches must be German, even when I post them only in chat — the user copies them into the code.

## react-pdf: `wrap={false}` an `<Page>` macht die Seite so hoch wie ihr Inhalt (2026-10-25)

**What happened**: The Story 7.3a plan put `<Page size="A4" wrap={false}>` on each receipt page to guarantee "one receipt = one page". In the export the receipt pages were not A4 but only as tall as their content. Cause: `paginate` in `@react-pdf/layout` returns a `wrap={false}` page unchanged and skips `splitPage`, which is the step that sets the page box height from `size`.

**Rule**: Never put `wrap={false}` on a `<Page>`. Use it only on `View`s inside the page. A "fills the rest of the page" layout (`flexGrow: 1`, image `objectFit: "contain"`) already keeps the content on one page.

**How to apply**: Before planning a react-pdf prop on `Page`, check its handling in `node_modules/@react-pdf/layout/lib/index.js` (`paginate`, `splitPage`), not just the typings.

## pdf-lib: Fehlerklassen sind nicht erkennbar (2026-10-25)

**What happened**: The 7.3b plan said to filter encrypted PDFs with `error.name === "EncryptedPDFError"` or `instanceof`. Neither works: pdf-lib ships ES5 code (tslib `__extends`), where `_super.call(this, msg)` returns a plain `Error`, so `instanceof` is false and `name` is "Error". Same for every pdf-lib error class.

**Rule**: Never detect a library's custom error class without checking its compiled output first. For pdf-lib, avoid the throwing path (e.g. `ignoreEncryption: true` + `isEncrypted`) and throw an own error class.

**How to apply**: Before planning error handling around a third-party error class, write a 5-line probe test (`new LibError() instanceof LibError`, `.name`) and run it.

## Sammelansicht: bekannte eigene Daten nicht wegwerfen (2026-10-25)

**What happened**: The 7.4 plan (F8) gave every person blank lines under "Alle Personen", including the logged-in user, although their own payment details were already loaded. The user noticed in the export that their own section stayed empty.

**Rule**: When a feature has a "one person" and an "everyone" variant, ask per person which data is already known. Don't simplify the "everyone" case to "nothing filled" just because there is no form for it.

**How to apply**: When planning, write one line per case in the decisions (own person / other person / everyone → own section / everyone → others) and say what each one shows.

## Mutationsproben: Jest-Exit-Code sagt hier nichts (2026-10-27)

**What happened**: In Story 7.5 the probe scripts judged a mutant by Jest's exit code (`if npx jest …; then ÜBERLEBT; else gefangen`). In this repo Jest ends with exit code 1 even when every test passes (obsolete snapshot files), so every probe reported «gefangen». The plan file already said so (7.2: «nur ‹Tests: … failed› zählt»), but I didn't apply it. It surfaced only because a deliberately harmless mutant was «caught». After fixing the scripts, one real gap (comments in the card height estimate) survived and needed a new test.

**Rule**: A probe counts as caught only when the Jest output contains `Tests: … failed`. Never use the exit code.

**How to apply**: Every probe script uses `npx jest … 2>&1 | grep -aqE "^Tests:.* failed"` (`-a`: a test title with a control character, e.g. a NUL byte, makes grep treat the output as binary and miss the line, 2026-10-28). Before the first probe, run the script's test command once without a mutation and check that it reports «ÜBERLEBT».

## Keine Plan-Verweise im Code (2026-10-27)

**What happened**: The JSDoc I wrote for `ExpenseExport` contained "(E3, Epic 8 O1)". The user removed it: the plan file will be deleted later, so these references point nowhere.

**Rule**: Comments, JSDoc and test names never reference plan IDs (Epic, Story, E3, O1, X8). Write the reason itself.

**How to apply**: Before handing over code, `grep -nE "Epic|Story|\b[EOX][0-9]+\b"` over the changed files.

## Tests first: check planned values exactly, not with `expect.anything()`

**What happened**: In 8.2 the page test checked the Sentry context with `expect.anything()`. The plan said "CSV exportieren"; the implementation used "Abrechnung erstellen", copied from the neighbouring handler, and the test stayed green.

**Rule**: When tests are the definition of done, every value the plan names (context strings, analytics payloads, file names) is asserted exactly.

**How to apply**: In the mutation probes, also try "value copied from the neighbouring handler", not only "call missing".

## Caching: check the real header before explaining it (2026-10-31)

**What happened**: A deleted receipt still ended up in the ZIP. I explained it with Supabase's default `Cache-Control: max-age=3600`. But receipts are uploaded with `cacheControl: "0"` (the code says so, and `storage.objects.metadata` on DEV shows `max-age=0`), so the explanation was wrong. The workaround I gave (DevTools "Disable cache" / "Block request URL") still worked.

**Rule**: Before blaming a cache, check the actual value: the upload call, `storage.objects.metadata->>'cacheControl'`, or the response header in DevTools.

**How to apply**: Grep for `cacheControl` at the upload call, or read the metadata read-only on the local DB, before answering.
