Expression Grammar (packages/expression)

Purpose
- Define and implement the prerequisite expression grammar and evaluator.

Grammar
- Tokens: COURSE_ID, AND, OR, parentheses ().
- Examples: NONE; CS101; CS101 AND MATH101; (CS102 AND MATH101) OR PHYS100.

Deliverables
- Parser → AST
- AST validator (references, cycles via graph mapping)
- Evaluator (given set of completed/failed courses)
