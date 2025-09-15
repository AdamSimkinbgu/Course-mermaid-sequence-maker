API (apps/api)

Purpose
- Vercel Serverless Functions implementing the REST API for projects, graphs, roles, imports, and exports.

Structure (Vercel)
- api/
  - auth/
  - projects/
  - graphs/
  - import/
  - share/
  - utils/

Notes
- Each file under `api/` exports a default handler.
- Use serverless-friendly Postgres client.
- Enforce RBAC on every request.
