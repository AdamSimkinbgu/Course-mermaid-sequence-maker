Course DAG Builder

Web app + API to import, edit, and visualize course prerequisite graphs as interactive DAGs, with Excel-first import, server-backed persistence, and Mermaid export.

Quick links
- Concept: `build-idea.md`
- Architecture: `docs/architecture.md`
- API Spec: `docs/api/api.md`
- Data Model: `docs/data-model.md`
- Editor UX: `docs/editor-ux.md`
- Imports (Excel/PDF): `docs/imports.md`
- i18n & Accessibility: `docs/i18n-accessibility.md`
- Security: `docs/security.md`
- Roadmap: `docs/roadmap.md`
- Requirements: `requirements.md`
- Templates: `resources/templates/README.md`

Repo layout
- apps/web: React+TS client (interactive DAG editor)
- apps/api: Vercel Serverless Functions (Node/Express-style handlers)
- packages/*: shared libraries (core types, expression grammar, parsers)
- schema/: JSON schemas
- docs/: system design and ADRs
- resources/: sample data, templates
- db/: migrations and seed data

Getting started
- See `docs/dev-setup.md` for local development workflow and environment variables.
- Install workspace dependencies once: `npm install`
- Run the React editor locally: `npm run dev --workspace @course-dag/web`
- Type-check the monorepo: `npm run typecheck`
- smoke-test the Excel importer: `npm run test:smoke`
