# Supabase – Migrations

Loaded only when working under `supabase/`. Root-level rules (never modify applied migrations, no PROD access) still apply.

## Adding New Migrations

- **New changes** after the baseline go into individual timestamped migration files (e.g. `20260405000001_add_foo_column.sql`)
- **Never modify baseline files** once deployed to any environment
- Each migration file should be self-contained (include table changes + related RLS + grants + indexes)
- Follow the existing pattern: `YYYYMMDDNNNNNN_descriptive_name.sql`

## Running Locally

- `supabase db reset` (via CLI) or `docker compose down -v && docker compose up` to rebuild from scratch
- Migrations must run as `supabase_admin` (the Supabase CLI default)
- `postgres` is NOT a superuser in Supabase — never test migrations manually as `postgres`
