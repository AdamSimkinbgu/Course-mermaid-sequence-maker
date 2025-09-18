import { useState } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';

import './styles/app.css';

export default function App() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-shell">
      <Toolbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} sidebarOpen={isSidebarOpen} />
      <div className="app-main">
        <GraphCanvas />
        {isSidebarOpen && <Sidebar />}
      </div>
    </div>
  );
}
