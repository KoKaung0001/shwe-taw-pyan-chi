import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ auth: mocks }) }));

import { signIn, signOut, signUp } from './supabaseAuth';

const user = { id: 'user-1', email: 'person@example.com', user_metadata: { full_name: 'Demo Person' } };
beforeEach(() => vi.clearAllMocks());

describe('Supabase authentication calls', () => {
  it('normalizes the email and stores the display name as auth metadata on signup', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: { access_token: 'token' } }, error: null });
    await expect(signUp({ name: ' Demo Person ', email: ' PERSON@Example.com ', password: 'secret-password' })).resolves.toEqual({ id: 'user-1', name: 'Demo Person', email: 'person@example.com' });
    expect(mocks.signUp).toHaveBeenCalledWith({ email: 'person@example.com', password: 'secret-password', options: { data: { full_name: 'Demo Person' } } });
  });

  it('requires email confirmation when signup has not created a session', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    await expect(signUp({ name: 'Demo', email: user.email, password: 'secret-password' })).rejects.toThrow(/confirm your account/i);
  });

  it('logs in with Supabase, returns the auth identity, and signs out', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    await expect(signIn({ email: ' PERSON@Example.com ', password: 'secret-password' })).resolves.toEqual({ id: 'user-1', name: 'Demo Person', email: 'person@example.com' });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: 'person@example.com', password: 'secret-password' });
    await expect(signOut()).resolves.toBeUndefined();
  });
});
