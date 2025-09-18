import { useEffect, useMemo, useState } from 'react';

import { useGraph, type CourseStatus } from '../state/GraphContext';

import './Sidebar.css';

interface SidebarFormState {
  title: string;
  credits: string;
  department: string;
  level: string;
  term: string;
  status: CourseStatus;
  disabled: boolean;
}

const STATUS_OPTIONS: CourseStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'failed',
  'unknown',
];

const EMPTY_FORM: SidebarFormState = {
  title: '',
  credits: '0',
  department: '',
  level: '',
  term: '',
  status: 'planned',
  disabled: false,
};

export function Sidebar(): JSX.Element {
  const {
    nodes,
    selectedNodeId,
    updateNode,
    deleteNode,
    addNode,
    applyLayout,
  } = useGraph();

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [
    nodes,
    selectedNodeId,
  ]);

  const [form, setForm] = useState<SidebarFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!selectedNode) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      title: selectedNode.data.title,
      credits: String(selectedNode.data.credits ?? 0),
      department: selectedNode.data.department ?? '',
      level: selectedNode.data.level ?? '',
      term: selectedNode.data.term ?? '',
      status: selectedNode.data.status,
      disabled: selectedNode.data.disabled,
    });
  }, [selectedNode]);

  const handleChange = <K extends keyof SidebarFormState>(field: K, transform?: (value: string) => SidebarFormState[K]) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      const nextValue = transform ? transform(value) : (value as SidebarFormState[K]);
      setForm((current) => ({ ...current, [field]: nextValue }));
      if (selectedNode) {
        if (field === 'credits') {
          updateNode(selectedNode.id, { credits: Number(nextValue) });
        } else if (field === 'status') {
          updateNode(selectedNode.id, { status: nextValue as CourseStatus });
        } else {
          updateNode(selectedNode.id, { [field]: nextValue });
        }
      }
    };

  const handleToggleDisabled = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked;
    setForm((current) => ({ ...current, disabled: nextValue }));
    if (selectedNode) {
      updateNode(selectedNode.id, { disabled: nextValue });
    }
  };

  const handleAddCourse = () => {
    addNode();
    // focus will switch to new node via provider selection
  };

  const handleDelete = () => {
    if (!selectedNode) return;
    deleteNode(selectedNode.id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar__section sidebar__actions">
        <button type="button" onClick={handleAddCourse} className="sidebar__button">
          ➕ Add course
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="sidebar__button sidebar__button--danger"
          disabled={!selectedNode}
        >
          🗑 Remove selected
        </button>
        <button
          type="button"
          onClick={() => applyLayout()}
          className="sidebar__button sidebar__button--secondary"
        >
          Re-run layout
        </button>
      </div>

      {selectedNode ? (
        <form className="sidebar__form" onSubmit={(event) => event.preventDefault()}>
          <h2 className="sidebar__heading">Course details</h2>
          <div className="sidebar__field">
            <label htmlFor="course-id">Course ID</label>
            <input id="course-id" value={selectedNode.data.courseId} disabled />
          </div>
          <div className="sidebar__field">
            <label htmlFor="course-title">Title</label>
            <input
              id="course-title"
              value={form.title}
              onChange={handleChange('title')}
              placeholder="Course title"
            />
          </div>
          <div className="sidebar__field sidebar__field--inline">
            <div>
              <label htmlFor="course-credits">Credits</label>
              <input
                id="course-credits"
                type="number"
                min={0}
                value={form.credits}
                onChange={handleChange('credits')}
              />
            </div>
            <div>
              <label htmlFor="course-status">Status</label>
              <select
                id="course-status"
                value={form.status}
                onChange={handleChange('status')}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="sidebar__field">
            <label htmlFor="course-department">Department</label>
            <input
              id="course-department"
              value={form.department}
              onChange={handleChange('department')}
              placeholder="e.g. CS"
            />
          </div>
          <div className="sidebar__field sidebar__field--inline">
            <div>
              <label htmlFor="course-level">Level</label>
              <input
                id="course-level"
                value={form.level}
                onChange={handleChange('level')}
                placeholder="e.g. 200"
              />
            </div>
            <div>
              <label htmlFor="course-term">Term</label>
              <input
                id="course-term"
                value={form.term}
                onChange={handleChange('term')}
                placeholder="e.g. Fall"
              />
            </div>
          </div>
          <div className="sidebar__field sidebar__field--checkbox">
            <label htmlFor="course-disabled">
              <input
                id="course-disabled"
                type="checkbox"
                checked={form.disabled}
                onChange={handleToggleDisabled}
              />
              Exclude course from plan
            </label>
            <p className="sidebar__hint">
              Disabled courses remain in the catalog but are highlighted in red and treated as unmet
              prerequisites.
            </p>
          </div>
        </form>
      ) : (
        <div className="sidebar__empty">
          <h2>Select a course</h2>
          <p>
            Click any node in the graph to edit its details, or create a new course to expand the
            plan.
          </p>
          <ul>
            <li>Drag handles to create prerequisite links.</li>
            <li>Use the canvas controls to pan and zoom.</li>
            <li>Re-run layout if the graph becomes cluttered.</li>
          </ul>
        </div>
      )}
    </aside>
  );
}
