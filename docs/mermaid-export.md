Mermaid Export

Mapping
- Nodes: `course_id` as node id; label includes `course_name` and optional badges (credits, level).
- Edges: use `A --> B`; never connect group/subgraph identifiers.
- Groups: exported as `subgraph` blocks by department/level/term.

Layout
- Direction: set via `graph LR` or `graph TD` per user preference.

Styling
- Classes for statuses: completed/failed/in_progress/planned/unknown.
- Optional theme overrides through Mermaid init config; match in-app colors when feasible.

Limitations
- Mermaid does not natively represent AND/OR groups; edges represent prerequisites but logical grouping is expressed in labels or documentation; primary logic remains in app.
