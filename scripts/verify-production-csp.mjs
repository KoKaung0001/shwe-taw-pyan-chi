import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(
  new URL('../dist/index.html', import.meta.url),
  'utf8',
);
const policy = html.match(
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
)?.[1];

assert.ok(policy, 'Built index.html must include a Content Security Policy.');
for (const directive of [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]) {
  assert.ok(
    policy.includes(directive),
    `Production CSP must include ${directive}.`,
  );
}
assert.ok(
  !/\b(?:ws|wss):\/\//i.test(policy),
  'Production CSP must not allow WebSockets.',
);
assert.ok(
  !/style-src[^;]*'unsafe-inline'/i.test(policy),
  'Production CSP must not permit inline styles.',
);
assert.ok(
  !/script-src[^;]*'unsafe-(?:inline|eval)'/i.test(policy),
  'Production CSP must not permit inline or evaluated scripts.',
);

process.stdout.write('Production CSP includes the required restrictions.\n');
