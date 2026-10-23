import { useState, type FormEvent } from 'react';
import { UserRound, Mail, ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';

export function ProfilePage() {
  const auth = useAuth();
  if (!auth?.user) return null;
  return <ProfileForm key={auth.user.id} />;
}

function ProfileForm() {
  const { t } = useTranslation();
  const auth = useAuth()!;
  const [name, setName] = useState(auth.user!.name);
  const [email, setEmail] = useState(auth.user!.email);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const emailChanged = email.trim().toLowerCase() !== auth.user!.email;
  const changed = name.trim() !== auth.user!.name || emailChanged;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || !changed) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await auth.updateProfile({
        name: name.trim(),
        email: email.trim(),
        currentPassword: emailChanged ? password : undefined,
      });
      setName(name.trim());
      setEmail(email.trim().toLowerCase());
      setPassword('');
      setSaved(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t('profileForm.saveError'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack profile-page">
      <header className="page-heading">
        <Link className="profile-back" to="/more">
          <ArrowLeft size={17} aria-hidden="true" /> {t('profileForm.back')}
        </Link>
        <h1 tabIndex={-1}>{t('profileForm.title')}</h1>
        <p>{t('profileForm.description')}</p>
      </header>
      <section className="surface-card profile-card">
        <div className="profile-summary">
          <span className="profile-avatar">
            <UserRound size={28} aria-hidden="true" />
          </span>
          <div>
            <h2>{auth.user!.name}</h2>
            <p>{auth.user!.email}</p>
          </div>
        </div>
        <form
          className="profile-form"
          onSubmit={save}
          onChange={() => setSaved(false)}
        >
          <label htmlFor="profile-name">
            <span>
              <UserRound size={17} aria-hidden="true" /> {t('profileForm.fullName')}
            </span>
            <input
              id="profile-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
              disabled={busy}
            />
          </label>
          <label htmlFor="profile-email">
            <span>
              <Mail size={17} aria-hidden="true" /> {t('profileForm.email')}
            </span>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              required
              disabled={busy}
            />
          </label>
          {emailChanged && (
            <label htmlFor="profile-password">
              <span>{t('profileForm.currentPassword')}</span>
              <input
                id="profile-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
                disabled={busy}
                aria-describedby="profile-email-help"
              />
              <small id="profile-email-help">
                {t('profileForm.emailHelp')}
              </small>
            </label>
          )}
          {error && (
            <p className="profile-error" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="profile-saved" role="status">
              <Check size={17} aria-hidden="true" /> {t('profileForm.saved')}
            </p>
          )}
          <div className="profile-form-actions">
            <button
              className="action-button"
              type="submit"
              disabled={busy || !changed}
            >
              {busy ? t('profileForm.saving') : t('profileForm.save')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
