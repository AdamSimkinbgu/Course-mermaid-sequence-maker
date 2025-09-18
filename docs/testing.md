Testing Strategy

Unit
- Expression parser/evaluator: grammar parsing, AST validation, eligibility.
- Excel importer: schema validation, error cases, mapping to nodes/edges.
- Utilities: layout helpers, ID normalization.

Integration
- API routes: auth flows, RBAC enforcement, CRUD for graphs/projects.
- Exporters: Mermaid/JSON/SVG generate valid outputs for sample graphs.

End-to-End (select flows)
- Import Excel → Edit graph → Save → Export Mermaid.
- Share link access with viewer/editor capabilities.

Fixtures
- `resources/templates` for deterministic import tests.
- `resources/pdftesting` (Phase 2) for OCR/AI pipeline validation.

Commands
- `npm run typecheck` – runs TypeScript on every workspace (web + packages).
- `npm run test` – executes importer/unit suites across workspaces.
- `npm run test:smoke` – rebuilds packages and ensures the template CSV imports without diagnostics.
