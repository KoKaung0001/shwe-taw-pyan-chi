import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import type { TFunction } from 'i18next';
import {
  ArrowLeftRight,
  CircleDollarSign,
  Menu,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryDestinations, screens, utilityDestinations } from './routes';
import { Placeholder } from '../features/Placeholder';
import { CapturePage } from '../features/CapturePage';
import { ForecastPage, OwedPage } from '../features/AnalysisPages';
import { ReadinessPage } from '../features/ReadinessPage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useDemoStore } from '../store/demoStore';
import {
  DashboardPage,
  BudgetPage,
  SchedulesPage,
  SettingsPage,
  TransactionsPage,
} from '../features/FinancialPages';
import { MorePage } from '../features/MorePage';
import { ProfilePage } from '../features/ProfilePage';
import { FutureAIPage } from '../features/FutureAIPage';
import { AccountControls, AccountNotices } from '../auth/AccountControls';
import { PaymentsLayout } from '../features/PaymentsLayout';
import { SlidingSelector } from '../components/SlidingSelector';
import { RouteFade, useAnimatedVisibility } from '../components/Motion';
import { BrandMark } from '../components/BrandMark';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

function routeName(pathname: string, t: TFunction) {
  if (
    pathname.startsWith('/payments') ||
    pathname === '/schedules' ||
    pathname === '/owed'
  )
    return t('payments.nav');
  if (pathname.startsWith('/transactions/')) return t('transactions.nav');
  if (pathname === '/profile') return t('profile.title');
  if (pathname === '/chat') return t('chat.nav');
  if (pathname === '/budget') return t('budget.title');
  if (pathname === '/more') return t('more.nav');
  const screen = screens.find((item) => item.path === pathname);
  return screen ? t(`${screen.id}.nav`) : t('notFound');
}

export function App() {
  const { t } = useTranslation();
  const storageNotice = useDemoStore((state) => state.storageNotice);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const quickAddButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const quickAddRef = useRef<HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [overlayPath, setOverlayPath] = useState(location.pathname);
  if (overlayPath !== location.pathname) {
    setOverlayPath(location.pathname);
    setMobileDrawerOpen(false);
    setQuickAddOpen(false);
  }
  const drawerPresent = useAnimatedVisibility(mobileDrawerOpen, 220);
  const quickAddPresent = useAnimatedVisibility(quickAddOpen, 180);
  const isComposer = location.pathname === '/transactions/new';

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !mobileDrawerOpen;
    if (quickAddRef.current) quickAddRef.current.inert = !quickAddOpen;
  }, [mobileDrawerOpen, quickAddOpen, drawerPresent, quickAddPresent]);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      document.querySelector<HTMLElement>('h1')?.focus();
      previousPath.current = location.pathname;
    }
    document.title = `${routeName(location.pathname, t)} · ${t('brand')}`;
  }, [location.pathname, t]);

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const drawer = drawerRef.current;
    drawer?.querySelector<HTMLElement>('[data-drawer-close]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
      if (event.key !== 'Tab' || !drawer) return;
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const dialog = quickAddRef.current;
    dialog?.querySelector<HTMLElement>('a[href]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickAddOpen(false);
        quickAddButtonRef.current?.focus();
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickAddOpen]);

  useEffect(() => {
    const process = () => useDemoStore.getState().processDueSchedules();
    if (useDemoStore.persist.hasHydrated()) {
      process();
      return;
    }
    return useDemoStore.persist.onFinishHydration(process);
  }, []);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        {t('skip')}
      </a>
      {storageNotice ? (
        <div className="storage-notice" role="status">
          <span>{storageNotice}</span>
          <button
            className="pill-button pill-button-quiet"
            onClick={() => useDemoStore.getState().dismissStorageNotice()}
          >
            {t('dismiss')}
          </button>
        </div>
      ) : null}
      <AccountNotices />
      <div className="app-frame">
        <aside id="app-navigation" className="app-sidebar">
          <Link to="/" className="brand-lockup">
            <span className="brand-symbol">
              <BrandMark className="size-7" />
            </span>
            <span className="brand-name">{t('brand')}</span>
          </Link>
          <div className="sidebar-caption">{t('navigation')}</div>
          <SlidingSelector
            as="nav"
            aria-label={t('navigation')}
            className="primary-navigation"
            selectionKey={location.pathname}
          >
            {primaryDestinations
              .filter((item) => item.id !== 'more')
              .map(({ id, path, icon: Icon }) => (
                <NavLink
                  key={id}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `navigation-link${isActive ? ' navigation-link-active' : ''}`
                  }
                >
                  <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span>{t(`${id}.nav`)}</span>
                </NavLink>
              ))}
          </SlidingSelector>
          <Link
            className="sidebar-caption sidebar-caption-secondary sidebar-more-link"
            to="/more"
          >
            {t('more.nav')}
          </Link>
          <SlidingSelector
            as="nav"
            aria-label={t('more.nav')}
            className="primary-navigation"
            selectionKey={location.pathname}
          >
            {utilityDestinations.map(({ id, path, icon: Icon }) => (
              <NavLink
                key={id}
                to={path}
                className={({ isActive }) =>
                  `navigation-link${isActive ? ' navigation-link-active' : ''}`
                }
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(`${id}.nav`)}</span>
              </NavLink>
            ))}
          </SlidingSelector>
        </aside>

        {drawerPresent ? (
          <>
            <button
              type="button"
              className="mobile-drawer-backdrop"
              data-state={mobileDrawerOpen ? 'open' : 'closed'}
              aria-hidden={!mobileDrawerOpen}
              disabled={!mobileDrawerOpen}
              aria-label={t('close')}
              onClick={() => {
                setMobileDrawerOpen(false);
                menuButtonRef.current?.focus();
              }}
            />
            <aside
              ref={drawerRef}
              id="mobile-drawer"
              className="mobile-drawer"
              data-state={mobileDrawerOpen ? 'open' : 'closed'}
              aria-hidden={!mobileDrawerOpen}
              role="dialog"
              aria-modal="true"
              aria-label={t('navigation')}
            >
              <div className="mobile-drawer-header">
                <Link
                  to="/"
                  className="brand-lockup"
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <span className="brand-symbol">
                    <BrandMark className="size-6" />
                  </span>
                  <span className="brand-name">{t('brand')}</span>
                </Link>
                <button
                  type="button"
                  className="drawer-close-button"
                  data-drawer-close
                  aria-label={t('close')}
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    menuButtonRef.current?.focus();
                  }}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <nav aria-label={t('navigation')} className="drawer-navigation">
                {primaryDestinations
                  .filter((item) => item.id !== 'more')
                  .map(({ id, path, icon: Icon }) => (
                    <NavLink
                      key={id}
                      to={path}
                      end={path === '/'}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={({ isActive }) =>
                        `drawer-link${isActive || (id === 'payments' && location.pathname.startsWith('/payments')) ? ' drawer-link-active' : ''}`
                      }
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                      <span>{t(`${id}.nav`)}</span>
                    </NavLink>
                  ))}
              </nav>
              <div className="drawer-section-label">{t('more.nav')}</div>
              <nav aria-label={t('more.nav')} className="drawer-navigation">
                {utilityDestinations.map(({ id, path, icon: Icon }) => (
                  <NavLink
                    key={id}
                    to={path}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={({ isActive }) =>
                      `drawer-link${isActive ? ' drawer-link-active' : ''}`
                    }
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{t(`${id}.nav`)}</span>
                  </NavLink>
                ))}
              </nav>
            </aside>
          </>
        ) : null}

        <div className="app-main-column">
          <header className="topbar">
            <button
              ref={menuButtonRef}
              type="button"
              className="mobile-menu-trigger lg:hidden"
              aria-label={t('menu')}
              aria-haspopup="dialog"
              aria-expanded={mobileDrawerOpen}
              aria-controls="mobile-drawer"
              onClick={() => setMobileDrawerOpen(true)}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <Link to="/" className="mobile-brand lg:hidden">
              <span className="brand-symbol">
                <BrandMark className="size-6" />
              </span>
              <span>{t('brand')}</span>
            </Link>
            <div className="topbar-actions">
              <LanguageSwitcher compact />
              <AccountControls />
            </div>
          </header>
          <main id="main" tabIndex={-1} className="page-content">
            <ErrorBoundary resetKey={location.pathname}>
              <RouteFade
                routeKey={
                  location.pathname.startsWith('/payments')
                    ? '/payments'
                    : location.pathname
                }
              >
                <Routes>
                  <Route
                    path="/transactions/new"
                    element={<TransactionsPage />}
                  />
                  {screens
                    .filter(({ id }) => id !== 'schedules' && id !== 'owed')
                    .map(({ id, path }) => (
                      <Route
                        key={id}
                        path={path}
                        element={
                          id === 'dashboard' ? (
                            <DashboardPage />
                          ) : id === 'transactions' ? (
                            <TransactionsPage />
                          ) : id === 'capture' ? (
                            <CapturePage />
                          ) : id === 'insights' ? (
                            <ForecastPage />
                          ) : id === 'settings' ? (
                            <SettingsPage />
                          ) : id === 'readiness' ? (
                            <ReadinessPage />
                          ) : (
                            <Placeholder id={id} />
                          )
                        }
                      />
                    ))}
                  <Route path="/payments" element={<PaymentsLayout />}>
                    <Route index element={<Navigate to="schedule" replace />} />
                    <Route path="schedule" element={<SchedulesPage />} />
                    <Route
                      path="upcoming"
                      element={<Navigate to="/payments/schedule" replace />}
                    />
                    <Route
                      path="owed"
                      element={<Navigate to="/payments/owed-to-me" replace />}
                    />
                    <Route
                      path="owed-to-me"
                      element={<OwedPage kind="to-me" />}
                    />
                    <Route path="i-owe" element={<OwedPage kind="i-owe" />} />
                  </Route>
                  <Route path="/budget" element={<BudgetPage />} />
                  <Route
                    path="/schedules"
                    element={<Navigate to="/payments/schedule" replace />}
                  />
                  <Route
                    path="/owed"
                    element={<Navigate to="/payments/owed-to-me" replace />}
                  />
                  <Route path="/more" element={<MorePage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/chat" element={<FutureAIPage />} />
                  <Route
                    path="*"
                    element={
                      <section className="surface-card p-8">
                        <h1 tabIndex={-1} className="text-3xl font-semibold">
                          {t('notFound')}
                        </h1>
                        <p className="my-4 text-muted-foreground">
                          {t('notFoundBody')}
                        </p>
                        <Link className="text-primary underline" to="/">
                          {t('back')}
                        </Link>
                      </section>
                    }
                  />
                </Routes>
              </RouteFade>
            </ErrorBoundary>
          </main>
          <SlidingSelector
            as="nav"
            className="mobile-bottom-nav lg:hidden"
            aria-label={t('navigation')}
            selectionKey={location.pathname}
            selectedSelector=".mobile-tab-active"
          >
            {primaryDestinations.map(({ id, path, icon: Icon }) => (
              <NavLink
                key={id}
                to={path}
                end={path === '/'}
                className={({ isActive }) => {
                  const utilityPage = [
                    '/profile',
                    '/chat',
                    '/readiness',
                    '/settings',
                  ].includes(location.pathname);
                  const active = isActive || (id === 'more' && utilityPage);
                  return `mobile-tab${active ? ' mobile-tab-active' : ''}`;
                }}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{t(`${id}.nav`)}</span>
              </NavLink>
            ))}
          </SlidingSelector>
        </div>
      </div>
      {!isComposer ? (
        <>
          {quickAddPresent ? (
            <>
              <button
                type="button"
                className="quick-add-backdrop"
                data-state={quickAddOpen ? 'open' : 'closed'}
                aria-hidden={!quickAddOpen}
                disabled={!quickAddOpen}
                aria-label={t('close')}
                onClick={() => {
                  setQuickAddOpen(false);
                  quickAddButtonRef.current?.focus();
                }}
              />
              <section
                ref={quickAddRef}
                className="quick-add-menu"
                data-state={quickAddOpen ? 'open' : 'closed'}
                aria-hidden={!quickAddOpen}
                role="dialog"
                aria-modal="true"
                aria-label={t('quickAdd.title')}
              >
                <Link
                  to="/transactions/new"
                  className="quick-add-option"
                  onClick={() => setQuickAddOpen(false)}
                >
                  <span className="quick-add-icon">
                    <ArrowLeftRight size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t('quickAdd.transaction')}</strong>
                    <small>{t('quickAdd.transactionHelp')}</small>
                  </span>
                </Link>
                <Link
                  to="/budget"
                  className="quick-add-option"
                  onClick={() => setQuickAddOpen(false)}
                >
                  <span className="quick-add-icon">
                    <CircleDollarSign size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t('quickAdd.budget')}</strong>
                    <small>{t('quickAdd.budgetHelp')}</small>
                  </span>
                </Link>
                <Link
                  to="/capture"
                  className="quick-add-option"
                  onClick={() => setQuickAddOpen(false)}
                >
                  <span className="quick-add-icon">
                    <Upload size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{t('quickAdd.uploadReceipt')}</strong>
                    <small>{t('quickAdd.uploadReceiptHelp')}</small>
                  </span>
                </Link>
              </section>
            </>
          ) : null}
          <button
            ref={quickAddButtonRef}
            type="button"
            className="global-add-button"
            data-open={quickAddOpen}
            aria-label={quickAddOpen ? t('close') : t('quickAdd.open')}
            aria-expanded={quickAddOpen}
            onClick={() => setQuickAddOpen((open) => !open)}
          >
            <Plus size={27} aria-hidden="true" />
          </button>
        </>
      ) : null}
    </>
  );
}
