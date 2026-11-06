# 09 · Distribution and updates

## Releases and installers

**DST-01** Releases live on **GitHub Releases** of `christiankammerer/picturesque` only. Package managers (Flathub, winget, Homebrew) come later, with code signing.
*Check:* the README's download link points to GitHub Releases.

**DST-02** Built with **electron-vite + electron-builder**, using electron-builder's default targets:

| OS | Installer | Architecture |
|---|---|---|
| Windows | NSIS installer (`.exe`) | x64 (ARM64 later) |
| macOS | DMG | universal (Apple Silicon + Intel) |
| Linux | AppImage and `.deb` | x64 |

*Check:* a tagged release has exactly these four artefacts, and each installs and launches on its OS.

**DST-03** The installers register the `.picturesque` file type (PRJ-04) and the app icon.
*Check:* manual check on each OS before release.

**DST-04** v1 is **unsigned** on every OS. The README and every release page have a short **"How to open the app"** section with screenshots:
- **macOS:** on first launch the app is blocked. Go to System Settings → Privacy & Security → **Open Anyway**. (Right-click → Open no longer works on current macOS versions.)
- **Windows:** in the SmartScreen dialog, click **More info** → **Run anyway**.
- **Linux:** make the AppImage executable (`chmod +x`, or Properties → Allow executing), or install the `.deb`.

*Check:* the README and the release template contain all three, with screenshots.

## Updates

**DST-05** There is **no auto-update** in v1. Once at startup, if **Check for updates at startup** is on (the default, EDT-29), the app requests the latest release from the GitHub Releases API:

```
GET https://api.github.com/repos/christiankammerer/picturesque/releases/latest
```

If its tag (`vX.Y.Z`) is a newer semver than the running version, a small, dismissible notice shows "**Version X.Y.Z is available**", with a **Download** link that opens the release page in the browser.
- Drafts and pre-releases are ignored.
- Failures (offline, rate limits, errors) are silent.
- The request has a 5 s timeout and sends no identifying data beyond what any HTTPS request does: no IDs, no usage data.
- This is the app's **only** network access (OVR-02).

*Check:* with a mocked API returning a newer tag the notice shows; with an older or equal tag, or with the network off, nothing shows; with the setting off, no request is made.

**DST-06** Real auto-update (electron-updater) is deferred until the app is signed.
*Check:* electron-updater isn't a dependency in v1.

## Release process

**DST-07** Versions follow **semver**, starting at **0.1.0**. The version lives in `package.json`, and the About box shows it.
*Check:* the About box shows the `package.json` version.

**DST-08** Pushing a tag `vX.Y.Z` runs a **GitHub Actions** workflow. It builds on Windows, macOS and Linux runners, runs the tests, and uploads the DST-02 artefacts to a **draft** GitHub Release. The release notes come from a template that includes the DST-04 instructions. The owner publishes the draft by hand.
*Check:* pushing a test tag creates a draft Release with the four artefacts.

**DST-09** Every pull request runs the CI workflow on all three OSes: lint, type-check, unit tests, golden-image tests, end-to-end tests and the benchmark smoke (PRF-12).
*Check:* a pull request shows these checks.

## Privacy

**DST-10** There is **no telemetry**: no analytics, usage statistics, crash reporting or error reporting. Bugs are reported through GitHub Issues, and the Help menu links to the issue tracker (opening it in the browser).
*Check:* no analytics or crash-reporting dependency exists; network tests (OVR-02) pass.
