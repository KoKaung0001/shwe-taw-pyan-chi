# FinTech Companion

A frontend prototype for everyday financial records in Myanmar. It starts with synthetic MMK sample activity and an unpaid receivable, then persists edits in validated browser storage. Users can create and edit transactions, track explicit receivables, review simulated receipt extraction, ask deterministic questions, and check record completeness. Images stay in the browser tab and are discarded after review; no OCR service is used. Forecasting and scheduled payments remain secondary tools. Never enter real financial information.

## Run locally

Requires Node 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For production: `npm run build`, then `npm run preview`. Build output is `dist/`; deploy to a static host. Hash URLs work without server rewrite rules. No environment variables or secrets are needed.

## Verify

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:csp
npx playwright install chromium
npm run test:e2e
```

CI runs these checks, audits high-severity dependency advisories and runs a separate Chromium navigation/responsiveness job. Tests cover the five destinations, overflow at 360/768/1280 px, weekly dashboard totals, transaction create/edit/filter/persistence, receivable settlement idempotency, receipt review and confirmation, assistant questions, readiness choices, reset confirmation, malformed-storage recovery and safe text rendering. The CSP check verifies the production HTML policy is stricter than the development policy.

The reviewer-ready acceptance cases for completed milestones are in [TEST_CASES.md](docs/TEST_CASES.md), including manual setup/steps, expected outcomes, automated coverage and current gaps. A short synthetic-data walkthrough is in [DEMO_GUIDE.md](docs/DEMO_GUIDE.md).

## Structure and scope

`src/app` composes routing and layout; `src/components` shared UI; `src/features` financial screens and remaining placeholders; `src/store` validated Zustand persistence; `src/domain` Zod data contracts and pure balance and schedule lifecycle logic; `src/services` injected clock; `src/i18n` English and Burmese skeleton; `e2e` browser checks. React 18, TypeScript, Vite, Tailwind, React Router, lucide-react, react-i18next, Zustand and Zod power the prototype.

The five primary destinations are Home, Transactions, Add, AI Assistant and Credit Readiness. Add offers manual entry, simulated upload and explicit receivable creation. Receivables stay separate from income until a user marks them paid; settlement creates one linked income record. Settings remains secondary and includes a confirmed demo-data reset. Insights and payment schedules remain accessible as secondary tools. The assistant answers a bounded set of questions from current browser records; readiness checks completeness only and does not upload documents or assess creditworthiness. Mobile uses a five-item bottom navigation bar. No live financial or AI connections are used.

## Product behavior and next work

[Decisions](docs/DECISIONS.md) define a dated initial balance, automatic carry-forward, distinct net movement/recorded balance, one-time and monthly schedules, unconfirmed due-payment assumptions, same-occurrence corrections, single counting and user-controlled duplicate resolution. [Requirements](docs/FinTech_PRD_SRS.md) capture acceptance and the staged roadmap; [implementation guide](codex-master-prompt.md) keeps future work aligned. [Security](docs/SECURITY.md) describes boundaries. The [original diagram](docs/use-case-diagram-v3.png) is unchanged and has documented mismatches.

M1 delivered validated contracts, occurrence and duplicate-review records, the opening-reference selector, injected clock and recovery-safe persistence. M2 delivers opening-balance setup and manual transactions. M3a delivered one-time schedules; M3b adds monthly occurrences, month-end clamping and catch-up with a rolling one-year occurrence window. M4 adds simulated local receipt review. M5 completes dashboard, outstanding views and the 14-day forecast. M6 adds rule-based insights, version-aware duplicate review and grounded chat. M7 delivers record checks, a user-maintained document checklist and optional keyword category suggestions. M8 completes browser coverage for recovery, readiness, schedule cancellation and safe text rendering; the development-only CSP exception is excluded from production builds, and the demo walkthrough is documented. No license has been selected by the owner.
