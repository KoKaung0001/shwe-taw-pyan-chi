create table if not exists public.categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('income', 'expense', 'both')),
  primary key (user_id, id)
);

create table if not exists public.counterparties (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null check (kind in ('customer', 'supplier', 'other')),
  primary key (user_id, id)
);

create table if not exists public.transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  currency text not null check (currency = 'MMK'),
  date date not null,
  due_date date,
  occurred_at timestamptz,
  opening_day_disposition text check (opening_day_disposition in ('already_in_opening', 'after_reference')),
  category_id text,
  description text,
  reference text,
  counterparty_id text,
  cash_status text not null check (cash_status in ('settled', 'pending')),
  confirmation_status text not null check (confirmation_status in ('not_applicable', 'unconfirmed', 'confirmed')),
  source text not null check (source in ('manual', 'receipt_image', 'screenshot', 'recurring')),
  ocr_review_status text not null check (ocr_review_status in ('not_applicable', 'pending_review', 'reviewed')),
  payment_occurrence_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  constraint transactions_category_owner_fk foreign key (user_id, category_id) references public.categories(user_id, id) on delete set null (category_id),
  constraint transactions_counterparty_owner_fk foreign key (user_id, counterparty_id) references public.counterparties(user_id, id) on delete set null (counterparty_id)
);

create table if not exists public.receivables (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  amount bigint not null check (amount > 0),
  currency text not null check (currency = 'MMK'),
  date date not null,
  counterparty text not null,
  description text,
  category_id text,
  status text not null check (status in ('unpaid', 'paid')),
  settled_at timestamptz,
  linked_income_transaction_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  constraint receivables_category_owner_fk foreign key (user_id, category_id) references public.categories(user_id, id) on delete set null (category_id)
);

create table if not exists public.balance_adjustments (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  amount bigint not null check (amount <> 0),
  currency text not null check (currency = 'MMK'),
  date date not null,
  occurred_at timestamptz not null,
  description text not null,
  created_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.scheduled_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  category_id text,
  description text,
  counterparty_id text,
  schedule jsonb not null,
  active boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, id),
  constraint scheduled_rules_category_owner_fk foreign key (user_id, category_id) references public.categories(user_id, id) on delete set null (category_id),
  constraint scheduled_rules_counterparty_owner_fk foreign key (user_id, counterparty_id) references public.counterparties(user_id, id) on delete set null (counterparty_id)
);

create table if not exists public.payment_occurrences (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  rule_id text not null,
  original_due_date date not null,
  status text not null check (status in ('scheduled', 'assumed_unconfirmed', 'confirmed_paid', 'explicitly_unpaid')),
  payment_transaction_id text,
  payment_date date,
  payment_amount bigint,
  history jsonb not null default '[]'::jsonb,
  primary key (user_id, id),
  constraint occurrence_rule_owner_fk foreign key (user_id, rule_id) references public.scheduled_rules(user_id, id) on delete cascade
);

create table if not exists public.duplicate_reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  first_transaction_id text not null,
  second_transaction_id text not null,
  fingerprint text not null,
  resolution text not null check (resolution in ('keep_both', 'duplicate_removed')),
  redundant_transaction_id text,
  reviewed_at timestamptz not null,
  primary key (user_id, id)
);

create table if not exists public.readiness_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  available boolean not null,
  primary key (user_id, document_key)
);

create table if not exists public.workspace_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_zone text not null default 'Asia/Rangoon',
  opening_balance jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_imports (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source_email text not null,
  status text not null check (status in ('imported', 'skipped')),
  record_counts jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'categories', 'counterparties', 'transactions', 'receivables', 'balance_adjustments',
    'scheduled_rules', 'payment_occurrences', 'duplicate_reviews', 'readiness_documents',
    'workspace_settings', 'workspace_imports'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'Users manage own ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', 'Users manage own ' || table_name, table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

create index if not exists transactions_owner_date_idx on public.transactions (user_id, date desc);
create index if not exists receivables_owner_status_idx on public.receivables (user_id, status);
create index if not exists occurrences_owner_due_date_idx on public.payment_occurrences (user_id, original_due_date);
