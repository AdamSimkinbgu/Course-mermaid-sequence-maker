ADR 0001: Diagram Renderer Choice

Context
- Need interactive graph editing (drag/drop, custom nodes, grouping, live layout) with up to ~200 nodes.

Decision
- Use React Flow for rendering/editing with ELK.js as the primary layout engine (Dagre as fallback).
- Provide Mermaid generation for export and an editable code panel for power users.

Consequences
- Rich, performant editor UX; decoupled from Mermaid limitations.
- Additional work to keep Mermaid export/import in sync, but manageable with a mapping layer.
