import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('my') ? 'my' : 'en';

  return (
    <div
      className={`language-switcher${compact ? ' language-switcher-compact' : ''}`}
      role="group"
      aria-label={t('language.label')}
    >
      <button
        type="button"
        className={language === 'en' ? 'is-active' : ''}
        aria-pressed={language === 'en'}
        onClick={() => void i18n.changeLanguage('en')}
      >
        {t('language.english')}
      </button>
      <button
        type="button"
        className={language === 'my' ? 'is-active' : ''}
        aria-pressed={language === 'my'}
        onClick={() => void i18n.changeLanguage('my')}
      >
        {t('language.myanmar')}
      </button>
    </div>
  );
}
