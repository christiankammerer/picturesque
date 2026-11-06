# 07 · Project files

A **Project** is one Post saved to disk with copies of all its photos ([ADR 0003](../adr/0003-self-contained-project-files.md)). The data shapes are in [schema.ts](schema.ts).

## Container

**PRJ-01** A Project is a single file with the extension **`.picturesque`**. It is a **zip** with:

```
post.json                  ProjectFile (schema.ts)
photos/<sha256>.<ext>      every photo's original bytes, once each
thumbnail.jpg              first Slide, 512 px wide, JPEG quality 80
```

*Check:* `unzip -l` on a saved Project shows exactly this layout; `post.json` validates against the schema.

**PRJ-02** Photos are stored as their **original bytes, unchanged**, for every input format including HEIC. Each one is stored once under its lower-case hex SHA-256: the same photo in two Cells, or imported twice, is stored once. Photo files are stored in the zip without compression (they are already compressed); `post.json` is deflated.
*Check:* the stored file's SHA-256 equals its name and the original file's hash.

**PRJ-03** Nothing outside the file is referenced, except fonts by name (PRJ-12). There is no "missing photo" state and no relinking UI.
*Check:* moving or deleting the original photos doesn't affect opening the Project.

**PRJ-04** The installers register `.picturesque` with the OS, so double-clicking a Project opens it in Picturesque (DST-03).
*Check:* manual check on each OS before release.

## Saving

**PRJ-05** **Save** (Ctrl/Cmd+S) and **Save As…** (Ctrl/Cmd+Shift+S) are explicit. The first Save of a new Project behaves like Save As. The Project name defaults to the file name without its extension.
*Check:* end-to-end test of both.

**PRJ-06** **Atomic save:** the file is written to a temporary file in the same folder, flushed (fsync), then renamed over the target. A crash or power cut mid-save leaves either the old file or the new one, never a broken one.
*Check:* killing the process during a save of the benchmark Project leaves a Project that opens.

**PRJ-07** **Crash recovery:** every **30 s**, if there are unsaved changes, a recovery copy is written to `<app data>/recovery/`, using the same format and atomic write. On launch, if recovery copies exist from a session that didn't exit cleanly, the app offers "Restore unsaved work?" for each, with Restore and Discard. A clean exit deletes the session's recovery copies.
*Check:* killing the app 40 s after an edit and relaunching offers the restore, and restoring shows the edit.

**PRJ-08** Closing a window or quitting with unsaved changes asks **"Save changes to <name>?"**, offering Save, Don't Save and Cancel.
*Check:* end-to-end test of all three choices.

**PRJ-09** **Recent Projects** are stored in `<app data>/recent.json` as paths with the last-opened time; at most 12 are shown (EDT-01). The thumbnail is read from the file's `thumbnail.jpg`.
*Check:* opening a Project moves it to the top of Recent Projects.

## Versions

**PRJ-10** `post.json` carries an integer **`formatVersion`**, `1` in v1. The format is defined **once** as a zod schema, and the types in the code are derived from it.
- **Opening an older version:** the app migrates it forward in memory, step by step, with one migration function per version step. The next save writes the current version.
- **Opening a newer version:** the app refuses with "This Project was made with a newer version of Picturesque. Please update." It never opens a file it might damage.

*Check:* unit tests for the version check; a fixture with `formatVersion: 2` is refused with that message.

**PRJ-11** A file that isn't a valid zip, lacks `post.json`, fails schema validation, or references a photo missing from `photos/` is refused with "This file can't be opened: <reason>". The app never crashes or shows a half-loaded Project.
*Check:* fixtures for each failure case show the message.

## Fonts

**PRJ-12** Fonts are referenced by family name and source, **not embedded** (system fonts can't be redistributed). When a Project uses a font that isn't available:
- the renderer uses **Inter** instead;
- a small notice names the missing font(s);
- the original font name stays in the file, so the font comes back on a computer that has it.

*Check:* opening a Project that uses a font that isn't installed shows the notice, renders in Inter, and a re-save keeps the original family name.

## Preview cache

**PRJ-13** Preview copies (PRF-01) are **not** stored in the Project. They live in `<app data>/cache/previews/<sha256>.webp`. The cache may be deleted at any time; the app regenerates it.
*Check:* deleting the cache folder and reopening a Project works (cold open, PRF-08).

## Paths

**PRJ-14** `<app data>` is Electron's `app.getPath('userData')`. It holds `settings.json`, `recent.json`, `templates/`, `recovery/` and `cache/`.
*Check:* those paths are created on first use under `userData`.
