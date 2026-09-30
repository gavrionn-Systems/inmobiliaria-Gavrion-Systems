"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { site } from "@/lib/site";

export default function PageTransition() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);
  const overlayRef = useRef<number | null>(null);
  const prevPath = useRef(pathname);

  // Cuando cambia la ruta, ocultamos la barra con un fade
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    // ruta ya cambió -> completar barra y ocultar
    setLeaving(true);
    setShowOverlay(false);
    if (overlayRef.current) window.clearTimeout(overlayRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (hideRef.current) window.clearTimeout(hideRef.current);
    // pequeño delay para que se vea el 100%
    hideRef.current = window.setTimeout(() => {
      setActive(false);
      setLeaving(false);
    }, 450);
  }, [pathname]);

  useEffect(() => {
    // respeta animaciones desactivadas o reduced-motion
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animationsOff =
      document.documentElement.getAttribute("data-animations") === "off";
    if (media.matches || animationsOff) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      // solo internas, mismo origen, sin _blank, sin hash-only, sin download
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("http") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      // hrefs como "/" o "/propiedades" o "/propiedades?id=..."
      if (!href.startsWith("/")) return;
      // si ya estamos en la misma ruta exacta, no mostrar
      try {
        const url = new URL(anchor.href);
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {}
      // iniciar barra
      setActive(true);
      setLeaving(false);
      setShowOverlay(false);
      if (overlayRef.current) window.clearTimeout(overlayRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      // overlay solo si la carga se alarga > 240ms (evita flash en navegación rápida)
      overlayRef.current = window.setTimeout(() => setShowOverlay(true), 240);
      // fallback: si navegación no completa en 4s, ocultar
      timeoutRef.current = window.setTimeout(() => {
        setLeaving(true);
        setShowOverlay(false);
        hideRef.current = window.setTimeout(() => {
          setActive(false);
          setLeaving(false);
        }, 450);
      }, 4000);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (overlayRef.current) window.clearTimeout(overlayRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (hideRef.current) window.clearTimeout(hideRef.current);
    };
  }, []);

  if (!active && !leaving) return null;

  return (
    <>
      {/* Barra superior — siempre visible durante carga */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[9998]"
      >
        <div
          className={`page-transition-bar h-[2.5px] bg-primary-container origin-left ${
            leaving ? "page-transition-bar--done" : "page-transition-bar--active"
          }`}
        />
        <div
          className={`page-transition-veil absolute inset-0 top-[2.5px] h-[2px] bg-primary-container/20 blur-[1px] ${
            leaving ? "opacity-0" : "opacity-100"
          } transition-opacity duration-300`}
        />
      </div>

      {/* Overlay premium — solo si la navegación tarda, para ocultar el skeleton crudo */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 top-20 z-[9997] flex items-start justify-center pt-[18vh] transition-opacity duration-300 ${
          showOverlay && !leaving ? "opacity-100" : "opacity-0"
        }`}
        style={{ background: showOverlay && !leaving ? "color-mix(in srgb, var(--color-surface) 68%, transparent)" : "transparent", backdropFilter: showOverlay && !leaving ? "blur(5px)" : "none", WebkitBackdropFilter: showOverlay && !leaving ? "blur(5px)" : "none" }}
      >
        <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-full shadow-[0_8px_32px_rgba(25,28,29,0.10)] px-5 py-2.5 flex items-center gap-3">
          <span className="relative w-8 h-8 rounded-full overflow-hidden bg-surface-container-lowest border border-outline-variant/50 flex-shrink-0 flex items-center justify-center">
            <Image src={site.logoUrl} alt="" width={28} height={28} className="w-6 h-6 object-contain" />
          </span>
          <span className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-container border-t-primary animate-spin" aria-hidden="true" />
            <span className="font-label-md text-label-md text-secondary tracking-wide">Cargando</span>
          </span>
          <span className="hidden sm:inline-flex h-4 w-px bg-outline-variant/40 mx-1" aria-hidden="true" />
          <span className="hidden sm:inline font-label-sm text-label-sm text-secondary/70">
            {site.name}
          </span>
        </div>
      </div>
    </>
  );
}
