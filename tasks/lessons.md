# Lessons Learned

## 2026-03-20: Always plan before coding — no exceptions (repeated mistake)

**What happened (1st time)**: User asked for changes to the where-used result display (grouping, navigation, different info). I immediately started coding (SQL migration, type changes, UI rewrite) without presenting a plan or getting confirmation.

**What happened (2nd time)**: Same session, different task. User asked to add unit conversion navigation and a recipe autocomplete. I again jumped straight into research + implementation without presenting a plan first. Even after being corrected once already.

**Rule**: CLAUDE.md says "Plan first, code second. Always create a plan before writing code. Discuss the approach, outline the steps, get confirmation. Never jump straight into implementation." This is a HARD rule, not a guideline. It applies to EVERY non-trivial change — including follow-up requests in the same conversation.

**How to apply**: When the user asks for a change: (1) Research/read code to understand the problem. (2) Enter plan mode and present the approach. (3) Wait for confirmation. (4) THEN implement. The only exception is truly trivial single-line fixes. If in doubt, plan first. Being corrected twice in the same session means this pattern is deeply ingrained — be extra vigilant.
