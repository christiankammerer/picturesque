// SPDX-License-Identifier: GPL-3.0-or-later
//
// Export, main-process side: the folder picker and the atomic writes.
// The full EXP-08 flow (last folder, default folder setting, replace
// prompt) arrives with M3.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import type { ExportWriteRequest } from '../../shared/ipc.ts';
import { writeExportFiles } from '../export/write-files.ts';
import { t } from '../i18n.ts';

export function registerExportIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('export:chooseFolder', async () => {
    // End-to-end tests choose the folder without a native dialog.
    const testDir = process.env['PICTURESQUE_TEST_EXPORT_DIR'];
    if (testDir) return testDir;
    const defaultPath = join(app.getPath('pictures'), 'Picturesque');
    await mkdir(defaultPath, { recursive: true });
    const win = getWindow();
    const options = { title: t('export.chooseFolder'), defaultPath, properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('export:write', async (_event, request: ExportWriteRequest) => {
    const dir = request.postType === 'collage' ? request.folder : join(request.folder, request.baseName);
    return writeExportFiles(dir, request.files.map((f) => ({ ...f, bytes: new Uint8Array(f.bytes) })));
  });
}
