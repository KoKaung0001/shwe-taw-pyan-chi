import { useEffect, useRef, type MouseEvent } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Leaf, Menu, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryNavigation, screens } from './routes';
import { Placeholder } from '../features/Placeholder';
import { CapturePage } from '../features/CapturePage';
import { ForecastPage, OwedPage } from '../features/AnalysisPages';
import {
  DashboardPage,
  SchedulesPage,
  SettingsPage,
  TransactionsPage,
} from '../features/FinancialPages';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useDemoStore } from '../store/demoStore';

const secondaryScreens = screens.filter(
  ({ id }) => !primaryNavigation.some((screen) => screen.id === id),
);

const landingSectionNavigation = [
  { id: 'landing-hero', label: 'brand' },
  { id: 'landing-features', label: 'landing.featuresEyebrow' },
  { id: 'landing-about', label: 'landing.aboutEyebrow' },
  { id: 'landing-cta', label: 'landing.getStarted' },
] as const;

export function App() {
  const { t } = useTranslation();
  const storageNotice = useDemoStore((state) => state.storageNotice);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const isLandingPage = location.pathname === '/';
  const currentScreen = screens.find(
    (screen) => screen.path === location.pathname,
  );
  const isSecondaryScreen = secondaryScreens.some(
    (screen) => screen.path === location.pathname,
  );

  const scrollToLandingSection = (
    event: MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  };

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      document.querySelector<HTMLElement>('h1')?.focus();
      previousPath.current = location.pathname;
    }
    document.title = `${isLandingPage ? t('brand') : currentScreen ? t(`${currentScreen.id}.nav`) : t('notFound')} · ${t('brand')}`;
  }, [currentScreen, isLandingPage, location.pathname, t]);

  useEffect(() => {
    const process = () => useDemoStore.getState().processDueSchedules();
    if (useDemoStore.persist.hasHydrated()) {
      process();
      return;
    }
    return useDemoStore.persist.onFinishHydration(process);
  }, []);

  const renderRoutes = () => (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<Placeholder id="dashboard" />} />
        {screens.map(({ id, path }) => (
          <Route
            key={id}
            path={path}
            element={
              id === 'dashboard' ? (
                <DashboardPage />
              ) : id === 'transactions' ? (
                <TransactionsPage />
              ) : id === 'schedules' ? (
                <SchedulesPage />
              ) : id === 'capture' ? (
                <CapturePage />
              ) : id === 'owed' ? (
                <OwedPage />
              ) : id === 'insights' ? (
                <ForecastPage />
              ) : id === 'settings' ? (
                <SettingsPage />
              ) : (
                <Placeholder id={id} />
              )
            }
          />
        ))}
        <Route
          path="*"
          element={
            <section className="not-found-card">
              <h1 tabIndex={-1}>{t('notFound')}</h1>
              <p>{t('notFoundBody')}</p>
              <Link className="text-link" to="/dashboard">
                {t('back')}
              </Link>
            </section>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
  return (
    <div className="app-backdrop">
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
      <div className="device-frame">
        <div className="dynamic-island" aria-hidden="true">
          <span />
        </div>

        <div className="device-header">
          {isSecondaryScreen ? (
            <Link className="back-link" to="/settings">
              <ArrowLeft size={18} aria-hidden="true" />
              <span>{t('backToProfile')}</span>
            </Link>
          ) : isLandingPage ? (
            <>
              <Link to="/" className="landing-brand-lockup">
                <Leaf size={22} strokeWidth={2.2} aria-hidden="true" />
                <span className="landing-brand-name">{t('brand')}</span>
              </Link>
              <span className="landing-menu-icon" aria-hidden="true">
                <Menu size={21} strokeWidth={2.1} />
              </span>
            </>
          ) : (
            <Link to="/" className="brand-lockup">
              <span className="brand-mark">
                <Leaf size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="brand-name">{t('brand')}</span>
                <span className="brand-tagline">{t('tagline')}</span>
              </span>
            </Link>
          )}
        </div>

        <div className="desktop-layout">
          <aside className="desktop-sidebar">
            <Link to="/" className="desktop-brand-lockup">
              <span className="brand-mark">
                <Leaf size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="brand-name">{t('brand')}</span>
                <span className="brand-tagline">{t('tagline')}</span>
              </span>
            </Link>
            <p className="desktop-sidebar-label">{t('workspace')}</p>
            <nav className="desktop-nav" aria-label={t('navigation')}>
              {isLandingPage
                ? landingSectionNavigation.map(({ id, label }) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="desktop-nav-link"
                      onClick={(event) => scrollToLandingSection(event, id)}
                    >
                      <span>{t(label)}</span>
                    </a>
                  ))
                : screens.map(({ id, path, icon: Icon }) => (
                    <NavLink
                      key={id}
                      to={path}
                      end
                      className={({ isActive }) =>
                        `desktop-nav-link${isActive ? ' is-active' : ''}`
                      }
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{t(`${id}.nav`)}</span>
                    </NavLink>
                  ))}
            </nav>
            <p className="desktop-sidebar-footer">{t('tagline')}</p>
          </aside>

          <div className="desktop-content">
            <header className="desktop-header">
              {isSecondaryScreen ? (
                <Link className="desktop-back-link" to="/settings">
                  <ArrowLeft size={18} aria-hidden="true" />
                  <span>{t('backToProfile')}</span>
                </Link>
              ) : (
                <div>
                  <p>{t('brand')}</p>
                  <h2>
                    {isLandingPage
                      ? t('brand')
                      : currentScreen
                        ? t(`${currentScreen.id}.nav`)
                        : t('notFound')}
                  </h2>
                </div>
              )}
              <span className="phase-pill">
                <Sparkles size={12} aria-hidden="true" />
                {t('phase')}
              </span>
            </header>

            <div className="app-scroll">
              {!isLandingPage ? (
                <div className="demo-banner">
                  <FlaskConical
                    size={15}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span>{t('demo')}</span>
                </div>
              ) : null}
              {storageNotice ? (
                <div className="storage-notice" role="status">
                  <span>{storageNotice}</span>
                  <button
                    onClick={() =>
                      useDemoStore.getState().dismissStorageNotice()
                    }
                  >
                    {t('dismiss')}
                  </button>
                </div>
              ) : null}
              <main id="main" tabIndex={-1} className="app-main">
                {!isLandingPage ? (
                  <div className="screen-meta">
                    <span className="phase-pill">
                      <Sparkles size={12} aria-hidden="true" />
                      {t('phase')}
                    </span>
                    <span className="screen-counter">{t('prototype')}</span>
                  </div>
                ) : null}
                {renderRoutes()}
                <footer className="app-footer">{t('footer')}</footer>
              </main>
            </div>
          </div>
        </div>

        {!isLandingPage ? (
          <nav className="tab-bar" aria-label={t('navigation')}>
            {primaryNavigation.map(({ id, path, icon: Icon, label }) => (
              <NavLink
                key={id}
                to={path}
                end
                aria-label={t(`${label}.nav`)}
                className={({ isActive }) =>
                  `tab-item${isActive ? ' is-active' : ''}`
                }
              >
                <Icon size={20} strokeWidth={2.1} aria-hidden="true" />
                <span>{t(`${label}.tab`)}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
