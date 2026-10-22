import { useSyncExternalStore } from 'react';
import type { AuthenticatedUser } from './supabaseAuth';
import { isSupabaseConfigured, getSupabaseClient } from './supabaseClient';
import { userFromSession } from './supabaseAuth';

let currentUser: AuthenticatedUser | null = null;
let loading = true;
let authError: string | null = null;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;
interface AuthSnapshot { user: AuthenticatedUser | null; loading: boolean; error: string | null }
let snapshot: AuthSnapshot = { user: currentUser, loading, error: authError };
function notify() {
  snapshot = { user: currentUser, loading, error: authError };
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }

export function startAuthSession() {
  if (stop) return stop;
  if (!isSupabaseConfigured) {
    loading = false;
    authError = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable accounts.';
    notify();
    return () => {};
  }
  const supabase = getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = userFromSession(session);
    loading = false;
    authError = null;
    notify();
  });
  stop = () => { data.subscription.unsubscribe(); stop = null; };
  void supabase.auth.getSession().then(({ data: sessionData, error }) => {
    currentUser = userFromSession(sessionData.session);
    loading = false;
    authError = error?.message ?? null;
    notify();
  }).catch((error: unknown) => {
    loading = false;
    authError = error instanceof Error ? error.message : 'Could not restore your sign-in session.';
    notify();
  });
  return stop;
}

export function useAuthSession() {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

export function setAuthUser(user: AuthenticatedUser | null) { currentUser = user; loading = false; notify(); }
const SERVER_SNAPSHOT: AuthSnapshot = { user: null, loading: true, error: null };
