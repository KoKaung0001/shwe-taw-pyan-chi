import { useEffect, useRef } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Leaf, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { primaryNavigation, screens } from './routes';
import { Placeholder } from '../features/Placeholder';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useDemoStore } from '../store/demoStore';

const secondaryScreens = screens.filter(
  ({ id }) => !primaryNavigation.some((screen) => screen.id === id),
);

export function App() {
  const { t } = useTranslation();
  const storageNotice = useDemoStore((state) => state.storageNotice);
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const currentScreen = screens.find((screen) => screen.path === location.pathname);
  const isLandingPage = currentScreen?.id === 'dashboard';
  const isSecondaryScreen = secondaryScreens.some(
    (screen) => screen.path === location.pathname,
  );

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      document.querySelector<HTMLElement>('h1')?.focus();
      previousPath.current = location.pathname;
    }
    document.title = `${currentScreen ? t(`${currentScreen.id}.nav`) : t('notFound')} · ${t('brand')}`;
  }, [currentScreen, location.pathname, t]);

  const renderRoutes = () => (
    <ErrorBoundary key={location.pathname}>
      <Routes>
        {screens.map(({ id, path }) => (
          <Route key={id} path={path} element={<Placeholder id={id} />} />
        ))}
        <Route
          path="*"
          element={
            <section className="not-found-card">
              <h1 tabIndex={-1}>{t('notFound')}</h1>
              <p>{t('notFoundBody')}</p>
              <Link className="text-link" to="/">
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
              {screens.map(({ id, path, icon: Icon }) => (
                <NavLink
                  key={id}
                  to={path}
                  end={path === '/'}
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
                  <h2>{currentScreen ? t(`${currentScreen.id}.nav`) : t('notFound')}</h2>
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
                  <FlaskConical size={15} className="shrink-0" aria-hidden="true" />
                  <span>{t('demo')}</span>
                </div>
              ) : null}
              {storageNotice ? (
                <div className="storage-notice" role="status">
                  <span>{storageNotice}</span>
                  <button onClick={() => useDemoStore.getState().dismissStorageNotice()}>
                    {t('dismiss')}
                  </button>
                </div>
              ) : null}
              <main id="main" tabIndex={-1} className="app-main">
                {currentScreen?.id === 'dashboard' ? null : (
                  <div className="screen-meta">
                    <span className="phase-pill">
                      <Sparkles size={12} aria-hidden="true" />
                      {t('phase')}
                    </span>
                    <span className="screen-counter">{t('prototype')}</span>
                  </div>
                )}
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
                end={path === '/'}
                aria-label={t(`${label}.nav`)}
                className={({ isActive }) => `tab-item${isActive ? ' is-active' : ''}`}
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
