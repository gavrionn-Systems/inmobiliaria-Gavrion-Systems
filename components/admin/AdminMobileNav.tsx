"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type NavItem = { key: string; label: string; href: string; icon?: string };

export default function AdminMobileNav({
  items,
  title,
  panelLabel,
  menuLabel,
  logoUrl,
  siteName,
  userName,
  roleLabel,
  loginPath,
  panelPath,
}: {
  items: readonly NavItem[];
  title: string;
  panelLabel: string;
  menuLabel: string;
  logoUrl: string;
  siteName: string;
  userName?: string;
  roleLabel?: string;
  loginPath: string;
  panelPath: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const visibleHref = (href: string) => `${panelPath}${href.replace(/^\/admin/, "")}`;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      toggleRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(loginPath);
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin" || pathname.endsWith("/admin")
      : pathname === href || pathname.startsWith(href) || pathname.endsWith(href.replace(/^\/admin/, ""));

  return (
    <>
      <div className="md:hidden bg-secondary px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-white/10">
        <Link href={panelPath} aria-label={siteName} className="flex items-center gap-2 min-w-0">
          <span className="brand-logo-mark brand-logo-mark--sm" aria-hidden="true">
            <span className="brand-logo-disc">
              <Image
                src={logoUrl}
                alt=""
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block font-headline-md text-headline-md text-surface text-sm truncate">
              {title}
            </span>
            <span className="block font-label-sm text-label-sm text-surface-variant truncate">
              {panelLabel}
            </span>
          </span>
        </Link>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="admin-mobile-drawer"
          className="w-11 h-11 -mr-2 flex items-center justify-center text-surface rounded hover:bg-white/10 transition-colors"
        >
          <span aria-hidden="true" className="material-symbols-outlined">
            {open ? "close" : "menu"}
          </span>
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        id="admin-mobile-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navegación del panel"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-secondary flex flex-col md:hidden shadow-xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full pointer-events-none invisible"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <span className="brand-logo-mark brand-logo-mark--sm" aria-hidden="true">
            <span className="brand-logo-disc">
              <Image
                src={logoUrl}
                alt=""
                width={28}
                height={28}
                className="h-full w-full object-contain"
              />
            </span>
          </span>
          <div className="min-w-0">
            <p className="font-headline-md text-headline-md text-surface text-sm truncate">
              {title}
            </p>
            <p className="font-label-sm text-label-sm text-surface-variant truncate">
              {panelLabel}
            </p>
          </div>
        </div>

        {userName && (
          <div className="px-6 py-4 border-b border-white/10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-on-primary-container text-lg"
              >
                person
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-surface font-bold truncate">
                {userName}
              </p>
              {roleLabel && (
                <p className="font-label-sm text-label-sm text-surface-variant truncate">
                  {roleLabel}
                </p>
              )}
            </div>
          </div>
        )}

        <nav className="flex flex-col py-4 flex-1 overflow-y-auto" aria-label="Admin móvil">
          <p className="px-6 pb-2 font-label-sm text-label-sm text-surface-variant uppercase tracking-wider">
            {menuLabel}
          </p>
          {items.map((item) => (
            <Link
              key={item.key}
              href={visibleHref(item.href)}
              aria-current={isActive(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-6 py-3 font-label-md text-label-md transition-colors ${
                isActive(item.href)
                  ? "text-primary-fixed font-bold bg-white/10"
                  : "text-surface-variant hover:bg-white/10 hover:text-surface"
              }`}
            >
              <span aria-hidden="true" className="material-symbols-outlined text-xl">
                {item.icon ?? "arrow_forward"}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-6 py-3 font-label-md text-label-md text-surface-variant hover:bg-white/10 hover:text-surface transition-colors"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              open_in_new
            </span>
            Ver sitio público
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="mt-auto flex items-center gap-3 px-6 py-3 font-label-md text-label-md text-error-container hover:bg-white/10 transition-colors text-left disabled:opacity-60"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-xl">
              logout
            </span>
            <span>{loggingOut ? "Saliendo…" : "Cerrar sesión"}</span>
          </button>
        </nav>
      </div>
    </>
  );
}
