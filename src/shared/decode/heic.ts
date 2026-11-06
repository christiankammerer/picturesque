// SPDX-License-Identifier: GPL-3.0-or-later
//
// PRF-04: HEIC decoding with libheif and libde265, compiled to WASM
// (libheif-js). OVR-10: the WASM binary (LGPL-3.0) is a separate file,
// libheif.wasm, loaded at run time, so it can be replaced.

import factory, { type Libheif } from 'libheif-js/libheif-wasm/libheif.js';
import wasmUrl from 'libheif-js/libheif-wasm/libheif.wasm?url';

let lib: Promise<Libheif> | undefined;

function libheif(): Promise<Libheif> {
  lib ??= (async () => {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error(`could not load libheif.wasm (${response.status})`);
    return await factory({ wasmBinary: new Uint8Array(await response.arrayBuffer()) });
  })();
  return lib;
}

/**
 * Decodes the primary image of a HEIC file to full-size RGBA. libheif applies
 * the file's irot and imir transforms, so the result is upright.
 */
export async function decodeHeic(bytes: Uint8Array): Promise<ImageData> {
  const heif = await libheif();
  const images = new heif.HeifDecoder().decode(bytes);
  try {
    const image = images.find((i) => i.is_primary()) ?? images[0];
    if (!image) throw new Error('HEIC file holds no image');
    const width = image.get_width();
    const height = image.get_height();
    const data = new Uint8ClampedArray(width * height * 4);
    const result = await new Promise<{ data: Uint8ClampedArray } | null>((resolve) =>
      image.display({ data, width, height }, resolve),
    );
    if (!result) throw new Error('HEIC decoding failed');
    return new ImageData(data, width, height);
  } finally {
    for (const i of images) i.free();
  }
}
