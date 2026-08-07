import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanelApp } from './SidePanelApp';
import { ThemeProvider } from '../providers/ThemeProvider';
import { ToastProvider } from '../providers/ToastProvider';
import '../styles/globals.css';
import '../styles/components.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <SidePanelApp />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
