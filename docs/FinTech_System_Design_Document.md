# FinTech --- System Design Document

**Project:** FinTech Buildathon\
**Status:** MVP prototype architecture\
**Target deadline:** 23 October 2026, 11:59 PM MMT

## 1. Purpose and constraints

This document describes an implementable frontend prototype architecture
consistent with the frozen MVP. The system uses synthetic records and
browser storage. It does not provide production authentication, a remote
database, live wallet/bank connections, real OCR, or a live AI service.

The design should favor a single source of truth for financial records
and calculations so the dashboard, insight cards, and assistant cannot
disagree.

## 2. Architecture overview

``` mermaid
flowchart TD
    UI[Responsive Web UI]
    NAV[App Navigation and Screens]
    STATE[Shared Application State]
    SERVICE[Domain Services and Calculations]
    STORAGE[Browser Storage Adapter]
    SEED[Synthetic Initial Dataset]
    OCR[Simulated Extraction Adapter]
    AI[Deterministic Demo Insight and Chat Adapter]

    UI --> NAV
    NAV --> STATE
    STATE --> SERVICE
    SERVICE <--> STORAGE
    SEED --> STORAGE
    NAV --> OCR
    OCR --> STATE
    NAV --> AI
    AI --> SERVICE
```

### Layers

1.  **Presentation:** dashboard, transactions, Add chooser/forms, upload
    review, assistant, credit checklist, settings.
2.  **Application state:** current records, filters, selected dashboard
    period, chat transcript, upload draft, UI feedback.
3.  **Domain services:** validation, period totals, receivable
    calculations, settlement handling, insights, deterministic answers.
4.  **Persistence adapter:** browser storage for demo records and
    lightweight preferences.
5.  **Demo adapters:** simulated OCR field extraction and deterministic
    AI/insight output.

Keep calculation and validation logic outside presentation components.
UI components should call domain functions rather than independently
recomputing totals.

## 3. Suggested frontend organization

The exact framework may follow the existing project setup; the logical
module boundaries should remain:

``` text
src/
  app/
    AppShell
    routes-or-views
  components/
    Navigation
    MetricCard
    TransactionItem
    FilterBar
    FormField
    EmptyState
    InsightCard
    ChatMessage
    UploadPanel
    ConfirmDialog
  features/
    dashboard/
    transactions/
    add/
    receipt-demo/
    assistant/
    credit-readiness/
    settings/
  domain/
    transaction-types
    validation
    money-formatting
    date-periods
    financial-calculations
    receivables
    insights
    demo-assistant
  data/
    seed-data
    storage-adapter
  styles/
    tokens
    global-styles
```

This is a suggested structure, not a claim that files or framework
configuration already exist.

## 4. Domain data model

Use a consistent model and explicit record types. A TypeScript-like
representation:

``` ts
type CurrencyCode = "MMK";
type TransactionType = "income" | "expense";
type RecordSource = "manual" | "receipt_upload" | "screenshot_upload";
type VerificationStatus = "not_applicable" | "draft" | "reviewed";
type ReceivableStatus = "unpaid" | "paid";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;            // positive finite amount
  currency: CurrencyCode;
  date: string;              // ISO date, YYYY-MM-DD
  categoryId: string;
  description?: string;
  counterparty?: string;     // client, customer, merchant, or sender
  paymentStatus?: string;    // only where relevant to the record
  source: RecordSource;
  verificationStatus: VerificationStatus;
  createdAt: string;
  updatedAt: string;
}

interface Receivable {
  id: string;
  amount: number;            // positive finite amount
  currency: CurrencyCode;
  date: string;              // date the receivable was recorded/issued
  counterparty: string;
  description?: string;
  categoryId?: string;
  status: ReceivableStatus;
  settledAt?: string;
  linkedIncomeTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreditReadinessItem {
  id: string;
  label: string;
  status: "complete" | "missing";
}

interface AppData {
  schemaVersion: number;
  transactions: Transaction[];
  receivables: Receivable[];
  creditReadinessItems: CreditReadinessItem[];
}
```

### Model notes

-   Transaction amounts are stored as positive numeric values;
    transaction type determines whether they contribute to income or
    expenses.
-   Use MMK as the demo currency. Do not imply multi-currency support
    unless implemented.
-   `paymentStatus` must not be used to infer that an amount is owed to
    the user. Receivables are explicit domain records.
-   A receivable is not itself recognized as received income.
-   Store only availability status for identity-document readiness; do
    not store document images or sensitive document content.
-   Use stable IDs and timestamps to support edits and debugging.
-   A schema version allows future demo-data shape changes to be handled
    deliberately.

## 5. Accounting and calculation rules

All dashboard, insight, and assistant calculations must use shared
domain functions.

### 5.1 Date boundaries

-   Default selected period: current calendar week, Monday through
    Sunday.
-   Define period boundaries in the user's local date context.
-   Use an inclusive start and end date for date-only records.
-   Keep a single helper for determining whether a record falls in a
    selected period.

### 5.2 Dashboard calculations

For selected period (P):

-   `periodIncome(P)` = sum of income transactions whose dates fall in
    (P).
-   `periodExpenses(P)` = sum of expense transactions whose dates fall
    in (P).
-   `periodNetBalance(P)` = `periodIncome(P) - periodExpenses(P)`.
-   `outstandingReceivables(asOfToday)` = sum of receivable amounts
    where status is `unpaid`.

The receivables metric is current and independent of the selected
dashboard period. Net balance is recorded income minus recorded
expenses, not actual bank balance or available cash.

### 5.3 Receivable settlement

-   Receivables use only `unpaid` and `paid`.
-   Creating a receivable must not automatically add an income
    transaction.
-   When marking a receivable paid, use one explicit settlement
    operation that updates the receivable and, if the chosen demo
    accounting rule records receipt as income, creates/links exactly one
    income transaction.
-   Store `linkedIncomeTransactionId` or an equivalent idempotency guard
    to prevent duplicate income when the paid action is repeated.
-   If the implementation chooses not to create an income record on
    settlement, document that behavior in the UI and ensure income
    metrics remain internally consistent. The preferred demonstration is
    to create/link exactly one income transaction on first settlement.
-   No partial payments in this MVP.
-   Never derive receivables from generic pending expense/payment
    statuses.

### 5.4 Validation

-   Amount must be finite and greater than zero.
-   Date must be valid.
-   Type and category must be selected.
-   Currency defaults to MMK.
-   For extracted fields, the user must review and confirm before
    creating a transaction.
-   Reject or clearly handle missing required fields without mutating
    stored data.

## 6. State management

The shared application state should contain or derive: -
`transactions` - `receivables` - `creditReadinessItems` - selected
dashboard period - transaction filters - current route/navigation
state - current upload draft and extracted fields - assistant messages -
transient validation/success/error feedback

Use derived selectors for period income, expenses, net balance,
outstanding receivables, highest expense category, and insight inputs.
Avoid separately storing derived totals unless there is a clear cache
invalidation strategy.

When a transaction or receivable changes: 1. Validate the action. 2.
Apply the domain operation. 3. Update shared state. 4. Persist the
changed data. 5. Re-render all dependent views from the same
state/selectors.

## 7. Persistence and initialization

### Browser storage

-   Persist synthetic demo records in browser storage (e.g.,
    `localStorage`) so changes survive refreshes in the same browser.
-   Store a schema version.
-   Seed initial records only if no valid saved dataset exists.
-   Do not reseed on each page load.
-   Handle malformed or inaccessible stored data with a safe fallback
    and clear user feedback where appropriate.

### Reset Demo Data

1.  User selects Reset Demo Data.
2.  Show a confirmation dialog.
3.  If cancelled, leave data unchanged.
4.  If confirmed, replace local demo data with the initial synthetic
    dataset and reset related demo state.
5.  Do not claim to erase remote/production records; no remote store is
    part of this prototype.

### Privacy boundary

Use fictional Myanmar-relevant names, descriptions, and MMK values. Do
not request financial account credentials, real wallet screenshots, or
actual identity documents for the prototype.

## 8. Simulated receipt/screenshot processing

The upload flow is a demo adapter, not real OCR.

1.  User selects an image.
2.  Validate supported file type/size as appropriate for the frontend.
3.  Display a clear simulated-extraction label.
4.  Populate sample fields for amount, date, merchant/sender, type,
    optional reference, and category if available.
5.  Keep values in a temporary draft, not persisted transaction state.
6.  User edits and confirms fields.
7.  Validate the confirmed values.
8.  Create a transaction with source `receipt_upload` or
    `screenshot_upload` and verification status `reviewed`.
9.  Persist and update dependent views.

If the image cannot be selected or sample extraction is unavailable,
show an actionable error and allow manual entry. Do not claim
authenticity detection, fraud detection, or tamper verification.

## 9. Insights and assistant design

### 9.1 Insight service

Generate insights from shared selectors and the current data: -
Income/expense summary for the selected period. - Highest expense
category when enough expense data exists. - Outstanding receivables
summary. - Possible duplicate detection using a conservative match of
amount, date, and counterparty/description. - Missing/incomplete fields
where applicable.

Each insight should distinguish factual calculation from interpretation.
Do not show an insight that cannot be supported by current records.
Provide an insufficient-data state.

### 9.2 Deterministic demo assistant

Use a small intent map for the required questions and calculate answers
at response time from current data. Required intents: -
`weekly_income` - `weekly_expenses` -
`highest_weekly_expense_category` - `outstanding_receivables`

Responses must state the period where relevant. Suggested-question
buttons should trigger the same intent handlers as equivalent typed
questions. For unsupported questions, state the demo limitation or offer
supported questions. If no live AI service exists, show a persistent
demo label.

Do not hardcode answers tied to the initial seed dataset; calculate from
current state so edits are reflected.

## 10. Credit readiness (P1)

Store or derive six binary items: - Income records available. - Expense
records available. - Receipt evidence available. - Transaction records
reasonably complete. - Identity-document availability recorded. -
Invoice/payment evidence available.

Statuses are only `complete` or `missing`. The interface should explain
the criteria used for demo statuses. Do not collect identity documents
or calculate a credit score. This feature must be deferred until the P0
workflow is stable.

## 11. Error handling

-   Form validation errors should be specific and shown near the
    relevant field.
-   Storage failures should not silently claim data was saved.
-   Empty period or empty filter results should provide a next action.
-   Simulated extraction errors should allow retry or manual entry.
-   Unsupported assistant prompts should not produce invented financial
    facts.
-   Reset requires confirmation and should provide feedback after
    completion.
-   Guard against repeated receivable settlement creating duplicate
    income.

## 12. Security and production boundary

This prototype uses local browser storage and synthetic data; it is not
suitable for production financial records. Before production use, a
separate engineering phase must define and implement: - Real
authentication, authorization, and session handling. - Secure
server-side data storage and access controls. - Transport security and
appropriate encryption at rest. - Privacy notice, consent, retention,
deletion, and incident processes. - Validation and audit logging
appropriate for financial records. - Secure file upload handling, file
retention policy, and a real OCR provider if required. - AI-provider
data handling, prompt injection/data leakage mitigations, and grounded
output evaluation. - Backups, recovery, monitoring, and operational
support. - Official provider APIs and permission-based wallet
integrations, if feasible.

No production-grade security claim should be made for the demo.

## 13. Testing strategy

### Domain/unit tests

-   Period boundary: Monday and Sunday included; adjacent dates
    excluded.
-   Income, expense, and net balance calculations.
-   Receivables count only unpaid receivable records.
-   Receivables total is independent of dashboard period.
-   Paid settlement cannot create duplicate income.
-   Amount/date/category validation.
-   Highest expense category and insufficient-data behavior.
-   Assistant responses use current records rather than fixed seed
    answers.

### Workflow/acceptance tests

1.  Create income manually and confirm dashboard update.
2.  Create expense manually and confirm totals/chart update.
3.  Edit a record and confirm all dependent views update.
4.  Filter transactions by type, category, and date range.
5.  Create an unpaid receivable and confirm it appears in the
    receivables metric, not income.
6.  Mark a receivable paid and confirm it leaves outstanding receivables
    and does not double-count income.
7.  Select image, edit simulated extraction fields, and verify no record
    exists before confirmation.
8.  Confirm extracted transaction and verify source/verification
    metadata.
9.  Ask each of the four required assistant questions and compare
    answers with calculations.
10. Verify insufficient-data and unsupported-question states.
11. Verify six credit-readiness checklist items and disclaimer.
12. Refresh browser and confirm persistence.
13. Reset demo data, cancel once, then confirm reset and verify seed
    restoration.
14. Check desktop/mobile layout, keyboard focus, labels, and horizontal
    overflow.

## 14. Implementation order and deadline control

1.  Data model, seed data, storage adapter, and calculation utilities.
2.  Dashboard and transaction create/edit/list/filter.
3.  Receivable workflow and settlement guard.
4.  Simulated upload and review/confirm flow.
5.  Insight cards and deterministic assistant.
6.  Credit-readiness checklist only after P0 is stable.
7.  Acceptance checks, responsive polish, reset testing, and
    demonstration preparation.

CSV import is optional only if the core flows are stable. Live wallet
integration, real OCR, and live AI integration must not be attempted at
the expense of a coherent MVP.
