"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import ImageCropper from "@/components/admin/ImageCropper";
import { deletePropertyImage, uploadPropertyImage } from "@/lib/upload-actions";

export type GalleryItem = { url: string; alt: string };

// Aceptar cualquier imagen: el <input> filtra por image/* y el validador
// acepta por MIME o por extensión (incluye archivos de WhatsApp sin MIME y
// HEIC renombrado a .png/.jpg).
const ACCEPTED = "image/*,.heic,.heif,.tiff,.tif,.svg,.avif,.webp,.png,.jpg,.jpeg,.gif,.bmp";
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?|svg|hei[cf]|heics?|heifs?)$/i;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function isAcceptedImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (IMAGE_EXTENSIONS.test(file.name)) return true;
  // Algunos navegadores reportan HEIC como application/octet-stream
  if (!file.type && file.name.includes(".")) return IMAGE_EXTENSIONS.test(file.name);
  return false;
}

function isHeicByTypeOrName(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  return /\.hei[cf]$/i.test(file.name);
}

/** Convierte un blob HEIC/HEIF a JPEG usando heic2any. */
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  const output = Array.isArray(blob) ? blob[0] : blob;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
  return new File([output], `${baseName}.jpg`, { type: "image/jpeg" });
}

/** Intenta que el archivo sea decodificable por el navegador.
 *  Solo convierte HEIC explícito aquí; el cropper hará reintento
 *  para HEIC renombrado (ej: WhatsApp image.png que es HEIC). */
async function toDecodableFile(file: File): Promise<File> {
  if (isHeicByTypeOrName(file)) {
    return heicToJpeg(file);
  }
  return file;
}

export default function PropertyImageUploader({
  value,
  onChange,
  folder,
  multiple = false,
  max = 30,
  withAltText = false,
  emptyHint,
}: {
  value: GalleryItem[];
  onChange: (next: GalleryItem[]) => void;
  folder?: string;
  multiple?: boolean;
  max?: number;
  withAltText?: boolean;
  emptyHint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  /** Solo se borran del bucket los archivos subidos en esta sesión; las
   *  imágenes ya guardadas se desvinculan al guardar la propiedad. */
  const sessionUploads = useRef<Set<string>>(new Set());
  const inputId = useId();

  const [queue, setQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);

  const limit = multiple ? max : 1;
  const isFull = value.length >= limit;
  const current = queue[0];

  async function addFiles(files: FileList | File[]) {
    setError(null);
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!isAcceptedImage(file)) {
        setError("Solo se admiten imágenes.");
        continue;
      }
      if (file.size > MAX_INPUT_BYTES) {
        setError(`"${file.name}" es demasiado grande (máximo 25 MB).`);
        continue;
      }
      accepted.push(file);
    }
    const room = limit - value.length - queue.length;
    if (room <= 0) {
      setError(
        multiple
          ? `Ya alcanzó el máximo de ${max} imágenes.`
          : "Elimine la imagen actual para subir otra."
      );
      return;
    }
    if (accepted.length > room) {
      setError(`Solo se pueden añadir ${room} imágenes más.`);
    }
    const pending = accepted.slice(0, room);
    if (pending.length === 0) return;
    const needsConvert = pending.some(isHeicByTypeOrName);
    if (needsConvert) setConverting(true);
    try {
      const ready = await Promise.all(pending.map(toDecodableFile));
      setQueue((q) => [...q, ...ready]);
    } catch {
      setError(
        "No se pudo convertir esta imagen HEIC. Conviértala a JPG en su teléfono y vuelva a intentar."
      );
    } finally {
      setConverting(false);
    }
  }

  async function handleCropped(blob: Blob) {
    const file = current;
    setQueue((q) => q.slice(1));
    if (!file) return;

    setUploading(true);
    setError(null);
    const formData = new FormData();
    const blobType = blob.type || "image/webp";
    const ext = blobType === "image/png" ? "png" : blobType === "image/jpeg" ? "jpg" : "webp";
    const mimeForUpload = blobType === "image/png" || blobType === "image/jpeg" || blobType === "image/webp" ? blobType : "image/webp";
    formData.append("file", new File([blob], `imagen.${ext}`, { type: mimeForUpload }));
    if (folder) formData.append("folder", folder);

    try {
      const result = await uploadPropertyImage(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      sessionUploads.current.add(result.url);
      onChange([...value, { url: result.url, alt: "" }]);
    } catch {
      setError(
        "No se pudo subir la imagen (conexión o tamaño). Intente de nuevo."
      );
    } finally {
      setUploading(false);
    }
  }

  async function remove(index: number) {
    const item = value[index];
    onChange(value.filter((_, i) => i !== index));
    if (!sessionUploads.current.has(item.url)) return;
    sessionUploads.current.delete(item.url);
    const result = await deletePropertyImage(item.url);
    if (!result.ok) {
      setError(
        `${result.error} La imagen se quitó del formulario, pero la limpieza quedó pendiente.`
      );
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function setAlt(index: number, alt: string) {
    onChange(value.map((item, i) => (i === index ? { ...item, alt } : item)));
  }

  function addManualUrl() {
    const url = manualUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("Escriba una URL que empiece por http:// o https://");
      return;
    }
    if (isFull) {
      setError("No hay espacio para más imágenes.");
      return;
    }
    setError(null);
    setManualUrl("");
    setShowManual(false);
    onChange([...value, { url, alt: "" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary-container/30"
            : "border-outline-variant bg-surface"
        } ${isFull ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED}
          multiple={multiple}
          disabled={isFull || uploading || converting}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-3xl text-secondary"
        >
          add_photo_alternate
        </span>
        <p className="font-body-md text-body-md text-on-surface mt-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isFull || uploading || converting}
            className="text-primary font-bold underline underline-offset-2 disabled:no-underline disabled:opacity-60"
          >
            {multiple ? "Seleccionar imágenes" : "Seleccionar imagen"}
          </button>{" "}
          o arrástrelas aquí
        </p>
        <p className="font-body-sm text-body-sm text-secondary mt-1">
          {emptyHint ??
            "Cualquier imagen (JPG, PNG, WebP, HEIC de iPhone, etc.). Cada imagen se recorta a 16:9 antes de publicarse."}
        </p>
        {multiple && (
          <p className="font-label-sm text-label-sm text-secondary mt-1">
            {value.length} de {max}
          </p>
        )}
      </div>

      {(converting || uploading) && (
        <p className="font-body-sm text-body-sm text-secondary flex items-center gap-2">
          <span
            aria-hidden="true"
            className="material-symbols-outlined text-base animate-spin"
          >
            progress_activity
          </span>
          {converting
            ? "Convirtiendo imagen HEIC a JPG…"
            : "Subiendo imagen…"}
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

      {value.length > 0 && (
        <ul
          className={`grid gap-3 ${
            multiple ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 max-w-sm"
          }`}
        >
          {value.map((item, index) => (
            <li
              key={`${item.url}-${index}`}
              className="rounded border border-outline-variant overflow-hidden bg-surface"
            >
              <div className="relative w-full aspect-video bg-surface-container-high">
                <Image
                  src={item.url}
                  alt={item.alt || "Vista previa"}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
                {multiple && index === 0 && (
                  <span className="absolute top-1 left-1 bg-primary-container/90 text-on-primary-fixed font-label-sm text-label-sm px-2 py-0.5 rounded">
                    Portada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 p-1.5">
                {multiple && (
                  <>
                    <IconButton
                      icon="arrow_back"
                      label={`Mover la imagen ${index + 1} hacia atrás`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconButton
                      icon="arrow_forward"
                      label={`Mover la imagen ${index + 1} hacia adelante`}
                      disabled={index === value.length - 1}
                      onClick={() => move(index, 1)}
                    />
                  </>
                )}
                <IconButton
                  icon="delete"
                  label={`Eliminar la imagen ${index + 1}`}
                  onClick={() => remove(index)}
                  className="ml-auto hover:text-error"
                />
              </div>
              {withAltText && (
                <input
                  type="text"
                  value={item.alt}
                  onChange={(e) => setAlt(index, e.target.value)}
                  maxLength={200}
                  placeholder="Descripción para accesibilidad"
                  className="w-full border-t border-outline-variant bg-surface px-2 py-1.5 font-body-sm text-body-sm text-on-surface placeholder:text-secondary outline-none focus:border-primary"
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {showManual ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 min-w-56 bg-surface rounded border border-outline-variant px-3 py-2 font-body-md text-body-md text-on-surface placeholder:text-secondary outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={addManualUrl}
            className="font-label-md text-label-md text-primary px-3 py-2 rounded hover:bg-surface-container-high transition-colors"
          >
            Añadir
          </button>
          <button
            type="button"
            onClick={() => {
              setShowManual(false);
              setManualUrl("");
            }}
            className="font-label-md text-label-md text-secondary px-3 py-2 rounded hover:bg-surface-container-high transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowManual(true)}
          disabled={isFull}
          className="self-start font-label-sm text-label-sm text-secondary underline underline-offset-2 hover:text-primary disabled:opacity-60 disabled:no-underline"
        >
          Pegar una URL en su lugar
        </button>
      )}

      {current && (
        <ImageCropper
          key={`${current.name}-${current.lastModified}-${queue.length}`}
          file={current}
          fileName={current.name}
          remaining={queue.length - 1}
          onConfirm={handleCropped}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      )}
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className = "",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`p-1.5 rounded text-secondary hover:bg-surface-container-high transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-base">
        {icon}
      </span>
    </button>
  );
}
