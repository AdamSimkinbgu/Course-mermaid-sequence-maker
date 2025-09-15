API Specification (Initial)

Auth
- POST /api/auth/register: create account (email/password)
- POST /api/auth/login: start session
- POST /api/auth/logout: end session
- GET  /api/auth/me: current user
- OAuth callbacks: /api/auth/oauth/:provider

Projects
- POST /api/projects: { name, description } → { project }
- GET  /api/projects/:id → { project }
- POST /api/projects/:id/invite: { email, role } → { invite }
- GET  /api/projects/:id/members → { members }

Graphs
- GET  /api/projects/:id/graphs → { graphs }
- POST /api/projects/:id/graphs: { name, payload } → { graph }
- GET  /api/graphs/:id → { graph, nodes, edges, prereqExpressions, prefs }
- PUT  /api/graphs/:id: { diff or full payload } → { graph }
- DELETE /api/graphs/:id → 204

Share Links
- POST /api/graphs/:id/share: { capability, expiresAt? } → { token, url }
- GET  /api/share/:token → { graph } (capability enforced)

Import/Export
- POST /api/import/excel: file upload or JSON payload → { parsedGraph, diagnostics }
- POST /api/import/pdf: file upload → { jobId, status } (Phase 2)
- GET  /api/import/pdf/:jobId → { status, result? }
- POST /api/graphs/:id/export: { format } → stream/file (mermaid|svg|png|json|excel)

Conventions
- Auth: httpOnly cookies for session. CSRF tokens on state-changing routes.
- Errors: JSON with `code`, `message`, `details`.
- RBAC: viewer|editor|owner enforced per project/graph.

Payloads (selected)
- Graph
  - id: string
  - projectId: string
  - version: number
  - layoutPrefs: { direction: "LR"|"TD", engine: "ELK"|"Dagre" }
  - nodes: Array<Node>
  - edges: Array<Edge>
  - prereqExpressions: Array<PrereqExpression>

- Node
  - id: string (course_id)
  - nodeType: "course"|"group"|"note"
  - title: string
  - credits: number >= 0
  - department?: string
  - level?: string|number
  - term?: string
  - status: "completed"|"in_progress"|"planned"|"failed"|"unknown"
  - badges?: string[]
  - notes?: string
  - groupId?: string

- Edge
  - id: string
  - source: string (course_id)
  - target: string (course_id)
  - label?: string
  - notes?: string
  - groupingId?: string (AND-group, OR-group)

- PrereqExpression
  - courseId: string
  - expression: string (grammar)
  - normalizedAst?: object
  - validationState?: "valid"|"invalid"|"ambiguous"

Notes
- See `schema/graph.schema.json` for validation.
- Export Mermaid flowcharts use subgraphs for groups; edges target course nodes only.
