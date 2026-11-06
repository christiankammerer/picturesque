// SPDX-License-Identifier: GPL-3.0-or-later
//
// Preload bridge. Nothing is exposed yet; the editor's IPC arrives in M2.

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('picturesque', {});
