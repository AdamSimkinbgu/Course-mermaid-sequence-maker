Dev Setup

Prerequisites
- Node.js 18+ (recommend 20+)
- npm (repo currently uses an npm lockfile)
- Postgres (optional for now; required once the API layer is implemented)

Monorepo layout
- `apps/web`: React + TypeScript client (Vite) with the interactive DAG editor.
- `apps/api`: Vercel serverless functions (skeleton – persistence not yet implemented).
- `packages/*`: shared libraries (core types, expression grammar, Excel importer).

Environment
- Create `.env` files per app as needed. Suggested variables:
  - API (future): `DATABASE_URL`, `SESSION_SECRET`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`.
  - WEB: `VITE_API_BASE_URL` when the API is available; not required for the local sample graph.

TypeScript path aliases
- Imports like `@course-dag/core` resolve via `tsconfig.base.json` paths to `packages/*/src`.
- Ensure your editor uses the workspace TypeScript version and reads the root tsconfig.

Local development
- Install dependencies: `npm install`
- Run the React editor: `npm run dev --workspace @course-dag/web`
- Type-check everything: `npm run typecheck`
- Smoke-test the importer: `npm run test:smoke`

Vercel
- Create two Vercel projects or use monorepo routing:
  - Project A → `apps/web`
  - Project B → `apps/api`
- Configure environment variables in Vercel dashboard.
