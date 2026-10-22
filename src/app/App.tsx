import { useEffect, useRef } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { FlaskConical, LogOut, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryDestinations, screens, utilityDestinations } from './routes';
import { Placeholder } from '../features/Placeholder';
import { CapturePage } from '../features/CapturePage';
import { AddPage, AddReceivablePage } from '../features/AddPage';
import { DashboardPage } from '../features/DashboardPage';
import { ChatPage } from '../features/AnalysisPages';
import { ReadinessPage } from '../features/ReadinessPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useDemoStore } from '../store/demoStore';
import {
  SchedulesPage,
  SettingsPage,
  TransactionsPage,
} from '../features/FinancialPages';
import { MorePage } from '../features/MorePage';
import { WelcomeExperience } from '../features/WelcomeExperience';
import { setDemoSession, useDemoSession } from '../services/demoAuthSession';

function ScrollMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" fill="none" className={className}>
      <path
        d="M11 9.5h18a3.5 3.5 0 0 1 0 7H14.5a3.5 3.5 0 0 0 0 7H29a3.5 3.5 0 0 1 0 7H11a3.5 3.5 0 0 1 0-7h14.5a3.5 3.5 0 0 0 0-7H11a3.5 3.5 0 0 1 0-7Z"
        stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M8 13V27" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function routeName(pathname: string, t: TFunction) {
  if (pathname === '/') return t('brand');
  if (pathname === '/auth') return 'Log in';
  if (pathname === '/signup') return 'Sign up';
  if (pathname.startsWith('/payments') || pathname === '/schedules' || pathname === '/owed') return t('payments.nav');
  if (pathname.startsWith('/add')) return t('add.nav');
  if (pathname === '/more') return t('more.nav');
  const screen = screens.find((item) => item.path === pathname);
  return screen ? t(`${screen.id}.nav`) : t('notFound');
}

export function App() {
  const { t } = useTranslation();
  const storageNotice = useDemoStore((state) => state.storageNotice);
  const user = useDemoSession();
  const location = useLocation();
  const navigate = useNavigate();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      document.querySelector<HTMLElement>('h1')?.focus();
      previousPath.current = location.pathname;
    }
    document.title = `${routeName(location.pathname, t)} · ${t('brand')}`;
  }, [location.pathname, t]);

  useEffect(() => {
    const process = () => useDemoStore.getState().processDueSchedules();
    if (useDemoStore.persist.hasHydrated()) {
      process();
      return;
    }
    return useDemoStore.persist.onFinishHydration(process);
  }, []);

  if (location.pathname === '/' || location.pathname === '/auth' || location.pathname === '/signup') {
    return <WelcomeExperience onAuthenticated={async (authenticatedUser) => {
      await useDemoStore.getState().activateWorkspace(authenticatedUser.email);
      setDemoSession(authenticatedUser);
    }} />;
  }
  if (!user) return <Navigate to="/" replace />;

  return (
    <>
      <a className="skip-link" href="#main" onClick={(event) => {
        event.preventDefault();
        document.getElementById('main')?.focus();
      }}>{t('skip')}</a>
      {storageNotice ? (
        <div className="storage-notice" role="status">
          <span>{storageNotice}</span>
          <button className="pill-button pill-button-quiet" onClick={() => useDemoStore.getState().dismissStorageNotice()}>
            {t('dismiss')}
          </button>
        </div>
      ) : null}
      <div className="app-frame">
        <aside id="app-navigation" className="app-sidebar">
          <Link to="/dashboard" className="brand-lockup">
            <span className="brand-symbol"><ScrollMark className="size-7" /></span>
            <span className="brand-name">{t('brand')}</span>
          </Link>
          <div className="sidebar-caption">{t('navigation')}</div>
          <nav aria-label={t('navigation')} className="primary-navigation">
            {primaryDestinations.map(({ id, path, icon: Icon }) => (
              <NavLink key={id} to={path} className={({ isActive }) => `navigation-link${isActive ? ' navigation-link-active' : ''}`}>
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(`${id}.nav`)}</span>
              </NavLink>
            ))}
          </nav>
          <Link className="sidebar-caption sidebar-caption-secondary sidebar-more-link" to="/more">{t('more.nav')}</Link>
          <nav aria-label={t('more.nav')} className="primary-navigation">
            {utilityDestinations.map(({ id, path, icon: Icon }) => (
              <NavLink key={id} to={path} className={({ isActive }) => `navigation-link${isActive ? ' navigation-link-active' : ''}`}>
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(`${id}.nav`)}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="app-main-column">
          <header className="topbar">
            <Link to="/dashboard" className="mobile-brand lg:hidden">
              <span className="brand-symbol"><ScrollMark className="size-6" /></span>
              <span>{t('brand')}</span>
            </Link>
            <div className="topbar-actions">
              <span className="demo-badge" title={t('demo')} aria-label={t('demo')}>
                <FlaskConical size={14} aria-hidden="true" />{t('demoMode', { defaultValue: 'Synthetic data' })}
              </span>
              <button className="sign-out-action" type="button" onClick={() => {
                setDemoSession(null);
                navigate('/', { replace: true });
              }}><LogOut size={16} aria-hidden="true" /><span>Sign out</span></button>
              <Link className="record-action" to="/add">
                <Plus size={18} aria-hidden="true" /><span>{t('add.nav')}</span>
              </Link>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="page-content">
            <ErrorBoundary key={location.pathname}>
              <Routes>
                {screens.filter(({ id }) => id !== 'schedules' && id !== 'owed').map(({ id, path }) => (
                  <Route key={id} path={path} element={
                    id === 'dashboard' ? <DashboardPage />
                      : id === 'transactions' ? <TransactionsPage />
                        : id === 'add' ? <AddPage />
                        : id === 'schedules' ? <SchedulesPage />
                          : id === 'capture' ? <CapturePage />
                                : id === 'chat' ? <ChatPage />
                                  : id === 'settings' ? <SettingsPage />
                                    : id === 'readiness' ? <ReadinessPage />
                                      : <Placeholder id={id} />
                  } />
                ))}
                <Route path="/payments" element={<Navigate to="/payments/upcoming" replace />} />
                <Route path="/payments/upcoming" element={<SchedulesPage />} />
                <Route path="/payments/owed" element={<Navigate to="/transactions#receivables" replace />} />
                <Route path="/add/receivable" element={<AddReceivablePage />} />
                <Route path="/schedules" element={<Navigate to="/payments/upcoming" replace />} />
                <Route path="/owed" element={<Navigate to="/payments/owed" replace />} />
                <Route path="/more" element={<MorePage />} />
                <Route path="*" element={<section className="surface-card p-8">
                  <h1 tabIndex={-1} className="text-3xl font-semibold">{t('notFound')}</h1>
                  <p className="my-4 text-muted-foreground">{t('notFoundBody')}</p>
                  <Link className="text-primary underline" to="/dashboard">{t('back')}</Link>
                </section>} />
              </Routes>
            </ErrorBoundary>
          </main>
          <nav className="mobile-bottom-nav lg:hidden" aria-label={t('navigation')}>
            {primaryDestinations.map(({ id, path, icon: Icon }) => (
              <NavLink key={id} to={path} className={({ isActive }) => {
                return `mobile-tab${id === 'add' ? ' mobile-tab-add' : ''}${isActive ? ' mobile-tab-active' : ''}`;
              }}>
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(`${id}.nav`)}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
