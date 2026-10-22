# Supabase-backed workspace acceptance cases

Use synthetic or test information only. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for a test project and apply the SQL migration before running authenticated browser checks.

## Automated checks

Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. The unit suite tests auth request mapping, empty initial workspaces, legacy import preview validation, financial domain behavior and PDF generation. Authenticated browser flows require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; signup must return a session for the test flow, so disable email confirmation only in a disposable test project.

## Manual Supabase checks

| ID | Setup and action | Expected result |
| --- | --- | --- |
| DB-001 | Create two Supabase Auth users and sign into each in separate browser profiles. | Each gets an empty workspace with no transactions or receivables. Built-in categories may be available for entry forms. |
| DB-002 | In user A, add income, expense, receivable, schedule, and readiness checklist data. Sign out, sign in again, then sign into user B. | A's data persists after sign-in and none of it appears in B's workspace. |
| DB-003 | Using user A's authenticated anon-key session, query and attempt to update a row owned by user B. Repeat for each table. | RLS returns no foreign rows and rejects cross-user writes. Requests without an authenticated session cannot read or write workspace rows. |
| DB-004 | In a test browser, store a valid legacy account workspace under the matching normalized email key, then sign in. | The app previews counts for that account only; the old shared workspace is unchanged. No local data is sent before confirmation. |
| DB-005 | Confirm the import, reload, and sign in again. Retry an interrupted import using the same source IDs. | All records, settings, and checklist values are present, sample records are preserved, and retries do not duplicate rows. The import marker is saved only after writes succeed. |
| DB-006 | Choose **Start empty** on an import preview, sign out, and back in. | The choice is remembered and the import prompt does not reappear for that account. |
| DB-007 | Inspect built assets and browser network requests. | The frontend contains only the project URL and public anon key. No service-role key, password logging, receipt image upload, or shared-workspace import occurs. |

The migration's RLS policies are enforced by Postgres. A mocked browser test cannot substitute for DB-003; run it against the disposable Supabase project before accepting a schema or policy change.
