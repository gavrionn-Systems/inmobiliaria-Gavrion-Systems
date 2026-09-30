"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const CROP_ASPECT = 16 / 9;
const MAX_OUTPUT_WIDTH = 1600;
const MIN_OUTPUT_WIDTH = 640;
const WEBP_QUALITY = 0.85;
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

/** Recorta y normaliza una imagen a 16:9 antes de subirla, para que el
 *  encuadre elegido sea exactamente el que se publica en las tarjetas. */
export default function ImageCropper({
  file,
  fileName,
  remaining,
  onConfirm,
  onCancel,
}: {
  file: File;
  fileName: string;
  remaining: number;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: Offset } | null>(null);

  const [src, setSrc] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const retryRef = useRef(false);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) =>
      setFrameWidth(entry.contentRect.width)
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const frameHeight = frameWidth / CROP_ASPECT;

  // Escala mínima con la que la imagen cubre el marco por completo.
  const baseScale =
    natural && frameWidth
      ? Math.max(frameWidth / natural.w, frameHeight / natural.h)
      : 1;
  const drawnWidth = natural ? natural.w * baseScale * zoom : 0;
  const drawnHeight = natural ? natural.h * baseScale * zoom : 0;

  const clamp = useCallback(
    (value: Offset, w: number, h: number): Offset => ({
      x: Math.min(0, Math.max(frameWidth - w, value.x)),
      y: Math.min(0, Math.max(frameHeight - h, value.y)),
    }),
    [frameWidth, frameHeight]
  );

  // El desplazamiento se recorta en el render en vez de en un efecto, para que
  // cambiar el zoom o el tamaño del marco nunca deje la imagen fuera de sitio.
  const activeOffset: Offset = offset
    ? clamp(offset, drawnWidth, drawnHeight)
    : { x: (frameWidth - drawnWidth) / 2, y: (frameHeight - drawnHeight) / 2 };

  async function onImageError() {
    if (retryRef.current) {
      setError(
        "El navegador no pudo mostrar esta imagen. Use la opción 'Subir sin recortar' abajo o conviértala a JPG/PNG e intente de nuevo."
      );
      setFallbackAvailable(true);
      setRetrying(false);
      return;
    }
    retryRef.current = true;
    setRetrying(true);
    setError(null);
    // 1) Intento HEIC (WhatsApp image.png que en realidad es HEIC)
    try {
      const { default: heic2any } = await import("heic2any");
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const output = Array.isArray(blob) ? blob[0] : blob;
      const convertedFile = new File([output], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, {
        type: "image/jpeg",
      });
      const nextUrl = URL.createObjectURL(convertedFile);
      URL.revokeObjectURL(src);
      setSrc(nextUrl);
      return;
    } catch {}
    // 2) Fallback genérico via createImageBitmap -> canvas -> jpeg (para JPEG progresivo / WEBP raro)
    try {
      if (typeof createImageBitmap !== "undefined") {
        const bitmap = await createImageBitmap(file);
        const c = document.createElement("canvas");
        c.width = bitmap.width;
        c.height = bitmap.height;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.9));
          if (blob) {
            const url = URL.createObjectURL(blob);
            URL.revokeObjectURL(src);
            setSrc(url);
            return;
          }
        } else {
          bitmap.close();
        }
      }
    } catch {}
    setError(
      "El navegador no pudo mostrar esta imagen. Use la opción 'Subir sin recortar' abajo o conviértala a JPG/PNG e intente de nuevo."
    );
    setFallbackAvailable(true);
    setRetrying(false);
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    imageRef.current = img;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setRetrying(false);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: activeOffset,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setOffset({
      x: drag.origin.x + (e.clientX - drag.startX),
      y: drag.origin.y + (e.clientY - drag.startY),
    });
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }

  function nudge(dx: number, dy: number) {
    setOffset({ x: activeOffset.x + dx, y: activeOffset.y + dy });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    nudge(move[0], move[1]);
  }

  async function confirm() {
    const img = imageRef.current;
    if (!img || !natural || !frameWidth) return;
    setWorking(true);
    setError(null);

    const scale = baseScale * zoom;
    const sourceX = -activeOffset.x / scale;
    const sourceY = -activeOffset.y / scale;
    const sourceW = frameWidth / scale;
    const sourceH = frameHeight / scale;

    const outputWidth = Math.round(
      Math.min(MAX_OUTPUT_WIDTH, Math.max(MIN_OUTPUT_WIDTH, sourceW))
    );
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = Math.round(outputWidth / CROP_ASPECT);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setWorking(false);
      setError("El navegador no pudo procesar la imagen.");
      return;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
    );
    setWorking(false);
    if (!blob) {
      setError("No se pudo generar la imagen recortada.");
      return;
    }
    onConfirm(blob);
  }

  async function uploadWithoutCrop() {
    setWorking(true);
    setError(null);
    try {
      // Intenta generar un WebP 16:9 centrado sin necesidad de preview
      if (typeof createImageBitmap !== "undefined") {
        try {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement("canvas");
          canvas.width = 1600;
          canvas.height = Math.round(1600 / CROP_ASPECT);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingQuality = "high";
            const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
            const w = bitmap.width * scale;
            const h = bitmap.height * scale;
            const x = (canvas.width - w) / 2;
            const y = (canvas.height - h) / 2;
            ctx.drawImage(bitmap, x, y, w, h);
            const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", WEBP_QUALITY));
            bitmap.close();
            if (blob) {
              onConfirm(blob);
              return;
            }
          } else {
            bitmap.close();
          }
        } catch {}
      }
      // Fallback final: subir el archivo tal cual (será validado por el servidor)
      onConfirm(file);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recortar imagen"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
    >
      <div className="bg-surface-container-low rounded-lg border border-outline-variant w-full max-w-2xl max-h-full overflow-y-auto p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Ajustar encuadre
          </h2>
          <p className="font-body-sm text-body-sm text-secondary mt-1">
            Arrastre la imagen y use el zoom para elegir qué parte se verá. El
            recorte 16:9 es exactamente lo que aparecerá en el sitio.
          </p>
        </div>

        <p className="font-label-sm text-label-sm text-secondary truncate">
          {fileName}
          {remaining > 0 && ` · quedan ${remaining} imágenes por ajustar`}
        </p>

        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          className="relative w-full aspect-video overflow-hidden rounded bg-surface-container-high touch-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {src && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={src}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              onError={onImageError}
              style={{
                position: "absolute",
                left: activeOffset.x,
                top: activeOffset.y,
                width: drawnWidth || undefined,
                height: drawnHeight || undefined,
                maxWidth: "none",
                visibility: natural ? "visible" : "hidden",
              }}
            />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 border-2 border-white/70 rounded"
          />
        </div>

        <label className="font-label-sm text-label-sm text-secondary flex items-center gap-3">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-primary)]"
            aria-label="Nivel de zoom"
          />
        </label>

        {retrying && !error && (
          <p className="font-body-sm text-body-sm text-secondary flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-base animate-spin">
              progress_activity
            </span>
            Convirtiendo imagen…
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="bg-error-container text-on-error-container font-body-sm text-body-sm px-3 py-2 rounded"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={!natural || working}
            className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded hover:bg-primary-fixed-dim hover:text-on-primary-fixed transition-colors disabled:opacity-60"
          >
            {working ? "Procesando…" : "Usar este encuadre"}
          </button>
          {fallbackAvailable && (
            <button
              type="button"
              onClick={uploadWithoutCrop}
              disabled={working}
              className="bg-secondary-container text-on-secondary-container font-label-md text-label-md px-6 py-2.5 rounded hover:opacity-90 transition-colors disabled:opacity-60"
            >
              {working ? "Subiendo…" : "Subir sin recortar"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="font-label-md text-label-md text-secondary px-4 py-2.5 rounded hover:bg-surface-container-high transition-colors"
          >
            Descartar
          </button>
        </div>
        {fallbackAvailable && !natural && (
          <p className="font-body-sm text-body-sm text-secondary">
            La vista previa falló, pero puedes subir la imagen igual con recorte automático centrado.
          </p>
        )}
      </div>
    </div>
  );
}
