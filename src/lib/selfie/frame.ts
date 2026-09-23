import { SELFIE_FRAME_SRC } from "@/components/brand/logo";

/** Frame artwork is 2:3 with a rounded transparent window; these are its proportions. */
export const FRAME_ASPECT = 2 / 3;
const WINDOW = { x: 0.054, y: 0.176, w: 0.891, h: 0.628, radius: 0.045 };

let framePromise: Promise<HTMLImageElement | null> | null = null;
function loadFrame(): Promise<HTMLImageElement | null> {
  framePromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = SELFIE_FRAME_SRC;
  });
  return framePromise;
}

/**
 * Renders the selfie inside the venue's karaoke frame: the camera image is
 * clipped to the frame's rounded window over a black background, then the
 * frame artwork is drawn on top. Runs on the phone; the JPEG is what gets
 * uploaded, shown on the TV and offered for download.
 */
export async function renderFramedSelfie(
  source: HTMLVideoElement | HTMLImageElement,
  width = 900,
  mirror = true,
): Promise<string> {
  const height = Math.round(width / FRAME_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#08080b";
  ctx.fillRect(0, 0, width, height);

  const win = { x: WINDOW.x * width, y: WINDOW.y * height, w: WINDOW.w * width, h: WINDOW.h * height, r: WINDOW.radius * width };
  const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  // Cover-fit the source into the window.
  const scale = Math.max(win.w / sw, win.h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = win.x + (win.w - dw) / 2;
  const dy = win.y + (win.h - dh) / 2;

  ctx.save();
  roundedRect(ctx, win.x, win.y, win.w, win.h, win.r);
  ctx.clip();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source, width - dx - dw, dy, dw, dh);
  } else {
    ctx.drawImage(source, dx, dy, dw, dh);
  }
  ctx.restore();

  const frame = await loadFrame();
  if (frame) ctx.drawImage(frame, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.88);
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

/** Hands the framed photo to the guest: native share sheet on phones, download link elsewhere. */
export async function saveSelfie(dataUrl: string, filename = "cacho-e-cabra-karaoke.jpg") {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Mi foto karaoke" });
      return;
    }
  } catch {
    /* share cancelled or unsupported: fall through to download */
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
