# Supabase setup

The app uses Supabase Auth and Postgres for prototype/test data. Do not enter real financial information. The browser receives only the project's public anon key; never add a service-role key to a `VITE_` variable or frontend file.

## Configure a project

1. Create a Supabase project and copy its Project URL and public anon key.
2. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Apply `supabase/migrations/202610220001_initial_workspace.sql` in the Supabase SQL Editor, or with the Supabase CLI using `supabase db push` after linking the project.
4. In Supabase Auth, configure the allowed site URL and redirect URLs for local development and each deployed static host. Email confirmation may be enabled; when enabled, signup prompts users to confirm their email before logging in.
5. Restart Vite after changing environment variables, then build and deploy the static `dist/` directory. Set the same two public variables in the build environment for deployed builds.

After changing SQL tables, regenerate the checked-in client types with `supabase gen types typescript --linked > src/services/database.types.ts`.

The migration creates per-user relational tables and row-level security policies. All data reads and writes use the authenticated user's `auth.uid()`; the app does not use privileged server credentials. The Content Security Policy allows HTTPS connections to Supabase project hosts.

## Existing browser workspaces

After login, the app checks only the local workspace matching the normalized email. It shows the available record counts and asks before importing. Confirming imports transactions, receivables, categories, counterparties, schedules, readiness checklist values, settings, and legacy balance fields, including sample records. The import marker is saved only after the workspace writes succeed, so retrying an interrupted import uses stable IDs and upserts rather than duplicating records. Choosing **Start empty** records that choice for the account. The unattributed shared legacy workspace and local account password hashes are not migrated.

New accounts have no sample transactions or demo reset control. The built-in category list is empty-workspace configuration; test fixtures remain in the test suite.
