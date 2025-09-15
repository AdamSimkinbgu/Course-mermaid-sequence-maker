Data Model (Postgres)

Entities
- users
  - id (uuid, pk)
  - email (citext, unique)
  - password_hash (text, nullable for OAuth)
  - auth_provider (text)
  - display_name (text)
  - locale (text)
  - created_at (timestamptz, default now())

- projects
  - id (uuid, pk)
  - owner_id (uuid fk → users.id)
  - name (text)
  - description (text)
  - term_config (jsonb)  -- configurable terms per project
  - created_at, updated_at (timestamptz)

- memberships
  - user_id (uuid fk)
  - project_id (uuid fk)
  - role (text check in ['viewer','editor','owner'])
  - primary key (user_id, project_id)

- graphs
  - id (uuid, pk)
  - project_id (uuid fk)
  - name (text)
  - version (int)
  - layout_prefs (jsonb)
  - theme (jsonb)
  - created_at, updated_at

- course_nodes
  - id (text, pk)  -- stable course_id
  - graph_id (uuid fk)
  - title (text)
  - credits (numeric) check (credits >= 0)
  - department (text)
  - level (text)
  - term (text)
  - status (text check in ['completed','in_progress','planned','failed','unknown'])
  - badges (jsonb)
  - notes (text)
  - group_id (text)

- edges
  - id (uuid, pk)
  - graph_id (uuid fk)
  - source_id (text)
  - target_id (text)
  - label (text)
  - notes (text)
  - grouping_id (text)
  - metadata (jsonb)

- prereq_expressions
  - graph_id (uuid fk)
  - course_id (text)
  - expression (text)
  - normalized_ast (jsonb)
  - validation_state (text check in ['valid','invalid','ambiguous'])
  - primary key (graph_id, course_id)

- share_links
  - id (uuid, pk)
  - graph_id (uuid fk)
  - capability (text check in ['viewer','editor'])
  - token (text unique)
  - expires_at (timestamptz)

Indexes
- memberships (project_id, user_id)
- course_nodes (graph_id, id)
- edges (graph_id, source_id), (graph_id, target_id)
- prereq_expressions (graph_id, course_id)

Notes
- All writes occur under RBAC checks.
- Soft deletes can be added later via deleted_at columns.
