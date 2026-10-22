const ACCOUNT_STORAGE_KEY = 'fintech-companion-local-accounts-v1';
const PBKDF2_ITERATIONS = 210_000;

export interface DemoUser {
  name: string;
  email: string;
}

interface StoredDemoAccount extends DemoUser {
  salt: string;
  passwordHash: string;
}

export type DemoAuthErrorCode = 'email_taken' | 'invalid_credentials' | 'unavailable';

export class DemoAuthError extends Error {
  constructor(readonly code: DemoAuthErrorCode) {
    super(code);
    this.name = 'DemoAuthError';
  }
}

type AuthStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getStorage(): AuthStorage {
  if (typeof window === 'undefined') throw new DemoAuthError('unavailable');
  try {
    return window.localStorage;
  } catch {
    throw new DemoAuthError('unavailable');
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string) {
  if (hex.length % 2 !== 0 || !/^[\da-f]*$/i.test(hex)) throw new DemoAuthError('unavailable');
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function readAccounts(storage: AuthStorage): StoredDemoAccount[] {
  try {
    const raw = storage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.some((account) =>
      !account || typeof account.name !== 'string' || typeof account.email !== 'string' ||
      typeof account.salt !== 'string' || typeof account.passwordHash !== 'string'
    )) throw new Error('Invalid account registry');
    return value as StoredDemoAccount[];
  } catch {
    throw new DemoAuthError('unavailable');
  }
}

async function hashPassword(password: string, salt: Uint8Array) {
  try {
    const saltBuffer = new ArrayBuffer(salt.byteLength);
    new Uint8Array(saltBuffer).set(salt);
    const key = await window.crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
    );
    const digest = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2', salt: new Uint8Array(saltBuffer), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256',
    }, key, 256);
    return bytesToHex(new Uint8Array(digest));
  } catch {
    throw new DemoAuthError('unavailable');
  }
}

function normalizedEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

export async function createDemoAccount(
  input: { name: string; email: string; password: string },
  storage: AuthStorage = getStorage(),
): Promise<DemoUser> {
  const accounts = readAccounts(storage);
  const email = normalizedEmail(input.email);
  if (accounts.some((account) => account.email === email)) throw new DemoAuthError('email_taken');
  let salt: Uint8Array;
  try {
    salt = window.crypto.getRandomValues(new Uint8Array(16));
  } catch {
    throw new DemoAuthError('unavailable');
  }
  const passwordHash = await hashPassword(input.password, salt);
  const user = { name: input.name.trim(), email };
  try {
    storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify([
      ...accounts,
      { ...user, salt: bytesToHex(salt), passwordHash },
    ]));
  } catch {
    throw new DemoAuthError('unavailable');
  }
  return user;
}

export async function authenticateDemoAccount(
  input: { email: string; password: string },
  storage: AuthStorage = getStorage(),
): Promise<DemoUser> {
  const accounts = readAccounts(storage);
  const email = normalizedEmail(input.email);
  const account = accounts.find((candidate) => candidate.email === email);
  if (!account) throw new DemoAuthError('invalid_credentials');
  const passwordHash = await hashPassword(input.password, hexToBytes(account.salt));
  if (passwordHash !== account.passwordHash) throw new DemoAuthError('invalid_credentials');
  return { name: account.name, email: account.email };
}

export { ACCOUNT_STORAGE_KEY };
