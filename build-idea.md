<idea>
Build a web app and API that ingests course catalogs (Excel/CSV first; PDF later) and produces a prerequisite Directed Acyclic Graph (DAG) rendered as a live, editable diagram. Users can create graphs from scratch, edit nodes/edges with undo/redo and autosave, color/group by department/level/term, and track completion status and credit-weighted averages. Charts are saved server-side with optional local export/import, and shareable permalinks enforce viewer/editor/owner roles. The app also exports Mermaid code and other formats.
</idea>

<problem>
Universities present prerequisites inconsistently across PDFs and websites, making it hard for students and advisors to plan studies, validate prerequisite satisfaction, and visualize optimal paths. Existing tools either require heavy manual setup, lack AND/OR prerequisite logic, or do not support editing, live progress tracking, and shareable links with permissions. PDF variability and scanned documents complicate extraction, while students still need a dependable manual editor and an easy Excel on-ramp.
</problem>

<approach>
- Product strategy: deliver in phases for reliability and learning value.
  - MVP: rock-solid Excel/CSV import + manual editor + rendering + persistence + export.
  - Phase 1: rich editing UX, theming, roles/permissions, shareable links, i18n (EN/HE).
  - Phase 2: PDF ingestion with OCR + AI-assisted structuring; integrate with the same DAG model.

- Diagram tech choice:
  - Primary renderer: React Flow (with Dagre/ELK layout). Rationale: Purpose-built for node/edge editors, performant, supports drag-and-drop, custom nodes, grouping, collapsible containers, and live styling. Mermaid is excellent for code-first diagrams but less suited to interactive graph editing. We will still generate Mermaid code for export/edit, but render/edit in React Flow.
  - Layout engine: ELK.js (preferred for layered DAGs) with fall-back to Dagre for faster, simpler layouts. Allow users to switch LR/TD layout.
  - Exports: Mermaid (flowchart graph), SVG/PNG, JSON, and Excel round-trip.
  - Mermaid export semantics: edges always connect course nodes (never entire groups); groups are exported as subgraphs for structure only.

- Data model & rules:
  - Graph is a DAG of Course nodes (id, name, credits/points, status) and directed edges encoding prerequisite logic.
  - AND/OR prerequisites stored as expressions; compiled into edges + edge groups for rendering/validation.
  - Validation detects cycles, missing references, orphan nodes, unreachable targets.
  - Status propagation grays out unmet nodes and incoming/outgoing edges; completed courses show a green tick; failed/incomplete show a red cross; downstream nodes/edges gray until prereqs satisfied.
  - Credit averages computed overall, per year, and per semester (supporting 2+ semesters + optional summer).
  - Terms configurable per project (defaults provided, e.g., 2+ semesters and optional summer).

- Parsing pipelines:
  - Excel/CSV (deterministic): single-sheet schema with explicit prerequisite expression. Robust field validation with actionable errors. Downloadable template provided.
  - PDF (variable + scanned): OCR layer defaults to local Tesseract.js (on-device) with opt-in to hosted OCR; rule-based extraction for structured parts + AI-assisted parsing for free-form prerequisite text to our expression grammar. Human-in-the-loop editor remains first-class.

- Persistence & sharing:
  - Server-backed storage (Postgres) for projects, graphs, versions, and role-based access. Optional local JSON export/import.
  - Shareable permalinks with capabilities: viewer/editor/owner roles enforced server-side.
  - Privacy: default to on-device processing for rendering and Excel import; PDF AI parsing opt-in and clearly labeled.

- AuthN/AuthZ:
  - Email/password and OAuth (Google/Microsoft). Roles: viewer, editor, owner. Invite by email, link-based access with scoping.

- Accessibility & i18n:
  - WCAG 2.2 AA: color contrast, keyboard operability, focus visibility, reduced motion, target size minimum 24×24 CSS px (2.5.8 AA), navigable graph via keyboard. Support RTL for Hebrew and localized strings/dates/numbers.

- Deployment:
  - Frontend: React + TypeScript deployed statically on Vercel.
  - API: Node.js (Express-style) as Vercel Serverless Functions. Postgres via a serverless-friendly driver/pool.

- Risk management:
  - PDF variability: defer to Phase 2 with explicit user confirmation and editor fallback.
  - AND/OR semantics: adopt a clear, user-editable expression grammar with validation and UI helpers.
  - Performance: virtualized graph rendering and layout caching; limit initial render to ~200 nodes.
</approach>

<requirements>
Functional
1) Graph creation & editing
   - Create from scratch or import Excel/CSV.
   - Drag-and-drop node creation from a palette (course, group/container, note).
   - Add edges by starting from an existing node; target must be an existing node or a new node immediately created—otherwise cancel.
   - Attach notes to nodes and edges.
   - Undo/redo and autosave.
   - Group by department/level/term; support collapsible groups (containers).
   - Live layout with direction toggle (LR/TD) and layout engine choice (ELK/Dagre).
   - Status marking per course: completed, in-progress, planned, failed; unmet prerequisites gray out dependent nodes/edges; completed shows green tick; failed shows red cross.
   - Custom themes and node badges (e.g., credits, level).

2) Prerequisite logic
   - Support AND/OR prerequisites via an expression grammar.
   - Validation of expressions and detection of cycles, missing references, or unreachable nodes.
   - Real-time eligibility highlighting based on current statuses.

3) Import/Export
   - Excel/CSV import using a deterministic schema with validation and helpful errors.
   - PDF import (Phase 2): OCR + AI-assisted parsing; user confirms parsed data before save.
   - Export: Mermaid code, SVG/PNG image, JSON of graph, Excel round-trip (template-compatible).
   - Editable Mermaid pane for power users; sync changes back to graph with validation.

4) Persistence & sharing
   - Server-backed storage of projects and graphs in Postgres.
   - Local export/import (JSON file) for offline portability.
   - Shareable permalinks with roles: viewer, editor, owner. Invite flow and link scopes.

5) Accounts & security
   - Email/password + OAuth (Google, Microsoft).
   - Secure session handling (httpOnly cookies), CSRF protection for mutations.
   - Project-level ACLs enforced on all API routes.

6) Analytics & metrics (minimal)
   - Opt-in local metrics (e.g., render time) for performance tuning; no PII sent by default.

Non-Functional
7) Performance
   - Smooth interaction for up to 200 courses (~200 nodes, ~400–800 edges). Layout under 1s for typical catalogs; cache layout and allow manual tweaks.
   - Graph rendering virtualized; offscreen computation where feasible.

8) Accessibility
   - WCAG 2.2 AA: contrast ≥ 4.5:1; keyboard operable editor; visible focus; skip-to-content; target size ≥ 24×24 CSS px; tooltips not required for comprehension; error messages accessible.

9) Privacy
   - Local processing for Excel import and rendering; PDF AI parsing opt-in with clear disclosure; data stored minimally on server; encryption at rest and in transit.

10) Internationalization
   - English and Hebrew; runtime language switch; RTL-aware layout and typography; localizable strings.

11) Deployment
   - Vercel static hosting for frontend; Vercel Serverless Functions for API; Postgres (e.g., Neon/Supabase) with pooled connections; CI checks for type, lint, build.

12) Testing
   - Unit tests for parsers, expression evaluator, validators.
   - Integration tests for API and permission enforcement.
   - Visual/interaction tests for editor’s critical flows.

Data Model (initial)
- User: id, email, auth_provider, display_name, locale, created_at.
- Project: id, owner_id, name, description, created_at, updated_at.
- Membership: user_id, project_id, role (viewer|editor|owner).
- Graph: id, project_id, version, layout_prefs, theme, created_at, updated_at.
- CourseNode: id (stable course_id), graph_id, title, credits (decimal ≥ 0), department, level, term, status, badges, notes.
- Edge: id, graph_id, source_id, target_id, label, notes, grouping_id (for AND/OR evaluation groups), metadata.
- PrereqExpression: graph_id, course_id, expression (string in grammar), normalized_ast (JSON), validation_state.
- ShareLink: id, graph_id, capability (viewer|editor), token, expires_at.
 - JSON Schema stub: `schema/graph.schema.json`.

Excel/CSV Template (single sheet)
- Columns: course_id, course_name, credits, department, level, term, prereq_expression
- prereq_expression grammar (proposed):
  - Tokens: COURSE_ID (e.g., MATH101), AND, OR, parentheses ().
  - Examples: "MATH101", "MATH101 AND MATH102", "(MATH101 AND MATH102) OR PHYS100".
  - For courses with no prerequisites, use: NONE.
  - Parser returns a normalized AST for validation and rendering.
  - Credits column accepts decimal numbers ≥ 0 (e.g., 3, 4.5; 0 allowed).
  - Downloadable templates in repo: `resources/templates/courses-template.csv` and `resources/templates/courses-template.xls.xml` (SpreadsheetML, openable in Excel and savable as .xlsx).

API (initial REST surface)
- POST /api/projects → create project
- GET  /api/projects/:id → get project
- POST /api/projects/:id/invite → invite member (role)
- GET  /api/projects/:id/graphs → list graphs
- POST /api/projects/:id/graphs → create graph
- GET  /api/graphs/:id → get graph (nodes, edges, expressions, prefs)
- PUT  /api/graphs/:id → update graph
- POST /api/graphs/:id/export → export format=mermaid|svg|png|json|excel
- POST /api/import/excel → validate + return parsed model (client may also parse locally; server path for server-backed saves)
- POST /api/import/pdf → start PDF parse job (Phase 2); returns job id + status
- GET  /api/share/:token → access graph by capability
- Auth routes for email/password + OAuth

PDF Ingestion (Phase 2)
- OCR: Default to Tesseract.js (on-device); optional hosted OCR (e.g., Google Vision, AWS Textract) via explicit opt-in.
- Structure extraction: heuristics for tabular/course blocks; NER for course codes/names; line grouping for prerequisites.
- AI-assisted parsing: transform extracted prerequisite text to our expression grammar; highlight ambiguities for user review.
- Human-in-the-loop: show a diff viewer; user accepts/corrects before persisting.

Editor UX Highlights
- Palette with course, group/container, and note tools.
- Drag to create; click to edit; keyboard shortcuts for undo/redo, connect edge, delete.
- Edge creation wizard to pick/confirm target or create a new course node inline; cancel if unresolved.
- Group containers support collapse/expand; color by department/level/term.
- Status toggle with visual cues (green tick, red cross, gray disabled paths) and eligibility previews.
- Layout toolbar for LR/TD and ELK/Dagre selection; auto-layout with manual nudge preservation.
- Theming and CSS variables; downloadable/shareable themes.
- Mermaid code panel with live parse/preview; syntax errors highlighted with suggested fixes.

Security & Compliance
- Store minimal PII; hash passwords (Argon2id); rate-limit auth endpoints; audit trail on permission changes.
- CSRF tokens on state-changing routes; httpOnly+SameSite cookies; JWT only for share tokens if needed.
- Encryption at rest/in transit; backups and soft-deletes for recovery.

Decisions
- Excel schema: Use `prereq_expression` for AND/OR; optionally accept `prereq_course_id_list` (semicolon-separated) as AND-only when present.
- Credits/points: Decimal points ≥ 0; 0 is valid.
- Terms: Configurable per project (default presets include 2+ semesters and optional summer).
- OCR/AI: Default to on-device Tesseract.js; opt-in cloud OCR/AI available.
- Mermaid export: Flowchart with subgraphs for groups; edges connect course nodes only (never groups).
- Accessibility: Target WCAG 2.2 AA including Target Size (Minimum) 2.5.8 at 24×24 CSS px; no specific screen reader mandate.

Roadmap
- MVP (Excel-first)
  1. Expression grammar + parser + validator
  2. Excel/CSV template + importer (client + server validation)
  3. React Flow editor with ELK layout, groups, statuses, undo/redo, autosave
  4. Persistence (projects, graphs, roles) + shareable links
  5. Export (Mermaid/SVG/PNG/JSON/Excel) and theming
  6. i18n (EN/HE) and RTL support

- Phase 1 (Editor depth)
  1. Advanced grouping and collapsible containers
  2. Live eligibility highlighting + performance tuning
  3. Mermaid bidirectional editing polish

- Phase 2 (PDF)
  1. OCR + structure extraction pipeline
  2. AI-assisted prerequisite parsing with review UI
  3. Dataset tests with `resources/pdftesting`

</requirements>
