"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";

export type GalleryImage = {
  url: string;
  alt_text: string | null;
};

export default function PropertyGallery({
  images,
  title,
  quality = 75,
}: {
  images: GalleryImage[];
  title: string;
  quality?: number;
}) {
  const labelId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const count = images.length;
  const [main, ...rest] = images;
  const thumbs = rest.slice(0, 4);
  const extra = rest.length - thumbs.length;

  const close = useCallback(() => setOpenIndex(null), []);
  const show = openIndex !== null;
  const current = show ? images[openIndex] : null;

  const go = useCallback(
    (delta: number) => {
      setOpenIndex((index) => {
        if (index === null || count < 2) return index;
        return (index + delta + count) % count;
      });
    },
    [count]
  );

  useEffect(() => {
    if (!show) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [show, close, go]);

  if (!main) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <GalleryThumb
          image={main}
          alt={main.alt_text ?? title}
          priority
          quality={quality}
          sizes="(max-width: 768px) 100vw, 66vw"
          className="relative h-64 sm:h-80 md:h-[480px] md:col-span-2 rounded-lg overflow-hidden"
          onOpen={() => setOpenIndex(0)}
        />
        <div className="hidden md:grid grid-cols-2 gap-2">
          {thumbs.map((image, i) => {
            const index = i + 1;
            const isLast = i === thumbs.length - 1 && extra > 0;
            return (
              <GalleryThumb
                key={`${image.url}-${index}`}
                image={image}
                alt={image.alt_text ?? title}
                quality={quality}
                sizes="33vw"
                className="relative h-[236px] rounded-lg overflow-hidden"
                overlay={isLast ? `+${extra}` : null}
                onOpen={() => setOpenIndex(index)}
              />
            );
          })}
        </div>
      </div>

      {rest.length > 0 && (
        <div className="md:hidden flex gap-2 overflow-x-auto pb-4 mb-4 -mx-px px-px">
          {rest.map((image, i) => (
            <GalleryThumb
              key={`${image.url}-m-${i}`}
              image={image}
              alt={image.alt_text ?? title}
              quality={quality}
              sizes="96px"
              className="relative h-16 w-24 flex-shrink-0 rounded overflow-hidden"
              onOpen={() => setOpenIndex(i + 1)}
            />
          ))}
        </div>
      )}

      {show && current ? (
        <div
          className="fixed inset-0 z-[70] bg-on-surface/80 flex items-center justify-center p-4 md:p-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelId}
          onClick={close}
        >
          <p id={labelId} className="sr-only">
            Vista previa de {current.alt_text ?? title}
          </p>

          <button
            type="button"
            onClick={close}
            aria-label="Cerrar vista previa"
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-surface text-on-surface flex items-center justify-center hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200"
          >
            <span aria-hidden="true" className="material-symbols-outlined">
              close
            </span>
          </button>

          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(-1);
                }}
                aria-label="Imagen anterior"
                className="absolute left-3 md:left-6 z-10 w-11 h-11 rounded-full bg-surface text-on-surface flex items-center justify-center hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  go(1);
                }}
                aria-label="Imagen siguiente"
                className="absolute right-3 md:right-6 z-10 w-11 h-11 rounded-full bg-surface text-on-surface flex items-center justify-center hover:bg-primary-container hover:text-on-primary-container transition-colors duration-200"
              >
                <span aria-hidden="true" className="material-symbols-outlined">
                  chevron_right
                </span>
              </button>
            </>
          ) : null}

          <div
            className="relative w-full max-w-5xl h-[70vh] md:h-[80vh] gallery-lightbox-image"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt_text ?? title}
              fill
              quality={quality}
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {count > 1 ? (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-label-sm text-label-sm text-surface bg-on-surface/70 px-3 py-1 rounded">
              {(openIndex ?? 0) + 1} / {count}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function GalleryThumb({
  image,
  alt,
  className,
  sizes,
  priority = false,
  quality = 75,
  overlay,
  onOpen,
}: {
  image: GalleryImage;
  alt: string;
  className: string;
  sizes: string;
  priority?: boolean;
  quality?: number;
  overlay?: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group gallery-thumb ${className}`}
      aria-label={`Ver ${alt} en grande`}
    >
      <Image
        src={image.url}
        alt={alt}
        fill
        priority={priority}
        quality={quality}
        sizes={sizes}
        className="object-cover gallery-thumb-img"
      />
      {overlay ? (
        <span className="absolute inset-0 bg-on-surface/45 text-surface font-headline-md text-headline-md flex items-center justify-center">
          {overlay}
        </span>
      ) : null}
    </button>
  );
}
