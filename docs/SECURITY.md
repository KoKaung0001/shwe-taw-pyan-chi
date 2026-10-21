# Security boundaries

M0 has no data entry, persistence, uploads, secrets, external services or analytics. Dependencies are locked; CI audits high-severity advisories. Static assets and fonts are local. Production CSP is in index.html; frame embedding restrictions require host response headers (`frame-ancestors 'none'`) because meta CSP cannot enforce that directive. Configure those at deployment; no deployment is part of M0.

The prototype validates inputs and persisted data, keeps images local with revoked object URLs, renders untrusted text as text, recovers visibly from storage errors, and does not log financial data. M4 validates JPEG/PNG/WebP type, non-empty size and a 5 MB maximum before previewing with an object URL; the URL is revoked on replacement/unmount and image bytes never leave the browser or enter persistence. Only synthetic records are allowed.

Production is out of scope. Before real data: OIDC/MFA, per-user isolation, encrypted transit/storage, secret vault, audit trails, rate limits, upload scanning, backups, retention/deletion, prompt-injection defenses with vetted read-only tools, and qualified review of applicable Myanmar financial/privacy requirements.
