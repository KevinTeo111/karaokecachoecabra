import { LOGO_SRC } from "@/components/brand/logo";

const RED = "#e4002b";
const BLACK = "#08080b";
const WHITE = "#ffffff";

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(): Promise<HTMLImageElement | null> {
  logoPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = LOGO_SRC;
  });
  return logoPromise;
}

/**
 * Draws a 1:1 crop of `source` with the Cacho e' Cabra karaoke frame baked in:
 * red border, the venue logo on a black band at the top, a red band at the
 * bottom with the karaoke ribbon and the singer's caption. Runs on the phone;
 * the resulting JPEG is what gets uploaded and shown on the TV.
 */
export async function renderFramedSelfie(
  source: HTMLVideoElement | HTMLImageElement,
  caption: string,
  size = 720,
  mirror = true,
): Promise<string> {
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

  const band = size * 0.15;
  const border = size * 0.02;

  // Top band: black with the logo.
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, size, band);
  const logo = await loadLogo();
  if (logo) {
    const h = band * 0.72;
    const w = (logo.naturalWidth / logo.naturalHeight) * h;
    ctx.drawImage(logo, (size - w) / 2, (band - h) / 2, w, h);
  } else {
    ctx.fillStyle = WHITE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${band * 0.34}px Manrope, system-ui, sans-serif`;
    ctx.fillText("CACHO E' CABRA", size / 2, band / 2);
  }

  // Bottom band: red with the ribbon and caption.
  ctx.fillStyle = RED;
  ctx.fillRect(0, size - band, size, band);
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${band * 0.22}px Manrope, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.006}px`;
  ctx.fillText("★  KARAOKE NIGHT  ★", size / 2, size - band * 0.68);
  ctx.font = `700 ${band * 0.3}px Manrope, system-ui, sans-serif`;
  ctx.letterSpacing = `${size * 0.003}px`;
  ctx.fillText(caption.toUpperCase(), size / 2, size - band * 0.3);

  // Border.
  ctx.strokeStyle = RED;
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, size - border, size - border);

  return canvas.toDataURL("image/jpeg", 0.86);
}
