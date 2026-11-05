# Electron with one renderer for preview and export

Picturesque is an Electron app, and the editor preview and the exported images are drawn by the same pure function, `render(post, scale) → Canvas 2D`, over our own Post model. A Seamless Carousel only works if what the user sees lines up pixel-exact with what gets exported. Electron bundles the same Chromium on every OS, so one Canvas code path can guarantee that. We accept a ~100 MB install and Electron's 8-week upgrade cadence for it. Decided in [Choose platform and tech stack](https://github.com/christiankammerer/picturesque/issues/5).

## Considered Options

- **Tauri 2** gives far smaller installers, but it renders with each OS's own webview (WebView2, WKWebView, WebKitGTK). Exact output would then need a separate Rust export renderer. Preview and export would come from two engines, and text layout in particular would drift between them.
- **Konva/Fabric.js** were rejected because their object model would become our data model, while the project file and Templates need a model we own.
