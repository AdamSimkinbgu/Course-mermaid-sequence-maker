Imports

Excel/CSV (Deterministic)
- Input: single sheet with columns `course_id, course_name, credits, department, level, term, prereq_expression`.
- Grammar: COURSE_ID tokens, AND, OR, parentheses; NONE for no prereqs.
- EBNF (initial):
  - Expression := Term { OR Term }
  - Term       := Factor { AND Factor }
  - Factor     := COURSE_ID | NONE | '(' Expression ')'
  - Operators are case-insensitive; AND precedence > OR.
- Algorithm:
  1. Parse rows, trim/normalize IDs; validate credits ≥ 0.
  2. Validate uniqueness of course_id.
  3. Parse `prereq_expression` → AST; ensure referenced IDs exist or will exist.
  4. Build nodes/edges from AST; detect cycles; produce diagnostics.
  5. Preview; on accept, persist to API.

CSV edge cases
- Quoting rules for expressions with spaces and parentheses.
- Locale decimal separators: enforce dot decimal.

PDF (Phase 2)
- OCR: Tesseract.js on-device by default; optional cloud OCR with user opt-in.
- Extraction: detect course blocks (regex/NER for course codes), collect names/titles, and prerequisite lines.
- Transformation: AI-assisted mapping of prerequisite text to grammar; confidence scoring with human review.
- Review UI: side-by-side PDF text vs parsed model; edits applied inline before save.
