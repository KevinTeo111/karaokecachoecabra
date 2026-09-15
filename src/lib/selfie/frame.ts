/**
 * Draws a 1:1 crop of `source` with the Cacho e' Cabra frame baked in.
 * Runs entirely on the phone; the resulting JPEG is what gets uploaded.
 */
export function renderFramedSelfie(
  source: HTMLVideoElement | HTMLImageElement,
  caption: string,
  size = 720,
  mirror = true,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;

  ctx.save();
  if (mirror) {
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  ctx.restore();

  // Vignette so the frame text stays legible.
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "rgba(8,8,11,0.55)");
  grad.addColorStop(0.25, "rgba(8,8,11,0)");
  grad.addColorStop(0.7, "rgba(8,8,11,0)");
  grad.addColorStop(1, "rgba(8,8,11,0.75)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Brand frame.
  const inset = size * 0.035;
  ctx.strokeStyle = "#f2a93b";
  ctx.lineWidth = size * 0.018;
  roundedRect(ctx, inset, inset, size - inset * 2, size - inset * 2, size * 0.06);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f2a93b";
  ctx.font = `700 ${size * 0.038}px Manrope, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.008}px`;
  ctx.fillText("★  CACHO E' CABRA  ·  KARAOKE NIGHT  ★", size / 2, inset + size * 0.09);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${size * 0.055}px Manrope, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.006}px`;
  ctx.fillText(caption.toUpperCase(), size / 2, size - inset - size * 0.07);

  return canvas.toDataURL("image/jpeg", 0.86);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
