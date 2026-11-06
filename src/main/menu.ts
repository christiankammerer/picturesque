// SPDX-License-Identifier: GPL-3.0-or-later
//
// EDT-30: native menus. Items whose features arrive in later milestones are
// shown disabled, so the menu structure is final from the start.

import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { MenuCommand } from '../shared/ipc.ts';
import { t } from './i18n.ts';

export function buildMenu(win: BrowserWindow, state: { inWorkspace: boolean }): void {
  const send = (command: MenuCommand) => () => win.webContents.send('menu', command);
  const later = { enabled: false };
  const mac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [{
          label: app.name,
          submenu: [
            { label: t('menu.about'), ...later },
            { type: 'separator' as const },
            { label: t('menu.settings'), accelerator: 'Cmd+,', ...later },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const, label: t('menu.quit') },
          ],
        }]
      : []),
    {
      label: t('menu.file'),
      submenu: [
        { label: t('menu.new'), accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: t('menu.open'), accelerator: 'CmdOrCtrl+O', ...later },
        { label: t('menu.openRecent'), submenu: [], ...later },
        { type: 'separator' },
        { label: t('menu.save'), accelerator: 'CmdOrCtrl+S', ...later },
        { label: t('menu.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', ...later },
        { label: t('menu.saveAsTemplate'), ...later },
        { type: 'separator' },
        { label: t('menu.export'), accelerator: 'CmdOrCtrl+E', enabled: state.inWorkspace, click: send('export') },
        ...(mac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const, label: t('menu.quit') }]),
      ],
    },
    {
      label: t('menu.edit'),
      submenu: [
        { label: t('menu.undo'), accelerator: 'CmdOrCtrl+Z', ...later },
        { label: t('menu.redo'), accelerator: mac ? 'Cmd+Shift+Z' : 'Ctrl+Y', ...later },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'selectAll', label: t('menu.selectAll') },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        { label: t('menu.gridCrop'), ...later },
        { label: t('menu.previewAsPost'), ...later },
        ...(app.isPackaged ? [] : [{ type: 'separator' as const }, { role: 'toggleDevTools' as const }]),
      ],
    },
    {
      label: t('menu.help'),
      submenu: [
        { label: t('menu.shortcuts'), ...later },
        { label: t('menu.phoneHelp'), ...later },
        ...(mac ? [] : [{ label: t('menu.about'), ...later }]),
        { label: t('menu.licences'), ...later },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
