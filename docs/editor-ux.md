Editor UX

Goals (current milestone)
- Provide a fast, legible way to explore prerequisite DAGs imported from Excel.
- Surface eligibility and status at a glance through color and badges.
- Keep the UI keyboard-friendly and themeable (light/dark).

Current capabilities
- **Sample graph loading** – the editor boots with a curated dataset produced by the Excel importer; persistence/API wiring is still pending.
- **Course editor sidebar** – editing fields (title, credits, department, level, term, status, grade, notes) instantly updates the graph. Grades auto-map to statuses and “Exclude course from plan” visually flags nodes without destroying their original status.
- **Edge inspector** – selecting an edge opens a notes panel so prerequisite relationships can be annotated.
- **Layout controls** – toolbar lets users re-run Dagre, switch between left→right and top→down orientation, toggle the detail sidebar, add placeholder courses, and change between light and dark themes.
- **Eligibility highlighting** – prerequisite expressions are parsed/evaluated on the client; nodes derive class names (planned, in-progress, completed, blocked, failed/excluded). Selecting a course highlights its prerequisite path.
- **Node spacing** – nodes repel each other to maintain a minimal gap and keep edges visible.
- **Smooth edges** – `SmoothStep` edges bend around nodes to avoid visual overlap.

Not yet implemented (planned)
- Drag palette / bulk creation tools.
- Group containers with collapse/expand.
- Undo/redo history and autosave to persistence layer.
- Live Mermaid panel and exporter tooling.
- Server-backed projects, sharing, and authentication flows.

Accessibility & theming
- Light/dark themes driven by CSS custom properties; toolbar toggle persists the selection.
- Handles and controls remain keyboard focusable (React Flow defaults). Further WCAG audits will be scheduled once grouping & persistence land.

Internationalization
- All strings in the editor shell are routed through a simple translation helper (full EN/HE catalog to be completed alongside i18n milestone).
