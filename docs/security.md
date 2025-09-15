Security

AuthN
- Email/password with Argon2id hashing.
- OAuth (Google/Microsoft) storing provider id; no password_hash for OAuth-only.
- Sessions via httpOnly, SameSite cookies; short-lived session id + server-side store.

AuthZ
- Roles at project: viewer, editor, owner.
- RBAC enforced on every API route; row-level checks for project_id/graph_id.
- Share links issue capability tokens (viewer/editor) with expiry.

Web Security
- CSRF tokens on state-changing requests.
- CORS locked to app origin; preflight for credentials.
- Input validation on all parameters and payloads.
- Rate limiting and bot protection on auth endpoints.

Data Protection
- TLS in transit; encryption at rest by provider.
- Minimal PII; audit log for permission changes.
- Backups and soft-delete strategies.
