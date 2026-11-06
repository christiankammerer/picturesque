// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StartScreen } from './components/StartScreen.tsx';
import { Workspace } from './components/Workspace.tsx';
import { runExport } from './export/run-export.ts';
import { getState, setState, useEditor } from './state/store.ts';

export function App() {
  const { t } = useTranslation();
  const screen = useEditor((s) => s.screen);
  const name = useEditor((s) => s.project?.name);
  const dirty = useEditor((s) => s.dirty);

  // EDT-31: the window title shows the Project name, and • for unsaved changes.
  useEffect(() => {
    document.title =
      screen === 'start'
        ? t('app.name')
        : t('app.windowTitle', { name: name ?? t('app.untitled'), mark: dirty ? t('app.unsavedMark') : '' });
  }, [screen, name, dirty, t]);

  useEffect(() => window.picturesque?.setMenuState({ inWorkspace: screen === 'workspace' }), [screen]);

  useEffect(
    () =>
      window.picturesque?.onMenu((command) => {
        if (command === 'new') setState({ screen: 'start' });
        else if (command === 'export' && getState().screen === 'workspace') void runExport();
      }),
    [],
  );

  return screen === 'start' ? <StartScreen /> : <Workspace />;
}
