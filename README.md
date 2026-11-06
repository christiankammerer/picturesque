# Picturesque

A free, open-source, offline desktop app for making Instagram Collages, Carousels and Seamless Carousels.

The v1 spec is in [`docs/spec/`](docs/spec/README.md).

## Development

Requires Node.js 22.18 or later (scripts run TypeScript directly).

```sh
npm install
npx playwright install chromium   # headless Chromium for golden tests and headless export

npm run dev            # run the app
npm run lint
npm run typecheck
npm test               # unit tests, then golden-image tests
npm run demo           # export fixtures/trip/post.json to out/demo/trip.jpg
```

### Headless export

```sh
node scripts/export-headless.ts <post.json> <out-dir> [--photos <dir>]
```

`post.json` is a Project file (`docs/spec/schema.ts`). Photos are found as `<photos>/<sha256>.<ext>`, or by their original name; `<photos>` defaults to the `photos` folder next to `post.json`.

### Golden-image tests

Renderer tests compare against reference PNGs in `tests/golden/__golden__/`. A changed reference is a deliberate, reviewed change: run `npm run test:golden:update`, look at every changed PNG, and commit them with the change that caused them. On failure, the actual image and a diff are written to `tests/golden/__output__/`, and CI uploads them as artefacts.

Tests that draw text keep one reference per OS (`<name>.linux.png`, `.darwin.png`, `.win32.png`), because each OS rasterises glyph edges with its own font backend. To update the macOS or Windows references, review the `actual.png` files in that OS's CI artefact and copy them in.

## Licence

Picturesque is licensed under [GPL-3.0-or-later](LICENSE). Images you export are yours. Picturesque places no licence on them.
