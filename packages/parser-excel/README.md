Excel/CSV Parser (packages/parser-excel)

Purpose
- Deterministic import from the provided template(s) into the graph model.

Algorithm
- Validate required columns; normalize values; parse expressions; build nodes/edges; emit diagnostics.

Interfaces
- parse(file|rows) → { graph, diagnostics }
- validate(graph) → { ok, issues[] }
