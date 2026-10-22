import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabaseClient';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? '',
    name: String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'User'),
  };
}

export function userFromSession(session: Session | null) {
  return session ? toAuthenticatedUser(session.user) : null;
}

export async function signUp(input: { name: string; email: string; password: string }) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { full_name: input.name.trim() } },
  });
  if (error) throw error;
  if (!data.session) throw new Error('Check your email to confirm your account, then log in.');
  if (!data.user) throw new Error('Could not create the account. Please try again.');
  return toAuthenticatedUser(data.user);
}

export async function signIn(input: { email: string; password: string }) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) throw error;
  return toAuthenticatedUser(data.user);
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
