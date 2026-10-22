import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileImage, HandCoins, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDemoStore } from '../store/demoStore';
import { clockForTimeZone, systemClock } from '../services/clock';
import { DatePickerField } from '../components/DatePickerField';

export function AddPage() {
  const { t } = useTranslation();
  return <div className="page-stack">
    <header className="page-heading"><div><h1 tabIndex={-1}>{t('add.title', { defaultValue: 'Add a record' })}</h1><p className="text-muted">{t('add.subtitle', { defaultValue: 'Choose how you want to record this activity.' })}</p></div></header>
    <div className="add-choice-grid">
      <Choice to="/transactions#transaction-form" icon={<PenLine size={23} />} title={t('add.manualTitle', { defaultValue: 'Manual entry' })} body={t('add.manualBody', { defaultValue: 'Record income or an expense with its date, category, and details.' })} />
      <Choice to="/capture" icon={<FileImage size={23} />} title={t('add.uploadTitle', { defaultValue: 'Upload receipt or screenshot' })} body={t('add.uploadBody', { defaultValue: 'Review simulated sample extraction and confirm before saving.' })} />
      <Choice to="/add/receivable" icon={<HandCoins size={23} />} title={t('add.receivableTitle', { defaultValue: 'Record a receivable' })} body={t('add.receivableBody', { defaultValue: 'Track money a client or customer owes you separately from received income.' })} />
    </div>
  </div>;
}

function Choice({ to, icon, title, body }: { to: string; icon: ReactNode; title: string; body: string }) {
  return <Link to={to} className="add-choice-card"><span className="add-choice-icon">{icon}</span><span className="add-choice-copy"><strong>{title}</strong><small>{body}</small></span><ArrowRight size={19} aria-hidden="true" /></Link>;
}

export function AddReceivablePage() {
  const { t } = useTranslation();
  const create = useDemoStore((state) => state.createReceivable);
  const data = useDemoStore((state) => state.data);
  const timeZone = useDemoStore((state) => state.timeZone);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(clockForTimeZone(timeZone).today());
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSaved(false);
    if (!/^\d+$/.test(amount) || Number(amount) <= 0 || Number(amount) > 1_000_000_000_000) { setError(t('form.amountError')); return; }
    const now = systemClock.now().toISOString();
    try {
      create({ id: globalThis.crypto?.randomUUID?.() ?? `recv-${Date.now()}`, amount: Number(amount), currency: 'MMK', date, counterparty: counterparty.trim(), description: description.trim() || undefined, categoryId: categoryId || null, status: 'unpaid', createdAt: now, updatedAt: now });
      setAmount(''); setCounterparty(''); setDescription(''); setCategoryId(''); setSaved(true);
    } catch { setError(t('add.receivableError', { defaultValue: 'Check the required fields and try again.' })); }
  }
  return <div className="page-stack">
    <header className="page-heading"><div><h1 tabIndex={-1}>{t('add.receivableTitle', { defaultValue: 'Record a receivable' })}</h1><p className="text-muted">{t('add.receivableExplain', { defaultValue: 'This amount is tracked as unpaid and will not count as received income.' })}</p></div><Link className="text-link" to="/add">{t('form.cancel')}</Link></header>
    <section className="surface-card transaction-form-panel"><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium">{t('transaction.amount')}<input className="field-control" type="number" min="1" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <DatePickerField id="receivable-date" label={t('transaction.date')} fieldClassName="grid gap-2 text-sm font-medium" inputClassName="field-control" required value={date} onChange={setDate} />
      <label className="grid gap-2 text-sm font-medium">{t('add.payer', { defaultValue: 'Client or payer' })}<input className="field-control" required maxLength={120} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></label>
      <label className="grid gap-2 text-sm font-medium">{t('transaction.category')}<select className="app-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">{t('transaction.uncategorized')}</option>{data.categories.filter((item) => item.type !== 'expense').map((item) => <option key={item.id} value={item.id}>{t(`category.${item.id}`)}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t('transaction.description')}<input className="field-control" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {error ? <p role="alert" className="form-error sm:col-span-2">{error}</p> : null}{saved ? <p role="status" className="success-message sm:col-span-2">{t('add.receivableSaved', { defaultValue: 'Receivable saved as unpaid.' })}</p> : null}
      <div className="flex gap-3 sm:col-span-2"><button className="action-button" type="submit">{t('add.saveReceivable', { defaultValue: 'Save receivable' })}</button><Link className="secondary-action" to="/transactions">{t('transactions.open')}</Link></div>
    </form></section>
  </div>;
}
