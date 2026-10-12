// Dark photos, brightened for display only (photo-fit fix). A friend opened a dim indoor photo
// and could not see the place. We draw the decoded photo onto a 32 x 32 canvas, take its mean
// luminance (0 to 1), and if it is under 0.35 we set a CSS filter on the <img>. The photo's
// bytes (sealed, uploaded, decrypted) are never touched: only the element's style changes.
// Loaded lazily from the photo's load event, so it costs the entry bundles nothing.

/** Under this mean luminance a photo counts as dark. */
export const DARK = 0.35;
const SIDE = 32;

/** Mean luma (Rec. 709 weights on sRGB values) of RGBA pixels, 0 to 1. Transparent pixels are skipped. */
export function meanLuma(rgba: ArrayLike<number>): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    sum += 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    n++;
  }
  return n ? sum / n / 255 : 1;
}

/** The display filter for a mean luma: "" when bright enough, stronger the darker it is (max 1.6). */
export function filterFor(mean: number): string {
  if (!(mean < DARK)) return "";
  const b = Math.min(1.6, 1 + (DARK - mean) * 2);
  const c = 1 + (b - 1) * 0.15;
  return `brightness(${b.toFixed(2)}) contrast(${c.toFixed(2)})`;
}

/** Mean luma of a decoded image, or null when the canvas can't be read (tainted, no 2D context). */
export function measure(img: HTMLImageElement): number | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIDE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !img.naturalWidth) return null;
    ctx.drawImage(img, 0, 0, SIDE, SIDE);
    return meanLuma(ctx.getImageData(0, 0, SIDE, SIDE).data);
  } catch {
    return null; // a cross-origin photo taints the canvas: show it as it is
  }
}

/** Sets (or clears) the display filter on a loaded photo. */
export function light(img: HTMLImageElement): void {
  const mean = measure(img);
  img.style.filter = mean === null ? "" : filterFor(mean);
  if (mean !== null) img.dataset.luma = mean.toFixed(3);
}
