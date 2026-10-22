# Security boundaries

This prototype uses Supabase Auth and Postgres. Postgres tables have row-level security policies that require `auth.uid() = user_id` for reads and writes. The browser uses only the public anon key; it does not contain a service-role key. Validate the SQL migration and RLS policies in the target Supabase project before use. This app is for synthetic/test information only and is not suitable for real financial records.

The database stores user-entered finance data and derived checklist state. Receipt images remain in the current tab, use revoked object URLs, and are not uploaded or persisted. The one-time browser-workspace importer reads only the email-matched account workspace after authentication and waits for explicit confirmation; it leaves the unattributed shared legacy workspace untouched. Password hashes from the old local account registry are not migrated or used for authentication.

The production Content Security Policy restricts scripts, styles, images, forms and objects and permits HTTPS requests to Supabase project hosts. Vite adds loopback HMR WebSocket and inline-style exceptions only while serving; production does not include those exceptions. `npm run verify:csp` checks the built policy. Frame embedding restrictions require host response headers (`frame-ancestors 'none'`) because meta CSP cannot enforce that directive.

Before using real data, the product needs a qualified security review, appropriate authentication controls, backups and restore drills, retention/deletion procedures, audit and incident response, and review of applicable Myanmar financial and privacy requirements. Supabase RLS is necessary but does not by itself make this prototype production-ready.
