// SPDX-License-Identifier: GPL-3.0-or-later
//
// Electron main process.

import { join } from 'node:path';
import { app, BrowserWindow, ipcMain } from 'electron';
import { registerExportIpc } from './ipc/export.ts';
import { buildMenu } from './menu.ts';
import { APP_ORIGIN, registerAppScheme, serveRenderer } from './protocol.ts';

registerAppScheme();

// End-to-end tests run with a throwaway profile.
const testProfile = process.env['PICTURESQUE_TEST_USER_DATA'];
if (testProfile) app.setPath('userData', testProfile);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = win;
  buildMenu(win, { inWorkspace: false });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  // The app makes no network requests (OVR-02); nothing opens new windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl);
  else void win.loadURL(`${APP_ORIGIN}/index.html`);
}

ipcMain.on('menu:state', (event, state: { inWorkspace: boolean }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) buildMenu(win, state);
});

registerExportIpc(() => mainWindow);

void app.whenReady().then(() => {
  serveRenderer(join(import.meta.dirname, '../renderer'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
