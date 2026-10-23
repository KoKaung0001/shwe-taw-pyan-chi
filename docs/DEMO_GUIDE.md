# Prototype walkthrough

Use synthetic or test information only. The app uses Supabase Auth and Postgres; it does not connect to a bank, wallet, OCR service or AI service.

## Prepare

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md), apply the database migration, set `.env.local`, and run `npm ci` followed by `npm run dev`. Configure Supabase email confirmation according to the intended test flow. New accounts have no sample transactions or receivables.

For a walkthrough that does not require Supabase, build with `npm run build:demo`, deploy the generated `dist/` directory, and choose **Explore with demo data** on the landing or sign-in screen. The presentation build enables a public feature switch only; it exposes no credentials. The demo uses an isolated in-memory workspace and makes no Supabase database or Auth requests. Changes are discarded when you exit or reload. Re-entering restores the initial sample records.

The presentation dataset includes 43 settled records over 12 months, two unpaid and one paid receivable, and reviewed receipt/screenshot examples for FlowScore. Sample dates are fixed; do not present them as live or independently verified financial history.

## Walkthrough

1. Start at **Get Started**, create an account, and confirm the email if confirmation is enabled.
2. Sign in and confirm the workspace starts without transaction or receivable records.
3. Add test income and expense records. Check that the dashboard totals, chart, transactions page, and assistant reflect those records.
4. Add an explicit receivable, then mark it paid and confirm it creates one linked income record.
5. Open Credit Readiness, select a bank profile, and mark an example self-reported document. The checklist state is stored in the signed-in workspace; it does not upload files or predict approval.
6. Open Settings and change the time zone. Sign out and back in to confirm the preference persists.
7. If testing an existing browser account, prepare a matching local workspace and verify the import preview before confirming. The import includes sample records in that account workspace. The old unattributed shared workspace is not imported.

To reset a test run, use a new Supabase Auth user or remove the test user's rows from the Supabase project. There is no in-app demo reset action.
