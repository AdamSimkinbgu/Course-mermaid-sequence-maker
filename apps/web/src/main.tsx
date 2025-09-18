import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GraphProvider } from './state/GraphContext';
import { ThemeProvider } from './theme/ThemeContext';

import './styles/global.css';
import 'reactflow/dist/style.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <GraphProvider>
        <App />
      </GraphProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
