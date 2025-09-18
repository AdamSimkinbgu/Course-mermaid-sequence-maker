import { useGraph } from '../state/GraphContext';

import './Toolbar.css';

interface ToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar(): void;
}

export function Toolbar({ sidebarOpen, onToggleSidebar }: ToolbarProps): JSX.Element {
  const { addNode, applyLayout, layout } = useGraph();

  return (
    <header className="toolbar">
      <div className="toolbar__branding">
        <span className="toolbar__logo" aria-hidden>
          🎓
        </span>
        <div>
          <h1>Course DAG Editor</h1>
          <p>Visualise prerequisites and plan study paths</p>
        </div>
      </div>
      <nav className="toolbar__actions">
        <div className="toolbar__group">
          <label htmlFor="layout-direction">Direction</label>
          <select
            id="layout-direction"
            value={layout.direction}
            onChange={(event) =>
              applyLayout({ direction: event.target.value as 'LR' | 'TD' })
            }
          >
            <option value="LR">Left → Right</option>
            <option value="TD">Top ↓ Down</option>
          </select>
        </div>
        <div className="toolbar__group">
          <label htmlFor="layout-engine">Engine</label>
          <select
            id="layout-engine"
            value={layout.engine}
            onChange={(event) =>
              applyLayout({ engine: event.target.value as 'dagre' | 'elk' })
            }
          >
            <option value="dagre">Dagre</option>
            <option value="elk">ELK (preview)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => addNode()}
          className="toolbar__button toolbar__button--primary"
        >
          Add course
        </button>
        <button type="button" onClick={onToggleSidebar} className="toolbar__button">
          {sidebarOpen ? 'Hide details' : 'Show details'}
        </button>
      </nav>
    </header>
  );
}
