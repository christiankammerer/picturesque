// SPDX-License-Identifier: GPL-3.0-or-later
//
// The bridge between the renderer and the main process. Only these calls
// are exposed; the renderer has no Node access.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { MenuCommand, PicturesqueApi } from '../shared/ipc.ts';

const api: PicturesqueApi = {
  chooseExportFolder: () => ipcRenderer.invoke('export:chooseFolder'),
  writeExport: (request) => ipcRenderer.invoke('export:write', request),
  onMenu: (listener) => {
    const handler = (_e: IpcRendererEvent, command: MenuCommand) => listener(command);
    ipcRenderer.on('menu', handler);
    return () => ipcRenderer.removeListener('menu', handler);
  },
  setMenuState: (state) => ipcRenderer.send('menu:state', state),
};

contextBridge.exposeInMainWorld('picturesque', api);
