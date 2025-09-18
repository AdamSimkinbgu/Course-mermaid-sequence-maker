import { useGraph } from '../state/GraphContext';
import { useTheme } from '../theme/ThemeContext';

import './Toolbar.css';

interface ToolbarProps {
  sidebarOpen: boolean;
  onToggleSidebar(): void;
}

export function Toolbar({ sidebarOpen, onToggleSidebar }: ToolbarProps): JSX.Element {
  const { addNode, applyLayout, layout, undo, redo, canUndo, canRedo, autosaveState } = useGraph();
  const { theme, toggleTheme } = useTheme();

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
        <div className="toolbar__history">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="toolbar__button toolbar__button--ghost"
            title="Undo (⌘/Ctrl+Z)"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="toolbar__button toolbar__button--ghost"
            title="Redo (⌘/Ctrl+Shift+Z)"
          >
            Redo
          </button>
        </div>
        <button type="button" onClick={toggleTheme} className="toolbar__button toolbar__button--ghost">
          {theme === 'light' ? '🌙 Dark mode' : '☀️ Light mode'}
        </button>
        <button type="button" onClick={onToggleSidebar} className="toolbar__button">
          {sidebarOpen ? 'Hide details' : 'Show details'}
        </button>
        <span className="toolbar__autosave" aria-live="polite">
          {autosaveState === 'saving' ? 'Saving…' : 'Saved'}
        </span>
      </nav>
    </header>
  );
}
