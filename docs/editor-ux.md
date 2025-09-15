Editor UX

Goals
- Fast, intuitive graph editing with guardrails preventing invalid states.
- Live eligibility highlighting driven by prerequisite expression evaluation.

Core Interactions
- Create node: drag from palette (course/group/note) or via hotkey.
- Edit node: click to open side panel; fields: title, credits, department, level, term, status, badges, notes.
- Create edge: start from source node; on drop, choose existing target or create a new course; cancel if unresolved.
- Delete: select + delete key (with confirm if edges would be orphaned).
- Grouping: containers that can collapse/expand; nodes show group membership.
- Layout: toolbar to toggle LR/TD, choose ELK/Dagre, and re-run auto-layout; manual drags are preserved as hints.
- Undo/redo: keyboard shortcuts; autosave debounced.

Eligibility & Status
- Status values: completed (✓), failed (✗), in_progress, planned, unknown.
- Unmet prerequisites gray out dependent nodes and their edges; tooltips list missing prereqs.
- Eligible next courses highlighted; badge counts credits per term/year.

Mermaid Panel
- Two-pane view: graph and Mermaid code.
- Edits to Mermaid are parsed and reflected in the graph with validation; errors surfaced inline.
- Export uses flowchart with subgraphs for groups; edges always between course nodes.

Accessibility
- Keyboard navigation: tab focus across nodes/edges, arrow key traversal, shortcuts listed in help.
- Focus visibility with high contrast; hit target ≥ 24×24 CSS px.
- Screen reader labels for nodes, edges, and controls; avoid color-only communication.

Internationalization
- All text routable through i18n; RTL-aware layout for Hebrew.
