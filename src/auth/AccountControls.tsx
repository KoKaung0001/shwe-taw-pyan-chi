import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { AnimatedDisclosure } from '../components/Motion';
import { useTranslation } from 'react-i18next';

export function AccountControls() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!auth?.user) return null;
  return (
    <div className="account-controls">
      <Link
        to="/profile"
        className="account-profile-link"
        title={auth.user.email}
      >
        <UserRound size={18} aria-hidden="true" />
        <span>
          {auth.user.name}
          <small>
            {auth.sync === 'saving'
              ? t('account.saving')
              : auth.sync === 'error'
                ? t('account.syncNeedsAttention')
                : t('account.saved')}
          </small>
        </span>
      </Link>
      <button
        type="button"
        className="account-sign-out"
        aria-label={t('account.signOut')}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void auth
            .signOut()
            .then(() => navigate('/'))
            .catch((failure) =>
              setError(
                failure instanceof Error
                  ? failure.message
                  : t('account.couldNotSignOut'),
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <LogOut size={18} aria-hidden="true" />
      </button>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function AccountNotices() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (!auth?.user) return null;
  return (
    <>
      {auth.canImport ? (
        <div className="account-import-notice">
          <span>{t('account.previousWorkspace')}</span>
          <button type="button" onClick={auth.importLocalRecords}>
            {t('account.import')}
          </button>
        </div>
      ) : null}
      {auth.sync === 'error' ? (
        <div className="account-sync-notice" role="status">
          <span>
            {auth.error ||
              t('account.syncError')}
          </span>
          <button
            type="button"
            onClick={() => void auth.retrySync().catch(() => undefined)}
          >
            {t('account.retry')}
          </button>
        </div>
      ) : null}
    </>
  );
}

export function AccountSettings() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!auth?.user) return null;
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (
      !auth ||
      busy ||
      !window.confirm(
        t('account.deleteConfirm'),
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await auth.deleteAccount(password);
      setPassword('');
      navigate('/', { replace: true });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t('account.couldNotDelete'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface-card account-settings">
      <h2>{t('account.yourAccount')}</h2>
      <p className="account-settings-name">{auth.user.name}</p>
      <p>{auth.user.email}</p>
      <p className="account-storage-help">
        {t('account.storageHelp')}
      </p>
      <AnimatedDisclosure title={t('account.deleteAccount')}>
        <form className="account-delete-form" onSubmit={remove}>
          <p>
            {t('account.deleteWarning')}
          </p>
          <label>
            {t('account.currentPassword')}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              maxLength={128}
              required
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}>
            {busy ? t('account.deleting') : t('account.deleteMyAccount')}
          </button>
        </form>
      </AnimatedDisclosure>
    </section>
  );
}
