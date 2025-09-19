import { useMemo, useState } from 'react';

import { GraphCanvas } from './components/GraphCanvas';
import { MermaidPanel } from './components/MermaidPanel';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';

import './styles/app.css';

export default function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMermaidOpen, setMermaidOpen] = useState(false);

  const gridTemplateColumns = useMemo(() => {
    const columns = ['1fr'];
    if (isSidebarOpen) {
      columns.push('minmax(320px, 360px)');
    }
    if (isMermaidOpen) {
      columns.push('minmax(360px, 420px)');
    }
    return columns.join(' ');
  }, [isSidebarOpen, isMermaidOpen]);

  return (
    <div className="app-shell">
      <Toolbar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={isSidebarOpen}
        mermaidOpen={isMermaidOpen}
        onToggleMermaid={() => setMermaidOpen((prev) => !prev)}
      />
      <div className="app-main" style={{ gridTemplateColumns }}>
        <GraphCanvas />
        {isSidebarOpen && <Sidebar />}
        {isMermaidOpen && <MermaidPanel />}
      </div>
    </div>
  );
}
