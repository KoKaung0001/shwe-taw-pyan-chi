import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CategorySuggestion } from '../components/CategorySuggestion';
import { DatePickerField } from '../components/DatePickerField';
import type { Transaction } from '../domain/types';
import { clockForTimeZone, systemClock } from '../services/clock';
import { useDemoStore } from '../store/demoStore';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CapturePage() {
  const { t } = useTranslation();
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const today = clockForTimeZone(timeZone).today();
  const save = useDemoStore((state) => state.saveTransaction);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const previewUrlRef = useRef<string | null>(null);
  const [extraction, setExtraction] = useState<'sample' | 'manual' | null>(
    null,
  );
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [cashStatus, setCashStatus] = useState<'settled' | 'pending'>(
    'settled',
  );
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  const categories = data.categories.filter(
    (category) => category.type === type || category.type === 'both',
  );

  function selectFile(candidate: File | undefined) {
    setError('');
    setSaved(false);
    setExtraction(null);
    setReviewed(false);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl('');
    setFile(null);
    if (!candidate) return;
    if (!SUPPORTED_IMAGE_TYPES.includes(candidate.type)) {
      setError(t('capture.fileTypeError'));
      return;
    }
    if (candidate.size === 0) {
      setError(t('capture.emptyFileError'));
      return;
    }
    if (candidate.size > MAX_IMAGE_BYTES) {
      setError(t('capture.fileSizeError'));
      return;
    }
    const url = URL.createObjectURL(candidate);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(candidate);
  }

  function useSampleExtraction() {
    setExtraction('sample');
    setType('expense');
    setAmount('12500');
    setDate(today);
    setCashStatus('settled');
    setDueDate('');
    setCategoryId('');
    setDescription(t('capture.sampleDescription'));
    setReviewed(false);
    setError('');
    setSaved(false);
  }

  function enterManually() {
    setExtraction('manual');
    setType('expense');
    setAmount('');
    setDate(today);
    setCashStatus('settled');
    setDueDate('');
    setCategoryId('');
    setDescription('');
    setReviewed(false);
    setError('');
    setSaved(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (!extraction) {
      setError(t('capture.chooseReviewMode'));
      return;
    }
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
    if (!reviewed) {
      setError(t('capture.reviewRequired'));
      return;
    }

    const now = systemClock.now().toISOString();
    const transaction: Transaction = {
      id: newId(),
      type,
      amount: Number(amount),
      currency: 'MMK',
      date,
      ...(cashStatus === 'pending' ? { dueDate } : {}),
      categoryId: categoryId || null,
      description: description.trim() || undefined,
      reference: reference.trim() || undefined,
      counterpartyId: null,
      cashStatus,
      confirmationStatus: 'not_applicable',
      source: file ? 'receipt_image' : 'manual',
      ocrReviewStatus: file ? 'reviewed' : 'not_applicable',
      createdAt: now,
      updatedAt: now,
    };
    save(transaction);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl('');
    setFile(null);
    setExtraction(null);
    setAmount('');
    setDate(today);
    setCashStatus('settled');
    setDueDate('');
    setCategoryId('');
    setDescription('');
    setReference('');
    setReviewed(false);
    setSaved(true);
  }

  return (
    <>
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('capture.title')}</h1>
      </header>


      <section className="rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">{t('capture.uploadTitle')}</h2>
        <p className="mt-2 text-sm text-muted">{t('capture.privacy')}</p>
        <label className="mt-5 grid gap-2 text-sm font-medium">
          {t('capture.imageLabel')}
          <input
            aria-label={t('capture.imageLabel')}
            className="min-h-12 rounded-xl border border-[#bccbc0] p-3"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => selectFile(event.currentTarget.files?.[0])}
          />
        </label>
        {file ? (
          <div className="mt-4 rounded-2xl bg-canvas p-4">
            <p className="font-medium">{file.name}</p>
            <p className="mt-1 text-sm text-muted">
              {(file.size / 1024).toFixed(1)} KB · {file.type}
            </p>
            {previewUrl ? (
              <img
                className="mt-4 max-h-80 max-w-full rounded-xl object-contain"
                src={previewUrl}
                alt={t('capture.previewAlt')}
              />
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!file}
            className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-50"
            onClick={useSampleExtraction}
          >
            {t('capture.simulate')}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[#bccbc0] px-4 font-semibold"
            onClick={enterManually}
          >
            {t('capture.manual')}
          </button>
        </div>
        {extraction ? (
          <p className="mt-4 rounded-xl bg-[#edf3ec] p-4 text-sm" role="status">
            {t(
              extraction === 'sample'
                ? 'capture.sampleNotice'
                : 'capture.manualNotice',
            )}
          </p>
        ) : null}
      </section>

      {extraction ? (
        <section className="mt-6 rounded-3xl border border-[#dce4dc] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold">{t('capture.reviewTitle')}</h2>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-medium">
              {t('transaction.type')}
              <select
                className="app-select"
                value={type}
                onChange={(event) => {
                  const nextType = event.target.value as 'income' | 'expense';
                  setType(nextType);
                  if (nextType === 'income') { setCashStatus('settled'); setDueDate(''); }
                  setCategoryId('');
                  setReviewed(false);
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
                onChange={(event) => {
                  setAmount(event.target.value);
                  setReviewed(false);
                }}
                required
              />
            </label>
            <DatePickerField
              id="capture-date"
              label={t('transaction.date')}
              fieldClassName="grid gap-2 text-sm font-medium"
              inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
              value={date}
              onChange={(value) => { setDate(value); setReviewed(false); }}
              required
            />
            <label className="grid gap-2 text-sm font-medium">
              {t('transaction.status')}
              <select
                className="app-select"
                value={cashStatus}
                onChange={(event) => {
                  setCashStatus(event.target.value as 'settled' | 'pending');
                  setReviewed(false);
                }}
              >
                <option value="settled">{t('transaction.settled')}</option>
                {type === 'expense' ? <option value="pending">{t('transaction.pending')}</option> : null}
              </select>
            </label>
            {cashStatus === 'pending' ? (
              <DatePickerField
                id="capture-due-date"
                label={t('transaction.dueDate')}
                fieldClassName="grid gap-2 text-sm font-medium"
                inputClassName="min-h-12 rounded-xl border border-[#bccbc0] px-4"
                min={date}
                value={dueDate}
                onChange={(value) => { setDueDate(value); setReviewed(false); }}
                required
              />
            ) : null}
            <label className="grid gap-2 text-sm font-medium">
              {t('transaction.category')}
              <select
                className="app-select"
                value={categoryId}
                required
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setReviewed(false);
                }}
              >
                <option value="">{t('transaction.uncategorized')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {t(`category.${category.id}`)}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <CategorySuggestion
                description={description}
                type={type}
                categories={categories}
                selectedCategoryId={categoryId}
                onApply={(suggestion) => {
                  setCategoryId(suggestion);
                  setReviewed(false);
                }}
              />
            </div>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              {t('transaction.description')}
              <input
                className="min-h-12 rounded-xl border border-[#bccbc0] px-4"
                maxLength={200}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  setReviewed(false);
                }}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium sm:col-span-2">
              {t('capture.reference', { defaultValue: 'Transaction reference (optional)' })}
              <input className="min-h-12 rounded-xl border border-[#bccbc0] px-4" maxLength={120} value={reference} onChange={(event) => { setReference(event.target.value); setReviewed(false); }} />
            </label>
            <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.currentTarget.checked)}
              />
              {t('capture.reviewConfirm', { defaultValue: 'I reviewed and confirm these transaction fields.' })}
            </label>
            {error ? (
              <p className="text-sm text-red-800 sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sm:col-span-2">
              <button
                className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-white disabled:opacity-50"
              >
                {t('capture.saveReviewed')}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {saved ? (
        <p
          className="mt-4 rounded-xl bg-[#edf3ec] p-4 text-sm text-accent"
          role="status"
        >
          {t('capture.saved')}
        </p>
      ) : null}
      {error && !extraction ? (
        <p className="mt-4 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
