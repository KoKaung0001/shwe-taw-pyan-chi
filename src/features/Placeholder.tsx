import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChartNoAxesCombined,
  Construction,
  Heart,
  Leaf,
  LockKeyhole,
  MessageCircle,
  PlayCircle,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { primaryNavigation, screens, type ScreenId } from '../app/routes';

const secondaryScreens = screens.filter(
  ({ id }) => !primaryNavigation.some((screen) => screen.id === id),
);

const landingFeatures = [
  { route: '/transactions', icon: ChartNoAxesCombined, key: 'trackFinances' },
  { route: '/capture', icon: ScanLine, key: 'smartOcr' },
  { route: '/insights', icon: Sparkles, key: 'aiInsights' },
  { route: '/chat', icon: MessageCircle, key: 'aiAssistant' },
  { route: '/readiness', icon: ShieldCheck, key: 'creditReadiness' },
  { route: '/settings', icon: UserRound, key: 'simpleFriendly' },
] as const;

const landingBenefits = [
  { icon: LockKeyhole, key: 'independence' },
  { icon: TrendingUp, key: 'growth' },
  { icon: Heart, key: 'opportunity' },
] as const;

function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">{t('landing.eyebrow')}</p>
          <h1 id="landing-title" tabIndex={-1}>
            {t('landing.heroTitle')}
          </h1>
          <p className="landing-hero-description">{t('landing.heroDescription')}</p>
          <div className="landing-actions">
            <Link className="landing-primary-button" to="/transactions">
              <span>{t('landing.getStarted')}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="landing-secondary-button" to="/insights">
              <PlayCircle size={17} aria-hidden="true" />
              <span>{t('landing.watchDemo')}</span>
            </Link>
          </div>
        </div>

        <div className="landing-preview" aria-label={t('landing.previewLabel')}>
          <div className="landing-preview-header">
            <span className="landing-preview-brand">
              <span className="landing-preview-leaf" aria-hidden="true"><Leaf size={17} /></span>
              {t('brand')}
            </span>
            <span className="landing-preview-dot" aria-hidden="true" />
          </div>
          <div className="landing-preview-balance">
            <span>{t('landing.previewCaption')}</span>
            <strong aria-hidden="true">••••</strong>
          </div>
          <div className="landing-preview-chart" aria-hidden="true">
            <span style={{ height: '38%' }} />
            <span style={{ height: '56%' }} />
            <span style={{ height: '44%' }} />
            <span style={{ height: '75%' }} />
            <span style={{ height: '62%' }} />
            <span style={{ height: '88%' }} />
            <span style={{ height: '70%' }} />
          </div>
          <div className="landing-preview-legend">
            <span><i className="landing-legend-dot is-income" />{t('landing.income')}</span>
            <span><i className="landing-legend-dot is-expense" />{t('landing.expenses')}</span>
          </div>
          <div className="landing-preview-card">
            <span className="landing-preview-card-icon"><Sparkles size={14} aria-hidden="true" /></span>
            <span>
              <strong>{t('landing.previewInsight')}</strong>
              <small>{t('landing.previewInsightBody')}</small>
            </span>
          </div>
        </div>

        <div className="landing-trust-row" aria-label={t('landing.trustLabel')}>
          <span><LockKeyhole size={14} aria-hidden="true" />{t('landing.secure')}</span>
          <span><Sparkles size={14} aria-hidden="true" />{t('landing.easy')}</span>
          <span><Heart size={14} aria-hidden="true" />{t('landing.myanmar')}</span>
        </div>
      </section>

      <section className="landing-section landing-features" aria-labelledby="features-title">
        <p className="landing-kicker">{t('landing.featuresEyebrow')}</p>
        <h2 id="features-title">{t('landing.featuresTitle')}</h2>
        <p className="landing-section-description">{t('landing.featuresDescription')}</p>
        <div className="landing-feature-grid">
          {landingFeatures.map(({ route, icon: Icon, key }) => (
            <Link key={route} to={route} className={`landing-feature-card feature-${key}`}>
              <span className="landing-feature-icon"><Icon size={20} aria-hidden="true" /></span>
              <span className="landing-feature-copy">
                <strong>{t(`landing.features.${key}.title`)}</strong>
                <small>{t(`landing.features.${key}.description`)}</small>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section landing-about" aria-labelledby="about-title">
        <div className="landing-about-illustration" aria-hidden="true">
          <div className="landing-sun" />
          <div className="landing-plant landing-plant-left"><span /><span /><span /></div>
          <div className="landing-person">
            <div className="landing-person-head" />
            <div className="landing-person-body" />
            <div className="landing-laptop" />
          </div>
          <div className="landing-cup" />
          <div className="landing-plant landing-plant-right"><span /><span /><span /></div>
        </div>
        <div className="landing-about-copy">
          <p className="landing-kicker">{t('landing.aboutEyebrow')}</p>
          <h2 id="about-title">{t('landing.aboutTitle')}</h2>
          <p className="landing-section-description">{t('landing.aboutDescription')}</p>
          <div className="landing-benefit-list">
            {landingBenefits.map(({ icon: Icon, key }) => (
              <div key={key} className="landing-benefit-item">
                <span className="landing-benefit-icon"><Icon size={15} aria-hidden="true" /></span>
                <span><strong>{t(`landing.benefits.${key}.title`)}</strong><small>{t(`landing.benefits.${key}.description`)}</small></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta" aria-labelledby="cta-title">
        <span className="landing-cta-mark" aria-hidden="true"><Leaf size={25} /></span>
        <h2 id="cta-title">{t('landing.ctaTitle')}</h2>
        <p>{t('landing.ctaDescription')}</p>
        <Link className="landing-primary-button landing-cta-button" to="/transactions">
          <span>{t('landing.getStarted')}</span>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <div className="landing-footer-brand">
          <span className="brand-mark"><Leaf size={17} aria-hidden="true" /></span>
          <span><strong>{t('brand')}</strong><small>{t('tagline')}</small></span>
        </div>
        <small className="landing-copyright">{t('landing.copyright')}</small>
      </section>
    </div>
  );
}

export function Placeholder({ id }: { id: ScreenId }) {
  const { t } = useTranslation();
  if (id === 'dashboard') {
    return <LandingPage />;
  }
  const items = t(`${id}.items`, { returnObjects: true }) as string[];
  return (
    <>
      <section className="screen-intro">
        <h1 tabIndex={-1}>
          {t(`${id}.title`)}
        </h1>
        <p>
          {t(`${id}.description`)}
        </p>
      </section>
      <section className="placeholder-card">
        <div className="placeholder-card-heading">
          <span className="placeholder-icon">
            <Construction aria-hidden="true" size={24} />
          </span>
          <div>
            <p className="card-eyebrow">{t('prototype')}</p>
            <span className="status-pill">{t('status')}</span>
          </div>
        </div>
        <h2>{t('planned')}</h2>
        <p className="card-description">{t('scope')}</p>
        <ul className="feature-list">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <Check
                className="mt-1 shrink-0 text-accent"
                size={17}
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="no-data-note">
          {t('noData')}
        </p>
      </section>
      {id === 'settings' ? (
        <section className="profile-navigation">
          <div className="profile-navigation-heading">
            <p className="card-eyebrow">{t('quickAccess')}</p>
            <h2>{t('quickAccess')}</h2>
            <p>{t('quickAccessBody')}</p>
          </div>
          <div className="profile-navigation-list">
            {secondaryScreens.map(({ id: screenId, path, icon: Icon }) => (
              <Link
                key={screenId}
                to={path}
                aria-label={t(`${screenId}.nav`)}
                className="profile-navigation-item"
              >
                <span className="profile-navigation-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="profile-navigation-copy">
                  <strong>{t(`${screenId}.nav`)}</strong>
                  <small>{t(`${screenId}.description`)}</small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
