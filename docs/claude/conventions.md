# Conventions

Consult this file for project-wide conventions that don't fit into architecture, database, or security docs.

## Language

- Code (variable names, function names, class names): **English**
- Comments, JSDoc/TSDoc documentation: **German**
- UI strings, user-facing text, email content: **German (Swiss)**
- Documentation in `.claude/docs/`: English (except Obsidian testcase docs which are German)
- Commit messages: English (conventional commits)

## UI Framework

- **Material UI (MUI) only** — do not introduce other UI frameworks
- All components must be responsive: desktop/tablet for camp preparation, mobile for on-site use during the camp

## Error Logging

- All error logging goes through **Sentry**
- Do NOT use `console.log` / `console.error` for production error handling
- Use proper error boundaries in React for UI errors
- Use Sentry captures for async/backend errors

## Email Templates

Templates live in `supabase/volumes/auth/templates/`.

- **Font**: `'Roboto', 'Helvetica Neue', Arial, sans-serif`
- **Primary color**: `#006064` (teal) for header background, buttons, and accent links
- **Header image**: Always include the Chuchipirat logo:
  ```
  https://firebasestorage.googleapis.com/v0/b/chuchipirat.appspot.com/o/mailTemplates%2FMail%20Header%20weiss.png?alt=media&token=61c6aa52-d611-4921-ad8c-3c9ecb26f85d
  ```
  Use `width="220"` and `max-width: 220px`
- **Language**: All email text in German
- **Footer**: Include `hallo@chuchipirat.ch` as contact
