Vercel Deployment

Projects
- Web (static): points to `apps/web`. Build: framework/tooling TBD (Vite or Next). Output directory: `dist`.
- API (serverless): points to `apps/api`. Serverless functions live under `api/`.

Environment
- Set Postgres `DATABASE_URL` and session/OAuth secrets for the API project.
- Set `NEXT_PUBLIC_*` or `VITE_*` runtime env as needed for Web.

Routing
- Web serves frontend. API functions served at `/api/*` on the API project domain.
- For a single domain, configure rewrites/proxies or host API under a subdomain.

Notes
- Avoid long-running connections in serverless; use serverless-friendly Postgres drivers.
