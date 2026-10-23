import { useEffect, useRef } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { TFunction } from 'i18next';
import { Check, LogOut, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryDestinations, screens, utilityDestinations } from './routes';
import { Placeholder } from '../features/Placeholder';
import { CapturePage } from '../features/CapturePage';
import { AddPage, AddReceivablePage } from '../features/AddPage';
import { DashboardPage } from '../features/DashboardPage';
import type { ReportingPeriod } from '../domain/reporting';
import type { FinancialChartView } from '../features/FinancialChart';
import { ChatPage } from '../features/AnalysisPages';
import { ReadinessPage } from '../features/ReadinessPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BrandWordmark } from '../components/BrandWordmark';
import { useDemoStore } from '../store/demoStore';
import {
  SchedulesPage,
  SettingsPage,
  TransactionsPage,
} from '../features/FinancialPages';
import { MorePage } from '../features/MorePage';
import { WelcomeExperience } from '../features/WelcomeExperience';
import { setAuthUser, startAuthSession, useAuthSession } from '../services/supabaseAuthSession';
import { signOut } from '../services/supabaseAuth';
import { emptyAppData } from '../domain/types';
import { getImportStatus, getLocalImportCandidate, importLocalWorkspace, loadWorkspace, saveWorkspace, skipLocalWorkspaceImport } from '../services/workspaceRepository';
import { useState } from 'react';

const DEMO_PREVIEW_USER = { id: 'local-demo-preview', name: 'Demo Preview', email: 'demo-preview@local.invalid' };

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
  const { user: accountUser, loading: authLoading, error: authError } = useAuthSession();
  const [isDemoPreview, setIsDemoPreview] = useState(false);
  const user = isDemoPreview ? DEMO_PREVIEW_USER : accountUser;
  const location = useLocation();
  const navigate = useNavigate();
  const previousPath = useRef(location.pathname);
  const [workspaceLoad, setWorkspaceLoad] = useState<{ userId: string | null; ready: boolean; error: string | null }>({ userId: null, ready: false, error: null });
  const workspaceReady = Boolean(user && (isDemoPreview || (workspaceLoad.userId === user.id && workspaceLoad.ready)));
  const workspaceError = user && workspaceLoad.userId === user.id ? workspaceLoad.error : null;
  const [importCandidate, setImportCandidate] = useState<Awaited<ReturnType<typeof getLocalImportCandidate>>>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [dashboardPeriod, setDashboardPeriod] = useState<ReportingPeriod>('this_week');
  const [dashboardChartView, setDashboardChartView] = useState<FinancialChartView>('cash_flow');

  useEffect(() => startAuthSession(), []);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      document.querySelector<HTMLElement>('h1')?.focus();
      previousPath.current = location.pathname;
    }
    document.title = location.pathname === '/'
      ? t('brand')
      : `${routeName(location.pathname, t)} · ${t('brand')}`;
  }, [location.pathname, t]);

  useEffect(() => {
    if (!user) {
      useDemoStore.setState({ data: emptyAppData(), storageNotice: null });
      return;
    }
    if (user.id === DEMO_PREVIEW_USER.id) {
      setWorkspaceLoad({ userId: user.id, ready: true, error: null });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const workspace = await loadWorkspace(user.id);
        if (cancelled) return;
        useDemoStore.setState(workspace);
        const status = await getImportStatus(user.id);
        if (cancelled) return;
        const candidate = status ? null : await getLocalImportCandidate(user.email);
        if (cancelled) return;
        useDemoStore.getState().processDueSchedules();
        if (!candidate) {
          const current = useDemoStore.getState();
          await saveWorkspace(user.id, { data: current.data, storageNotice: null, timeZone: current.timeZone });
          if (cancelled) return;
        }
        setImportCandidate(candidate);
        setWorkspaceLoad({ userId: user.id, ready: true, error: null });
      } catch (error) {
        if (!cancelled) setWorkspaceLoad({ userId: user.id, ready: false, error: error instanceof Error ? error.message : 'Could not load your account records.' });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || isDemoPreview || !workspaceReady || importCandidate) return;
    let queue = Promise.resolve();
    let active = true;
    const unsubscribe = useDemoStore.subscribe((state, previous) => {
      if (!active || (state.data === previous.data && state.timeZone === previous.timeZone)) return;
      const snapshot = { data: state.data, timeZone: state.timeZone, storageNotice: null };
      queue = queue.then(() => active ? saveWorkspace(user.id, snapshot) : undefined).catch((error: unknown) => {
        if (active) useDemoStore.setState({ storageNotice: error instanceof Error ? `Could not sync your records: ${error.message}` : 'Could not sync your records.' });
      });
    });
    return () => { active = false; unsubscribe(); };
  }, [user, isDemoPreview, workspaceReady, importCandidate]);

  async function confirmImport() {
    if (!user || !importCandidate || importBusy) return;
    setImportBusy(true);
    try {
      const workspace = await importLocalWorkspace(user.id, user.email, importCandidate.workspace);
      useDemoStore.setState(workspace);
      useDemoStore.getState().processDueSchedules();
      const current = useDemoStore.getState();
      await saveWorkspace(user.id, { data: current.data, storageNotice: null, timeZone: current.timeZone });
      setImportCandidate(null);
    } catch (error) {
      setWorkspaceLoad({ userId: user.id, ready: true, error: error instanceof Error ? error.message : 'Could not import the local workspace. You can retry.' });
    } finally { setImportBusy(false); }
  }

  async function skipImport() {
    if (!user || importBusy) return;
    setImportBusy(true);
    try {
      await skipLocalWorkspaceImport(user.id, user.email);
      setImportCandidate(null);
    } catch (error) {
      setWorkspaceLoad({ userId: user.id, ready: true, error: error instanceof Error ? error.message : 'Could not save your import choice.' });
    } finally { setImportBusy(false); }
  }

  async function signOutAndLeave() {
    if (!user) return;
    if (isDemoPreview) {
      useDemoStore.setState({ data: emptyAppData(), storageNotice: null });
      setWorkspaceLoad({ userId: null, ready: false, error: null });
      setIsDemoPreview(false);
      navigate('/', { replace: true });
      return;
    }
    try {
      const current = useDemoStore.getState();
      await saveWorkspace(user.id, { data: current.data, storageNotice: null, timeZone: current.timeZone });
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      setWorkspaceLoad({ userId: user.id, ready: true, error: error instanceof Error ? error.message : 'Could not sign out. Your latest changes may not have synced.' });
    }
  }

  if (location.pathname === '/' || location.pathname === '/auth' || location.pathname === '/signup') {
    return <WelcomeExperience onAuthenticated={async (authenticatedUser) => {
      setAuthUser(authenticatedUser);
    }} onExploreDemo={import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true' ? async () => {
      const { createSeedData } = await import('../domain/seedData');
      useDemoStore.setState({ data: createSeedData(), storageNotice: null, timeZone: 'Asia/Rangoon' });
      setWorkspaceLoad({ userId: DEMO_PREVIEW_USER.id, ready: true, error: null });
      setImportCandidate(null);
      setDashboardPeriod('this_week');
      setDashboardChartView('cash_flow');
      setIsDemoPreview(true);
      navigate('/dashboard', { replace: true });
    } : undefined} />;
  }
  if (authLoading && !isDemoPreview) return <main className="min-h-screen grid place-items-center p-8"><p role="status">Connecting to your account…</p></main>;
  if (!user) return <Navigate to="/" replace />;
  if (!workspaceReady) return <main className="min-h-screen grid place-items-center p-8"><p role="status">{workspaceError ?? authError ?? 'Loading your records…'}</p></main>;

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
      {workspaceError && !importCandidate ? <div className="storage-notice" role="alert"><span>{workspaceError}</span></div> : null}
      <div className="app-frame">
        <aside id="app-navigation" className="app-sidebar">
          <Link to="/dashboard" className="brand-lockup">
            <span className="brand-symbol" aria-hidden="true" />
            <BrandWordmark className="brand-name" />
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
            <Link to="/dashboard" className="mobile-brand lg:hidden" aria-label={t('brand')}>
              <span className="brand-symbol" aria-hidden="true" />
              <BrandWordmark className="mobile-brand-name" />
            </Link>
            <div className="topbar-actions">
              {isDemoPreview ? <span className="demo-preview-label">Demo preview · sample data</span> : null}
              <button className="sign-out-action" type="button" onClick={() => void signOutAndLeave()}><LogOut size={16} aria-hidden="true" /><span>{isDemoPreview ? 'Exit demo' : 'Sign out'}</span></button>
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
                    id === 'dashboard' ? <DashboardPage period={dashboardPeriod} onPeriodChange={setDashboardPeriod} chartView={dashboardChartView} onChartViewChange={setDashboardChartView} />
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
      {importCandidate ? <div className="dialog-backdrop"><section className="confirm-dialog workspace-import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby="import-description">
        <div className="welcome-auth-check"><Check size={17} aria-hidden="true" /></div>
        <h2 id="import-title">Import this browser’s saved records?</h2>
        <p id="import-description">We found a local workspace for {user.email}. Review the counts, then import it once. This includes sample records and does not include the older shared workspace.</p>
        <ul className="workspace-import-counts">{Object.entries(importCandidate.counts).filter(([, count]) => count > 0).map(([label, count]) => <li key={label}><span>{label.replaceAll(/([A-Z])/g, ' $1')}</span><strong>{count}</strong></li>)}</ul>
        {workspaceError ? <p role="alert" className="welcome-auth-message">{workspaceError}</p> : null}
        <div className="dialog-actions"><button className="secondary-action" type="button" disabled={importBusy} onClick={() => void skipImport()}>Start empty</button><button className="primary-action" type="button" disabled={importBusy} onClick={() => void confirmImport()}>{importBusy ? 'Working…' : 'Import records'}</button></div>
      </section></div> : null}
    </>
  );
}
