Dev Setup

Prerequisites
- Node.js 18+ (recommend 20+)
- pnpm or npm (no lockfile committed yet)
- Postgres (local or cloud)

Monorepo layout
- apps/web: React + TS client (Vite/Next TBD)
- apps/api: Vercel serverless functions (deploy as separate project)
- packages/*: shared libs (core, expression, parsers)

Environment
- Create `.env` files per app as needed. Suggested variables:
  - API: `DATABASE_URL`, `SESSION_SECRET`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`.
  - WEB: `VITE_API_BASE_URL` or use same origin in production.

TypeScript path aliases
- Imports like `@course-dag/core` resolve via `tsconfig.base.json` paths to `packages/*/src`.
- Ensure your editor uses the workspace TypeScript version and reads the root tsconfig.

Local development
- Install deps and run dev servers once scaffolding is added.
- For now, review docs and templates; implementation will add runnable scripts.

Vercel
- Create two Vercel projects or use monorepo routing:
  - Project A → `apps/web`
  - Project B → `apps/api`
- Configure environment variables in Vercel dashboard.
