// SPDX-License-Identifier: GPL-3.0-or-later
// The parts of libheif-js's JavaScript wrapper that the decoder uses.

declare module 'libheif-js/libheif-wasm/libheif.js' {
  export interface HeifImage {
    is_primary(): boolean;
    get_width(): number;
    get_height(): number;
    display(
      target: { data: Uint8ClampedArray; width: number; height: number },
      done: (result: { data: Uint8ClampedArray; width: number; height: number } | null) => void,
    ): void;
    free(): void;
  }
  export interface Libheif {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
  }
  const factory: (options: { wasmBinary: Uint8Array }) => Libheif | Promise<Libheif>;
  export default factory;
}
