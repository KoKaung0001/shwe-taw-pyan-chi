import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  LockKeyhole,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandWordmark } from '../components/BrandWordmark';
import { signIn, signUp, type AuthenticatedUser } from '../services/supabaseAuth';

type ScenePhase = 'landing' | 'collecting' | 'organizing' | 'ready';

const objects = [
  { kind: 'receipt', title: 'Market receipt', detail: '12,500 MMK', icon: ReceiptText, left: 50, top: 12, rotation: -10 },
  { kind: 'note', title: 'Income', detail: '+ 85,000', icon: WalletCards, left: 76, top: 16, rotation: 9 },
  { kind: 'slip', title: 'Transport', detail: '3,000 MMK', icon: ReceiptText, left: 61, top: 65, rotation: 7 },
  { kind: 'note', title: 'Coffee', detail: '− 4,500', icon: WalletCards, left: 88, top: 46, rotation: -7 },
  { kind: 'receipt', title: 'Utilities', detail: '18,000 MMK', icon: ReceiptText, left: 43, top: 43, rotation: 5 },
  { kind: 'slip', title: 'Side project', detail: '+ 32,000', icon: WalletCards, left: 72, top: 79, rotation: -11 },
  { kind: 'note', title: 'Groceries', detail: '24,000 MMK', icon: WalletCards, left: 92, top: 75, rotation: 8 },
] as const;

export function WelcomeExperience({ onAuthenticated, onExploreDemo }: {
  onAuthenticated: (user: AuthenticatedUser) => Promise<void> | void;
  onExploreDemo?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth' || location.pathname === '/signup';
  const isSignup = location.pathname === '/signup';
  const [phase, setPhase] = useState<ScenePhase>(isAuthRoute ? 'ready' : 'landing');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brand = t('brand');

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (isAuthRoute && phase === 'ready') document.getElementById('auth-heading')?.focus();
  }, [isAuthRoute, phase]);

  useEffect(() => {
    const restoreLandingOnBack = () => {
      const route = window.location.hash.slice(1).split('?')[0] || '/';
      if (route === '/') {
        if (timer.current) clearTimeout(timer.current);
        setPhase('landing');
      }
    };
    window.addEventListener('popstate', restoreLandingOnBack);
    return () => window.removeEventListener('popstate', restoreLandingOnBack);
  }, []);

  function begin() {
    if (phase !== 'landing') return;
    setMessage('');
    setPhase('collecting');
    navigate('/auth');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      if (reducedMotion) {
        setPhase('ready');
        return;
      }
      setPhase('organizing');
      timer.current = setTimeout(() => setPhase('ready'), 650);
    }, reducedMotion ? 50 : 900);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const user = isSignup
        ? await signUp({
            name: String(form.get('name') ?? ''),
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          })
        : await signIn({
            email: String(form.get('email') ?? ''),
            password: String(form.get('password') ?? ''),
          });
      await onAuthenticated(user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      if (/not configured/i.test(detail)) setMessage('Accounts are not configured yet. Add the Supabase project URL and public anon key to the app environment.');
      else if (/check your email to confirm/i.test(detail)) setMessage(detail);
      else if (/already registered|already exists/i.test(detail)) setMessage('An account already exists for this email. Log in instead.');
      else if (/invalid login credentials/i.test(detail)) setMessage('Email or password is incorrect.');
      else setMessage('Could not complete that request. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const sceneClass = `welcome-experience${isAuthRoute && phase === 'ready' ? ' is-auth-route' : ''}${phase === 'collecting' ? ' is-collecting' : ''}${phase === 'organizing' ? ' is-organizing' : ''}${phase === 'ready' ? ' is-auth-ready' : ''}`;

  return <main className={sceneClass}>
    <div className="welcome-hero-shell">
    <header className="welcome-header">
      <Link to="/" className="welcome-brand" aria-label={`${brand} home`} onClick={() => setPhase('landing')}>
        <span className="welcome-brand-mark" aria-hidden="true" />
        <BrandWordmark className="welcome-brand-name" />
      </Link>
      <span className="welcome-header-note">A clearer view of your money</span>
    </header>

    <div className="welcome-artboard" aria-hidden="true">
      {objects.map(({ kind, title, detail, icon: Icon, left, top, rotation }, index) => <div
        className={`welcome-object object-${kind}`}
        key={title}
        style={{ '--start-left': `${left}%`, '--start-top': `${top}%`, '--rotation': `${rotation}deg`, '--object-index': index } as CSSProperties}
      >
        <span className="welcome-object-icon"><Icon size={15} strokeWidth={1.8} /></span>
        <span className="welcome-object-copy"><strong>{title}</strong><small>{detail}</small></span>
        {kind === 'receipt' ? <span className="welcome-receipt-rule" /> : null}
      </div>)}
      <div className="welcome-organized-mark"><span /><span /><span /><span /></div>
    </div>

    <section className="welcome-landing-copy" aria-labelledby="welcome-heading">
      <h1 id="welcome-heading">Bring your money <em>together.</em></h1>
      <p className="welcome-hook">Your finances, in one place</p>
      <p className="welcome-explanation">Make sense of every little spend and every bit of income, all in one calm place.</p>
      <button className="welcome-primary-button" type="button" onClick={begin} disabled={phase !== 'landing'}>
        Get Started <ArrowRight size={18} aria-hidden="true" />
      </button>
      {import.meta.env.DEV && onExploreDemo ? <button className="welcome-demo-preview" type="button" onClick={onExploreDemo}>Explore with demo data</button> : null}
      <span className="welcome-reassurance"><LockKeyhole size={14} aria-hidden="true" /> Your financial records stay yours</span>
    </section>

    <section className="welcome-auth-card" aria-labelledby="auth-heading" aria-hidden={!isAuthRoute || phase !== 'ready'}>
      <div className="welcome-auth-brand"><span className="welcome-auth-check"><Check size={17} /></span><span>Everything in its place</span></div>
      <h1 id="auth-heading" tabIndex={-1}>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
      <p className="welcome-auth-intro">{isSignup ? 'Start bringing your finances together.' : 'Pick up where you left off.'}</p>
      <form onSubmit={submitAuth}>
        {isSignup ? <label>Full name<input autoComplete="name" name="name" placeholder="Your name" required /></label> : null}
        <label>Email address<input autoComplete="email" name="email" type="email" placeholder="you@example.com" required /></label>
        <label>Password<input autoComplete={isSignup ? 'new-password' : 'current-password'} name="password" type="password" placeholder="Enter your password" minLength={8} required /></label>
        <button className="welcome-primary-button welcome-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}<ArrowRight size={17} aria-hidden="true" /></button>
      </form>
      <p className="welcome-auth-switch">{isSignup ? 'Already have an account?' : <>New to <BrandWordmark inline />?</>} <Link to={isSignup ? '/auth' : '/signup'}>{isSignup ? 'Log in' : 'Sign up'}</Link></p>
      {import.meta.env.DEV && onExploreDemo ? <button className="welcome-demo-preview welcome-demo-preview-auth" type="button" onClick={onExploreDemo}>Explore with demo data</button> : null}
      {message ? <p className="welcome-auth-message" role="status">{message}</p> : null}
    </section>

    <footer className="welcome-footer"><span>Small steps. A clearer picture.</span><span>Built for everyday money</span></footer>
    </div>

    {!isAuthRoute ? <section className="welcome-bank-context" aria-labelledby="bank-context-heading">
      <header className="welcome-context-intro">
        <span className="welcome-context-kicker">Shwe Taw Pyan Chi for financial institutions</span>
        <h2 id="bank-context-heading">Empowering Banks Through Smarter Financial Insights</h2>
        <p>We help financial institutions better understand freelancers and small businesses through organized financial records, transparent readiness assessments, and AI-powered insights.</p>
      </header>
      <div className="welcome-context-points">
        <article className="welcome-context-point">
          <span className="welcome-context-number">01</span>
          <div>
            <h3>Why Banks Can Trust Us</h3>
            <p className="welcome-context-hook">Transparent Data. Explainable Insights. Responsible Decisions.</p>
            <p className="welcome-context-detail">We organize income, expenses, cash flow, and financial documents into clear, easy-to-review reports. Our approach emphasizes data transparency, user consent, and explainable assessments—helping banks make more informed lending decisions while keeping final approval in their hands.</p>
          </div>
        </article>
        <article className="welcome-context-point">
          <span className="welcome-context-number">02</span>
          <div>
            <h3>Why Partner With Us?</h3>
            <p className="welcome-context-hook">Reach Underserved Customers. Unlock New Opportunities.</p>
            <p className="welcome-context-detail">Many freelancers and small businesses lack the organized financial records needed to demonstrate their financial health. Shwe Taw Pyan Chi helps bridge this gap, enabling banks to better understand these customers and explore new opportunities in the underserved SME and independent-worker markets.</p>
          </div>
        </article>
        <article className="welcome-context-point">
          <span className="welcome-context-number">03</span>
          <div>
            <h3>How We Help Banks Grow</h3>
            <p className="welcome-context-hook">Reduce Manual Work. Discover New Revenue Opportunities.</p>
            <p className="welcome-context-detail">By organizing financial information and highlighting relevant cash-flow insights, our platform has the potential to reduce document-review effort, improve application preparation, and help banks identify qualified potential borrowers. More efficient processes and broader customer reach can create opportunities for sustainable business growth.</p>
          </div>
        </article>
      </div>
    </section> : null}
  </main>;
}
