// Downscale a photo on the phone before upload (lab report 08): longest side 768 px,
// JPEG quality 0.7, sent as binary. Keeps uploads small on cellular.
export async function toJpeg768(file: Blob, max = 768, quality = 0.7): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}
