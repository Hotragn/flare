// Types for gifenc 1.0.3 (it ships none): only what tools/sim/gif.ts uses.
declare module "gifenc" {
  type Palette = number[][];
  type Format = "rgb565" | "rgb444" | "rgba4444";
  type Encoder = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette;
        delay?: number;
        transparent?: boolean;
        transparentIndex?: number;
        repeat?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  const gifenc: {
    GIFEncoder(): Encoder;
    quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: Format }): Palette;
    applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: Format): Uint8Array;
  };
  export default gifenc;
}
