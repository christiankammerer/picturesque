// SPDX-License-Identifier: GPL-3.0-or-later
//
// The API the preload script exposes to the renderer (window.picturesque).

import type { PostType } from './model/schema.ts';

/** Menu commands the main process sends to the renderer. */
export type MenuCommand = 'new' | 'export';

export interface ExportWriteRequest {
  /** The folder the user chose. */
  folder: string;
  /** EXP-08: a Carousel goes into its own subfolder `<folder>/<name>/`. */
  postType: PostType;
  /** The sanitised base name (EXP-07). */
  baseName: string;
  files: { name: string; bytes: Uint8Array; mtime: number }[];
}

export interface PicturesqueApi {
  /** Native folder picker for export; null if cancelled. */
  chooseExportFolder(): Promise<string | null>;
  /** Writes the files atomically (EXP-12); returns their paths. */
  writeExport(request: ExportWriteRequest): Promise<string[]>;
  /** Called when a native menu item is chosen. Returns an unsubscribe function. */
  onMenu(listener: (command: MenuCommand) => void): () => void;
  /** Enables or disables menu items that depend on the editor's state. */
  setMenuState(state: { inWorkspace: boolean }): void;
}

declare global {
  interface Window {
    picturesque: PicturesqueApi;
  }
}
