import { Navigate, useLocation } from 'react-router-dom';
import { App } from '../app/App';
import { AccessPage } from './AccessPage';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from './AuthProvider';
import { useTranslation } from 'react-i18next';

export function AuthGate() {
  const { t } = useTranslation();
  const auth = useAuth()!;
  const location = useLocation();
  if (auth.loading)
    return (
      <main className="account-loading" role="status">
        <span>
          <BrandMark />
        </span>
        <p>{t('account.openingWorkspace')}</p>
      </main>
    );
  if (!auth.user) return <AccessPage />;
  if (['/login', '/register', '/welcome'].includes(location.pathname))
    return <Navigate to="/" replace />;
  return <App />;
}
