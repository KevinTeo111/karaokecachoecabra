"use client";

import { Camera, ImageUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { renderFramedSelfie } from "@/lib/selfie/frame";
import { useDraft } from "@/lib/store/draft";

type CameraState = "starting" | "ready" | "denied";

export default function SelfiePage() {
  const router = useRouter();
  const { draft, update } = useDraft();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [shot, setShot] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  const caption = `Mesa ${draft.tableNumber || "?"} · ${draft.displayName || "Cantante"}`;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamera("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera("ready");
    } catch {
      setCamera("denied");
    }
  }, []);

  useEffect(() => {
    if (!shot) void startCamera();
    return stopCamera;
  }, [shot, startCamera, stopCamera]);

  const capture = async () => {
    if (!videoRef.current) return;
    const shot = await renderFramedSelfie(videoRef.current, caption);
    setShot(shot);
    stopCamera();
  };

  const fromFile = (file: File | undefined) => {
    if (!file) return;
    const img = new Image();
    img.onload = async () => {
      setShot(await renderFramedSelfie(img, caption, 720, false));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  const accept = () => {
    if (!shot || !consent) return;
    update({ selfieUrl: shot, consent: true });
    router.push("/karaoke/datos");
  };

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Tu selfie" subtitle="Marco automático Cacho e' Cabra" />

      <div className="relative mx-auto mt-6 aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-ink-800 shadow-glow">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot} alt="Selfie con marco" className="size-full object-cover animate-rise" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
            <FrameOverlay caption={caption} />
            {camera === "starting" ? (
              <div className="absolute inset-0 grid place-items-center bg-ink-900/70 text-sm text-ink-300">
                Activando cámara…
              </div>
            ) : null}
            {camera === "denied" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-900/90 p-6 text-center">
                <p className="text-sm text-ink-200">No pudimos abrir la cámara. Puedes subir una foto o reintentar.</p>
                <Button variant="outline" size="sm" onClick={() => void startCamera()}>
                  Reintentar
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {shot ? (
        <div className="mt-6 flex flex-col gap-4 animate-rise">
          <label className="surface flex cursor-pointer items-start gap-3 rounded-2xl p-4 text-sm text-ink-200">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-brand-500"
            />
            <span>
              Acepto que esta selfie se muestre en las pantallas del local durante mi turno y se elimine
              automáticamente después de 24 horas.
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={() => setShot(null)}>
              Repetir
            </Button>
            <Button size="lg" disabled={!consent} onClick={accept}>
              Usar foto
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => void capture()}
            disabled={camera !== "ready"}
            aria-label="Tomar foto"
            className="grid size-20 place-items-center rounded-full border-4 border-brand-500 bg-ink-950 text-brand-400 shadow-glow transition active:scale-95 disabled:opacity-40"
          >
            <Camera className="size-8" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-400 hover:text-ink-200"
          >
            <ImageUp className="size-4" /> Subir foto
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => fromFile(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}

function FrameOverlay({ caption }: { caption: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between rounded-3xl border-[6px] border-brand-500 p-5">
      <span className="rounded-full bg-ink-950/70 px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-white">
        ★ Karaoke Night ★
      </span>
      <span className="rounded-full bg-ink-950/60 px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink-100">
        {caption}
      </span>
    </div>
  );
}
