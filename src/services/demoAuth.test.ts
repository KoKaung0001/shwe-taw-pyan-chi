import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_STORAGE_KEY,
  authenticateDemoAccount,
  createDemoAccount,
  DemoAuthError,
} from './demoAuth';

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe('browser-local demo accounts', () => {
  it('normalizes email and persists a salted password hash, not the password', async () => {
    const storage = makeStorage();
    const account = await createDemoAccount({
      name: ' Demo Person ', email: ' Demo@Example.com ', password: 'local-password',
    }, storage);

    expect(account).toEqual({ name: 'Demo Person', email: 'demo@example.com' });
    const saved = storage.getItem(ACCOUNT_STORAGE_KEY) ?? '';
    expect(saved).not.toContain('local-password');
    expect(JSON.parse(saved)[0]).toMatchObject({ email: 'demo@example.com' });
    expect(JSON.parse(saved)[0].salt).toMatch(/^[\da-f]{32}$/);
  });

  it('rejects duplicate normalized email addresses', async () => {
    const storage = makeStorage();
    await createDemoAccount({ name: 'Demo', email: 'demo@example.com', password: 'password1' }, storage);
    await expect(createDemoAccount({
      name: 'Other', email: ' DEMO@example.com ', password: 'password2',
    }, storage)).rejects.toMatchObject({ code: 'email_taken' });
  });

  it('authenticates a saved account and rejects incorrect credentials', async () => {
    const storage = makeStorage();
    await createDemoAccount({ name: 'Demo', email: 'demo@example.com', password: 'password1' }, storage);
    await expect(authenticateDemoAccount({ email: 'DEMO@example.com', password: 'password1' }, storage))
      .resolves.toEqual({ name: 'Demo', email: 'demo@example.com' });
    await expect(authenticateDemoAccount({ email: 'demo@example.com', password: 'wrong-pass' }, storage))
      .rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(authenticateDemoAccount({ email: 'missing@example.com', password: 'password1' }, storage))
      .rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('reports browser storage failures without leaking implementation errors', async () => {
    const unavailable = {
      getItem: () => { throw new Error('private storage detail'); },
      setItem: () => { throw new Error('private storage detail'); },
    };
    await expect(createDemoAccount({
      name: 'Demo', email: 'demo@example.com', password: 'password1',
    }, unavailable)).rejects.toBeInstanceOf(DemoAuthError);
  });
});
