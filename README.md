# Shwe Taw Pyan Chi

**A clearer view of your money.**

Shwe Taw Pyan Chi is a cash-flow workspace for people in Myanmar who handle money across many small, everyday transactions. It brings income, expenses, receivables, and scheduled payments into one place so freelancers, gig workers, online sellers, and small business owners can see where their money stands without maintaining a spreadsheet.

It is a product prototype: accounts and records are stored in Supabase, but it is intended for synthetic or test information only.

## What it does

- **Cash-flow overview** — See income, expenses, net movement, receivables, and recent activity for the period you choose. Net movement is a record of what you entered, not a bank balance.
- **Everyday records** — Add, edit, search, filter, and delete income and expenses in MMK. Track pending payments and due dates, and correct records in place.
- **Receivables and obligations** — Keep money clients owe you separate from received income. Settling a receivable creates one linked income record, while pending expenses and scheduled payments track money you still owe.
- **Payment schedules** — Create one-time or monthly payments. Due payments are recorded as unconfirmed until you confirm, correct, or mark them unpaid. Future payments stay out of cash totals.
- **Receipt and screenshot review** — Preview an image locally and review simulated sample fields before saving. Images stay in the browser tab and are discarded after review.
- **Roast Mode assistant** — Ask scripted questions about your recorded income, expenses, categories, overdue items, and receivables. Answers cite the records they use and decline unsupported questions.
- **Credit readiness** — Compare your records with example bank checklists, tick off documents you already have, view an app-only FlowScore, and export a one-page PDF summary.
- **Private workspace** — Supabase Auth and row-level security keep each user's records separate. A time-zone preference is saved with the workspace.

## Who it is for

Freelancers, gig workers, online sellers, and small business owners in Myanmar who need a simple, honest view of their cash flow but do not need full accounting software. The product is built around one shared workflow rather than separate tools for each type of work.

## Limitations

- **Not suitable for real financial data.** This is a prototype. Use synthetic or test information only.
- **No live financial connections.** There are no bank, wallet, payment, or accounting integrations. Automatic bank and CSV imports are not supported; only a one-time import of an older browser workspace is offered after sign-in.
- **Receipt extraction is simulated.** No OCR or AI service is used. Images are never uploaded or stored, and the sample fields must be reviewed and corrected manually.
- **The assistant is scripted.** It answers a limited set of questions from saved records. It is not a live AI model and does not give financial, legal, or tax advice or predict loan approval.
- **Credit readiness is not underwriting.** FlowScore is an app-only cash-flow indicator, not a bank score or creditworthiness assessment. The bank requirements are user-provided examples that have not been confirmed by lenders. The PDF is a summary, not a loan application or approval prediction.
- **Security is not production-grade.** Per-user row-level security is in place, but the project still needs a security review, backups and restore drills, retention and deletion procedures, and incident-response planning before real data can be considered.
- **English and MMK only.** The interface is English and amounts are recorded in Myanmar kyat.

## Run it locally

### Requirements

- Node.js 24.x (`>=24 <25`) and npm
- A Supabase project

### 1. Install dependencies

```sh
npm ci
```

### 2. Configure the frontend environment

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```sh
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Use only the project URL and public anon/publishable key. Never put a service-role key in a `VITE_` variable or any frontend file.

### 3. Set up Supabase

1. Create a Supabase project and copy its Project URL and public anon key.
2. Apply the database migration in `supabase/migrations/202610220001_initial_workspace.sql`. Paste it into the Supabase SQL Editor, or link the project and run `supabase db push` with the Supabase CLI.
3. In Supabase Auth, set the Site URL to `http://127.0.0.1:5173` and add your deployed URL when you have one. If email confirmation is enabled, users must confirm their email before signing in.
4. Restart Vite after changing environment variables.

For more detail, see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

### 4. Start the app

```sh
npm run dev
```

Open the URL printed by Vite; it defaults to `http://127.0.0.1:5173`.

During local development, **Explore with demo data** on the landing or sign-in screen opens a synthetic workspace without Supabase. The preview lasts only for that session and is not included in production builds.

## Build and deploy

```sh
npm run build
npm run preview
```

`npm run preview` serves the production build locally. To deploy, upload the `dist/` directory to any static host and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the build environment. The app uses hash-based URLs, so no server rewrite rules are required.

Before deploying, run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:csp
```

`verify:csp` checks the production Content Security Policy. For browser tests, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`.
