# Requirements and Status

This document tracks functional and non-functional requirements, their status, and links to code and docs for traceability.

Status legend
- [ ] Planned
- [~] In Progress
- [x] Done
- [-] Deferred

MVP (Excel-first)
- Expression grammar and evaluation
  - [x] Parser: AND/OR precedence, parentheses, NONE; case-insensitive operators
    - Code: packages/expression/src/index.ts:1
  - [x] Position-aware errors (PrereqParserError)
    - Code: packages/expression/src/index.ts:1
  - [x] Evaluator: eligibility against completed/Status map
    - Code: packages/expression/src/index.ts:1
  - [x] Utilities: stringify, referenced IDs, ID validation
    - Code: packages/expression/src/index.ts:1
  - [ ] Grouping metadata from AST (groupingId for AND/OR edge groups)
  - [ ] Unit tests covering parser/evaluator and edge cases

- Deterministic CSV/Excel importer
  - [x] Schema validation (required columns, unique course_id)
    - Code: packages/parser-excel/src/index.ts:1
  - [x] Credits: decimals ≥ 0; 0 allowed
    - Code: packages/parser-excel/src/index.ts:1
  - [x] Parse `prereq_expression` → AST per grammar
    - Code: packages/parser-excel/src/index.ts:1
  - [x] Compile AST → edges (for visualization)
    - Code: packages/parser-excel/src/index.ts:1
  - [x] Diagnostics: unknown refs, cycle detection
    - Code: packages/parser-excel/src/index.ts:1
  - [ ] Validate output graph with JSON Schema
    - Schema: schema/graph.schema.json:1
  - [x] Smoke test script using template CSV
    - Script: scripts/smoke.mjs:1
    - Template: resources/templates/courses-template.csv:1

- Editor (React Flow + ELK/Dagre)
  - [ ] Web app scaffold (Vite/Next)
    - apps/web/README.md:1
  - [ ] Node/edge create, edit, delete
  - [ ] Notes on nodes/edges
  - [ ] Undo/redo and autosave
  - [ ] Group containers with collapse/expand
  - [ ] Layout toolbar (LR/TD, ELK/Dagre)
  - [ ] Status marking and eligibility highlighting
  - [ ] Theming and node badges
  - [ ] Mermaid code panel (editable, bidirectional)

- Persistence, sharing, and auth
  - [ ] API skeleton (Vercel serverless)
    - apps/api/README.md:1
  - [ ] DB schema and migrations (Postgres)
    - docs/data-model.md:1
    - db/migrations/.gitkeep:1
  - [ ] Project/Graph CRUD endpoints
  - [ ] Auth: email/password + OAuth
  - [ ] RBAC: viewer, editor, owner
  - [ ] Shareable links (capabilities + expiry)
  - [ ] Local JSON export/import

- Exporters
  - [ ] Mermaid generator (flowchart + subgraphs; edges connect nodes only)
  - [ ] SVG/PNG export
  - [ ] Excel round-trip export
  - [ ] JSON export

- i18n and accessibility
  - [ ] English + Hebrew with RTL
    - docs/i18n-accessibility.md:1
  - [ ] WCAG 2.2 AA: keyboard, focus, contrast, 24×24px targets

Phase 1 (Editor depth)
- [ ] Advanced grouping and collapsible containers
- [ ] Eligibility performance tuning
- [ ] Mermaid bidirectional editing polish

Phase 2 (PDF ingestion)
- [ ] OCR default local (Tesseract.js); opt-in cloud OCR
  - docs/adr/0002-ocr-default.md:1
- [ ] Structure extraction (heuristics/NER)
- [ ] AI-assisted transform to expression grammar with review UI
- [ ] Tests with resources/pdftesting
  - resources/pdftesting/.gitkeep:1

Non-functional and ops
- [x] Project scaffolding and docs
  - README.md:1
  - docs/architecture.md:1
  - docs/api/api.md:1
  - docs/mermaid-export.md:1
  - docs/roadmap.md:1
  - docs/security.md:1
- [x] Templates
  - resources/templates/README.md:1
  - resources/templates/courses-template.csv:1
  - resources/templates/courses-template.xls.xml:1
- [x] JSON schema stub
  - schema/graph.schema.json:1
- [x] Workspace toolchain (workspaces, tsconfig, paths)
  - package.json:1
  - tsconfig.base.json:1
  - tsconfig.all.json:1
- [ ] Testing harness (unit/integration runner and sample tests)
- [ ] CI pipeline (typecheck, build, smoke)
- [-] Telemetry (opt-in performance metrics, no PII)
- [-] Backups and soft-delete policies

Traceability
- Problem/approach/requirements: build-idea.md:1
- Architecture: docs/architecture.md:1
- Data model: docs/data-model.md:1
- Imports: docs/imports.md:1
- ADRs: docs/adr/0001-diagram-renderer.md:1, docs/adr/0002-ocr-default.md:1

Next actions
- Implement groupingId emission from AST in importer output
- Add JSON Schema validation to importer/smoke test
- Add unit tests for expression parser and importer
- Open PR: feature/expression-excel-import → dev
