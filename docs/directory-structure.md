Directory Structure

- apps/
  - web/: React + TS client (editor)
    - src/: application source (components, hooks, state)
  - api/: Vercel serverless API
    - api/: serverless function entrypoints (per-file handlers)

- packages/
  - core/: shared types, utilities, JSON-schema validation wrappers
  - expression/: prerequisite grammar, parser, AST, evaluator
  - parser-excel/: deterministic Excel/CSV importer
  - parser-pdf/: OCR + extraction + AI-assisted parsing pipeline (Phase 2)

- schema/
  - graph.schema.json: Graph JSON schema (nodes, edges, expressions)

- docs/: system design, ADRs, specs
  - adr/: Architecture Decision Records

- resources/
  - templates/: Excel/CSV templates
  - pdftesting/: sample PDFs for Phase 2 parsing tests

- db/
  - migrations/: SQL migrations

- build-idea.md: product idea, problem, approach, requirements
- research.md: notes and references
