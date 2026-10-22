import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
} from 'lucide-react';
import { CategorySuggestion } from '../components/CategorySuggestion';
import { DatePickerField } from '../components/DatePickerField';
import type { Transaction } from '../domain/types';
import { clockForTimeZone, systemClock } from '../services/clock';
import { useDemoStore } from '../store/demoStore';

const money = (amount: number | null) =>
  amount === null
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
        amount,
      );
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function SettingsPage() {
  const { t } = useTranslation();
  const timeZone = useDemoStore((state) => state.timeZone);
  const setTimeZone = useDemoStore((state) => state.setTimeZone);
  const intlWithZones = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };
  const availableTimeZones = [...new Set([
    timeZone,
    ...(intlWithZones.supportedValuesOf?.('timeZone') ?? []),
  ])];
  return (
    <div className="page-stack settings-page-stack">
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('settings.title')}</h1>
      </header>
      <section className="surface-card settings-panel">
        <label className="grid max-w-xl gap-2 text-sm font-medium">
          {t('settings.timeZone')}
          <select className="app-select" value={timeZone} onChange={(event) => {
            setTimeZone(event.target.value);
            useDemoStore.getState().processDueSchedules();
          }}>
            {availableTimeZones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
      </section>
      <ResetDemoPanel />
    </div>
  );
}
function ResetDemoPanel() {
  const { t } = useTranslation();
  const reset = useDemoStore((state) => state.resetDemoData);
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) cancelButtonRef.current?.focus(); }, [confirming]);
  return <section className="surface-card settings-panel reset-panel">
    <h2 className="text-xl font-semibold">{t('settings.resetTitle', { defaultValue: 'Reset demo data' })}</h2>
    <p className="my-3 text-muted">{t('settings.resetHelp', { defaultValue: 'Restore the prototype’s initial synthetic records. This only changes data saved in this browser.' })}</p>
    <button className="danger-button" type="button" onClick={() => { setResetDone(false); setConfirming(true); }}>{t('settings.resetAction', { defaultValue: 'Reset demo data' })}</button>
    {resetDone ? <p className="success-message mt-3" role="status">{t('settings.resetDone', { defaultValue: 'Demo data has been restored.' })}</p> : null}
    {confirming ? <div className="dialog-backdrop"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" aria-describedby="reset-dialog-description">
      <h3 id="reset-dialog-title">{t('settings.resetConfirmTitle', { defaultValue: 'Reset demo data?' })}</h3>
      <p id="reset-dialog-description">{t('settings.resetConfirmBody', { defaultValue: 'Your saved changes in this browser will be replaced with the initial synthetic dataset.' })}</p>
      <div className="dialog-actions"><button ref={cancelButtonRef} className="secondary-action" type="button" onClick={() => setConfirming(false)}>{t('form.cancel')}</button><button className="danger-button" type="button" onClick={() => { reset(); setConfirming(false); setResetDone(true); }}>{t('settings.resetAction', { defaultValue: 'Reset demo data' })}</button></div>
    </section></div> : null}
  </section>;
}

export function SchedulesPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const createSchedule = useDemoStore((state) => state.createScheduleRule);
  const cancelSchedule = useDemoStore((state) => state.cancelScheduleRule);
  const markUnpaid = useDemoStore((state) => state.markOccurrenceUnpaid);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [repeat, setRepeat] = useState<'one_time' | 'monthly'>('one_time');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(today);
  const [dayOfMonth, setDayOfMonth] = useState(
    String(Number(today.slice(-2))),
  );
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const categories = data.categories.filter(
    (category) => category.type === type || category.type === 'both',
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (
      !/^\d+$/.test(amount) ||
      Number(amount) <= 0 ||
      Number(amount) > 1_000_000_000_000
    ) {
      setError(t('form.amountError'));
      return;
    }
    const now = systemClock.now().toISOString();
    try {
      createSchedule({
        id: uid(),
        type,
        amount: Number(amount),
        categoryId: categoryId || null,
        description: description.trim() || undefined,
        counterpartyId: null,
        schedule:
          repeat === 'one_time'
            ? { kind: 'one_time', dueDate }
            : {
                kind: 'monthly',
                startDate: dueDate,
                dayOfMonth: Number(dayOfMonth),
                ...(endDate ? { endDate } : {}),
              },
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      setAmount('');
      setDescription('');
      setCategoryId('');
      setDueDate(today);
      setDayOfMonth(String(Number(today.slice(-2))));
      setEndDate('');
      setShowScheduleForm(false);
    } catch {
      setError(t('schedules.saveError'));
    }
  }
  const rules = data.scheduleRules;
  const rows = rules.reduce<
    Array<{
      rule: (typeof rules)[number];
      occurrence: (typeof data.paymentOccurrences)[number] | null;
    }>
  >((all, rule) => {
    const occurrences = data.paymentOccurrences
      .filter((item) => item.ruleId === rule.id)
      .sort((a, b) => a.originalDueDate.localeCompare(b.originalDueDate));
    all.push(
      ...(occurrences.length
        ? occurrences.map((occurrence) => ({ rule, occurrence }))
        : [{ rule, occurrence: null }]),
    );
    return all;
  }, []);
  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('payments.title')}</h1>
        <nav className="section-tabs" aria-label={t('payments.nav')}>
          <Link className="section-tab section-tab-active" aria-current="page" to="/payments/upcoming">{t('payments.upcoming')}</Link>
          <Link className="section-tab" to="/payments/owed">{t('payments.owed')}</Link>
        </nav>
      </header>
      <div className="section-toolbar">
        <div>
          <h2>{t('schedules.list')}</h2>
        </div>
        <button className="action-button" type="button" aria-expanded={showScheduleForm} aria-controls="schedule-form-panel" onClick={() => setShowScheduleForm(!showScheduleForm)}>
          <Plus size={18} aria-hidden="true" />{t('schedules.add')}
        </button>
      </div>
      <section id="schedule-form-panel" className={`schedule-form-panel surface-card${showScheduleForm ? ' schedule-form-panel-open' : ''}`} hidden={!showScheduleForm}>
        <h2 className="text-xl font-semibold">{t('schedules.add')}</h2>
        <p className="mt-1 text-sm text-muted">{t('schedules.addHelp')}</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">
            {t('schedules.repeat')}
            <select
              className="app-select"
              value={repeat}
              onChange={(event) =>
                setRepeat(event.target.value as 'one_time' | 'monthly')
              }
            >
              <option value="one_time">{t('schedules.oneTime')}</option>
              <option value="monthly">{t('schedules.monthly')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.type')}
            <select
              className="app-select"
              value={type}
              onChange={(event) => {
                setType(event.target.value as 'income' | 'expense');
                setCategoryId('');
              }}
            >
              <option value="expense">{t('transaction.expense')}</option>
              <option value="income">{t('transaction.income')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.amount')}
            <input
              className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <DatePickerField
            id="schedule-due-date"
            label={repeat === 'one_time' ? t('transaction.dueDate') : t('schedules.startDate')}
            fieldClassName="grid gap-2 text-sm font-medium"
            inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
            value={dueDate}
            onChange={setDueDate}
            required
          />
          {repeat === 'monthly' ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                {t('schedules.dayOfMonth')}
                <input
                  aria-label={t('schedules.dayOfMonth')}
                  className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(event) => setDayOfMonth(event.target.value)}
                  required
                />
              </label>
              <DatePickerField
                id="schedule-end-date"
                label={t('schedules.endDate')}
                fieldClassName="grid gap-2 text-sm font-medium"
                inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
                min={dueDate}
                value={endDate}
                onChange={setEndDate}
              />
            </>
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.category')}
            <select
              className="app-select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">{t('transaction.uncategorized')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {t(`category.${category.id}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            {t('transaction.description')}
            <input
              className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-800 sm:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white">
              {t('schedules.save')}
            </button>
          </div>
        </form>
      </section>
      <section className="surface-card schedule-list-panel">
        <h2 className="text-xl font-semibold">{t('schedules.list')}</h2>
        {rows.length ? (
          <ul className="mt-4 divide-y divide-[#e4e9e2]">
            {rows.map(({ rule, occurrence }) => {
              const due =
                occurrence?.originalDueDate ??
                (rule.schedule.kind === 'one_time'
                  ? rule.schedule.dueDate
                  : rule.schedule.startDate);
              const firstScheduledDate = data.paymentOccurrences
                .filter(
                  (item) =>
                    item.ruleId === rule.id && item.status === 'scheduled',
                )
                .map((item) => item.originalDueDate)
                .sort()[0];
              const canCancel =
                rule.active &&
                occurrence?.status === 'scheduled' &&
                (rule.schedule.kind === 'one_time' ||
                  occurrence.originalDueDate === firstScheduledDate);
              return (
                <li
                  key={occurrence?.id ?? rule.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {rule.description ||
                        t(`category.${rule.categoryId ?? 'uncategorized'}`)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {t(`transaction.${rule.type}`)} · {due} ·{' '}
                      {money(rule.amount)} MMK
                    </p>
                    {rule.schedule.kind === 'monthly' ? (
                      <p className="text-sm text-muted">
                        {t('schedules.monthlyDayLabel', {
                          day: rule.schedule.dayOfMonth,
                        })}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm font-medium text-accent">
                      {t(
                        occurrence
                          ? `scheduleStatus.${occurrence.status}`
                          : rule.active
                            ? 'scheduleStatus.scheduled'
                            : 'scheduleStatus.canceled',
                      )}
                    </p>
                    {occurrence && occurrence.status !== 'scheduled' ? (
                      <p className="text-sm text-muted">
                        {t('schedules.paymentDate')}: {occurrence.paymentDate}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {occurrence && occurrence.status !== 'scheduled' ? (
                      <Link
                        className="min-h-11 rounded-lg border px-3 py-2 text-sm font-medium"
                        to={`/transactions?edit=${encodeURIComponent(occurrence.paymentTransactionId)}`}
                      >
                        {t('schedules.correct')}
                      </Link>
                    ) : null}
                    {occurrence &&
                    (occurrence.status === 'assumed_unconfirmed' ||
                      occurrence.status === 'confirmed_paid') ? (
                      <button
                        className="min-h-11 rounded-lg border px-3 text-sm font-medium"
                        onClick={() => {
                          if (window.confirm(t('schedules.confirmUnpaid')))
                            markUnpaid(occurrence.id);
                        }}
                      >
                        {t('schedules.markUnpaid')}
                      </button>
                    ) : null}
                    {canCancel ? (
                      <button
                        className="min-h-11 rounded-lg border px-3 text-sm font-medium text-red-800"
                        onClick={() => {
                          if (window.confirm(t('schedules.confirmCancel')))
                            cancelSchedule(rule.id);
                        }}
                      >
                        {t('schedules.cancel')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-muted">{t('schedules.empty')}</p>
        )}
      </section>
    </>
  );
}

export function TransactionsPage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const save = useDemoStore((state) => state.saveTransaction);
  const settleReceivable = useDemoStore((state) => state.settleReceivable);
  const remove = useDemoStore((state) => state.deleteTransaction);
  const restore = useDemoStore((state) => state.restoreTransaction);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<Transaction | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [formOpen, setFormOpen] = useState(() => window.location.hash.endsWith('#transaction-form'));
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cashStatus, setCashStatus] = useState<'settled' | 'pending'>(
    'settled',
  );
  const [confirmationStatus, setConfirmationStatus] = useState<
    'not_applicable' | 'unconfirmed' | 'confirmed'
  >('not_applicable');
  const categories = data.categories.filter(
    (category) => category.type === type || category.type === 'both',
  );
  useEffect(() => {
    if (location.hash === '#transaction-form') {
      window.requestAnimationFrame(() => document.getElementById('transaction-form')?.scrollIntoView({ block: 'start' }));
    }
    if (location.hash === '#receivables') {
      window.requestAnimationFrame(() => document.getElementById('receivables')?.scrollIntoView({ block: 'start' }));
    }
  }, [location.hash]);
  const filtered = data.transactions
    .filter(
      (item) =>
        (filter === 'all' || item.type === filter) &&
        (categoryFilter === 'all' || item.categoryId === categoryFilter) &&
        (!startDateFilter || item.date >= startDateFilter) &&
        (!endDateFilter || item.date <= endDateFilter) &&
        `${item.description ?? ''} ${item.date} ${item.categoryId ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  function reset() {
    setEditing(null);
    setType('expense');
    setAmount('');
    setDate(today);
    setDueDate('');
    setDescription('');
    setCategoryId('');
    setCashStatus('settled');
    setConfirmationStatus('not_applicable');
    setError('');
    setFormOpen(false);
  }
  const edit = useCallback(
    (item: Transaction) => {
      setFormOpen(true);
      setEditing(item);
      setType(item.type);
      setAmount(String(item.amount));
      setDate(item.date);
      setDueDate(
        item.paymentOccurrenceId
          ? (data.paymentOccurrences.find(
              (occurrence) => occurrence.id === item.paymentOccurrenceId,
            )?.originalDueDate ??
              item.dueDate ??
              '')
          : (item.dueDate ?? ''),
      );
      setDescription(item.description ?? '');
      setCategoryId(item.categoryId ?? '');
      setCashStatus(item.cashStatus);
      setConfirmationStatus(item.confirmationStatus);
      setError('');
      window.requestAnimationFrame(() =>
        document.getElementById('transaction-form')?.scrollIntoView({ block: 'start' }),
      );
    },
    [data.paymentOccurrences],
  );
  useEffect(() => {
    const id = searchParams.get('edit');
    const item = id
      ? data.transactions.find((transaction) => transaction.id === id)
      : undefined;
    if (item) {
      const timeout = window.setTimeout(() => {
        edit(item);
        setSearchParams({}, { replace: true });
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [data.transactions, edit, searchParams, setSearchParams]);
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (
      !/^\d+$/.test(amount) ||
      Number(amount) <= 0 ||
      Number(amount) > 1_000_000_000_000
    ) {
      setError(t('form.amountError'));
      return;
    }
    if (cashStatus === 'settled' && date > today) {
      setError(t('transactions.futureSettled'));
      return;
    }
    if (cashStatus === 'pending' && (!dueDate || dueDate < date)) {
      setError(t('transactions.dueDateError'));
      return;
    }
    const timestamp = systemClock.now().toISOString();
    save({
      id: editing?.id ?? uid(),
      ...(editing?.openingDayDisposition ? { openingDayDisposition: editing.openingDayDisposition } : {}),
      type,
      amount: Number(amount),
      currency: 'MMK',
      date,
      ...(cashStatus === 'pending' || editing?.paymentOccurrenceId
        ? { dueDate: dueDate || editing?.dueDate || date }
        : {}),
      categoryId: categoryId || null,
      description: description.trim() || undefined,
      counterpartyId: editing?.counterpartyId ?? null,
      cashStatus,
      confirmationStatus:
        cashStatus === 'pending'
          ? 'not_applicable'
          : editing?.paymentOccurrenceId &&
              confirmationStatus === 'not_applicable'
            ? 'unconfirmed'
            : confirmationStatus,
      source: editing?.source ?? 'manual',
      ocrReviewStatus: editing?.ocrReviewStatus ?? 'not_applicable',
      ...(editing?.paymentOccurrenceId
        ? { paymentOccurrenceId: editing.paymentOccurrenceId }
        : {}),
      createdAt: editing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    reset();
  }
  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('transactions.title')}</h1>
      </header>
      <div className="activity-actions">
        <button className="action-button" type="button" aria-expanded={formOpen} aria-controls="transaction-form" onClick={() => setFormOpen(!formOpen)}>
          <Plus size={18} aria-hidden="true" />{t('transactions.add')}
        </button>
      </div>
      <section
        id="transaction-form"
        hidden={!formOpen}
        className="surface-card transaction-form-panel"
      >
        <h2 className="text-xl font-semibold">
          {editing ? t('transactions.edit') : t('transactions.add')}
        </h2>
        {editing?.paymentOccurrenceId ? <p className="linked-edit-help">{t('transactions.linkedEditHelp')}</p> : null}
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.type')}
            <select
              className="app-select"
              value={type}
              onChange={(e) => {
                const nextType = e.target.value as 'income' | 'expense';
                setType(nextType);
                if (nextType === 'income') { setCashStatus('settled'); setDueDate(''); }
                setCategoryId('');
              }}
            >
              <option value="expense">{t('transaction.expense')}</option>
              <option value="income">{t('transaction.income')}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.amount')}
            <input
              className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <DatePickerField
            id="transaction-date"
            label={t('transaction.date')}
            fieldClassName="grid gap-2 text-sm font-medium"
            inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
            value={date}
            onChange={setDate}
            required
          />
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.status')}
            <select
              className="app-select"
              value={cashStatus}
              onChange={(e) =>
                setCashStatus(e.target.value as 'settled' | 'pending')
              }
            >
              <option value="settled">{t('transaction.settled')}</option>
              {type === 'expense' ? <option value="pending">{t('transaction.pending')}</option> : null}
            </select>
          </label>
          {editing?.paymentOccurrenceId && cashStatus === 'settled' ? (
            <label className="grid gap-2 text-sm font-medium">
              {t('transaction.confirmation')}
              <select
                className="app-select"
                value={
                  confirmationStatus === 'not_applicable'
                    ? 'unconfirmed'
                    : confirmationStatus
                }
                onChange={(e) =>
                  setConfirmationStatus(
                    e.target.value as 'unconfirmed' | 'confirmed',
                  )
                }
              >
                <option value="unconfirmed">
                  {t('transaction.unconfirmed')}
                </option>
                <option value="confirmed">{t('transaction.confirmed')}</option>
              </select>
            </label>
          ) : null}
          {cashStatus === 'pending' ? (
            <DatePickerField
              id="transaction-due-date"
              label={t('transaction.dueDate')}
              fieldClassName="grid gap-2 text-sm font-medium"
              inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              min={date}
              value={dueDate}
              onChange={setDueDate}
              required
            />
          ) : null}
          <label className="grid gap-2 text-sm font-medium">
            {t('transaction.category')}
            <select
              className="app-select"
              value={categoryId}
              required
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t('transaction.uncategorized')}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(`category.${item.id}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <CategorySuggestion
              description={description}
              type={type}
              categories={categories}
              selectedCategoryId={categoryId}
              onApply={setCategoryId}
            />
          </div>
          <label className="grid gap-2 text-sm font-medium sm:col-span-2">
            {t('transaction.description')}
            <input
              className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-800 sm:col-span-2">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3 sm:col-span-2">
            <button
              className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-50"
            >
              {editing
                ? t('transactions.saveCorrection')
                : t('transactions.save')}
            </button>
            {editing ? (
              <button
                type="button"
                className="min-h-12 rounded-xl border px-4"
                onClick={reset}
              >
                {t('form.cancel')}
              </button>
            ) : null}
          </div>
        </form>
      </section>
      <section className="surface-card activity-list-panel transactions-records-panel">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="grid flex-1 gap-1 text-sm font-medium">
            {t('transactions.search')}
            <input
              className="filter-control"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            {t('transaction.type')}
            <select
              className="app-select app-select--sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{t('transactions.all')}</option>
              <option value="income">{t('transaction.income')}</option>
              <option value="expense">{t('transaction.expense')}</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">{t('transaction.category')}<select className="app-select app-select--sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">{t('transactions.all')}</option>{data.categories.map((category) => <option key={category.id} value={category.id}>{t(`category.${category.id}`)}</option>)}</select></label>
          <DatePickerField id="transaction-filter-start-date" label={t('transactions.fromDate', { defaultValue: 'From date' })} fieldClassName="filter-field grid gap-1 text-sm font-medium" inputClassName="filter-control" value={startDateFilter} onChange={setStartDateFilter} />
          <DatePickerField id="transaction-filter-end-date" label={t('transactions.toDate', { defaultValue: 'To date' })} fieldClassName="filter-field grid gap-1 text-sm font-medium" inputClassName="filter-control" value={endDateFilter} onChange={setEndDateFilter} />
        </div>
        {undo ? (
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#edf3ec] p-4"
            role="status"
          >
            <span>{t('transactions.deleted')}</span>
            <button
              className="font-semibold underline"
              onClick={() => {
                restore(undo);
                setUndo(null);
              }}
            >
              {t('transactions.undo')}
            </button>
          </div>
        ) : null}
        {filtered.length ? (
          <ul className="transaction-record-list mt-4 divide-y divide-[#e4e9e2]" tabIndex={0} aria-label={t('transactions.title')}>
            {filtered.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {item.description ||
                      t(`category.${item.categoryId ?? 'uncategorized'}`)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {item.date} · {t(`transaction.${item.type}`)} ·{' '}
                    {t(`transaction.${item.cashStatus}`)}
                    {' '}Â· {t(`source.${item.source}`)}
                    {item.ocrReviewStatus === 'reviewed' ? ` Â· ${t('capture.reviewed', { defaultValue: 'Reviewed' })}` : ''}
                    {item.dueDate
                      ? ` · ${t('transaction.dueDate')}: ${item.dueDate}`
                      : ''}
                  </p>
                  <p className="text-sm text-muted">{money(item.amount)} MMK</p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="min-h-11 rounded-lg border px-3 text-sm font-medium"
                    onClick={() => edit(item)}
                  >
                    {t('form.edit')}
                  </button>
                  <button
                    className="min-h-11 rounded-lg border px-3 text-sm font-medium text-red-800"
                    onClick={() => {
                      if (window.confirm(t('transactions.confirmDelete'))) {
                        try {
                          setUndo(remove(item.id));
                        } catch {
                          setError(t('transactions.linkedDeleteError'));
                        }
                      }
                    }}
                  >
                    {t('form.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-muted">{t('transactions.empty')}</p>
        )}
      </section>
      <ReceivablesPanel items={data.receivables} onSettle={settleReceivable} />
    </>
  );
}

function ReceivablesPanel({ items, onSettle }: { items: import('../domain/types').Receivable[]; onSettle: (id: string) => void }) {
  const { t } = useTranslation();
  return <section id="receivables" className="surface-card activity-list-panel receivables-panel">
    <div className="section-heading-row"><div><h2>{t('dashboard.receivables', { defaultValue: 'Receivables' })}</h2><p className="text-muted">{t('transactions.receivablesHelp', { defaultValue: 'Unpaid amounts owed to you. Marking one paid records income once.' })}</p></div><Link className="text-link" to="/add/receivable">{t('add.receivableTitle', { defaultValue: 'Record a receivable' })}</Link></div>
    {items.length ? <ul className="mt-4 divide-y divide-[#e4e9e2]">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold">{item.counterparty}</p><p className="text-sm text-muted">{item.description || item.date} · {t(`receivable.${item.status}`, { defaultValue: item.status === 'paid' ? 'Paid' : 'Unpaid' })}{item.settledAt ? ` · Settled ${item.settledAt.slice(0, 10)}` : ''}</p></div><div className="flex items-center gap-3"><strong>{money(item.amount)} MMK</strong>{item.status === 'unpaid' ? <button className="secondary-action" type="button" onClick={() => onSettle(item.id)}>{t('receivable.markPaid', { defaultValue: 'Mark paid' })}</button> : null}</div></li>)}</ul> : <p className="mt-4 text-muted">{t('receivable.empty', { defaultValue: 'No receivables recorded yet.' })}</p>}
  </section>;
}
