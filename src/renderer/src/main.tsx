// SPDX-License-Identifier: GPL-3.0-or-later
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './i18n/index.ts';
import './styles.css';
import { getState } from './state/store.ts';

// Read-only access to the open Project, for end-to-end tests.
(window as unknown as { __picturesque: unknown }).__picturesque = { project: () => getState().project };

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
