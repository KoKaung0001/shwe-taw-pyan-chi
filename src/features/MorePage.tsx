import { Settings, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const items = [
  { id: 'settings', path: '/settings', icon: Settings },
] as const;

export function MorePage() {
  const { t } = useTranslation();
  return (
    <div className="page-stack">
      <header className="page-heading">
        <h1 tabIndex={-1}>{t('more.title')}</h1>
      </header>
      <div className="utility-grid">
        {items.map(({ id, path, icon: Icon }) => (
          <Link className="utility-card" key={id} to={path}>
            <span className="utility-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
            <span className="utility-copy"><strong>{t(`${id}.nav`)}</strong></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
