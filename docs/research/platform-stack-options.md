# Platform and stack options for an offline cross-platform image app

Research for [#3](https://github.com/christiankammerer/picturesque/issues/3), part of the map [#1](https://github.com/christiankammerer/picturesque/issues/1).
Researched 2026-11-05. Version facts are as of that date and are linked to their sources.

> **Scope.** This note lays out facts and trade-offs. It does not pick a stack. The choice belongs to the grilling ticket "Choose platform and tech stack".

## Question

Which platform/stack options fit an offline, account-less, FOSS image-composition app (Collages and Carousels, see the map) on Windows, macOS and Linux, built entirely by AI? We compare Tauri, Electron, an offline PWA, Flutter and Qt on these points: HEIC decoding, system font access, local file access and saving projects, render fidelity for high-res export, bundle size, packaging and signing, licences of key dependencies, and how well AI agents build in each.

## Short answer

- **HEIC is the deciding constraint.** No Chromium-based runtime decodes HEIC: not Chrome, Edge, Electron, or Tauri's WebView2 on Windows. Only Safari/WebKit on Apple platforms does. Every stack therefore needs to bundle **libheif + libde265** (both LGPL-3.0) in some form: native, Rust FFI, or WebAssembly. On top of the licence, HEVC is patent-encumbered.
- **Web-UI stacks (Tauri, Electron) are the most AI-buildable.** For a canvas-and-photo app, AI agents are strongest in HTML/CSS/TypeScript plus Canvas 2D. **Electron** gives the same Chromium engine on every OS, so rendering and features are identical everywhere, at the cost of a large bundle. **Tauri** has small bundles and a Rust backend that suits native HEIC decoding and file I/O. Its downside is three different web engines: WebView2 on Windows, WebKit on macOS, and WebKitGTK on Linux.
- **A pure PWA falls short.** File System Access and Local Font Access work only in Chromium-based browsers. The PWA would also have to be served from an origin to install, which sits awkwardly with "no server".
- **Flutter and Qt are credible native options.** Both render consistently (Impeller in Flutter, QPainter/raster in Qt), but AI agents have less to draw on for either, and Qt adds LGPL/GPL module boundaries to track.

## Comparison table

| Criterion | Tauri 2 (web UI + Rust) | Electron | Offline PWA (browser) | Flutter (desktop) | Qt 6 (C++/QML or PySide) |
|---|---|---|---|---|---|
| **Current version** | 2.12.5 (2026-10-21); 3.0 in alpha [1] | 45.2.3 (2026-11-04), Chromium 156 [2] | n/a (browser-dependent) | 3.47.9 stable (2026-10-29), Dart 3.13 [3] | 6.12.0 [4] |
| **Rendering engine** | System webview: WebView2 (Chromium) on Windows, WKWebView on macOS, WebKitGTK on Linux [5] | Bundled Chromium, identical on all OSes | Whatever browser the user runs | Impeller, default on all three desktop OSes as of 3.47 [6] | QPainter (raster) / Qt Quick scene graph |
| **HEIC decoding** | No native support on Windows/Linux. WKWebView decodes HEIC (Safari 17+) [7]. Decode in Rust via libheif bindings (`libheif-sys`/`libheif-rs`) [8] or via WASM | Not in Chromium [9]. Use libheif as a native Node addon or libheif-js (WASM) [8][10] | Not in Chromium/Firefox, only in Safari [9]. libheif-js (WASM) needed [10] | No built-in desktop codec (judgment: Flutter's image codecs follow Skia/Impeller's set, which has no HEIC). Needs FFI to libheif | Qt Image Formats has only a macOS HEIF plugin (`macheif`) [11]. KDE KImageFormats adds HEIF read/write via libheif plugins [12] |
| **System font access** | WebView2 has `queryLocalFonts` (Chromium 103+). WebKit does not [13]. Portable route: enumerate in Rust and load via `FontFace` | `queryLocalFonts` (Chromium 103+) [13]. Node can also read font files directly | Chromium only, needs a permission prompt and user gesture [13] | Bundled fonts are easy. Enumerating system fonts needs a plugin or FFI (judgment) | `QFontDatabase` lists system fonts natively on all OSes (judgment, standard API) |
| **Local file access / saving projects** | Full native FS via Rust and the `dialog`/`fs` plugins (judgment from Tauri plugin model) | Full Node `fs` plus native `dialog.showOpenDialog`/`showSaveDialog` on all OSes. Security-scoped bookmarks for Mac App Store builds [14] | `showOpenFilePicker`/`showSaveFilePicker`/`showDirectoryPicker`: Chrome/Edge 86+ only, not Firefox or Safari [13]. OPFS works everywhere (Chrome 86, Firefox 111, Safari 15.2) but is sandboxed, so users can't see the files [13]. File Handling (open-with) requires Chrome/Edge 102+ and an installed PWA [15] | Native FS via `dart:io` + `file_selector`. macOS sandbox needs `files.user-selected.read-write` entitlement (App Store only) [16] | Native FS via `QFile`/`QFileDialog` |
| **High-res export fidelity** | Canvas 2D / OffscreenCanvas (WebKit 16.4+) [13]. Output can differ slightly per engine (colour management, image smoothing). Can export in Rust instead (e.g. `image`/`tiny-skia` crates) for bit-identical output | Same Chromium Canvas everywhere. Deterministic across OSes. OffscreenCanvas since Chrome 69 [13] | Depends on the user's browser. Canvas size limits are engine-specific | Consistent across OSes (one engine). `toImage` / `PictureRecorder` give offscreen render at any resolution | Consistent. `QImage` + `QPainter` offscreen at any resolution; mature |
| **Bundle size** | Minimal app <600 KB (official) [17]. Realistic app with libheif in the single-digit MB (estimate) | Ships Chromium + Node. Typically ~80–120 MB installed (estimate, not from official docs) | ~0 install, but must be served once from an origin | Roughly 20–40 MB (estimate) | Roughly 30–80 MB with Qt libs (estimate). Smaller with static Qt (but see LGPL) |
| **Packaging per OS** | Built-in bundler: MSI/NSIS, Microsoft Store; .app/DMG/App Store; deb, rpm, AppImage, Flatpak, Snap, AUR [18] | electron-builder / Electron Forge (judgment: de-facto tools). All formats incl. MSIX, DMG, AppImage, deb, rpm, Snap, Flatpak | Browser install prompt only. Not in OS package managers | `flutter build windows/macos/linux` gives the raw bundle. Installers need third-party tooling (MSIX, DMG, snap) [3][16] | `windeployqt`/`macdeployqt`; Linux via AppImage/Flatpak tooling (judgment) |
| **Signing** | macOS: Developer ID + notarisation required outside the App Store [18]. Windows: OV (pre-June-2023) / EV / Azure Key Vault / **Azure Artifact Signing** via `signCommand` [19]. SmartScreen reputation still builds over time even with EV (since 2024) [19] | Same Apple/Windows requirements. Docs call Azure Artifact Signing the cheapest Windows option; it is only available in some countries [20] | None needed (browser trust) | Same Apple/Windows requirements; Xcode-driven on macOS [16] | Same Apple/Windows requirements |
| **Framework licence** | Apache-2.0 / MIT [1] | MIT [2] | n/a | BSD-3-Clause [3] | LGPL-3.0 for most modules. Some modules are GPL-3.0-only (e.g. Qt Graphs, Qt Quick 3D, Qt Canvas Painter, Qt Qml Compiler, Qt Virtual Keyboard) [4] |
| **Key dependency licences** | libheif LGPL-3.0, libde265 LGPL-3.0 [8][21]. Fine for a FOSS app; ship as a dynamic lib or provide relinkable objects | Same (libheif-js is LGPL-3.0) [10] | Same (libheif-js) | Same | Same + Qt's LGPL obligations. KImageFormats is KDE-licensed (LGPL family) [12] |
| **AI-buildability (judgment)** | High for the UI (TS/HTML/Canvas). Medium for the Rust side. Breaking changes across Tauri 1→2 confuse agents trained on older examples | **Highest**: the largest corpus, one engine, so agents can test once | High code-wise, but the API gaps above force workarounds | Medium-high. Dart is well known, but custom canvas editors and desktop plugins have a thinner corpus | Medium. C++/QML builds and deployment are brittle for agents. PySide eases the code but complicates packaging |

**Patents (all stacks):** HEVC, the codec inside HEIC, is covered by patent pools. libheif's README makes no patent statement [8]. Distributing an HEVC decoder may carry patent risk in some jurisdictions. Some Linux distributions keep libde265 out of their main repositories for this reason (not verified per distro). Not a licence issue, but worth noting in the spec.

## Ranked recommendation (input for the grilling ticket, not a decision)

1. **Tauri 2 with a TypeScript/Canvas UI and Rust doing HEIC decode, file I/O and final export.** This gives small, fast, fully local installers with first-class packaging and signing on all three OSes. Doing the export in Rust (or in one shared WASM module) avoids per-webview rendering differences. The main risk is WebKitGTK quirks on Linux. Mitigate by keeping the UI preview-only and making the export path engine-independent.
2. **Electron with a TypeScript/Canvas UI, libheif via WASM or a native addon.** This is the easiest to build with AI agents and identical on every OS. It costs about 100 MB of download, a larger memory footprint, and a Chromium upgrade every 8 weeks (only 3 majors are supported) [22].
3. **Flutter desktop.** One renderer and good offscreen export. HEIC and system fonts both need FFI/plugin work, and AI agents have less to draw on for a custom canvas editor.
4. **Qt 6.** It has the strongest native imaging and font story, and HEIC is available via KImageFormats + libheif. The costs are module-licence bookkeeping, C++/QML build complexity, and the weakest AI-buildability.
5. **Offline PWA.** This is not a fit as the primary target. Saving and reopening project files (Chromium only), system fonts (Chromium only), and install-from-origin all clash with "no server, Windows/macOS/Linux". It is still useful as the throwaway prototype medium.

## Open points for the grilling ticket

- Rendering approach: export in the web canvas (simpler, engine-dependent) or in Rust/WASM (deterministic, more work)?
- HEIC: convert to an internal format on import, or decode on every load? This affects the project file format (map: "Not yet specified").
- Signing budget: an Apple Developer Program fee and a Windows signing service (Azure Artifact Signing, if the user's country is eligible) are needed for warning-free installs on any stack.
- `GLOSSARY.md` did not exist in the repo at the time of writing. Terms follow the map's Notes.

## Sources

1. Tauri releases (tauri-v2.12.5, 2026-10-21; tauri-v3.0.0-alpha.5, 2026-10-14) and repo licence: https://github.com/tauri-apps/tauri/releases
2. Electron releases feed (45.2.3, 2026-11-04, Chrome 156.0.8078.80): https://releases.electronjs.org/releases.json; licence: https://github.com/electron/electron
3. Flutter release manifest (3.47.9, 2026-10-29): https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json; desktop docs: https://docs.flutter.dev/platform-integration/desktop
4. Qt 6.12 licensing: https://doc.qt.io/qt-6/licensing.html; qtbase tag v6.12.0: https://github.com/qt/qtbase
5. Tauri webview versions: https://v2.tauri.app/reference/webview-versions/
6. Flutter Impeller: https://docs.flutter.dev/perf/impeller
7. WebKit, "WebKit Features in Safari 17.0" (HEIC in Safari, SFSafariViewController, WKWebView): https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
8. libheif README and COPYING (LGPL-3.0 library, MIT examples; latest release v1.23.7, 2026-10-26; language bindings list): https://github.com/strukturag/libheif
9. caniuse HEIF data (Chrome/Edge/Firefox: no; Safari: yes): https://github.com/Fyrd/caniuse/blob/main/features-json/heif.json
10. libheif-js (LGPL-3.0, 1.23.5): https://github.com/catdad-experiments/libheif-js
11. Qt Image Formats plugin tree (`macheif`, `webp`, `tiff`, ...; no cross-platform HEIF): https://code.qt.io/cgit/qt/qtimageformats.git/tree/src/plugins/imageformats
12. KDE KImageFormats README (HEIF read/write "depends on the HEIF plugins installed"; v6.31.0): https://invent.kde.org/frameworks/kimageformats
13. MDN browser-compat-data (`Window.showSaveFilePicker`/`showOpenFilePicker`/`showDirectoryPicker` Chrome 86, `queryLocalFonts` Chrome 103, no Firefox/Safari; `OffscreenCanvas`; `StorageManager.getDirectory`): https://github.com/mdn/browser-compat-data; https://developer.mozilla.org/en-US/docs/Web/API/Window/queryLocalFonts
14. Electron `dialog` API: https://www.electronjs.org/docs/latest/api/dialog
15. Chrome File Handling API: https://developer.chrome.com/docs/capabilities/web-apis/file-handling
16. Flutter macOS deployment: https://docs.flutter.dev/deployment/macos
17. Tauri "What is Tauri?" (minimal app < 600 KB): https://v2.tauri.app/start/
18. Tauri distribute: https://v2.tauri.app/distribute/
19. Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
20. Electron code signing: https://www.electronjs.org/docs/latest/tutorial/code-signing
21. libde265 COPYING (LGPL-3.0; v1.1.3, 2026-09-14): https://github.com/strukturag/libde265
22. Electron release timelines (3 supported majors, 8-week cadence): https://www.electronjs.org/docs/latest/tutorial/electron-timelines

Rows marked "judgment" or "estimate" are reasoned assessments, not sourced facts. Bundle sizes in particular should be measured with a prototype before they are relied on.
