Templates

- CSV template: `resources/templates/courses-template.csv`
- Excel template (SpreadsheetML 2003 XML): `resources/templates/courses-template.xls.xml`
  - Open directly in Excel and “Save As” .xlsx if preferred.

Columns
- course_id: string identifier (e.g., CS101). Must be unique per sheet.
- course_name: human-readable title.
- credits: decimal number ≥ 0 (e.g., 3, 4.5; 0 allowed).
- department: free-form string (e.g., CS, MATH).
- level: string or integer (e.g., 100, 200).
- term: project-defined label (e.g., Y1-S1, Y1-S2, Summer).
- prereq_expression: expression grammar using COURSE_ID tokens, AND/OR, and parentheses.

Prerequisite grammar
- Allowed: COURSE_ID, AND, OR, parentheses ().
- Examples:
  - NONE
  - CS101
  - CS101 AND MATH101
  - (CS102 AND MATH101) OR PHYS100

Notes
- Use NONE for courses with no prerequisites.
- Terms are configurable per project; values here are examples.
- Excel and CSV imports validate the schema and produce actionable error messages.
