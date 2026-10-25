import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createDefaultApi } from './lib/api';
import 'gestalt/dist/gestalt.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App api={createDefaultApi()} />
  </StrictMode>,
);
