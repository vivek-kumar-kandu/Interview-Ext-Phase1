import React from 'react';
import ReactDOM from 'react-dom/client';
import DevWorkbench from './DevWorkbench';
import '../styles/globals.css';
import '../styles/components.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DevWorkbench />
  </React.StrictMode>
);
