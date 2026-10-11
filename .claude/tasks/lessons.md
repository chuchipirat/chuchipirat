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
