# Projects are self-contained files with the original photos embedded

A Project is one `.picturesque` file: a zip of `post.json`, every photo's **original bytes, unchanged** (stored once per content hash as `photos/<sha256>.<ext>`), and a thumbnail. The alternative was a small JSON file linking to photos on disk. We rejected it because links break when photos are moved, renamed or deleted, or when a Project is copied to another computer. A tool for an offline, account-less app can't recover from that. Originals are kept rather than re-encoded copies, so a Project never loses quality and HEIC needs no lossy intermediate. Decided in [Project file format](https://github.com/christiankammerer/picturesque/issues/15).

## Consequences

- Projects are large: a 20-Slide Carousel of phone photos can reach about 100 MB. Saves must be atomic (write a temp file, then rename), and opening a Project re-decodes the photos (HEIC in the worker), so preview proxies matter for the [Performance budget](https://github.com/christiankammerer/picturesque/issues/17).
- "Missing photo" can't happen, so there is no relinking UI. Fonts are the one external dependency: they are referenced by name, never embedded, and fall back to the bundled default when missing.
- Saved Templates are a separate, photo-free JSON format in the app's data folder, not `.picturesque` files.
