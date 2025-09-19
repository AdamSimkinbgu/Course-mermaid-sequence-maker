import { useEffect, useMemo, useState } from 'react';

import { useGraph } from '../state/GraphContext';
import type { MermaidParseError } from '../state/mermaid';

import './MermaidPanel.css';

export function MermaidPanel(): JSX.Element {
  const { mermaidCode, applyMermaid } = useGraph();
  const [code, setCode] = useState(mermaidCode);
  const [errors, setErrors] = useState<MermaidParseError[]>([]);
  const [status, setStatus] = useState<'idle' | 'applied' | 'error'>('idle');
  const isDirty = useMemo(() => code !== mermaidCode, [code, mermaidCode]);

  useEffect(() => {
    if (!isDirty) {
      setCode(mermaidCode);
      setErrors([]);
      setStatus('idle');
    }
  }, [isDirty, mermaidCode]);

  const handleApply = () => {
    const result = applyMermaid(code);
    if (result.ok) {
      setErrors([]);
      setStatus('applied');
    } else {
      setErrors(result.errors);
      setStatus('error');
    }
  };

  const handleReset = () => {
    setCode(mermaidCode);
    setErrors([]);
    setStatus('idle');
  };

  return (
    <aside className="mermaid-panel">
      <header className="mermaid-panel__header">
        <div>
          <h2>Mermaid Code</h2>
          <p>Edit the flowchart definition and sync it with the graph.</p>
        </div>
        <div className="mermaid-panel__actions">
          <button
            type="button"
            className="mermaid-panel__button"
            onClick={handleReset}
            disabled={!isDirty}
          >
            Reset
          </button>
          <button
            type="button"
            className="mermaid-panel__button mermaid-panel__button--primary"
            onClick={handleApply}
            disabled={!isDirty && errors.length === 0}
          >
            Apply
          </button>
        </div>
      </header>
      <textarea
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          setStatus('idle');
        }}
        spellCheck={false}
        className="mermaid-panel__editor"
        aria-label="Mermaid flowchart code"
      />
      <footer className="mermaid-panel__footer" aria-live="polite">
        {status === 'applied' && <span className="mermaid-panel__status mermaid-panel__status--success">Graph updated</span>}
        {status === 'error' && errors.length > 0 && (
          <div className="mermaid-panel__errors">
            <strong>Mermaid parse errors</strong>
            <ul>
              {errors.map((error) => (
                <li key={`${error.line}-${error.message}`}>
                  Line {error.line}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {status === 'idle' && isDirty && (
          <span className="mermaid-panel__status">Unsaved edits</span>
        )}
      </footer>
    </aside>
  );
}
