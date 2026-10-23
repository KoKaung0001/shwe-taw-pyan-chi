# Shwe Taw Pyan Chi

A financial-records prototype for freelancers and small businesses in Myanmar. Shwe Taw Pyan Chi brings recorded income, expenses, and receivables into one place, helps people review their cash movement, and prepares a clear summary they can take into a bank conversation. Use synthetic or test information only.

## About the product

Many independent workers and small businesses handle money across clients, wallets, and day-to-day purchases, but may not have a simple way to organize those records. Shwe Taw Pyan Chi is designed to make the activity they enter easier to review. It is a lightweight cash-movement tracker and report-preparation tool, not a full accounting system or a connection to a bank.

### Who it is for

- Freelancers and independent workers who want to track client income and everyday expenses.
- Online sellers and small businesses that need a clearer record of sales, purchases, and unpaid invoices.
- Prototype reviewers who want to explore a financial-records workflow using sample data.

### What users can do

1. Record income and expenses, and distinguish settled records from pending amounts.
2. Review totals and daily cash-flow or net-change charts for selected time periods.
3. Track receivables separately, then mark them paid to add linked income to the transaction history.
4. Review receipt information using a simulated extraction preview or manual entry.
5. Compare entered records with example bank checklists, see an explainable app-only FlowScore, and export a one-page readiness summary.
6. Ask the scripted assistant questions about recorded activity and inspect the records behind its answers.

The goal is to make the user's entered information clearer and easier to discuss. The app does not verify that information independently.

## Presentation build: no account required

Requires Node 24 LTS and npm.

```sh
npm ci
npm run build:demo
npm run preview
```

Open the preview URL and choose **Explore with demo data**. Deploy the generated `dist/` directory to a static host using **`npm run build:demo`** as its build command. Hash routes need no server rewrite rules. This build explicitly enables the public `VITE_ENABLE_DEMO=true` switch through `.env.demo`; it contains no secret.

Demo mode uses an isolated, in-memory workspace. It requires no Supabase account, does not read or write account finance records, and remains usable when Supabase is unavailable. Changes are discarded on **Exit demo** or page reload. The badge identifies sample data. Returning to the demo restores its initial records.

The fixed presentation fixture contains 43 settled transactions from November 2025 through October 2026, two unpaid receivables, one paid receivable with linked income, and 26 records marked as reviewed receipt/screenshot examples. Its FlowScore is 77/100 as of October 23, 2026. These dates are fixed, not regenerated as time passes.

## Account-backed build

Follow [Supabase setup](docs/SUPABASE_SETUP.md) for project configuration, migrations, and email confirmation. Put the project URL and public anon/publishable key in `.env.local`. Never expose a service-role key or AI-provider secret in a `VITE_` variable.

```sh
npm run dev
npm run build
```

Local development offers the demo entry. A normal production build hides it unless `VITE_ENABLE_DEMO=true` is explicitly set in the build environment. New Supabase accounts start empty. After signing in, matching email-isolated browser workspaces can be previewed and imported once; the old shared workspace remains untouched. Account access still depends on connectivity to Supabase.

## What works today

- **Transactions:** create, edit, filter, and delete manual records; distinguish settled and pending amounts.
- **Receivables:** record unpaid invoices and mark them paid to create one linked income transaction.
- **Dashboard:** income, expenses, period net balance, and receivables; Cash flow and Net change charts; weekly, monthly, and rolling 3/6/12-month ranges. Period and chart mode survive page navigation.
- **Receipt review:** upload a local preview, choose sample extraction or enter fields manually, review, and save. Images are discarded; there is no real OCR integration or stored receipt attachment.
- **Demo assistant:** scripted, playful responses using recorded totals, categories, and receivables, with supporting records. Purchase checks compare a price with monthly net movement; they cannot establish cash available or month-end affordability. No live AI provider is connected.
- **Credit readiness:** illustrative A Bank, Yoma, and MCB checklists; self-reported document availability; app-generated alternatives; explainable FlowScore; direct one-page English PDF export.

FlowScore averages four components equally: active-month coverage, monthly income consistency, non-negative monthly cash flow, and reviewed receipt/screenshot evidence. It uses a rolling 12-month window and requires at least six active months. It is not a bank score or an approval prediction. Requirements are user-provided examples; lender acceptance is unconfirmed.

## Limitations and data handling

- **Prototype only:** use synthetic or test information. Do not enter real financial or identity documents.
- **No financial connections:** the app does not connect to banks, wallets, payment providers, or accounting systems. Records are entered in the app.
- **No real receipt scanning:** receipt extraction is simulated. The image preview is local to the browser and discarded; the app does not store the original receipt image.
- **No live AI:** the assistant uses scripted responses based on saved records. Its playful purchase checks compare entered amounts and monthly net movement; they cannot determine available cash or predict whether a purchase is affordable.
- **No lending decision:** FlowScore is an app-only indicator. It does not assess creditworthiness or predict approval. Example bank requirements and their alternative proofs have not been confirmed with the lenders. Checklist document availability is self-reported, and the PDF is a summary rather than a loan application.
- **Not an accounting or tax system:** totals reflect records entered and the app's settled/pending classifications. They are not independently verified statements, tax advice, or a substitute for professional accounting.
- **Account storage depends on Supabase:** account-backed workspaces require a configured, reachable Supabase project. The presentation demo is in-memory and separate from account data. This prototype has not had the security, backup, recovery, or operational review required for real financial data.
- **Current language and currency:** the interface is in English and displays Myanmar kyat (MMK).

Opening balance, balance reconciliation, forecasts, and Insights are retired from the main product; their legacy data fields remain readable for compatibility. Payment schedules remain available as a secondary tool.

## Verification and walkthrough

```sh
npm test
npm run build:demo
npm run verify:csp
npm run test:demo
```

`test:demo` runs the presentation journey against the built production files at desktop and mobile widths, with Supabase requests blocked. It needs Playwright Chromium (`npx playwright install chromium`). The journey covers receivable settlement, dashboard updates, assistant evidence, readiness/PDF export, navigation preferences, reload, and exit.

`npm run test:e2e` is the broader account-backed browser suite; authenticated cases need a reachable, configured Supabase test project. Unit tests with a mocked repository do not establish live RLS or connectivity. See [test cases](docs/TEST_CASES.md) for backend acceptance checks and [demo guide](docs/DEMO_GUIDE.md) for the presentation script.

## Project structure

React, TypeScript, Vite, Tailwind, Zustand, Zod, and Supabase JS. `src/features` contains screens, `src/domain` calculations and contracts, `src/store` in-memory workspace state, and `src/services` authentication, database access, legacy import, and PDF export. Versioned SQL lives in `supabase/migrations`.

Older milestone and design documents describe earlier iterations; this README and the current demo guide describe the present scope.
